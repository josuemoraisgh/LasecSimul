# Agente 05 - Netlist

## Objetivo

Implementar topologia de pinos, nós, túneis, conexões e grupos conectados.

## Escopo

Netlist e topologia elétrica. Não inclui solução numérica de matriz.

## Contexto

O `Netlist` alimenta o `MnaSolver` e o `Scheduler`. Topologia muda por edição do usuário e pode ser reconstruída do zero.

## Arquivos que pode criar

- `core/src/simulation/Netlist.cpp`.
- `test/core/simulation/NetlistTest.cpp`.
- `test/core/simulation/UnionFindTest.cpp`.

## Arquivos que pode modificar

- `core/src/simulation/Netlist.hpp`.
- `core/src/simulation/UnionFind.hpp`.
- `core/src/session/SimulationSession.*` apenas para integração.

## Arquivos que não pode modificar

- `extension/**`.
- `core/src/plugins/**`.
- `core/src/simulation/MnaSolver.hpp` salvo contrato combinado.

## Dependências

- Agente 04 para `SimulationSession`.
- Agente 08 para casos com componentes passivos.

## Interfaces obrigatórias

- Registrar componente com pinos.
- Conectar endpoints por fio.
- Definir túnel por nome.
- Reconstruir nós globais densos.
- Gerar grupos conectados.
- Expor listeners por nó.

## Tarefas

- [ ] Finalizar modelo de `ComponentId`, `PinSlot`, `NodeId` e `GroupId`.
- [ ] Implementar `registerComponent`.
- [ ] Implementar `connectWire`.
- [ ] Implementar remoção de conexão.
- [ ] Implementar túnel por nome.
- [ ] Implementar rebuild por `UnionFind`.
- [ ] Implementar formação de grupos galvanicamente conectados.
- [ ] Implementar validação de endpoint inválido.
- [ ] Implementar listeners por nó.
- [ ] Criar testes de circuito vazio.
- [ ] Criar testes de resistor simples.
- [ ] Criar testes de túneis por nome.

## Testes obrigatórios

- [ ] Circuito vazio.
- [ ] Nós desconectados.
- [ ] Conexões inválidas.
- [ ] Resistor simples.
- [ ] RC, RL e RLC em nível topológico.
- [ ] Grupos galvanicamente conectados.

## Critérios de aceite

- IDs gerados são densos e estáveis por rebuild.
- Netlist não depende de UI.
- Túnel por nome é por sessão, não global de processo.

## Riscos técnicos

- Tentar fazer UnionFind incremental.
- Misturar coordenadas visuais com topologia elétrica.
- Vazar estado de uma sessão para outra.

## Observações de integração

O `MnaSolver` depende de grupos e mapas de nó. Combine o formato de saída com o agente 07.

## O que não fazer

- Não resolver matriz.
- Não acessar Extension.
- Não usar singletons globais.
