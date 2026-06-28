#include "simulation/Scheduler.hpp"
#include <cassert>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <thread>
#include <vector>

using lasecsimul::simulation::Scheduler;

namespace {

void testOrderedEvents() {
    std::vector<int> ran;
    Scheduler* schedulerPtr = nullptr;
    Scheduler scheduler(8, [&schedulerPtr] {
        schedulerPtr->dirtySet().clear();
        return false;
    });
    schedulerPtr = &scheduler;

    scheduler.scheduleAt(30, [&ran] { ran.push_back(3); });
    scheduler.scheduleAt(10, [&ran] { ran.push_back(1); });
    scheduler.scheduleAt(20, [&ran] { ran.push_back(2); });

    scheduler.runUntil(30);

    assert((ran == std::vector<int>{1, 2, 3}));
    assert(scheduler.nowNs() == 30);
}

void testSameTimestampIsDeterministic() {
    std::vector<int> ran;
    Scheduler* schedulerPtr = nullptr;
    Scheduler scheduler(8, [&schedulerPtr] {
        schedulerPtr->dirtySet().clear();
        return false;
    });
    schedulerPtr = &scheduler;

    scheduler.scheduleAt(10, [&ran] { ran.push_back(1); });
    scheduler.scheduleAt(10, [&ran] { ran.push_back(2); });
    scheduler.scheduleAt(10, [&ran] { ran.push_back(3); });

    scheduler.runUntil(10);

    assert((ran == std::vector<int>{1, 2, 3}));
}

void testDirtyDuplicateOnce() {
    std::vector<uint32_t> drained;
    Scheduler* schedulerPtr = nullptr;
    Scheduler scheduler(2, [&schedulerPtr, &drained] {
        drained.assign(schedulerPtr->dirtySet().dense().begin(), schedulerPtr->dirtySet().dense().end());
        schedulerPtr->dirtySet().clear();
        return false;
    });
    schedulerPtr = &scheduler;

    scheduler.markDirty(1);
    scheduler.markDirty(1);
    scheduler.runUntil(0);

    assert((drained == std::vector<uint32_t>{1}));
    assert(scheduler.dirtyCount() == 0);
}

void testResetClearsEventsAndDirty() {
    bool ran = false;
    Scheduler* schedulerPtr = nullptr;
    Scheduler scheduler(2, [&schedulerPtr] {
        schedulerPtr->dirtySet().clear();
        return false;
    });
    schedulerPtr = &scheduler;

    scheduler.markDirty(1);
    scheduler.scheduleAt(10, [&ran] { ran = true; });
    scheduler.reset();
    scheduler.runUntil(10);

    assert(!ran);
    assert(scheduler.nowNs() == 10);
    assert(scheduler.dirtyCount() == 0);
    assert(scheduler.pendingEventCount() == 0);
}

void testStopDoesNotBlock() {
    Scheduler* schedulerPtr = nullptr;
    Scheduler scheduler(2, [&schedulerPtr] {
        schedulerPtr->dirtySet().clear();
        return false;
    });
    schedulerPtr = &scheduler;

    scheduler.start();
    const auto start = std::chrono::steady_clock::now();
    scheduler.stop();
    const auto elapsed = std::chrono::steady_clock::now() - start;

    assert(elapsed < std::chrono::seconds(1));
}

} // namespace

int main() {
    testOrderedEvents();
    testSameTimestampIsDeterministic();
    testDirtyDuplicateOnce();
    testResetClearsEventsAndDirty();
    testStopDoesNotBlock();

    std::printf("OK: Scheduler ordered events, deterministic tie-break, dirty, reset, stop.\n");
    return 0;
}
