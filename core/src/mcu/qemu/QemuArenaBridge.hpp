#pragma once

#include "QemuArenaTypes.hpp"
#include <memory>
#include <span>
#include <vector>

namespace lasecsimul::mcu::qemu {

class QemuArenaBridge {
public:
    QemuArenaBridge();
    ~QemuArenaBridge();

    QemuArenaBridge(const QemuArenaBridge&) = delete;
    QemuArenaBridge& operator=(const QemuArenaBridge&) = delete;

    void setMemoryRegions(std::span<const MemoryRegion> regions);
    void open(const QemuArenaOpenOptions& options);
    void close();
    bool isOpen() const;

    LsdnQemuArena* arena();
    const LsdnQemuArena* arena() const;

    /** Lê o evento pendente (`simuTime != 0`) e já resolve o módulo dono de `regAddr` via
     * `setMemoryRegions()` -- NÃO confirma a ação (nunca zera `simuTime`/seta `qemuAction`,
     * mesmo em SIM_READ); quem chama decide isso via `acknowledgeRead()`/`acknowledgeWrite()`
     * depois de repassar pro módulo certo (ver McuComponent::stamp()). */
    QemuPollResult poll();
    QemuDispatchResult dispatch(uint64_t address) const;

    /** Confirma uma ação SIM_WRITE (ou qualquer ação sem retorno: SIM_FREQ/SIM_EVENT) -- só zera
     * `simuTime`, liberando o `waitForSynch()` da PRÓXIMA chamada do QEMU. */
    void acknowledgeWrite();

    /** Confirma uma ação SIM_READ: grava `regData` (valor lido) E seta `qemuAction = SIM_READ`
     * -- é isso que desbloqueia o `readReg()` do lado QEMU (que espera `qemuAction`, não
     * `simuTime`) -- depois zera `simuTime` como qualquer outra ação. */
    void acknowledgeRead(uint64_t regData);

private:
    class SharedMemory;

    std::unique_ptr<SharedMemory> m_sharedMemory;
    LsdnQemuArena* m_arena = nullptr;
    std::vector<MemoryRegion> m_regions;
};

} // namespace lasecsimul::mcu::qemu

