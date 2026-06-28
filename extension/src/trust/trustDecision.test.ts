import { createTestRunner, assert } from "../ipc/testSupport/MockCoreServer";
import {
  decisionToPersist,
  isPreApproved,
  isPreBlocked,
  needsConsentPrompt,
  resolveConsentChoice,
  shouldLoadLibrary,
} from "./trustDecision";

(async () => {
  const { test, finish } = createTestRunner("trustDecision — testes puros");

  await test("first-party nunca precisa de consentimento, mesmo sem decisão prévia", () => {
    assert(needsConsentPrompt("first-party", undefined) === false, "first-party não deveria pedir consentimento");
    assert(isPreApproved("first-party", undefined) === true, "first-party deveria ser pré-aprovado");
  });

  await test("publisher desconhecido (sem trust, sem decisão prévia) precisa de consentimento", () => {
    assert(needsConsentPrompt(undefined, undefined) === true, "deveria pedir consentimento");
    assert(isPreApproved(undefined, undefined) === false, "não deveria estar pré-aprovado");
    assert(isPreBlocked(undefined, undefined) === false, "não deveria estar pré-bloqueado");
  });

  await test("decisão 'always' persistida pré-aprova sem novo diálogo", () => {
    assert(needsConsentPrompt("community", "always") === false, "não deveria pedir de novo");
    assert(isPreApproved("community", "always") === true, "deveria estar pré-aprovado");
  });

  await test("decisão 'blocked' persistida pré-bloqueia sem novo diálogo", () => {
    assert(needsConsentPrompt("community", "blocked") === false, "não deveria pedir de novo");
    assert(isPreBlocked("community", "blocked") === true, "deveria estar pré-bloqueado");
  });

  await test("resolveConsentChoice mapeia o texto do botão pra cada escolha", () => {
    assert(resolveConsentChoice("Permitir uma vez") === "allow-once", "permitir uma vez");
    assert(resolveConsentChoice("Sempre confiar") === "always-trust", "sempre confiar");
    assert(resolveConsentChoice("Bloquear") === "block", "bloquear");
    assert(resolveConsentChoice(undefined) === "dismissed", "fechado sem escolha == dismissed");
  });

  await test("shouldLoadLibrary só permite carregar em allow-once/always-trust", () => {
    assert(shouldLoadLibrary("allow-once") === true, "allow-once carrega");
    assert(shouldLoadLibrary("always-trust") === true, "always-trust carrega");
    assert(shouldLoadLibrary("block") === false, "block não carrega");
    assert(shouldLoadLibrary("dismissed") === false, "dismissed não carrega");
  });

  await test("decisionToPersist só persiste always-trust/block, nunca allow-once/dismissed", () => {
    assert(decisionToPersist("always-trust") === "always", "always-trust persiste 'always'");
    assert(decisionToPersist("block") === "blocked", "block persiste 'blocked'");
    assert(decisionToPersist("allow-once") === undefined, "allow-once nunca persiste");
    assert(decisionToPersist("dismissed") === undefined, "dismissed nunca persiste");
  });

  const { failed } = finish();
  process.exitCode = failed > 0 ? 1 : 0;
})();
