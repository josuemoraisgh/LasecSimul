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
  /** Posição/orientação na PLACA (Board Mode) — independente de `x`/`y`/`rotation`/`flipH`/`flipV`
   * (posição no CIRCUITO), igual a `circPos`/`boardPos` do SimulIDE real (`SubPackage::
   * setBoardMode()`, `simulide_2/src/components/other/subpackage.cpp`): cada componente tem 2
   * posições independentes, um toggle alterna qual está "ativa" -- mover num modo nunca afeta a
   * posição no outro. Só usado dentro de uma sessão de "Abrir Subcircuito" com Modo Placa
   * (`main.ts::toggleBoardMode`); ausente até o usuário entrar em Modo Placa a primeira vez.
   * Convenção: os campos `x`/`y`/`rotation`/`flipH`/`flipV` de sempre SEMPRE refletem a posição
   * "ativa" no momento (igual ao SimulIDE) -- entrar/sair de Modo Placa faz SWAP com estes campos,
   * nunca lê os dois ao mesmo tempo pra desenhar. */
  boardX?: number;
  boardY?: number;
  boardRotation?: 0 | 90 | 180 | 270;
  boardFlipH?: boolean;
  boardFlipV?: boolean;
  /** "Selecione os Componentes expostos" -- só relevante pra componentes do circuito INTERNO de um
   * subcircuito (`isSymbolAuthoringTypeId` é sempre `false`/irrelevante aqui). Sobrevive ao
   * round-trip de "Abrir Subcircuito" via `InternalComponentSeed.exposed` (ver
   * `symbolAuthoring.ts`). Ausente == `false`. */
  exposed?: boolean;
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

/** Pino declarado em `package.pins[]` (`device.json`/`.lssub.json`, ver
 * `.spec/lasecsimul-native-devices.spec` seção 21.2) — `x`/`y` é o ponto onde o "lead" toca o corpo
 * do símbolo (não a ponta do fio); a ponta real (onde o fio conecta) fica em
 * `x + cos(angle)*length, y + sin(angle)*length`. `id` deve bater com o `pin.id` real devolvido pelo
 * Core — é por `id`, nunca por posição no array, que o renderizador casa pino declarado com pino
 * real (um `McuComponent`/subcircuito pode devolver pinos em ordem diferente da declarada). */
export interface PackagePin {
  id: string;
  kind?: string;
  x: number;
  y: number;
  angle: number;
  length: number;
  label?: string;
  /** Posição do RÓTULO, independente da posição do pino -- igual ao SimulIDE real (texto de pino,
   * texto do CI etc são objetos arrastáveis à parte, nunca presos a um deslocamento fixo do pino).
   * Em coordenadas ORIGINAIS do package (mesmo espaço de `x`/`y`, antes do deslocamento de
   * `resolvePackageLayout`). Ausente == posição padrão calculada (ponta do lead + 9 unidades na
   * direção do `angle`, com rótulo girado -90° se o lead for vertical) -- mesmo comportamento de
   * sempre, nunca quebra um `package` escrito antes deste campo existir. Editado arrastando um
   * `graphics.text` vinculado na sessão de autoria (`other.package_pin`/`symbolAuthoring.ts`), nunca
   * uma alça nova. */
  labelX?: number;
  labelY?: number;
}

/** Uma forma declarativa de `package.shapes[]` — mesmo vocabulário de
 * `components/graphical/{rectangle,ellipse,line,textcomponent}` do SimulIDE, só que como dado
 * (`.spec/lasecsimul-native-devices.spec` seção 21.2), nunca um componente à parte. */
export interface PackageShape {
  kind: "rect" | "text" | "line" | "ellipse";
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  value?: string;
  fontSize?: number;
  color?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}

export interface PackageBackground {
  kind: "color" | "svg" | "image" | "none";
  value?: string;
  data?: string;
}

/** SimulIDE stores Package.Width/Height in schematic grid cells; each cell is 8 scene units. */
export const SIMULIDE_PACKAGE_GRID_UNIT = 8;

