#include <cmath>
#include <cstdio>
#include <string>
#include <unordered_map>
#include <vector>
#include "simulation/ComponentMatrixView.hpp"
#include "simulation/MnaSolver.hpp"

using namespace lasecsimul;
using namespace lasecsimul::simulation;

namespace {

bool nearlyEqual(double a, double b, double eps = 1e-5) { return std::abs(a - b) < eps; }

void stampGroundedSource(CircuitGroup& group, uint32_t sourceOwner, uint32_t groundOwner, double voltage) {
    const std::unordered_map<std::string, uint32_t> sourceMap{{"p", 0}, {"n", 1}};
    const std::unordered_map<std::string, uint32_t> groundMap{{"pin", 1}};

    ComponentMatrixView source(group, sourceMap, sourceOwner, static_cast<uint32_t>(group.size()));
    source.addVoltageSource(Pin{"p"}, Pin{"n"}, voltage);
    source.commit();

    ComponentMatrixView ground(group, groundMap, groundOwner);
    ground.addConductanceToGround(Pin{"pin"}, 1e9);
    ground.commit();
}

} // namespace

int main() {
    MnaSolver solver;

    std::vector<CircuitGroup> groups;
    groups.emplace_back(std::vector<uint32_t>{0, 1}, 1);
    groups.emplace_back(std::vector<uint32_t>{2, 3}, 1);

    stampGroundedSource(groups[0], 10, 11, 5.0);
    stampGroundedSource(groups[1], 20, 21, 3.0);

    std::vector<double> nodeVoltages(4, 0.0);
    solver.solve(groups, nodeVoltages);

    if (!nearlyEqual(nodeVoltages[0], 5.0) || !nearlyEqual(nodeVoltages[1], 0.0, 1e-6) ||
        !nearlyEqual(nodeVoltages[2], 3.0) || !nearlyEqual(nodeVoltages[3], 0.0, 1e-6)) {
        std::fprintf(stderr, "FALHOU: grupos independentes resolveram %.6f %.6f %.6f %.6f\n",
                     nodeVoltages[0], nodeVoltages[1], nodeVoltages[2], nodeVoltages[3]);
        return 1;
    }

    std::vector<CircuitGroup> singularGroups;
    singularGroups.emplace_back(std::vector<uint32_t>{0});
    std::vector<double> singularVoltages(1, 123.0);
    solver.solve(singularGroups, singularVoltages);

    if (!singularGroups[0].singular() || !std::isfinite(singularVoltages[0]) || singularVoltages[0] != 0.0) {
        std::fprintf(stderr, "FALHOU: matriz singular deveria ser detectada e zerada, deu %.6f\n",
                     singularVoltages[0]);
        return 1;
    }

    std::printf("OK: MnaSolver resolve multiplos grupos e bloqueia matriz singular.\n");
    return 0;
}
