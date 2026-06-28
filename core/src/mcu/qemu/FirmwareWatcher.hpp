#pragma once

#include <filesystem>
#include <optional>

namespace lasecsimul::mcu::qemu {

class FirmwareWatcher {
public:
    std::optional<std::filesystem::path> poll(const std::filesystem::path& folder);
    void reset();

private:
    std::optional<std::filesystem::path> m_lastPath;
    std::filesystem::file_time_type m_lastMtime{};
};

} // namespace lasecsimul::mcu::qemu