/** Símbolo visual declarativo de um `typeId` — mesmo bloco `package` de `device.json`/`.lssub.json`
 * (`.spec/lasecsimul-native-devices.spec` seção 21, `.spec/lasecsimul-subcircuits.spec` seção 3).
 * Quando presente, o renderizador da Webview desenha o corpo e posiciona cada pino na coordenada
 * REAL declarada — nunca o algoritmo genérico esquerda/direita usado para built-ins sem `package`
 * (ver `componentSymbols.ts`, Épico G do roadmap de pendências). */
export interface PackageDescriptor {
  width: number;
  height: number;
  /** Tamanho EXTERNO no esquemático, independente da malha interna usada por `pins[]`/`shapes[]`.
   * Porta o comportamento do SimulIDE para placas/imagens reais: o package tem um espaço nativo
   * (ex: pixels da foto/placa, usado por `boardPos` e pinos), mas a instância no esquemático ocupa
   * um retângulo lógico menor (`Package.Width/Height` lá, em células de grade). Ausente ==
   * comportamento legado: usa `width`/`height` como tamanho visual também. */
  schematicWidth?: number;
  schematicHeight?: number;
  border?: boolean;
  background?: PackageBackground;
  shapes?: PackageShape[];
  pins: PackagePin[];
  /** Cor dos rótulos de pinos — padrão `currentColor` (herda do canvas). Usar `"#FAFAC8"` pra
   * placas com fundo escuro (mesma cor `QColor(250,250,200)` dos rótulos de `PackagePin` do
   * SimulIDE real). */
  pinLabelColor?: string;
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
  /** Símbolo declarativo real (`device.json`/`.lssub.json` `package`) — quando presente, tem
   * prioridade sobre `symbolSvg`/algoritmo genérico (ver `componentSymbols.ts`). */
  package?: PackageDescriptor;
  /** Aparência ALTERNATIVA opcional ("Chip or Logic Symbol", igual ao SimulIDE real —
   * `SubPackage::Logic_Symbol`, booleano simples, não uma lista de N variantes). Quando presente,
   * a instância ganha a propriedade `logicSymbol` (boolean) que escolhe entre este e `package` —
   * mesmos pinos elétricos nos dois (não validado à força, só aviso, ver `saveSymbolCommand`). */
  logicSymbolPackage?: PackageDescriptor;
  /** Igual ao `m_graphical` do SimulIDE real (setado por classe em `component.cpp`) -- typeIds "de
   * interação do usuário" (LED, motor, display, switch, ...) que continuam visíveis em Modo Placa
   * dentro de uma sessão de "Abrir Subcircuito"; o resto (resistor, MCU, fonte fixa, lógica pura)
   * fica oculto nesse modo, ver `main.ts::toggleBoardMode`. Ausente == `false`. */
  graphical?: boolean;
  pinCount: number;
  /** Ids elétricos REAIS na ordem que o Core espera (`abi-device`: `device.json` `pins[].id`;
   * `mcu-adapter`: chaves de `mcu.json` `pinMap`, mesma ordem/contagem que `get_pin_map()` do plugin
   * devolve em runtime — ordem importa, ver `NativeMcuAdapterProxy`/`McuComponent::McuComponent`,
   * que casam `requestedPins[i]` posicionalmente com `pinMap()[i]`; `subcircuit-file`:
   * `interface[].pinId`). Ausente == comportamento legado (`pin-1`, `pin-2`, ... genérico) — só
   * builtins sem schema próprio caem nisso hoje. Quando presente, `pinCount` é sempre
   * `pinIds.length` (nunca o tamanho de `package.pins[]`, que conta TAMBÉM pinos puramente visuais/
   * decorativos sem contrapartida elétrica — ver `componentSymbols.ts`/Épico G). */
  pinIds?: string[];
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
  /** Tipo da fonte registrada que originou esta entrada -- usado pela Webview para ajustar menu
   * de contexto ("Abrir Subcircuito" vs "Editar Símbolo") e ações específicas de MCU/QEMU. */
  registeredSourceKind?: "abi-device" | "mcu-adapter" | "subcircuit-file";
  /** `true` quando esta entrada representa um MCU direto (`mcu-adapter`) OU um subcircuito que
   * hospeda um MCU interno (ex: DevKit/WROOM com ESP32 QEMU dentro). */
  mcuHost?: boolean;
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
