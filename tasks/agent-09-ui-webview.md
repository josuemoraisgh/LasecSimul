# Agente 09 - UI/Webview

## Objetivo

Implementar o editor visual inicial do esquemático na Webview.

## Escopo

Canvas, componentes visuais, fios e painel de propriedades. Não inclui solver nem Core direto. **Paleta de
componentes não é desta Webview** — é `TreeView` nativo do VSCode, tarefa do agente 02
(`tasks/agent-02-extension-host.md`); esta Webview só recebe o componente já escolhido.

## Contexto

A Webview é UI pura. Ela não acessa Core, QEMU ou solver diretamente. Organização geral de painéis segue o
SimulIDE-dev, exceto qualquer área de digitar/compilar código (não existe no LasecSimul) — ver
`lasecsimul.spec`, seção 13.

## Arquivos que pode criar

- `extension/src/ui/webview/index.html`.
- `extension/src/ui/webview/main.ts`.
- `extension/src/ui/webview/styles.css`.
- `extension/src/ui/webview/model.ts`.
- `extension/src/ui/webview/messages.ts`.
- `extension/test/webview/*.test.ts`.

## Arquivos que pode modificar

- `extension/src/ui/panels/SchematicPanel.ts`.
- `extension/src/extension.ts` apenas para conectar painel.

## Arquivos que não pode modificar

- `core/**`.
- `devices/**`.
- `mcu-adapters/**`.
- `extension/src/ipc/CoreClient.ts` salvo contrato acordado.

## Dependências

- Agente 02 para painel.
- Agente 03 para tipos de mensagem.
- Agente 10 para modelo `.lsproj`.

## Interfaces obrigatórias

- Webview usa `postMessage` para falar com Extension Host.
- Webview recebe estado inicial serializado.
- Mudanças visuais são eventos, não chamadas diretas ao Core.

## Tarefas

- [ ] Criar canvas do esquemático.
- [ ] Criar modelo visual de componente.
- [ ] Criar modelo visual de fio.
- [ ] Receber componente solto a partir da paleta (`TreeView` do agente 02) via mensagem do Extension Host.
- [ ] Implementar drag de componente.
- [ ] Implementar conexão entre pinos.
- [ ] Implementar remoção de componente.
- [ ] Implementar painel de propriedades — **persistente, nunca modal** (decisão deliberada de não copiar o
  `QDialog` do SimulIDE, ver seção 13 do `.spec`); cada campo editável vem de `propertyDescriptors()` do
  componente (seção 6.1 do `.spec`), não de um formulário hardcoded por `typeId`.
- [ ] Serializar estado visual.
- [ ] Enviar `projectChanged` ao Extension Host.

## Testes obrigatórios

- [ ] Adicionar componente.
- [ ] Mover componente.
- [ ] Conectar fios.
- [ ] Remover componente.
- [ ] Editar propriedades.
- [ ] Serializar estado visual.
- [ ] Enviar mensagem ao Extension Host.

## Critérios de aceite

- Webview abre sem Core real.
- Usuário consegue montar circuito passivo visual.
- UI não contém solver.
- Mensagens são documentadas.

## Riscos técnicos

- Recriar netlist elétrico completo na UI.
- Estado visual divergir do `.lsproj`.
- Mensagens sem versão.

## Observações de integração

O agente 10 define o formato persistido. Use o mesmo modelo para evitar conversores frágeis.

## O que não fazer

- Não importar Core C++.
- Não abrir IPC direto.
- Não calcular MNA.
- Não gerenciar QEMU.
