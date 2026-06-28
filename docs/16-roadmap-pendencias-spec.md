# 16 - Roadmap de Pendências das `.spec`

## Objetivo

Transformar as pendências abertas em `lasecsimul.spec`, `lasecsimul-native-devices.spec` e
`lasecsimul-subcircuits.spec` em uma fila de produção prática, com épicos, dependências, entregáveis e ordem
recomendada.

## Escopo

Este documento descreve o **estado atual do backlog estrutural do projeto**, não o roadmap histórico do MVP.
Ele deve ser lido junto com:

- `docs/02-roadmap-mvp.md` — visão do MVP original;
- `docs/03-plano-de-execucao.md` — divisão por ondas/agentes;
- `docs/mvp-limitacoes.md` — lacunas conscientemente abertas no código atual;
- `.spec/lasecsimul.spec`;
- `.spec/lasecsimul-native-devices.spec`;
- `.spec/lasecsimul-subcircuits.spec`.

## Leitura executiva

Hoje as pendências se concentram em seis frentes:

1. fechar o comportamento normativo já especificado do Core;
2. completar o pipeline MCU/QEMU;
3. completar infraestrutura genérica de barramentos e fault handling de plugins;
4. construir a suíte de testes faltante da Extension;
5. entregar subcircuitos como produto;
6. atacar o backlog avançado do editor.

## Critérios de priorização

Ordem usada neste roadmap:

1. primeiro o que bloqueia RF/RNF centrais já assumidos na spec;
2. depois o que reduz risco arquitetural e risco de regressão;
3. depois o que habilita novos catálogos/produtos inteiros;
4. por fim refinamentos de UX e editor que não mudam a arquitetura base.

## Épico A - Fechar o contrato de propriedades e metadata no Core

**Status: concluído.** Validação de tipo/faixa/enum em `setProperty` (A1), efeito real de
`affectsTopology` (A2) e `requiresRestart` reportado na resposta IPC (A3) já estão implementados e
testados (`core/test/core/CoreBootstrapTest.cpp::testSetPropertyValidationOverIpc`,
`core/test/core/PropertyTopologyEffectTest.cpp`). O contrato de erro estável (A4) e a aposentadoria
de `listComponents()`/`ComponentDisplayMeta` (A5) foram concluídos do lado da Extension
(`extension/src/ipc/protocol.ts::IpcError`/`errorCodeFromPayload`, `CoreClient.ts`, `types.ts`).
Corrigido também um bug em `core/src/ipc/IpcServer.cpp::buildResponse` que descartava o `payload`
(com o `errorCode`) sempre que a resposta tinha `ok: false`, quebrando o contrato de erro na prática
mesmo com A1/A4 corretos isoladamente.

### Motivação

O schema de propriedades já existe de ponta a ponta, mas parte do comportamento normativo ainda não. As specs
explicitam isso em `lasecsimul.spec` seção 6.1.2 e `lasecsimul-native-devices.spec` seção 4.2.2.

### Pendências

- Validar tipo do valor recebido em `SimulationSession::setProperty()` contra `PropertySchema`.
- Validar faixa (`min`/`max`) e regras de enum/opções antes de aplicar `set`.
- Dar efeito real a `affectsTopology`.
- Dar efeito real a `requiresRestart`.
- Definir feedback de erro coerente no IPC quando a propriedade for inválida.
- Fechar o gap remanescente de `listComponents()`/metadata por instância, hoje separado de
  `getPropertySchemas`.

### Entregáveis

- validação completa de propriedade no Core;
- resposta IPC consistente para erro de edição;
- rebuild/restart automático ou aviso explícito conforme flags;
- decisão formal: manter ou aposentar `listComponents()`.

### Dependências

- nenhuma forte; pode começar imediatamente.

### Arquivos alvo

- `core/src/session/SimulationSession.*`
- `core/src/app/CoreApplication.cpp`
- `extension/src/ipc/CoreClient.ts`
- `docs/mvp-limitacoes.md`

### Critério de aceite

- editar uma propriedade inválida nunca deixa o componente em estado parcial;
- `affectsTopology` refaz o que precisar no netlist;
- `requiresRestart` produz comportamento explícito e testado;
- testes headless cobrindo tipo, faixa, enum e flags.

## Épico B - Completar o pipeline MCU/QEMU

**Status: concluído.** `QemuProcessManager`, `QemuArenaBridge` e `FirmwareWatcher` estão
implementados em `core/src/mcu/qemu/`, `Esp32Adapter` em `core/src/mcu/esp32/`, e há teste de
integração ponta a ponta contra o binário QEMU real (`core/test/core/mcu/McuControllerRealQemuTest.cpp`,
target `mcu_controller_real_qemu`) — todos passando em `ctest`.

### Motivação

RF04, RF05 e RF08 continuam dependentes do fechamento real de `QemuProcessManager` e `QemuArenaBridge`.
As specs já tratam o formato e o modelo como resolvidos; o que falta é implementação.

### Pendências

- Implementar `QemuProcessManager`.
- Implementar `QemuArenaBridge`.
- Fechar ciclo start/pause/stop/kill do processo QEMU.
- Integrar `FirmwareWatcher` com reset/reload automático do firmware.
- Conectar `IMcuAdapter`/`Esp32Adapter` ao pipeline real.
- Expor sinais mínimos para debug e observabilidade operacional.

