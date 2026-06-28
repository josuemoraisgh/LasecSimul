#pragma once

#include <functional>
#include <string>

namespace lasecsimul::plugins {

/**
 * Contencao de falha best-effort para chamadas a plugins nativos sem sandbox.
 * No Windows, SEH captura falhas de acesso a memoria de forma segura para continuar.
 * Em POSIX, nao existe equivalente seguro (ver .spec/lasecsimul-native-devices.spec, secao 12,
 * item 4) — uma falha ali deve ser tratada na camada de processo (reinicio do Core), nao aqui.
 */
class CrashGuard {
public:
    /** Retorna false se a chamada falhou e foi contida; true se completou normalmente. */
    static bool call(const std::string& typeId, const std::function<void()>& fn);
};

} // namespace lasecsimul::plugins
