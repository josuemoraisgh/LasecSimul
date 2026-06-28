#pragma once

#include <algorithm>
#include <array>
#include <optional>
#include "lasecsimul/IComponentModel.hpp"

namespace lasecsimul::components {

/**
 * Porta de `SimulIDE-dev/src/components/sources/voltsource.cpp` (via `VarSource`) — fonte de
 * tensão variável de 1 terminal, valor ajustável dentro de `[minValue, maxValue]`. No SimulIDE o
 * ajuste é por um dial giratório; aqui é só uma propriedade numérica com `min`/`max` (o painel de
 * propriedades da Extension já tem editor numérico — sem necessidade de widget customizado).
 * Mesmo Norton-pra-terra do `Rail`/`FixedVolt`.
 */
class VoltSource final : public IComponentModel {
public:
    VoltSource(Pin pin, double value, double minValue, double maxValue)
        : m_pins{std::move(pin)}, m_minValue(minValue), m_maxValue(maxValue), m_value(clamp(value)) {}

    const char* typeId() const override { return "sources.voltage_source"; }
    std::span<Pin> pins() override { return m_pins; }

    void stamp(MnaMatrixView& matrix) override {
        // Convenção passiva -- ver Rail::current()/DcVoltageSource::current().
        m_lastCurrent = kConductance * matrix.getNodeVoltage(m_pins[0]) - m_value * kConductance;
        matrix.addConductanceToGround(m_pins[0], kConductance);
        matrix.addCurrentToGround(m_pins[0], m_value * kConductance);
    }

    void postStep(uint64_t) override {}

    std::optional<double> current() const override { return m_lastCurrent; }

    size_t getState(uint8_t*, size_t) const override { return 0; }
    void setState(const uint8_t*, size_t) override {}

    std::vector<PropertyDescriptor> propertyDescriptors() override {
        const auto schemas = propertySchema();
        PropertyDescriptor value{"value", "V", [this] { return PropertyValue{m_value}; },
                                  [this](const PropertyValue& v) {
                                      if (const double* d = std::get_if<double>(&v)) setValue(*d);
                                  }};
        value.schema = schemas[0];
        PropertyDescriptor maxValue{"maxValue", "V", [this] { return PropertyValue{m_maxValue}; },
                                     [this](const PropertyValue& v) {
                                         if (const double* d = std::get_if<double>(&v)) setMaxValue(*d);
                                     }};
        maxValue.schema = schemas[1];
        PropertyDescriptor minValue{"minValue", "V", [this] { return PropertyValue{m_minValue}; },
                                     [this](const PropertyValue& v) {
                                         if (const double* d = std::get_if<double>(&v)) setMinValue(*d);
                                     }};
        minValue.schema = schemas[2];
        return {value, maxValue, minValue};
    }

    static std::vector<PropertySchema> propertySchema() {
        PropertySchema value;
        value.id = "value";
        value.label = "Valor Atual";
        value.group = "Elétrica";
        value.unit = "V";
        value.valueKind = PropertyValueKind::Number;
        value.editor = "number";
        value.defaultValue = 5.0;
        value.flags |= PropertySchemaShowOnSymbol;

        PropertySchema maxValue;
        maxValue.id = "maxValue";
        maxValue.label = "Tensão Máx.";
        maxValue.group = "Elétrica";
        maxValue.unit = "V";
        maxValue.valueKind = PropertyValueKind::Number;
        maxValue.editor = "number";
        maxValue.defaultValue = 5.0;

        PropertySchema minValue;
        minValue.id = "minValue";
        minValue.label = "Tensão Mín.";
        minValue.group = "Elétrica";
        minValue.unit = "V";
        minValue.valueKind = PropertyValueKind::Number;
        minValue.editor = "number";
        minValue.defaultValue = 0.0;

        return {value, maxValue, minValue};
    }

    void setValue(double v) { m_value = clamp(v); }
    void setMaxValue(double v) {
        m_maxValue = v < m_minValue ? m_minValue + 1e-3 : v;
        m_value = clamp(m_value);
    }
    void setMinValue(double v) {
        m_minValue = v > m_maxValue ? m_maxValue - 1e-3 : v;
        m_value = clamp(m_value);
    }

private:
    double clamp(double v) const { return std::min(m_maxValue, std::max(m_minValue, v)); }

    static constexpr double kConductance = 1e9;

    std::array<Pin, 1> m_pins;
    double m_minValue;
    double m_maxValue;
    double m_value;
    double m_lastCurrent = 0.0;
};

} // namespace lasecsimul::components
