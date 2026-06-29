import { WebviewComponentModel, WebviewProjectState, WebviewWireModel } from "./model";

/** Mesmo `RegisteredItemKind` de `extension.ts` -- duplicado aqui de propósito (mensagens não devem
 * importar de `extension.ts`, que tem `vscode` e roda só no host). `device.json` (`abi-device`) não
 * tem circuito interno nem variante Logic Symbol ("Package ≠ Subcircuit", ver `.spec/
 * lasecsimul-subcircuits.spec` seção 4) -- só listado aqui pra completar o tipo. */
export type SymbolAuthoringKind = "abi-device" | "mcu-adapter" | "subcircuit-file";

export const WEBVIEW_MESSAGE_VERSION = 1 as const;

export type SimulationStatus = "stopped" | "running" | "paused";
export type ComponentReadoutValue = number | number[];

/** Histórico REAL (tempo simulado de verdade, `Scheduler::nowNs()` do Core -- ver `core/src/
 * components/meters/Oscope.hpp`/`LogicAnalyzer.hpp`) pra janela "Expande" -- diferente do
 * `ComponentReadoutValue` acima, que só carrega a ÚLTIMA leitura (usado pela pré-visualização
 * pequena no canvas, que acumula seu PRÓPRIO histórico no cliente por poll de IPC, sem precisão de
 * tempo real -- ver `main.ts::updateReadoutHistories`). Buscado só quando uma janela "Expande" está
 * aberta pra aquele componente (`requestInstrumentHistory`), não a cada poll de TODOS os
 * instrumentos -- histórico real pode ter centenas de amostras, não compensa mandar pra quem não
 * pediu. */
export interface InstrumentHistoryPayload {
  componentId: string;
  oscope?: { channels: Array<{ timestampsNs: number[]; values: number[] }> };
  logic?: { timestampsNs: number[]; masks: number[] };
}

export type HostToWebviewMessage =
  | { version: number; type: "init"; project: WebviewProjectState }
  | { version: number; type: "selectComponent"; componentId: string | null }
  | { version: number; type: "requestAddComponent"; typeId: string }
  | { version: number; type: "syncState"; project: WebviewProjectState }
  | { version: number; type: "componentReadout"; readoutsByComponentId: Record<string, ComponentReadoutValue> }
  | { version: number; type: "wireVoltages"; voltagesByWireId: Record<string, number> }
  | { version: number; type: "simulationStatus"; status: SimulationStatus }
  /** Resposta a `requestInstrumentHistory` -- histórico REAL (tempo simulado), ver
   * `InstrumentHistoryPayload`. */
  | ({ version: number; type: "instrumentHistory" } & InstrumentHistoryPayload)
  /** Vem de `lasecsimul.rotateSelectionCw`/`Ccw` (`extension.ts`), disparado por keybinding do
   * VSCode com `when: activeWebviewPanelId == 'lasecsimul.schematic'` -- sobrepõe o `Ctrl+R`/
   * `Ctrl+Shift+R` nativo do VSCode SÓ enquanto o painel está em foco (`when` reverte sozinho ao
   * trocar de foco, sem lógica de restauração manual). A Webview não trata mais `Ctrl+R` no próprio
   * `keydown` -- esse é o caminho confiável agora, ver `.spec/lasecsimul.spec` seção 13.4. */
  | { version: number; type: "requestRotateSelection"; direction: "cw" | "ccw" }
  /** Mesmo caminho de `requestRotateSelection`, mas pra flip -- ver `lasecsimul.flipSelectionHorizontal`/
   * `Vertical` em `extension.ts`. */
  | { version: number; type: "requestFlipSelection"; axis: "horizontal" | "vertical" }
  /** Entra no modo de autoria de símbolo (Épico G, parte de escrita) -- ver `.spec/
   * lasecsimul-native-devices.spec` seção 21.3 e `docs/16-roadmap-pendencias-spec.md` Épico G:
   * mesmo princípio do SimulIDE real (`SubPackage`/`Rectangle`/`Ellipse`/.../`PackagePin` são
   * `Component`s comuns na MESMA cena do circuito, não um editor separado). `main.ts` troca
   * `state` por uma sessão nova semeada com `components` (um `other.package` + um `graphics.*` por
   * forma + um `other.package_pin` por pino, todos reconstruídos a partir do `package` atual do
   * manifesto pela Extension, ver `extension.ts::seedSymbolAuthoringComponents`) -- o circuito real
   * do usuário (se houver um aberto) nunca é tocado, só fica "escondido" até "Salvar Símbolo"/
   * "Cancelar" devolver `state` pro original. Pra `subcircuit-file`, `components`/`wires` TAMBÉM
   * incluem o circuito interno real (não só o `package`) -- "Open Subcircuit" do SimulIDE real
   * mostra os dois juntos na mesma cena (ver `.spec/lasecsimul-subcircuits.spec` seção 4). `view`
   * diz qual aparência está sendo editada agora ("logicSymbol" só pra `mcu-adapter`/
   * `subcircuit-file`, ver seção 21.3 do spec de plugins nativos). */
  | {
      version: number;
      type: "enterSymbolAuthoring";
      filePath: string;
      typeId: string;
      kind: SymbolAuthoringKind;
      view: "default" | "logicSymbol";
      components: WebviewComponentModel[];
      wires: WebviewWireModel[];
    };

