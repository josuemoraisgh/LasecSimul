#include "Esp32Adapter.hpp"
#include "Esp32GpioModule.hpp"
#include "Esp32MemoryMap.hpp"
#include <string>

namespace lasecsimul::mcu::esp32 {

namespace {

std::vector<PinMapping> buildPinMap() {
    std::vector<PinMapping> pins;
    pins.reserve(42);

    for (uint32_t gpio = 0; gpio <= 39; ++gpio) {
        pins.push_back(PinMapping{"GPIO" + std::to_string(gpio), ModuleKind::Gpio, 0, gpio});
    }

    pins.push_back(PinMapping{"UART0_RX", ModuleKind::Usart, 0, kUartRxLine});
    pins.push_back(PinMapping{"UART0_TX", ModuleKind::Usart, 0, kUartTxLine});
    return pins;
}

} // namespace

Esp32Adapter::Esp32Adapter(std::string romDir)
    : m_pinMap(buildPinMap()), m_romDir(std::move(romDir)) {}

// Espelho fiel de Esp32::createArgs() (C:\SourceCode\simulide_2\...\esp32\esp32.cpp) -- NÃO inclui
// a chave da shared memory aqui (isso é responsabilidade de McuController::start(), que é quem
// decide o nome da arena -- ver simuMain() em simuliface.c: argv[1] = chave, o resto segue intacto
// pro qemu_init() do QEMU, por isso o PRIMEIRO elemento aqui é o argv[0] convencional do QEMU
// ("qemu-system-xtensa"), não o caminho real do binário -- esse vem de spec.binary).
//
// Simplificação documentada (não testada contra firmware real nesta sessão -- sem arquivo de
// firmware disponível): omite -drive de efuse/-nic/-global watchdog-disable que o SimulIDE real
// também manda. Sem eles o boot pode se comportar diferente de uma ESP32 real (watchdog ativo,
// sem efuse), mas isso não bloqueia o registrador GPIO básico (Blink Real) funcionar.
QemuLaunchSpec Esp32Adapter::buildLaunchArgs(std::string_view firmwarePath) const {
    QemuLaunchSpec spec;
    spec.binary = "qemu-system-xtensa";
    spec.args = {
        "qemu-system-xtensa", // argv[0] convencional que o próprio QEMU espera (não é o binário)
        "-M",
        "esp32-simul",
        "-L",
        m_romDir,
        "-drive",
        "file=" + std::string(firmwarePath) + ",if=mtd,format=raw",
        "-icount",
        "shift=4,align=off,sleep=off",
    };
    return spec;
}

std::span<const MemoryRegion> Esp32Adapter::memoryRegions() const {
    return kMemoryRegions;
}

std::vector<std::unique_ptr<QemuModule>> Esp32Adapter::createModules() const {
    std::vector<std::unique_ptr<QemuModule>> modules;
    modules.push_back(std::make_unique<Esp32GpioModule>(0, kGpioStart, kGpioEnd));
    // IOMUX/I2C/SPI/USART ficam pra depois -- ver doc de Esp32GpioModule.hpp sobre o escopo
    // deliberadamente restrito desta primeira versão (Blink Real).
    return modules;
}

} // namespace lasecsimul::mcu::esp32
