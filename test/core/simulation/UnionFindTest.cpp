#include <cstdio>
#include <cstdint>
#include <exception>
#include <stdexcept>
#include <vector>
#include "simulation/UnionFind.hpp"

using lasecsimul::simulation::UnionFind;

namespace {

bool expect(bool condition, const char* message) {
    if (!condition) std::fprintf(stderr, "FAILED: %s\n", message);
    return condition;
}

bool throwsOutOfRange() {
    try {
        UnionFind uf(1);
        uf.unite(0, 1);
    } catch (const std::out_of_range&) {
        return true;
    } catch (...) {
        return false;
    }
    return false;
}

} // namespace

int main() {
    bool ok = true;

    {
        UnionFind empty(0);
        const std::vector<uint32_t> ids = empty.compress();
        ok &= expect(ids.empty(), "empty UnionFind should compress to an empty id list");
        ok &= expect(empty.idCount() == 0, "empty UnionFind should have zero dense ids");
    }

    {
        UnionFind uf(5);
        uf.unite(0, 2);
        uf.unite(3, 4);
        const std::vector<uint32_t> ids = uf.compress();
        ok &= expect(ids.size() == 5, "compress should return one id per input item");
        ok &= expect(ids[0] == ids[2], "united items should share a dense id");
        ok &= expect(ids[3] == ids[4], "second united pair should share a dense id");
        ok &= expect(ids[0] != ids[1], "disconnected item should keep a separate dense id");
        ok &= expect(ids[0] == 0 && ids[1] == 1 && ids[3] == 2,
                     "dense ids should be assigned by first appearance during rebuild");
        ok &= expect(uf.idCount() == 3, "three connected components should produce three dense ids");
    }

    ok &= expect(throwsOutOfRange(), "invalid union endpoints should throw out_of_range");

    if (ok) std::printf("OK: UnionFind topology primitives passed.\n");
    return ok ? 0 : 1;
}
