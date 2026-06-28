#pragma once

#include <algorithm>
#include <array>
#include <optional>
#include "lasecsimul/IComponentModel.hpp"

namespace lasecsimul::components {

/**
 * Porta de `SimulIDE-dev/src/components/sources/currsource.cpp` (via `VarSource`) — fonte de
 * corrente ideal de 1 terminal (alta impedância de saída, ao contrário de `VoltSource`). Sem
 * `addConductanceToGround`: uma fonte de corrente ideal não fixa tensão nenhuma, só empurra
 * `value` Ampères pro nó -- a impedância de saída é a do resto do circuito.
 */
class CurrSource final : public IComponentModel {
public:
    CurrSource(Pin pin, double value, double minValue, double maxValue)
        : m_pins{std::move(pin)}, m_minValue(minValue), m_maxValue(maxValue), m_value(clamp(value)) {}

    const char* typeId() const override { return "sources.current_source"; }
    std::span<Pin> pins() override { return m_pins; }

    void stamp(MnaMatrixView& matrix) override { matrix.addCurrentToGround(m_pins[0], m_value); }

    void postStep(uint64_t) override {}

    /** Sempre `-value` (convenção passiva, ver Rail::current()) -- fonte de corrente ideal não
     * depende da tensão do nó, então não precisa de estado cacheado em stamp(). */
    std::optional<double> current() const override { return -m_value; }

    size_t getState(uint8_t*, size_t) const override { return 0; }
    void setState(const uint8_t*, size_t) override {}

    std::vector<PropertyDescriptor> propertyDescriptors() override {
        const auto schemas = propertySchema();
        PropertyDescriptor value{"value", "A", [this] { return PropertyValue{m_value}; },
                                  [this](const PropertyValue& v) {
                                      if (const double* d = std::get_if<double>(&v)) setValue(*d);
                                  }};
        value.schema = schemas[0];
        PropertyDescriptor maxValue{"maxValue", "A", [this] { return PropertyValue{m_maxValue}; },
                                     [this](const PropertyValue& v) {
                                         if (const double* d = std::get_if<double>(&v)) setMaxValue(*d);
                                     }};
        maxValue.schema = schemas[1];
        PropertyDescriptor minValue{"minValue", "A", [this] { return PropertyValue{m_minValue}; },
                                     [this](const PropertyValue& v) {
                                         if (const double* d = std::get_if<double>(&v)) setMinValue(*d);
                                     }};
        minValue.schema = schemas[2];
        return {value, maxValue, minValue};
    }

    static std::vector<PropertySchema> propertySchema() {
        PropertySchema value;
        value.id = "value";
        value.label = "Corrente Atual";
        value.group = "Elétrica";
        value.unit = "A";
        value.valueKind = PropertyValueKind::Number;
        value.editor = "number";
        value.defaultValue = 1.0;
        value.flags |= PropertySchemaShowOnSymbol;

        PropertySchema maxValue;
        maxValue.id = "maxValue";
        maxValue.label = "Corrente Máx.";
        maxValue.group = "Elétrica";
        maxValue.unit = "A";
        maxValue.valueKind = PropertyValueKind::Number;
        maxValue.editor = "number";
        maxValue.defaultValue = 1.0;

        PropertySchema minValue;
        minValue.id = "minValue";
        minValue.label = "Corrente Mín.";
        minValue.group = "Elétrica";
        minValue.unit = "A";
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

    std::array<Pin, 1> m_pins;
    double m_minValue;
    double m_maxValue;
    double m_value;
};

} // namespace lasecsimul::components
