#pragma once

#include <array>
#include "lasecsimul/IComponentModel.hpp"

namespace lasecsimul::components {

/** Nó de junção interno usado para representar derivações fio->fio sem precisar de suporte especial
 * no netlist. Não contribui nada em stamp(); só oferece um único pino compartilhável por vários
 * fios, formando o mesmo nó elétrico. */
class Junction final : public IComponentModel {
public:
    explicit Junction(Pin pin) : m_pins{std::move(pin)} {}

    const char* typeId() const override { return "connectors.junction"; }
    std::span<Pin> pins() override { return m_pins; }

    void stamp(MnaMatrixView&) override {}
    void postStep(uint64_t) override {}

    size_t getState(uint8_t*, size_t) const override { return 0; }
    void setState(const uint8_t*, size_t) override {}

private:
    std::array<Pin, 1> m_pins;
};

} // namespace lasecsimul::components
