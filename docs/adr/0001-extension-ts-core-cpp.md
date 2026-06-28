# ADR 0001 - Extension TS e Core C++

## Objetivo

Registrar a separação entre Extension TypeScript e Core C++.

## Escopo

Decisão arquitetural de processo e linguagem para o LasecSimul.

## Status

Aceita

## Contexto

O LasecSimul precisa integrar-se ao VSCode sem colocar o caminho crítico da simulação no Extension Host. A simulação elétrica exige desempenho nativo e isolamento da API do VSCode.

## Decisão

A Extension fica em TypeScript no VSCode Extension Host. O Core fica em C++ nativo, executado como processo separado.

## Alternativas consideradas

- Core em TypeScript/Node: descartado por desempenho e por dificultar plugins nativos no caminho crítico.
- Aplicação Qt monolítica: descartada porque a UI pertence ao VSCode/Webview e o Core deve ser headless.

## Consequências

- A Extension precisa de IPC para falar com o Core.
- O Core pode ser testado sem VSCode.
- O solver e plugins rodam com custo de chamada nativo.

## Impacto no projeto

Agentes devem respeitar a fronteira: UI/orquestração em `extension/`, simulação em `core/`.
