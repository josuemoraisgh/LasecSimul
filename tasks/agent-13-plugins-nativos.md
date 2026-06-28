# Agente 13 - Plugins Nativos

## Objetivo

Completar sistema de plugins nativos DLL/SO e exemplo mínimo.

## Escopo

Loader, runtime, ABI C, proxies e exemplo nativo.

## Contexto

Plugins nativos são a arquitetura ativa para dispositivos customizados e adapters de MCU. WASM está superseded.

## Arquivos que pode criar

- `core/src/plugins/PluginRuntime.cpp`.
- `core/src/plugins/NativeMcuAdapterProxy.hpp`.
- `core/src/plugins/NativeMcuAdapterProxy.cpp`.
- `test/core/plugins/PluginLoaderTest.cpp`.
- `test/core/plugins/PluginRuntimeTest.cpp`.
- `test/fixtures/plugins/*`.

## Arquivos que pode modificar

- `core/include/lasecsimul/device_abi.h`.
- `core/include/lasecsimul/mcu_abi.h`.
- `core/src/plugins/*.hpp`.
- `core/src/plugins/*.cpp`.
- `devices/example-blinker/**`.
- `mcu-adapters/espressif-esp32/**` se adapter nativo exigir.

## Arquivos que não pode modificar

- `extension/src/ui/**`.
- `core/src/simulation/MnaSolver.*` salvo contratos de host API acordados.
- `.spec/**`.

## Dependências

- Agente 04 para `GlobalPluginCache`.
- Agente 05 a 07 para integração de `IComponentModel`.

## Interfaces obrigatórias

- ABI C com `lsdn_get_vtable`.
- `PluginLoader` não cria instâncias.
- `PluginRuntime` não carrega binários.
- `PluginModule` fica vivo enquanto houver proxy.
- Versioned swap.

## Tarefas

- [ ] Validar exports obrigatórios.
- [ ] Validar ABI major/minor.
- [ ] Validar ponteiros não nulos.
- [ ] Completar `PluginRuntime`.
- [ ] Completar `NativeDeviceProxy`.
- [ ] Criar `NativeMcuAdapterProxy`.
- [ ] Garantir `shared_ptr<PluginModule>` nos proxies.
- [ ] Implementar teste de plugin válido.
- [ ] Implementar teste de export ausente.
- [ ] Implementar teste de ABI incompatível.
- [ ] Implementar teste de versioned swap.
- [ ] Garantir que módulo vivo não descarrega.

## Testes obrigatórios

- [ ] Plugin sem export obrigatória.
- [ ] Plugin com ABI incompatível.
- [ ] Plugin válido.
- [ ] Criação de instância.
- [ ] Destruição de instância.
- [ ] Chamada `stamp`.
- [ ] Chamada `postStep`.
- [ ] Versioned swap.
- [ ] Não descarregar módulo com instância viva.

## Critérios de aceite

- Nenhum tipo C++ cruza ABI.
- Exemplo `example-blinker` compila.
- Loader funciona em Windows, Linux e macOS.

## Riscos técnicos

- Descarregar DLL/SO com instância viva.
- Assinatura ABI mudar silenciosamente.
- Exceção C++ atravessar fronteira.

## Observações de integração

Confiança de publisher é decisão da Extension. O Core faz validação mecânica e carga.

**Lacuna conhecida, não esquecida**: `device_abi.h` não tem `set_property` — só `get_property_f32`, lido uma
vez em `init`. Editar propriedade de um plugin em runtime (painel de propriedades, seção 6.1 do `.spec`) não
funciona ainda pra dispositivo nativo, só pra built-in. Se esta tarefa for adicionar isso, é bump de
`LSDN_ABI_VERSION_MINOR`, não mudança silenciosa — e cai na regra geral de "algo não está no `.spec`": avaliar
solução, decidir, atualizar `lasecsimul-native-devices.spec` na mesma tarefa (ver `.skill`).

## O que não fazer

- Não usar WASM.
- Não usar `worker_threads`.
- Não passar STL pela ABI.
- Não recompilar Core para cada plugin.
