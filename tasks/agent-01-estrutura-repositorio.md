# Agente 01 - Estrutura do Repositório

## Objetivo

Preparar a estrutura base do projeto para Extension, Core, testes, dispositivos, MCUs e scripts.

## Escopo

Fundação de pastas, build e scripts. Não inclui lógica funcional do simulador.

## Contexto

O LasecSimul usa Extension TypeScript e Core C++ nativo separado. Este agente cria fundação, não implementa solver, UI avançada ou QEMU.

## Arquivos que pode criar

- `package.json` na raiz, se necessário para scripts agregados.
- `CMakePresets.json`.
- `extension/package.json`.
- `extension/tsconfig.json`.
- `core/CMakeLists.txt`.
- `test/README.md`.
- scripts em `scripts/`.

## Arquivos que pode modificar

- `README.md`.
- `core/CMakeLists.txt`.
- `extension/package.json`.
- `extension/tsconfig.json`.

## Arquivos que não pode modificar

- `.spec/*.spec`.
- `.skill/lasecsimul.skill`.
- `core/src/simulation/MnaSolver.hpp`.
- `core/src/simulation/Scheduler.*`.
- `extension/src/ui/webview/*` além de placeholders.

## Dependências

- Specs existentes.
- Decisões ADR 0001 a 0005.

## Interfaces obrigatórias

- Manter `extension/` e `core/` como projetos separados.
- Não criar dependência TypeScript no Core.
- Não criar dependência C++ na Webview.

## Tarefas

- [ ] Confirmar estrutura `extension/`, `core/`, `devices/`, `mcu-adapters/`, `project/`, `test/`.
- [ ] Criar scripts agregados para build da Extension.
- [ ] Criar scripts agregados para build do Core.
- [ ] Configurar CMake C++20.
- [ ] Configurar TypeScript estrito.
- [ ] Preparar diretórios `test/core`, `test/extension`, `test/integration`, `test/e2e`.
- [ ] Documentar comandos de build no README.
- [ ] Garantir que paths funcionem em Windows, Linux e macOS.

## Testes obrigatórios

- [ ] `npm run compile` em `extension/`.
- [ ] `cmake -S core -B core/build`.
- [ ] `cmake --build core/build`.

## Critérios de aceite

- Build da Extension executa.
- Configure do Core executa.
- Estrutura de testes existe.
- Nenhum código de simulação foi implementado por este agente.

## Riscos técnicos

- Scripts acoplados a PowerShell apenas.
- CMake dependente de path absoluto.
- Configuração duplicada entre raiz e subprojetos.

## Observações de integração

Os agentes seguintes dependem de paths estáveis. Evite renomear diretórios depois da primeira integração.

## O que não fazer

- Não implementar solver.
- Não implementar UI do canvas.
- Não implementar QEMU.
- Não propor WASM.
