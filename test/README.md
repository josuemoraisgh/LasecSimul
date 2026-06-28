# Testes do LasecSimul

## Objetivo

Ponto de entrada único para localizar e executar os testes do projeto. Este diretório não duplica a
estratégia descrita em [`docs/13-testes.md`](../docs/13-testes.md) — apenas organiza onde cada categoria
de teste mora e como rodá-la a partir da raiz do repositório.

## Estrutura

```
test/
├── core/         # Testes do processo nativo C++ que não compilam junto do binário principal do
│                 # Core (registrados em core/CMakeLists.txt via add_executable+add_test, mas com
│                 # sources em test/core/, não core/test/core/ — ver nota abaixo). Cobre Netlist,
│                 # UnionFind, Scheduler, SparseSet e componentes passivos.
├── extension/    # Testes da camada TypeScript (CoreClient.test.ts fica colocado em
│                 # extension/src/ipc/ por convenção; ProjectSerializer.test.ts fica aqui).
├── fixtures/     # Projetos .lsproj fixos usados pelos testes de serialização.
├── integration/  # Testes que cruzam Extension + Core via IPC real (não mockado), sem UI.
└── e2e/          # Testes ponta a ponta: VSCode + Core + (quando aplicável) QEMU. Ainda vazio
                  # (sem harness @vscode/test-electron) — ver docs/mvp-limitacoes.md.
```

Existe também `core/test/`, com testes que SÃO acoplados ao binário do Core (CoreBootstrap,
CircuitGroup, MnaSolver, plugins, QEMU, ESP32) — ambas as pastas de teste C++ são registradas no
mesmo `core/CMakeLists.txt` e rodam juntas via `ctest`. Ver
[`docs/04-divisao-por-agentes.md`](../docs/04-divisao-por-agentes.md) para quem é dono de cada área;
agente 14 é o dono da estratégia de testes, agentes de funcionalidade adicionam casos à medida que
implementam.

## Como rodar

Os comandos abaixo funcionam em Windows, Linux e macOS (PowerShell ou shell POSIX).

### Core (C++, via CTest)

```
cmake -S core -B core/build
cmake --build core/build
ctest --test-dir core/build --output-on-failure
```

Se o repositório estiver dentro de uma pasta sincronizada por um cliente de nuvem (Google Drive,
OneDrive, Dropbox), aponte `-B` para um caminho local fora da pasta sincronizada (ex:
`cmake -S core -B C:\ls-build`) e use o preset `windows-msvc` de `core/CMakePresets.json` em vez do
gerador Ninja padrão — Ninja Multi-Config entra em loop de "manifest still dirty" e o
`FetchContent` pode falhar com erro de acesso negado nesse tipo de pasta. Ver
`docs/mvp-limitacoes.md`.

### Extension (TypeScript)

```
cd extension
npm install
npm test
```

`npm test` compila Extension Host + Webview, compila os testes (`tsconfig.test.json`) e roda
`ProjectSerializer.test.ts` e `CoreClient.test.ts` (handshake, timeout, shutdown, crash do Core).

### Agregado (raiz)

Ver [`scripts/`](../scripts/) e os scripts `test:*` do `package.json` da raiz para rodar tudo de uma vez.

### Integração e E2E

Ainda sem executável próprio nem harness de VSCode (`@vscode/test-electron`) — ver
`docs/mvp-limitacoes.md`. O fluxo de integração Extension↔Core (handshake, `addComponent`,
`connectWire`, `setProperty`, `start`/`stop`, `shutdown`) foi validado manualmente contra o binário
real do Core usando `examples/mvp-passive.lsproj` como projeto de exemplo — formalizar isso como
teste automatizado em `test/integration/` é o próximo passo, reaproveitando os binários já
produzidos pelos comandos acima, sem introduzir um terceiro sistema de build.
