#include "FirmwareWatcher.hpp"
#include <algorithm>
#include <array>
#include <cctype>
#include <stdexcept>
#include <system_error>

namespace lasecsimul::mcu::qemu {

namespace {

bool isFirmwareArtifact(const std::filesystem::path& path) {
    std::string ext = path.extension().string();
    std::transform(ext.begin(), ext.end(), ext.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return ext == ".bin" || ext == ".elf" || ext == ".hex";
}

} // namespace

std::optional<std::filesystem::path> FirmwareWatcher::poll(const std::filesystem::path& folder) {
    std::error_code ec;
    if (!std::filesystem::exists(folder, ec) || !std::filesystem::is_directory(folder, ec)) {
        throw std::runtime_error("Firmware folder does not exist: " + folder.string());
    }

    std::optional<std::filesystem::path> newestPath;
    std::filesystem::file_time_type newestMtime{};

    for (const std::filesystem::directory_entry& entry : std::filesystem::directory_iterator(folder)) {
        if (!entry.is_regular_file(ec) || !isFirmwareArtifact(entry.path())) continue;
        const std::filesystem::file_time_type mtime = entry.last_write_time(ec);
        if (ec) continue;
        if (!newestPath || mtime > newestMtime) {
            newestPath = entry.path();
            newestMtime = mtime;
        }
    }

    if (!newestPath) return std::nullopt;
    if (m_lastPath && std::filesystem::equivalent(*m_lastPath, *newestPath, ec) && newestMtime == m_lastMtime) {
        return std::nullopt;
    }

    m_lastPath = *newestPath;
    m_lastMtime = newestMtime;
    return newestPath;
}

void FirmwareWatcher::reset() {
    m_lastPath.reset();
    m_lastMtime = {};
}

} // namespace lasecsimul::mcu::qemu
