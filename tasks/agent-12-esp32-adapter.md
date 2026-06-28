# Agente 12 - ESP32 Adapter

## Objetivo

Implementar adapter inicial da ESP32 para QEMU e mapear GPIO básico.

## Escopo

Adapter ESP32, launch args, regiões MMIO e mapa de pinos.

## Contexto

A ESP32 roda via QEMU modificado. O adapter descreve launch, MMIO e pinos, não emula CPU.

## Arquivos que pode criar

- `core/src/mcu/esp32/Esp32Adapter.hpp`.
- `core/src/mcu/esp32/Esp32Adapter.cpp`.
- `core/src/mcu/esp32/Esp32MemoryMap.hpp`.
- `test/core/mcu/Esp32AdapterTest.cpp`.

## Arquivos que pode modificar

- `mcu-adapters/espressif-esp32/mcu.json`.
- `mcu-adapters/espressif-esp32/src/Esp32Adapter.cpp`.
- `core/include/lasecsimul/IMcuAdapter.hpp` em acordo com agente 11.
- `core/src/registry/McuRegistry.hpp`.

## Arquivos que não pode modificar

- `extension/**`.
- `core/src/simulation/MnaSolver.*`.
- `devices/**`.

## Dependências

- Agente 11 para QEMU bridge.
- Agente 13 para adapter MCU nativo, se plugin for usado.

## Interfaces obrigatórias

- `chipId`: `espressif.esp32` ou id definido no manifesto.
- `buildLaunchArgs`.
- `getMemoryRegions`.
- `getPinMap`.
- Declaração de dependência de QEMU compatível.

## Tarefas

- [ ] Revisar `mcu.json` existente.
- [ ] Definir regiões MMIO iniciais de GPIO.
- [ ] Definir mapa de pinos GPIO.
- [ ] Implementar argumentos de launch.
- [ ] Declarar firmware esperado.
- [ ] Integrar com `McuRegistry`.
- [ ] Criar teste de geração de argumentos.
- [ ] Criar teste de mapeamento de GPIO.
- [ ] Documentar dependência de QEMU modificado.
- [ ] Planejar teste blink.

## Testes obrigatórios

- [ ] Adapter retorna `chipId`.
- [ ] Args incluem firmware.
- [ ] Região GPIO existe.
- [ ] Pin map contém GPIO de blink.
- [ ] Erro claro quando QEMU não está disponível.

## Critérios de aceite

- Adapter não emula CPU.
- Dependências externas estão documentadas.
- Blink está pronto para rodar quando QEMU compatível existir.

## Riscos técnicos

- Prometer ESP32 sem build QEMU compatível.
- Hardcode de paths locais.
- Misturar protocolo I2C/SPI dentro do adapter.

## Observações de integração

Protocolos de barramento devem ficar em módulos genéricos do Core, não no adapter ESP32.

## O que não fazer

- Não reimplementar Xtensa.
- Não mover QEMU para Extension.
- Não fazer lógica de periférico completa dentro do adapter.
