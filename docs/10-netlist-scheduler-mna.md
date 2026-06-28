# 10 - Netlist, Scheduler e MNA

## Objetivo

Definir a base de simulação elétrica do MVP.

## Escopo

Netlist headless, scheduler de eventos e solver MNA com Eigen.

## Netlist

Responsável por:

- registrar componentes e pinos;
- conectar pinos por fios;
- unir túneis por nome;
- criar nós globais densos;
- formar grupos galvanicamente conectados;
- gerar `listenersByNode`;
- validar conexões inválidas.

Topologia pode ser reconstruída do zero quando o usuário edita o circuito. Isso não está no caminho crítico da simulação.

## Scheduler

Responsável por:

- tempo de simulação;
- fila de eventos;
- dirty tracking;
- settle loop;
- integração com `MnaSolver`;
- reset, pause, step e stop.

Estruturas obrigatórias:

- `SparseSet` para dirty components/nodes;
- `std::priority_queue` para eventos temporais.

Não usar listas ligadas intrusivas.

## MnaSolver

Responsável por:

- montar matrizes por `CircuitGroup`;
- aplicar stamps por `ComponentMatrixView`;
- resolver grupos dirty com Eigen;
- reutilizar fatoração quando só correntes mudam;
- detectar matriz singular;
- devolver tensões por nó.

## Estratégia de grupos

Cada grupo conectado vira um sistema linear independente. Grupos dirty podem ser resolvidos em paralelo quando o custo compensar.

## Limitações MVP

- Começar com `Eigen::PartialPivLU` denso.
- Planejar `Eigen::SparseLU` quando grupos grandes justificarem.
- Implementar variáveis extras MNA antes de fontes ideais completas.