### Entregáveis

- processo QEMU controlado pelo Core;
- arena de memória lida/escrita com dispatch por endereço;
- ESP32 inicial rodando firmware real;
- ciclo de reload automático de firmware sem intervenção manual;
- teste blink ponta a ponta.

### Dependências

- Épico C parcialmente, se a implementação dos módulos genéricos de barramento for necessária para os primeiros
  casos úteis.

### Arquivos alvo

- `core/src/mcu/QemuProcessManager.*`
- `core/src/mcu/QemuArenaBridge.*`
- `core/src/mcu/FirmwareWatcher.*`
- `core/src/mcu/`
- `mcu-adapters/espressif-esp32/`

### Critério de aceite

- firmware inicia, reinicia e para sem derrubar o Core;
- alterações no artefato observado acionam reload automático;
- teste integrado de blink passa de forma reproduzível.

## Épico C - Implementar módulos genéricos de barramento e integração MCU↔device

**Status: concluído (primeira versão).** `BusController`, `I2cBusModule` e `SpiBusModule`
implementados em `core/src/bus/` seguindo à risca o desenho fixado em
`.spec/lasecsimul-native-devices.spec` seção 8.2 (master agendado via `Scheduler::scheduleEvent`,
slave puramente reativo via `IBusParticipant::onBusWrite`/`onBusReadRequest`, vocabulário de estado
neutro `Idle/Start/Addr/Data/Ack/Nack/Stop` para I2C e `Idle/Select/Transfer/Deselect` para SPI,
delay configurável por passo, `Scheduler` recebido por referência no construtor — nunca singleton).
Testes em `core/test/core/bus/{I2cBusModuleTest,SpiBusModuleTest}.cpp`, 100% passando via `ctest`.
Simplificação documentada e assumida nesta primeira versão: granularidade por byte (a própria
`IBusParticipant` já opera em `span<uint8_t>`, não em bits), sem clock-stretching nem NACK de um
byte de dado específico no meio de uma transação — revisitar apenas se um `IMcuAdapter` real exigir.
Ainda não integrado a um `IMcuAdapter` real (esse é o próximo passo natural do Épico C, mas não
bloqueia o restante do roadmap).

### Motivação

`I2cBusModule` e `SpiBusModule` têm contrato validado em spec, mas ainda não foram escritos. Isso é a base
para não reimplementar protocolo por chip.

### Pendências

- Implementar `I2cBusModule`.
- Implementar `SpiBusModule`.
- Confirmar se `UsartModule` e `GpioModule` atuais já cobrem o mesmo padrão esperado pela spec.
- Integrar esses módulos ao `BusController`.
- Garantir vocabulário neutro de estado, sem acoplamento a AVR/TWSR.
- Garantir agendamento master/reatividade slave conforme a spec.

### Entregáveis

- barramentos genéricos reutilizáveis por qualquer `IMcuAdapter`;
- testes unitários de protocolo em nível de Core;
- integração inicial device plugin ↔ MCU via mesmo `BusController`.

### Dependências

- pode rodar em paralelo com Épico B, mas converge nele.

### Arquivos alvo

- `core/src/bus/`
- `core/src/session/SimulationSession.*`
- `core/test/`

### Critério de aceite

- um adaptador de MCU novo não precisa reimplementar I2C/SPI;
- os testes de barramento não dependem da UI;
- a API não fica contaminada por semântica específica de um chip.

## Épico D - Robustez de plugins nativos: timeout, fault, trust e recovery

**Status: parcialmente concluído.** Implementado: watchdog por thread dedicada
(`core/src/plugins/PluginWatchdog.hpp`, sem `TerminateThread`/`pthread_cancel`, thread presa é
desanexada), estado `Ok`/`Lagging`/`Faulted` em `IComponentModel::health()` (default `Ok` pra
built-in, `NativeDeviceProxy` escalona pra `Faulted` após 3 timeouts consecutivos), visibilidade
via IPC (`getComponentHealth`, `CoreClient.getComponentHealth`), e fluxo de trust/consentimento de
publisher na Extension (`extension/src/trust/{TrustStore,trustDecision}.ts`, diálogo modal
Bloquear/Permitir uma vez/Sempre confiar, decisão persistida em `globalState`, bibliotecas
`trust: "first-party"` como `devices/library.json` nunca pedem consentimento). Testes em
`core/test/core/plugins/PluginWatchdogTest.cpp` e `extension/src/trust/trustDecision.test.ts`.

Decisão de escopo registrada aqui (não escondida): o watchdog se aplica só a `postStep` (onde
"zero-order hold" é seguro -- segue com o último valor conhecido). `stamp()` continua síncrono, sem
watchdog, porque roda inline na mesma iteração do `MnaSolver` (seção 10) e não tem fallback seguro
de "adiar a contribuição desta rodada" sem arriscar resultado fisicamente incoerente.

