/**
 * Geometria dos símbolos de componente e layout dos terminais (pinos) — inspirada no SimulIDE-dev
 * (`src/components/passive/*`, `src/components/sources/ground.cpp`, `src/gui/circuitwidget/pin.cpp`):
 * zigzag pro resistor, placas paralelas pro capacitor, arcos pro indutor, linhas decrescentes pro
 * terra, terminal como círculo pequeno na ponta de um "lead" reto.
 *
 * Cada `typeId` tem sua PRÓPRIA caixa (`ComponentBox`) — `Component::boundingRect()` do SimulIDE
 * devolve exatamente a geometria real do desenho, nunca um card uniforme (ver `component.h`); aqui é
 * o mesmo princípio: um resistor (70×28) não ocupa o mesmo espaço que um terra (48×56). Geometria e
 * layout de pino são calculados a partir da caixa do tipo, nunca de uma constante global de tamanho.
 */

export interface ComponentBox {
  width: number;
  height: number;
}

const PIN_INSET = 6; // distância do pino até a borda da caixa -- evita cortar o círculo do terminal
const LEAD_MARGIN = 18; // distância do pino até onde o corpo do símbolo começa (componentes de 2 pinos)

export const PIN_RADIUS = 4.5;

const COMPONENT_BOX: Record<string, ComponentBox> = {
  "connectors.junction": { width: 0, height: 0 },
  "passive.resistor": { width: 70, height: 28 },
  "passive.variable_resistor": { width: 74, height: 34 },
  "passive.resistor_dip": { width: 86, height: 120 },
  "passive.potentiometer": { width: 78, height: 48 },
  "passive.ldr": { width: 74, height: 34 },
  "passive.thermistor": { width: 74, height: 34 },
  "passive.rtd": { width: 74, height: 34 },
  "passive.force_strain_gauge": { width: 74, height: 34 },
  "passive.capacitor": { width: 56, height: 36 },
  "passive.electrolytic_capacitor": { width: 60, height: 40 },
  "passive.variable_capacitor": { width: 62, height: 42 },
  "passive.inductor": { width: 80, height: 28 },
  "passive.variable_inductor": { width: 86, height: 34 },
  "passive.transformer": { width: 86, height: 58 },
  "other.ground": { width: 48, height: 36 },
  "connectors.tunnel": { width: 36, height: 36 },
  "sources.dc_voltage": { width: 64, height: 48 },
  "logic.button": { width: 68, height: 32 },
  "switches.push": { width: 68, height: 32 },
  "switches.switch": { width: 68, height: 32 },
  "switches.switch_dip": { width: 86, height: 120 },
  "switches.relay": { width: 86, height: 64 },
  "switches.keypad": { width: 88, height: 88 },
  "active.diode": { width: 70, height: 36 },
  "active.zener": { width: 70, height: 38 },
  "active.diac": { width: 70, height: 38 },
  "active.scr": { width: 76, height: 48 },
  "active.triac": { width: 76, height: 48 },
  "active.bjt": { width: 76, height: 64 },
  "active.mosfet": { width: 76, height: 64 },
  "active.jfet": { width: 76, height: 64 },
  "active.opamp": { width: 86, height: 68 },
  "active.comparator": { width: 86, height: 68 },
  "active.analog_mux": { width: 86, height: 68 },
  "active.volt_regulator": { width: 82, height: 56 },
  "outputs.led": { width: 74, height: 40 },
  "outputs.led_rgb": { width: 78, height: 56 },
  "outputs.led_bar": { width: 92, height: 120 },
  "outputs.led_matrix": { width: 98, height: 120 },
  "outputs.max72xx_matrix": { width: 92, height: 70 },
  "outputs.ws2812": { width: 78, height: 52 },
  "outputs.seven_segment": { width: 82, height: 98 },
  "outputs.hd44780": { width: 128, height: 86 },
  "outputs.aip31068_i2c": { width: 110, height: 58 },
  "outputs.pcd8544": { width: 110, height: 72 },
  "outputs.ks0108": { width: 140, height: 110 },
  "outputs.ssd1306": { width: 110, height: 58 },
  "outputs.sh1107": { width: 110, height: 58 },
  "outputs.st7735": { width: 110, height: 72 },
  "outputs.st7789": { width: 110, height: 72 },
  "outputs.ili9341": { width: 110, height: 72 },
  "outputs.gc9a01a": { width: 86, height: 86 },
  "outputs.pcf8833": { width: 110, height: 72 },
  "outputs.dc_motor": { width: 82, height: 54 },
  "outputs.stepper": { width: 86, height: 74 },
  "outputs.servo": { width: 84, height: 54 },
  "outputs.audio_out": { width: 62, height: 48 },
  "outputs.incandescent_lamp": { width: 72, height: 52 },
  "instruments.voltmeter": { width: 64, height: 48 },

  "meters.probe": { width: 36, height: 28 },
  "meters.ampmeter": { width: 64, height: 48 },
  "meters.freqmeter": { width: 86, height: 32 },
  "meters.oscope": { width: 70, height: 56 },
  "meters.logic_analyzer": { width: 70, height: 64 },

  "sources.fixed_volt": { width: 40, height: 36 },
  "sources.clock": { width: 44, height: 32 },
  "sources.wave_gen": { width: 56, height: 40 },
  "sources.voltage_source": { width: 64, height: 48 },
  "sources.current_source": { width: 64, height: 48 },
  "sources.controlled_source": { width: 56, height: 56 },
  "sources.battery": { width: 48, height: 36 },
  "sources.rail": { width: 36, height: 28 },
  "espressif.esp32": { width: 160, height: 300 },
};
const DEFAULT_BOX: ComponentBox = { width: 70, height: 40 };

