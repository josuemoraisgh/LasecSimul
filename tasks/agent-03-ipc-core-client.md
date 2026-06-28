# Agente 03 - IPC e CoreClient

## Objetivo

Definir e implementar o cliente IPC da Extension e o protocolo mínimo Extension/Core.

## Escopo

Canal de controle Extension/Core, framing, handshake e tratamento de erro.

## Contexto

Toda comunicação passa por `CoreClient`. O caminho crítico do solver não passa por IPC.

## Arquivos que pode criar

- `extension/src/ipc/CoreProcess.ts`.
- `extension/src/ipc/protocol.ts`.
- `extension/src/ipc/CoreClient.test.ts`.
- `core/src/ipc/IpcServer.hpp`.
- `core/src/ipc/IpcServer.cpp`.
- `core/src/ipc/Protocol.hpp`.

## Arquivos que pode modificar

- `extension/src/ipc/CoreClient.ts`.
- `extension/src/ipc/types.ts`.
- `core/CMakeLists.txt`.
- `core/src/main.cpp` apenas para conectar `IpcServer`.

## Arquivos que não pode modificar

- `core/src/simulation/MnaSolver.hpp`.
- `core/src/simulation/Scheduler.*`.
- `extension/src/ui/webview/*` salvo tipos de mensagem compartilhados.

## Dependências

- Agente 01 para build.
- Agente 04 para bootstrap do Core.

## Interfaces obrigatórias

- `CoreClient.start()`.
- `CoreClient.stop()`.
- `CoreClient.request(message)`.
- `CoreClient.onNotification(handler)`.
- Handshake com `protocolVersion`.

## Tarefas

- [ ] Definir envelope `{ id, type, payload, protocolVersion }`.
- [ ] Definir resposta `{ id, ok, payload, error }`.
- [ ] Implementar start do processo Core.
- [ ] Implementar timeout de request.
- [ ] Implementar shutdown limpo.
- [ ] Implementar mock de Core para testes da Extension.
- [ ] Criar mensagens `hello`, `shutdown`, `loadProject`, `applyChange`, `start`, `pause`, `stop`.
- [ ] Criar `IpcServer` mínimo no Core.
- [ ] Testar erro de protocolo.
- [ ] Testar Core encerrado inesperadamente.

## Testes obrigatórios

- [ ] Extension inicia Core.
- [ ] Handshake compatível passa.
- [ ] Handshake incompatível falha.
- [ ] Timeout retorna erro.
- [ ] Shutdown limpa processo.

## Critérios de aceite

- `CoreClient` é o único ponto de IPC.
- Protocolo é versionado.
- Testes usam mock sem Core real.

## Riscos técnicos

- Deadlock de leitura/escrita.
- Mensagens parciais sem framing.
- Erros de processo órfão no Windows.

## Observações de integração

O transporte pode evoluir, mas o contrato público do `CoreClient` deve permanecer estável para os agentes de UI.

## O que não fazer

- Não implementar solver.
- Não transmitir telemetria de alta frequência pelo canal de controle.
- Não deixar Webview falar direto com Core.
