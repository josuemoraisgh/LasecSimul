#include "McuComponent.hpp"
#include "lasecsimul/qemu_arena_abi.h"

namespace lasecsimul::mcu {

McuComponent::McuComponent(std::unique_ptr<IMcuAdapter> adapter, simulation::Scheduler& scheduler,
                           std::span<const Pin> requestedPins)
    : m_adapter(std::move(adapter)), m_scheduler(scheduler) {
    m_modules = m_adapter->createModules();

    const auto pinMap = m_adapter->pinMap();
    const bool useRequestedPins = requestedPins.size() == pinMap.size();
    m_pins.reserve(pinMap.size());
    for (size_t index = 0; index < pinMap.size(); ++index) {
        if (useRequestedPins) {
            Pin pin = requestedPins[index];
            if (pin.id.empty()) pin.id = pinMap[index].pinId;
            m_pins.push_back(std::move(pin));
            continue;
        }
        m_pins.push_back(Pin{pinMap[index].pinId});
    }
    m_arenaBridge.setMemoryRegions(m_adapter->memoryRegions());
}

void McuComponent::onAssignedIndex(uint32_t index) {
    m_componentIndex = index;
    scheduleNextPoll();
}

void McuComponent::scheduleNextPoll() {
    m_scheduler.scheduleEvent(kPollIntervalNs, [this] {
        m_scheduler.markDirty(m_componentIndex);
        scheduleNextPoll();
    });
}

QemuModule* McuComponent::findModule(uint64_t address) const {
    for (const std::unique_ptr<QemuModule>& module : m_modules) {
        if (module->owns(address)) return module.get();
    }
    return nullptr;
}

void McuComponent::pollAndDispatchPendingEvents() {
    if (!m_arenaOpen) return;
    for (int i = 0; i < kMaxEventsPerStamp; ++i) {
        const qemu::QemuPollResult result = m_arenaBridge.poll();
        if (!result.hasEvent || !result.event) break;
        const qemu::QemuArenaEvent& event = *result.event;

        if (event.simuAction == LSDN_SIM_WRITE) {
            if (QemuModule* module = findModule(event.regAddr)) module->writeRegister(event.regAddr, event.regData);
            m_arenaBridge.acknowledgeWrite();
        } else if (event.simuAction == LSDN_SIM_READ) {
            uint64_t value = 0;
            if (QemuModule* module = findModule(event.regAddr)) value = module->readRegister(event.regAddr);
            m_arenaBridge.acknowledgeRead(value);
        } else {
            // SIM_FREQ/SIM_EVENT/SIM_INTERRUPT/SIM_I2C/SIM_SPI/SIM_USART/SIM_TIMER/SIM_GPIO_IN:
            // fora de escopo desta versão (Blink Real só precisa de SIM_READ/SIM_WRITE) -- só
            // confirma pra não travar o QEMU esperando uma resposta que nunca vem.
            m_arenaBridge.acknowledgeWrite();
        }
    }
}

void McuComponent::stamp(MnaMatrixView& matrix) {
    pollAndDispatchPendingEvents();

    // Ponte pino<->matriz, genérica (ver doc da classe): pra cada PinMapping, pergunta ao módulo
    // responsável (nunca sabe qual chip é) se aquele bit está em modo saída -- se sim, dirige o
    // pino real; se não, lê a tensão atual do pino e alimenta de volta no módulo (pra uma leitura
    // de registrador futura, ex: GPIO_IN_REG, devolver o valor certo).
    for (size_t i = 0; i < m_pins.size(); ++i) {
        const PinMapping& mapping = m_adapter->pinMap()[i];
        QemuModule* module = nullptr;
        for (const std::unique_ptr<QemuModule>& candidate : m_modules) {
            if (candidate->kind() == mapping.moduleKind && candidate->index() == mapping.moduleIndex) {
                module = candidate.get();
                break;
            }
        }
        if (!module) {
            // Sem módulo concreto pra essa faixa ainda (ex: UART0_RX/TX -- só GPIO está
            // implementado nesta versão, ver Esp32Adapter::createModules()) -- mesma rede de
            // segurança do ramo "entrada" abaixo: nunca deixar uma linha inteiramente zerada.
            matrix.addConductanceToGround(m_pins[i], kFloatingConductance);
            continue;
        }

        if (module->isOutputEnabled(mapping.bitOrLine)) {
            const double targetVolts = module->outputLevel(mapping.bitOrLine) ? kDriveHighVolts : 0.0;
            matrix.addConductanceToGround(m_pins[i], kDriveConductance);
            matrix.addCurrentToGround(m_pins[i], targetVolts * kDriveConductance);
        } else {
            // Alta impedância (não baixa o pino de propósito -- quem estiver do outro lado do
            // fio decide o nível) MAS nunca zero: um pino sem fio nenhum (a maioria, a maior
            // parte do tempo) cairia numa linha zerada da matriz -- sistema singular, mesmo bug
            // já corrigido em WaveGen::stamp() pro pino "gnd" não-bipolar (ver doc lá).
            //
            // kDriveConductance/kFloatingConductance NÃO podem ter spread arbitrário: um único
            // componente com MUITOS pinos simultaneamente não-conectados (este é o primeiro --
            // 42 pinos) faz a matriz inteira ficar diagonal, e CircuitGroup::singular() rejeita
            // por rcond() <= 1e-14 -- 1e9 (drive) vs 1e-9 (antiga "alta impedância" copiada de
            // Probe/WaveGen) já dá rcond ~1e-18, MUITO abaixo do limite, mesmo sendo uma matriz
            // perfeitamente diagonal/bem-condicionada equação a equação. Por isso este componente
            // usa valores próprios (1e6/1e-6, rcond ~1e-12) em vez dos de outros componentes --
            // ainda "forte o bastante"/"fraco o bastante" pra qualquer fio real, só com spread
            // seguro pro double. Ver .spec se outro componente algum dia precisar do mesmo ajuste.
            matrix.addConductanceToGround(m_pins[i], kFloatingConductance);
            const double voltage = matrix.getNodeVoltage(m_pins[i]);
            module->setInputLevel(mapping.bitOrLine, voltage > kDigitalLevelThreshold);
        }
    }
}

void McuComponent::loadFirmware(const std::filesystem::path& firmwarePath, const std::string& arenaName) {
    QemuLaunchSpec spec = m_adapter->buildLaunchArgs(firmwarePath.string());
    spec.args.insert(spec.args.begin(), arenaName); // argv[1] = chave da arena, ver McuController

    m_arenaBridge.open(qemu::QemuArenaOpenOptions{arenaName, true});
    m_arenaOpen = true;
    m_processManager.start(spec);
    m_scheduler.markDirty(m_componentIndex);
}

void McuComponent::stopFirmware() {
    m_processManager.stop();
    m_arenaBridge.close();
    m_arenaOpen = false;
}

} // namespace lasecsimul::mcu
