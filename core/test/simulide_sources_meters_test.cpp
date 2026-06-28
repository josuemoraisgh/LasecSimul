// Teste de integração dos componentes "Fontes"/"Medidores" portados do SimulIDE (ver pasta
// Medidores/Fontes da paleta original) — Battery, Rail, FixedVolt, VoltSource, CurrSource,
// Csource, Clock, Ampmeter. Mesmo padrão de voltage_divider_test.cpp/diode_test.cpp: settleStep()
// chamado direto, sem framework de teste.
#include <array>
#include <cmath>
#include <cstdio>
#include <memory>
#include <optional>
#include "components/meters/Ampmeter.hpp"
#include "components/other/Ground.hpp"
#include "components/passive/Resistor.hpp"
#include "components/sources/Battery.hpp"
#include "components/sources/Clock.hpp"
#include "components/sources/WaveGen.hpp"
#include "components/sources/Csource.hpp"
#include "components/sources/CurrSource.hpp"
#include "components/sources/DcVoltageSource.hpp"
#include "components/sources/FixedVolt.hpp"
#include "components/sources/Rail.hpp"
#include "components/sources/VoltSource.hpp"
#include "plugins/GlobalPluginCache.hpp"
#include "session/SimulationSession.hpp"

using namespace lasecsimul;
using namespace lasecsimul::registry;
using namespace lasecsimul::plugins;
using namespace lasecsimul::session;

