import { WebviewComponentCatalogEntry, WebviewProjectState } from "./model";

// Categoria/subcategoria/label usam o nome EXATO da taxonomia do SimulIDE (itemlibrary.cpp +
// traducao pt_BR) - ver docs/15-taxonomia-paleta.md pra tabela completa (inclusive os ~130 itens
// do SimulIDE que o LasecSimul ainda nao implementa). Ao adicionar um componente novo, achar a
// categoria correspondente la ANTES de inventar uma nova aqui.
export const defaultComponentCatalog: WebviewComponentCatalogEntry[] = [
  { typeId: "connectors.junction", label: "Juncao", category: "Conectores", folderPath: ["Conectores"], icon: "tunel", pinCount: 1, defaultProperties: {}, hidden: true },
  { typeId: "sources.dc_voltage", label: "Fonte de Tensao", category: "Fontes", folderPath: ["Fontes"], icon: "fonte-de-tensao", pinCount: 2, defaultProperties: { voltage: 5 } },
  { typeId: "other.ground", label: "Terra (0 V)", category: "Fontes", folderPath: ["Fontes"], icon: "terra", pinCount: 1, defaultProperties: {} },
  { typeId: "logic.button", label: "Botao", category: "Interruptores", folderPath: ["Interruptores"], icon: "botao", pinCount: 2, defaultProperties: { pressed: false } },
  { typeId: "passive.resistor", label: "Resistor", category: "Passivos", subcategory: "Resistores", folderPath: ["Passivos", "Resistores"], icon: "resistor", pinCount: 2, defaultProperties: { resistance: 1000 } },
  { typeId: "passive.capacitor", label: "Capacitor", category: "Passivos", subcategory: "Reativo", folderPath: ["Passivos", "Reativo"], icon: "capacitor", pinCount: 2, defaultProperties: { capacitance: 1e-6 } },
  { typeId: "passive.inductor", label: "Indutor", category: "Passivos", subcategory: "Reativo", folderPath: ["Passivos", "Reativo"], icon: "inductor", pinCount: 2, defaultProperties: { inductance: 1e-3 } },
  { typeId: "connectors.tunnel", label: "Tunel", category: "Conectores", folderPath: ["Conectores"], icon: "tunel", pinCount: 1, defaultProperties: {} },
];

// Removidos do catalogo ate terem ComponentRegistry::registerFactory real no Core (ver
// docs/mvp-limitacoes.md): semiconductors.diode/transistor_npn/transistor_pnp e logic.led exigem
// modelo nao-linear (sem Newton-Raphson real ainda, so o contrato/mecanica em IComponentModel) -
// modela-los como resistor linear seria fisicamente incorreto. MCUs/ABIs externos entram pelo
// catalogo unificado via `registeredSources` + `.lsconfig`, nao por hardcode aqui. Novos MCUs
// devem seguir a taxonomia ja mapeada em docs/15-taxonomia-paleta.md ("Microcontroladores" >
// plataforma/chip).

export function createInitialWebviewState(catalog: WebviewComponentCatalogEntry[] = defaultComponentCatalog): WebviewProjectState {
  return {
    locale: "pt-BR",
    catalog,
    components: [],
    wires: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedComponentIds: [],
    selectedWireIds: [],
  };
}
