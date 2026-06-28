#pragma once

#include <array>
#include <cstring>
#include "lasecsimul/IComponentModel.hpp"

namespace lasecsimul::components {

/**
 * Porta de `SimulIDE-dev/src/components/meters/logicanalizer.cpp` — analisador lógico de 8 canais
 * (`m_pin.resize(8)` no original), alta impedância, cada canal amostrado como nível digital
 * (`>` `threshold` = alto). Mesma limitação documentada do `Oscope`: a janela de captura/timeline
 * gráfica do SimulIDE é UI interativa, fora desta rodada -- aqui só o sensoriamento elétrico de 8
 * canais está implementado, exposto via `getState()` como bitmask.
 */
class LogicAnalyzer final : public IComponentModel {
public:
    static constexpr size_t kChannelCount = 8;

    explicit LogicAnalyzer(std::array<Pin, kChannelCount> pins, double threshold)
        : m_pins(std::move(pins)), m_threshold(threshold) {}

    const char* typeId() const override { return "meters.logic_analyzer"; }
    std::span<Pin> pins() override { return m_pins; }

    void stamp(MnaMatrixView& matrix) override {
        m_lastLevels = 0;
        for (size_t ch = 0; ch < kChannelCount; ++ch) {
            const double v = matrix.getNodeVoltage(m_pins[ch]);
            if (v > m_threshold) m_lastLevels |= (1u << ch);
            matrix.addConductanceToGround(m_pins[ch], kInputConductance);
        }
    }

    void postStep(uint64_t) override {}

    size_t getState(uint8_t* out, size_t cap) const override {
        if (cap < sizeof(m_lastLevels)) return 0;
        std::memcpy(out, &m_lastLevels, sizeof(m_lastLevels));
        return sizeof(m_lastLevels);
    }
    void setState(const uint8_t* in, size_t len) override {
        if (len < sizeof(m_lastLevels)) return;
        std::memcpy(&m_lastLevels, in, sizeof(m_lastLevels));
    }

    std::vector<PropertyDescriptor> propertyDescriptors() override {
        PropertyDescriptor threshold{"threshold", "V", [this] { return PropertyValue{m_threshold}; },
                                      [this](const PropertyValue& v) {
                                          if (const double* d = std::get_if<double>(&v)) m_threshold = *d;
                                      }};
        threshold.schema = propertySchema().front();
        return {threshold};
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
        return {threshold};
    }

private:
    static constexpr double kInputConductance = 1e-9;

    std::array<Pin, kChannelCount> m_pins;
    double m_threshold;
    uint32_t m_lastLevels = 0;
};

} // namespace lasecsimul::components
