# Agente 15 - Integração Final

## Objetivo

Juntar os módulos do MVP e validar o fluxo completo.

## Escopo

Integração do MVP e validação de critérios de aceite.

## Contexto

Este agente atua depois que contratos principais existem. Seu papel é integrar, não redesenhar arquitetura.

## Arquivos que pode criar

- `examples/mvp-passive.lsproj`.
- `examples/esp32-blink/README.md`.
- `docs/mvp-limitacoes.md`.
- `test/integration/MvpIntegrationTest.*`.
- `test/e2e/mvp.spec.ts`.

## Arquivos que pode modificar

- `README.md`.
- `docs/14-integracao-final.md`.
- arquivos de glue necessários entre módulos, com cuidado.

## Arquivos que não pode modificar

- `.spec/**` sem solicitação explícita.
- ABI pública sem coordenação.
- Solver ou IPC para contornar teste.

## Dependências

- Agentes 01 a 14.

## Interfaces obrigatórias

- Extension inicia Core via `CoreClient`.
- Webview envia projeto ao Extension Host.
- Core recebe snapshot por IPC.
- Core gera netlist e roda scheduler.
- QEMU roda apenas quando disponível.

## Tarefas

- [ ] Compilar Extension.
- [ ] Compilar Core.
- [ ] Abrir Webview.
- [ ] Iniciar Core pela Extension.
- [ ] Validar handshake.
- [ ] Criar projeto MVP.
- [ ] Adicionar resistor, capacitor e indutor.
- [ ] Conectar circuito.
- [ ] Enviar circuito ao Core.
- [ ] Rodar simulação passiva.
- [ ] Salvar `.lsproj`.
- [ ] Reabrir `.lsproj`.
- [ ] Rodar testes unitários.
- [ ] Rodar testes de integração.
- [ ] Testar ESP32 blink quando QEMU estiver disponível.
- [ ] Registrar limitações.

## Testes obrigatórios

- [ ] Extension + Core handshake.
- [ ] Projeto passivo completo.
- [ ] Salvar e reabrir.
- [ ] Core crash ou encerramento inesperado tratado.
- [ ] Plugin exemplo carrega.
- [ ] QEMU fake lifecycle.

## Critérios de aceite

- Critérios do MVP em `docs/14-integracao-final.md` atendidos.
- Limitações conhecidas documentadas.
- Nenhum bypass arquitetural foi usado para passar teste.

## Riscos técnicos

- Integrar via atalho que viola fronteiras.
- Teste passar com mock mas falhar no Core real.
- QEMU real indisponível bloquear release do MVP.

## Observações de integração

Se algo não integrar, registrar o contrato quebrado e devolver para o agente dono em vez de criar acoplamento indevido.

## O que não fazer

- Não mover simulação para Extension.
- Não chamar Core direto da Webview.
- Não simular MCU manualmente.
- Não copiar código do SimulIDE-dev.