/** Caixa (tamanho irregular, por tipo) usada pro `viewBox` do SVG e pro layout dos pinos. */
export function componentBox(typeId: string): ComponentBox {
  return COMPONENT_BOX[typeId] ?? DEFAULT_BOX;
}

/** Posição local (dentro da caixa do componente) do pino `pinIndex` de `pinCount` pinos. 2 pinos:
 * um de cada lado (esquerda/direita), no meio da altura -- igual ao layout Comp2Pin do SimulIDE.
 * 1 pino (terra/túnel): no TOPO, centralizado -- o fio entra por cima e o símbolo (linhas
 * decrescentes do terra, círculo do túnel) fica abaixo, nunca o contrário. */
export function pinLocalPosition(pinIndex: number, pinCount: number, typeId: string): { x: number; y: number } {
  if (typeId === "connectors.junction") return { x: 0, y: 0 };
  const box = componentBox(typeId);
  if (pinCount <= 1) return { x: box.width / 2, y: PIN_INSET };

  const side = pinIndex % 2 === 0 ? PIN_INSET : box.width - PIN_INSET;
  const rowsOnSide = Math.ceil(pinCount / 2);
  const row = Math.floor(pinIndex / 2);
  const y = (box.height / (rowsOnSide + 1)) * (row + 1);
  return { x: side, y };
}

