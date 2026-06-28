# 11 - QEMU e ESP32

## Objetivo

Definir a integração inicial com QEMU e o adapter ESP32.

## Escopo

Processo QEMU externo, arena compartilhada, dispatch MMIO e adapter ESP32 inicial. Não inclui emulação manual de CPU.

## Componentes

- `QemuProcessManager`: cria, monitora, encerra e mata QEMU.
- `QemuArenaBridge`: conecta memória compartilhada e traduz eventos MMIO. Formato já fixado em
  `qemu_arena_abi.h` — espelho exato de `qemuArena_t` do fork real, protocolo ping-pong por flag (seção 8.1
  do `.spec`), não um redesenho.
- `FirmwareWatcher`: vigia (polling de `mtime`) a pasta de firmware configurada pelo usuário; ao detectar
  artefato novo ou mais recente, aciona o mesmo kill+respawn do reset — nunca exige reload manual como o
  `slotReload()` do SimulIDE (seção 8.3 do `.spec`).
- `IMcuAdapter`: descreve chip, argumentos QEMU, regiões MMIO e pinos.
- `Esp32Adapter`: adapter inicial para ESP32.
- Módulos genéricos: GPIO, I2C, SPI, USART e Timer. `I2cBusModule`/`SpiBusModule` seguem um contrato já
  fixado antes da implementação (master agendado por evento, slave puramente reativo, vocabulário de estado
  neutro — nunca emprestado de uma família de chip, sem singleton — ver seção 8.2 do
  `lasecsimul-native-devices.spec`).

## Fluxo

1. Usuário associa uma **pasta** (não um arquivo fixo — toolchain externa gera nome de build variável) a um
   componente MCU.
2. Extension envia o caminho da pasta ao Core via IPC. `FirmwareWatcher` passa a vigiá-la a partir daqui.
3. Core resolve `chipId` no `McuRegistry`.
4. Adapter constrói argumentos do QEMU, incluindo o artefato mais recente resolvido pelo `FirmwareWatcher`.
5. `QemuProcessManager` prepara arena e inicia processo.
6. QEMU modificado escreve eventos de registrador na arena.
7. `QemuArenaBridge` despacha eventos por faixa de endereço.
8. Módulos genéricos convertem eventos em pinos/barramentos.
9. Se `FirmwareWatcher` detectar artefato novo a qualquer momento, repete os passos 4-7 via kill+respawn —
   sem ação manual do usuário.

## Regras

- Não implementar CPU de MCU manualmente.
- Não colocar QEMU na Extension.
- Não usar QMP como caminho principal de reset/stop no MVP.
- Reset pode matar e reiniciar QEMU. Firmware recarregado automaticamente usa exatamente o mesmo caminho —
  nunca um mecanismo de hot-swap separado.
- Dependência de QEMU modificado deve ficar explícita no manifesto do adapter — **já verificada, não
  hipotética**: fork real em `G:\Meu Drive\SourceCode\qemu-simulide-1`/`qemu-simulide` (binário compilado),
  GPIO output/input funcionando pro ESP32 hoje (seção 8.2 do `.spec`).
- Vigilância de firmware é por polling de `mtime`, nunca API nativa de evento de filesystem por SO
  (`inotify`/`ReadDirectoryChangesW`/`FSEvents`) — simplicidade deliberada, latência de 1-2s é aceitável.

## Testes

- iniciar QEMU;
- parar QEMU;
- matar QEMU em reset;
- erro ao carregar firmware;
- mapear GPIO;
- blink LED — compatibilidade do QEMU já confirmada, bloqueio atual é o pipeline ainda não implementado;
- `FirmwareWatcher` detecta artefato novo e recarrega sem ação manual;
- `FirmwareWatcher` escolhe o artefato de `mtime` mais recente quando há mais de um na pasta;
- capturar logs.
