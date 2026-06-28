export type LasecSimulLanguage = "pt-BR" | "en";

/** Resolve o idioma efetivo do LasecSimul a partir da configuração `lasecsimul.language` e do
 * idioma do próprio VSCode — função pura (recebe as duas strings já lidas, sem chamar `vscode.*`
 * diretamente) para poder ser testada sem mock de `vscode.workspace`/`vscode.env`. Configuração
 * explícita ("pt-BR"/"en") sempre vence; `"system"` cai pro idioma do VSCode (prefixo "pt" →
 * pt-BR, qualquer outro → en). */
export function resolveLasecSimulLanguage(configured: string, systemLanguage: string): LasecSimulLanguage {
  if (configured === "pt-BR" || configured === "en") return configured;
  return systemLanguage.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}
