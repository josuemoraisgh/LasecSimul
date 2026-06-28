export const LS_PROJ_SCHEMA_VERSION = 1 as const;

export interface ProjectSimulationSettings {
  frequencyHz?: number;
  timeScale?: number;
  paused?: boolean;
}

export interface ProjectVisualPin {
  id: string;
  x: number;
  y: number;
}

export interface ProjectVisualComponent {
  id: string;
  typeId: string;
  x: number;
  y: number;
  rotation?: 0 | 90 | 180 | 270;
  selected?: boolean;
  pins?: ProjectVisualPin[];
}

export interface ProjectWire {
  id: string;
  from: { componentId: string; pinId: string };
  to: { componentId: string; pinId: string };
}

export interface ProjectComponent {
  id: string;
  typeId: string;
  properties: Record<string, unknown>;
  /** Nome com índice (ex: "Resistor-1") — ausente em projetos salvos antes desta versão; recalculado
   * a partir do catálogo nesse caso (mesmo comportamento de sempre, ver `projectToWebviewState`). */
  label?: string;
  showId?: boolean;
  showValue?: boolean;
  flipH?: boolean;
  flipV?: boolean;
  visual?: {
    x?: number;
    y?: number;
    rotation?: 0 | 90 | 180 | 270;
  };
}

export interface ProjectFirmwareConfig {
  chipId: string;
  firmwarePath: string;
  arguments?: string[];
}

export interface ProjectDocument {
  schemaVersion: number;
  components: ProjectComponent[];
  wires: ProjectWire[];
  visual: {
    components: ProjectVisualComponent[];
    wires: Array<{ id: string; selected?: boolean; points?: { x: number; y: number }[] }>;
    viewport: { x: number; y: number; zoom: number };
  };
  simulationSettings: ProjectSimulationSettings;
  mcuFirmware?: ProjectFirmwareConfig[];
}

export function createEmptyProject(): ProjectDocument {
  return {
    schemaVersion: LS_PROJ_SCHEMA_VERSION,
    components: [],
    wires: [],
    visual: {
      components: [],
      wires: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    simulationSettings: {},
  };
}