**Ainda pendente, conscientemente não implementado nesta rodada** (cada um é um projeto à parte,
não uma tarefa pequena dentro deste épico):
- `yield_check` cooperativo no SDK do plugin (é o autor do plugin que chamaria isso dentro do seu
  próprio loop -- o host já tem o watchdog independente disso; falta só documentar no SDK/exemplo).
- Recovery do Core após crash não contido com restauro de snapshot (item 5 da seção 12) -- exige
  supervisor de processo + serialização periódica de snapshot + relançamento do Core pela Extension;
  nenhuma peça disso existe ainda.

### Motivação

O modelo ABI já existe, mas a parte operacional pesada ainda precisa de entrega real para o sistema ficar
seguro o suficiente para uso contínuo.

### Pendências

- Implementar `yield_check`/convenção cooperativa no host ABI.
- Implementar watchdog por thread dedicada.
- Marcar device como `lagging` e depois `faulted` conforme política da spec.
- Decidir e implementar a telemetria/visibilidade desse estado para a Extension.
- Implementar fluxo de trust/consentimento de publisher na Extension.
- Implementar recovery do Core após crash com restauro de snapshot.

### Entregáveis

- fault handling real para plugins mal comportados;
- mensagens de diagnóstico ao usuário;
- consentimento persistido por publisher;
- reinício automático do Core com restauração do último snapshot viável.

### Dependências

- Core e Extension juntos; atravessa fronteira de processo.

### Arquivos alvo

- `core/src/plugins/`
- `core/src/app/`
- `extension/src/extension.ts`
- `extension/src/ipc/`

### Critério de aceite

- plugin que falha não destrói a sessão silenciosamente;
- usuário recebe motivo claro;
- trust não é decidido dentro do Core;
- crash recovery consegue restaurar o projeto com perda limitada.

## Épico E - Testes faltantes da Extension

### Motivação

A própria estrutura da documentação já aponta que os testes da camada TypeScript ainda não foram escritos.
Sem isso, o backlog de editor e i18n fica caro de manter.

### Pendências

- Criar suíte de testes da Extension com mock do Core/IpcServer.
- Cobrir `CoreClient`.
- Cobrir sincronização de catálogo e schemas.
- Cobrir i18n `pt-BR`/`en` na paleta e na folha de propriedades.
- Cobrir fluxos básicos da Webview sem exigir Core real quando não necessário.

### Entregáveis

- infraestrutura de testes TS estável;
- smoke tests da extensão;
- regressão para idioma, catálogo, propriedades e mensagens IPC.

### Dependências

- nenhuma forte; pode começar logo após o fechamento do Épico A.

### Arquivos alvo

- `test/extension/`
- `extension/src/`
- `extension/package.json`

### Critério de aceite

- mudanças em catálogo/propriedade/idioma quebram teste antes de quebrar a UI;
- o pipeline da Extension não depende sempre do Core real.

## Épico F - Subcircuitos como produto

**Status: fundação do Core concluída; integração na Extension ainda pendente.** Implementado em
`core/src/registry/SubcircuitRegistry.hpp` e `core/src/session/SimulationSession.{hpp,cpp}`,
seguindo `.spec/lasecsimul-subcircuits.spec` seção 5 à risca:
- Loader de `.lssub.json`/`subcircuits/library.json` (`loadSubcircuitLibraryFile` em
  `CoreApplication.cpp`, reaproveita o verbo IPC `loadDeviceLibrary` já existente — um
  `library.json` com `"devices"` cai no caminho de plugin, um com `"subcircuits"` cai aqui).
- `SimulationSession::addSubcircuitInstance()` -- expansão recursiva (`addComponent`/`connectWire`
  por componente/fio interno, nesting automático quando um componente interno é outro
  subcircuito), renomeio de `Tunnel` por `interface[]` com prefixo `"<subcircuitInstanceId>::"`
  (seção 2 -- duas instâncias do mesmo subcircuito não colidem, testado).
- Detecção de ciclo (pilha de `typeId`s em expansão) e `removeSubcircuitInstance()` com remoção em
  cascata (seção 5.4), incluindo nesting.
- `subcircuitInstanceId` sintético (bit alto reservado, `kSubcircuitInstanceFlag`) para distinguir
  de um `componentIndex` comum no mesmo `instanceId` numérico da fronteira IPC -- decisão de
  implementação explicitamente liberada pela spec (seção 5.1, item 2).
- IPC: `addComponent` com `typeId` de subcircuito devolve `{"instanceId", "exposedPins"}` (seção
  6); `removeComponent` despacha pra `removeSubcircuitInstance` quando o id é de subcircuito.
- Teste de integração ponta a ponta em `core/test/subcircuit_test.cpp`: expande o exemplo exato da
  seção 1 (`divisor_5v`), liga fonte/terra externas aos pinos expostos, confirma que o circuito
  resolve eletricamente igual ao mesmo divisor montado componente a componente; cobre também
  não-colisão entre instâncias, cascata de remoção e ciclo.

**Ainda pendente (lado Extension, não iniciado nesta rodada)**: comando "Criar Subcircuito a
partir da Seleção", editor de símbolo (depende do Épico G), persistência `.lssub.json` a partir do
editor, integração na paleta com `folderPath`/i18n/`deviceLibraries[]`. Cada um exigiria UI nova no
webview testável só com interação real (mouse/seleção) -- não cabe na mesma rodada que a fundação
do Core sem virar trabalho não testado, ver mesma decisão de escopo do Épico G abaixo.

