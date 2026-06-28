/* Adaptador nativo de MCU para ESP32 (QEMU). Implementado em C++ internamente; só a fronteira
 * exportada (lsdn_get_mcu_vtable) precisa ser ABI C — mesmo princípio de device_abi.h.
 *
 * Deliberadamente declarativo (ver mcu_abi.h): este adaptador não traduz pino nem registrador
 * nenhum em runtime. Ele só declara faixas de endereço MMIO e o mapa de pinos do ESP32; o
 * QemuArenaBridge do Core despacha os eventos de registrador (lidos da arena de memória
 * compartilhada que o build modificado do QEMU alimenta) para os módulos genéricos de barramento
 * (GpioModule/I2cBusModule/SpiBusModule/UsartModule) — mesmo mecanismo do QemuModule/TwiModule do
 * SimulIDE-dev. Ver .spec/lasecsimul.spec, seção 8, e .spec/lasecsimul-native-devices.spec, seção 20. */
#include "lasecsimul/mcu_abi.h"
#include <cstring>
#include <string>
#include <vector>

namespace {

struct Esp32AdapterState {
    void* hostCtx = nullptr;
    const LsdnMcuHostApi* api = nullptr;
    std::vector<std::string> launchArgStorage;
    std::vector<const char*> launchArgs;
};

// Faixas de endereco MMIO do ESP32 (ilustrativo - valores reais vem do datasheet/SDK da Espressif).
const LsdnMemoryRegion kMemoryRegions[] = {
    {0x3FF44000, 0x3FF44FFF, LSDN_MODULE_GPIO, 0},
    {0x3FF53000, 0x3FF53FFF, LSDN_MODULE_I2C, 0},
    {0x3FF64000, 0x3FF64FFF, LSDN_MODULE_SPI, 0},
    {0x3FF40000, 0x3FF40FFF, LSDN_MODULE_USART, 0},
};

const LsdnPinMapping kPinMap[] = {
    {"GPIO2", LSDN_MODULE_GPIO, 0, /*bit*/ 2},
    {"UART0_TX", LSDN_MODULE_USART, 0, /*line*/ 1},
    {"UART0_RX", LSDN_MODULE_USART, 0, /*line*/ 0},
};

LsdnMcuAdapter* create(void* hostCtx, const LsdnMcuHostApi* api) {
    auto* state = new Esp32AdapterState();
    state->hostCtx = hostCtx;
    state->api = api;
    return reinterpret_cast<LsdnMcuAdapter*>(state);
}

LsdnQemuLaunchSpec buildLaunchArgs(LsdnMcuAdapter* adapter, const char* firmwarePath) {
    auto* state = reinterpret_cast<Esp32AdapterState*>(adapter);
    state->launchArgStorage = {
        "-machine",
        "esp32",
        "-kernel",
        firmwarePath ? firmwarePath : "",
    };
    state->launchArgs.clear();
    state->launchArgs.reserve(state->launchArgStorage.size());
    for (const std::string& arg : state->launchArgStorage) state->launchArgs.push_back(arg.c_str());

    // A chave da arena compartilhada e inserida pelo QemuProcessManager antes destes args. Este
    // adapter nao promete QEMU stock: o binario precisa ser o fork modificado com suporte a arena.
    return LsdnQemuLaunchSpec{"qemu-system-xtensa", state->launchArgs.data(),
                              static_cast<uint32_t>(state->launchArgs.size())};
}

uint32_t getMemoryRegions(LsdnMcuAdapter* adapter, LsdnMemoryRegion* out, uint32_t cap) {
    (void)adapter;
    uint32_t count = sizeof(kMemoryRegions) / sizeof(kMemoryRegions[0]);
    if (out && cap >= count) std::memcpy(out, kMemoryRegions, sizeof(kMemoryRegions));
    return count;
}

uint32_t getPinMap(LsdnMcuAdapter* adapter, LsdnPinMapping* out, uint32_t cap) {
    (void)adapter;
    uint32_t count = sizeof(kPinMap) / sizeof(kPinMap[0]);
    if (out && cap >= count) std::memcpy(out, kPinMap, sizeof(kPinMap));
    return count;
}

void destroy(LsdnMcuAdapter* adapter) {
    delete reinterpret_cast<Esp32AdapterState*>(adapter);
}

const LsdnMcuVTable kVTable = {
    create, buildLaunchArgs, getMemoryRegions, getPinMap, destroy
};

} // namespace

extern "C" LSDN_EXPORT const LsdnMcuVTable* lsdn_get_mcu_vtable(uint32_t* abiMajor, uint32_t* abiMinor) {
    *abiMajor = LSDN_MCU_ABI_VERSION_MAJOR;
    *abiMinor = LSDN_MCU_ABI_VERSION_MINOR;
    return &kVTable;
}
