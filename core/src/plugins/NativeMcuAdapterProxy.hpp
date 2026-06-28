#pragma once

#include <memory>
#include <span>
#include <string>
#include <vector>
#include "PluginModule.hpp"
#include "lasecsimul/IMcuAdapter.hpp"

namespace lasecsimul::plugins {

/**
 * Proxy de adaptador de MCU nativo: mantém o PluginModule carregado e traduz a vtable C da ABI
 * para IMcuAdapter, que é o contrato interno do Core.
 */
class NativeMcuAdapterProxy final : public IMcuAdapter {
public:
    NativeMcuAdapterProxy(std::shared_ptr<PluginModule> module, LsdnMcuAdapter* handle, std::string chipId);
    ~NativeMcuAdapterProxy() override;

    const char* chipId() const override { return m_chipId.c_str(); }
    QemuLaunchSpec buildLaunchArgs(std::string_view firmwarePath) const override;
    std::span<const MemoryRegion> memoryRegions() const override { return m_memoryRegions; }
    std::span<const PinMapping> pinMap() const override { return m_pinMappings; }

    /** Plugin de MCU via mcu_abi.h ainda não tem como declarar módulos concretos (QemuModule é
     * conceito só do lado C++ do Core, sem equivalente na ABI C ainda) -- vazio até essa extensão
     * existir. Não é um esquecimento: adaptadores built-in (ex: Esp32Adapter) são o caminho real
     * hoje, plugin de MCU de terceiro é o caso ainda não construído. */
    std::vector<std::unique_ptr<QemuModule>> createModules() const override { return {}; }

private:
    static MemoryRegion toCoreRegion(const LsdnMemoryRegion& region);
    static PinMapping toCorePinMapping(const LsdnPinMapping& mapping);

    std::shared_ptr<PluginModule> m_module;
    LsdnMcuAdapter* m_handle;
    std::string m_chipId;
    std::vector<MemoryRegion> m_memoryRegions;
    std::vector<PinMapping> m_pinMappings;
};

} // namespace lasecsimul::plugins
