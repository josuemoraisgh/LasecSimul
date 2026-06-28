#pragma once

#include <filesystem>
#include <memory>
#include <string>
#include "PluginModule.hpp"

namespace lasecsimul::plugins {

/**
 * Descobre bibliotecas (library.json), valida manifesto e ABI de cada binário nativo, carrega
 * (LoadLibrary/dlopen) e devolve um PluginModule. NÃO cria instância, NÃO registra factory em
 * ComponentRegistry/McuRegistry — isso é responsabilidade de PluginRuntime (por sessão), a partir
 * do módulo que GlobalPluginCache publica como ativo. Decisão de confiança (TrustStore) acontece
 * inteiramente na Extension, antes do IPC pedir este load — ver
 * .spec/lasecsimul-native-devices.spec, seção 1, 3 e 12.
 */
class PluginLoader {
public:
    /** Varre um diretório de biblioteca (contendo library.json) e carrega cada binário declarado. */
    void scanDirectory(const std::filesystem::path& libraryJsonPath);

    /** Helpers de validação puros, usados por loadDevicePlugin/loadMcuPlugin e por testes. */
    static std::shared_ptr<PluginModule> createDeviceModuleFromExports(
        void* libraryHandle, LsdnGetVTableFn getVTable, const std::filesystem::path& binaryPath);
    static std::shared_ptr<PluginModule> createMcuModuleFromExports(
        void* libraryHandle, LsdnGetMcuVTableFn getVTable, const std::filesystem::path& binaryPath);

    /** Carrega um único binário de dispositivo; recalcula o SHA-256 e confere com o manifesto
     * antes de LoadLibrary (defesa em profundidade — não confia ciegamente na Extension). */
    std::shared_ptr<PluginModule> loadDevicePlugin(const std::filesystem::path& binaryPath);

    /** Carrega um único binário de adaptador de MCU (lsdn_get_mcu_vtable, ver mcu_abi.h). */
    std::shared_ptr<PluginModule> loadMcuPlugin(const std::filesystem::path& binaryPath);
};

} // namespace lasecsimul::plugins
