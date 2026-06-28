# Agente 08 - Componentes Passivos

## Objetivo

Implementar resistor, capacitor e indutor built-in no Core.

## Escopo

Componentes passivos básicos do MVP. Não inclui fontes, semicondutores ou instrumentos.

## Contexto

Passivos do MVP são componentes de primeira parte, compilados no Core, implementando `IComponentModel`.
`DcVoltageSource` e `Ground` (`core/src/components/{sources,other}/`) já existem — categoria "fontes/
referência", fora do escopo formal deste documento, citados aqui só pra não serem recriados por engano.

## Arquivos que pode criar

- `core/src/components/passive/Capacitor.hpp`.
- `core/src/components/passive/Capacitor.cpp`.
- `core/src/components/passive/Inductor.hpp`.
- `core/src/components/passive/Inductor.cpp`.
- `test/core/components/PassiveComponentsTest.cpp`.

## Arquivos que pode modificar

- `core/src/components/passive/Resistor.hpp`.
- `core/src/main.cpp` ou registry de built-ins.
- `core/CMakeLists.txt`.

## Arquivos que não pode modificar

- `extension/**`.
- `core/src/plugins/**`.
- `core/src/simulation/MnaSolver.*` salvo necessidade acordada com agente 07.

## Dependências

- Agente 07 para `ComponentMatrixView`.
- Agente 05 para pinos/nós.

## Interfaces obrigatórias

- Cada componente implementa `IComponentModel`.
- Cada componente expõe pinos `p1` e `p2`.
- Propriedades numéricas devem ser validadas.
- `stamp` usa apenas `MnaMatrixView`/`ComponentMatrixView`.
- Cada propriedade editável depois da criação (`resistance`/`capacitance`/`inductance`) expõe
  `propertyDescriptors()` — ver `Resistor.hpp` já implementado como referência e seção 6.1 do `.spec`. Sem
  isso o painel de propriedades (agente 09) não tem como editar o componente já colocado no circuito.

## Tarefas

- [ ] Validar comportamento atual de `Resistor` (já tem `propertyDescriptors()` — usar como referência).
- [ ] Criar `Capacitor`.
- [ ] Criar `Inductor`.
- [ ] Implementar `propertyDescriptors()` em `Capacitor`/`Inductor`.
- [ ] Registrar factories `passive.capacitor` e `passive.inductor`.
- [ ] Implementar validação de valores positivos.
- [ ] Implementar stamping do resistor.
- [ ] Implementar modelo inicial do capacitor.
- [ ] Implementar modelo inicial do indutor.
- [ ] Criar testes de valores inválidos.
- [ ] Criar testes de stamping.
- [ ] Criar testes de integração com Netlist/MNA.

## Testes obrigatórios

- [ ] Resistor válido.
- [ ] Resistor inválido.
- [ ] Capacitor válido.
- [ ] Capacitor inválido.
- [ ] Indutor válido.
- [ ] Indutor inválido.
- [ ] Stamping de cada componente.

## Critérios de aceite

- Componentes não dependem de UI.
- Resistor resolve caso simples.
- Capacitor e indutor registram estado necessário.
- Limitações numéricas estão documentadas.

## Riscos técnicos

- Implementar capacitor/indutor antes de suporte MNA necessário.
- Misturar unidade visual com unidade elétrica.
- Aceitar valor zero e gerar infinito.

## Observações de integração

`addVoltageSource`/`extraVariableCount` já existem (seção 7.3 do `.spec`) — testes dinâmicos com fonte ideal
não estão mais bloqueados por isso. Se algum outro pré-requisito de MNA faltar, documente claramente qual.

## O que não fazer

- Não criar passivos como plugins externos.
- Não chamar CoreClient.
- Não implementar semicondutores nesta tarefa.
