# 01 - Arquitetura Operacional

## Objetivo

Descrever como Extension, UI, Core, plugins, QEMU e projeto `.lsproj` cooperam em tempo de execução.

## Escopo

Arquitetura de execução do MVP. Não define detalhes numéricos completos do solver nem schema final do `.lsproj`.

## Fronteiras

### Extension TypeScript

Responsável por comandos VSCode, ciclo de vida da Webview, serialização de projeto, UX, confiança de plugins e cliente IPC.

Não pode:

- resolver circuito;
- instanciar `MnaSolver`;
- abrir arena QEMU;
- carregar DLL/SO diretamente;
- importar código C++.

### Core C++

Responsável por `SimulationSession`, `Netlist`, `Scheduler`, `MnaSolver`, registries, plugins nativos e QEMU.

Não pode:

- depender de VSCode;
- depender de Qt;
- enviar chamadas de solver para a Extension;
- atravessar a ABI de plugin com STL, exceções ou RTTI.

### UI/Webview

Responsável por edição visual. Envia intenções para o Extension Host por `postMessage`. O Extension Host traduz para comandos do `CoreClient`. **Nem toda UI é Webview**: paleta de componentes é `TreeView` nativo do VSCode, navegador de arquivo e editor de código não existem no LasecSimul (redundante com o VSCode / compilação é sempre externa). Mapeamento completo SimulIDE → LasecSimul em `lasecsimul.spec`, seção 13.

### IPC

O `CoreClient` é o único cliente permitido no lado TS. O `IpcServer` é o único servidor permitido no Core. O protocolo deve ter handshake com `protocolVersion`.

### Plugins nativos

Plugins são DLL/SO carregadas em processo pelo Core. `PluginLoader` carrega código, `GlobalPluginCache` publica módulos ativos, `PluginRuntime` cria instâncias por sessão e `NativeDeviceProxy` adapta a vtable C para `IComponentModel`.

### QEMU

QEMU roda como processo externo. O Core inicia, encerra e reinicia o processo por `QemuProcessManager`. A troca quente ocorre por `QemuArenaBridge` usando memória compartilhada e dispatch por faixa de endereço.

## Fluxo principal

1. Usuário abre o comando `lasecsimul.openSchematicEditor`.
2. Extension cria Webview e inicializa `CoreClient`.
3. `CoreClient` inicia o processo `lasecsimul-core`.
4. Extension faz handshake de protocolo com o Core.
5. Usuário edita o esquemático na Webview.
6. Extension salva estado visual/projeto `.lsproj` e envia mudanças relevantes ao Core.
7. Core atualiza `SimulationSession`, reconstrói `Netlist` quando topologia muda e roda `Scheduler`.
8. `MnaSolver` resolve grupos dirty usando Eigen.
9. Telemetria volta para Extension por canal apropriado.

## Decisões que não devem ser reabertas sem ADR

- Extension em TypeScript.
- Core em C++ nativo separado.
- Sem Qt.
- Sem WASM ativo.
- Sem CPU de MCU reimplementada manualmente.
- Plugins nativos em processo, sem sandbox como caminho padrão.
- Solver MNA com Eigen.
- Scheduler com estruturas planas.
