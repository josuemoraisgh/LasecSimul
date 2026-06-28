#include <array>
#include <cmath>
#include <cstdio>
#include <exception>
#include <functional>
#include <stdexcept>
#include <string>
#include <variant>
#include <vector>

#include "components/passive/Capacitor.hpp"
#include "components/passive/Inductor.hpp"
#include "components/passive/Resistor.hpp"

using namespace lasecsimul;

namespace {

struct ConductanceStamp {
    std::string a;
    std::string b;
    double siemens;
};

class FakeMatrix final : public MnaMatrixView {
public:
    void addConductance(const Pin& a, const Pin& b, double siemens) override {
        conductances.push_back({a.id, b.id, siemens});
    }

    void addCurrent(const Pin&, const Pin&, double) override { currentSourceCount++; }
    void addVoltageSource(const Pin&, const Pin&, double) override { voltageSourceCount++; }
    void addConductanceToGround(const Pin&, double) override { groundConductanceCount++; }
    void addCurrentToGround(const Pin&, double) override { groundCurrentCount++; }
    double getNodeVoltage(const Pin&) const override { return 0.0; }
    double getBranchCurrent() const override { return branchCurrent; }

    double branchCurrent = 0.0;
    std::vector<ConductanceStamp> conductances;
    int currentSourceCount = 0;
    int voltageSourceCount = 0;
    int groundConductanceCount = 0;
    int groundCurrentCount = 0;
};

int failures = 0;

#define TEST_ASSERT(expr, msg) \
    do { \
        if (!(expr)) { \
            std::fprintf(stderr, "  FALHOU: %s -- %s\n", msg, #expr); \
            failures++; \
        } else { \
            std::fprintf(stderr, "  OK: %s\n", msg); \
        } \
    } while (false)

bool nearlyEqual(double a, double b, double eps = 1e-9) { return std::abs(a - b) < eps; }

std::array<Pin, 2> pins() { return {Pin{"p1"}, Pin{"p2"}}; }

void expectThrows(const char* label, const std::function<void()>& fn) {
    try {
        fn();
        TEST_ASSERT(false, label);
    } catch (const std::invalid_argument&) {
        TEST_ASSERT(true, label);
    } catch (...) {
        TEST_ASSERT(false, label);
    }
}

void testResistorValidationAndStamp() {
    std::fprintf(stderr, "\n[Resistor]\n");
    lasecsimul::components::Resistor r(pins(), 1000.0);
    TEST_ASSERT(std::string(r.typeId()) == "passive.resistor", "typeId correto");
    TEST_ASSERT(r.pins().size() == 2, "expoe dois pinos");

    FakeMatrix matrix;
    r.stamp(matrix);
    TEST_ASSERT(matrix.conductances.size() == 1, "stamp adiciona uma condutancia");
    TEST_ASSERT(nearlyEqual(matrix.conductances[0].siemens, 0.001), "condutancia = 1/R");

    auto props = r.propertyDescriptors();
    TEST_ASSERT(props.size() == 1 && props[0].name == "resistance", "descriptor resistance existe");
    TEST_ASSERT(props[0].schema.group == "Elétrica" && props[0].schema.editor == "number"
                    && props[0].schema.unit == "Ω" && props[0].schema.minValue.has_value(),
                "schema rico preenchido (grupo/editor/unidade/min)");
    props[0].set(PropertyValue{2000.0});
    FakeMatrix afterSet;
    r.stamp(afterSet);
    TEST_ASSERT(nearlyEqual(afterSet.conductances[0].siemens, 0.0005), "setter de propriedade revalida e altera R");

    expectThrows("rejeita resistencia zero", [] { lasecsimul::components::Resistor bad(pins(), 0.0); });
    expectThrows("rejeita resistencia negativa", [] { lasecsimul::components::Resistor bad(pins(), -1.0); });
    expectThrows("setter rejeita resistencia invalida", [&] { r.setResistance(0.0); });
}

void testCapacitorValidationStateAndStamp() {
    std::fprintf(stderr, "\n[Capacitor]\n");
    lasecsimul::components::Capacitor c(pins(), 1e-6);
    TEST_ASSERT(std::string(c.typeId()) == "passive.capacitor", "typeId correto");
    TEST_ASSERT(c.pins().size() == 2, "expoe dois pinos");

    FakeMatrix matrix;
    c.stamp(matrix);
    TEST_ASSERT(matrix.conductances.empty(), "stamp inicial DC e circuito aberto");

    auto props = c.propertyDescriptors();
    TEST_ASSERT(props.size() == 1 && props[0].name == "capacitance", "descriptor capacitance existe");
    TEST_ASSERT(props[0].schema.group == "Elétrica" && props[0].schema.editor == "number"
                    && props[0].schema.unit == "F",
                "schema rico preenchido (grupo/editor/unidade)");
    props[0].set(PropertyValue{2e-6});
    TEST_ASSERT(std::get<double>(props[0].get()) == 2e-6, "setter de propriedade altera C");

    double state = 3.25;
    c.setState(reinterpret_cast<const uint8_t*>(&state), sizeof(state));
    double roundTrip = 0.0;
    TEST_ASSERT(c.getState(reinterpret_cast<uint8_t*>(&roundTrip), sizeof(roundTrip)) == sizeof(roundTrip),
                "estado de tensao inicial serializa");
    TEST_ASSERT(nearlyEqual(roundTrip, state), "estado de tensao inicial faz round-trip");

    expectThrows("rejeita capacitancia zero", [] { lasecsimul::components::Capacitor bad(pins(), 0.0); });
    expectThrows("rejeita capacitancia negativa", [] { lasecsimul::components::Capacitor bad(pins(), -1e-6); });
    expectThrows("setter rejeita capacitancia invalida", [&] { c.setCapacitance(0.0); });
}

void testInductorValidationStateAndStamp() {
    std::fprintf(stderr, "\n[Inductor]\n");
    lasecsimul::components::Inductor l(pins(), 1e-3);
    TEST_ASSERT(std::string(l.typeId()) == "passive.inductor", "typeId correto");
    TEST_ASSERT(l.pins().size() == 2, "expoe dois pinos");

    FakeMatrix matrix;
    l.stamp(matrix);
    TEST_ASSERT(matrix.conductances.size() == 1, "stamp inicial adiciona curto aproximado");
    TEST_ASSERT(nearlyEqual(matrix.conductances[0].siemens, lasecsimul::components::Inductor::kInitialShortConductance, 1.0),
                "condutancia inicial alta documentada");

    auto props = l.propertyDescriptors();
    TEST_ASSERT(props.size() == 1 && props[0].name == "inductance", "descriptor inductance existe");
    TEST_ASSERT(props[0].schema.group == "Elétrica" && props[0].schema.editor == "number"
                    && props[0].schema.unit == "H",
                "schema rico preenchido (grupo/editor/unidade)");
    props[0].set(PropertyValue{2e-3});
    TEST_ASSERT(std::get<double>(props[0].get()) == 2e-3, "setter de propriedade altera L");

    double state = 0.125;
    l.setState(reinterpret_cast<const uint8_t*>(&state), sizeof(state));
    double roundTrip = 0.0;
    TEST_ASSERT(l.getState(reinterpret_cast<uint8_t*>(&roundTrip), sizeof(roundTrip)) == sizeof(roundTrip),
                "estado de corrente inicial serializa");
    TEST_ASSERT(nearlyEqual(roundTrip, state), "estado de corrente inicial faz round-trip");

    expectThrows("rejeita indutancia zero", [] { lasecsimul::components::Inductor bad(pins(), 0.0); });
    expectThrows("rejeita indutancia negativa", [] { lasecsimul::components::Inductor bad(pins(), -1e-3); });
    expectThrows("setter rejeita indutancia invalida", [&] { l.setInductance(0.0); });
}

} // namespace

int main() {
    std::fprintf(stderr, "=== PassiveComponentsTest ===\n");
    testResistorValidationAndStamp();
    testCapacitorValidationStateAndStamp();
    testInductorValidationStateAndStamp();

    std::fprintf(stderr,
                 "\nNota: capacitor/indutor ainda testam apenas o stamp inicial. O modelo dinamico completo "
                 "depende de contrato futuro de dt + historico de fonte/corrente no solver.\n");

    if (failures == 0) {
        std::fprintf(stderr, "\nTodos os testes passaram.\n");
        return 0;
    }
    std::fprintf(stderr, "\n%d teste(s) FALHARAM.\n", failures);
    return 1;
}
