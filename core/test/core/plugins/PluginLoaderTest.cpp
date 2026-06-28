#include <cstdio>
#include <memory>
#include <stdexcept>
#include "plugins/PluginLoader.hpp"

using namespace lasecsimul::plugins;

namespace {

const LsdnDeviceVTable kDeviceVTable = {nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr};
const LsdnMcuVTable kMcuVTable = {nullptr, nullptr, nullptr, nullptr, nullptr};

const LsdnDeviceVTable* goodDeviceGetVTable(uint32_t* major, uint32_t* minor) {
    *major = LSDN_ABI_VERSION_MAJOR;
    *minor = LSDN_ABI_VERSION_MINOR;
    return &kDeviceVTable;
}

const LsdnDeviceVTable* badDeviceGetVTable(uint32_t* major, uint32_t* minor) {
    *major = LSDN_ABI_VERSION_MAJOR + 1;
    *minor = LSDN_ABI_VERSION_MINOR;
    return &kDeviceVTable;
}

const LsdnMcuVTable* goodMcuGetVTable(uint32_t* major, uint32_t* minor) {
    *major = LSDN_MCU_ABI_VERSION_MAJOR;
    *minor = LSDN_MCU_ABI_VERSION_MINOR;
    return &kMcuVTable;
}

bool expectThrows(void (*fn)(), const char* label) {
    try {
        fn();
    } catch (const std::runtime_error&) {
        return true;
    } catch (...) {
        std::fprintf(stderr, "FAILED: %s threw unexpected exception\n", label);
        return false;
    }
    std::fprintf(stderr, "FAILED: %s did not throw\n", label);
    return false;
}

} // namespace

int main() {
    bool ok = true;

    {
        auto module = PluginLoader::createDeviceModuleFromExports(nullptr, &goodDeviceGetVTable, "valid-device");
        ok &= module != nullptr;
        ok &= module->kind() == PluginKind::Device;
    }

    ok &= expectThrows(
        [] {
            (void)PluginLoader::createDeviceModuleFromExports(nullptr, nullptr, "missing-export");
        },
        "missing device export");

    ok &= expectThrows(
        [] {
            (void)PluginLoader::createDeviceModuleFromExports(nullptr, &badDeviceGetVTable, "bad-abi");
        },
        "incompatible device ABI");

    {
        auto module = PluginLoader::createMcuModuleFromExports(nullptr, &goodMcuGetVTable, "valid-mcu");
        ok &= module != nullptr;
        ok &= module->kind() == PluginKind::McuAdapter;
    }

    ok &= expectThrows(
        [] {
            (void)PluginLoader::createMcuModuleFromExports(nullptr, nullptr, "missing-mcu-export");
        },
        "missing MCU export");

    if (ok) std::printf("OK: PluginLoader validation passed.\n");
    return ok ? 0 : 1;
}
