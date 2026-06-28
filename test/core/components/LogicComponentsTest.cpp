#include <array>
#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#include "components/logic/Button.hpp"

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
    double getBranchCurrent() const override { return 0.0; }

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

void testButtonOpenClosedAndProperty() {
    std::fprintf(stderr, "\n[Button]\n");
    lasecsimul::components::Button button(pins(), false);
    TEST_ASSERT(std::string(button.typeId()) == "logic.button", "typeId correto");
    TEST_ASSERT(button.pins().size() == 2, "expoe dois pinos");
    TEST_ASSERT(!button.pressed(), "comeca solto (aberto)");

    FakeMatrix openMatrix;
    button.stamp(openMatrix);
    TEST_ASSERT(openMatrix.conductances.size() == 1, "stamp aberto adiciona uma condutancia");
    TEST_ASSERT(openMatrix.conductances[0].siemens < 1e-6, "aberto: condutancia desprezivel");

    button.setPressed(true);
    FakeMatrix closedMatrix;
    button.stamp(closedMatrix);
    TEST_ASSERT(closedMatrix.conductances[0].siemens > 1e3, "pressionado: condutancia alta (curto)");

    auto props = button.propertyDescriptors();
    TEST_ASSERT(props.size() == 1 && props[0].name == "pressed", "descriptor pressed existe");
    TEST_ASSERT(props[0].schema.group == "Elétrica" && props[0].schema.editor == "checkbox",
                "schema rico preenchido (grupo/editor)");
    TEST_ASSERT(std::get<bool>(props[0].get()) == true, "getter reflete estado pressionado");
    props[0].set(PropertyValue{false});
    TEST_ASSERT(!button.pressed(), "setter de propriedade solta o botao");
}

} // namespace

int main() {
    std::fprintf(stderr, "=== LogicComponentsTest ===\n");
    testButtonOpenClosedAndProperty();

    if (failures == 0) {
        std::fprintf(stderr, "\nTodos os testes passaram.\n");
        return 0;
    }
    std::fprintf(stderr, "\n%d teste(s) FALHARAM.\n", failures);
    return 1;
}
