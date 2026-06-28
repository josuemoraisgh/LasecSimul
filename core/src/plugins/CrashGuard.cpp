#include "CrashGuard.hpp"
#include <cstdio>

#if defined(_WIN32)
#include <windows.h>
#endif

namespace lasecsimul::plugins {

#if defined(_WIN32)

static bool callGuardedWindows(const std::string& typeId, const std::function<void()>& fn) {
    __try {
        fn();
        return true;
    } __except (EXCEPTION_EXECUTE_HANDLER) {
        std::fprintf(stderr, "[CrashGuard] plugin '%s' raised SEH 0x%08lX — marcando faulted\n",
                     typeId.c_str(), static_cast<unsigned long>(GetExceptionCode()));
        return false;
    }
}

bool CrashGuard::call(const std::string& typeId, const std::function<void()>& fn) {
    return callGuardedWindows(typeId, fn);
}

#else

// POSIX: SIGSEGV nao e seguro de capturar e continuar (ver spec, secao 12, item 4).
// A unica rede de seguranca real aqui e o reinicio do processo Core com restauro de snapshot.
bool CrashGuard::call(const std::string& /*typeId*/, const std::function<void()>& fn) {
    fn();
    return true;
}

#endif

} // namespace lasecsimul::plugins
