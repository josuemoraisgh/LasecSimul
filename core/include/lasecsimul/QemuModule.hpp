#pragma once

#include <cstdint>
#include "Types.hpp"

namespace lasecsimul {

/**
 * Espelho fiel de `QemuModule` (C:\SourceCode\simulide_2\src\microsim\cores\qemu\qemumodule.h) --
 * intérprete de registrador MMIO de UM periférico concreto (GPIO, IOMUX, I2C, SPI, USART de um
 * chip específico). `memStart`/`memEnd` = faixa de endereço absoluta que esse módulo cobre (ver
 * `IMcuAdapter::memoryRegions()`); `McuComponent`/`QemuArenaBridge::dispatch()` usam isso pra
 * achar qual módulo é dono de cada `regAddr` recebido via `SIM_READ`/`SIM_WRITE`
 * (qemu_arena_abi.h).
 *
 * Deliberadamente CHIP-ESPECÍFICO: cada subclasse concreta (ex: Esp32GpioModule) conhece os
 * offsets de registrador exatos daquele periférico naquele chip -- isso não é generalizável
 * (confirmado lendo hw/gpio/esp32_gpio.c do fork QEMU real: o offset 0x04 só significa
 * "GPIO_OUT_REG" porque é assim que o ESP32 define seu mapa de registradores, nada nisso é
 * universal entre chips). Só `Scheduler`/`BusController`/`Netlist`/IPC/UI precisam ser neutros
 * quanto a chip -- ver `IMcuAdapter.hpp`.
 */
class QemuModule {
public:
    /** `kind`/`index` identificam este módulo do MESMO jeito que `MemoryRegion`/`PinMapping` já
     * fazem (ex: ModuleKind::Gpio, índice 0) -- é assim que `McuComponent` acha qual `QemuModule`
     * corresponde a um `PinMapping`, sem precisar perguntar "que chip é esse" pra ninguém. */
    QemuModule(ModuleKind kind, uint32_t index, uint64_t memStart, uint64_t memEnd)
        : m_kind(kind), m_index(index), m_memStart(memStart), m_memEnd(memEnd) {}
    virtual ~QemuModule() = default;

    ModuleKind kind() const { return m_kind; }
    uint32_t index() const { return m_index; }
    uint64_t memStart() const { return m_memStart; }
    uint64_t memEnd() const { return m_memEnd; }
    bool owns(uint64_t address) const { return address >= m_memStart && address <= m_memEnd; }

    virtual void reset() {}

    /** `address` é ABSOLUTO (mesmo espaço de `regAddr` da arena) -- subclasse subtrai `m_memStart`
     * pra achar o offset do registrador, igual ao `m_eventAddress - m_memStart` do SimulIDE real. */
    virtual void writeRegister(uint64_t address, uint64_t value) = 0;
    virtual uint64_t readRegister(uint64_t address) = 0;

    /** Ponte genérica pino<->matriz elétrica, usada por `McuComponent::stamp()` -- chamada pra
     * TODO `PinMapping` cujo `moduleKind` aponta pra este módulo, independente de qual chip é.
     * Default (módulo que não é GPIO, ex: I2C/SPI/USART) nunca dirige nada -- só um módulo tipo
     * GPIO faz sentido sobrescrever; é isso que mantém `McuComponent` neutro quanto a chip (ele
     * chama estes 3 métodos genericamente, nunca sabe "é ESP32" ou o que cada bit significa). */
    virtual bool isOutputEnabled(uint32_t) const { return false; }
    virtual bool outputLevel(uint32_t) const { return false; }
    virtual void setInputLevel(uint32_t, bool) {}

protected:
    ModuleKind m_kind;
    uint32_t m_index;
    uint64_t m_memStart;
    uint64_t m_memEnd;
};

} // namespace lasecsimul
