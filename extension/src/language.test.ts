import { createTestRunner, assert } from "./ipc/testSupport/MockCoreServer";
import { resolveLasecSimulLanguage } from "./language";

(async () => {
  const { test, finish } = createTestRunner("language — resolveLasecSimulLanguage");

  await test("configuração explícita pt-BR sempre vence, mesmo com sistema em inglês", () => {
    assert(resolveLasecSimulLanguage("pt-BR", "en-US") === "pt-BR", "deveria respeitar pt-BR configurado");
  });

  await test("configuração explícita en sempre vence, mesmo com sistema em português", () => {
    assert(resolveLasecSimulLanguage("en", "pt-BR") === "en", "deveria respeitar en configurado");
  });

  await test("'system' cai pro idioma do VSCode: prefixo 'pt' -> pt-BR", () => {
    assert(resolveLasecSimulLanguage("system", "pt-PT") === "pt-BR", "pt-PT deveria resolver pra pt-BR");
    assert(resolveLasecSimulLanguage("system", "PT-br") === "pt-BR", "case-insensitive");
  });

  await test("'system' cai pro idioma do VSCode: qualquer outro prefixo -> en", () => {
    assert(resolveLasecSimulLanguage("system", "en-US") === "en", "en-US deveria resolver pra en");
    assert(resolveLasecSimulLanguage("system", "es-ES") === "en", "idioma sem suporte cai pra en");
  });

  await test("valor de configuração desconhecido (nem pt-BR, nem en, nem system) cai pro idioma do sistema", () => {
    assert(resolveLasecSimulLanguage("fr", "pt-BR") === "pt-BR", "config inválida degrada pro mesmo caminho de 'system'");
  });

  const { failed } = finish();
  process.exitCode = failed > 0 ? 1 : 0;
})();
