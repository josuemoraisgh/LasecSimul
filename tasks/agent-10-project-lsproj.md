# Agente 10 - Projeto .lsproj

## Objetivo

Definir schema, serialização, desserialização e validação do projeto `.lsproj`.

## Escopo

Formato persistido do projeto e serializer na Extension.

## Contexto

O `.lsproj` é o contrato persistido entre UI, Extension e Core. Deve preservar estado visual e dados elétricos relevantes.

## Arquivos que pode criar

- `project/schema/lsproj.schema.json`.
- `extension/src/project/ProjectSerializer.ts`.
- `extension/src/project/ProjectTypes.ts`.
- `extension/test/project/ProjectSerializer.test.ts`.
- `test/fixtures/projects/*.lsproj`.

## Arquivos que pode modificar

- `extension/src/extension.ts` para comandos de abrir/salvar.
- `extension/src/ui/webview/model.ts` em acordo com agente 09.
- `docs/05-contratos-e-interfaces.md` se contrato mudar.

## Arquivos que não pode modificar

- `core/src/simulation/**` salvo DTOs de entrada acordados.
- `core/src/plugins/**`.
- `.spec/**`.

## Dependências

- Agente 09 para modelo visual.
- Agente 03 para mensagens de envio ao Core.
- Agente 05 para dados que o Core precisa receber.

## Interfaces obrigatórias

- `ProjectSerializer.load(path)`.
- `ProjectSerializer.save(path, project)`.
- Schema versionado.
- IDs estáveis de componentes e fios.

## Tarefas

- [ ] Definir `schemaVersion`.
- [ ] Definir `components[]`.
- [ ] Definir `wires[]`.
- [ ] Definir `properties`.
- [ ] Definir `visual`.
- [ ] Definir `simulationSettings`.
- [ ] Definir `mcuFirmware` quando aplicável.
- [ ] Criar schema JSON.
- [ ] Implementar serializer TS.
- [ ] Implementar validação.
- [ ] Criar fixtures válidas.
- [ ] Criar fixtures inválidas.

## Testes obrigatórios

- [ ] Salvar projeto vazio.
- [ ] Abrir projeto vazio.
- [ ] Salvar projeto com R/C/L.
- [ ] Reabrir mantendo ids.
- [ ] Rejeitar schema incompatível.
- [ ] Rejeitar componente sem `typeId`.

## Critérios de aceite

- `.lsproj` é versionado.
- Webview e Core recebem dados consistentes.
- Não há estado oculto necessário fora do arquivo.

## Riscos técnicos

- Misturar manifesto de plugin com instância de projeto.
- Salvar paths absolutos sem normalização.
- Quebrar compatibilidade cedo demais.

## Observações de integração

O Core pode receber snapshot derivado do `.lsproj`, mas o serializer principal vive na Extension.

## O que não fazer

- Não transformar `.lsproj` em dump interno do Core.
- Não colocar binários grandes no projeto.
- Não reabrir WASM.
