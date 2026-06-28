export interface WebviewPinModel {
  id: string;
  x: number;
  y: number;
}

export interface WebviewComponentModel {
  id: string;
  typeId: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  /** Nome com índice por tipo (ex: "Resistor-1", "Resistor-2") — atribuído na criação
   * (`nextIndexedLabel`), editável depois pelo campo "Titulo" do diálogo de propriedades. Igual ao
   * `Component::idLabel()` do SimulIDE, exceto o contador (por tipo aqui, global lá). */
  label: string;
  hidden?: boolean;
  /** Mostra `label` perto do símbolo no canvas. Ausente == `false` (oculto por padrão, igual ao
   * `Component::setShowId(false)` do SimulIDE — ver `componentSystemFlags` em `main.ts`). */
  showId?: boolean;
  /** Mostra o valor formatado da propriedade `showOnSymbol` do typeId (ex: "1 kΩ") perto do símbolo.
   * Ausente == default calculado em runtime (`true` se o typeId tiver uma propriedade
   * `showOnSymbol`, senão `false`) — nunca persistido só pra "ter um valor", ver `componentSystemFlags`. */
  showValue?: boolean;
  /** Espelha o símbolo no eixo horizontal/vertical -- combinado com `rotation`: o flip é aplicado
   * primeiro no espaço local do símbolo, a rotação depois (mesma ordem no CSS `transform` de
   * `main.ts` e no cálculo de posição de pino, ver `flipPoint`/`rotatePoint`). Ausente == `false`. */
  flipH?: boolean;
  flipV?: boolean;
  pins: WebviewPinModel[];
  properties: Record<string, string | number | boolean>;
}

export interface WebviewPoint {
  x: number;
  y: number;
}

export interface WebviewWireModel {
  id: string;
  from: { componentId: string; pinId: string };
  to: { componentId: string; pinId: string };
  points?: WebviewPoint[];
}

export interface PropertySchemaOptionEntry {
  value: string;
  label: string;
}

/** Cópia webview-safe de `PropertySchemaDto` (`extension/src/ipc/types.ts`) — a Webview compila
 * separado via `tsconfig.webview.json` (ambiente de browser, sem tipos Node), por isso não importa
 * direto de `ipc/types.ts`; o host (`extension.ts`) converte um pro outro ao montar o catálogo. */
export interface PropertySchemaEntry {
  id: string;
  label: string;
  group: string;
  unit: string;
  editor: string;
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: PropertySchemaOptionEntry[];
  hidden?: boolean;
  readOnly?: boolean;
  showOnSymbol?: boolean;
}

export interface WebviewComponentCatalogEntry {
  typeId: string;
  label: string;
  /** Categoria de topo, usando o nome EXATO da taxonomia do SimulIDE (ex: "Medidores", "Fontes",
   * "Interruptores", "Passivos") — ver docs/15-taxonomia-paleta.md. Nunca inventar uma categoria
   * nova se o SimulIDE já tem uma equivalente. */
  category: string;
  /** Subcategoria dentro de `category`, também com o nome exato do SimulIDE (ex: "Resistores",
   * "Reativo" dentro de "Passivos") — opcional: categorias sem subdivisão no SimulIDE (ex:
   * "Fontes", "Conectores") não usam este campo. */
  subcategory?: string;
  /** Caminho hierárquico completo da paleta (pastas/subpastas). Ex:
   * ["Passivos", "Resistores", "Precisao"]. Quando ausente, a árvore usa
   * `category`/`subcategory` para manter compatibilidade com catálogos legados. */
  folderPath?: string[];
  /** Caminho relativo a `extension/media/components/{light,dark}/<icon>` (sem extensão/tema) —
   * ex: "resistor" resolve para "media/components/light/resistor.svg" ou ".../dark/resistor.svg"
   * conforme o tema ativo do VSCode. */
  icon?: string;
  iconFilePath?: string;
  symbolSvg?: string;
  pinCount: number;
  defaultProperties: Record<string, string | number | boolean>;
  /** Schema rico de propriedades deste typeId (grupo/editor/min/max/opções/flags), vindo do Core via
   * `getPropertySchemas` — ausente/vazio só pra typeId que o Core ainda não conhece (ex: registrado
   * porém desabilitado); o diálogo de propriedades cai pra inferência nesse caso. */
  propertySchema?: PropertySchemaEntry[];
  hidden?: boolean;
  /** Quando true, o item aparece na paleta mas não pode ser inserido no circuito. */
  disabled?: boolean;
  /** Motivo da indisponibilidade, mostrado no tooltip do item desabilitado. */
  disabledReason?: string;
  /** Identifica entrada adicionada pelo usuário via registro de arquivo. */
  isRegistered?: boolean;
  /** ID estável da fonte registrada (usado para remoção por menu de contexto). */
  registeredSourceId?: string;
  /** False quando o item é integrado ao catálogo base e não pode ser removido pela UI. */
  registeredSourceRemovable?: boolean;
}

export interface WebviewProjectState {
  locale?: "pt-BR" | "en";
  catalog: WebviewComponentCatalogEntry[];
  components: WebviewComponentModel[];
  wires: WebviewWireModel[];
  /** `x`/`y` = pan, `zoom` = escala — aplicado via CSS transform no wrapper `.canvas-content`
   * (`main.ts`), com `eventToCanvasPoint` invertendo a transformação pra todo cálculo de coordenada
   * tela→canvas continuar correto em qualquer zoom (ver `.spec/lasecsimul.spec` seção 13.4). */
  viewport: { x: number; y: number; zoom: number };
  /** Seleção múltipla (marquee/Shift+click) — array vazio == nada selecionado, nunca `undefined`
   * (mais simples de testar que opcional). Substituiu `selectedComponentId?: string` singular. */
  selectedComponentIds: string[];
  selectedWireIds: string[];
  pendingConnection?: { componentId: string; pinId: string };
}
