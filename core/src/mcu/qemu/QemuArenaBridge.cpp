#include "QemuArenaBridge.hpp"
#include <algorithm>
#include <cstring>
#include <stdexcept>

#if defined(_WIN32)
#include <windows.h>
#else
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace lasecsimul::mcu::qemu {

namespace {

std::string posixSharedMemoryName(const std::string& name) {
    if (!name.empty() && name.front() == '/') return name;
    return "/" + name;
}

QemuArenaEvent copyArenaEvent(const LsdnQemuArena& arena) {
    return QemuArenaEvent{arena.simuTime,    arena.qemuTime,       arena.regData,
                          arena.regAddr,     arena.irqNumber,      arena.irqLevel,
                          arena.simuAction,  arena.loop_timeout_ns, arena.ps_per_inst,
                          arena.running != 0};
}

} // namespace

class QemuArenaBridge::SharedMemory {
public:
    SharedMemory(const std::string& name, size_t size, bool createIfMissing) : m_size(size) {
#if defined(_WIN32)
        const std::wstring wideName(name.begin(), name.end());
        m_handle = createIfMissing
                       ? CreateFileMappingW(INVALID_HANDLE_VALUE, nullptr, PAGE_READWRITE, 0,
                                            static_cast<DWORD>(m_size), wideName.c_str())
                       : OpenFileMappingW(FILE_MAP_ALL_ACCESS, FALSE, wideName.c_str());
        if (!m_handle) throw std::runtime_error("Failed to open QEMU shared memory: " + name);
        m_view = MapViewOfFile(m_handle, FILE_MAP_ALL_ACCESS, 0, 0, m_size);
        if (!m_view) {
            CloseHandle(m_handle);
            m_handle = nullptr;
            throw std::runtime_error("Failed to map QEMU shared memory: " + name);
        }
#else
        const std::string shmName = posixSharedMemoryName(name);
        m_name = shmName;
        m_owner = createIfMissing;
        const int flags = createIfMissing ? (O_CREAT | O_RDWR) : O_RDWR;
        m_fd = shm_open(shmName.c_str(), flags, 0600);
        if (m_fd < 0) throw std::runtime_error("Failed to open QEMU shared memory: " + shmName);
        if (createIfMissing && ftruncate(m_fd, static_cast<off_t>(m_size)) != 0) {
            ::close(m_fd);
            m_fd = -1;
            throw std::runtime_error("Failed to size QEMU shared memory: " + shmName);
        }
        m_view = mmap(nullptr, m_size, PROT_READ | PROT_WRITE, MAP_SHARED, m_fd, 0);
        if (m_view == MAP_FAILED) {
            ::close(m_fd);
            m_fd = -1;
            m_view = nullptr;
            throw std::runtime_error("Failed to map QEMU shared memory: " + shmName);
        }
#endif
    }

    ~SharedMemory() {
#if defined(_WIN32)
        if (m_view) UnmapViewOfFile(m_view);
        if (m_handle) CloseHandle(m_handle);
#else
        if (m_view) munmap(m_view, m_size);
        if (m_fd >= 0) ::close(m_fd);
        if (m_owner && !m_name.empty()) shm_unlink(m_name.c_str());
#endif
    }

    void* data() const { return m_view; }

private:
    size_t m_size = 0;
    void* m_view = nullptr;
#if defined(_WIN32)
    HANDLE m_handle = nullptr;
#else
    int m_fd = -1;
    std::string m_name;
    bool m_owner = false;
#endif
};

QemuArenaBridge::QemuArenaBridge() = default;
QemuArenaBridge::~QemuArenaBridge() = default;

void QemuArenaBridge::setMemoryRegions(std::span<const MemoryRegion> regions) {
    m_regions.assign(regions.begin(), regions.end());
    std::sort(m_regions.begin(), m_regions.end(), [](const MemoryRegion& a, const MemoryRegion& b) {
        return a.start < b.start;
    });
}

void QemuArenaBridge::open(const QemuArenaOpenOptions& options) {
    close();
    if (options.name.empty()) throw std::runtime_error("QEMU shared memory name is empty");
    m_sharedMemory = std::make_unique<SharedMemory>(options.name, sizeof(LsdnQemuArena), options.createIfMissing);
    m_arena = static_cast<LsdnQemuArena*>(m_sharedMemory->data());
}

void QemuArenaBridge::close() {
    m_arena = nullptr;
    m_sharedMemory.reset();
}

bool QemuArenaBridge::isOpen() const { return m_arena != nullptr; }
LsdnQemuArena* QemuArenaBridge::arena() { return m_arena; }
const LsdnQemuArena* QemuArenaBridge::arena() const { return m_arena; }

QemuPollResult QemuArenaBridge::poll() {
    if (!m_arena) return QemuPollResult{false, std::nullopt, std::nullopt, "QEMU arena is not open"};
    if (m_arena->simuTime == 0) return {};

    // NÃO confirma aqui de propósito (ver acknowledgeRead/acknowledgeWrite) -- ler o evento não
    // pode, por si só, liberar o QEMU antes do módulo certo processar o registrador.
    QemuPollResult result;
    result.hasEvent = true;
    result.event = copyArenaEvent(*m_arena);
    if (result.event->simuAction == LSDN_SIM_READ || result.event->simuAction == LSDN_SIM_WRITE) {
        result.dispatch = dispatch(result.event->regAddr);
    }
    return result;
}

void QemuArenaBridge::acknowledgeWrite() {
    if (m_arena) m_arena->simuTime = 0;
}

void QemuArenaBridge::acknowledgeRead(uint64_t regData) {
    if (!m_arena) return;
    m_arena->regData = regData;
    m_arena->qemuAction = LSDN_SIM_READ;
    m_arena->simuTime = 0;
}

QemuDispatchResult QemuArenaBridge::dispatch(uint64_t address) const {
    const auto it = std::upper_bound(m_regions.begin(), m_regions.end(), address,
                                     [](uint64_t value, const MemoryRegion& region) {
                                         return value < region.start;
                                     });
    if (it == m_regions.begin()) {
        return QemuDispatchResult{false, {}, "No MemoryRegion matches address 0x" + std::to_string(address)};
    }

    const MemoryRegion& candidate = *(it - 1);
    if (address >= candidate.start && address <= candidate.end) return QemuDispatchResult{true, candidate, {}};
    return QemuDispatchResult{false, {}, "No MemoryRegion matches address 0x" + std::to_string(address)};
}

} // namespace lasecsimul::mcu::qemu
