# 09 - Componentes Passivos

## Objetivo

Definir o escopo inicial dos componentes passivos do MVP.

## Escopo

Resistor, capacitor e indutor built-in no Core. Não cobre fontes ideais completas, semicondutores ou instrumentos.

## Componentes

### Resistor

- `typeId`: `passive.resistor`.
- Pinos: `p1`, `p2`.
- Propriedade: `resistance` em ohms.
- Stamp: condutância `g = 1 / R` entre os dois nós.
- Validação: `R > 0`.

### Capacitor

- `typeId`: `passive.capacitor`.
- Pinos: `p1`, `p2`.
- Propriedade: `capacitance` em farads.
- Estado: tensão/carga equivalente.
- Stamp inicial: modelo companion para passo discreto.
- Validação: `C > 0`.

### Indutor

- `typeId`: `passive.inductor`.
- Pinos: `p1`, `p2`.
- Propriedade: `inductance` em henrys.
- Estado: corrente inicial/equivalente.
- Stamp inicial: modelo companion ou variável extra MNA quando disponível.
- Validação: `L > 0`.

## Regras

- Passivos do projeto são built-in, não plugins.
- Todos implementam `IComponentModel`.
- `stamp` não deve fazer IPC.
- `postStep` só deve existir quando houver estado dinâmico.
- Propriedade editável depois de criado (ex: `resistance`) expõe `propertyDescriptors()` — ver seção 6.1 do
  `.spec`. Exceção: nada aqui precisa de exceção como o `Tunnel` (renomear túnel reabre topologia); resistor/
  capacitor/indutor só re-stampam.
- Testes elétricos devem validar integração com `Netlist` e `MnaSolver`.

## Limitação conhecida — RESOLVIDA

~~Fonte de tensão ideal e variáveis extras MNA precisam ser suportadas em `CircuitGroup`~~ — já implementado:
`IComponentModel::extraVariableCount()`, `CircuitGroup` dimensionado por `nodeCount + extraVariableCount`,
`MnaMatrixView::addVoltageSource` (seção 7.3 do `.spec`). `DcVoltageSource` e `Ground` já existem em
`core/src/components/{sources,other}/` — fora do escopo formal deste documento (fontes/referência, não
passivo), mas citados aqui pra nenhum agente futuro tentar recriar o que já existe.
