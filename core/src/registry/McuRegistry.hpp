#pragma once

#include <functional>
#include <memory>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include "lasecsimul/IMcuAdapter.hpp"

namespace lasecsimul::registry {

/** Único ponto que liga um chipId a um IMcuAdapter concreto (built-in ou NativeMcuAdapterProxy). */
class McuRegistry {
public:
    using Factory = std::function<std::unique_ptr<IMcuAdapter>()>;

    void registerFactory(std::string chipId, Factory factory) {
        if (m_factories.contains(chipId)) {
            throw std::runtime_error("MCU chipId already registered: " + chipId);
        }
        m_factories.emplace(std::move(chipId), std::move(factory));
    }

    std::unique_ptr<IMcuAdapter> create(const std::string& chipId) const {
        auto it = m_factories.find(chipId);
        if (it == m_factories.end()) {
            throw std::runtime_error("Unknown MCU chipId: " + chipId);
        }
        return it->second();
    }

    bool contains(const std::string& chipId) const {
        return m_factories.contains(chipId);
    }

private:
    std::unordered_map<std::string, Factory> m_factories;
};

} // namespace lasecsimul::registry
