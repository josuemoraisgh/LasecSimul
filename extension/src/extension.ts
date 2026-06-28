import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { CoreClient } from "./ipc/CoreClient";
import { CoreProcess } from "./ipc/CoreProcess";
import { IpcError } from "./ipc/protocol";
import { TrustStore } from "./trust/TrustStore";
import { isPreApproved, isPreBlocked, resolveConsentChoice, shouldLoadLibrary, decisionToPersist } from "./trust/trustDecision";
import { SchematicPanel } from "./ui/panels/SchematicPanel";
import { createInitialWebviewState } from "./ui/webview/catalog";
import { PropertySchemaEntry, WebviewComponentCatalogEntry, WebviewComponentModel, WebviewProjectState, WebviewWireModel } from "./ui/webview/model";
import { SimulationStatus, WebviewToHostMessage } from "./ui/webview/messages";
import { ComponentPaletteProvider } from "./ui/tree/ComponentPaletteProvider";
import { ProjectSerializer } from "./project/ProjectSerializer";
import { ProjectComponent, ProjectDocument, createEmptyProject } from "./project/ProjectTypes";
import { loadUnifiedCatalog, RegisteredSource, saveRegisteredSources } from "./catalog/UnifiedCatalog";
import { PropertySchemaDto } from "./ipc/types";
import { hasShowOnSymbolProperty, mergePropertySchemas, nextIndexedLabel } from "./catalog/catalogMerge";
import { LasecSimulLanguage, resolveLasecSimulLanguage } from "./language";

let coreProc: CoreProcess | undefined;
let coreClient: CoreClient | undefined;
let schematicPanel: SchematicPanel | undefined;
let schematicState: WebviewProjectState = createInitialWebviewState();
let simulationStatus: SimulationStatus = "stopped";
let paletteProvider: ComponentPaletteProvider | undefined;
let extensionContext: vscode.ExtensionContext | undefined;
let trustStore: TrustStore | undefined;
const projectSerializer = new ProjectSerializer();

function setSchematicOpenContext(isOpen: boolean): Thenable<void> {
  return vscode.commands.executeCommand("setContext", "lasecsimul.schematicOpen", isOpen);
}

function currentLasecSimulLanguage(): LasecSimulLanguage {
  const configured = vscode.workspace.getConfiguration("lasecsimul").get<string>("language", "system");
  return resolveLasecSimulLanguage(configured, vscode.env.language);
}

type RegisteredItemKind = "abi-device" | "mcu-adapter" | "subcircuit-file";

interface ResolvedRegisteredItem {
  sourceId: string;
  kind: RegisteredItemKind;
  entry: WebviewComponentCatalogEntry;
  libraryPathToLoad?: string;
}

/**
 * componentId da Webview -> instanceId devolvido pelo Core (resposta de "addComponent").
 * Sem entrada == o Core ainda não tem essa instância (typeId sem componente built-in/plugin
 * ainda, ou o Core não está conectado) — quem usa este mapa sempre trata a ausência como
 * "ignora silenciosamente", nunca como erro fatal (ver docs/mvp-limitacoes.md).
 */
const coreInstanceIdByComponentId = new Map<string, string>();

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function cloneState(): WebviewProjectState {
  return JSON.parse(JSON.stringify(schematicState)) as WebviewProjectState;
}

function syncSchematicPanel(): void {
  schematicPanel?.setLanguage(schematicState.locale ?? currentLasecSimulLanguage());
  schematicPanel?.postMessage({ version: 1, type: "syncState", project: cloneState() });
  schematicPanel?.postMessage({ version: 1, type: "simulationStatus", status: simulationStatus });
}

function setSimulationStatus(status: SimulationStatus): void {
  simulationStatus = status;
  schematicPanel?.postMessage({ version: 1, type: "simulationStatus", status });
}

function openSchematicEditor(extensionUri: vscode.Uri): void {
  schematicPanel = SchematicPanel.createOrShow(extensionUri, cloneState(), handleWebviewMessage, () => {
    schematicPanel = undefined;
    void setSchematicOpenContext(false);
  });
  void setSchematicOpenContext(true);
  setSimulationStatus(simulationStatus);
}

/** Localiza o binário do Core dentro de `core/build/`. Geradores single-config (Ninja simples)
 * colocam o executável direto em `core/build/`; geradores multi-config (Visual Studio, Ninja Multi-
 * Config — os dois caminhos documentados no README para Windows) colocam em `core/build/Debug/` ou
 * `core/build/Release/`. Sem checar os dois, a extensão tenta abrir um arquivo que não existe em
 * qualquer build feito com o gerador padrão do Windows. */
