# Agente 04 - Core Bootstrap

## Objetivo

Inicializar o processo Core, sessão, registries, plugin cache e servidor IPC.

## Escopo

Bootstrap do processo Core e composição inicial. Não inclui modelos elétricos específicos.

## Contexto

O Core é C++ nativo, headless e independente do VSCode.

## Arquivos que pode criar

- `core/src/ipc/IpcServer.*`.
- `core/src/app/CoreApplication.hpp`.
- `core/src/app/CoreApplication.cpp`.
- `test/core/CoreBootstrapTest.cpp`.

## Arquivos que pode modificar

- `core/src/main.cpp`.
- `core/src/session/SimulationSession.*`.
- `core/src/plugins/GlobalPluginCache.hpp`.
- `core/CMakeLists.txt`.

## Arquivos que não pode modificar

- `extension/**` exceto documentação de comando se combinado.
- `.spec/**`.
- `core/src/components/passive/*` salvo registro temporário de built-ins.

## Dependências

- Agente 01 para CMake.
- Agente 03 para IPC.
- Agente 13 para plugin runtime quando disponível.

## Interfaces obrigatórias

- `SimulationSession` é dona de estado por projeto.
- `GlobalPluginCache` é processo-wide e não guarda estado de instância.
- `main.cpp` não deve virar uma classe gigante.

## Tarefas

- [ ] Implementar parsing de argumentos `--pipe` ou transporte escolhido.
- [ ] Criar `CoreApplication`.
- [ ] Inicializar `GlobalPluginCache`.
- [ ] Criar uma `SimulationSession`.
- [ ] Registrar componentes built-in mínimos.
- [ ] Conectar `IpcServer` à sessão.
- [ ] Implementar shutdown limpo.
- [ ] Retornar códigos de erro úteis.
- [ ] Criar teste de inicialização headless.
- [ ] Criar teste de criação de sessão vazia.

## Testes obrigatórios

- [ ] Core inicia sem VSCode.
- [ ] Core aceita `hello`.
- [ ] Core encerra com `shutdown`.
- [ ] Sessão vazia é criada.

## Critérios de aceite

- `lasecsimul-core` executa em CLI.
- Core não referencia API do VSCode.
- Estado de sessão e cache global estão separados.

## Riscos técnicos

- `main.cpp` concentrar responsabilidades.
- Global state virar singleton implícito.
- Shutdown deixar QEMU/plugin vivo no futuro.

## Observações de integração

Mantenha bootstrap pequeno. Agentes de Netlist, Scheduler e Plugins devem acoplar por interfaces da sessão.

## O que não fazer

- Não implementar componentes específicos além de registro mínimo.
- Não colocar lógica de UI.
- Não usar Qt.
- Não iniciar QEMU diretamente em `main.cpp`.
