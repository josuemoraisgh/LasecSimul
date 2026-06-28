#!/usr/bin/env node
"use strict";

/**
 * Builda Extension e Core em sequência. Cada um continua sendo um projeto de build independente
 * (Extension via npm/tsc, Core via CMake) -- este script só agrega a chamada dos dois, sem criar
 * dependência cruzada entre eles (ver "Interfaces obrigatórias" do agente 01: não criar dependência
 * TypeScript no Core, não criar dependência C++ na Webview).
 *
 * Uso: node scripts/build-all.js
 */

const path = require("path");
const { spawnSync } = require("child_process");

const scriptsDir = __dirname;

function runScript(scriptName) {
  const result = spawnSync(process.execPath, [path.join(scriptsDir, scriptName)], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

runScript("build-extension.js");
runScript("build-core.js");

console.log("[build-all] Extension e Core buildados com sucesso.");
