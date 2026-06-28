# Agente 11 - QEMU Bridge

## Objetivo

Implementar base de ciclo de vida QEMU e ponte de arena compartilhada.

## Escopo

Processo QEMU, arena compartilhada e dispatch MMIO genérico.

## Contexto

QEMU pertence ao Core, não à Extension. A integração segue processo externo, memória compartilhada e dispatch por faixa de endereço.

## Arquivos que pode criar

- `core/src/mcu/qemu/QemuProcessManager.hpp`.
- `core/src/mcu/qemu/QemuProcessManager.cpp`.
- `core/src/mcu/qemu/QemuArenaBridge.hpp`.
- `core/src/mcu/qemu/QemuArenaBridge.cpp`.
- `core/src/mcu/qemu/QemuArenaTypes.hpp` — **struct v1 já definida em
  `core/include/lasecsimul/qemu_arena_abi.h`**, espelho exato do fork real; não redesenhar o layout aqui.
- `core/src/mcu/qemu/FirmwareWatcher.hpp`.
- `core/src/mcu/qemu/FirmwareWatcher.cpp`.
- `test/core/mcu/QemuProcessManagerTest.cpp`.
- `test/core/mcu/QemuArenaBridgeTest.cpp`.
- `test/core/mcu/FirmwareWatcherTest.cpp`.

## Arquivos que pode modificar

- `core/CMakeLists.txt`.
- `core/src/session/SimulationSession.*` para posse do manager.
- `core/include/lasecsimul/IMcuAdapter.hpp` em acordo com agente 12.

## Arquivos que não pode modificar

- `extension/**`.
- `core/src/simulation/MnaSolver.*`.
- `devices/**`.

## Dependências

- Agente 04 para lifecycle.
- Agente 12 para adapter ESP32.

## Interfaces obrigatórias

- `QemuProcessManager::start`.
- `QemuProcessManager::stop`.
- `QemuProcessManager::kill`.
- `QemuProcessManager::logs`.
- `QemuArenaBridge::open`.
- `QemuArenaBridge::poll`.
- Dispatch por `MemoryRegion`.
- `FirmwareWatcher::poll(folder)` — devolve o caminho do artefato (`.bin`/`.elf`/`.hex`) de `mtime` mais
  recente na pasta, ou nada se não mudou desde a última chamada. Chamado no mesmo timer que já dispara
  `qemuTime` — sem thread dedicada nova.

## Tarefas

- [x] Definir struct de arena v1 — `core/include/lasecsimul/qemu_arena_abi.h`, já feito, não refazer.
- [ ] Isolar shared memory por plataforma.
- [ ] Implementar start de processo QEMU.
- [ ] Implementar stop com timeout.
- [ ] Implementar kill.
- [ ] Capturar stdout/stderr.
- [ ] Implementar abertura/fechamento da arena.
- [ ] Implementar poll de eventos.
- [ ] Implementar dispatch por faixa de endereço.
- [ ] Implementar `FirmwareWatcher::poll` (polling de `mtime`, não API nativa de evento por SO).
- [ ] Ligar `FirmwareWatcher` ao mesmo caminho de kill+respawn já usado pelo reset — recarregar firmware
  nunca é um caso especial separado.
- [ ] Criar testes com processo fake.
- [ ] Criar testes de timeout.
- [ ] Criar teste de `FirmwareWatcher` com múltiplos artefatos na pasta (vence o mais recente).

## Testes obrigatórios

- [ ] Iniciar processo fake.
- [ ] Parar processo fake.
- [ ] Matar processo travado.
- [ ] Abrir arena fake.
- [ ] Despachar endereço para região correta.
- [ ] Erro de firmware inexistente.

## Critérios de aceite

- QEMU não é iniciado pela Extension.
- API é cross-platform.
- Falhas retornam erros acionáveis.

## Riscos técnicos

- Busy wait consumir CPU sem controle.
- ~~Arena sem versionamento~~ — decisão já tomada: versionamento fica no campo `qemuBuild` do manifesto do
  adapter (`mcu.json`), nunca dentro da struct (inserir campo ali quebraria o binário já compilado). Não
  reabrir essa decisão sem necessidade real.
- Handle de processo vazar no Windows.
- `FirmwareWatcher` reagir a escrita parcial (toolchain ainda gravando o artefato) — mitigado pelo próprio
  intervalo de polling, sem debounce explícito (ver seção 8.3 do `.spec`); se isso se mostrar insuficiente na
  prática, voltar aqui antes de inventar um mecanismo novo.

## Observações de integração

O adapter do agente 12 deve fornecer argumentos e regiões. Este agente não conhece detalhes da ESP32.

## O que não fazer

- Não implementar CPU de MCU.
- Não criar protocolo QMP completo no MVP.
- Não fazer dispatch linear se a tabela puder ser ordenada.
