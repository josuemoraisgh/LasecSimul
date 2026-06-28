# 03 - Plano de Execução

## Objetivo

Definir uma sequência de trabalho que permita agentes paralelos sem colisão excessiva.

## Escopo

Plano para execução do MVP em ondas. Cada agente deve seguir seu arquivo em `tasks/`.

## Onda 1 - Fundação

Agentes: 01, 04, 14, 16.

Resultados:

- estrutura do repositório estabilizada;
- Core inicializável;
- padrão de testes definido;
- documentação mantida.

## Onda 2 - Contratos

Agentes: 03, 05, 06, 07, 10, 13.

Resultados:

- IPC mínimo;
- `.lsproj` v1;
- contratos de Netlist/Scheduler/MNA;
- ABI de plugins nativos validada.

## Onda 3 - UX e componentes

Agentes: 02, 08, 09.

Resultados:

- Extension Host funcional, incluindo paleta de componentes como `TreeView` nativo (agente 02 — não é
  Webview, ver `docs/08-ui-webview.md` e `lasecsimul.spec` seção 13);
- Webview inicial do canvas + painel de propriedades persistente (agente 09), alimentado por
  `propertyDescriptors()` (seção 6.1 do `.spec`);
- passivos R/C/L integrados ao Core. `DcVoltageSource`/`Ground` já existem (fora do escopo formal do agente
  08, ver nota em `tasks/agent-08-componentes-passivos.md`) — não reimplementar.

## Onda 4 - QEMU

Agentes: 11, 12.

Resultados:

- ciclo de vida QEMU;
- arena bridge — formato já fixado (`qemu_arena_abi.h`, espelho exato do fork real, seção 8.1 do `.spec`);
- `FirmwareWatcher`: vigia pasta configurada, recarrega automaticamente via o mesmo kill+respawn do reset
  (seção 8.3 do `.spec`) — nunca exige ação manual do usuário;
- módulos de barramento (`I2cBusModule`/`SpiBusModule`) seguem o contrato já fixado (master agendado, slave
  reativo, vocabulário neutro, sem singleton — seção 8.2 do `lasecsimul-native-devices.spec`) quando
  implementados;
- adapter ESP32 inicial;
- teste blink planejado e executado — **compatibilidade do QEMU já verificada** (fork real em
  `G:\Meu Drive\SourceCode\qemu-simulide-1`, GPIO output/input funcionando pro ESP32), o que falta é o
  pipeline (`QemuProcessManager`/`QemuArenaBridge` ainda não implementados), não mais incerteza de formato.

## Onda 5 - Integração

Agente: 15 com apoio dos demais.

Resultados:

- exemplo completo;
- testes unitários e integração passando;
- limitações registradas;
- critérios de aceite do MVP validados.

## Regras de integração

- Toda mudança arquitetural relevante exige ADR.
- Nenhum agente deve alterar fronteiras de outro sem registrar contrato.
- Testes headless do Core são obrigatórios para lógica de simulação.
- Testes da Extension devem mockar Core quando o Core real não for necessário.
- Não misturar implementação de UI com solver.
- **Implementar algo que o `.spec` ainda não cobre segue procedimento fixo, sem exceção**: procurar solução,
  avaliar como o SimulIDE-dev resolve o mesmo problema, perguntar ao usuário se sobrar dúvida real, e se não
  sobrar, implementar a melhor solução e atualizar o `.spec` na mesma tarefa — nunca deixar a decisão só no
  código. Procedimento completo em `.skill/lasecsimul.skill`, seção "Quando algo não está no `.spec`".