### Motivação

Subcircuitos são o próximo grande multiplicador de catálogo sem custo de ABI. A spec já está madura o
suficiente para começar a implementação por fases.

### Pendências

- Definir e implementar loader de `subcircuits/library.json`.
- Permitir registrar subcircuitos no mesmo catálogo unificado.
- Implementar `addComponent` de subcircuito com `exposedPins`.
- Implementar `removeSubcircuitInstance()` e remoção em cascata.
- Implementar expansão recursiva de subcircuito dentro da `SimulationSession`.
- Detectar ciclo de dependência entre subcircuitos.
- Criar comando “Criar Subcircuito a partir da Seleção”.
- Criar persistência `.lssub.json`.
- Integrar subcircuitos à paleta com `folderPath`, i18n e `deviceLibraries[]`.

### Entregáveis

- suporte headless do Core a subcircuitos;
- fluxo de criação a partir de seleção no editor;
- subcircuito aparecendo e sendo instanciado pela paleta;
- biblioteca `subcircuits/` funcional.

### Dependências

- Épico A pronto;
- i18n e catálogo unificado já estabilizados;
- editor de package minimamente utilizável ajuda, mas não precisa bloquear o primeiro slice.

### Arquivos alvo

- `core/src/session/`
- `core/src/registry/`
- `extension/src/extension.ts`
- `extension/src/ui/webview/`
- `project/schema/component-catalog.json`
- `subcircuits/`

### Critério de aceite

- instanciar/remover subcircuito funciona sem vazamento de componentes internos;
- fios conectam aos `exposedPins` corretamente;
- nesting funciona;
- ciclo é rejeitado com erro claro.

## Épico G - Editor de package/símbolo visual de dispositivos

**Status: não iniciado nesta rodada (decisão de escopo explícita).** Diferente dos Épicos A-D/H/F
(Core/lógica pura, verificáveis por teste automatizado sem interação humana), este épico é
fundamentalmente uma ferramenta de edição visual interativa -- redimensionar corpo, posicionar
pino arrastando o mouse, upload de imagem, round-trip de edição na UI. Não há como entregar isto
com confiança real sem rodar a Extension de verdade num VSCode e interagir com o canvas; a Onda 1
já tinha decidido conscientemente deixar teste de Webview com DOM real (`jsdom` ou equivalente)
fora de propósito por enquanto (ver Épico E, decisão de E4) -- construir um editor visual inteiro
sem essa rede de segurança é o tipo de trabalho que `.spec`/CLAUDE.md pedem para tratar com mais
cautela (UI: "use a feature in a browser before reporting the task as complete"), não para
produzir as ciegas numa sessão sem esse loop de verificação disponível. Recomendação: tratar como
sessão dedicada, com a Extension rodando interativamente (`F5`/Extension Development Host) para
validar cada etapa visualmente conforme escrita, em vez de tentar adivinhar geometria/UX certa só
lendo a spec.

### Motivação

A spec do `package` está detalhada, e isso prepara tanto devices ABI quanto subcircuitos. Hoje o contrato
existe melhor do que a ferramenta visual para produzi-lo.

### Pendências

- modo de edição de package no mesmo webview do esquemático;
- resize do corpo;
- inserção/edição de `shapes[]`;
- posicionamento visual de pinos;
- upload e embed de SVG/PNG/JPEG no `background.data`;
- round-trip fiel: abrir JSON manual e renderizar igual; editar na UI e salvar igual.

### Entregáveis

- editor visual de package;
- serialização de `package`/`pins[]`;
- reutilização para devices ABI e subcircuitos.

### Dependências

- pode começar em paralelo ao Épico F, mas o Épico F consome seus resultados.

### Arquivos alvo

- `extension/src/ui/webview/`
- `devices/*/device.json`

### Critério de aceite

- um `device.json` sem edição manual extensa já pode ser produzido pela UI;
- abrir/salvar preserva fidelidade sem formato paralelo.

## Épico H - Solver e componentes não lineares

**Status: concluído (primeiro slice).** Implementado `active.diode`
(`core/src/components/active/Diode.hpp`) — modelo companion (condutância + fonte de corrente
equivalente) linearizado a cada `stamp()` em torno do ponto de operação da última `solve()`, com
amortecimento de Newton (limite de passo de `2·Vt` por iteração quando `Vd` já passou do `vCrit`) e
critério de convergência por componente (`hasConverged()` compara `Vd` desta iteração com a
anterior, tolerância `1e-6V`). Teste de integração ponta a ponta em `core/test/diode_test.cpp`:
fonte 10V + resistor 1kΩ + diodo + terra, valida que o laço de Newton-Raphson do `settleStep()`
genérico (sem nenhuma mudança nele) converge pra um ponto de operação que satisfaz KCL (corrente do
resistor bate com a equação do diodo na mesma `Vd`, dentro de tolerância numérica). Loop de
iteração não linear do `Scheduler`/`SimulationSession` não precisou de nenhuma mudança — já estava
pronto pra isto desde a primeira versão do `settleStep()`, só faltava um componente real pra
exercitá-lo.

