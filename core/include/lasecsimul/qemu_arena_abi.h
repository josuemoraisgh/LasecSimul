/*
 * QemuArena ABI v2 — espelho EXATO de `qemuArena_t` em
 * src/microsim/cores/qemu/qemudevice.h do SimulIDE (C:\SourceCode\simulide_2) e do
 * `system/simuliface.h` do fork QEMU real (C:\SourceCode\qemu_simulide, repo
 * github.com/Arcachofo/qemu_simulide) — não um redesenho. O binário já compilado
 * (devices/qemu-esp32/bin/qemu-system-xtensa.exe, vendorizado a partir da distribuição oficial
 * SimulIDE_2-R260501_Win64, confirmado via string embutida "Qemu: readReg TIMEOUT"/"Qemu:
 * waitForSynch TIMEOUT" que só existem nesta versão do protocolo) depende deste layout exato,
 * campo a campo, na mesma ordem. Mudar a forma da struct exigiria recompilar o QEMU — por isso
 * NÃO há cabeçalho de versão dentro dela.
 *
 * v1 desta ABI (removida, não documentada aqui — git log é o changelog) espelhava uma revisão
 * MAIS ANTIGA do protocolo (dispatch por tag `simuAction` fixo tipo ESP_GPIO_OUT com payload já
 * decodificado pelo lado QEMU, sem endereço de registrador). Essa revisão antiga NÃO é mais a
 * usada — o binário vendorizado é da v2.
 *
 * Protocolo v2 (registrador bruto, endereço real — não mais tag pré-decodificada):
 *
 *   QEMU -> Core, ESCRITA de registrador: QEMU seta `regAddr`+`regData`, `simuAction = SIM_WRITE`,
 *   depois `simuTime != 0`. Não espera resposta do Core pra ESTA escrita especificamente (fire-
 *   and-forget) — só bloqueia na PRÓXIMA chamada de readReg/writeReg, esperando `simuTime` voltar
 *   a 0 (confirma que o Core processou a anterior).
 *
 *   QEMU -> Core, LEITURA de registrador: QEMU seta `regAddr`, `qemuAction = 0`,
 *   `simuAction = SIM_READ`, `simuTime != 0`, e bloqueia em `while(!qemuAction)` -- o Core
 *   responde setando `regData` (o valor lido) E `qemuAction = SIM_READ` (é isso que desbloqueia
 *   QEMU, não `simuTime`).
 *
 *   Em AMBOS os casos, o Core sempre zera `simuTime` no final do seu processamento (libera
 *   `waitForSynch()`, chamado no INÍCIO da PRÓXIMA ação do QEMU).
 *
 *   IRQ: se `irqNumber != 0` quando o Core processa uma ação, o QEMU injeta essa interrupção
 *   (nível em `irqLevel`) antes de continuar — ver `setInterrupt()`/`waitForSynch()` no
 *   simuliface.c real.
 *
 *   `loop_timeout_ns`/`ps_per_inst`: parâmetros de timing que o Core ajusta conforme a frequência
 *   de clock configurada pelo adaptador (ver `Esp32::updtFrequency()`/`SIM_FREQ`).
 *
 * Versionamento: NÃO está nesta struct (quebraria o layout que o binário já compilado espera).
 * Compatibilidade é controlada por qual binário/fonte de QEMU está vendorizado em
 * devices/qemu-esp32/bin/ — não por negociação em runtime dentro da arena.
 */
#ifndef LASECSIMUL_QEMU_ARENA_ABI_H
#define LASECSIMUL_QEMU_ARENA_ABI_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Espelha `enum simuAction` de qemudevice.h/simuliface.h -- SIM_READ/SIM_WRITE são as ações
 * "normais" de acesso a registrador (endereço bruto, decodificado pelo módulo do Core
 * responsável pela faixa de memória -- ver IMcuAdapter::memoryRegions()). SIM_I2C/SPI/USART/TIMER/
 * GPIO_IN existem no header real mas não têm uso confirmado nesta revisão do protocolo (ficam
 * aqui só pra bater 1:1 com o C original -- não inventar valor que o QEMU real não declara). */
typedef enum LsdnSimAction {
    LSDN_SIM_NONE = 0,
    LSDN_SIM_READ = 1,
    LSDN_SIM_WRITE = 2,
    LSDN_SIM_FREQ = 3,
    LSDN_SIM_INTERRUPT = 4,
    LSDN_SIM_I2C = 10,
    LSDN_SIM_SPI = 11,
    LSDN_SIM_USART = 12,
    LSDN_SIM_TIMER = 13,
    LSDN_SIM_GPIO_IN = 14,
    LSDN_SIM_EVENT = 1 << 7
} LsdnSimAction;

/* Layout EXATO de qemuArena_t -- não reordenar, não inserir campo, não mudar tipo de campo. */
typedef struct LsdnQemuArena {
    uint64_t simuTime;        /* ps — escrito pelo Core, QEMU espera virar 0 (waitForSynch) */
    uint64_t qemuTime;        /* ps — escrito pelo QEMU */
    uint64_t regData;         /* Core->QEMU em leitura; QEMU->Core em escrita */
    uint64_t regAddr;         /* endereço do registrador acessado (absoluto, espaço MMIO do chip) */
    uint64_t irqNumber;       /* != 0: Core quer que o QEMU injete esta IRQ */
    uint64_t irqLevel;        /* nível da IRQ acima (0/1) */
    uint64_t simuAction;      /* QEMU->Core: LsdnSimAction */
    uint64_t qemuAction;      /* Core->QEMU: confirmação de SIM_READ concluído */
    uint64_t running;         /* QEMU seta 1 quando o processo terminou de inicializar */
    int64_t  loop_timeout_ns; /* ajustado pelo Core conforme a frequência de clock do chip */
    double   ps_per_inst;
} LsdnQemuArena;

#ifdef __cplusplus
}
#endif

#endif /* LASECSIMUL_QEMU_ARENA_ABI_H */
