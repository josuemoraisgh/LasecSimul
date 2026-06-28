#pragma once

#include <cstdint>
#include "lasecsimul/QemuModule.hpp"

namespace lasecsimul::mcu::esp32 {

/**
 * Espelho fiel de `Esp32Gpio::writeRegister()/readRegister()`
 * (C:\SourceCode\simulide_2\src\microsim\cores\qemu\esp32\esp32gpio.cpp), restrito de propósito a
 * GPIO_OUT_REG/GPIO_ENABLE_REG/GPIO_IN_REG/GPIO_IN1_REG -- sem IOMUX/pin-matrix (W1TS/W1TC também
 * ficam de fora: a versão real auditada não os trata em writeRegister() nesta revisão, então não
 * inventamos comportamento que ela não tem). Offsets confirmados lendo
 * hw/gpio/esp32_gpio.c do fork QEMU real (C:\SourceCode\qemu_simulide):
 *
 *   0x04 = GPIO_OUT_REG (escrita)       -- 1 bit por pino 0-31, nível de saída
 *   0x20 = GPIO_ENABLE_REG (escrita)    -- 1 bit por pino 0-31, 1 = saída, 0 = entrada
 *   0x3C = GPIO_IN_REG (leitura)        -- pinos 0-31
 *   0x40 = GPIO_IN1_REG (leitura)       -- pinos 33-39 nos bits 0-6
 *
 * NÃO sabe nada sobre `MnaMatrixView`/`Pin` de propósito -- `McuComponent` é quem traduz
 * `isOutputEnabled()`/`outputLevel()` em estampa elétrica real e `setInputLevel()` em tensão lida
 * da matriz, usando `IMcuAdapter::pinMap()` pra saber qual bit é qual Pin. Isso mantém este
 * módulo testável sem precisar de um circuito de verdade.
 */
class Esp32GpioModule final : public QemuModule {
public:
    Esp32GpioModule(uint32_t index, uint64_t memStart, uint64_t memEnd)
        : QemuModule(ModuleKind::Gpio, index, memStart, memEnd) {}

    void reset() override {
        m_gpioState = 0;
        m_gpioEnable = 0;
        m_gpioIn = 0;
    }

    void writeRegister(uint64_t address, uint64_t value) override {
        const uint64_t offset = address - m_memStart;
        const uint32_t value32 = static_cast<uint32_t>(value);
        if (offset == 0x04) {
            m_gpioState = value32;
        } else if (offset == 0x20) {
            m_gpioEnable = value32;
        }
        // offsets >= 0x88 (GPIO_PINxx_REG/matrix in/out) ficam fora desta versão de propósito --
        // ver doc da classe.
    }

    uint64_t readRegister(uint64_t address) override {
        const uint64_t offset = address - m_memStart;
        if (offset == 0x3C) return m_gpioIn & 0xFFFFFFFFu; // GPIO_IN_REG: pinos 0-31
        if (offset == 0x40) return (m_gpioIn >> 32) & 0x7Fu; // GPIO_IN1_REG: pinos 33-39
        return 0;
    }

    /** `bit` 0-31 -- true se GPIO_ENABLE_REG marcou esse pino como saída. */
    bool isOutputEnabled(uint32_t bit) const override { return bit < 32 && (m_gpioEnable & (1u << bit)) != 0; }

    /** Nível pedido por GPIO_OUT_REG pra esse bit -- só significa algo se isOutputEnabled(bit). */
    bool outputLevel(uint32_t bit) const override { return bit < 32 && (m_gpioState & (1u << bit)) != 0; }

    /** McuComponent chama isso TODA stamp() (não só quando há leitura pendente) pra manter o
     * cache de entrada fresco -- mesmo princípio de NativeDeviceProxy::stamp() cacheando
     * lastPinVoltage. `bit` 0-31 ou 33-39 (34 fica de fora, GPIO34-39 são input-only mas o bit 32
     * não existe no ESP32 -- ver datasheet). */
    void setInputLevel(uint32_t bit, bool level) override {
        if (bit >= 40) return;
        const uint64_t mask = uint64_t(1) << bit;
        if (level) m_gpioIn |= mask;
        else m_gpioIn &= ~mask;
    }

private:
    uint32_t m_gpioState = 0;
    uint32_t m_gpioEnable = 0;
    uint64_t m_gpioIn = 0; // bits 0-31 = GPIO0-31, bits 33-39 = GPIO33-39 (bit 32 não usado)
};

} // namespace lasecsimul::mcu::esp32
