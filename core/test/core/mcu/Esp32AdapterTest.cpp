#include <algorithm>
#include <cstdio>
#include <memory>
#include <string>
#include "mcu/esp32/Esp32Adapter.hpp"
#include "mcu/esp32/Esp32MemoryMap.hpp"

using namespace lasecsimul;
using namespace lasecsimul::mcu::esp32;

namespace {

bool expect(bool condition, const char* label) {
    if (!condition) std::fprintf(stderr, "FAILED: %s\n", label);
    return condition;
}

bool containsArg(const QemuLaunchSpec& spec, const std::string& value) {
    return std::find(spec.args.begin(), spec.args.end(), value) != spec.args.end();
}

} // namespace

int main() {
    bool ok = true;
    Esp32Adapter adapter;

    ok &= expect(std::string(adapter.chipId()) == "espressif.esp32", "chipId is espressif.esp32");

    // Espelha Esp32::createArgs() real (C:\SourceCode\simulide_2\...\esp32\esp32.cpp) -- "-M
    // esp32-simul" (não "-machine esp32"), firmware via "-drive file=...,if=mtd,format=raw" (não
    // "-kernel", que o comentário original já registrava como "Does not work" no SimulIDE real).
    // McuController::start() é quem prependa a chave da arena (argv[1]) -- não o adapter.
    const QemuLaunchSpec launch = adapter.buildLaunchArgs("build/blink.bin");
    ok &= expect(launch.binary == "qemu-system-xtensa", "QEMU binary is Xtensa");
    ok &= expect(containsArg(launch, "qemu-system-xtensa"), "launch args include conventional argv[0] for QEMU itself");
    ok &= expect(containsArg(launch, "-M"), "launch args include -M flag");
    ok &= expect(containsArg(launch, "esp32-simul"), "launch args include esp32-simul machine");
    ok &= expect(containsArg(launch, "file=build/blink.bin,if=mtd,format=raw"), "launch args include firmware drive");

    const auto regions = adapter.memoryRegions();
    const auto gpioRegion = std::find_if(regions.begin(), regions.end(), [](const MemoryRegion& region) {
        return region.moduleKind == ModuleKind::Gpio && region.moduleIndex == 0;
    });
    ok &= expect(gpioRegion != regions.end(), "GPIO memory region exists");
    ok &= expect(gpioRegion != regions.end() && gpioRegion->start == kGpioStart && gpioRegion->end == kGpioEnd,
                 "GPIO memory region uses ESP32 MMIO range");

    const auto pins = adapter.pinMap();
    const auto gpio2 = std::find_if(pins.begin(), pins.end(), [](const PinMapping& pin) {
        return pin.pinId == "GPIO2";
    });
    ok &= expect(gpio2 != pins.end(), "pin map contains GPIO2");
    ok &= expect(gpio2 != pins.end() && gpio2->moduleKind == ModuleKind::Gpio && gpio2->bitOrLine == 2,
                 "GPIO2 maps to GPIO bit 2");

    const auto tx = std::find_if(pins.begin(), pins.end(), [](const PinMapping& pin) {
        return pin.pinId == "UART0_TX";
    });
    const auto rx = std::find_if(pins.begin(), pins.end(), [](const PinMapping& pin) {
        return pin.pinId == "UART0_RX";
    });
    ok &= expect(tx != pins.end() && tx->moduleKind == ModuleKind::Usart && tx->bitOrLine == kUartTxLine,
                 "UART0_TX mapping is present");
    ok &= expect(rx != pins.end() && rx->moduleKind == ModuleKind::Usart && rx->bitOrLine == kUartRxLine,
                 "UART0_RX mapping is present");

    const auto modules = adapter.createModules();
    ok &= expect(!modules.empty(), "createModules() devolve ao menos 1 módulo (GPIO)");
    const bool hasGpioModule =
        std::any_of(modules.begin(), modules.end(), [](const std::unique_ptr<QemuModule>& m) {
            return m->kind() == ModuleKind::Gpio && m->index() == 0 && m->owns(kGpioStart);
        });
    ok &= expect(hasGpioModule, "createModules() inclui um QemuModule GPIO cobrindo kGpioStart");

    if (ok) std::printf("OK: ESP32 adapter declarative contract passed.\n");
    return ok ? 0 : 1;
}