Métrica/threshold pra solver esparso: NÃO medido nesta rodada (continua guiado por intuição) --
exigiria um circuito com centenas/milhares de componentes não lineares pra medir de verdade, o que
não existe ainda no catálogo. Revisitar quando subcircuitos (Épico F) tornarem viável montar um
circuito grande o bastante pra medir.

### Motivação

A arquitetura para não lineares já foi desenhada; falta transformá-la em comportamento elétrico real.

### Pendências

- implementar primeiro componente não linear real;
- implementar critério de convergência por componente;
- validar loop de iteração não linear do `Scheduler`;
- medir quando um grupo justifica migrar para solver esparso;
- decidir fila de componentes ativos: diodo, BJT, MOSFET, op-amp ideal.

### Entregáveis

- um caso não linear real funcionando;
- testes de convergência e regressão;
- métrica/threshold para futura adoção de `Eigen::SparseLU`.

### Dependências

- Core base estável;
- Épico A concluído.

### Critério de aceite

- pelo menos um ativo real simulado corretamente;
- iteração converge ou falha de forma explícita;
- backlog de solver esparso passa a ser guiado por medição, não intuição.

## Épico I - Backlog avançado do editor

**Status: parcialmente concluído.** Implementado:
- **Flip horizontal/vertical** -- `flipH`/`flipV` em `WebviewComponentModel`/`ProjectComponent`,
  comandos `lasecsimul.flipSelectionHorizontal`/`Vertical` (teclas `h`/`v` com o esquemático em
  foco, mesmo padrão de `rotateSelectionCw`), persistido no `.lsproj`. Puramente visual (como a
  rotação): pinos continuam identificados por `pinId`, fios já conectados não precisam de ajuste
  no Core. Geometria: `flipPoint` aplicado ANTES de `rotatePoint` no cálculo de posição de pino,
  mesma ordem do `transform: rotate(...) scale(...)` no CSS (que aplica da direita pra esquerda).
- **Batch test headless de circuitos salvos** -- `extension/test/project/ProjectSerializer.test.ts`
  agora itera todo `.lsproj` em `test/fixtures/projects/` automaticamente (convenção de nome:
  "invalid" no arquivo == deveria rejeitar no load); fixture nova nesse diretório já é coberta sem
  precisar editar o teste.

**Conscientemente não implementado nesta rodada** (decisão de escopo, não esquecimento):
- **Copiar/colar e undo/redo** -- a arquitetura atual sincroniza Webview↔Core por AÇÃO específica
  (`requestAddComponent`/`requestRemoveComponent`/`requestConnectPins`/etc.), não por estado
  completo (`projectChanged` só espelha o lado Extension, nunca re-sincroniza o Core). Um undo/redo
  genérico por snapshot precisaria de um motor de diff Webview→Core que não existe pra NENHUMA
  mutação hoje -- não é uma tarefa pequena dentro deste épico, é pré-requisito de arquitetura
  novo. Copiar/colar tem o mesmo obstáculo pra qualquer componente que precise existir no Core
  (não só visualmente). Candidato a primeira fatia futura: undo/redo só das mutações puramente
  visuais que já não tocam o Core (rotação, flip, posição, label) -- ainda não feito.
- **Arrastar rótulo independentemente do símbolo** -- exigiria um modelo de posição de label
  separado do símbolo e testes de interação de mouse; testar isso sem DOM real (`jsdom`) não dá pra
  fazer com qualidade, e a Onda 1 já decidiu deixar teste de Webview com DOM fora de propósito (ver
  Épico E). Revisitar junto com essa decisão, não isolado.
- Eventual shell alternativo além do VSCode: fora de propósito enquanto protocolo/formato de
  arquivo continuam estabilizando (ver "O que NÃO deve entrar antes da hora" no fim deste roadmap).

### Motivação

Esses itens não bloqueiam a arquitetura, mas melhoram bastante produtividade do usuário.

### Pendências

- arrastar rótulo independentemente do símbolo;
- copiar/colar;
- flip horizontal;
- flip vertical;
- undo/redo;
- batch test headless de circuitos salvos;
- eventual shell alternativo além do VSCode, quando o custo fizer sentido.

### Entregáveis

- ergonomia de edição mais próxima do SimulIDE;
- infraestrutura de histórico/ações reversíveis;
- ferramenta de regressão headless para CI.

### Dependências

- testes da Extension prontos;
- modelo de estado do editor estabilizado.

## Ondas recomendadas

### Onda 1 - Fechamento normativo do que já existe

- Épico A
- Épico E

Resultado esperado:

- propriedades seguras;
- contratos realmente cumpridos;
- base de testes da Extension pronta.

## Onda 1 — tarefas concretas (prontas para implementação)

Estado atual verificado diretamente no código (não suposto) antes de quebrar as tarefas:

- `SimulationSession::setProperty` (`core/src/session/SimulationSession.cpp:79-91`) só confere se a
  propriedade existe pelo nome — chama `descriptor.set(value)` sem checar `descriptor.schema.valueKind`/
  `minValue`/`maxValue`/`options`/flags. O schema **já está disponível ali** (todo `PropertyDescriptor`
  carrega `.schema` desde a rodada de "fim da inferência na Webview") — a validação não precisa de
  nenhuma plumbing nova, só da lógica.
