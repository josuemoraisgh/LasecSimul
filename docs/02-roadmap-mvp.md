# 02 - Roadmap MVP

## Objetivo

Organizar a entrega do MVP em fases integráveis.

## Escopo

Roadmap operacional para implementação paralela. Não substitui as tarefas detalhadas em `tasks/`.

## Fase 1 - Estrutura e bootstrap

- Consolidar layout `extension/`, `core/`, `devices/`, `mcu-adapters/`, `project/` e `test/`.
- Garantir scripts de build da Extension e do Core.
- Criar infraestrutura mínima de testes.
- Confirmar que `lasecsimul-core` inicia em modo headless.

## Fase 2 - Extension e IPC

- Implementar comandos VSCode.
- Abrir Webview inicial.
- Criar `CoreClient` com start/stop/handshake.
- Criar `IpcServer` no Core.
- Definir mensagens mínimas: `hello`, `createProject`, `loadProject`, `applyChange`, `start`, `pause`, `stop`, `shutdown`.

## Fase 3 - Projeto `.lsproj` e UI inicial

- Definir schema v1 do `.lsproj`.
- Implementar serialização/desserialização.
- Adicionar resistor, capacitor e indutor na paleta (`TreeView` nativo do VSCode, não Webview — seção 13 do
  `.spec`).
- Conectar fios e editar propriedades (painel persistente alimentado por `propertyDescriptors()`, seção 6.1
  do `.spec` — não modal).
- Enviar snapshot ao Core.

## Fase 4 - Core de simulação

- Finalizar `Netlist`, `UnionFind`, nós e grupos.
- Finalizar `Scheduler` com `SparseSet` e `std::priority_queue`.
- Completar `MnaSolver` com Eigen.
- Implementar passivos R/C/L e testes elétricos.

## Fase 5 - Plugins nativos

- Validar `device_abi.h`.
- Completar `PluginLoader`, `PluginModule`, `PluginRuntime` e proxies.
- Criar exemplo nativo mínimo.
- Testar versioned swap e não descarregar módulo com instância viva.

## Fase 6 - QEMU/ESP32

- Criar `QemuProcessManager`.
- Criar `QemuArenaBridge` (formato da arena já fixado em `qemu_arena_abi.h`, espelho exato do fork real).
- Criar `FirmwareWatcher`: usuário associa uma pasta, não um arquivo fixo; recarrega automaticamente quando o
  artefato muda, reaproveitando o mesmo kill+respawn do reset — nunca exige ação manual (seção 8.3 do
  `.spec`).
- Definir `IMcuAdapter` e `Esp32Adapter` inicial.
- Documentar dependência de QEMU modificado — **já verificada, não hipotética**: fork real em
  `G:\Meu Drive\SourceCode\qemu-simulide-1`, GPIO output/input funcionando pro ESP32 (seção 8.2 do `.spec`).
- Testar ciclo start/stop/kill e blink — bloqueio atual é o pipeline (`QemuProcessManager`/`QemuArenaBridge`
  ainda não implementados), não mais incerteza de compatibilidade.

## Fase 7 - Integração final

- Rodar Extension + Core + Webview.
- Salvar e reabrir `.lsproj`.
- Simular circuito passivo.
- Validar IPC, testes e limitações do MVP.
