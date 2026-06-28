# 04 - Divisão Por Agentes

## Objetivo

Mapear responsabilidades de implementação para agentes de IA trabalhando em paralelo.

## Escopo

Resumo das responsabilidades. As ordens de trabalho completas estão em `tasks/`.

## Agentes

- Agente 01: estrutura do repositório, CMake, package da Extension, scripts e pastas.
- Agente 02: Extension Host, comandos VSCode, paleta de componentes (`TreeView` nativo, não Webview),
  abertura da Webview e ciclo de vida.
- Agente 03: IPC e `CoreClient`.
- Agente 04: Core bootstrap, `main.cpp`, `SimulationSession`, `GlobalPluginCache`, `IpcServer`.
- Agente 05: `Netlist`, `UnionFind`, pinos, nós, grupos e validação.
- Agente 06: `Scheduler`, tempo de simulação, eventos, dirty tracking e `SparseSet`.
- Agente 07: `MnaSolver`, `CircuitGroup`, `ComponentMatrixView` e Eigen.
- Agente 08: resistor, capacitor, indutor e stamping MNA.
- Agente 09: UI/Webview inicial do esquemático (canvas + painel de propriedades persistente). Paleta de
  componentes **não** é desta Webview — ver agente 02.
- Agente 10: projeto `.lsproj`, schema, serializer e validação.
- Agente 11: `QemuProcessManager` e ciclo de vida QEMU.
- Agente 12: `Esp32Adapter`, `IMcuAdapter`, GPIO e blink.
- Agente 13: plugins nativos, ABI C, loader, runtime e exemplo.
- Agente 14: testes unitários, integração, E2E e pipeline mínimo.
- Agente 15: integração final do MVP.
- Agente 16: documentação, ADRs e consistência com specs.

## Pontos de contato

- Agente 03 entrega contratos usados pelos agentes 02, 04, 09 e 10.
- Agente 05 entrega mapeamento de nós/grupos usado pelos agentes 06, 07 e 08.
- Agente 07 depende de estruturas do agente 05.
- Agente 08 depende de `ComponentMatrixView` estável.
- Agente 11 e 12 dependem de `IMcuAdapter` e contratos de QEMU.
- Agente 15 só integra depois que os contratos mínimos estiverem estáveis.

## Lacuna de spec durante a implementação

Nenhum agente decide uma arquitetura nova "no escuro": ao topar com algo que o `.spec` ainda não cobre,
procurar uma solução, avaliar como o SimulIDE-dev resolve o mesmo problema, perguntar ao usuário se sobrar
dúvida real, e se não sobrar, implementar a melhor solução e atualizar o `.spec` na mesma tarefa.
Procedimento completo (é regra, não sugestão) em `.skill/lasecsimul.skill`, seção "Quando algo não está no
`.spec`".
