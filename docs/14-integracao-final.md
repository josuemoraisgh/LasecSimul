# 14 - Integração Final

## Objetivo

Definir como considerar o MVP integrado.

## Escopo

Checklist final para unir módulos de Extension, Core, UI, IPC, passivos, projeto, QEMU e plugins.

## Sequência de validação

1. Compilar Extension.
2. Compilar Core.
3. Abrir VSCode com a Extension.
4. Executar `LasecSimul: Open Schematic Editor`.
5. Iniciar Core via `CoreClient`.
6. Confirmar handshake IPC.
7. Criar projeto `.lsproj`.
8. Adicionar resistor, capacitor e indutor.
9. Conectar circuito.
10. Enviar netlist ao Core.
11. Rodar simulação passiva mínima.
12. Salvar `.lsproj`.
13. Reabrir `.lsproj`.
14. Validar plugins nativos mínimos.
15. Validar ciclo QEMU quando disponível.

## Critérios de aceite

- Extension abre no VSCode.
- Webview carrega editor visual inicial.
- Core inicia como processo separado.
- Extension e Core trocam mensagens por IPC.
- Usuário cria e salva projeto.
- Usuário adiciona e conecta passivos.
- Core gera netlist.
- `Scheduler` executa ciclo mínimo.
- `MnaSolver` resolve circuitos resistivos simples.
- R/C/L têm testes.
- Projeto salva e reabre.
- Arquitetura QEMU/ESP32 está documentada.
- Plugins nativos têm documentação e exemplo.
- Testes unitários e de integração passam.

## Saída esperada

Um exemplo de projeto do MVP, relatório de testes, limitações conhecidas e lista de próximos passos.
