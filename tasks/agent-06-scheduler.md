# Agente 06 - Scheduler

## Objetivo

Implementar tempo de simulação, eventos ordenados, dirty tracking e integração com o solver.

## Escopo

Agendamento e ciclo de simulação. Não inclui álgebra linear do solver.

## Contexto

O scheduler deve ser rápido e data-oriented. Não usar listas ligadas intrusivas.

## Arquivos que pode criar

- `test/core/simulation/SchedulerTest.cpp`.
- `test/core/simulation/SparseSetTest.cpp`.

## Arquivos que pode modificar

- `core/src/simulation/Scheduler.hpp`.
- `core/src/simulation/Scheduler.cpp`.
- `core/src/simulation/SparseSet.hpp`.
- `core/src/session/SimulationSession.*` apenas para integração.

## Arquivos que não pode modificar

- `extension/**`.
- `core/src/plugins/**`.
- `core/src/mcu/**` salvo interfaces futuras acordadas.

## Dependências

- Agente 05 para nós/listeners.
- Agente 07 para chamada de solver.

## Interfaces obrigatórias

- `scheduleAt(time, callback/event)`.
- `markDirty(componentId)`.
- `runUntil(time)`.
- `step(dt)`.
- `reset()`.
- Integração com `SimulationSession::settle`.

## Tarefas

- [ ] Validar `SparseSet` para inserção sem duplicata.
- [ ] Implementar fila de eventos com `std::priority_queue`.
- [ ] Implementar ordenação por tempo.
- [ ] Implementar dirty components.
- [ ] Implementar dirty nodes se necessário.
- [ ] Implementar ciclo `settle` sem reprocessar todos os componentes.
- [ ] Integrar com listeners por nó.
- [ ] Implementar pause/resume/stop/reset.
- [ ] Criar teste de eventos ordenados.
- [ ] Criar teste de dirty tracking.
- [ ] Criar teste de reset.

## Testes obrigatórios

- [ ] Evento mais antigo roda primeiro.
- [ ] Eventos no mesmo tempo são determinísticos.
- [ ] Dirty duplicado aparece uma vez.
- [ ] Reset limpa eventos e dirty sets.
- [ ] Stop encerra sem bloquear.

## Critérios de aceite

- Scheduler não usa listas ligadas intrusivas.
- Caminho crítico não usa IPC.
- Testes headless passam.

## Riscos técnicos

- Lock grosso bloquear marcação dirty por muito tempo.
- Eventos com mesmo timestamp ficarem não determinísticos.
- Re-stamp global acidental.

## Observações de integração

Combine com agente 07 o ponto exato onde `solveDirtyGroups` é chamado.

## O que não fazer

- Não implementar solver numérico.
- Não chamar Extension.
- Não usar `worker_threads`.