namespace {

int failures = 0;

void check(bool ok, const char* label) {
    if (ok) std::printf("OK: %s\n", label);
    else {
        std::fprintf(stderr, "FALHOU: %s\n", label);
        failures++;
    }
}

bool nearlyEqual(double a, double b, double eps) { return std::abs(a - b) < eps; }

/** Leitura de corrente (opção 1 do plano): convenção PASSIVA, validada em
 * voltage_divider_test.cpp -- entrando no primeiro pino listado, saindo no segundo (ou na terra
 * implícita, pros componentes de 1 pino). Fonte fornecendo energia aparece NEGATIVA. */
void checkCurrent(const SimulationSession& session, uint32_t component, double expected, double eps,
                   const char* label) {
    const std::optional<double> current = session.componentCurrent(component);
    if (!current) {
        std::fprintf(stderr, "FALHOU: %s -- current() devolveu nullopt\n", label);
        failures++;
        return;
    }
    check(nearlyEqual(*current, expected, eps), label);
}

ComponentParams withProp(const char* name, double value) {
    ComponentParams p;
    p.properties[name] = value;
    return p;
}

void registerCommon(ComponentRegistry& reg) {
    reg.registerFactory("other.ground", [](const ComponentParams&) { return std::make_unique<components::Ground>(Pin{"pin"}); });
    reg.registerFactory("passive.resistor", [](const ComponentParams& p) {
        return std::make_unique<components::Resistor>(std::array<Pin, 2>{Pin{"p1"}, Pin{"p2"}}, p.property("resistance", 1000.0));
    });
}

void testBatteryDividesVoltageWithInternalResistance() {
    GlobalPluginCache cache;
    SimulationSession session(cache);
    registerCommon(session.components());
    session.components().registerFactory("sources.battery", [](const ComponentParams& p) {
        return std::make_unique<components::Battery>(std::array<Pin, 2>{Pin{"p1"}, Pin{"p2"}}, p.property("voltage", 5.0),
                                                      p.property("resistance", 1.0));
    });

    ComponentParams batteryParams;
    batteryParams.properties["voltage"] = 10.0;
    batteryParams.properties["resistance"] = 1.0; // 1 ohm interno
    const uint32_t battery = session.addComponent("sources.battery", batteryParams);
    const uint32_t load = session.addComponent("passive.resistor", withProp("resistance", 9.0)); // 9 ohm externo
    const uint32_t ground = session.addComponent("other.ground", {});

    session.connectWire(battery, "p1", load, "p1");
    session.connectWire(load, "p2", battery, "p2");
    session.connectWire(battery, "p2", ground, "pin");

    for (int i = 0; i < 50 && session.settleStep(); ++i) {}

    const double voltLoad = session.nodeVoltageOfPin(battery, "p1");
    check(nearlyEqual(voltLoad, 9.0, 1e-3), "Battery: divisor 1ohm interno + 9ohm externo da 9V no terminal");
    // Malha inteira: 10V/(1+9)ohm = 1A. Battery fornecendo energia -> current() negativo.
    checkCurrent(session, battery, -1.0, 1e-3, "Battery: current() = -1A (fornecendo energia pro loop)");
}

void testRailForcesFixedVoltageReferencedToGround() {
    GlobalPluginCache cache;
    SimulationSession session(cache);
    registerCommon(session.components());
    session.components().registerFactory("sources.rail", [](const ComponentParams& p) {
        return std::make_unique<components::Rail>(Pin{"out"}, p.property("voltage", 5.0));
    });

    const uint32_t rail = session.addComponent("sources.rail", withProp("voltage", 3.3));
    const uint32_t load = session.addComponent("passive.resistor", withProp("resistance", 1000.0));
    const uint32_t ground = session.addComponent("other.ground", {});

    session.connectWire(rail, "out", load, "p1");
    session.connectWire(load, "p2", ground, "pin");

    for (int i = 0; i < 50 && session.settleStep(); ++i) {}

    check(nearlyEqual(session.nodeVoltageOfPin(rail, "out"), 3.3, 1e-3), "Rail: pino forcado em 3.3V sem segundo terminal explicito");
    // 3.3V/1k = 3.3mA pra carga; Rail fornecendo -> current() negativo.
    checkCurrent(session, rail, -0.0033, 1e-5, "Rail: current() = -3.3mA (fornecendo pra carga)");
}

void testFixedVoltOnOff() {
    GlobalPluginCache cache;
    SimulationSession session(cache);
    registerCommon(session.components());
    session.components().registerFactory("sources.fixed_volt", [](const ComponentParams& p) {
        return std::make_unique<components::FixedVolt>(Pin{"out"}, p.property("voltage", 5.0), p.property("out", true));
    });

    ComponentParams onParams;
    onParams.properties["voltage"] = 5.0;
    onParams.properties["out"] = true;
    const uint32_t fv = session.addComponent("sources.fixed_volt", onParams);
    const uint32_t load = session.addComponent("passive.resistor", withProp("resistance", 1000.0));
    const uint32_t ground = session.addComponent("other.ground", {});
    session.connectWire(fv, "out", load, "p1");
    session.connectWire(load, "p2", ground, "pin");

    for (int i = 0; i < 50 && session.settleStep(); ++i) {}
    check(nearlyEqual(session.nodeVoltageOfPin(fv, "out"), 5.0, 1e-3), "FixedVolt ligado: forca 5V");
    checkCurrent(session, fv, -0.005, 1e-5, "FixedVolt ligado: current() = -5mA (5V/1k pra carga)");

    session.setProperty(fv, "out", PropertyValue{false});
    for (int i = 0; i < 50 && session.settleStep(); ++i) {}
    check(nearlyEqual(session.nodeVoltageOfPin(fv, "out"), 0.0, 1e-3), "FixedVolt desligado: pino flutua, resolvido em 0V pelo solver");
    checkCurrent(session, fv, 0.0, 1e-9, "FixedVolt desligado: current() = 0 (sem contribuicao real)");
}

void testVoltSourceReflectsValueProperty() {
    GlobalPluginCache cache;
    SimulationSession session(cache);
    registerCommon(session.components());
    session.components().registerFactory("sources.voltage_source", [](const ComponentParams& p) {
        return std::make_unique<components::VoltSource>(Pin{"out"}, p.property("value", 5.0), p.property("minValue", 0.0),
                                                         p.property("maxValue", 10.0));
    });

    ComponentParams params;
    params.properties["value"] = 7.0;
    params.properties["minValue"] = 0.0;
    params.properties["maxValue"] = 10.0;
    const uint32_t vs = session.addComponent("sources.voltage_source", params);
    const uint32_t load = session.addComponent("passive.resistor", withProp("resistance", 1000.0));
    const uint32_t ground = session.addComponent("other.ground", {});
    session.connectWire(vs, "out", load, "p1");
    session.connectWire(load, "p2", ground, "pin");

    for (int i = 0; i < 50 && session.settleStep(); ++i) {}
    check(nearlyEqual(session.nodeVoltageOfPin(vs, "out"), 7.0, 1e-3), "VoltSource: value=7V dentro de [0,10] aplicado ao pino");
    checkCurrent(session, vs, -0.007, 1e-5, "VoltSource: current() = -7mA (7V/1k pra carga)");
}

void testCurrSourceDrivesKnownCurrentThroughResistor() {
    GlobalPluginCache cache;
    SimulationSession session(cache);
    registerCommon(session.components());
    session.components().registerFactory("sources.current_source", [](const ComponentParams& p) {
        return std::make_unique<components::CurrSource>(Pin{"out"}, p.property("value", 1.0), p.property("minValue", 0.0),
                                                         p.property("maxValue", 1.0));
    });

    ComponentParams params;
    params.properties["value"] = 0.01; // 10mA
    params.properties["minValue"] = 0.0;
    params.properties["maxValue"] = 0.01;
    const uint32_t cs = session.addComponent("sources.current_source", params);
    const uint32_t load = session.addComponent("passive.resistor", withProp("resistance", 1000.0)); // 1k
    const uint32_t ground = session.addComponent("other.ground", {});
    session.connectWire(cs, "out", load, "p1");
    session.connectWire(load, "p2", ground, "pin");

    for (int i = 0; i < 50 && session.settleStep(); ++i) {}
    // V = I*R = 0.01 * 1000 = 10V
    check(nearlyEqual(session.nodeVoltageOfPin(cs, "out"), 10.0, 1e-2), "CurrSource: 10mA por 1k produz 10V (Ohm)");
    checkCurrent(session, cs, -0.01, 1e-9, "CurrSource: current() = -10mA (constante, independente da carga)");
}

void testCsourceVoltageControlledCurrentSource() {
    GlobalPluginCache cache;
    SimulationSession session(cache);
    registerCommon(session.components());
    session.components().registerFactory("sources.dc_voltage", [](const ComponentParams& p) {
        return std::make_unique<components::DcVoltageSource>(std::array<Pin, 2>{Pin{"p1"}, Pin{"p2"}}, p.property("voltage", 5.0));
    });
    session.components().registerFactory("sources.controlled_source", [](const ComponentParams& p) {
        return std::make_unique<components::Csource>(
            std::array<Pin, 4>{Pin{"cp"}, Pin{"cm"}, Pin{"s1"}, Pin{"s2"}}, p.property("controlPins", true),
            p.property("currSource", true), p.property("currControl", false), p.property("gain", 1.0),
            p.property("voltage", 5.0), p.property("current", 1.0));
    });

    // Fonte de controle: 2V entre cp/cm. Csource em modo VCCS com gain=0.01 (transcondutancia 0.01 A/V)
    // deveria injetar 0.02A em s1/s2 -- por um resistor de 100ohm, V = 0.02*100 = 2V.
    const uint32_t controlSource = session.addComponent("sources.dc_voltage", withProp("voltage", 2.0));
    ComponentParams csourceParams;
    csourceParams.properties["controlPins"] = true;
    csourceParams.properties["currSource"] = true;
    csourceParams.properties["currControl"] = false;
    csourceParams.properties["gain"] = 0.01;
    const uint32_t csource = session.addComponent("sources.controlled_source", csourceParams);
    const uint32_t load = session.addComponent("passive.resistor", withProp("resistance", 100.0));
    const uint32_t ground = session.addComponent("other.ground", {});

    session.connectWire(controlSource, "p1", csource, "cp");
    session.connectWire(controlSource, "p2", csource, "cm");
    session.connectWire(controlSource, "p2", ground, "pin");
    session.connectWire(csource, "s1", load, "p1");
    session.connectWire(csource, "s2", load, "p2");
    session.connectWire(csource, "s2", ground, "pin");

    for (int i = 0; i < 100 && session.settleStep(); ++i) {}

    const double vS1 = session.nodeVoltageOfPin(csource, "s1");
    const double vS2 = session.nodeVoltageOfPin(csource, "s2");
    std::printf("[info] Csource VCCS: Vs1=%.6f Vs2=%.6f (esperado ~2V de diferenca)\n", vS1, vS2);
    check(nearlyEqual(vS1 - vS2, 2.0, 0.05), "Csource (VCCS): 2V de controle * gain 0.01 * 100ohm = 2V na saida");
    checkCurrent(session, csource, -0.02, 1e-3, "Csource: current() = -20mA (gain*Vcontrol fornecida pra carga)");
}

void testAmpmeterMeasuresSeriesCurrentAndForwardsToOutputPin() {
    GlobalPluginCache cache;
    SimulationSession session(cache);
    registerCommon(session.components());
    session.components().registerFactory("sources.dc_voltage", [](const ComponentParams& p) {
        return std::make_unique<components::DcVoltageSource>(std::array<Pin, 2>{Pin{"p1"}, Pin{"p2"}}, p.property("voltage", 5.0));
    });
    session.components().registerFactory("meters.ampmeter", [](const ComponentParams& p) {
        return std::make_unique<components::Ampmeter>(std::array<Pin, 3>{Pin{"lPin"}, Pin{"rPin"}, Pin{"outPin"}},
                                                       p.property("resistance", 1e-6));
    });

    // 10V numa malha com resistor de 1k em serie com o amperimetro (quase ideal): I ~ 10mA.
    const uint32_t source = session.addComponent("sources.dc_voltage", withProp("voltage", 10.0));
    const uint32_t r1 = session.addComponent("passive.resistor", withProp("resistance", 1000.0));
    const uint32_t amp = session.addComponent("meters.ampmeter", {});
    const uint32_t ground = session.addComponent("other.ground", {});

    session.connectWire(source, "p1", r1, "p1");
    session.connectWire(r1, "p2", amp, "lPin");
    session.connectWire(amp, "rPin", source, "p2");
    session.connectWire(source, "p2", ground, "pin");

    for (int i = 0; i < 50 && session.settleStep(); ++i) {}

    const double current = (session.nodeVoltageOfPin(source, "p1") - session.nodeVoltageOfPin(amp, "rPin")) / 1000.0;
    check(nearlyEqual(current, 0.01, 1e-4), "Ampmeter: 10V/1k produz ~10mA na malha");

    // outPin deve refletir a corrente medida como tensao analogica (mesmo papel do Meter::m_outPin do SimulIDE).
    const double outVoltage = session.nodeVoltageOfPin(amp, "outPin");
    check(nearlyEqual(outVoltage, current, 1e-4), "Ampmeter: outPin reflete a corrente medida como tensao analogica");
    checkCurrent(session, amp, 0.01, 1e-4, "Ampmeter: current() = +10mA (lPin->rPin, mesmo valor de outPin)");
}

void testClockTogglesOverTime() {
    GlobalPluginCache cache;
    SimulationSession session(cache);
    registerCommon(session.components());
    session.components().registerFactory("sources.clock", [&session](const ComponentParams& p) {
        return std::make_unique<components::Clock>(session.scheduler(), Pin{"out"}, p.property("voltage", 5.0),
                                                    p.property("freqHz", 1000.0), p.property("alwaysOn", true));
    });

    ComponentParams params;
    params.properties["voltage"] = 5.0;
    params.properties["freqHz"] = 1000.0; // periodo 1ms, half-period 500us = 500.000ns
    params.properties["alwaysOn"] = true;
    const uint32_t clock = session.addComponent("sources.clock", params);
    const uint32_t load = session.addComponent("passive.resistor", withProp("resistance", 1000.0));
    const uint32_t ground = session.addComponent("other.ground", {});
    session.connectWire(clock, "out", load, "p1");
    session.connectWire(load, "p2", ground, "pin");

    for (int i = 0; i < 50 && session.settleStep(); ++i) {}
    const double v0 = session.nodeVoltageOfPin(clock, "out");

    session.scheduler().runUntil(600000); // avanca 600us, passou o primeiro half-period (500us)
    for (int i = 0; i < 50 && session.settleStep(); ++i) {}
    const double v1 = session.nodeVoltageOfPin(clock, "out");

    std::printf("[info] Clock: v0=%.3f v1=%.3f apos avancar 600us (half-period=500us)\n", v0, v1);
    check(!nearlyEqual(v0, v1, 0.5), "Clock: alterna de estado apos meio periodo (auto-agendado via Scheduler)");
    // Depois do toggle, v1 deveria estar no nivel alto (5V) -- 5V/1k = -5mA fornecida pra carga.
    checkCurrent(session, clock, -0.005, 1e-4, "Clock: current() = -5mA no nivel alto (5V/1k pra carga)");
}

void testWaveGenSquareWaveOutputsExpectedVoltageAndCurrent() {
    GlobalPluginCache cache;
    SimulationSession session(cache);
    registerCommon(session.components());
    session.components().registerFactory("sources.wave_gen", [&session](const ComponentParams& p) {
        return std::make_unique<components::WaveGen>(session.scheduler(), std::array<Pin, 2>{Pin{"out"}, Pin{"gnd"}},
                                                      p.property("freqHz", 1000.0));
    });

    // waveType=Square, semiAmplitude/midVoltage/duty/bipolar/floating nos defaults (2.5V, 0V, 50%,
    // false, false) -- vOut=1 na primeira amostra (fase 0 < duty), então alvo = voltBase +
    // semiAmplitude*2*1 = -2.5 + 5 = 2.5V. waveType não dá pra passar no construtor (só freqHz) --
    // mesmo caminho que a Extension usa via "setProperty" depois do addComponent.
    const uint32_t wave = session.addComponent("sources.wave_gen", withProp("freqHz", 1000.0));
    const auto waveTypeError = session.setProperty(wave, "waveType", PropertyValue{std::string("Square")});
    check(!waveTypeError.has_value(), "WaveGen: setProperty aceita waveType=Square");
    if (waveTypeError) std::printf("[info] WaveGen setProperty erro: %s\n", waveTypeError->c_str());
    const uint32_t load = session.addComponent("passive.resistor", withProp("resistance", 1000.0));
    const uint32_t ground = session.addComponent("other.ground", {});
    session.connectWire(wave, "out", load, "p1");
    session.connectWire(load, "p2", ground, "pin");

    for (int i = 0; i < 50 && session.settleStep(); ++i) {}

    const double voltOut = session.nodeVoltageOfPin(wave, "out");
    std::printf("[info] WaveGen square (1a amostra): V_out=%.6f\n", voltOut);
    check(nearlyEqual(voltOut, 2.5, 1e-2), "WaveGen: onda quadrada na 1a amostra fica no nivel alto (2.5V)");
    // 2.5V/1k = 2.5mA fornecida pra carga -> current() negativo.
    checkCurrent(session, wave, -0.0025, 1e-4, "WaveGen: current() = -2.5mA no nivel alto");
}

} // namespace

int main() {
    testBatteryDividesVoltageWithInternalResistance();
    testRailForcesFixedVoltageReferencedToGround();
    testFixedVoltOnOff();
    testVoltSourceReflectsValueProperty();
    testCurrSourceDrivesKnownCurrentThroughResistor();
    testCsourceVoltageControlledCurrentSource();
    testAmpmeterMeasuresSeriesCurrentAndForwardsToOutputPin();
    testClockTogglesOverTime();
    testWaveGenSquareWaveOutputsExpectedVoltageAndCurrent();

    if (failures == 0) {
        std::printf("\nTodos os testes de Fontes/Medidores SimulIDE passaram.\n");
        return 0;
    }
    std::fprintf(stderr, "\n%d teste(s) FALHARAM.\n", failures);
    return 1;
}
