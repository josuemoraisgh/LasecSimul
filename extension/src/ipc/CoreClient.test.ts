import * as net from "net";
import { CoreClient } from "./CoreClient";
import { PROTOCOL_VERSION, RequestEnvelope, ResponseEnvelope } from "./protocol";
import { MockCoreServer, serverPath, cleanupServerPath as cleanup, createTestRunner, assert } from "./testSupport/MockCoreServer";

// ── suite de testes ───────────────────────────────────────────────────────────

const { test, finish } = createTestRunner("CoreClient — testes de IPC");

(async () => {
  await test("Extension inicia Core (mock) e conecta", async () => {
    const name = `lasecsimul-test-start-${process.pid}`;
    const server = new MockCoreServer(name);
    await server.start();
    const client = new CoreClient(name, { requestTimeoutMs: 1_000 });
    await client.start();
    await client.stop();
    await server.stop();
  });

  await test("Handshake compatível passa", async () => {
    const name = `lasecsimul-test-compat-${process.pid}`;
    const server = new MockCoreServer(name, PROTOCOL_VERSION);
    await server.start();
    const client = new CoreClient(name, { requestTimeoutMs: 1_000 });
    await client.start(); // não deve lançar
    await client.stop();
    await server.stop();
  });

  await test("Handshake incompatível falha com erro de versão", async () => {
    const name = `lasecsimul-test-incompat-${process.pid}`;
    const server = new MockCoreServer(name, PROTOCOL_VERSION + 99);
    await server.start();
    const client = new CoreClient(name, { requestTimeoutMs: 1_000 });
    let threw = false;
    try { await client.start(); } catch { threw = true; }
    await server.stop();
    assert(threw, "deveria lançar erro de protocolo incompatível");
  });

  await test("Timeout retorna erro de requisição", async () => {
    const name = `lasecsimul-test-timeout-${process.pid}`;
    cleanup(name);
    // Servidor que responde ao hello mas ignora requisições seguintes
    let acceptedSocket: net.Socket | undefined;
    const srv = net.createServer((s) => {
      acceptedSocket = s;
      let buf = "";
      let handshakeDone = false;
      s.on("data", (d: Buffer) => {
        buf += d.toString();
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          const msg = JSON.parse(t) as RequestEnvelope;
          if (!handshakeDone && msg.type === "hello") {
            handshakeDone = true;
            const r: ResponseEnvelope = {
              id: msg.id, ok: true,
              payload: { serverVersion: "0.1.0", protocolVersion: PROTOCOL_VERSION },
            };
            s.write(JSON.stringify(r) + "\n");
          }
          // demais requisições são ignoradas → timeout
        }
      });
    });
    await new Promise<void>((r) => srv.listen(serverPath(name), r));

    const client = new CoreClient(name, { requestTimeoutMs: 200 }); // timeout curto para o teste
    await client.start();
    let threw = false;
    try { await client.request("pausar", {}); } catch { threw = true; }
    assert(threw, "request sem resposta deve expirar com erro");
    acceptedSocket?.destroy();
    await new Promise<void>((r) => srv.close(() => { cleanup(name); r(); }));
  });

  await test("Shutdown limpa socket e rejeita requisições futuras", async () => {
    const name = `lasecsimul-test-shutdown-${process.pid}`;
    const server = new MockCoreServer(name);
    await server.start();
    const client = new CoreClient(name, { requestTimeoutMs: 1_000 });
    await client.start();
    await client.stop();
    let threw = false;
    try { await client.request("hello", {}); } catch { threw = true; }
    assert(threw, "request após stop() deve lançar erro");
    await server.stop();
  });

  await test("Core encerrado inesperadamente rejeita requisições pendentes", async () => {
    const name = `lasecsimul-test-crash-${process.pid}`;
    cleanup(name);
    const srv = net.createServer((s) => {
      let buf = "";
      s.on("data", (d: Buffer) => {
        buf += d.toString();
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          const msg = JSON.parse(t) as RequestEnvelope;
          if (msg.type === "hello") {
            const r: ResponseEnvelope = {
              id: msg.id, ok: true,
              payload: { serverVersion: "0.1.0", protocolVersion: PROTOCOL_VERSION },
            };
            s.write(JSON.stringify(r) + "\n");
          } else {
            s.destroy(); // simula crash
          }
        }
      });
    });
    await new Promise<void>((r) => srv.listen(serverPath(name), r));
    const client = new CoreClient(name, { requestTimeoutMs: 2_000 });
    await client.start();
    let threw = false;
    try { await client.request("start", {}); } catch { threw = true; }
    assert(threw, "requisição pendente deve ser rejeitada quando Core fecha conexão");
    await new Promise<void>((r) => srv.close(() => { cleanup(name); r(); }));
  });

  const { failed } = finish();
  process.exitCode = failed > 0 ? 1 : 0;
})();
