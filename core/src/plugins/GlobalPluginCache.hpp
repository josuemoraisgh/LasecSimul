#pragma once

#include <memory>
#include <string>
#include <unordered_map>
#include <vector>
#include "PluginLoader.hpp"
#include "PluginModule.hpp"
#include "../registry/ComponentMetadataRegistry.hpp"

namespace lasecsimul::plugins {

/**
 * Estado compartilhado entre sessões (hoje só existe uma SimulationSession por processo, ver
 * .spec/lasecsimul.spec seção 4) — qual PluginModule é a versão ativa por typeId/chipId, e o
 * catálogo de metadados de UI. Nunca mutado fora de loadLibrary/setActive*Module; sessões só leem
 * activeDeviceModule/activeMcuModule ao criar uma instância nova.
 */
class GlobalPluginCache {
public:
    PluginLoader& loader() { return m_loader; }
    registry::ComponentMetadataRegistry& metadata() { return m_metadata; }

    /** Versioned swap (ver .spec/lasecsimul-native-devices.spec, seção 3): publica qual módulo é
     * usado por NOVAS instâncias a partir de agora. Instâncias já criadas mantêm seu próprio
     * shared_ptr para o módulo antigo — nunca são afetadas por esta chamada. */
    void setActiveDeviceModule(std::string typeId, std::shared_ptr<PluginModule> module) {
        m_deviceModules[std::move(typeId)] = std::move(module);
    }
    void setActiveMcuModule(std::string chipId, std::shared_ptr<PluginModule> module) {
        m_mcuModules[std::move(chipId)] = std::move(module);
    }

    std::shared_ptr<PluginModule> activeDeviceModule(const std::string& typeId) const {
        auto it = m_deviceModules.find(typeId);
        return it != m_deviceModules.end() ? it->second : nullptr;
    }
    std::shared_ptr<PluginModule> activeMcuModule(const std::string& chipId) const {
        auto it = m_mcuModules.find(chipId);
        return it != m_mcuModules.end() ? it->second : nullptr;
    }

    /** typeIds com PluginModule ativo — usado por SimulationSession::registerKnownPluginTypes(). */
    std::vector<std::string> knownDeviceTypeIds() const {
        std::vector<std::string> ids;
        ids.reserve(m_deviceModules.size());
        for (const auto& [typeId, module] : m_deviceModules) ids.push_back(typeId);
        return ids;
    }

    /** chipIds com PluginModule ativo — usado por SimulationSession::registerKnownMcuTypes(). */
    std::vector<std::string> knownMcuChipIds() const {
        std::vector<std::string> ids;
        ids.reserve(m_mcuModules.size());
        for (const auto& [chipId, module] : m_mcuModules) ids.push_back(chipId);
        return ids;
    }

private:
    PluginLoader m_loader;
    registry::ComponentMetadataRegistry m_metadata;
    std::unordered_map<std::string, std::shared_ptr<PluginModule>> m_deviceModules;
    std::unordered_map<std::string, std::shared_ptr<PluginModule>> m_mcuModules;
};

} // namespace lasecsimul::plugins
