#pragma once

#include <cstdint>
#include <memory>
#include <span>
#include <string_view>
#include <vector>
#include "QemuModule.hpp"
#include "Types.hpp"

namespace lasecsimul {

/**
 * Ponte entre um chip concreto e o QemuProcessManager/QemuArenaBridge. Implementada por
 * adaptadores built-in (compilados no Core) ou por NativeMcuAdapterProxy (plugin DLL/SO via
 * mcu_abi.h).
 *
 * Modelo real (auditado contra o SimulIDE real -- C:\SourceCode\simulide_2\src\microsim\cores\
 * qemu\esp32\ e o protocolo de C:\SourceCode\qemu_simulide, não suposição): o QEMU manda
 * REGISTRADOR BRUTO (endereço + valor, `SIM_READ`/`SIM_WRITE` em qemu_arena_abi.h) -- ele não
 * decodifica IOMUX/pin-matrix/I2C/SPI/USART antes de mandar pro Core. Quem decodifica é o módulo
 * do LADO DO CORE responsável por aquela faixa de endereço (ex: Esp32GpioModule conhece que
 * offset 0x04 dentro da sua faixa é GPIO_OUT_REG) -- isso é CHIP-ESPECÍFICO de propósito, não dá
 * pra ser genérico (GPIO/IOMUX/registrador varia por chip e até por família dentro do mesmo
 * fabricante). O adapter (`IMcuAdapter`) só DECLARA quais módulos concretos aquele chip usa e
 * suas faixas de memória -- nunca interpreta registrador em tempo real, isso é trabalho do
 * módulo (`QemuModule::readRegister()`/`writeRegister()`).
 *
 * Neutralidade obrigatória (isto sim nunca muda por chip): Scheduler, BusController/Netlist, IPC,
 * UI -- nenhum desses pode saber "ESP32"/"STM32". `McuComponent` (que implementa
 * `IComponentModel` pra entrar no circuito com pinos reais via `pinMap()`) também é genérico --
 * ele só repassa registrador pros módulos do adapter, nunca interpreta nada ele mesmo.
 */
class IMcuAdapter {
public:
    virtual ~IMcuAdapter() = default;

    virtual const char* chipId() const = 0;
    virtual QemuLaunchSpec buildLaunchArgs(std::string_view firmwarePath) const = 0;

    /** Faixas de endereço MMIO do chip, uma por módulo concreto (Esp32Gpio, Esp32IoMux, ...) --
     * `McuComponent`/`QemuArenaBridge::dispatch()` usa isto pra achar qual módulo é dono de
     * `regAddr` em cada `SIM_READ`/`SIM_WRITE`. */
    virtual std::span<const MemoryRegion> memoryRegions() const = 0;

    /** Mapa de pino lógico (ex: "GPIO2") -> bit/linha de um módulo -- usado pelo módulo
     * concreto (ex: Esp32GpioModule) pra saber qual Pin real do circuito corresponde a qual bit
     * de registrador. */
    virtual std::span<const PinMapping> pinMap() const = 0;

    /** Cria uma instância NOVA de cada módulo concreto que este chip usa (ex: Esp32 devolve
     * {Esp32GpioModule, Esp32IoMuxModule, ...}) -- chamado 1x por `McuComponent` (um por
     * instância de MCU no schematic, nunca compartilhado entre instâncias). Só o adapter sabe
     * quais módulos concretos existem pra aquele chip; `McuComponent` só repassa registrador pra
     * eles, sem saber o que cada um significa. */
    virtual std::vector<std::unique_ptr<QemuModule>> createModules() const = 0;
};

} // namespace lasecsimul
