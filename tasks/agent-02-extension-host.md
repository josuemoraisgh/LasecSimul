# Agente 02 - Extension Host

## Objetivo

Implementar ciclo de vida da Extension, comandos VSCode e abertura da Webview.

## Escopo

Extension Host e comandos VSCode, incluindo a paleta de componentes (`TreeView` nativo do VSCode — não é
Webview, ver `lasecsimul.spec` seção 13). Não inclui UI interna do canvas nem IPC profundo.

## Contexto

A Extension é TypeScript e só orquestra UI/IPC. Simulação elétrica pertence ao Core.

## Arquivos que pode criar

- `extension/src/ui/commands/*.ts`.
- `extension/src/ui/panels/SchematicPanel.ts`.
- `extension/src/ui/tree/ComponentPaletteProvider.ts` — implementa `vscode.TreeDataProvider`, com busca/filtro
  nativos do VSCode (não reimplementar busca dentro de Webview).
- `extension/src/lifecycle/ExtensionState.ts`.
- `extension/test/extension/*.test.ts`.

## Arquivos que pode modificar

- `extension/src/extension.ts`.
- `extension/package.json`.
- `extension/src/ipc/CoreClient.ts` apenas para uso público, não protocolo interno.

## Arquivos que não pode modificar

- `core/**`.
- `devices/**`.
- `mcu-adapters/**`.
- `.spec/**`.

## Dependências

- Agente 01 para estrutura.
- Agente 03 para API estável do `CoreClient`.
- Agente 09 para conteúdo da Webview.

## Interfaces obrigatórias

- Comandos VSCode chamam serviços da Extension.
- Webview envia mensagens ao Extension Host.
- Extension Host fala com Core apenas por `CoreClient`.

## Tarefas

- [ ] Registrar comando `lasecsimul.openSchematicEditor`.
- [ ] Registrar comandos `lasecsimul.run`, `lasecsimul.pause`, `lasecsimul.stop`.
- [ ] Criar `ComponentPaletteProvider` (`TreeDataProvider`) com resistor/capacitor/indutor; registrar a view
  em `package.json` (`contributes.views`).
- [ ] Encaminhar seleção/drag da paleta pro `SchematicPanel` (mensagem, não chamada direta).
- [ ] Criar painel `SchematicPanel`.
- [ ] Gerenciar singleton ou instâncias de painel conforme MVP.
- [ ] Inicializar `CoreClient` quando necessário.
- [ ] Encerrar `CoreClient` na desativação.
- [ ] Encaminhar mensagens da Webview para serviços TS.
- [ ] Mostrar erro quando Core não iniciar.
- [ ] Criar teste de ativação da extensão.
- [ ] Criar teste de abertura de Webview.

## Testes obrigatórios

- [ ] Ativação da Extension.
- [ ] Comando abre painel.
- [ ] Desativação encerra recursos.
- [ ] Falha de Core exibe erro amigável.

## Critérios de aceite

- VSCode reconhece os comandos.
- Webview abre sem Core real quando em modo mock.
- Nenhum cálculo elétrico existe na Extension.

## Riscos técnicos

- Ciclo de vida do painel vazar listeners.
- Core iniciado múltiplas vezes sem controle.
- Webview depender de recurso local não permitido pelo VSCode.

## Observações de integração

Combine nomes de mensagens com os agentes 03 e 09 antes de estabilizar testes.

## O que não fazer

- Não acessar pipe/socket fora de `CoreClient`.
- Não importar código C++.
- Não chamar QEMU.
- Não simular circuito em TypeScript.
