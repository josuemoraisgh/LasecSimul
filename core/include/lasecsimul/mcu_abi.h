/*
 * ABI publica de adaptadores de MCU nativos do LasecSimul (DLL/SO).
 * Mesma familia/regras do device_abi.h — fronteira 100% C.
 *
 * Mecanismo validado contra o SimulIDE real, codigo lido diretamente (nao suposicao) --
 * C:\SourceCode\simulide_2\src\microsim\cores\qemu\{qemudevice,qemumodule,esp32\esp32gpio}.{h,cpp}
 * e o protocolo do fork QEMU em C:\SourceCode\qemu_simulide (system/simuliface.{h,c}):
 *
 * O QEMU manda registrador BRUTO (endereco + valor, ver qemu_arena_abi.h SIM_READ/SIM_WRITE) --
 * ele NAO decodifica nada antes de mandar (confirmado lendo hw/gpio/esp32_gpio.c: escreve
 * writeReg(GPIO_OFFSET+0x04, valor) direto, sem nenhuma logica de IOMUX/pin-matrix do lado QEMU).
 * Quem decodifica e' o MODULO do lado do Core dono daquela faixa de endereco (ex: Esp32GpioModule
 * sabe que offset 0x04 dentro da sua faixa e' GPIO_OUT_REG) -- isso e' CHIP-ESPECIFICO de
 * proposito, nao da pra ser generico (registrador de GPIO/IOMUX varia por chip e familia). O
 * adapter so DECLARA quais modulos concretos aquele chip usa e suas faixas de memoria
 * (memoryRegions()) -- nunca interpreta registrador em tempo real.
 *
 * Neutralidade obrigatoria (isso sim nunca muda por chip): Scheduler, BusController/Netlist, IPC,
 * UI. `McuComponent` (que implementa IComponentModel pra entrar no circuito com pinos reais via
 * pinMap()) tambem e' generico -- so repassa registrador pros modulos do adapter.
 *
 * Ver .spec/lasecsimul.spec, secao 8, e .spec/lasecsimul-native-devices.spec, secao 8.1 e 20.
 */
#ifndef LASECSIMUL_MCU_ABI_H
#define LASECSIMUL_MCU_ABI_H

#include <stdint.h>
#include "device_abi.h" /* reaproveita LSDN_EXPORT */

#ifdef __cplusplus
extern "C" {
#endif

#define LSDN_MCU_ABI_VERSION_MAJOR 1
#define LSDN_MCU_ABI_VERSION_MINOR 0

typedef struct LsdnMcuAdapter LsdnMcuAdapter; /* opaco */

typedef enum LsdnModuleKind {
    LSDN_MODULE_GPIO = 0,
    LSDN_MODULE_I2C = 1,
    LSDN_MODULE_SPI = 2,
    LSDN_MODULE_USART = 3,
    LSDN_MODULE_TIMER = 4
} LsdnModuleKind;

/* Uma faixa de endereco MMIO do chip e o periferico generico do Core que deve trata-la.
 * Equivalente a m_memStart/m_memEnd de QemuModule no SimulIDE. */
typedef struct LsdnMemoryRegion {
    uint64_t start;
    uint64_t end;
    LsdnModuleKind moduleKind;
    uint32_t moduleIndex; /* qual instancia do periferico, ex: I2C0 vs I2C1 */
} LsdnMemoryRegion;

/* Um bit/linha de um periferico (tipicamente GPIO) mapeado para um pino fisico do circuito. */
typedef struct LsdnPinMapping {
    const char* pinId;   /* ex: "GPIO2" */
    LsdnModuleKind moduleKind;
    uint32_t moduleIndex;
    uint32_t bitOrLine;
} LsdnPinMapping;

typedef struct LsdnQemuLaunchSpec {
    const char* binary;        /* ex: "qemu-system-xtensa" */
    const char* const* args;   /* argv, terminado por NULL no ultimo elemento */
    uint32_t arg_count;
} LsdnQemuLaunchSpec;

typedef struct LsdnMcuHostApi {
    void     (*log)(void* host_ctx, int32_t level, const char* msg);
    uint64_t (*now_ns)(void* host_ctx);
} LsdnMcuHostApi;

typedef struct LsdnMcuVTable {
    LsdnMcuAdapter*    (*create)(void* host_ctx, const LsdnMcuHostApi* host_api);
    LsdnQemuLaunchSpec (*build_launch_args)(LsdnMcuAdapter* adapter, const char* firmware_path);

    /* Declarativo — chamado uma vez no load, nao por evento. O adaptador nunca e chamado por
     * pino/registrador individual; o dispatch e feito pelos modulos genericos do Core. */
    uint32_t (*get_memory_regions)(LsdnMcuAdapter* adapter, LsdnMemoryRegion* out, uint32_t cap);
    uint32_t (*get_pin_map)(LsdnMcuAdapter* adapter, LsdnPinMapping* out, uint32_t cap);

    void (*destroy)(LsdnMcuAdapter* adapter);
} LsdnMcuVTable;

/* Simbolo exportado por um plugin de adaptador de MCU — distinto de lsdn_get_vtable (dispositivos)
 * para que o PluginLoader nunca resolva o tipo errado de vtable a partir do mesmo binario. */
typedef const LsdnMcuVTable* (*LsdnGetMcuVTableFn)(uint32_t* abi_major, uint32_t* abi_minor);

#ifdef __cplusplus
}
#endif

#endif /* LASECSIMUL_MCU_ABI_H */
