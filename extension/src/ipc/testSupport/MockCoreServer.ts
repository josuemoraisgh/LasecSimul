import * as net from "net";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { PROTOCOL_VERSION, RequestEnvelope, ResponseEnvelope } from "../protocol";

export function serverPath(name: string): string {
  return process.platform === "win32"
    ? `\\\\.\\pipe\\${name}`
    : path.join(os.tmpdir(), `${name}.sock`);
}

export function cleanupServerPath(name: string): void {
  if (process.platform !== "win32") {
    try { fs.unlinkSync(serverPath(name)); } catch { /* ignore */ }
  }
}

/** Servidor mock mínimo de IPC do Core, reutilizável por qualquer teste da Extension que precise
 * de um Core falso (handshake + dispatch configurável). */
export class MockCoreServer {
  private server: net.Server;
  private socket: net.Socket | undefined;
  private lineBuffer = "";

  constructor(
    private readonly name: string,
    private readonly protocolVersion = PROTOCOL_VERSION,
    private readonly handler?: (msg: RequestEnvelope) => ResponseEnvelope
  ) {
    this.server = net.createServer((s) => {
      this.socket = s;
      s.on("data", (d: Buffer) => this._onData(d));
    });
  }

  start(): Promise<void> {
    cleanupServerPath(this.name);
    return new Promise((resolve) => this.server.listen(serverPath(this.name), resolve));
  }

  stop(): Promise<void> {
    this.socket?.destroy();
    return new Promise((resolve) => this.server.close(() => { cleanupServerPath(this.name); resolve(); }));
  }

  private _onData(data: Buffer): void {
    this.lineBuffer += data.toString("utf8");
    const lines = this.lineBuffer.split("\n");
    this.lineBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (t) this._handle(t);
    }
  }

  private _handle(raw: string): void {
    const msg = JSON.parse(raw) as RequestEnvelope;
    const resp = this._dispatch(msg);
    this.socket?.write(JSON.stringify(resp) + "\n");
    if (msg.type === "shutdown") this.socket?.destroy();
  }

  private _dispatch(msg: RequestEnvelope): ResponseEnvelope {
    if (msg.type === "hello") {
      return {
        id: msg.id,
        ok: true,
        payload: { serverVersion: "0.1.0", protocolVersion: this.protocolVersion },
      };
    }
    if (this.handler) return this.handler(msg);
    return { id: msg.id, ok: true, payload: {} };
  }
}

// ── utilitários mínimos de execução de suíte usados pelos testes da Extension ────────────────

export interface TestSuiteResult {
  passed: number;
  failed: number;
}

export function createTestRunner(suiteName: string): {
  test: (name: string, fn: () => Promise<void> | void) => Promise<void>;
  finish: () => TestSuiteResult;
} {
  let passed = 0;
  let failed = 0;
  console.log(`\n${suiteName}\n`);
  return {
    test: async (name: string, fn: () => Promise<void> | void): Promise<void> => {
      try {
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
      } catch (e) {
        console.error(`  ✗ ${name}: ${(e as Error).message}`);
        failed++;
      }
    },
    finish: (): TestSuiteResult => {
      console.log(`\nResultado: ${passed} passaram, ${failed} falharam\n`);
      return { passed, failed };
    },
  };
}

export function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
