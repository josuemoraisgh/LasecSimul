# ADR 0005 - Solver MNA com Eigen

## Objetivo

Registrar a decisão de solver MNA com Eigen.

## Escopo

Base numérica do Core para o MVP.

## Status

Aceita

## Contexto

O solver precisa resolver circuitos elétricos com boa estabilidade numérica. O SimulIDE usa MNA e grupos independentes, mas contém implementação manual de fatoração que não deve ser copiada.

## Decisão

O LasecSimul usa Modified Nodal Analysis com Eigen. O caminho inicial usa `Eigen::PartialPivLU` denso por grupo, com preparação para `Eigen::SparseLU` quando grupos grandes justificarem.

## Alternativas consideradas

- Fatoração manual: descartada por risco numérico e manutenção.
- Solver em TypeScript: descartado por desempenho.
- Resolver circuito inteiro sempre: descartado, pois grupos independentes e dirty tracking escalam melhor.

## Consequências

- `CircuitGroup` precisa mapear nós e variáveis MNA.
- `ComponentMatrixView` é a fronteira de stamping.
- Testes numéricos e tolerância são obrigatórios.

## Impacto no projeto

Agentes não devem escrever LU manual nem mover solver para a Extension.
