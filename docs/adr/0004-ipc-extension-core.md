# ADR 0004 - IPC Extension/Core

## Objetivo

Registrar o contrato de comunicação entre Extension e Core.

## Escopo

IPC de controle e fronteira entre processos.

## Status

Aceita

## Contexto

A Extension e o Core são processos distintos. A UI precisa comandar simulação e receber estado sem bloquear o VSCode.

## Decisão

Toda comunicação Extension/Core passa por `CoreClient` no lado TypeScript e `IpcServer` no lado C++. O protocolo deve ter handshake versionado.

## Alternativas consideradas

- UI acessando Core diretamente: impossível e proibido pela separação de processos.
- Webview falando com Core diretamente: descartado por segurança, acoplamento e controle de ciclo de vida.
- Solver chamando Extension durante simulação: descartado por violar o caminho crítico.

## Consequências

- O IPC carrega comandos, snapshots, erros e eventos discretos.
- Telemetria contínua pode usar canal separado e lossy.
- Testes podem mockar Core no lado Extension.

## Impacto no projeto

Qualquer novo comando externo deve entrar no protocolo e passar por `CoreClient`.
