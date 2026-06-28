#pragma once

#include <optional>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include "CircuitGroup.hpp"
#include "Netlist.hpp"
#include "lasecsimul/IComponentModel.hpp"

namespace lasecsimul::simulation {

/**
 * Implementação real de MnaMatrixView, vinculada a UM componente específico — todos os pinos de
 * um componente caem no mesmo CircuitGroup por construção (passada 2 do Netlist garante isso), por
 * isso esta view só precisa de uma referência a esse grupo + o mapa local pinId -> índice nele.
 *
 * `extraVarBase`, quando presente, é a linha/coluna (dentro do MESMO grupo, depois das linhas de
 * nó) onde a corrente de ramo deste componente vive — alocada uma vez no rebuild de topologia
 * (Netlist::rebuildTopology), nunca aqui. addVoltageSource() assume 1 variável extra (a própria);
 * componentes com mais de uma fonte/incógnita por instância não são cobertos ainda.
 */
class ComponentMatrixView final : public lasecsimul::MnaMatrixView {
public:
    ComponentMatrixView(CircuitGroup& group, const std::unordered_map<std::string, uint32_t>& localIndexByPinId,
                         std::optional<uint32_t> extraVarBase = std::nullopt)
        : m_group(group), m_localIndexByPinId(localIndexByPinId), m_extraVarBase(extraVarBase) {}

    ComponentMatrixView(CircuitGroup& group, const std::unordered_map<std::string, uint32_t>& localIndexByPinId,
                         uint32_t stampOwnerId, std::optional<uint32_t> extraVarBase = std::nullopt)
        : m_group(group), m_localIndexByPinId(localIndexByPinId), m_extraVarBase(extraVarBase),
          m_stampOwnerId(stampOwnerId),
          m_pendingAdmittance(Eigen::MatrixXd::Zero(static_cast<Eigen::Index>(group.totalSize()),
                                                    static_cast<Eigen::Index>(group.totalSize()))),
          m_pendingRhs(Eigen::VectorXd::Zero(static_cast<Eigen::Index>(group.totalSize()))) {}

    void commit() {
        if (!m_stampOwnerId || m_committed) return;
        m_group.replaceStamp(*m_stampOwnerId, m_pendingAdmittance, m_pendingRhs);
        m_committed = true;
    }

    void addConductance(const Pin& a, const Pin& b, double siemens) override {
        const uint32_t ia = localIndex(a);
        const uint32_t ib = localIndex(b);
        Eigen::MatrixXd& admittance = writableAdmittance();
        admittance(ia, ia) += siemens;
        admittance(ib, ib) += siemens;
        admittance(ia, ib) -= siemens;
        admittance(ib, ia) -= siemens;
    }

    void addCurrent(const Pin& a, const Pin& b, double amperes) override {
        const uint32_t ia = localIndex(a);
        const uint32_t ib = localIndex(b);
        Eigen::VectorXd& rhs = writableRhs();
        rhs(ia) -= amperes;
        rhs(ib) += amperes;
    }

    void addConductanceToGround(const Pin& pin, double siemens) override {
        const uint32_t i = localIndex(pin);
        writableAdmittance()(i, i) += siemens; // só diagonal — pino "puxado" pra referência, não pra outro pino
    }

    void addCurrentToGround(const Pin& pin, double amperes) override {
        const uint32_t i = localIndex(pin);
        writableRhs()(i) += amperes; // sem termo simétrico: o outro lado é a terra global, fora da matriz
    }

    void addVoltageSource(const Pin& a, const Pin& b, double volts) override {
        if (!m_extraVarBase) {
            throw std::runtime_error("addVoltageSource chamado por componente sem extraVariableCount() > 0");
        }
        const uint32_t ia = localIndex(a);
        const uint32_t ib = localIndex(b);
        const uint32_t ik = *m_extraVarBase; // linha/coluna da corrente de ramo desta fonte

        Eigen::MatrixXd& admittance = writableAdmittance();
        // Estampagem MNA padrão: i flui de a (+) pra b (-) através da fonte.
        admittance(ia, ik) += 1.0; // KCL em a: corrente saindo pelo ramo da fonte
        admittance(ib, ik) -= 1.0; // KCL em b: corrente entrando pelo ramo da fonte
        admittance(ik, ia) += 1.0; // equação do ramo: V_a
        admittance(ik, ib) -= 1.0; // equação do ramo: - V_b
        writableRhs()(ik) = volts; // V_a - V_b = volts
    }

    double getNodeVoltage(const Pin& pin) const override {
        return m_group.valueOf(localIndex(pin));
    }

    double getBranchCurrent() const override {
        if (!m_extraVarBase) {
            throw std::runtime_error("getBranchCurrent chamado por componente sem extraVariableCount() > 0");
        }
        return m_group.valueOf(*m_extraVarBase);
    }

private:
    uint32_t localIndex(const Pin& pin) const {
        auto it = m_localIndexByPinId.find(pin.id);
        if (it == m_localIndexByPinId.end()) {
            throw std::runtime_error("Pin desconhecido nesta view: " + pin.id);
        }
        return it->second;
    }

    Eigen::MatrixXd& writableAdmittance() {
        return m_stampOwnerId ? m_pendingAdmittance : m_group.admittance();
    }

    Eigen::VectorXd& writableRhs() {
        return m_stampOwnerId ? m_pendingRhs : m_group.rhs();
    }

    CircuitGroup& m_group;
    const std::unordered_map<std::string, uint32_t>& m_localIndexByPinId;
    std::optional<uint32_t> m_extraVarBase;
    std::optional<uint32_t> m_stampOwnerId;
    Eigen::MatrixXd m_pendingAdmittance;
    Eigen::VectorXd m_pendingRhs;
    bool m_committed = false;
};

} // namespace lasecsimul::simulation
