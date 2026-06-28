# 13 - Testes

## Objetivo

Definir a estratégia obrigatória de testes do MVP.

## Escopo

Testes unitários, integração e E2E para Extension, Core, Netlist, Solver, UI, IPC, QEMU, plugins e integração final.

## Extension

- ativação da extensão;
- comando para abrir o editor esquemático;
- abertura da Webview;
- seleção de componente na paleta nativa;
- envio de mensagem para Core;
- recebimento de mensagem do Core;
- erro quando Core não inicia;
- encerramento limpo.

## Core

- inicialização headless;
- criação de `SimulationSession`;
- circuito vazio;
- criação de nó;
- conexão entre pinos;
- geração de netlist;
- scheduler com eventos ordenados;
- dirty tracking;
- reset;
- encerramento limpo.

## Netlist

- circuito vazio;
- resistor simples;
- RC, RL e RLC;
- nós desconectados;
- conexões inválidas;
- túnel por nome;
- grupos galvanicamente conectados.

## MnaSolver

- resistor entre fonte e terra;
- divisor resistivo;
- capacitor com condição inicial;
- indutor com corrente inicial;
- grupo independente;
- múltiplos grupos;
- matriz singular;
- tolerância numérica.

## Componentes passivos

- valores válidos e inválidos de R/C/L;
- stamping de cada componente;
- integração com netlist e MNA.

## UI/Webview

- adicionar, mover, conectar e remover componente;
- editar propriedades;
- serializar estado visual;
- enviar alteração para Extension Host.

## IPC

- iniciar Core;
- enviar comando;
- responder;
- erro de protocolo;
- timeout;
- Core encerrado inesperadamente;
- reconexão ou falha tratada.

## QEMU/ESP32

- iniciar, parar e matar QEMU;
- carregar firmware;
- erro ao carregar firmware;
- mapear GPIO;
- blink LED;
- entrada digital;
- logs.

## Plugins nativos

- export ausente;
- ABI incompatível;
- plugin válido;
- criar/destruir instância;
- chamar `stamp` e `postStep`;
- versioned swap;
- não descarregar módulo vivo.

## Infraestrutura atualizada

- `core/test/core/plugins/PluginLoaderTest.cpp`: valida exports obrigatórios e ABI de device/MCU sem depender de DLL/SO real.
- `core/test/core/plugins/PluginRuntimeTest.cpp`: valida criação de instância, swap versionado e lifetime do módulo enquanto a proxy existir.
- `core/test/core/plugins/` é a base para expandir fixtures de plugins reais quando o build dos exemplos nativos estiver integrado ao CI.

## Integração final

- abrir Extension;
- abrir Webview;
- criar projeto;
- adicionar R/C/L;
- conectar circuito;
- enviar ao Core;
- simular circuito passivo;
- salvar e reabrir `.lsproj`;
- iniciar ESP32 via QEMU quando disponível;
- registrar limitações.
