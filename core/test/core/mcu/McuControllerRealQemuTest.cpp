// Valida McuController contra o binário REAL do fork qemu-simulide (não fake/sintético como
// QemuProcessManagerTest/QemuArenaBridgeTest) -- ver docs/mvp-limitacoes.md.
//
// Escopo deliberadamente limitado: usa um caminho de firmware que NÃO existe, porque não há
// toolchain xtensa-esp32-elf/ESP-IDF nesta máquina para compilar um blink.bin real (decisão tomada
// explicitamente para esta rodada -- ver docs/mvp-limitacoes.md). Por isso este teste prova que o
// McuController consegue:
//   1. abrir a arena de memória compartilhada do lado do Core, e
//   2. iniciar de fato o processo qemu-system-xtensa.exe REAL (CreateProcess/exec contra o binário
//      verdadeiro, não um stub do próprio teste),
// e encerrar tudo de volta sem travar nem vazar processo/handle. NÃO prova que o GPIO funciona de
// ponta a ponta -- isso exige firmware real E o mecanismo (não documentado neste repo, sem o
// código-fonte do fork) pelo qual o nome da arena chega até o processo QEMU. Pula (sai com 0) se o
// binário real não estiver presente no caminho esperado, para não quebrar quem não tem o fork
// baixado localmente.
#include <chrono>
#include <cstdio>
#include <filesystem>
#include <thread>
#include "mcu/McuController.hpp"
#include "mcu/esp32/Esp32Adapter.hpp"

using namespace lasecsimul;
using namespace lasecsimul::mcu;
using namespace lasecsimul::mcu::esp32;

namespace {

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

std::string uniqueArenaName() {
    return "lasecsimul-mcu-controller-test-" +
           std::to_string(std::chrono::steady_clock::now().time_since_epoch().count());
}

} // namespace

int main() {
    std::fprintf(stderr, "=== McuControllerRealQemuTest ===\n");

#ifndef QEMU_REAL_BINARY_PATH
#error "QEMU_REAL_BINARY_PATH precisa ser definido pelo CMakeLists (caminho do qemu-system-xtensa.exe real)"
#endif
    const std::filesystem::path qemuPath = QEMU_REAL_BINARY_PATH;

    if (!std::filesystem::exists(qemuPath)) {
        std::fprintf(stderr,
                      "PULADO: %s não existe -- este teste exige o fork qemu-simulide compilado "
                      "localmente (ver docs/mvp-limitacoes.md).\n",
                      qemuPath.string().c_str());
        return 0;
    }

    Esp32Adapter adapter;
    McuController controller(adapter, qemuPath.string());

    const std::string arenaName = uniqueArenaName();
    bool started = false;
    try {
        controller.start("nonexistent-blink.bin", arenaName);
        started = true;
    } catch (const std::exception& e) {
        std::fprintf(stderr, "FALHOU: McuController::start lançou: %s\n", e.what());
    }
    TEST_ASSERT(started, "McuController::start abre a arena e inicia o processo QEMU real sem lançar");
    TEST_ASSERT(controller.arenaBridge().isOpen(), "arena de memória compartilhada está aberta do lado do Core");

    // Sem firmware real, o QEMU real tende a sair quase imediatamente (kernel inválido) -- dá tempo
    // de sobra (o dobro do observado manualmente) antes de seguir para stop(), só por robustez.
    std::this_thread::sleep_for(std::chrono::milliseconds(500));

    std::fprintf(stderr, "  [info] isRunning() antes do stop(): %s\n", controller.isRunning() ? "true" : "false");
    std::fprintf(stderr, "  [info] qemuLogs(): %s\n", controller.qemuLogs().c_str());

    controller.stop();
    TEST_ASSERT(!controller.isRunning(), "processo QEMU real não está mais rodando após stop()");
    TEST_ASSERT(!controller.arenaBridge().isOpen(), "arena foi fechada após stop()");

    if (failures == 0) {
        std::fprintf(stderr, "\nTodos os testes passaram.\n");
        return 0;
    }
    std::fprintf(stderr, "\n%d teste(s) FALHARAM.\n", failures);
    return 1;
}