function zigzagPath(x1: number, x2: number, yMid: number, amplitude: number, peaks: number): string {
  const step = (x2 - x1) / (peaks * 2);
  const points = [`M ${x1} ${yMid}`];
  for (let i = 1; i <= peaks * 2; i++) {
    const x = x1 + step * i;
    const y = i % 2 === 1 ? yMid - amplitude : yMid + amplitude;
    points.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  points.push(`L ${x2} ${yMid}`);
  return points.join(" ");
}

/** Leads genéricos (pino -> início do corpo) para componentes de 2 pinos em layout horizontal —
 * cada símbolo desenha só o corpo entre `LEAD_MARGIN` e `largura - LEAD_MARGIN`; o pino em si
 * (círculo) é desenhado por quem chama (renderComponent), não aqui. */
function horizontalLeads(box: ComponentBox, yMid: number): string {
  return (
    `<line x1="${PIN_INSET}" y1="${yMid}" x2="${LEAD_MARGIN}" y2="${yMid}" class="symbol-stroke"/>` +
    `<line x1="${box.width - LEAD_MARGIN}" y1="${yMid}" x2="${box.width - PIN_INSET}" y2="${yMid}" class="symbol-stroke"/>`
  );
}

/** Corpo do símbolo (SVG inline, em coordenadas locais da caixa do tipo) para um `typeId` conhecido.
 * Tipos sem símbolo dedicado caem num retângulo genérico com leads — nunca undefined/branco. */
export function componentSymbolSvg(typeId: string): string {
  const box = componentBox(typeId);
  const yMid = box.height / 2;
  const x1 = LEAD_MARGIN;
  const x2 = box.width - LEAD_MARGIN;
  const midX = box.width / 2;

  const labelBox = (label: string): string =>
    `<rect x="${x1}" y="${Math.max(8, yMid - 14)}" width="${Math.max(24, x2 - x1)}" height="28" class="symbol-stroke" fill="none"/>` +
    `<text x="${midX}" y="${yMid + 4}" text-anchor="middle" class="symbol-text">${label}</text>`;

  const diodeBody = (extra = ""): string =>
    horizontalLeads(box, yMid) +
    `<path d="M ${midX - 9} ${yMid - 12} L ${midX - 9} ${yMid + 12} L ${midX + 8} ${yMid} Z" class="symbol-stroke" fill="none"/>` +
    `<line x1="${midX + 10}" y1="${yMid - 13}" x2="${midX + 10}" y2="${yMid + 13}" class="symbol-stroke symbol-stroke--thick"/>` +
    extra;

  switch (typeId) {
    case "passive.resistor":
    case "passive.variable_resistor":
    case "passive.ldr":
    case "passive.thermistor":
    case "passive.rtd":
    case "passive.force_strain_gauge": {
      const amplitude = box.height / 2 - 5;
      const mark =
        typeId === "passive.variable_resistor"
          ? `<line x1="${midX - 12}" y1="${yMid + 14}" x2="${midX + 12}" y2="${yMid - 14}" class="symbol-stroke symbol-stroke--accent"/>`
          : typeId !== "passive.resistor"
            ? `<text x="${midX}" y="${yMid - 11}" text-anchor="middle" class="symbol-text">${(typeId.split(".")[1] ?? "").slice(0, 3).toUpperCase()}</text>`
            : "";
      return horizontalLeads(box, yMid) + `<path d="${zigzagPath(x1, x2, yMid, amplitude, 3)}" class="symbol-stroke"/>` + mark;
    }

    case "passive.resistor_dip":
    case "switches.switch_dip":
      return labelBox(typeId === "passive.resistor_dip" ? "DIP-R" : "DIP-SW");

    case "passive.potentiometer":
      return (
        horizontalLeads(box, yMid) +
        `<path d="${zigzagPath(x1, x2, yMid, 8, 3)}" class="symbol-stroke"/>` +
        `<line x1="${midX}" y1="${box.height - PIN_INSET}" x2="${midX}" y2="${yMid + 7}" class="symbol-stroke"/>` +
        `<path d="M ${midX - 7} ${yMid + 9} L ${midX} ${yMid + 2} L ${midX + 7} ${yMid + 9}" class="symbol-stroke" fill="none"/>`
      );

    case "passive.capacitor": {
      const plateHalfLength = box.height / 2 - 6;
      return (
        horizontalLeads(box, yMid) +
        `<line x1="${x1}" y1="${yMid}" x2="${midX - 5}" y2="${yMid}" class="symbol-stroke"/>` +
        `<line x1="${midX + 5}" y1="${yMid}" x2="${x2}" y2="${yMid}" class="symbol-stroke"/>` +
        `<line x1="${midX - 5}" y1="${yMid - plateHalfLength}" x2="${midX - 5}" y2="${yMid + plateHalfLength}" class="symbol-stroke symbol-stroke--thick"/>` +
        `<line x1="${midX + 5}" y1="${yMid - plateHalfLength}" x2="${midX + 5}" y2="${yMid + plateHalfLength}" class="symbol-stroke symbol-stroke--thick"/>`
      );
    }

    case "passive.electrolytic_capacitor":
      return (
        componentSymbolSvg("passive.capacitor") +
        `<text x="${midX - 15}" y="${yMid - 12}" text-anchor="middle" class="symbol-text">+</text>`
      );

    case "passive.variable_capacitor":
      return componentSymbolSvg("passive.capacitor") +
        `<line x1="${midX - 18}" y1="${yMid + 16}" x2="${midX + 18}" y2="${yMid - 16}" class="symbol-stroke symbol-stroke--accent"/>`;

    case "passive.inductor": {
      const loopWidth = (x2 - x1) / 3;
      const ry = box.height / 2 - 5;
      let arcs = horizontalLeads(box, yMid);
      for (let i = 0; i < 3; i++) {
        const cx = x1 + loopWidth * (i + 0.5);
        const left = (cx - loopWidth / 2).toFixed(1);
        const right = (cx + loopWidth / 2).toFixed(1);
        arcs += `<path d="M ${left} ${yMid} A ${(loopWidth / 2).toFixed(1)} ${ry.toFixed(1)} 0 1 1 ${right} ${yMid}" class="symbol-stroke"/>`;
      }
      return arcs;
    }

    case "passive.variable_inductor":
      return componentSymbolSvg("passive.inductor") +
        `<line x1="${midX - 18}" y1="${yMid + 14}" x2="${midX + 18}" y2="${yMid - 14}" class="symbol-stroke symbol-stroke--accent"/>`;

    case "passive.transformer":
      return (
        `<line x1="${PIN_INSET}" y1="${box.height * 0.3}" x2="${LEAD_MARGIN}" y2="${box.height * 0.3}" class="symbol-stroke"/>` +
        `<line x1="${PIN_INSET}" y1="${box.height * 0.7}" x2="${LEAD_MARGIN}" y2="${box.height * 0.7}" class="symbol-stroke"/>` +
        `<line x1="${box.width - LEAD_MARGIN}" y1="${box.height * 0.3}" x2="${box.width - PIN_INSET}" y2="${box.height * 0.3}" class="symbol-stroke"/>` +
        `<line x1="${box.width - LEAD_MARGIN}" y1="${box.height * 0.7}" x2="${box.width - PIN_INSET}" y2="${box.height * 0.7}" class="symbol-stroke"/>` +
        `<path d="M 24 16 A 8 8 0 1 1 24 30 A 8 8 0 1 1 24 44" class="symbol-stroke" fill="none"/>` +
        `<path d="M ${box.width - 24} 16 A 8 8 0 1 0 ${box.width - 24} 30 A 8 8 0 1 0 ${box.width - 24} 44" class="symbol-stroke" fill="none"/>` +
        `<line x1="${midX - 3}" y1="12" x2="${midX - 3}" y2="${box.height - 12}" class="symbol-stroke"/>` +
        `<line x1="${midX + 3}" y1="12" x2="${midX + 3}" y2="${box.height - 12}" class="symbol-stroke"/>`
      );

    case "other.ground":
      // Pino no topo (PIN_INSET); lead desce até a linha mais larga, que fica logo abaixo do fio --
      // as linhas vão encolhendo conforme se afastam do pino, nunca o contrário.
      return (
        `<line x1="${midX}" y1="${PIN_INSET}" x2="${midX}" y2="14" class="symbol-stroke"/>` +
        `<line x1="${midX - 12}" y1="14" x2="${midX + 12}" y2="14" class="symbol-stroke"/>` +
        `<line x1="${midX - 8}" y1="20" x2="${midX + 8}" y2="20" class="symbol-stroke"/>` +
        `<line x1="${midX - 4}" y1="26" x2="${midX + 4}" y2="26" class="symbol-stroke"/>`
      );

    case "connectors.tunnel":
      return (
        `<line x1="${midX}" y1="${PIN_INSET}" x2="${midX}" y2="${yMid - 8}" class="symbol-stroke"/>` +
        `<circle cx="${midX}" cy="${yMid}" r="8" class="symbol-stroke" fill="none"/>`
      );

    case "sources.dc_voltage":
      return (
        horizontalLeads(box, yMid) +
        `<line x1="${x1}" y1="${yMid}" x2="${midX - 14}" y2="${yMid}" class="symbol-stroke"/>` +
        `<line x1="${midX + 14}" y1="${yMid}" x2="${x2}" y2="${yMid}" class="symbol-stroke"/>` +
        `<circle cx="${midX}" cy="${yMid}" r="14" class="symbol-stroke" fill="none"/>` +
        `<text x="${midX - 7}" y="${yMid + 5}" text-anchor="middle" class="symbol-text">+</text>` +
        `<text x="${midX + 7}" y="${yMid + 5}" text-anchor="middle" class="symbol-text">&#8722;</text>` +
        `<line x1="${PIN_INSET}" y1="${yMid - 7}" x2="${PIN_INSET}" y2="${yMid + 7}" class="symbol-stroke symbol-stroke--accent"/>` +
        `<line x1="${box.width - PIN_INSET - 6}" y1="${yMid}" x2="${box.width - PIN_INSET + 6}" y2="${yMid}" class="symbol-stroke symbol-stroke--accent"/>`
      );

    case "logic.button":
    case "switches.push":
    case "switches.switch": {
      const rise = box.height / 2 - 5;
      return (
        horizontalLeads(box, yMid) +
        `<line x1="${x1}" y1="${yMid}" x2="${midX - 8}" y2="${yMid}" class="symbol-stroke"/>` +
        `<line x1="${midX + 8}" y1="${yMid}" x2="${x2}" y2="${yMid}" class="symbol-stroke"/>` +
        `<circle cx="${midX - 8}" cy="${yMid}" r="2" class="symbol-stroke" fill="currentColor"/>` +
        `<circle cx="${midX + 8}" cy="${yMid}" r="2" class="symbol-stroke" fill="currentColor"/>` +
        `<line x1="${midX - 8}" y1="${yMid}" x2="${midX + 6}" y2="${(yMid - rise).toFixed(1)}" class="symbol-stroke"/>`
      );
    }

    case "switches.relay":
      return (
        `<rect x="12" y="10" width="24" height="20" class="symbol-stroke" fill="none"/>` +
        `<line x1="${PIN_INSET}" y1="20" x2="12" y2="20" class="symbol-stroke"/>` +
        `<line x1="36" y1="20" x2="${midX - 2}" y2="20" class="symbol-stroke"/>` +
        `<line x1="${midX + 4}" y1="${box.height - 18}" x2="${box.width - PIN_INSET}" y2="${box.height - 18}" class="symbol-stroke"/>` +
        `<line x1="${midX + 4}" y1="${box.height - 18}" x2="${box.width - 28}" y2="${box.height - 34}" class="symbol-stroke"/>` +
        `<circle cx="${midX + 4}" cy="${box.height - 18}" r="2" class="symbol-stroke" fill="currentColor"/>` +
        `<circle cx="${box.width - 28}" cy="${box.height - 18}" r="2" class="symbol-stroke" fill="currentColor"/>`
      );

    case "switches.keypad":
      return (
        `<rect x="14" y="12" width="${box.width - 28}" height="${box.height - 24}" class="symbol-stroke" fill="none"/>` +
        Array.from({ length: 4 }, (_, row) =>
          Array.from({ length: 4 }, (_, col) =>
            `<rect x="${24 + col * 12}" y="${22 + row * 12}" width="8" height="8" rx="1" class="symbol-stroke" fill="none"/>`
          ).join("")
        ).join("")
      );

    case "active.diode":
    case "active.zener":
    case "active.diac":
    case "active.scr":
    case "active.triac":
    case "outputs.led":
      return diodeBody(
        typeId === "active.zener"
          ? `<path d="M ${midX + 10} ${yMid - 13} l 5 -5 M ${midX + 10} ${yMid + 13} l -5 5" class="symbol-stroke"/>`
          : typeId === "outputs.led"
            ? `<path d="M ${midX + 16} ${yMid - 14} l 8 -8 M ${midX + 20} ${yMid - 6} l 8 -8" class="symbol-stroke symbol-stroke--accent"/>`
            : ""
      );

    case "active.bjt":
    case "active.mosfet":
    case "active.jfet":
      return (
        `<circle cx="${midX}" cy="${yMid}" r="18" class="symbol-stroke" fill="none"/>` +
        `<line x1="${PIN_INSET}" y1="${yMid}" x2="${midX - 12}" y2="${yMid}" class="symbol-stroke"/>` +
        `<line x1="${midX}" y1="${yMid - 16}" x2="${box.width - PIN_INSET}" y2="${PIN_INSET}" class="symbol-stroke"/>` +
        `<line x1="${midX}" y1="${yMid + 16}" x2="${box.width - PIN_INSET}" y2="${box.height - PIN_INSET}" class="symbol-stroke"/>` +
        `<line x1="${midX - 12}" y1="${yMid - 16}" x2="${midX - 12}" y2="${yMid + 16}" class="symbol-stroke"/>`
      );

    case "active.opamp":
    case "active.comparator":
      return (
        `<path d="M 24 12 L 24 ${box.height - 12} L ${box.width - 16} ${yMid} Z" class="symbol-stroke" fill="none"/>` +
        `<line x1="${PIN_INSET}" y1="${box.height * 0.35}" x2="24" y2="${box.height * 0.35}" class="symbol-stroke"/>` +
        `<line x1="${PIN_INSET}" y1="${box.height * 0.65}" x2="24" y2="${box.height * 0.65}" class="symbol-stroke"/>` +
        `<line x1="${box.width - 16}" y1="${yMid}" x2="${box.width - PIN_INSET}" y2="${yMid}" class="symbol-stroke"/>` +
        `<text x="18" y="${box.height * 0.36 + 4}" text-anchor="middle" class="symbol-text">+</text>` +
        `<text x="18" y="${box.height * 0.66 + 4}" text-anchor="middle" class="symbol-text">-</text>`
      );

    case "active.analog_mux":
      return labelBox("MUX");

    case "active.volt_regulator":
      return labelBox("REG");

    case "outputs.led_rgb":
      return labelBox("RGB");
    case "outputs.led_bar":
      return labelBox("LED BAR");
    case "outputs.led_matrix":
    case "outputs.max72xx_matrix":
    case "outputs.ws2812":
      return labelBox("MATRIX");
    case "outputs.seven_segment":
      return labelBox("7SEG");
    case "outputs.dc_motor":
      return labelBox("M");
    case "outputs.stepper":
      return labelBox("STEP");
    case "outputs.servo":
      return labelBox("SERVO");
    case "outputs.audio_out":
      return labelBox("AUDIO");
    case "espressif.esp32":
      return (
        `<rect x="24" y="18" width="${box.width - 48}" height="${box.height - 36}" rx="8" class="symbol-stroke" fill="none"/>` +
        `<rect x="${midX - 26}" y="${yMid - 34}" width="52" height="68" rx="6" class="symbol-stroke" fill="none"/>` +
        `<text x="${midX}" y="${yMid - 6}" text-anchor="middle" class="symbol-text">ESP32</text>` +
        `<text x="${midX}" y="${yMid + 14}" text-anchor="middle" class="symbol-text">QEMU</text>`
      );
    case "outputs.incandescent_lamp":
      return (
        horizontalLeads(box, yMid) +
        `<circle cx="${midX}" cy="${yMid}" r="14" class="symbol-stroke" fill="none"/>` +
        `<path d="M ${midX - 8} ${yMid - 8} L ${midX + 8} ${yMid + 8} M ${midX + 8} ${yMid - 8} L ${midX - 8} ${yMid + 8}" class="symbol-stroke"/>`
      );

    case "outputs.hd44780":
    case "outputs.aip31068_i2c":
    case "outputs.pcd8544":
    case "outputs.ks0108":
    case "outputs.ssd1306":
    case "outputs.sh1107":
    case "outputs.st7735":
    case "outputs.st7789":
    case "outputs.ili9341":
    case "outputs.gc9a01a":
    case "outputs.pcf8833":
      return labelBox((typeId.split(".")[1] ?? typeId).replace(/_/g, " ").toUpperCase());

    case "instruments.voltmeter":
      // Limitação conhecida: o plugin agora declara um 3º pino ("outPin", saída analógica da
      // leitura -- ver devices/voltmeter/src/lib.c) renderizado pelo algoritmo GENÉRICO de
      // pinLocalPosition (2 á esquerda/direita + 1 extra reaproveitando o lado esquerdo numa
      // segunda linha), não pela posição declarada em device.json -- o renderizador de `package`
      // genérico ainda não existe (Épico G do roadmap de pendências). O corpo abaixo só desenha
      // os leads/círculo dos 2 pinos de medição; o 3º pino aparece como ponto sem lead próprio até
      // esse renderizador existir.
      return (
        horizontalLeads(box, yMid) +
        `<line x1="${x1}" y1="${yMid}" x2="${midX - 14}" y2="${yMid}" class="symbol-stroke"/>` +
        `<line x1="${midX + 14}" y1="${yMid}" x2="${x2}" y2="${yMid}" class="symbol-stroke"/>` +
        `<circle cx="${midX}" cy="${yMid}" r="14" class="symbol-stroke symbol-stroke--accent" fill="none"/>` +
        `<text x="${midX}" y="${yMid + 5}" text-anchor="middle" class="symbol-text symbol-text--accent">V</text>`
      );

    // ── Medidores (pasta "Meters" do SimulIDE) ──────────────────────────────────
    case "meters.probe":
      // Sonda de 1 pino: linha até o corpo + círculo, igual a Probe::paint do SimulIDE (Component::
      // paint + drawEllipse) -- sem leads horizontais (só 1 pino, no topo).
      return (
        `<line x1="${midX}" y1="${PIN_INSET}" x2="${midX}" y2="${yMid - 8}" class="symbol-stroke"/>` +
        `<circle cx="${midX}" cy="${yMid}" r="8" class="symbol-stroke" fill="none"/>`
      );

    case "meters.ampmeter":
      return (
        horizontalLeads(box, yMid) +
        `<line x1="${x1}" y1="${yMid}" x2="${midX - 14}" y2="${yMid}" class="symbol-stroke"/>` +
        `<line x1="${midX + 14}" y1="${yMid}" x2="${x2}" y2="${yMid}" class="symbol-stroke"/>` +
        `<circle cx="${midX}" cy="${yMid}" r="14" class="symbol-stroke symbol-stroke--accent" fill="none"/>` +
        `<text x="${midX}" y="${yMid + 5}" text-anchor="middle" class="symbol-text symbol-text--accent">A</text>`
      );

    case "meters.freqmeter":
      return (
        `<rect x="4" y="2" width="${box.width - 8}" height="${box.height - 4}" rx="2" class="symbol-stroke" fill="none"/>` +
        `<text x="${midX}" y="${yMid + 4}" text-anchor="middle" class="symbol-text">Hz</text>`
      );

    case "meters.oscope":
      // Caixa preta com uma forma de onda simplificada -- mesmo espírito do Oscope::paint (corpo
      // preenchido) sem a janela de plotagem real (ver docstring de Oscope.hpp no Core).
      return (
        `<rect x="2" y="2" width="${box.width - 4}" height="${box.height - 4}" rx="2" class="symbol-stroke" fill="none"/>` +
        `<path d="M 8 ${yMid} L 16 ${yMid} L 22 ${yMid - 12} L 30 ${yMid + 12} L 38 ${yMid - 8} L ${box.width - 8} ${yMid}" class="symbol-stroke symbol-stroke--accent" fill="none"/>`
      );

    case "meters.logic_analyzer":
      return (
        `<rect x="2" y="2" width="${box.width - 4}" height="${box.height - 4}" rx="2" class="symbol-stroke" fill="none"/>` +
        `<path d="M 8 ${yMid + 10} L 8 ${yMid - 4} L 20 ${yMid - 4} L 20 ${yMid + 10} L 32 ${yMid + 10} L 32 ${yMid - 12} L 44 ${yMid - 12} L 44 ${yMid + 10} L ${box.width - 8} ${yMid + 10}" class="symbol-stroke symbol-stroke--accent" fill="none"/>`
      );

    // ── Fontes (pasta "Sources" do SimulIDE) ────────────────────────────────────
    case "sources.fixed_volt":
      // Botão liga/desliga -- mesmo roundedRect colorido do FixedVolt::paint original.
      return `<rect x="${(box.width - 16) / 2}" y="${(box.height - 16) / 2}" width="16" height="16" rx="2" class="symbol-stroke" fill="none"/>`;

    case "sources.clock":
      // Pulso quadrado -- mesma sequência exata de drawLine do Clock::paint original.
      return (
        `<path d="M ${midX - 11} ${yMid + 3} L ${midX - 11} ${yMid - 3} L ${midX - 5} ${yMid - 3} L ${midX - 5} ${yMid + 3} ` +
        `L ${midX + 1} ${yMid + 3} L ${midX + 1} ${yMid - 3} L ${midX + 4} ${yMid - 3}" class="symbol-stroke" fill="none"/>`
      );

    case "sources.wave_gen":
      return (
        `<rect x="4" y="4" width="${box.width - 8}" height="${box.height - 8}" rx="2" class="symbol-stroke" fill="none"/>` +
        `<path d="M 10 ${yMid} Q ${midX - 8} ${yMid - 12}, ${midX} ${yMid} T ${box.width - 10} ${yMid}" class="symbol-stroke symbol-stroke--accent" fill="none"/>`
      );

    case "sources.voltage_source":
      return (
        horizontalLeads(box, yMid) +
        `<line x1="${x1}" y1="${yMid}" x2="${midX - 14}" y2="${yMid}" class="symbol-stroke"/>` +
        `<line x1="${midX + 14}" y1="${yMid}" x2="${x2}" y2="${yMid}" class="symbol-stroke"/>` +
        `<circle cx="${midX}" cy="${yMid}" r="14" class="symbol-stroke" fill="none"/>` +
        `<text x="${midX}" y="${yMid + 5}" text-anchor="middle" class="symbol-text">V</text>` +
        `<line x1="${midX - 7}" y1="${yMid - 11}" x2="${midX + 7}" y2="${yMid - 11}" class="symbol-stroke symbol-stroke--accent"/>`
      );

    case "sources.current_source":
      return (
        horizontalLeads(box, yMid) +
        `<line x1="${x1}" y1="${yMid}" x2="${midX - 14}" y2="${yMid}" class="symbol-stroke"/>` +
        `<line x1="${midX + 14}" y1="${yMid}" x2="${x2}" y2="${yMid}" class="symbol-stroke"/>` +
        `<circle cx="${midX}" cy="${yMid}" r="14" class="symbol-stroke" fill="none"/>` +
        `<line x1="${midX}" y1="${yMid + 8}" x2="${midX}" y2="${yMid - 8}" class="symbol-stroke symbol-stroke--accent"/>` +
        `<path d="M ${midX - 4} ${yMid - 4} L ${midX} ${yMid - 8} L ${midX + 4} ${yMid - 4}" class="symbol-stroke symbol-stroke--accent" fill="none"/>`
      );

    case "sources.controlled_source": {
      // Diamante (Csource::paint do original, modo "control pins": polígono de 4 pontos) com seta
      // de corrente -- mesma lógica de m_currSource do original.
      const cx = box.width / 2;
      const cy = box.height / 2;
      return (
        `<path d="M ${cx - 16} ${cy} L ${cx} ${cy - 26} L ${cx + 16} ${cy} L ${cx} ${cy + 26} Z" class="symbol-stroke" fill="none"/>` +
        `<line x1="${cx}" y1="${cy - 10}" x2="${cx}" y2="${cy + 10}" class="symbol-stroke symbol-stroke--accent"/>` +
        `<path d="M ${cx - 4} ${cy + 4} L ${cx} ${cy + 10} L ${cx + 4} ${cy + 4}" class="symbol-stroke symbol-stroke--accent" fill="none"/>`
      );
    }

    case "sources.battery":
      // Barras alternadas longa/curta -- mesma sequência exata de drawLine do Battery::paint original.
      return (
        `<line x1="${midX - 7}" y1="${yMid - 8}" x2="${midX - 7}" y2="${yMid + 8}" class="symbol-stroke symbol-stroke--thick"/>` +
        `<line x1="${midX - 2}" y1="${yMid - 3}" x2="${midX - 2}" y2="${yMid + 3}" class="symbol-stroke"/>` +
        `<line x1="${midX + 3}" y1="${yMid - 8}" x2="${midX + 3}" y2="${yMid + 8}" class="symbol-stroke symbol-stroke--thick"/>` +
        `<line x1="${midX + 8}" y1="${yMid - 3}" x2="${midX + 8}" y2="${yMid + 3}" class="symbol-stroke"/>`
      );

    case "sources.rail":
      // Seta/bandeira -- mesmo polígono do Rail::paint original (drawPolygon de 4 pontos).
      return `<path d="M ${midX - 5} ${yMid - 8} L ${midX - 5} ${yMid + 8} L ${midX + 9} ${yMid + 1} L ${midX + 9} ${yMid - 1} Z" class="symbol-stroke" fill="none"/>`;

    default:
      return horizontalLeads(box, yMid) + `<rect x="${x1}" y="${yMid - 10}" width="${x2 - x1}" height="20" class="symbol-stroke" fill="none"/>`;
  }
}
