#!/usr/bin/env node
"use strict";

/**
 * Script agregado de build da Extension (TypeScript).
 *
 * Por que Node.js puro em vez de .ps1/.sh: o briefing do agente 01 lista "scripts acoplados a
 * PowerShell apenas" como risco técnico explícito. Node já é dependência obrigatória do projeto
 * (a Extension é TypeScript/VSCode), então um script .js roda de forma idêntica em Windows, Linux
 * e macOS sem precisar manter um .ps1 e um .sh em paralelo (ver RNF07 do .spec sobre paths e
 * compilação cross-platform, aplicado aqui por analogia a scripts de build).
 *
 * Uso: node scripts/build-extension.js [--watch]
 */

const { spawnSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const extensionDir = path.join(repoRoot, "extension");
const watch = process.argv.includes("--watch");

function run(command, args, cwd) {
  console.log(`[build-extension] ${command} ${args.join(" ")} (cwd=${cwd})`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(`[build-extension] falha ao executar ${command}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

run("npm", ["install"], extensionDir);
run("npm", ["run", watch ? "watch" : "compile"], extensionDir);
