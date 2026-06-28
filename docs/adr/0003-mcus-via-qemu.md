# ADR 0003 - MCUs Via QEMU

## Objetivo

Registrar que MCUs são executados por QEMU.

## Escopo

Integração de microcontroladores no LasecSimul.

## Status

Aceita

## Contexto

MCUs reais exigem execução de firmware real e comportamento de CPU complexo. Reimplementar CPU manualmente aumentaria risco, escopo e manutenção.

## Decisão

Todo MCU roda via QEMU como processo externo. O Core gerencia QEMU por `QemuProcessManager` e integra periféricos por `QemuArenaBridge`.

## Alternativas consideradas

- Emulação manual de CPU no Core: descartada.
- QEMU controlado pela Extension: descartado, pois QEMU pertence ao domínio do Core.
- QMP como caminho principal de reset: fora do MVP.

## Consequências

- Cada chip depende de build QEMU compatível.
- O Core precisa gerenciar processo, logs e ciclo de vida.
- O adapter de chip descreve regiões MMIO e pinos, não protocolo de barramento completo.

## Impacto no projeto

Agentes de MCU devem implementar adapters e bridge, nunca CPU manual.
