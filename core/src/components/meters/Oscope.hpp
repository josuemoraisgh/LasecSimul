#pragma once

#include <array>
#include <cstring>
#include "lasecsimul/IComponentModel.hpp"

namespace lasecsimul::components {

/**
 * Porta de `SimulIDE-dev/src/components/meters/oscope.cpp` — osciloscópio de 4 canais (mesmo
 * `m_timePos[4]`/`m_voltDiv[4]` do original), todos alta impedância. Cada canal só amostra a
 * tensão na última `solve()` e guarda em `getState()`.
 *
 * **Limitação documentada**: o SimulIDE real tem uma janela de plotagem gráfica completa
 * (`OscWidget`/`DataWidget`, zoom, trigger, divisão de tempo/tensão por canal) -- isso é
 * ferramenta de UI interativa da Extension/Webview, não do Core, e fica fora desta rodada (mesma
 * decisão de escopo do Épico G do roadmap de pendências: UI visual precisa de sessão própria com
 * o editor rodando de verdade pra validar). Aqui só a parte elétrica (sensoriamento de 4 canais)
 * está implementada; `filter`/`autoSC`/`tracks` continuam expostos como propriedades pra bater
 * "todas as propriedades" do original, mesmo sem efeito visual ainda.
 */
class Oscope final : public IComponentModel {
public:
    static constexpr size_t kChannelCount = 4;

    explicit Oscope(std::array<Pin, kChannelCount> pins) : m_pins(std::move(pins)) {}

    const char* typeId() const override { return "meters.oscope"; }
    std::span<Pin> pins() override { return m_pins; }

    void stamp(MnaMatrixView& matrix) override {
        for (size_t ch = 0; ch < kChannelCount; ++ch) {
            m_lastVoltages[ch] = matrix.getNodeVoltage(m_pins[ch]);
            matrix.addConductanceToGround(m_pins[ch], kInputConductance);
        }
    }

    void postStep(uint64_t) override {}

    size_t getState(uint8_t* out, size_t cap) const override {
        if (cap < sizeof(m_lastVoltages)) return 0;
        std::memcpy(out, m_lastVoltages.data(), sizeof(m_lastVoltages));
        return sizeof(m_lastVoltages);
    }
    void setState(const uint8_t* in, size_t len) override {
        if (len < sizeof(m_lastVoltages)) return;
        std::memcpy(m_lastVoltages.data(), in, sizeof(m_lastVoltages));
    }

    std::vector<PropertyDescriptor> propertyDescriptors() override {
        const auto schemas = propertySchema();
        PropertyDescriptor filter{"filter", "V", [this] { return PropertyValue{m_filter}; },
                                   [this](const PropertyValue& v) {
                                       if (const double* d = std::get_if<double>(&v)) m_filter = *d;
                                   }};
        filter.schema = schemas[0];
        PropertyDescriptor autoSc{"autoScale", "", [this] { return PropertyValue{m_autoScale}; },
                                   [this](const PropertyValue& v) {
                                       if (const bool* b = std::get_if<bool>(&v)) m_autoScale = *b;
                                   }};
        autoSc.schema = schemas[1];
        PropertyDescriptor tracks{"tracks", "", [this] { return PropertyValue{static_cast<double>(m_tracks)}; },
                                   [this](const PropertyValue& v) {
                                       if (const double* d = std::get_if<double>(&v)) m_tracks = static_cast<int>(*d);
                                   }};
        tracks.schema = schemas[2];
        return {filter, autoSc, tracks};
    }

    static std::vector<PropertySchema> propertySchema() {
        PropertySchema filter;
        filter.id = "filter";
        filter.label = "Filtro";
        filter.group = "Leitura";
        filter.unit = "V";
        filter.valueKind = PropertyValueKind::Number;
        filter.editor = "number";
        filter.defaultValue = 0.0;

        PropertySchema autoSc;
        autoSc.id = "autoScale";
        autoSc.label = "Auto Escala";
        autoSc.group = "Leitura";
        autoSc.valueKind = PropertyValueKind::Bool;
        autoSc.editor = "checkbox";
        autoSc.defaultValue = true;

        PropertySchema tracks;
        tracks.id = "tracks";
        tracks.label = "Canais Visíveis";
        tracks.group = "Leitura";
        tracks.valueKind = PropertyValueKind::Number;
        tracks.editor = "number";
        tracks.defaultValue = 4.0;
        tracks.minValue = 1.0;
        tracks.maxValue = 4.0;

        return {filter, autoSc, tracks};
    }

private:
    static constexpr double kInputConductance = 1e-9;

    std::array<Pin, kChannelCount> m_pins;
    std::array<double, kChannelCount> m_lastVoltages{};
    double m_filter = 0.0;
    bool m_autoScale = true;
    int m_tracks = 4;
};

} // namespace lasecsimul::components
