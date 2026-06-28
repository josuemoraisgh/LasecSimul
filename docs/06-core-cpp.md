# 06 - Core C++

## Objetivo

Orientar a implementação do processo nativo `lasecsimul-core`.

## Escopo

Core headless em C++20, sem VSCode, sem Qt e sem lógica de UI.

## Módulos

- `core/src/main.cpp`: entrada do processo, parsing de argumentos, bootstrap de sessão e IPC.
- `core/src/session/SimulationSession.*`: unidade lógica de um projeto aberto.
- `core/src/simulation/`: `Netlist`, `Scheduler`, `MnaSolver`, `CircuitGroup`, `SparseSet`, `UnionFind`.
- `core/src/components/`: componentes built-in mantidos pelo projeto.
- `core/src/registry/`: factories e metadados.
- `core/src/plugins/`: loader, module, runtime e proxies nativos.
- `core/src/mcu/`: QEMU bridge, `FirmwareWatcher` (recarga automática por polling, seção 8.3 do `.spec`),
  adapters e módulos de barramento.
- `core/src/ipc/`: `IpcServer` e protocolo do processo Core.

## Dependências permitidas

- Standard library C++20.
- Eigen para álgebra linear.
- nlohmann::json para JSON, quando necessário.
- libuv para IPC/spawn, se adotado conforme spec.
- Shims próprios para `LoadLibrary`/`dlopen`, shared memory e diferenças de plataforma.

## Regras de implementação

- Domínio de simulação não deve conter `#ifdef` de plataforma espalhado.
- APIs específicas de SO devem ficar em shims.
- O solver usa Eigen, nunca fatoração manual.
- Dirty tracking usa `SparseSet`.
- Eventos temporais usam `std::priority_queue` ou estrutura plana equivalente.
- `SimulationSession` existe mesmo que o MVP use uma sessão por processo.
- `GlobalPluginCache` não deve virar dono de estado de instância.

## Entregáveis mínimos

- Core inicia e encerra em modo headless.
- Handshake IPC funciona.
- Sessão vazia pode ser criada.
- Netlist de circuito passivo pode ser resolvida.
- Testes unitários do Core rodam sem VSCode.
