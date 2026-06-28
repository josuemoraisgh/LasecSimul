#include "mcu/qemu/QemuArenaBridge.hpp"
#include <cassert>
#include <chrono>
#include <cstdio>
#include <string>
#include <vector>

using namespace lasecsimul;
using namespace lasecsimul::mcu::qemu;

namespace {

std::string uniqueArenaName() {
    return "lasecsimul-arena-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count());
}

void testOpenPollAndAcknowledge() {
    QemuArenaBridge bridge;
    bridge.open(QemuArenaOpenOptions{uniqueArenaName(), true});
    assert(bridge.isOpen());
    assert(bridge.arena() != nullptr);

    bridge.arena()->simuTime = 42;
    bridge.arena()->qemuTime = 7;
    bridge.arena()->simuAction = LSDN_SIM_FREQ;
    bridge.arena()->regData = 0x1234;
    bridge.arena()->regAddr = 0x40000000;
    bridge.arena()->running = true;

    const QemuPollResult result = bridge.poll();
    assert(result.hasEvent);
    assert(result.event.has_value());
    assert(result.event->simuTimePs == 42);
    assert(result.event->regData == 0x1234);
    assert(bridge.arena()->simuTime == 42); // poll() não confirma por si só

    bridge.acknowledgeWrite();
    assert(bridge.arena()->simuTime == 0);

    bridge.close();
    assert(!bridge.isOpen());
}

void testDispatchUsesSortedRegions() {
    QemuArenaBridge bridge;
    const std::vector<MemoryRegion> regions = {
        MemoryRegion{0x3000, 0x30ff, ModuleKind::Spi, 1},
        MemoryRegion{0x1000, 0x10ff, ModuleKind::Gpio, 0},
        MemoryRegion{0x2000, 0x20ff, ModuleKind::I2c, 0},
    };
    bridge.setMemoryRegions(regions);

    const QemuDispatchResult gpio = bridge.dispatch(0x1080);
    assert(gpio.matched);
    assert(gpio.region.moduleKind == ModuleKind::Gpio);
    assert(gpio.region.moduleIndex == 0);

    const QemuDispatchResult spi = bridge.dispatch(0x3001);
    assert(spi.matched);
    assert(spi.region.moduleKind == ModuleKind::Spi);
    assert(spi.region.moduleIndex == 1);

    const QemuDispatchResult missing = bridge.dispatch(0x4000);
    assert(!missing.matched);
    assert(!missing.error.empty());
}

void testPollWithDispatch() {
    QemuArenaBridge bridge;
    bridge.setMemoryRegions(std::vector<MemoryRegion>{MemoryRegion{0x1000, 0x10ff, ModuleKind::Usart, 2}});
    bridge.open(QemuArenaOpenOptions{uniqueArenaName(), true});
    bridge.arena()->simuTime = 1;
    bridge.arena()->simuAction = LSDN_SIM_WRITE;
    bridge.arena()->regAddr = 0x1004;
    bridge.arena()->regData = 0xAB;

    const QemuPollResult result = bridge.poll();
    assert(result.hasEvent);
    assert(result.dispatch.has_value());
    assert(result.dispatch->matched);
    assert(result.dispatch->region.moduleKind == ModuleKind::Usart);

    bridge.acknowledgeWrite();
    assert(bridge.arena()->simuTime == 0);
}

void testPollReadAcknowledgesViaQemuAction() {
    QemuArenaBridge bridge;
    bridge.setMemoryRegions(std::vector<MemoryRegion>{MemoryRegion{0x1000, 0x10ff, ModuleKind::Gpio, 0}});
    bridge.open(QemuArenaOpenOptions{uniqueArenaName(), true});
    bridge.arena()->simuTime = 1;
    bridge.arena()->simuAction = LSDN_SIM_READ;
    bridge.arena()->regAddr = 0x103C;

    const QemuPollResult result = bridge.poll();
    assert(result.hasEvent);
    assert(result.dispatch->matched);

    bridge.acknowledgeRead(0xCAFEu);
    assert(bridge.arena()->regData == 0xCAFEu);
    assert(bridge.arena()->qemuAction == LSDN_SIM_READ);
    assert(bridge.arena()->simuTime == 0);
}

} // namespace

int main() {
    testOpenPollAndAcknowledge();
    testDispatchUsesSortedRegions();
    testPollWithDispatch();
    testPollReadAcknowledgesViaQemuAction();
    std::printf("OK: QemuArenaBridge open, poll and dispatch passed.\n");
    return 0;
}