- `affectsTopology`/`requiresRestart` (`PropertySchemaFlags`, `Types.hpp`) existem só como bits — nenhum
  componente built-in/plugin atual os declara, e nada no Core os lê de volta.
- O handler IPC `setProperty` (`CoreApplication.cpp:500-514`) só distingue "propriedade desconhecida" de
  "erro genérico" (`catch` do `nlohmann::json`) — sem código de erro estável, só texto livre.
- `listComponents()` (`CoreClient.ts:139-141`, `ComponentDisplayMeta` em `ipc/types.ts`) **não é chamado
  por nenhum outro lugar do código** — confirmado por busca no repo inteiro. Sem handler no Core. A
  necessidade que motivou ele (metadata por typeId pra UI) já está 100% coberta por `getPropertySchemas`.
- Testes da Extension hoje: `test/project/ProjectSerializer.test.ts`, `src/ipc/CoreClient.test.ts`
  (com um `MockCoreServer` ad-hoc dentro do próprio arquivo), `src/catalog/UnifiedCatalog.test.ts`
  (só a função pura `resolveLocalizedItems`). Nada testa `extension.ts` (handlers de mensagem,
  `attachPropertySchemas`, `currentLasecSimulLanguage`, `nextIndexedLabel`) nem nenhuma lógica pura de
  `main.ts` (`formatEngineeringValue`, geometria de fio) — hoje é tudo só código vivendo dentro de
  funções que também tocam `vscode.*`/DOM, então não tem como importar e testar isolado.

### Épico A — tarefas

**A1. Validação de tipo/faixa/enum em `setProperty`**
- Arquivo: `core/src/session/SimulationSession.hpp`/`.cpp`.
- Trocar o retorno de `setProperty` de `bool` pra `std::optional<std::string>` (`std::nullopt` = sucesso;
  string presente = mensagem de erro) — única mudança de assinatura necessária, sem precisar de struct
  nova. Dentro do laço que já acha o `PropertyDescriptor` certo, antes de chamar `descriptor.set(value)`:
  - `descriptor.schema.flags & PropertySchemaReadOnly` → rejeita sempre.
  - `valueKind` do schema não bate com o tipo de `PropertyValue` recebido → rejeita (`"tipo inválido"`).
  - `valueKind == Number` e `minValue`/`maxValue` presentes → rejeita fora da faixa.
  - `!schema.options.empty()` (enum) → valor (`string`) precisa casar com algum `options[].value`.
- Arquivo: `core/src/app/CoreApplication.cpp` (handler `"setProperty"`, linha ~500) — adapta pro novo
  retorno; `resp.error` recebe a mensagem; novo campo `resp.payloadJson` com
  `{"errorCode": "unknown_property"|"read_only"|"type_mismatch"|"out_of_range"|"invalid_option"}` quando
  `!ok` (ver A4).
- Teste: `core/test/core/CoreBootstrapTest.cpp`, novo `testSetPropertyValidationOverIpc` — usa o
  resistor built-in (`resistance`, `min: 0.01`, `valueKind: number`): edição válida ok; `"resistance":
  "abc"` (tipo errado) rejeitada; `"resistance": -5` (fora da faixa) rejeitada; nome inexistente
  rejeitada — cada uma checando `errorCode` certo.

**A2. Efeito real de `affectsTopology`**
- Arquivo: `core/src/session/SimulationSession.cpp` — em `setProperty`, depois de validar e ANTES de só
  `markDirty`: se `descriptor.schema.flags & PropertySchemaAffectsTopology`, marcar
  `m_topologyDirty = true` também (mesmo flag que `addComponent`/`connectWire`/`removeComponent` já
  usam) — força `rebuildTopologyIfNeeded()` no próximo `settleStep()`.
- Nenhum componente real declara essa flag hoje (não existe caso de uso natural nos built-ins atuais —
  `Tunnel.name` usa o caminho especial `setTunnelName`, não o genérico). Teste precisa de um
  `IComponentModel` só-de-teste com uma propriedade `affectsTopology`, instanciado direto via
  `ComponentRegistry::registerFactory` dentro do próprio arquivo de teste (sem expor nada novo em
  produção) — confirma que `rebuildTopologyIfNeeded` de fato roda de novo (ex: checando que a topologia
  resultante reflete uma mudança que só apareceria depois de um rebuild).
- Arquivo de teste: novo `core/test/core/PropertyTopologyEffectTest.cpp` (ou função dentro de
  `CoreBootstrapTest.cpp`, se preferir não criar executável novo no `CMakeLists.txt`).

**A3. `requiresRestart` — decisão de UX (Onda 1 escolhe a opção simples)**
- Decisão: **não** implementar reinício automático em produção nesta rodada (built-ins não têm um
  "reinit in-place" limpo; plugins teriam via `destroy`+`create`+`init`, mas isso é uma mudança de
  runtime maior, não uma validação). Em vez disso: `setProperty` aplica a mudança normalmente, e a
  resposta IPC ganha `{"requiresRestart": true}` quando a propriedade alterada tiver essa flag; a
  Extension mostra um aviso ("este componente precisa ser recriado pra aplicar") em vez de recriar
  sozinha. Reinício automático fica documentado como extensão futura do mesmo mecanismo, não decidido
  agora — evita comportamento implícito arriscado sem nenhum caso de uso real ainda.
