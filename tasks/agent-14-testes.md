# Agente 14 - Testes

## Objetivo

Criar estratégia e infraestrutura mínima de testes do MVP.

## Escopo

Testes unitários, integração, E2E e pipeline mínimo.

## Contexto

O Core deve ser testável headless. A Extension deve usar mocks quando o Core real não for necessário.

## Arquivos que pode criar

- `test/README.md`.
- `test/core/**`.
- `test/extension/**`.
- `test/integration/**`.
- `test/e2e/**`.
- `.github/workflows/ci.yml`, se CI for adotado.
- `extension/src/test/**`.

## Arquivos que pode modificar

- `core/CMakeLists.txt`.
- `extension/package.json`.
- `README.md`.
- `docs/13-testes.md`.

## Arquivos que não pode modificar

- Lógica de produção fora de ajustes mínimos para testabilidade.
- `.spec/**`.

## Dependências

- Todos os agentes de implementação.

## Interfaces obrigatórias

- Testes Core rodam sem VSCode.
- Testes Extension podem mockar Core.
- Testes E2E podem ser marcados como opcionais quando exigirem QEMU.

## Tarefas

- [ ] Escolher framework de teste C++.
- [ ] Escolher framework de teste TS.
- [ ] Configurar testes do Core no CMake.
- [ ] Configurar testes da Extension no `package.json`.
- [ ] Criar fixtures `.lsproj`.
- [ ] Criar mocks de Core.
- [ ] Criar testes de smoke do Core.
- [ ] Criar testes de smoke da Extension.
- [ ] Criar matriz de testes obrigatórios.
- [ ] Criar pipeline mínimo cross-platform.
- [ ] Documentar como rodar testes locais.

## Testes obrigatórios

- [ ] Extension activation.
- [ ] Webview open.
- [ ] Core headless startup.
- [ ] Netlist básico.
- [ ] Scheduler básico.
- [ ] MnaSolver básico.
- [ ] Passivos.
- [ ] IPC handshake.
- [ ] Plugin loader.
- [ ] QEMU fake lifecycle.

## Critérios de aceite

- Um comando roda testes TS.
- Um comando roda testes C++.
- Testes que dependem de QEMU real são separados.
- Falhas produzem mensagem acionável.

## Riscos técnicos

- Testes E2E frágeis demais cedo.
- CI tentando rodar QEMU real sem ambiente.
- Mocks divergirem do protocolo.

## Observações de integração

Sempre que um agente alterar contrato, atualizar teste correspondente ou abrir issue de teste pendente.

## O que não fazer

- Não bloquear testes unitários por QEMU real.
- Não exigir VSCode para testar Core.
- Não ignorar Linux/macOS.
