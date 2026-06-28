export interface PropertySchemaOption {
  value: string;
  label: string;
}

/** Espelha 1:1 o JSON devolvido pelo Core (`propertySchemaToJson` em `CoreApplication.cpp`) — mesmo
 * schema rico que `device.json` já declara pra plugins, agora também devolvido pra built-ins
 * (`ComponentMetadataRegistry`, populado em `registerBuiltinComponents`). Schema é por `typeId`
 * (catálogo), nunca por instância — ver `getPropertySchemas` no Core. */
export interface PropertySchemaDto {
  id: string;
  label: string;
  group: string;
  unit: string;
  valueKind: "number" | "string" | "bool" | "point";
  editor: string;
  default: number | string | boolean | { x: number; y: number };
  min?: number;
  max?: number;
  step?: number;
  options?: PropertySchemaOption[];
  hidden: boolean;
  readOnly: boolean;
  noCopy: boolean;
  affectsTopology: boolean;
  requiresRestart: boolean;
  showOnSymbol: boolean;
}

export interface TelemetrySample {
  instanceId: string;
  pinId: string;
  timeNs: bigint;
  value: number;
}

export interface DeviceLibraryManifest {
  publisher: string;
  version: string;
  devices: { typeId: string; manifestPath: string }[];
}