- Arquivos: `CoreApplication.cpp` (resposta), `extension/src/ipc/CoreClient.ts::setProperty` (devolve
  `{requiresRestart}` em vez de `void`), `extension.ts::pushPropertyToCore` (mostra o aviso).

**A4. Contrato de erro estável no IPC**
- Arquivo: `extension/src/ipc/protocol.ts` — `ResponseEnvelope` ganha `errorCode?: string` opcional
  (sem quebrar nada que já lê só `error`/`ok`).
- Arquivo: `extension/src/ipc/CoreClient.ts` — `setProperty` passa a devolver
  `{ ok: true } | { ok: false; errorCode: string; message: string }` em vez de lançar genérico (ou
  lança um `PropertyValidationError` tipado com `.code` — escolher um padrão e aplicar igual nos dois
  lugares que já lançam erro de IPC pra manter consistência, ver `_dispatch` em `CoreClient.ts`).

**A5. Aposentar `listComponents()`/`ComponentDisplayMeta`**
- Remover de `extension/src/ipc/CoreClient.ts` (método `listComponents`) e `extension/src/ipc/types.ts`
  (interface `ComponentDisplayMeta`) — confirmado sem nenhum chamador no repositório inteiro.
  `getPropertySchemas` já cobre 100% da necessidade original (metadata por typeId).
- Atualizar `docs/mvp-limitacoes.md`: remover a entrada que documentava esse gap (deixa de existir, não
  fica mais pendente).

### Épico E — tarefas

**E1. Extrair `MockCoreServer` reutilizável**
- Novo arquivo: `extension/src/ipc/testSupport/MockCoreServer.ts` — move a classe que hoje vive dentro
  de `CoreClient.test.ts` (linhas iniciais do arquivo). `CoreClient.test.ts` passa a importar dali.
  Sem isso, qualquer teste novo que precise de um Core falso (A1-A4 acima são só Core real via
  `core_bootstrap_test`, mas testes futuros do lado Extension vão precisar do mesmo mock) reimplementaria
  a mesma classe.

**E2. Extrair lógica pura de `extension.ts`**
- Novo arquivo: `extension/src/catalog/catalogMerge.ts` — move `nextIndexedLabel`,
  `hasShowOnSymbolProperty`, `toWebviewPropertySchema` e a parte de `attachPropertySchemas` que só
  combina `WebviewComponentCatalogEntry[]` com `Record<typeId, PropertySchemaDto[]>` (sem o `coreClient`/
  `await` — recebe o mapa já resolvido). `extension.ts` importa e chama.
- Novo arquivo: `extension/src/language.ts` — extrai a lógica PURA de `currentLasecSimulLanguage` pra
  `resolveLasecSimulLanguage(configured: string, systemLanguage: string): "pt-BR" | "en"` (recebe as
  duas strings já lidas, sem chamar `vscode.*` dentro da função pura). `extension.ts` mantém um wrapper
  fino que só lê `vscode.workspace.getConfiguration(...)`/`vscode.env.language` e chama a função pura.

**E3. Testes novos cobrindo o que falta**
- `extension/src/catalog/catalogMerge.test.ts`: contador de índice por tipo com tipos intercalados (ex:
  Resistor, Capacitor, Resistor → "Resistor-1", "Capacitor-1", "Resistor-2"); default de `showValue`
  baseado em `showOnSymbol`; merge de schema por typeId — incluindo um caso com DUAS versões do mesmo
  mapa de schemas (uma "pt-BR", uma "en" simuladas) pra confirmar que o merge usa a que foi passada,
  cobrindo "i18n na folha de propriedades" do lado Extension (o fallback em si já é testado no Core via
  `testGetPropertySchemasOverIpc`; o que falta testar aqui é o ENCAIXE do resultado no catálogo).
- `extension/src/language.test.ts`: `resolveLasecSimulLanguage` — configuração explícita
  ("pt-BR"/"en") sempre vence; `"system"` cai pro idioto do VSCode (prefixo "pt"→pt-BR, resto→en) —
  cobre "i18n na paleta" do lado Extension (qual idioma é PEDIDO, não como o fallback é resolvido, que já
  é testado em `UnifiedCatalog.test.ts`/Core).
- Estender `test/project/ProjectSerializer.test.ts` (ou novo arquivo ao lado): round-trip de
  `ProjectComponent.label`/`showId`/`showValue` — regressão pro bug já corrigido nesta sessão (`label`
  não era persistido).

**E4. Extrair lógica pura de `main.ts` pra testabilidade sem DOM**
- Novo arquivo: `extension/src/ui/webview/wireGeometry.ts` — move `orthogonalSegmentPoints`,
  `buildOrthogonalPath`, `snapToWireGrid`, `samePoint` (funções puras, só `Point`→`Point[]`, sem DOM).
