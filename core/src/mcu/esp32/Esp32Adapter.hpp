#pragma once

#include <memory>
#include <string>
#include <vector>
#include "lasecsimul/IMcuAdapter.hpp"

namespace lasecsimul::mcu::esp32 {

class Esp32Adapter final : public IMcuAdapter {
public:
    explicit Esp32Adapter(std::string romDir = "devices/qemu-esp32/bin/esp32/rom/bin");

    const char* chipId() const override { return "espressif.esp32"; }
    QemuLaunchSpec buildLaunchArgs(std::string_view firmwarePath) const override;
    std::span<const MemoryRegion> memoryRegions() const override;
    std::span<const PinMapping> pinMap() const override { return m_pinMap; }
    std::vector<std::unique_ptr<QemuModule>> createModules() const override;

private:
    std::vector<PinMapping> m_pinMap;
    // Relativo de propósito (não absoluto): quem instancia o adapter (CoreApplication) decide o
    // diretório de trabalho real -- mesmo padrão já usado por qemuBinaryOverride em McuController.
    std::string m_romDir;
};

} // namespace lasecsimul::mcu::esp32