function resolveCoreExecutablePath(extensionPath: string): string {
  const coreBin = process.platform === "win32" ? "lasecsimul-core.exe" : "lasecsimul-core";
  const buildDir = path.join(extensionPath, "..", "core", "build");
  const flatPath = path.join(buildDir, coreBin);
  const candidates = [
    flatPath,
    path.join(buildDir, "Debug", coreBin),
    path.join(buildDir, "Release", coreBin),
    path.join(buildDir, "RelWithDebInfo", coreBin),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? flatPath;
}

function normalizeAbsolutePath(basePath: string, inputPath: string): string {
  return path.isAbsolute(inputPath) ? path.normalize(inputPath) : path.normalize(path.resolve(basePath, inputPath));
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

function inferLibraryPathForDevice(deviceFilePath: string): string | undefined {
  const candidate = path.resolve(path.dirname(deviceFilePath), "..", "library.json");
  return fileExists(candidate) ? candidate : undefined;
}

function resolveFolderPath(source: RegisteredSource, fallback: string[]): string[] {
  if (Array.isArray(source.folderPath) && source.folderPath.length > 0) {
    return source.folderPath.map((segment) => String(segment).trim()).filter((segment) => segment.length > 0);
  }
  return fallback;
}

function localizedRegisteredFolder(kind: RegisteredItemKind, language: LasecSimulLanguage): string[] {
  if (kind === "abi-device") return language === "en" ? ["Registered", "ABI"] : ["Registrados", "ABI"];
  if (kind === "mcu-adapter") return language === "en" ? ["Registered", "QEMU"] : ["Registrados", "QEMU"];
  return language === "en" ? ["Registered", "Subcircuits"] : ["Registrados", "Subcircuitos"];
}

function localizedRegisteredRoot(language: LasecSimulLanguage): string {
  return language === "en" ? "Registered" : "Registrados";
}

function localizedAbiFailure(reason: string, language: LasecSimulLanguage): string {
  return language === "en" ? `ABI load failed: ${reason}` : `falha ao carregar ABI: ${reason}`;
}

function localizedBaseCatalogConflict(language: LasecSimulLanguage): string {
  return language === "en" ? "typeId already exists in the base catalog" : "typeId já existe no catálogo base";
}

function localizedManifestName(json: Record<string, unknown>, language: LasecSimulLanguage): string | undefined {
  if (language === "en") {
    const translations = json.translations;
    if (typeof translations === "object" && translations !== null) {
      const en = (translations as Record<string, unknown>).en;
      if (typeof en === "object" && en !== null && typeof (en as Record<string, unknown>).name === "string") {
        return (en as Record<string, string>).name;
      }
    }
  }
  return typeof json.name === "string" ? json.name : undefined;
}

interface DeviceLsconfig {
  typeId?: string;
  label?: string;
  folderPath?: string[];
  icon?: string;
  iconPath?: string;
  symbolSvg?: string;
  pinCount?: number;
  defaultProperties?: Record<string, string | number | boolean>;
}

function inferLsconfigPath(manifestPath: string): string | undefined {
  const direct = path.join(path.dirname(manifestPath), "device.lsconfig");
  if (fileExists(direct)) return direct;
  const sibling = `${manifestPath}.lsconfig`;
  return fileExists(sibling) ? sibling : undefined;
}

function readDeviceLsconfig(source: RegisteredSource, extensionPath: string): { absolutePath?: string; config?: DeviceLsconfig } {
  const resolvedPath = source.lsconfigPath
    ? normalizeAbsolutePath(extensionPath, source.lsconfigPath)
    : inferLsconfigPath(normalizeAbsolutePath(extensionPath, source.filePath));
  if (!resolvedPath || !fileExists(resolvedPath)) return {};
  try {
    return {
      absolutePath: resolvedPath,
      config: readJsonFile(resolvedPath) as DeviceLsconfig,
    };
  } catch {
    return { absolutePath: resolvedPath };
  }
}

function normalizeExistingFilePath(basePath: string, inputPath: string | undefined): string | undefined {
  if (!inputPath || !inputPath.trim()) return undefined;
  const absolutePath = normalizeAbsolutePath(basePath, inputPath);
  return fileExists(absolutePath) ? absolutePath : undefined;
}

function createDisabledEntry(
  source: RegisteredSource,
  kind: RegisteredItemKind,
  typeId: string,
  label: string,
  folderPath: string[],
  reason: string
): ResolvedRegisteredItem {
  const category = folderPath[0] ?? localizedRegisteredRoot(currentLasecSimulLanguage());
  const subcategory = folderPath.length > 1 ? folderPath[1] : undefined;
  return {
    sourceId: source.id,
    kind,
    entry: {
      typeId,
      label,
      pinCount: 2,
      defaultProperties: {},
      category,
      subcategory,
      folderPath,
      disabled: true,
      disabledReason: reason,
      isRegistered: true,
      registeredSourceId: source.id,
      registeredSourceRemovable: source.removable !== false,
      icon: "fantasma",
    },
  };
}

function resolveRegisteredItem(source: RegisteredSource, extensionPath: string, language: LasecSimulLanguage): ResolvedRegisteredItem {
  const absoluteFilePath = normalizeAbsolutePath(extensionPath, source.filePath);
  if (!fileExists(absoluteFilePath)) {
    const fallbackFolder = localizedRegisteredFolder(source.kind, language);
    return createDisabledEntry(
      source,
      source.kind,
      `registered.missing.${source.id}`,
      path.basename(absoluteFilePath),
      resolveFolderPath(source, fallbackFolder),
      "arquivo registrado não encontrado"
    );
  }

  try {
    const json = readJsonFile(absoluteFilePath) as Record<string, unknown>;
    const { absolutePath: absoluteLsconfigPath, config: lsconfig } = readDeviceLsconfig(source, extensionPath);
    if (source.kind === "abi-device" || source.kind === "mcu-adapter") {
      const typeIdKey = source.kind === "mcu-adapter" ? "chipId" : "typeId";
      const typeId = typeof json[typeIdKey] === "string" && String(json[typeIdKey]).trim()
        ? String(json[typeIdKey]).trim()
        : `registered.${source.kind}.${source.id}`;
      const manifestLabel = localizedManifestName(json, language)?.trim();
      const label = typeof lsconfig?.label === "string" && lsconfig.label.trim() ? lsconfig.label.trim() : (manifestLabel || typeId);
      const pins = Array.isArray(json.pins) ? json.pins : [];
      const pinMap = typeof json.pinMap === "object" && json.pinMap !== null ? Object.keys(json.pinMap as Record<string, unknown>) : [];
      const pinCount = typeof lsconfig?.pinCount === "number" && lsconfig.pinCount > 0
        ? lsconfig.pinCount
        : (pins.length > 0 ? pins.length : (pinMap.length > 0 ? pinMap.length : 2));
      const folderPath = resolveFolderPath({
        ...source,
        folderPath: Array.isArray(lsconfig?.folderPath) && lsconfig.folderPath.length > 0 ? lsconfig.folderPath : source.folderPath,
      }, localizedRegisteredFolder(source.kind, language));
      const category = folderPath[0] ?? localizedRegisteredRoot(language);
      const subcategory = folderPath.length > 1 ? folderPath[1] : undefined;
      const libraryPath = source.kind === "mcu-adapter"
        ? undefined
        : (source.libraryPath
          ? normalizeAbsolutePath(extensionPath, source.libraryPath)
          : inferLibraryPathForDevice(absoluteFilePath));
      const iconFilePath = typeof lsconfig?.iconPath === "string" && lsconfig.iconPath.trim()
        ? normalizeExistingFilePath(path.dirname(absoluteLsconfigPath ?? absoluteFilePath), lsconfig.iconPath)
        : undefined;
      const entry: WebviewComponentCatalogEntry = {
        typeId,
        label,
        pinCount,
        defaultProperties: lsconfig?.defaultProperties ?? {},
        category,
        subcategory,
        folderPath,
        icon: lsconfig?.icon,
        iconFilePath,
        symbolSvg: lsconfig?.symbolSvg,
        disabled: false,
        isRegistered: true,
        registeredSourceId: source.id,
        registeredSourceRemovable: source.removable !== false,
      };
      if (source.kind === "abi-device" && (!libraryPath || !fileExists(libraryPath))) {
        return {
          sourceId: source.id,
          kind: source.kind,
          entry: {
            ...entry,
            disabled: true,
            disabledReason: "dispositivo registrado sem library.json valido associado",
            icon: "fantasma",
            iconFilePath: undefined,
          },
        };
      }

      return {
        sourceId: source.id,
        kind: source.kind,
        libraryPathToLoad: source.kind === "abi-device" ? libraryPath : undefined,
        entry,
      };
    }

    const typeId = typeof json.typeId === "string" && json.typeId.trim()
      ? json.typeId
      : `registered.subcircuit.${source.id}`;
    const label = localizedManifestName(json, language)?.trim() ? localizedManifestName(json, language)! : typeId;
    const packagePins =
      typeof json.package === "object" && json.package !== null && Array.isArray((json.package as { pins?: unknown[] }).pins)
        ? ((json.package as { pins: unknown[] }).pins.length || 2)
        : 2;
    const folderPath = resolveFolderPath(source, localizedRegisteredFolder("subcircuit-file", language));
    const category = folderPath[0] ?? localizedRegisteredRoot(language);
    const subcategory = folderPath.length > 1 ? folderPath[1] : undefined;
    return {
      sourceId: source.id,
      kind: source.kind,
      entry: {
        typeId,
        label,
        pinCount: packagePins,
        defaultProperties: {},
        category,
        subcategory,
        folderPath,
        disabled: true,
        disabledReason: "subcircuito registrado (execução ainda indisponível no Core atual)",
        isRegistered: true,
        registeredSourceId: source.id,
        registeredSourceRemovable: source.removable !== false,
        icon: "fantasma",
      },
    };
  } catch (err) {
    const fallbackFolder = localizedRegisteredFolder(source.kind, language);
    return createDisabledEntry(
      source,
      source.kind,
      `registered.error.${source.id}`,
      path.basename(absoluteFilePath),
      resolveFolderPath(source, fallbackFolder),
      `arquivo inválido: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function resolveRegisteredItems(extensionPath: string, sources: RegisteredSource[]): ResolvedRegisteredItem[] {
  const language = currentLasecSimulLanguage();
  return sources.map((source) => resolveRegisteredItem(source, extensionPath, language));
}

function setEffectiveCatalog(entries: WebviewComponentCatalogEntry[]): void {
  schematicState = { ...schematicState, catalog: entries };
  paletteProvider?.setCatalog(entries);
  syncSchematicPanel();
}

/** Lê `publisher`/`trust` do `library.json` e decide se o carregamento pode seguir -- nunca lança:
 * arquivo ilegível/sem esses campos é tratado como publisher "desconhecido", não first-party (o
 * próprio `loadDeviceLibrary` no Core reporta o erro real se o arquivo for inválido de verdade).
 * Ver `.spec/lasecsimul-native-devices.spec` seção 12, item 2 -- consentimento mora na Extension,
 * nunca no Core. */
async function ensureLibraryTrusted(libraryPath: string): Promise<boolean> {
  if (!extensionContext) return false;
  if (!trustStore) trustStore = new TrustStore(extensionContext);

  let manifest: { publisher?: string; trust?: string } = {};
  try {
    manifest = JSON.parse(fs.readFileSync(libraryPath, "utf8"));
  } catch {
    return true; // deixa o Core recusar o arquivo inválido com o erro real
  }
  const publisher = manifest.publisher ?? "desconhecido";
  const stored = trustStore.decisionFor(publisher);

  if (isPreApproved(manifest.trust, stored)) return true;
  if (isPreBlocked(manifest.trust, stored)) return false;

  const buttonLabel = await vscode.window.showWarningMessage(
    `Este pacote contém código nativo sem isolamento e pode travar ou comprometer o simulador. Confiar em "${publisher}"?`,
    { modal: true },
    "Permitir uma vez",
    "Sempre confiar",
    "Bloquear"
  );
  const choice = resolveConsentChoice(buttonLabel);
  const toPersist = decisionToPersist(choice);
  if (toPersist) await trustStore.setDecision(publisher, toPersist);
  return shouldLoadLibrary(choice);
}

/** Carrega no Core bibliotecas declaradas (base + registradas) e devolve mapa de erro por caminho.
 * Falha em uma biblioteca não bloqueia as demais. */
async function loadConfiguredDeviceLibraries(
  extensionPath: string,
  requests: Array<{ displayPath: string; absolutePath: string }>
): Promise<Map<string, string>> {
  const failures = new Map<string, string>();
  if (!coreClient) return failures;

  for (const request of requests) {
    const libraryPath = normalizeAbsolutePath(extensionPath, request.absolutePath);
    try {
      const trusted = await ensureLibraryTrusted(libraryPath);
      if (!trusted) {
        failures.set(libraryPath, "carregamento bloqueado: publisher não confiável (ver consentimento de plugin)");
        continue;
      }
      await coreClient.loadDeviceLibrary(libraryPath);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.set(libraryPath, reason);
      reportCoreWarning(`carregar biblioteca de dispositivos "${request.displayPath}"`, err);
    }
  }

  return failures;
}

function reportCoreWarning(action: string, err: unknown): void {
  const code = err instanceof IpcError && err.code ? ` [${err.code}]` : "";
  vscode.window.showWarningMessage(
    `LasecSimul Core: ${action} falhou${code}: ${err instanceof Error ? err.message : String(err)}`
  );
}

/** Cria a instância no Core de forma assíncrona (fire-and-forget) — usado pelo fluxo interativo da
 * Webview, onde cada ação do usuário já é, por natureza, sequencial no tempo humano. O carregamento
 * de um projeto inteiro usa `pushProjectToCore`, que aguarda cada chamada, exatamente para evitar a
 * corrida que esta versão aceita aqui. */
function pushComponentToCore(
  componentId: string,
  typeId: string,
  properties: Record<string, unknown>,
  pins: Array<{ id: string; x: number; y: number }>
): void {
  if (!coreClient) return;
  coreClient
    .addComponent(typeId, properties, pins)
    .then((instanceId) => coreInstanceIdByComponentId.set(componentId, instanceId))
    .catch((err) => reportCoreWarning(`criar "${typeId}"`, err));
}

function pushWireToCore(wire: WebviewWireModel): void {
  if (!coreClient) return;
  const coreA = coreInstanceIdByComponentId.get(wire.from.componentId);
  const coreB = coreInstanceIdByComponentId.get(wire.to.componentId);
  if (!coreA || !coreB) return; // um dos lados não existe no Core ainda (typeId não suportado)
  coreClient.connectWire(coreA, wire.from.pinId, coreB, wire.to.pinId).catch((err) => reportCoreWarning("conectar fio", err));
}

function pushPropertyToCore(componentId: string, name: string, value: string | number | boolean): void {
  if (!coreClient) return;
  const coreId = coreInstanceIdByComponentId.get(componentId);
  if (!coreId) return;
  coreClient
    .setProperty(coreId, name, value)
    .then(({ requiresRestart }) => {
      if (requiresRestart) {
        vscode.window.showInformationMessage(
          `LasecSimul: a propriedade "${name}" só terá efeito completo depois que o componente for recriado.`
        );
      }
    })
    .catch((err) => reportCoreWarning(`atualizar propriedade "${name}"`, err));
}

function pushRemoveToCore(componentId: string): void {
  if (!coreClient) return;
  const coreId = coreInstanceIdByComponentId.get(componentId);
  if (!coreId) return;
  coreClient.removeComponent(coreId).catch((err) => reportCoreWarning("remover componente", err));
}

let voltageReadoutTimer: ReturnType<typeof setInterval> | undefined;

/** Lê o estado de cada "instruments.voltmeter" no projeto e manda pra Webview — único instrumento
 * com leitura via Webview hoje (ver .spec/lasecsimul.spec sobre instrumentos como plugin ABI).
 * Generaliza naturalmente pra outros: basta interpretar getComponentState() conforme o typeId. */
async function pollInstrumentReadouts(): Promise<void> {
  if (!coreClient || !schematicPanel) return;
  const voltmeters = schematicState.components.filter((component) => component.typeId === "instruments.voltmeter");
  if (voltmeters.length === 0) return;

  const readoutsByComponentId: Record<string, number> = {};
  for (const component of voltmeters) {
    const coreId = coreInstanceIdByComponentId.get(component.id);
    if (!coreId) continue;
    try {
      const state = await coreClient.getComponentState(coreId);
      if (state.length >= 8) readoutsByComponentId[component.id] = state.readDoubleLE(0);
    } catch {
      // instância ainda não assentou ou foi removida nesse meio tempo -- ignora neste tick, tenta de novo no próximo
    }
  }
  schematicPanel.postMessage({ version: 1, type: "componentReadout", readoutsByComponentId });
}

/** Tensão de cada fio (lida em uma das duas pontas — são o mesmo nó elétrico por definição) pra
 * colorir/animar na Webview igual ao SimulIDE (`ConnectorLine::paint`: vermelho se >2.5V, azul
 * senão, só enquanto a simulação está "animada"/rodando). */
async function pollWireVoltages(): Promise<void> {
  if (!coreClient || !schematicPanel) return;
  if (schematicState.wires.length === 0) return;

  const voltagesByWireId: Record<string, number> = {};
  for (const wire of schematicState.wires) {
    const coreFrom = coreInstanceIdByComponentId.get(wire.from.componentId);
    const coreTo = coreInstanceIdByComponentId.get(wire.to.componentId);
    try {
      if (coreFrom) {
        voltagesByWireId[wire.id] = await coreClient.getNodeVoltage(coreFrom, wire.from.pinId);
      } else if (coreTo) {
        voltagesByWireId[wire.id] = await coreClient.getNodeVoltage(coreTo, wire.to.pinId);
      }
    } catch {
      // nó ainda não resolvido (settle loop não rodou pra esse trecho ainda) -- ignora neste tick
    }
  }
  schematicPanel.postMessage({ version: 1, type: "wireVoltages", voltagesByWireId });
}

function startVoltageReadoutPolling(): void {
  if (voltageReadoutTimer) return;
  voltageReadoutTimer = setInterval(() => {
    void pollInstrumentReadouts();
    void pollWireVoltages();
  }, 300);
}

function stopVoltageReadoutPolling(): void {
  if (!voltageReadoutTimer) return;
  clearInterval(voltageReadoutTimer);
  voltageReadoutTimer = undefined;
  // Sem simulação rodando não há tensão "atual" pra mostrar -- volta os fios pra cor neutra em vez
  // de deixar a última cor (vermelho/azul) congelada, o que pareceria que ainda está simulando.
  schematicPanel?.postMessage({ version: 1, type: "wireVoltages", voltagesByWireId: {} });
}

/** Mesma geração de ids de pino que `projectToWebviewState`/a Webview usam ("pin-1".."pin-N", a
 * partir do pinCount do catálogo) — `ProjectComponent` (formato `.lsproj`) não guarda pinos, só
 * `ProjectVisualComponent` (camada visual) guarda posição; os IDS em si são sempre recalculados do
 * catálogo, nunca persistidos, então é isto que tem que mandar pro Core ao reabrir um projeto. */
function runSimulation(): void {
  if (!coreClient) return;
  coreClient
    .run()
    .then(() => {
      startVoltageReadoutPolling();
      setSimulationStatus("running");
      void pollInstrumentReadouts();
      void pollWireVoltages();
    })
    .catch((err) => reportCoreWarning("iniciar simulação", err));
}

function pauseSimulation(): void {
  if (!coreClient) return;
  coreClient
    .pause()
    .then(() => {
      stopVoltageReadoutPolling();
      setSimulationStatus("paused");
    })
    .catch((err) => reportCoreWarning("pausar simulação", err));
}

function stopSimulation(): void {
  if (!coreClient) {
    stopVoltageReadoutPolling();
    setSimulationStatus("stopped");
    return;
  }
  coreClient
    .stopSimulation()
    .catch((err) => reportCoreWarning("parar simulação", err))
    .finally(() => {
      stopVoltageReadoutPolling();
      setSimulationStatus("stopped");
    });
}

function pinsForTypeId(typeId: string): Array<{ id: string; x: number; y: number }> {
  const pinCount = schematicState.catalog.find((item) => item.typeId === typeId)?.pinCount ?? 2;
  return Array.from({ length: pinCount }, (_, index) => ({ id: `pin-${index + 1}`, x: 0, y: index * 12 }));
}

function junctionComponentAt(point: { x: number; y: number }): WebviewComponentModel {
  return {
    id: nextId("junction"),
    typeId: "connectors.junction",
    label: "Junction",
    hidden: true,
    x: point.x,
    y: point.y,
    rotation: 0,
    pins: [{ id: "pin-1", x: 0, y: 0 }],
    properties: {},
  };
}

/** Fila de execução serializada pra `rebuildCoreFromSchematicState` — sem isso, remover vários fios
 * em sequência rápida (ex: `deleteSelectedItems` da Webview, seleção múltipla) dispara várias
 * reconstruções CONCORRENTES, todas lendo/escrevendo `coreInstanceIdByComponentId` ao mesmo tempo:
 * uma reconstrução recria instâncias enquanto outra ainda usa os ids antigos pra `connectWire`,
 * gerando "recriar fio ... falhou: conexão" (sintoma observado, ver docs/mvp-limitacoes.md). Cada
 * chamada nova só começa depois que a anterior (sucesso ou erro) terminou. */
let rebuildQueue: Promise<void> = Promise.resolve();

function queueCoreRebuild(): Promise<void> {
  rebuildQueue = rebuildQueue.then(() => rebuildCoreFromSchematicState()).catch(() => {});
  return rebuildQueue;
}

async function rebuildCoreFromSchematicState(): Promise<void> {
  if (!coreClient) return;

  const runningBeforeRebuild = simulationStatus === "running";
  if (runningBeforeRebuild) {
    try {
      await coreClient.stopSimulation();
    } catch (err) {
      reportCoreWarning("parar simulação antes de reconstruir o circuito", err);
    }
    stopVoltageReadoutPolling();
    setSimulationStatus("stopped");
  }

  const existingInstanceIds = [...coreInstanceIdByComponentId.values()];
  for (const instanceId of existingInstanceIds) {
    try {
      await coreClient.removeComponent(instanceId);
    } catch {
      // Se a instância já sumiu do outro lado, seguimos e reconstruímos o snapshot atual.
    }
  }
  coreInstanceIdByComponentId.clear();

  for (const component of schematicState.components) {
    try {
      const instanceId = await coreClient.addComponent(
        component.typeId,
        component.properties,
        pinsForTypeId(component.typeId)
      );
      coreInstanceIdByComponentId.set(component.id, instanceId);
    } catch (err) {
      reportCoreWarning(`recriar "${component.typeId}" (${component.id})`, err);
    }
  }

  for (const wire of schematicState.wires) {
    const coreA = coreInstanceIdByComponentId.get(wire.from.componentId);
    const coreB = coreInstanceIdByComponentId.get(wire.to.componentId);
    if (!coreA || !coreB) continue;
    try {
      await coreClient.connectWire(coreA, wire.from.pinId, coreB, wire.to.pinId);
    } catch (err) {
      reportCoreWarning(`recriar fio "${wire.id}"`, err);
    }
  }

  if (runningBeforeRebuild) {
    try {
      await coreClient.run();
      startVoltageReadoutPolling();
      setSimulationStatus("running");
      void pollInstrumentReadouts();
      void pollWireVoltages();
    } catch (err) {
      reportCoreWarning("reiniciar simulação após reconstruir o circuito", err);
    }
  }
}

/** Recria um projeto carregado de disco no Core, na ordem certa (todo componente antes de qualquer
 * fio) — diferente do caminho interativo, aqui é preciso aguardar cada chamada porque connectWire
 * depende do instanceId que addComponent ainda não tinha devolvido. */
async function pushProjectToCore(project: ProjectDocument): Promise<void> {
  if (!coreClient) return;
  coreInstanceIdByComponentId.clear();
  for (const component of project.components) {
    try {
      const instanceId = await coreClient.addComponent(
        component.typeId,
        component.properties,
        pinsForTypeId(component.typeId)
      );
      coreInstanceIdByComponentId.set(component.id, instanceId);
    } catch (err) {
      reportCoreWarning(`criar "${component.typeId}" (${component.id})`, err);
    }
  }
  for (const wire of project.wires) {
    const coreA = coreInstanceIdByComponentId.get(wire.from.componentId);
    const coreB = coreInstanceIdByComponentId.get(wire.to.componentId);
    if (!coreA || !coreB) continue;
    try {
      await coreClient.connectWire(coreA, wire.from.pinId, coreB, wire.to.pinId);
    } catch (err) {
      reportCoreWarning(`conectar fio "${wire.id}"`, err);
    }
  }
}

function webviewComponentToProjectComponent(component: WebviewComponentModel): ProjectComponent {
  return {
    id: component.id,
    typeId: component.typeId,
    properties: component.properties,
    label: component.label,
    showId: component.showId,
    showValue: component.showValue,
    flipH: component.flipH,
    flipV: component.flipV,
    visual: { x: component.x, y: component.y, rotation: component.rotation },
  };
}

function validVisualPoints(points: unknown): Array<{ x: number; y: number }> {
  if (!Array.isArray(points)) return [];
  return points
    .filter((point): point is { x: number; y: number } =>
      typeof point === "object" &&
      point !== null &&
      "x" in point &&
      "y" in point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y)
    )
    .map((point) => ({ x: point.x, y: point.y }));
}

function projectToWebviewState(project: ProjectDocument): WebviewProjectState {
  const catalog = schematicState.catalog;
  const visualWirePoints = new Map(
    project.visual.wires.map((wire) => [
      wire.id,
      validVisualPoints(wire.points),
    ])
  );
  const components: WebviewComponentModel[] = project.components.map((component) => {
    const descriptor = catalog.find((item) => item.typeId === component.typeId);
    const pinCount = descriptor?.pinCount ?? 2;
    return {
      id: component.id,
      typeId: component.typeId,
      // Projeto salvo antes desta versão não tem `label` -- cai pro catálogo, igual sempre foi.
      label: component.label ?? descriptor?.label ?? component.typeId,
      hidden: descriptor?.hidden ?? false,
      showId: component.showId,
      showValue: component.showValue ?? hasShowOnSymbolProperty(descriptor),
      flipH: component.flipH,
      flipV: component.flipV,
      x: component.visual?.x ?? 0,
      y: component.visual?.y ?? 0,
      rotation: component.visual?.rotation ?? 0,
      pins: Array.from({ length: pinCount }, (_, index) => ({ id: `pin-${index + 1}`, x: 0, y: index * 12 })),
      properties: component.properties as Record<string, string | number | boolean>,
    };
  });
  const wires: WebviewWireModel[] = project.wires.map((wire) => {
    const points = visualWirePoints.get(wire.id);
    return {
      id: wire.id,
      from: wire.from,
      to: wire.to,
      ...(points && points.length > 0 ? { points } : {}),
    };
  });
  return {
    locale: currentLasecSimulLanguage(),
    catalog,
    components,
    wires,
    viewport: project.visual.viewport,
    selectedComponentIds: [],
    selectedWireIds: [],
  };
}

function handleWebviewMessage(message: WebviewToHostMessage): void {
  if (message.version !== 1) {
    return;
  }
  switch (message.type) {
    case "projectChanged":
      schematicState = message.project;
      return;
    case "requestAddComponent": {
      const descriptor = schematicState.catalog.find((item) => item.typeId === message.typeId);
      const componentId = nextId("component");
      const pinCount = descriptor?.pinCount ?? 2;
      const pins = Array.from({ length: pinCount }, (_, index) => ({
        id: `pin-${index + 1}`,
        x: 0,
        y: index * 12,
      }));
      const baseLabel = descriptor?.label ?? message.typeId;
      const component: WebviewComponentModel = {
        id: componentId,
        typeId: message.typeId,
        label: nextIndexedLabel(message.typeId, baseLabel, schematicState.components),
        hidden: descriptor?.hidden ?? false,
        showValue: hasShowOnSymbolProperty(descriptor),
        x: 140 + schematicState.components.length * 24,
        y: 140 + schematicState.components.length * 24,
        rotation: 0,
        pins,
        properties: { ...(descriptor?.defaultProperties ?? {}) },
      };
      schematicState = {
        ...schematicState,
        components: [...schematicState.components, component],
        selectedComponentIds: [componentId],
        selectedWireIds: [],
      };
      pushComponentToCore(componentId, component.typeId, component.properties, component.pins);
      syncSchematicPanel();
      return;
    }
    case "requestRemoveComponent": {
      pushRemoveToCore(message.componentId);
      coreInstanceIdByComponentId.delete(message.componentId);
      const removedWireIds = new Set(
        schematicState.wires
          .filter((wire) => wire.from.componentId === message.componentId || wire.to.componentId === message.componentId)
          .map((wire) => wire.id)
      );
      schematicState = {
        ...schematicState,
        components: schematicState.components.filter((component) => component.id !== message.componentId),
        wires: schematicState.wires.filter((wire) => wire.from.componentId !== message.componentId && wire.to.componentId !== message.componentId),
        selectedComponentIds: schematicState.selectedComponentIds.filter((id) => id !== message.componentId),
        selectedWireIds: schematicState.selectedWireIds.filter((id) => !removedWireIds.has(id)),
        pendingConnection:
          schematicState.pendingConnection?.componentId === message.componentId ? undefined : schematicState.pendingConnection,
      };
      syncSchematicPanel();
      if (simulationStatus === "running") void pollWireVoltages();
      return;
    }
    case "requestRemoveWire": {
      schematicState = {
        ...schematicState,
        wires: schematicState.wires.filter((wire) => wire.id !== message.wireId),
        selectedWireIds: schematicState.selectedWireIds.filter((id) => id !== message.wireId),
      };
      syncSchematicPanel();
      void queueCoreRebuild().then(() => {
        if (simulationStatus === "running") {
          void pollInstrumentReadouts();
          void pollWireVoltages();
        }
      });
      return;
    }
    case "requestConnectPins": {
      const wire: WebviewWireModel = {
        id: nextId("wire"),
        from: message.from,
        to: message.to,
        points: message.points,
      };
      schematicState = {
        ...schematicState,
        wires: [...schematicState.wires, wire],
        selectedComponentIds: [],
        selectedWireIds: [wire.id],
        pendingConnection: undefined,
      };
      pushWireToCore(wire);
      syncSchematicPanel();
      if (simulationStatus === "running") void pollWireVoltages();
      return;
    }
    case "requestConnectPinToWire": {
      const existingWire = schematicState.wires.find((wire) => wire.id === message.wireId);
      if (!existingWire) return;
      const junction = junctionComponentAt(message.point);
      const firstWire: WebviewWireModel = {
        id: nextId("wire"),
        from: existingWire.from,
        to: { componentId: junction.id, pinId: "pin-1" },
        points: message.existingWireFirstPoints,
      };
      const secondWire: WebviewWireModel = {
        id: nextId("wire"),
        from: { componentId: junction.id, pinId: "pin-1" },
        to: existingWire.to,
        points: message.existingWireSecondPoints,
      };
      const newWire: WebviewWireModel = {
        id: nextId("wire"),
        from: message.from,
        to: { componentId: junction.id, pinId: "pin-1" },
        points: message.points,
      };
      schematicState = {
        ...schematicState,
        components: [...schematicState.components, junction],
        wires: [
          ...schematicState.wires.filter((wire) => wire.id !== message.wireId),
          firstWire,
          secondWire,
          newWire,
        ],
        selectedComponentIds: [],
        selectedWireIds: [newWire.id],
        pendingConnection: undefined,
      };
      syncSchematicPanel();
      void queueCoreRebuild().then(() => {
        if (simulationStatus === "running") {
          void pollInstrumentReadouts();
          void pollWireVoltages();
        }
      });
      return;
    }
    case "requestRotateComponent": {
      schematicState = {
        ...schematicState,
        components: schematicState.components.map((component) =>
          component.id === message.componentId ? { ...component, rotation: message.rotation } : component
        ),
      };
      syncSchematicPanel();
      return;
    }
    case "requestFlipComponent": {
      schematicState = {
        ...schematicState,
        components: schematicState.components.map((component) =>
          component.id === message.componentId
            ? { ...component, flipH: message.flipH, flipV: message.flipV }
            : component
        ),
      };
      syncSchematicPanel();
      return;
    }
    case "requestRenameComponent": {
      schematicState = {
        ...schematicState,
        components: schematicState.components.map((component) =>
          component.id === message.componentId ? { ...component, label: message.label } : component
        ),
      };
      syncSchematicPanel();
      return;
    }
    case "requestUpdateLabelVisibility": {
      // Puramente visual -- nunca toca o Core (ver `.spec/lasecsimul.spec` seção 6.1.2: visibilidade
      // de rótulo não é uma propriedade elétrica, não tem schema de plugin/built-in nenhum).
      schematicState = {
        ...schematicState,
        components: schematicState.components.map((component) =>
          component.id === message.componentId
            ? { ...component, showId: message.showId, showValue: message.showValue }
            : component
        ),
      };
      syncSchematicPanel();
      return;
    }
    case "requestUpdateProperty": {
      schematicState = {
        ...schematicState,
        components: schematicState.components.map((component) =>
          component.id === message.componentId
            ? { ...component, properties: { ...component.properties, [message.name]: message.value } }
            : component
        ),
      };
      pushPropertyToCore(message.componentId, message.name, message.value);
      syncSchematicPanel();
      if (simulationStatus === "running") {
        void pollInstrumentReadouts();
        void pollWireVoltages();
      }
      return;
    }
    case "requestRunSimulation":
      runSimulation();
      return;
    case "requestPauseSimulation":
      pauseSimulation();
      return;
    case "requestStopSimulation":
      stopSimulation();
      return;
    case "requestSaveProject":
      void saveProjectCommand();
      return;
    case "requestOpenProject":
      if (extensionContext) void openProjectCommand(extensionContext);
      return;
  }
}

async function saveProjectCommand(): Promise<void> {
  const uri = await vscode.window.showSaveDialog({ filters: { "LasecSimul Project": ["lsproj"] } });
  if (!uri) return;
  const project: ProjectDocument = {
    ...createEmptyProject(),
    components: schematicState.components.map(webviewComponentToProjectComponent),
    wires: schematicState.wires.map((wire) => ({ id: wire.id, from: wire.from, to: wire.to })),
    visual: {
      components: [],
      wires: schematicState.wires
        .filter((wire) => wire.points && wire.points.length > 0)
        .map((wire) => ({ id: wire.id, points: wire.points })),
      viewport: schematicState.viewport,
    },
  };
  await projectSerializer.save(uri.fsPath, project);
  vscode.window.showInformationMessage(`Projeto LasecSimul salvo em ${uri.fsPath}`);
}

async function openProjectCommand(context: vscode.ExtensionContext): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    filters: { "LasecSimul Project": ["lsproj"] },
    canSelectMany: false,
  });
  const selected = uris?.[0];
  if (!selected) return;
  const project = await projectSerializer.load(selected.fsPath);
  schematicState = projectToWebviewState(project);
  if (!schematicPanel) openSchematicEditor(context.extensionUri);
  syncSchematicPanel();
  await rebuildCoreFromSchematicState();
}

function nextSourceId(): string {
  return `registered-source-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function inferSourcesFromSelectedFile(extensionPath: string, selectedPath: string): RegisteredSource[] {
  const absoluteSelectedPath = normalizeAbsolutePath(extensionPath, selectedPath);
  const fileName = path.basename(absoluteSelectedPath).toLowerCase();
  const sources: RegisteredSource[] = [];

  const json = readJsonFile(absoluteSelectedPath) as Record<string, unknown>;

  if (fileName === "library.json") {
    const abiEntries = Array.isArray(json.devices) ? json.devices : [];
    for (const value of abiEntries) {
      if (typeof value !== "object" || value === null) continue;
      const deviceEntry = value as { manifest?: unknown };
      if (typeof deviceEntry.manifest !== "string" || !deviceEntry.manifest.trim()) continue;
      const manifestPath = path.resolve(path.dirname(absoluteSelectedPath), deviceEntry.manifest);
      sources.push({
        id: nextSourceId(),
        kind: "abi-device",
        filePath: manifestPath,
        libraryPath: absoluteSelectedPath,
        lsconfigPath: inferLsconfigPath(manifestPath),
      });
    }

    const mcuEntries = Array.isArray(json.mcus) ? json.mcus : [];
    for (const value of mcuEntries) {
      if (typeof value !== "object" || value === null) continue;
      const mcuEntry = value as { manifest?: unknown };
      if (typeof mcuEntry.manifest !== "string" || !mcuEntry.manifest.trim()) continue;
      const manifestPath = path.resolve(path.dirname(absoluteSelectedPath), mcuEntry.manifest);
      sources.push({
        id: nextSourceId(),
        kind: "mcu-adapter",
        filePath: manifestPath,
        libraryPath: absoluteSelectedPath,
        lsconfigPath: inferLsconfigPath(manifestPath),
      });
    }

    const subEntries = Array.isArray(json.subcircuits) ? json.subcircuits : [];
    for (const value of subEntries) {
      if (typeof value !== "object" || value === null) continue;
      const subEntry = value as { manifest?: unknown };
      if (typeof subEntry.manifest !== "string" || !subEntry.manifest.trim()) continue;
      const manifestPath = path.resolve(path.dirname(absoluteSelectedPath), subEntry.manifest);
      sources.push({
        id: nextSourceId(),
        kind: "subcircuit-file",
        filePath: manifestPath,
      });
    }

    return sources;
  }

  if (fileName.endsWith(".lssub.json")) {
    sources.push({
      id: nextSourceId(),
      kind: "subcircuit-file",
      filePath: absoluteSelectedPath,
    });
    return sources;
  }

  const hasChipId = typeof json.chipId === "string" && json.chipId.trim().length > 0;
  const hasNativeEntry = typeof json.nativeEntry === "object" && json.nativeEntry !== null;
  if (fileName === "mcu.json" || hasChipId) {
    sources.push({
      id: nextSourceId(),
      kind: "mcu-adapter",
      filePath: absoluteSelectedPath,
      libraryPath: inferLibraryPathForDevice(absoluteSelectedPath),
      lsconfigPath: inferLsconfigPath(absoluteSelectedPath),
    });
    return sources;
  }

  if (fileName === "device.json" || hasNativeEntry) {
    sources.push({
      id: nextSourceId(),
      kind: "abi-device",
      filePath: absoluteSelectedPath,
      libraryPath: inferLibraryPathForDevice(absoluteSelectedPath),
      lsconfigPath: inferLsconfigPath(absoluteSelectedPath),
    });
    return sources;
  }

  const looksLikeSubcircuit = Array.isArray(json.components) && Array.isArray(json.wires) && Array.isArray(json.interface);
  if (looksLikeSubcircuit) {
    sources.push({
      id: nextSourceId(),
      kind: "subcircuit-file",
      filePath: absoluteSelectedPath,
    });
  }

  return sources;
}

async function refreshUnifiedCatalogState(loadLibrariesInCore: boolean): Promise<void> {
  if (!extensionContext) return;
  const unifiedCatalog = loadUnifiedCatalog(extensionContext.extensionPath, currentLasecSimulLanguage());
  const resolved = resolveRegisteredItems(extensionContext.extensionPath, unifiedCatalog.registeredSources);

  const requests = new Map<string, { displayPath: string; absolutePath: string }>();
  for (const relativePath of unifiedCatalog.deviceLibraries) {
    const absolutePath = normalizeAbsolutePath(extensionContext.extensionPath, relativePath);
    requests.set(absolutePath, { displayPath: relativePath, absolutePath });
  }
  for (const item of resolved) {
    if (!item.libraryPathToLoad) continue;
    const absolutePath = normalizeAbsolutePath(extensionContext.extensionPath, item.libraryPathToLoad);
    if (!requests.has(absolutePath)) {
      requests.set(absolutePath, { displayPath: absolutePath, absolutePath });
    }
  }

  const failures = loadLibrariesInCore
    ? await loadConfiguredDeviceLibraries(extensionContext.extensionPath, [...requests.values()])
    : new Map<string, string>();

  const baseTypeIds = new Set(unifiedCatalog.catalog.map((entry) => entry.typeId));
  const registeredEntries = resolved.map((item) => {
    const failedReason = item.libraryPathToLoad
      ? failures.get(normalizeAbsolutePath(extensionContext!.extensionPath, item.libraryPathToLoad))
      : undefined;
    if (failedReason) {
      return {
        ...item.entry,
        disabled: true,
        disabledReason: localizedAbiFailure(failedReason, currentLasecSimulLanguage()),
      };
    }
    if (baseTypeIds.has(item.entry.typeId)) {
      return {
        ...item.entry,
        disabled: true,
        disabledReason: localizedBaseCatalogConflict(currentLasecSimulLanguage()),
      };
    }
    return item.entry;
  });

  const mergedCatalog = [...unifiedCatalog.catalog, ...registeredEntries];
  setEffectiveCatalog(loadLibrariesInCore ? await attachPropertySchemas(mergedCatalog) : mergedCatalog);
}

/** Anexa o schema rico de propriedades (grupo/editor/min/max/opções/flags) de cada typeId, vindo do
 * Core via `getPropertySchemas` — só tentado quando `loadLibrariesInCore` (ou seja, quando o
 * `coreClient` já deveria estar conectado); best-effort: se falhar (Core ainda não respondeu, por
 * exemplo), o catálogo segue sem schema e o diálogo de propriedades cai pra inferência (ver
 * `resolvePropertyFields` na Webview). Schema é por typeId (catálogo), nunca por instância. */
async function attachPropertySchemas(
  catalog: WebviewComponentCatalogEntry[]
): Promise<WebviewComponentCatalogEntry[]> {
  if (!coreClient) return catalog;
  let schemasByTypeId: Record<string, PropertySchemaDto[]>;
  try {
    schemasByTypeId = await coreClient.getPropertySchemas(currentLasecSimulLanguage());
  } catch {
    return catalog; // Core ainda não respondeu -- catálogo sem schema, inferência cobre o resto
  }
  return mergePropertySchemas(catalog, schemasByTypeId);
}

async function registerCatalogFileCommand(): Promise<void> {
  if (!extensionContext) return;
  const ctx = extensionContext;
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: {
      JSON: ["json"],
    },
    title: "Registrar arquivo ABI/QEMU/Subcircuito no LasecSimul",
  });
  const selected = picked?.[0];
  if (!selected) return;

  let newSources: RegisteredSource[] = [];
  try {
    newSources = inferSourcesFromSelectedFile(ctx.extensionPath, selected.fsPath);
  } catch (err) {
    vscode.window.showErrorMessage(
      `Não foi possível registrar arquivo: ${err instanceof Error ? err.message : String(err)}`
    );
    return;
  }

  if (newSources.length === 0) {
    vscode.window.showWarningMessage("Arquivo não reconhecido como ABI, QEMU (mcu/library) nem subcircuito.");
    return;
  }

  const unifiedCatalog = loadUnifiedCatalog(ctx.extensionPath, currentLasecSimulLanguage());
  const existingKeys = new Set(
    unifiedCatalog.registeredSources.map((source) => `${source.kind}::${normalizeAbsolutePath(ctx.extensionPath, source.filePath)}`)
  );
  const deduped = newSources.filter((source) => {
    const key = `${source.kind}::${normalizeAbsolutePath(ctx.extensionPath, source.filePath)}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  if (deduped.length === 0) {
    vscode.window.showInformationMessage("Esses itens já estavam registrados na paleta.");
    return;
  }

  const mergedSources = [...unifiedCatalog.registeredSources, ...deduped];
  const savedAt = saveRegisteredSources(ctx.extensionPath, mergedSources);
  await refreshUnifiedCatalogState(true);
  vscode.window.showInformationMessage(`Registro concluído (${deduped.length} item(ns)). Catálogo salvo em ${savedAt}.`);
}

async function removeRegisteredCatalogItemCommand(item?: { sourceId?: string }): Promise<void> {
  if (!extensionContext) return;
  const sourceId = typeof item?.sourceId === "string" ? item.sourceId : undefined;
  if (!sourceId) {
    vscode.window.showWarningMessage("Selecione um item registrado na paleta para remover.");
    return;
  }

  const unifiedCatalog = loadUnifiedCatalog(extensionContext.extensionPath, currentLasecSimulLanguage());
  const source = unifiedCatalog.registeredSources.find((value) => value.id === sourceId);
  if (!source) {
    vscode.window.showWarningMessage("Item registrado não encontrado no catálogo.");
    return;
  }

  if (source.removable === false) {
    vscode.window.showInformationMessage("Esse item faz parte do catÃ¡logo integrado e nÃ£o pode ser removido pela paleta.");
    return;
  }

  const decision = await vscode.window.showWarningMessage(
    "Remover item registrado da paleta?",
    { modal: true },
    "Remover"
  );
  if (decision !== "Remover") return;

  const nextSources = unifiedCatalog.registeredSources.filter((value) => value.id !== sourceId);
  saveRegisteredSources(extensionContext.extensionPath, nextSources);
  await refreshUnifiedCatalogState(true);
  vscode.window.showInformationMessage("Item removido da paleta de componentes.");
}

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  const unifiedCatalog = loadUnifiedCatalog(context.extensionPath, currentLasecSimulLanguage());
  const initialResolved = resolveRegisteredItems(context.extensionPath, unifiedCatalog.registeredSources);
  schematicState = createInitialWebviewState([
    ...unifiedCatalog.catalog,
    ...initialResolved.map((item) => item.entry),
  ]);
  schematicState.locale = currentLasecSimulLanguage();

  const corePath = resolveCoreExecutablePath(context.extensionPath);
  const pipeName = CoreProcess.defaultPipeName();

  coreProc = new CoreProcess({ executablePath: corePath, pipeName });
  coreProc.onError((err) => {
    vscode.window.showErrorMessage(
      `LasecSimul Core: não foi possível iniciar "${corePath}" (${err.message}). ` +
        `Compile o Core antes (npm run build:core) e confirme que o gerador usado coloca o binário ` +
        `em core/build/ ou core/build/<Config>/.`
    );
  });
  try {
    coreProc.start();
  } catch (err) {
    vscode.window.showErrorMessage(
      `LasecSimul Core: falha ao iniciar processo: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  coreProc.onExit((code) => {
    // RNF: Core caiu → reiniciar + restaurar snapshot (ver lasecsimul-native-devices.spec §12.5)
    vscode.window.showWarningMessage(`LasecSimul Core terminou (code ${code}). Reinicie a simulação.`);
    coreClient = undefined;
  });

  coreClient = new CoreClient(pipeName);
  // Conecta de forma assíncrona — não bloqueia a ativação da extensão
  coreClient
    .start()
    .then(() => refreshUnifiedCatalogState(true))
    .catch((err) => {
      vscode.window.showErrorMessage(
        `Falha ao conectar ao LasecSimul Core: ${err instanceof Error ? err.message : String(err)}`
      );
    });

  paletteProvider = new ComponentPaletteProvider(context.extensionUri, schematicState.catalog);
  const paletteView = vscode.window.createTreeView("lasecsimul.componentPalette", {
    treeDataProvider: paletteProvider,
    showCollapseAll: true,
  });

  const addPaletteComponent = (typeId: string) => {
    if (!schematicPanel) openSchematicEditor(context.extensionUri);
    schematicPanel?.postMessage({ version: 1, type: "requestAddComponent", typeId });
  };

  context.subscriptions.push(
    paletteView,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("lasecsimul.language")) return;
      schematicState = { ...schematicState, locale: currentLasecSimulLanguage() };
      void refreshUnifiedCatalogState(Boolean(coreClient));
      syncSchematicPanel();
    }),
    vscode.commands.registerCommand("lasecsimul.openSchematicEditor", () => openSchematicEditor(context.extensionUri)),
    vscode.commands.registerCommand("lasecsimul.newSubcircuit", () => {}),
    vscode.commands.registerCommand("lasecsimul.openSettings", () => {}),
    vscode.commands.registerCommand("lasecsimul.palette.addComponent", (typeId: string) => addPaletteComponent(typeId)),
    vscode.commands.registerCommand("lasecsimul.run", () => runSimulation()),
    vscode.commands.registerCommand("lasecsimul.pause", () => pauseSimulation()),
    vscode.commands.registerCommand("lasecsimul.stop", () => stopSimulation()),
    vscode.commands.registerCommand("lasecsimul.saveProject", () => saveProjectCommand()),
    vscode.commands.registerCommand("lasecsimul.openProject", () => openProjectCommand(context)),
    vscode.commands.registerCommand("lasecsimul.palette.registerFile", () => registerCatalogFileCommand()),
    vscode.commands.registerCommand("lasecsimul.palette.removeRegistered", (item: { sourceId?: string }) =>
      removeRegisteredCatalogItemCommand(item)
    ),
    // Keybinding em contributes.keybindings ("when": activeWebviewPanelId == 'lasecsimul.schematic')
    // sobrepõe Ctrl+R/Ctrl+Shift+R do VSCode SÓ enquanto o painel do esquemático está em foco --
    // fora dele, o `when` deixa de casar e o atalho nativo do VSCode volta a funcionar sozinho, sem
    // nenhuma lógica de restauração aqui (ver `.spec/lasecsimul.spec` seção 13.4).
    vscode.commands.registerCommand("lasecsimul.rotateSelectionCw", () => {
      schematicPanel?.postMessage({ version: 1, type: "requestRotateSelection", direction: "cw" });
    }),
    vscode.commands.registerCommand("lasecsimul.rotateSelectionCcw", () => {
      schematicPanel?.postMessage({ version: 1, type: "requestRotateSelection", direction: "ccw" });
    }),
    vscode.commands.registerCommand("lasecsimul.flipSelectionHorizontal", () => {
      schematicPanel?.postMessage({ version: 1, type: "requestFlipSelection", axis: "horizontal" });
    }),
    vscode.commands.registerCommand("lasecsimul.flipSelectionVertical", () => {
      schematicPanel?.postMessage({ version: 1, type: "requestFlipSelection", axis: "vertical" });
    }),
  );

  void setSchematicOpenContext(false);
  void refreshUnifiedCatalogState(false);
}

export async function deactivate(): Promise<void> {
  stopVoltageReadoutPolling();
  await coreClient?.stop().catch(() => {});
  coreProc?.kill(); // force-kill de segurança caso shutdown IPC não tenha chegado
}
