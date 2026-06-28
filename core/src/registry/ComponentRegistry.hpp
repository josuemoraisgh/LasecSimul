#pragma once

#include <functional>
#include <memory>
#include <string>
#include <unordered_map>
#include "ComponentParams.hpp"
#include "lasecsimul/IComponentModel.hpp"

namespace lasecsimul::registry {

/** Único ponto que liga um typeId a uma implementação concreta (built-in ou NativeDeviceProxy). */
class ComponentRegistry {
public:
    using Factory = std::function<std::unique_ptr<IComponentModel>(const ComponentParams&)>;

    void registerFactory(std::string typeId, Factory factory) {
        if (m_factories.contains(typeId)) {
            throw std::runtime_error("Component typeId already registered: " + typeId);
        }
        m_factories.emplace(std::move(typeId), std::move(factory));
    }

    void replaceFactory(std::string typeId, Factory factory) {
        m_factories[std::move(typeId)] = std::move(factory);
    }

    std::unique_ptr<IComponentModel> create(const std::string& typeId, const ComponentParams& params) const {
        auto it = m_factories.find(typeId);
        if (it == m_factories.end()) {
            throw std::runtime_error("Unknown component typeId: " + typeId);
        }
        return it->second(params);
    }

    bool contains(const std::string& typeId) const {
        return m_factories.contains(typeId);
    }

private:
    std::unordered_map<std::string, Factory> m_factories;
};

} // namespace lasecsimul::registry
