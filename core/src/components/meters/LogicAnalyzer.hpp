#pragma once

#include <algorithm>
#include <array>
#include <cstring>
#include "lasecsimul/IComponentModel.hpp"
#include "simulation/Scheduler.hpp"

namespace lasecsimul::components {

/**
 * Porta de `SimulIDE-dev/src/components/meters/logicanalizer.cpp` — analisador lógico de 8 canais
 * (`m_pin.resize(8)` no original), alta impedância, cada canal amostrado como nível digital
 * (`>` `threshold` = alto), empacotado num bitmask de 8 bits.
 *
 * **Buffer de histórico com tempo real** (2026-06-29, mesmo princípio de `Oscope`): grava um
 * bitmask por amostra, só quando passou `sampleIntervalNs` de tempo SIMULADO (`Scheduler::nowNs()`)
 * desde a última gravação -- não a cada `stamp()` (que roda por settle, não por amostra de
 * relógio). Janela "Expande" da Webview lê isso via `getComponentState()` em vez de acumular uma
 * amostra por poll de IPC (~300ms de parede, sem relação com o circuito).
 *
 * **Limitação que CONTINUA existindo**: janela de plotagem/trigger por hardware é UI da
 * Extension/Webview -- aqui só sensoriamento elétrico + histórico temporal real.
 */
class LogicAnalyzer final : public IComponentModel {
public:
    static constexpr size_t kChannelCount = 8;
    static constexpr size_t kHistoryCapacity = 1024;

    explicit LogicAnalyzer(simulation::Scheduler& scheduler, std::array<Pin, kChannelCount> pins, double threshold)
        : m_scheduler(scheduler), m_pins(std::move(pins)), m_threshold(threshold) {}

    const char* typeId() const override { return "meters.logic_analyzer"; }
    std::span<Pin> pins() override { return m_pins; }

    void stamp(MnaMatrixView& matrix) override {
        m_lastLevels = 0;
        for (size_t ch = 0; ch < kChannelCount; ++ch) {
            const double v = matrix.getNodeVoltage(m_pins[ch]);
            if (v > m_threshold) m_lastLevels |= (1u << ch);
            matrix.addConductanceToGround(m_pins[ch], kInputConductance);
        }

        const uint64_t now = m_scheduler.nowNs();
        if (now - m_lastSampleNs >= m_sampleIntervalNs) {
            m_history[m_writeIndex] = Sample{now, m_lastLevels};
            m_lastSampleNs = now;
            m_writeIndex = (m_writeIndex + 1) % kHistoryCapacity;
            if (m_count < kHistoryCapacity) ++m_count;
        }
    }

    void postStep(uint64_t) override {}

    /** Formato: [0..4) uint32 (último bitmask, compatível com leitores antigos) + [4..8) uint32 nº
     * de amostras gravadas + histórico cronológico, cada amostra {uint64 timestampNs, uint32
     * bitmask}. Mesmo contrato de sempre: `cap` insuficiente devolve 0, nunca escreve parcial. */
    size_t getState(uint8_t* out, size_t cap) const override {
        const uint32_t sampleCount = static_cast<uint32_t>(m_count);
        const size_t needed = sizeof(m_lastLevels) + sizeof(uint32_t) + sampleCount * kSampleBytes;
        if (cap < needed) return 0;

        size_t offset = 0;
        std::memcpy(out + offset, &m_lastLevels, sizeof(m_lastLevels));
        offset += sizeof(m_lastLevels);
        std::memcpy(out + offset, &sampleCount, sizeof(uint32_t));
        offset += sizeof(uint32_t);
        for (uint32_t i = 0; i < sampleCount; ++i) {
            const Sample& sample = sampleAt(i);
            std::memcpy(out + offset, &sample.timestampNs, sizeof(uint64_t));
            offset += sizeof(uint64_t);
            std::memcpy(out + offset, &sample.levels, sizeof(uint32_t));
            offset += sizeof(uint32_t);
        }
        return offset;
    }
    void setState(const uint8_t* in, size_t len) override {
        if (len < sizeof(m_lastLevels)) return;
        std::memcpy(&m_lastLevels, in, sizeof(m_lastLevels));
        // Histórico não é restaurado por setState() (snapshot/undo) -- mesma decisão do Oscope.
    }

    std::vector<PropertyDescriptor> propertyDescriptors() override {
        const auto schemas = propertySchema();
        PropertyDescriptor threshold{"threshold", "V", [this] { return PropertyValue{m_threshold}; },
                                      [this](const PropertyValue& v) {
                                          if (const double* d = std::get_if<double>(&v)) m_threshold = *d;
                                      }};
        threshold.schema = schemas[0];
        PropertyDescriptor sampleInterval{"sampleIntervalNs", "ns",
                                           [this] { return PropertyValue{static_cast<double>(m_sampleIntervalNs)}; },
                                           [this](const PropertyValue& v) {
                                               if (const double* d = std::get_if<double>(&v)) m_sampleIntervalNs = static_cast<uint64_t>(std::max(1.0, *d));
                                           }};
        sampleInterval.schema = schemas[1];
        return {threshold, sampleInterval};
    }

    static std::vector<PropertySchema> propertySchema() {
        PropertySchema threshold;
        threshold.id = "threshold";
        threshold.label = "Limiar Lógico";
        threshold.group = "Leitura";
        threshold.unit = "V";
        threshold.valueKind = PropertyValueKind::Number;
        threshold.editor = "number";
        threshold.defaultValue = 2.5;

        PropertySchema sampleInterval;
        sampleInterval.id = "sampleIntervalNs";
        sampleInterval.label = "Intervalo de Amostra";
        sampleInterval.group = "Leitura";
        sampleInterval.unit = "ns";
        sampleInterval.valueKind = PropertyValueKind::Number;
        sampleInterval.editor = "number";
        sampleInterval.defaultValue = 50000.0;
        sampleInterval.minValue = 1.0;

        return {threshold, sampleInterval};
    }

private:
    struct Sample {
        uint64_t timestampNs = 0;
        uint32_t levels = 0;
    };
    static constexpr size_t kSampleBytes = sizeof(uint64_t) + sizeof(uint32_t);
    static constexpr double kInputConductance = 1e-9;

    const Sample& sampleAt(uint32_t index) const {
        const size_t physical = m_count < kHistoryCapacity ? index : (m_writeIndex + index) % kHistoryCapacity;
        return m_history[physical];
    }

    simulation::Scheduler& m_scheduler;
    std::array<Pin, kChannelCount> m_pins;
    double m_threshold;
    uint32_t m_lastLevels = 0;
    std::array<Sample, kHistoryCapacity> m_history{};
    size_t m_writeIndex = 0;
    size_t m_count = 0;
    uint64_t m_lastSampleNs = 0;
    uint64_t m_sampleIntervalNs = 50'000;
};

} // namespace lasecsimul::components
