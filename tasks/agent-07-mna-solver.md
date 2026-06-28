# Agente 07 - MnaSolver

## Objetivo

Implementar solver MNA com Eigen, grupos de circuito e fronteira de stamping.

## Escopo

Matrizes, grupos, stamping e resolução numérica. Não inclui UI, IPC ou plugins.

## Contexto

O solver é C++ nativo e usa Eigen. Não escrever fatoração manual.

## Arquivos que pode criar

- `core/src/simulation/MnaSolver.cpp`.
- `core/src/simulation/CircuitGroup.cpp`.
- `core/src/simulation/ComponentMatrixView.cpp`.
- `test/core/simulation/MnaSolverTest.cpp`.
- `test/core/simulation/CircuitGroupTest.cpp`.

## Arquivos que pode modificar

- `core/src/simulation/MnaSolver.hpp`.
- `core/src/simulation/CircuitGroup.hpp`.
- `core/src/simulation/ComponentMatrixView.hpp`.
- `core/CMakeLists.txt`.

## Arquivos que não pode modificar

- `extension/**`.
- `core/src/ipc/**`.
- `core/src/plugins/**` salvo adaptação mínima de interfaces.

## Dependências

- Agente 05 para grupos e nós.
- Agente 06 para scheduler.
- Agente 08 para componentes que chamam `stamp`.

## Interfaces obrigatórias

- `MnaSolver::rebuildTopology`.
- `MnaSolver::stampDirty`.
- `MnaSolver::solveDirtyGroups`.
- `ComponentMatrixView::addConductance`.
- `ComponentMatrixView::addCurrent`.
- Planejar `addVoltageSource` com variável extra MNA.

## Tarefas

- [ ] Criar armazenamento de matriz por `CircuitGroup`.
- [ ] Mapear `NodeId` para índice local.
- [ ] Aplicar conductance stamps.
- [ ] Aplicar current stamps.
- [ ] Resolver com `Eigen::PartialPivLU`.
- [ ] Detectar matriz singular.
- [ ] Expor tensões resolvidas por nó.
- [ ] Cachear fatoração quando possível.
- [ ] Preparar threshold futuro para `Eigen::SparseLU`.
- [ ] Criar teste de divisor resistivo.
- [ ] Criar teste de múltiplos grupos.
- [ ] Criar teste de matriz singular.

## Testes obrigatórios

- [ ] Resistor entre fonte e terra quando fonte estiver suportada.
- [ ] Divisor resistivo.
- [ ] Grupo independente.
- [ ] Múltiplos grupos.
- [ ] Tolerância numérica.
- [ ] Matriz singular.

## Critérios de aceite

- Usa Eigen.
- Não contém LU manual.
- Não depende de VSCode.
- Grupos independentes são resolvidos separadamente.

## Riscos técnicos

- Fonte de tensão ideal exigir variável extra não planejada.
- Índices locais incorretos entre grupos.
- Singularidade mascarada como 0V silencioso.

## Observações de integração

Documente lacunas de variáveis extras MNA antes de passivos dinâmicos dependerem disso.

## O que não fazer

- Não mover solver para TS.
- Não usar IPC no solve.
- Não copiar fatoração do SimulIDE.