export type WebviewToHostMessage =
  | { version: number; type: "webviewReady" }
  | { version: number; type: "projectChanged"; project: WebviewProjectState }
  | { version: number; type: "requestAddComponent"; typeId: string }
  | { version: number; type: "requestInsertItems"; components: WebviewComponentModel[]; wires: WebviewWireModel[] }
  | { version: number; type: "requestRemoveComponent"; componentId: string }
  | { version: number; type: "requestRemoveWire"; wireId: string }
  | { version: number; type: "requestRotateComponent"; componentId: string; rotation: 0 | 90 | 180 | 270 }
  | { version: number; type: "requestFlipComponent"; componentId: string; flipH: boolean; flipV: boolean }
  | { version: number; type: "requestRenameComponent"; componentId: string; label: string }
  | { version: number; type: "requestUpdateLabelVisibility"; componentId: string; showId: boolean; showValue: boolean }
  | {
      version: number;
      type: "requestConnectPinToWire";
      from: { componentId: string; pinId: string };
      wireId: string;
      point: { x: number; y: number };
      points?: Array<{ x: number; y: number }>;
      existingWireFirstPoints?: Array<{ x: number; y: number }>;
      existingWireSecondPoints?: Array<{ x: number; y: number }>;
    }
  | { version: number; type: "requestConnectPins"; from: { componentId: string; pinId: string }; to: { componentId: string; pinId: string }; points?: Array<{ x: number; y: number }> }
  | { version: number; type: "requestUpdateProperty"; componentId: string; name: string; value: string | number | boolean }
  | { version: number; type: "requestRunSimulation" }
  | { version: number; type: "requestPauseSimulation" }
  | { version: number; type: "requestStopSimulation" }
  | { version: number; type: "requestSaveProject" }
  | { version: number; type: "requestOpenProject" }
  /** Sai do modo de autoria com "Salvar Símbolo"/"Salvar Subcircuito" -- `components`/`wires` é a
   * sessão de autoria completa no momento do clique (não o circuito real, ver
   * `enterSymbolAuthoring`). A Extension compila isso num `PackageDescriptor`
   * (`extension.ts::compileSymbolAuthoringComponents`) e escreve de volta na chave certa
   * (`package`/`logicSymbolPackage`, conforme `view`) do `filePath` original -- pra
   * `subcircuit-file`, TAMBÉM compila e grava `components[]`/`wires[]`/`interface[]` reais
   * (`compileSubcircuitInternalComponents`), preservando todas as outras chaves do manifesto. */
  | { version: number; type: "requestSaveSymbol"; filePath: string; typeId: string; kind: SymbolAuthoringKind; view: "default" | "logicSymbol"; components: WebviewComponentModel[]; wires: WebviewWireModel[] }
  /** Botão direito numa instância JÁ COLOCADA no circuito -- "Editar Símbolo Visual"/"Abrir
   * Subcircuito" no menu de contexto (`main.ts`, mesmo princípio do "Open Subcircuit" do SimulIDE).
   * `sourceId` é o mesmo `RegisteredSource.id` que o botão "✎" da paleta já usa -- reaproveita
   * `extension.ts::editPackageSymbolCommand` tal qual, só com outro ponto de entrada. */
  | { version: number; type: "requestEditSymbol"; sourceId: string }
  | { version: number; type: "requestChooseMcuFirmware"; componentId: string }
  | { version: number; type: "requestReloadMcuFirmware"; componentId: string }
  | { version: number; type: "requestOpenMcuSerialMonitor"; componentId: string; usartIndex: 0 | 1 | 2 }
  /** Toggle "Ver: Físico / Símbolo Lógico" na barra da sessão de autoria -- descarta sem salvar a
   * vista atual (mesmo aviso já mostrado na UI, ver `main.ts::toggleLogicSymbolView`) e reabre a
   * sessão semeada a partir da OUTRA chave (`package`/`logicSymbolPackage`), preservando o circuito
   * interno (`internalComponents`/`internalWires`, não relidos do disco -- só o `package` troca). */
  | {
      version: number;
      type: "requestSwitchSymbolView";
      filePath: string;
      typeId: string;
      kind: SymbolAuthoringKind;
      toView: "default" | "logicSymbol";
      internalComponents: WebviewComponentModel[];
      internalWires: WebviewWireModel[];
    }
  /** "Exportar Dados" da janela "Expande" do osciloscópio/analisador lógico -- o CSV já vem PRONTO
   * (formatado em main.ts, que é quem tem o histórico/configuração de canais) pra extension.ts só
   * abrir `showSaveDialog`/escrever o arquivo, sem precisar conhecer o formato do instrumento. */
  | { version: number; type: "requestExportInstrumentData"; suggestedFileName: string; csvContent: string }
  /** Pedido de histórico REAL pra janela "Expande" -- ver `InstrumentHistoryPayload`. Mandado ao
   * abrir a janela e a cada `componentReadout` enquanto ela continuar aberta (mesmo ritmo de
   * atualização do resto da telemetria, ~300ms, ver `pollInstrumentReadouts`). */
  | { version: number; type: "requestInstrumentHistory"; componentId: string };

export function isHostMessage(value: unknown): value is HostToWebviewMessage {
  return typeof value === "object" && value !== null && "type" in value && "version" in value;
}
