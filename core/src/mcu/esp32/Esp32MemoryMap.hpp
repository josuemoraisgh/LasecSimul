#pragma once

#include <array>
#include "lasecsimul/Types.hpp"

namespace lasecsimul::mcu::esp32 {

inline constexpr uint64_t kGpioStart = 0x3FF44000;
inline constexpr uint64_t kGpioEnd = 0x3FF44FFF;
inline constexpr uint64_t kI2c0Start = 0x3FF53000;
inline constexpr uint64_t kI2c0End = 0x3FF53FFF;
inline constexpr uint64_t kSpi0Start = 0x3FF64000;
inline constexpr uint64_t kSpi0End = 0x3FF64FFF;
inline constexpr uint64_t kUart0Start = 0x3FF40000;
inline constexpr uint64_t kUart0End = 0x3FF40FFF;

inline constexpr uint32_t kUartRxLine = 0;
inline constexpr uint32_t kUartTxLine = 1;

inline constexpr std::array<MemoryRegion, 4> kMemoryRegions{{
    {kGpioStart, kGpioEnd, ModuleKind::Gpio, 0},
    {kI2c0Start, kI2c0End, ModuleKind::I2c, 0},
    {kSpi0Start, kSpi0End, ModuleKind::Spi, 0},
    {kUart0Start, kUart0End, ModuleKind::Usart, 0},
}};

} // namespace lasecsimul::mcu::esp32
