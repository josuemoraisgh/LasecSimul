#include <cmath>
#include <cstdio>
#include <string>
#include <unordered_map>
#include "simulation/CircuitGroup.hpp"
#include "simulation/ComponentMatrixView.hpp"

using namespace lasecsimul;
using namespace lasecsimul::simulation;

namespace {

bool nearlyEqual(double a, double b, double eps = 1e-6) { return std::abs(a - b) < eps; }

} // namespace

int main() {
    CircuitGroup group({0, 1});

    const std::unordered_map<std::string, uint32_t> map{{"n", 0}, {"g", 1}};
    const Pin n{"n"};
    const Pin g{"g"};

    ComponentMatrixView passive(group, map, 1U);
    passive.addConductance(n, g, 1.0);
    passive.addConductanceToGround(g, 1e9);
    passive.commit();

    ComponentMatrixView current1(group, map, 2U);
    current1.addCurrent(n, g, 2.0);
    current1.commit();

    group.factor();
    const Eigen::VectorXd first = group.solve();
    if (group.singular() || !first.allFinite() || !nearlyEqual(first[0], -2.0, 1e-6)) {
        std::fprintf(stderr, "FALHOU: solve inicial deveria dar Vn ~= -2V, deu %.9f\n", first[0]);
        return 1;
    }

    ComponentMatrixView current2(group, map, 2U);
    current2.addCurrent(n, g, 3.0);
    current2.commit();

    if (group.admittanceChanged()) {
        std::fprintf(stderr, "FALHOU: trocar apenas fonte de corrente invalidou a fatoracao\n");
        return 1;
    }
    if (!group.currentChanged()) {
        std::fprintf(stderr, "FALHOU: trocar fonte de corrente nao marcou RHS como dirty\n");
        return 1;
    }

    const Eigen::VectorXd second = group.solve();
    if (group.singular() || !second.allFinite() || !nearlyEqual(second[0], -3.0, 1e-6)) {
        std::fprintf(stderr, "FALHOU: solve com RHS novo deveria dar Vn ~= -3V, deu %.9f\n", second[0]);
        return 1;
    }

    std::printf("OK: CircuitGroup substitui stamps e preserva cache quando so RHS muda.\n");
    return 0;
}
