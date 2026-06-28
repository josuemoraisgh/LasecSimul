#include "PluginModule.hpp"

#if defined(_WIN32)
#include <windows.h>
#else
#include <dlfcn.h>
#endif

namespace lasecsimul::plugins {

namespace {
#if defined(_WIN32)
void freeNativeLibrary(void* handle) { FreeLibrary(static_cast<HMODULE>(handle)); }
#else
void freeNativeLibrary(void* handle) { dlclose(handle); }
#endif
} // namespace

PluginModule::~PluginModule() {
    if (m_libraryHandle) freeNativeLibrary(m_libraryHandle);
}

} // namespace lasecsimul::plugins