- Novo arquivo: `extension/src/ui/webview/valueFormatting.ts` — move `formatEngineeringValue`.
- Testes: `wireGeometry.test.ts` (segmento ortogonal reto vs. em L, snap pro grid), `valueFormatting.
  test.ts` (prefixos SI p/n/µ/m/—/k/M/G, valor zero, unidade vazia).
- **Decisão**: testar a Webview de ponta a ponta (DOM real ou `jsdom`) fica FORA da Onda 1 de propósito
  — exigiria escolher e configurar um toolchain de DOM novo (investimento de infra à parte, não pedido
  pela própria priorização do roadmap, que deixa refino de editor pra depois de Core/QEMU/subcircuitos).
  Maximizar extração de função pura (este item) cobre a lógica de maior risco (geometria de fio, zoom,
  formatação) sem essa dependência nova; revisitar `jsdom` só se um bug de interação specific justificar.

**E5. Atualizar scripts**
- `extension/package.json` (`"test"`): adicionar cada `.test.js` novo à cadeia (`&&` entre eles, mesmo
  padrão já usado).
- `extension/tsconfig.test.json`: nenhuma mudança necessária — já inclui `src/**/*.test.ts`.

### Ordem recomendada dentro da Onda 1

1. A1 (validação) → A4 (contrato de erro) — A4 depende do formato de erro que A1 introduz.
2. A2 (affectsTopology) e A3 (requiresRestart) podem rodar em paralelo com A1/A4 (não dependem um do
   outro), mas A2 precisa do mesmo `setProperty` já tocado por A1 — fazer na mesma leva evita conflito.
3. A5 (aposentar `listComponents`) é independente, pode ir em qualquer ordem — recomendo por último,
   só limpeza.
4. E1 (mock reutilizável) primeiro entre os itens de teste — E3 depende dele indiretamente (mesmo
   padrão de mock, mesmo se um teste específico não precisar de IPC).
5. E2 (extração) antes de E3 (testes) — não dá pra testar o que ainda não foi extraído.
6. E4 é independente do resto do Épico E, pode rodar em paralelo com A1-A5.

### Onda 2 - MCU/QEMU e barramentos

- Épico B
- Épico C
- parte operacional do Épico D

Resultado esperado:

- pipeline real de MCU;
- barramentos genéricos;
- base para RF04/RF05/RF08.

### Onda 3 - Robustez operacional de plugins

- restante do Épico D

Resultado esperado:

- trust, watchdog, `faulted`, recovery, snapshot.

### Onda 4 - Catálogo expansível sem ABI novo

- Épico G
- Épico F

Resultado esperado:

- editor de package;
- subcircuitos utilizáveis na prática.

### Onda 5 - Profundidade elétrica e UX avançada

- Épico H
- Épico I

Resultado esperado:

- não lineares reais;
- editor mais maduro;
- base de regressão mais forte.

## Plano de produção sugerido

### Sprint 1

- fechar validação de propriedade;
- implementar efeito de `affectsTopology`;
- decidir UX de `requiresRestart`;
- criar testes TS mínimos da Extension.

### Sprint 2

- concluir `QemuProcessManager`;
- concluir `QemuArenaBridge`;
- integrar `FirmwareWatcher`;
- executar teste blink.

### Sprint 3

- implementar `I2cBusModule` e `SpiBusModule`;
- integrar adaptador ESP32 ao caminho completo;
- iniciar watchdog/fault policy de plugin.

### Sprint 4

- implementar loader de subcircuitos;
- implementar `exposedPins` + remoção em cascata;
- começar comando “Criar Subcircuito a partir da Seleção”.

### Sprint 5

- editor de package;
- integração total de subcircuito na paleta;
- round-trip JSON visual.

### Sprint 6+

- componentes não lineares;
- undo/redo;
- copy/paste;
- flip;
- labels livres;
- batch test.

## Dependências cruzadas

- Subcircuito depende de catálogo unificado estável e bom suporte de UI.
- MCU/QEMU depende de barramentos genéricos ou, no mínimo, de uma primeira fatia coerente deles.
- Watchdog/trust/recovery dependem de Core e Extension trabalhando juntos.
- Backlog de editor depende fortemente de testes da Extension para não virar regressão permanente.

## O que NÃO deve entrar antes da hora

- solver esparso antes de medir grupos grandes reais;
- shell alternativo antes de o protocolo e os formatos de arquivo estabilizarem mais;
- hot-reload de subcircuito em uso antes da primeira versão simples de subcircuito funcionar;
- refino pesado de UX antes de propriedades, QEMU e subcircuitos terem a base pronta.

## Primeira fila recomendada

Se o time for começar imediatamente, a ordem mais eficiente é:

1. Épico A
2. Épico E
3. Épico B
4. Épico C
5. Épico D
6. Épico G
7. Épico F
8. Épico H
9. Épico I

## Saída esperada deste roadmap

Ao final das três primeiras ondas, o projeto deve sair do estado "base arquitetural boa, mas com frentes
abertas" para "plataforma operacional reproduzível", com:

- Core mais normativo e seguro;
- Extension coberta por testes;
- QEMU funcional;
- plugins mais robustos em produção;
- caminho pronto para expandir catálogo via subcircuito e package editor.
