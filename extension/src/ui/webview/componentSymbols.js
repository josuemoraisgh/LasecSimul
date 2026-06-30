"use strict";
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIN_RADIUS = void 0;
exports.registerPackage = registerPackage;
exports.packageSymbolSvg = packageSymbolSvg;
exports.componentBox = componentBox;
exports.hasRealPinPosition = hasRealPinPosition;
exports.pinLocalPosition = pinLocalPosition;
exports.componentSymbolSvg = componentSymbolSvg;
var PIN_INSET = 6; // distância do pino até a borda da caixa -- evita cortar o círculo do terminal
var LEAD_MARGIN = 18; // distância do pino até onde o corpo do símbolo começa (componentes de 2 pinos)
exports.PIN_RADIUS = 4.5;
function resolvePackageLayout(pkg) {
    var minX = 0;
    var minY = 0;
    var maxX = pkg.width;
    var maxY = pkg.height;
    var tips = pkg.pins.map(function (pin) {
        var rad = (pin.angle * Math.PI) / 180;
        var tipX = pin.x + Math.cos(rad) * pin.length;
        var tipY = pin.y + Math.sin(rad) * pin.length;
        minX = Math.min(minX, tipX, pin.x);
        maxX = Math.max(maxX, tipX, pin.x);
        minY = Math.min(minY, tipY, pin.y);
        maxY = Math.max(maxY, tipY, pin.y);
        // Rótulo pode ter posição própria, arrastada pra fora do alcance do lead (ver model.ts
        // PackagePin.labelX/labelY) -- sem isso no cálculo, um rótulo arrastado bem pra fora poderia
        // ficar fora do viewBox calculado (overflow:visible evita corte, mas o box do componente
        // ficaria menor do que devia).
        if (pin.labelX !== undefined) {
            minX = Math.min(minX, pin.labelX);
            maxX = Math.max(maxX, pin.labelX);
        }
        if (pin.labelY !== undefined) {
            minY = Math.min(minY, pin.labelY);
            maxY = Math.max(maxY, pin.labelY);
        }
        return __assign(__assign({}, pin), { tipX: tipX, tipY: tipY });
    });
    var offsetX = -minX;
    var offsetY = -minY;
    var nativeWidth = maxX - minX;
    var nativeHeight = maxY - minY;
    var displayWidth = typeof pkg.schematicWidth === "number" && pkg.schematicWidth > 0 ? pkg.schematicWidth : nativeWidth;
    var displayHeight = typeof pkg.schematicHeight === "number" && pkg.schematicHeight > 0 ? pkg.schematicHeight : nativeHeight;
    var scaleX = nativeWidth > 0 ? displayWidth / nativeWidth : 1;
    var scaleY = nativeHeight > 0 ? displayHeight / nativeHeight : 1;
    return {
        width: displayWidth,
        height: displayHeight,
        offsetX: offsetX,
        offsetY: offsetY,
        scaleX: scaleX,
        scaleY: scaleY,
        pins: tips.map(function (pin) { return (__assign(__assign({}, pin), { tipX: (pin.tipX + offsetX) * scaleX, tipY: (pin.tipY + offsetY) * scaleY })); }),
        source: pkg,
    };
}
var RESOLVED_PACKAGE_BY_TYPE_ID = new Map();
/** Aparência ALTERNATIVA opcional ("Chip or Logic Symbol", igual ao `SubPackage::Logic_Symbol` do
 * SimulIDE real -- booleano simples, não uma lista de N variantes). Mapa SEPARADO do padrão (não um
 * 2º registro no mesmo mapa) pra não precisar inventar uma chave composta -- escolhido em
 * `resolvedPackageFor` pela propriedade `logicSymbol` da INSTÂNCIA, ver model.ts
 * `WebviewComponentCatalogEntry.logicSymbolPackage`. */
var RESOLVED_LOGIC_SYMBOL_PACKAGE_BY_TYPE_ID = new Map();
/** Chamado quando o catálogo chega/atualiza (ver `main.ts`) -- cacheia o layout resolvido (cálculo
 * de deslocamento é o mesmo pra toda renderização do mesmo typeId, não precisa repetir por frame).
 * `undefined` remove (typeId sem package mais, ou catálogo recarregado do zero). */
function registerPackage(typeId, pkg, logicSymbolPkg) {
    if (pkg && pkg.pins.length > 0)
        RESOLVED_PACKAGE_BY_TYPE_ID.set(typeId, resolvePackageLayout(pkg));
    else
        RESOLVED_PACKAGE_BY_TYPE_ID.delete(typeId);
    if (logicSymbolPkg && logicSymbolPkg.pins.length > 0)
        RESOLVED_LOGIC_SYMBOL_PACKAGE_BY_TYPE_ID.set(typeId, resolvePackageLayout(logicSymbolPkg));
    else
        RESOLVED_LOGIC_SYMBOL_PACKAGE_BY_TYPE_ID.delete(typeId);
}
/** `properties.logicSymbol === true` E existe uma variante Logic Symbol registrada pra este typeId
 * -> usa ela; qualquer outro caso (sem variante, propriedade ausente/falsa, ou sem `properties`
 * nenhuma -- chamadas legadas que só passam typeId) -> cai no `package` padrão de sempre. */
function resolvedPackageFor(typeId, properties) {
    if ((properties === null || properties === void 0 ? void 0 : properties.logicSymbol) === true) {
        var logicSymbolResolved = RESOLVED_LOGIC_SYMBOL_PACKAGE_BY_TYPE_ID.get(typeId);
        if (logicSymbolResolved)
            return logicSymbolResolved;
    }
    return RESOLVED_PACKAGE_BY_TYPE_ID.get(typeId);
}
/** Corpo do símbolo a partir do `package` real, se este typeId tiver um registrado -- `undefined`
 * pra `main.ts` cair em `catalogEntry?.symbolSvg ?? componentSymbolSvg(typeId)` (mesma prioridade
 * de sempre, só com `package` real entrando ANTES de symbolSvg). */
function packageSymbolSvg(typeId, properties) {
    var resolved = resolvedPackageFor(typeId, properties);
    return resolved ? packageBodySvg(resolved) : undefined;
}
function escapeXmlText(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatRailVoltage(value) {
    if (Number.isInteger(value))
        return String(value);
    return Number(value.toFixed(2)).toString();
}
function symbolReadoutNumber(properties) {
    return typeof (properties === null || properties === void 0 ? void 0 : properties.__readout) === "number" ? properties.__readout : undefined;
}
function symbolReadoutArray(properties) {
    return Array.isArray(properties === null || properties === void 0 ? void 0 : properties.__readout) ? properties.__readout.map(function (value) { return Number(value) || 0; }) : [];
}
function symbolHistoryArray(properties) {
    return Array.isArray(properties === null || properties === void 0 ? void 0 : properties.__history) ? properties.__history.map(function (value) { return Number(value) || 0; }) : [];
}
function symbolHistoryMatrix(properties) {
    if (!Array.isArray(properties === null || properties === void 0 ? void 0 : properties.__history))
        return [];
    return properties.__history.map(function (row) { return Array.isArray(row) ? row.map(function (value) { return Number(value) || 0; }) : []; });
}
function formatLcdNumber(value) {
    return (value !== null && value !== void 0 ? value : 0).toFixed(3);
}
function formatHz(value) {
    var hz = value !== null && value !== void 0 ? value : 0;
    if (hz >= 1000)
        return "".concat(Number((hz / 1000).toFixed(2)), " kHz");
    return "".concat(Math.round(hz), " Hz");
}
function tracePath(history, x, y, width, height, min, max) {
    if (min === void 0) { min = -5; }
    if (max === void 0) { max = 5; }
    var samples = history.length > 1 ? history : [0, 0];
    var span = Math.max(1e-9, max - min);
    return samples
        .map(function (value, index) {
        var px = x + (width * index) / Math.max(1, samples.length - 1);
        var normalized = Math.max(0, Math.min(1, (value - min) / span));
        var py = y + height - normalized * height;
        return "".concat(index === 0 ? "M" : "L", " ").concat(px.toFixed(1), " ").concat(py.toFixed(1));
    })
        .join(" ");
}
function packageShapeSvg(shape) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
    switch (shape.kind) {
        case "rect":
            return "<rect x=\"".concat((_a = shape.x) !== null && _a !== void 0 ? _a : 0, "\" y=\"").concat((_b = shape.y) !== null && _b !== void 0 ? _b : 0, "\" width=\"").concat((_c = shape.w) !== null && _c !== void 0 ? _c : 0, "\" height=\"").concat((_d = shape.h) !== null && _d !== void 0 ? _d : 0, "\" stroke=\"").concat((_e = shape.stroke) !== null && _e !== void 0 ? _e : "currentColor", "\" fill=\"").concat((_f = shape.fill) !== null && _f !== void 0 ? _f : "none", "\" stroke-width=\"").concat((_g = shape.strokeWidth) !== null && _g !== void 0 ? _g : 1, "\"/>");
        case "line":
            return "<line x1=\"".concat((_h = shape.x1) !== null && _h !== void 0 ? _h : 0, "\" y1=\"").concat((_j = shape.y1) !== null && _j !== void 0 ? _j : 0, "\" x2=\"").concat((_k = shape.x2) !== null && _k !== void 0 ? _k : 0, "\" y2=\"").concat((_l = shape.y2) !== null && _l !== void 0 ? _l : 0, "\" stroke=\"").concat((_m = shape.stroke) !== null && _m !== void 0 ? _m : "currentColor", "\"/>");
        case "ellipse":
            return "<ellipse cx=\"".concat((_o = shape.cx) !== null && _o !== void 0 ? _o : 0, "\" cy=\"").concat((_p = shape.cy) !== null && _p !== void 0 ? _p : 0, "\" rx=\"").concat((_q = shape.rx) !== null && _q !== void 0 ? _q : 0, "\" ry=\"").concat((_r = shape.ry) !== null && _r !== void 0 ? _r : 0, "\" stroke=\"").concat((_s = shape.stroke) !== null && _s !== void 0 ? _s : "currentColor", "\" fill=\"").concat((_t = shape.fill) !== null && _t !== void 0 ? _t : "none", "\"/>");
        case "text":
        default:
            return "<text x=\"".concat((_u = shape.x) !== null && _u !== void 0 ? _u : 0, "\" y=\"").concat((_v = shape.y) !== null && _v !== void 0 ? _v : 0, "\" text-anchor=\"middle\" font-size=\"").concat((_w = shape.fontSize) !== null && _w !== void 0 ? _w : 11, "\" fill=\"").concat((_x = shape.color) !== null && _x !== void 0 ? _x : "currentColor", "\">").concat(escapeXmlText((_y = shape.value) !== null && _y !== void 0 ? _y : ""), "</text>");
    }
}
/** Lead (corpo -> ponta real) + rótulo, em coordenadas ORIGINAIS do package (sem o deslocamento de
 * `resolvePackageLayout` -- quem chama envolve isto num `<g transform="translate(offsetX,offsetY)">`,
 * ver `packageBodySvg`). O círculo do terminal em si (onde o clique conecta fio) é desenhado por
 * quem chama (`main.ts::renderComponent`), na posição JÁ deslocada devolvida por `pinLocalPosition`. */
function packagePinLeadSvg(pin, labelColor) {
    var _a, _b, _c;
    if (labelColor === void 0) { labelColor = "currentColor"; }
    var rad = (pin.angle * Math.PI) / 180;
    var tipX = pin.x + Math.cos(rad) * pin.length;
    var tipY = pin.y + Math.sin(rad) * pin.length;
    var label = (_a = pin.label) !== null && _a !== void 0 ? _a : pin.id;
    var hasCustomLabelPos = pin.labelX !== undefined && pin.labelY !== undefined;
    var labelX = (_b = pin.labelX) !== null && _b !== void 0 ? _b : tipX + Math.cos(rad) * 9;
    var labelY = (_c = pin.labelY) !== null && _c !== void 0 ? _c : tipY + Math.sin(rad) * 9;
    // Lead vertical (topo/baixo do corpo, angle 90/270) -- texto horizontal colide com o label do
    // pino vizinho quando há muitos pinos apertados num lado só (ex: 12 pinos em 170 unidades no chip
    // ESP32 nu). Giram -90° (lê de baixo pra cima) só nesses dois ângulos -- lead horizontal
    // (esquerda/direita) já tem espaçamento vertical de sobra entre linhas, não precisa girar. Só se
    // aplica na posição PADRÃO (calculada) -- uma vez que o usuário arrastou o rótulo pra um lugar
    // próprio (`labelX`/`labelY`, ver model.ts), a rotação automática pra encaixe apertado não faz
    // mais sentido (ele já escolheu onde e como cabe).
    var isVerticalLead = !hasCustomLabelPos && (pin.angle === 90 || pin.angle === 270);
    var rotateAttr = isVerticalLead ? " transform=\"rotate(-90 ".concat(labelX.toFixed(1), " ").concat(labelY.toFixed(1), ")\"") : "";
    var fillAttr = labelColor === "currentColor" ? " class=\"symbol-text\"" : " fill=\"".concat(labelColor, "\"");
    return ("<line x1=\"".concat(pin.x, "\" y1=\"").concat(pin.y, "\" x2=\"").concat(tipX.toFixed(1), "\" y2=\"").concat(tipY.toFixed(1), "\" class=\"symbol-stroke\"/>") +
        "<text x=\"".concat(labelX.toFixed(1), "\" y=\"").concat(labelY.toFixed(1), "\" text-anchor=\"middle\"").concat(fillAttr, " style=\"font-size:9px\"").concat(rotateAttr, ">").concat(escapeXmlText(label), "</text>"));
}
/** Corpo completo de um typeId com `package`: fundo + formas declarativas + lead/rótulo de cada
 * pino, tudo num único `<g>` deslocado pro espaço sem coordenada negativa que `componentBox` usa
 * pro `viewBox` (ver `resolvePackageLayout`). */
function packageBodySvg(resolved) {
    var _a, _b, _c, _d;
    var pkg = resolved.source;
    var markup = "";
    if (((_a = pkg.background) === null || _a === void 0 ? void 0 : _a.kind) === "color" && pkg.background.value) {
        markup += "<rect x=\"0\" y=\"0\" width=\"".concat(pkg.width, "\" height=\"").concat(pkg.height, "\" fill=\"").concat(pkg.background.value, "\"/>");
    }
    else if (((_b = pkg.background) === null || _b === void 0 ? void 0 : _b.kind) === "image" && pkg.background.data) {
        // `data` é o PNG/JPEG em base64 puro (sem prefixo `data:`) -- mesma convenção de
        // `BckGndData` do SimulIDE real (foto da placa real embutida no próprio arquivo, sem
        // depender de um asset externo que possa ficar pendente). `preserveAspectRatio="none"`
        // porque width/height do package JÁ são as dimensões nativas da imagem (1:1, sem distorção).
        markup += "<image x=\"0\" y=\"0\" width=\"".concat(pkg.width, "\" height=\"").concat(pkg.height, "\" preserveAspectRatio=\"none\" href=\"data:image/png;base64,").concat(pkg.background.data, "\"/>");
    }
    if (pkg.border) {
        markup += "<rect x=\"0.5\" y=\"0.5\" width=\"".concat(Math.max(0, pkg.width - 1), "\" height=\"").concat(Math.max(0, pkg.height - 1), "\" class=\"symbol-stroke\" fill=\"none\"/>");
    }
    for (var _i = 0, _e = (_c = pkg.shapes) !== null && _c !== void 0 ? _c : []; _i < _e.length; _i++) {
        var shape = _e[_i];
        markup += packageShapeSvg(shape);
    }
    var pinLabelColor = (_d = pkg.pinLabelColor) !== null && _d !== void 0 ? _d : "currentColor";
    for (var _f = 0, _g = pkg.pins; _f < _g.length; _f++) {
        var pin = _g[_f];
        markup += packagePinLeadSvg(pin, pinLabelColor);
    }
    return ("<g transform=\"translate(".concat((resolved.offsetX * resolved.scaleX).toFixed(3), ",").concat((resolved.offsetY * resolved.scaleY).toFixed(3), ")\">") +
        "<g transform=\"scale(".concat(resolved.scaleX.toFixed(6), ",").concat(resolved.scaleY.toFixed(6), ")\">").concat(markup, "</g>") +
        "</g>");
}
var COMPONENT_BOX = {
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
    "connectors.bus": { width: 76, height: 28 },
    "connectors.tunnel": { width: 100, height: 44 },
    "connectors.socket": { width: 72, height: 86 },
    "connectors.header": { width: 76, height: 36 },
    "graphics.image": { width: 96, height: 64 },
    "graphics.text": { width: 74, height: 28 },
    "graphics.rectangle": { width: 96, height: 58 },
    "graphics.ellipse": { width: 96, height: 58 },
    "graphics.line": { width: 86, height: 32 },
    "other.package": { width: 84, height: 66 },
    "other.test_unit": { width: 72, height: 56 },
    "other.dial": { width: 56, height: 56 },
    "sources.dc_voltage": { width: 64, height: 48 },
    "logic.button": { width: 68, height: 32 },
    "switches.push": { width: 68, height: 54 },
    "switches.switch": { width: 68, height: 54 },
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
    "instruments.voltmeter": { width: 82, height: 56 },
    "meters.probe": { width: 82, height: 58 },
    "meters.ampmeter": { width: 82, height: 56 },
    "meters.freqmeter": { width: 116, height: 34 },
    "meters.oscope": { width: 260, height: 180 },
    "meters.logic_analyzer": { width: 260, height: 212 },
    "sources.fixed_volt": { width: 76, height: 54 },
    "sources.clock": { width: 44, height: 32 },
    "sources.wave_gen": { width: 56, height: 40 },
    "sources.voltage_source": { width: 64, height: 48 },
    "sources.current_source": { width: 64, height: 48 },
    "sources.controlled_source": { width: 56, height: 56 },
    "sources.battery": { width: 48, height: 36 },
    "sources.rail": { width: 54, height: 70 },
    // Fallbacks usados antes do catalogo registrar o `package` real. Mantemos aqui o MESMO tamanho
    // visual do SimulIDE para evitar "saltos" de escala no primeiro paint.
    "espressif.esp32": { width: 88, height: 98 },
    "subcircuits.esp32_devkitc_v4": { width: 88, height: 176 },
    "subcircuits.esp32_wroom32": { width: 104, height: 160 },
};
var DEFAULT_BOX = { width: 70, height: 40 };
/** Caixa property-driven dos typeIds "de autoria de símbolo" (Épico G) -- `other.package`/
 * `graphics.rectangle`/`ellipse` usam `width`/`height` direto (mesmo significado de
 * `PackageDescriptor.width/height`/`PackageShape.w/h`, ver seção 21.2 do
 * `.spec/lasecsimul-native-devices.spec`). `graphics.line`/`other.package_pin` usam uma caixa
 * QUADRADA centrada no `length` -- o ponto fixo que não se move quando `component.rotation` gira
 * (CSS `rotate()` pivota no CENTRO do elemento, ver `renderComponent`) é o CENTRO da caixa, por isso
 * o desenho "canônico" (rotation=0) tem que colocar a âncora/ponto médio exatamente lá -- ver
 * `componentSymbolSvg` e `extension.ts::compileSymbolAuthoringComponents` (fórmula inversa). */
function propertyDrivenBox(typeId, properties) {
    var _a, _b, _c;
    if (!properties)
        return undefined;
    var numberOf = function (key) { return (typeof properties[key] === "number" ? properties[key] : undefined); };
    var tunnelName = typeof properties.name === "string" ? properties.name.trim() : "";
    switch (typeId) {
        case "connectors.tunnel": {
            var estimatedTextWidth = tunnelName ? tunnelName.length * 7.4 + 18 : 0;
            return { width: Math.max(100, Math.ceil(estimatedTextWidth + 58)), height: 44 };
        }
        case "graphics.rectangle":
        case "graphics.ellipse":
        case "other.package": {
            var width = numberOf("width");
            var height = numberOf("height");
            if (width === undefined || height === undefined)
                return undefined;
            return { width: Math.max(8, width), height: Math.max(8, height) };
        }
        case "graphics.line": {
            var length_1 = (_a = numberOf("length")) !== null && _a !== void 0 ? _a : 40;
            var side = Math.max(20, length_1 + 12);
            return { width: side, height: side };
        }
        case "other.package_pin": {
            var length_2 = (_b = numberOf("length")) !== null && _b !== void 0 ? _b : 8;
            var side = Math.max(24, length_2 * 2 + 16);
            return { width: side, height: side };
        }
        case "graphics.text": {
            var text = typeof properties.text === "string" ? properties.text : "Texto";
            var fontSize = (_c = numberOf("fontSize")) !== null && _c !== void 0 ? _c : 11;
            return { width: Math.max(24, text.length * fontSize * 0.62 + 12), height: fontSize + 14 };
        }
        default:
            return undefined;
    }
}
/** Caixa (tamanho irregular, por tipo) usada pro `viewBox` do SVG e pro layout dos pinos. Quando o
 * typeId tem `package` (ver `registerPackage`), a caixa vem do layout resolvido (já com folga pra
 * leads que saem fora de `0..width`/`0..height`), nunca da tabela estática abaixo. `properties` (a
 * instância, não o typeId) tem prioridade sobre `package`/tabela estática quando presente -- só os
 * típicos "de autoria de símbolo" (`propertyDrivenBox`) realmente usam isso hoje. */
function componentBox(typeId, properties) {
    var _a;
    var resolved = resolvedPackageFor(typeId, properties);
    if (resolved)
        return { width: resolved.width, height: resolved.height };
    var propertyBox = propertyDrivenBox(typeId, properties);
    if (propertyBox)
        return propertyBox;
    if (typeId.startsWith("logic.")) {
        if ([
            "logic.memory",
            "logic.dynamic_memory",
            "logic.mux",
            "logic.demux",
            "logic.bcd_to_dec",
            "logic.dec_to_bcd",
            "logic.bcd_to_7seg",
            "logic.magnitude_comp",
            "logic.shift_reg",
            "logic.seven_segment_bcd",
            "logic.i2c_to_parallel",
        ].includes(typeId)) {
            return { width: 96, height: 126 };
        }
        if (["logic.adc", "logic.dac", "logic.lm555", "logic.flipflop_jk"].includes(typeId))
            return { width: 88, height: 86 };
        return { width: 76, height: 56 };
    }
    return (_a = COMPONENT_BOX[typeId]) !== null && _a !== void 0 ? _a : DEFAULT_BOX;
}
/** Posição local (dentro da caixa do componente) do pino `pinId` (índice `pinIndex` de `pinCount`
 * pinos no array real que o Core devolveu, usado só pra fallback). Quando o typeId tem `package`, a
 * posição vem do layout resolvido, casando por `id` -- nunca por posição no array, porque a ordem
 * real de `component.pins[]` (Core) não é garantida bater com a ordem de `package.pins[]`
 * declarada. Sem `package` (built-ins de sempre), cai no algoritmo genérico de sempre: 2 pinos um de
 * cada lado (esquerda/direita), no meio da altura -- igual ao layout Comp2Pin do SimulIDE; 1 pino
 * (terra/túnel) no TOPO, centralizado. */
/** Falso só quando o typeId TEM `package` real e este pino específico NÃO está nele -- ex: o chip
 * ESP32 nu expõe 42 pinos elétricos (`pinMap`, casa com o que o plugin/Core esperam
 * posicionalmente), mas só 34 deles têm um lead físico desenhado no encapsulamento real (os outros
 * 8 -- GPIO20/24/28-31 não pinados pra fora + UART0_RX/TX, alias elétrico do GPIO3/GPIO1 -- não
 * existem como ponto de solda separado). Sem isto, esses 8 cairiam no algoritmo genérico (posição
 * por índice global entre os 42), aparecendo como bolinhas soltas/embaralhadas por cima do desenho
 * real dos outros 34 -- pior que não desenhar nada. Pra typeId SEM `package` (built-ins de sempre),
 * sempre `true` -- o algoritmo genérico já é a posição "real" deles, nunca um substituto malfeito. */
function hasRealPinPosition(typeId, pinId, properties) {
    var resolved = resolvedPackageFor(typeId, properties);
    if (!resolved)
        return true;
    return resolved.pins.some(function (candidate) { return candidate.id === pinId; });
}
function pinLocalPosition(pinId, pinIndex, pinCount, typeId, properties) {
    var resolved = resolvedPackageFor(typeId, properties);
    if (resolved) {
        var pin = resolved.pins.find(function (candidate) { return candidate.id === pinId; });
        if (pin)
            return { x: pin.tipX, y: pin.tipY };
    }
    if (typeId === "connectors.junction")
        return { x: 0, y: 0 };
    var box = componentBox(typeId, properties);
    if ((typeId === "switches.push" || typeId === "switches.switch") && pinCount <= 2) {
        return { x: pinIndex % 2 === 0 ? PIN_INSET : box.width - PIN_INSET, y: 22 };
    }
    if (typeId === "sources.fixed_volt" && pinCount <= 1) {
        return { x: box.width - PIN_INSET, y: box.height / 2 };
    }
    if (typeId === "sources.rail" && pinCount <= 1) {
        return { x: box.width / 2, y: box.height - PIN_INSET };
    }
    if (typeId === "connectors.tunnel" && pinCount <= 1) {
        // SimulIDE ancora o Tunnel na ponta da seta: o fio deve sair exatamente desse vértice, não do
        // centro/topo do símbolo nem da extensão visual arredondada.
        return { x: box.width - 20, y: box.height / 2 };
    }
    if (typeId === "meters.probe" && pinCount <= 1) {
        // Ponta real do lead desenhado em componentSymbolSvg (line de PIN_INSET até yMid-8) -- não a
        // posição antiga (36,14), que ficava flutuando no meio do lead, não na ponta.
        return { x: box.width / 2, y: PIN_INSET };
    }
    if ((typeId === "meters.ampmeter" || typeId === "instruments.voltmeter") && pinCount >= 3) {
        // Ponta real das "pernas" desenhadas por smallMeterDisplaySvg (rects em x=20/x=38, y=42..54) e
        // do terminal direito (x=width-14..width, y=height/2-3..+3) -- não a posição antiga, que ficava
        // ~4px acima da ponta visual de cada perna.
        if (pinIndex === 0)
            return { x: 22.5, y: 54 };
        if (pinIndex === 1)
            return { x: 40.5, y: 54 };
        return { x: box.width, y: box.height / 2 };
    }
    if (typeId === "meters.freqmeter" && pinCount <= 1) {
        return { x: PIN_INSET, y: box.height / 2 };
    }
    if (typeId === "meters.oscope") {
        return { x: PIN_INSET, y: 28 + pinIndex * 28 };
    }
    if (typeId === "meters.logic_analyzer") {
        return { x: PIN_INSET, y: 20 + pinIndex * 20 };
    }
    if (pinCount <= 1)
        return { x: box.width / 2, y: PIN_INSET };
    var side = pinIndex % 2 === 0 ? PIN_INSET : box.width - PIN_INSET;
    var rowsOnSide = Math.ceil(pinCount / 2);
    var row = Math.floor(pinIndex / 2);
    var y = (box.height / (rowsOnSide + 1)) * (row + 1);
    return { x: side, y: y };
}
function zigzagPath(x1, x2, yMid, amplitude, peaks) {
    var step = (x2 - x1) / (peaks * 2);
    var points = ["M ".concat(x1, " ").concat(yMid)];
    for (var i = 1; i <= peaks * 2; i++) {
        var x = x1 + step * i;
        var y = i % 2 === 1 ? yMid - amplitude : yMid + amplitude;
        points.push("L ".concat(x.toFixed(1), " ").concat(y.toFixed(1)));
    }
    points.push("L ".concat(x2, " ").concat(yMid));
    return points.join(" ");
}
/** Leads genéricos (pino -> início do corpo) para componentes de 2 pinos em layout horizontal —
 * cada símbolo desenha só o corpo entre `LEAD_MARGIN` e `largura - LEAD_MARGIN`; o pino em si
 * (círculo) é desenhado por quem chama (renderComponent), não aqui. */
function horizontalLeads(box, yMid) {
    return ("<line x1=\"".concat(PIN_INSET, "\" y1=\"").concat(yMid, "\" x2=\"").concat(LEAD_MARGIN, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
        "<line x1=\"".concat(box.width - LEAD_MARGIN, "\" y1=\"").concat(yMid, "\" x2=\"").concat(box.width - PIN_INSET, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>"));
}
function smallMeterDisplaySvg(box, unit, readout) {
    return ("<rect x=\"6\" y=\"4\" width=\"58\" height=\"38\" rx=\"3\" class=\"meter-lcd\"/>" +
        "<text x=\"18\" y=\"19\" class=\"meter-lcd-value\">".concat(formatLcdNumber(readout), "</text>") +
        "<text x=\"18\" y=\"35\" class=\"meter-lcd-unit\">".concat(unit, "</text>") +
        "<rect x=\"".concat(box.width - 14, "\" y=\"").concat(box.height / 2 - 3, "\" width=\"14\" height=\"6\" rx=\"3\" fill=\"currentColor\"/>") +
        "<rect x=\"20\" y=\"42\" width=\"5\" height=\"12\" rx=\"2.5\" fill=\"currentColor\"/>" +
        "<rect x=\"38\" y=\"42\" width=\"5\" height=\"12\" rx=\"2.5\" fill=\"currentColor\"/>");
}
function plotGridSvg(x, y, width, height) {
    return Array.from({ length: 9 }, function (_, index) {
        var gx = x + 12 + index * ((width - 24) / 8);
        return "<line x1=\"".concat(gx.toFixed(1), "\" y1=\"").concat(y + 8, "\" x2=\"").concat(gx.toFixed(1), "\" y2=\"").concat(y + height - 8, "\" class=\"meter-plot-grid\"/>");
    }).join("");
}
function scopePanelSvg(properties) {
    var histories = symbolHistoryMatrix(properties);
    var latest = symbolReadoutArray(properties);
    var colors = ["#f6f65a", "#d9d7ff", "#ffd06a", "#00e89a"];
    var plotX = 104;
    var plotY = 8;
    var plotW = 146;
    var plotH = 154;
    // Selo (cor) e valor na MESMA linha (não rótulo empilhado acima do selo) -- cabia "tecnicamente"
    // empilhado, mas em 4 canais ficava espremido contra o botão "Expande" embaixo (overlap real de
    // ~6px entre o último selo e o botão, reportado como "texto fora do lugar"). Mais respiro vertical
    // (height 150->180) some com a colisão de propósito, não só corta o sintoma.
    var rows = colors.map(function (color, index) {
        var _a;
        var y = 16 + index * 30;
        var label = "".concat(formatRailVoltage((_a = latest[index]) !== null && _a !== void 0 ? _a : 0), " V");
        return ("<rect x=\"18\" y=\"".concat(y, "\" width=\"50\" height=\"20\" rx=\"2\" fill=\"").concat(color, "\" stroke=\"#777\"/>") +
            "<text x=\"74\" y=\"".concat(y + 14, "\" class=\"meter-panel-label\">").concat(escapeXmlText(label), "</text>"));
    }).join("");
    var traces = colors.map(function (color, index) {
        var _a;
        var history = (_a = histories[index]) !== null && _a !== void 0 ? _a : [];
        return "<path d=\"".concat(tracePath(history, plotX + 7, plotY + 14, plotW - 14, plotH - 28), "\" fill=\"none\" stroke=\"").concat(color, "\" stroke-width=\"2\"/>");
    }).join("");
    return ("<rect x=\"4\" y=\"2\" width=\"252\" height=\"166\" rx=\"6\" fill=\"#f7f7f7\" stroke=\"currentColor\" stroke-width=\"2\"/>" +
        rows +
        "<rect x=\"18\" y=\"140\" width=\"78\" height=\"20\" rx=\"3\" class=\"meter-expand-button\"/>" +
        "<text x=\"31\" y=\"154\" class=\"meter-panel-button\">Expande</text>" +
        "<rect x=\"".concat(plotX, "\" y=\"").concat(plotY, "\" width=\"").concat(plotW, "\" height=\"").concat(plotH, "\" rx=\"6\" fill=\"#050505\" stroke=\"currentColor\" stroke-width=\"3\"/>") +
        plotGridSvg(plotX, plotY, plotW, plotH) +
        traces);
}
function logicAnalyzerPanelSvg(properties) {
    var _a;
    var history = symbolHistoryArray(properties);
    var latest = (_a = symbolReadoutNumber(properties)) !== null && _a !== void 0 ? _a : 0;
    var colors = ["#f6f65a", "#d9d7ff", "#ffd06a", "#00e89a", "#f6f65a", "#d9d7ff", "#ffd06a", "#00e89a"];
    var plotX = 104;
    var plotY = 8;
    var plotW = 146;
    var plotH = 174;
    var rows = colors.map(function (color, index) {
        var y = 12 + index * 20;
        return "<rect x=\"18\" y=\"".concat(y, "\" width=\"78\" height=\"16\" rx=\"2\" fill=\"").concat(color, "\" stroke=\"#777\"/>");
    }).join("");
    var traces = colors.map(function (color, channel) {
        var samples = history.length > 1 ? history : [latest, latest];
        var rowY = plotY + 14 + channel * 19;
        var points = samples.map(function (mask, index) {
            var x = plotX + 7 + ((plotW - 14) * index) / Math.max(1, samples.length - 1);
            var high = ((mask >>> channel) & 1) === 1;
            return "".concat(index === 0 ? "M" : "L", " ").concat(x.toFixed(1), " ").concat((rowY + (high ? 0 : 9)).toFixed(1));
        }).join(" ");
        return "<path d=\"".concat(points, "\" fill=\"none\" stroke=\"").concat(color, "\" stroke-width=\"2\"/>");
    }).join("");
    return ("<rect x=\"4\" y=\"2\" width=\"252\" height=\"208\" rx=\"6\" fill=\"#f7f7f7\" stroke=\"currentColor\" stroke-width=\"2\"/>" +
        rows +
        "<rect x=\"18\" y=\"184\" width=\"78\" height=\"20\" rx=\"3\" class=\"meter-expand-button\"/>" +
        "<text x=\"31\" y=\"198\" class=\"meter-panel-button\">Expande</text>" +
        "<rect x=\"".concat(plotX, "\" y=\"").concat(plotY, "\" width=\"").concat(plotW, "\" height=\"").concat(plotH, "\" rx=\"6\" fill=\"#050505\" stroke=\"currentColor\" stroke-width=\"3\"/>") +
        plotGridSvg(plotX, plotY, plotW, plotH) +
        traces);
}
/** Corpo do símbolo (SVG inline, em coordenadas locais da caixa do tipo) para um `typeId` conhecido.
 * Tipos sem símbolo dedicado caem num retângulo genérico com leads — nunca undefined/branco.
 * `properties` (opcional) é a instância real -- só os typeIds "de autoria de símbolo" (Épico G) leem
 * isso pra desenhar tamanho/cor reais em vez de um ícone decorativo fixo, ver `propertyDrivenBox`. */
function componentSymbolSvg(typeId, properties) {
    var _a, _b, _c;
    var box = componentBox(typeId, properties);
    var yMid = box.height / 2;
    var x1 = LEAD_MARGIN;
    var x2 = box.width - LEAD_MARGIN;
    var midX = box.width / 2;
    var labelBox = function (label) {
        return "<rect x=\"".concat(x1, "\" y=\"").concat(Math.max(8, yMid - 14), "\" width=\"").concat(Math.max(24, x2 - x1), "\" height=\"28\" class=\"symbol-stroke\" fill=\"none\"/>") +
            "<text x=\"".concat(midX, "\" y=\"").concat(yMid + 4, "\" text-anchor=\"middle\" class=\"symbol-text\">").concat(label, "</text>");
    };
    var diodeBody = function (extra) {
        if (extra === void 0) { extra = ""; }
        return horizontalLeads(box, yMid) +
            "<path d=\"M ".concat(midX - 9, " ").concat(yMid - 12, " L ").concat(midX - 9, " ").concat(yMid + 12, " L ").concat(midX + 8, " ").concat(yMid, " Z\" class=\"symbol-stroke\" fill=\"none\"/>") +
            "<line x1=\"".concat(midX + 10, "\" y1=\"").concat(yMid - 13, "\" x2=\"").concat(midX + 10, "\" y2=\"").concat(yMid + 13, "\" class=\"symbol-stroke symbol-stroke--thick\"/>") +
            extra;
    };
    switch (typeId) {
        case "passive.resistor":
        case "passive.variable_resistor":
        case "passive.ldr":
        case "passive.thermistor":
        case "passive.rtd":
        case "passive.force_strain_gauge": {
            var amplitude = box.height / 2 - 5;
            var mark = typeId === "passive.variable_resistor"
                ? "<line x1=\"".concat(midX - 12, "\" y1=\"").concat(yMid + 14, "\" x2=\"").concat(midX + 12, "\" y2=\"").concat(yMid - 14, "\" class=\"symbol-stroke symbol-stroke--accent\"/>")
                : typeId !== "passive.resistor"
                    ? "<text x=\"".concat(midX, "\" y=\"").concat(yMid - 11, "\" text-anchor=\"middle\" class=\"symbol-text\">").concat(((_a = typeId.split(".")[1]) !== null && _a !== void 0 ? _a : "").slice(0, 3).toUpperCase(), "</text>")
                    : "";
            return horizontalLeads(box, yMid) + "<path d=\"".concat(zigzagPath(x1, x2, yMid, amplitude, 3), "\" class=\"symbol-stroke\"/>") + mark;
        }
        case "passive.resistor_dip":
        case "switches.switch_dip":
            return labelBox(typeId === "passive.resistor_dip" ? "DIP-R" : "DIP-SW");
        case "passive.potentiometer":
            return (horizontalLeads(box, yMid) +
                "<path d=\"".concat(zigzagPath(x1, x2, yMid, 8, 3), "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX, "\" y1=\"").concat(box.height - PIN_INSET, "\" x2=\"").concat(midX, "\" y2=\"").concat(yMid + 7, "\" class=\"symbol-stroke\"/>") +
                "<path d=\"M ".concat(midX - 7, " ").concat(yMid + 9, " L ").concat(midX, " ").concat(yMid + 2, " L ").concat(midX + 7, " ").concat(yMid + 9, "\" class=\"symbol-stroke\" fill=\"none\"/>"));
        case "passive.capacitor": {
            var plateHalfLength = box.height / 2 - 6;
            return (horizontalLeads(box, yMid) +
                "<line x1=\"".concat(x1, "\" y1=\"").concat(yMid, "\" x2=\"").concat(midX - 5, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX + 5, "\" y1=\"").concat(yMid, "\" x2=\"").concat(x2, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX - 5, "\" y1=\"").concat(yMid - plateHalfLength, "\" x2=\"").concat(midX - 5, "\" y2=\"").concat(yMid + plateHalfLength, "\" class=\"symbol-stroke symbol-stroke--thick\"/>") +
                "<line x1=\"".concat(midX + 5, "\" y1=\"").concat(yMid - plateHalfLength, "\" x2=\"").concat(midX + 5, "\" y2=\"").concat(yMid + plateHalfLength, "\" class=\"symbol-stroke symbol-stroke--thick\"/>"));
        }
        case "passive.electrolytic_capacitor":
            return (componentSymbolSvg("passive.capacitor") +
                "<text x=\"".concat(midX - 15, "\" y=\"").concat(yMid - 12, "\" text-anchor=\"middle\" class=\"symbol-text\">+</text>"));
        case "passive.variable_capacitor":
            return componentSymbolSvg("passive.capacitor") +
                "<line x1=\"".concat(midX - 18, "\" y1=\"").concat(yMid + 16, "\" x2=\"").concat(midX + 18, "\" y2=\"").concat(yMid - 16, "\" class=\"symbol-stroke symbol-stroke--accent\"/>");
        case "passive.inductor": {
            var loopWidth = (x2 - x1) / 3;
            var ry = box.height / 2 - 5;
            var arcs = horizontalLeads(box, yMid);
            for (var i = 0; i < 3; i++) {
                var cx = x1 + loopWidth * (i + 0.5);
                var left = (cx - loopWidth / 2).toFixed(1);
                var right = (cx + loopWidth / 2).toFixed(1);
                arcs += "<path d=\"M ".concat(left, " ").concat(yMid, " A ").concat((loopWidth / 2).toFixed(1), " ").concat(ry.toFixed(1), " 0 1 1 ").concat(right, " ").concat(yMid, "\" class=\"symbol-stroke\"/>");
            }
            return arcs;
        }
        case "passive.variable_inductor":
            return componentSymbolSvg("passive.inductor") +
                "<line x1=\"".concat(midX - 18, "\" y1=\"").concat(yMid + 14, "\" x2=\"").concat(midX + 18, "\" y2=\"").concat(yMid - 14, "\" class=\"symbol-stroke symbol-stroke--accent\"/>");
        case "passive.transformer":
            return ("<line x1=\"".concat(PIN_INSET, "\" y1=\"").concat(box.height * 0.3, "\" x2=\"").concat(LEAD_MARGIN, "\" y2=\"").concat(box.height * 0.3, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(PIN_INSET, "\" y1=\"").concat(box.height * 0.7, "\" x2=\"").concat(LEAD_MARGIN, "\" y2=\"").concat(box.height * 0.7, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(box.width - LEAD_MARGIN, "\" y1=\"").concat(box.height * 0.3, "\" x2=\"").concat(box.width - PIN_INSET, "\" y2=\"").concat(box.height * 0.3, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(box.width - LEAD_MARGIN, "\" y1=\"").concat(box.height * 0.7, "\" x2=\"").concat(box.width - PIN_INSET, "\" y2=\"").concat(box.height * 0.7, "\" class=\"symbol-stroke\"/>") +
                "<path d=\"M 24 16 A 8 8 0 1 1 24 30 A 8 8 0 1 1 24 44\" class=\"symbol-stroke\" fill=\"none\"/>" +
                "<path d=\"M ".concat(box.width - 24, " 16 A 8 8 0 1 0 ").concat(box.width - 24, " 30 A 8 8 0 1 0 ").concat(box.width - 24, " 44\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<line x1=\"".concat(midX - 3, "\" y1=\"12\" x2=\"").concat(midX - 3, "\" y2=\"").concat(box.height - 12, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX + 3, "\" y1=\"12\" x2=\"").concat(midX + 3, "\" y2=\"").concat(box.height - 12, "\" class=\"symbol-stroke\"/>"));
        case "other.ground":
            // Pino no topo (PIN_INSET); lead desce até a linha mais larga, que fica logo abaixo do fio --
            // as linhas vão encolhendo conforme se afastam do pino, nunca o contrário.
            return ("<line x1=\"".concat(midX, "\" y1=\"").concat(PIN_INSET, "\" x2=\"").concat(midX, "\" y2=\"14\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX - 12, "\" y1=\"14\" x2=\"").concat(midX + 12, "\" y2=\"14\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX - 8, "\" y1=\"20\" x2=\"").concat(midX + 8, "\" y2=\"20\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX - 4, "\" y1=\"26\" x2=\"").concat(midX + 4, "\" y2=\"26\" class=\"symbol-stroke\"/>"));
        case "connectors.tunnel":
            {
                var tunnelName = typeof (properties === null || properties === void 0 ? void 0 : properties.name) === "string" ? properties.name.trim() : "";
                var tipX = box.width - 20;
                var bodyLeft = 6;
                var bodyRight = tipX - 22;
                return ("<path d=\"M ".concat(bodyLeft, " 8 H ").concat(bodyRight, " L ").concat(tipX, " ").concat(yMid, " L ").concat(bodyRight, " ").concat(box.height - 8, " H ").concat(bodyLeft, " Z\" ") +
                    "fill=\"#d7d7ec\" stroke=\"currentColor\" stroke-width=\"6\" stroke-linejoin=\"round\"/>" +
                    "<rect x=\"".concat(tipX, "\" y=\"").concat(yMid - 6, "\" width=\"18\" height=\"12\" rx=\"6\" fill=\"currentColor\"/>") +
                    (tunnelName
                        ? "<text x=\"".concat((bodyLeft + bodyRight) / 2, "\" y=\"").concat(yMid + 4, "\" text-anchor=\"middle\" class=\"tunnel-name\">").concat(escapeXmlText(tunnelName), "</text>")
                        : ""));
            }
        case "connectors.bus":
            return ("<line x1=\"12\" y1=\"".concat(yMid, "\" x2=\"").concat(box.width - 12, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke symbol-stroke--thick\"/>") +
                Array.from({ length: 6 }, function (_, index) {
                    var x = 18 + index * 8;
                    return "<line x1=\"".concat(x, "\" y1=\"").concat(yMid - 5, "\" x2=\"").concat(x, "\" y2=\"").concat(yMid + 5, "\" class=\"symbol-stroke\"/>");
                }).join(""));
        case "connectors.socket":
            return ("<rect x=\"18\" y=\"8\" width=\"".concat(box.width - 36, "\" height=\"").concat(box.height - 16, "\" rx=\"2\" class=\"symbol-stroke\" fill=\"none\"/>") +
                Array.from({ length: 6 }, function (_, index) { return "<circle cx=\"".concat(midX, "\" cy=\"").concat(18 + index * 10, "\" r=\"2\" class=\"symbol-stroke\" fill=\"none\"/>"); }).join(""));
        case "connectors.header":
            return ("<line x1=\"12\" y1=\"".concat(yMid, "\" x2=\"").concat(box.width - 12, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke symbol-stroke--thick\"/>") +
                Array.from({ length: 6 }, function (_, index) {
                    var x = 18 + index * 8;
                    return "<line x1=\"".concat(x, "\" y1=\"").concat(yMid - 8, "\" x2=\"").concat(x, "\" y2=\"").concat(yMid + 8, "\" class=\"symbol-stroke\"/>");
                }).join(""));
        case "graphics.image":
            return ("<rect x=\"4\" y=\"4\" width=\"".concat(box.width - 8, "\" height=\"").concat(box.height - 8, "\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<circle cx=\"24\" cy=\"20\" r=\"5\" class=\"symbol-stroke\" fill=\"none\"/>" +
                "<path d=\"M 8 ".concat(box.height - 10, " L 34 34 L 48 46 L 62 28 L ").concat(box.width - 8, " ").concat(box.height - 10, "\" class=\"symbol-stroke\" fill=\"none\"/>"));
        case "graphics.text": {
            // Sem `properties` (paleta/preview) cai no placeholder de sempre; com `properties`, desenha o
            // texto/cor/tamanho reais -- mesmo princípio property-driven do resto deste `case`, ver
            // `propertyDrivenBox`.
            var text = typeof (properties === null || properties === void 0 ? void 0 : properties.text) === "string" ? properties.text : "Texto";
            var fontSize = typeof (properties === null || properties === void 0 ? void 0 : properties.fontSize) === "number" ? properties.fontSize : 11;
            var color = typeof (properties === null || properties === void 0 ? void 0 : properties.color) === "string" ? properties.color : "currentColor";
            return "<text x=\"".concat(midX, "\" y=\"").concat(yMid + fontSize / 3, "\" text-anchor=\"middle\" font-size=\"").concat(fontSize, "\" fill=\"").concat(color, "\">").concat(escapeXmlText(text), "</text>");
        }
        case "graphics.rectangle": {
            var stroke = typeof (properties === null || properties === void 0 ? void 0 : properties.stroke) === "string" ? properties.stroke : "currentColor";
            var fill = typeof (properties === null || properties === void 0 ? void 0 : properties.fill) === "string" ? properties.fill : "none";
            var strokeWidth = typeof (properties === null || properties === void 0 ? void 0 : properties.strokeWidth) === "number" ? properties.strokeWidth : 1;
            return "<rect x=\"0.5\" y=\"0.5\" width=\"".concat(Math.max(0, box.width - 1), "\" height=\"").concat(Math.max(0, box.height - 1), "\" stroke=\"").concat(stroke, "\" fill=\"").concat(fill, "\" stroke-width=\"").concat(strokeWidth, "\"/>");
        }
        case "graphics.ellipse": {
            var stroke = typeof (properties === null || properties === void 0 ? void 0 : properties.stroke) === "string" ? properties.stroke : "currentColor";
            var fill = typeof (properties === null || properties === void 0 ? void 0 : properties.fill) === "string" ? properties.fill : "none";
            return "<ellipse cx=\"".concat(midX, "\" cy=\"").concat(yMid, "\" rx=\"").concat(box.width / 2 - 0.5, "\" ry=\"").concat(box.height / 2 - 0.5, "\" stroke=\"").concat(stroke, "\" fill=\"").concat(fill, "\"/>");
        }
        case "graphics.line": {
            // Desenho CANÔNICO (rotation=0): linha horizontal centrada no meio da caixa quadrada -- o
            // ponto médio é o único ponto invariante sob `rotate()` em torno do centro (ver
            // `propertyDrivenBox`), por isso é ele (não uma ponta) que vira a referência ao compilar de
            // volta pra `PackageShape.x1/y1/x2/y2` em `extension.ts::compileSymbolAuthoringComponents`.
            var length_3 = typeof (properties === null || properties === void 0 ? void 0 : properties.length) === "number" ? properties.length : 40;
            var stroke = typeof (properties === null || properties === void 0 ? void 0 : properties.stroke) === "string" ? properties.stroke : "currentColor";
            return "<line x1=\"".concat(midX - length_3 / 2, "\" y1=\"").concat(yMid, "\" x2=\"").concat(midX + length_3 / 2, "\" y2=\"").concat(yMid, "\" stroke=\"").concat(stroke, "\" stroke-width=\"2\"/>");
        }
        case "other.package": {
            var border = (properties === null || properties === void 0 ? void 0 : properties.border) !== false;
            var backgroundColor = typeof (properties === null || properties === void 0 ? void 0 : properties.backgroundColor) === "string" ? properties.backgroundColor : undefined;
            // `backgroundImageData` (achatado de `pkg.background.data` por `seedSymbolAuthoringComponents`
            // -- `properties` não aceita objeto aninhado) -- mesma foto real que `packageBodySvg` desenha
            // fora da sessão de autoria, só que aqui o componente é o meta "other.package" (corpo do
            // símbolo sendo EDITADO), não o `package` resolvido de um typeId qualquer.
            var backgroundImageData = typeof (properties === null || properties === void 0 ? void 0 : properties.backgroundImageData) === "string" ? properties.backgroundImageData : undefined;
            return ((backgroundImageData
                ? "<image x=\"0\" y=\"0\" width=\"".concat(box.width, "\" height=\"").concat(box.height, "\" preserveAspectRatio=\"none\" href=\"data:image/png;base64,").concat(backgroundImageData, "\"/>")
                : backgroundColor ? "<rect x=\"0\" y=\"0\" width=\"".concat(box.width, "\" height=\"").concat(box.height, "\" fill=\"").concat(backgroundColor, "\"/>") : "") +
                (border ? "<rect x=\"0.5\" y=\"0.5\" width=\"".concat(Math.max(0, box.width - 1), "\" height=\"").concat(Math.max(0, box.height - 1), "\" class=\"symbol-stroke\" fill=\"none\"/>") : "") +
                (backgroundImageData ? "" : "<text x=\"4\" y=\"11\" font-size=\"7\" fill=\"currentColor\" opacity=\"0.55\">PKG</text>"));
        }
        case "other.package_pin": {
            // Desenho CANÔNICO (rotation=0): âncora no CENTRO da caixa (ponto invariante sob `rotate()`),
            // lead saindo pra DIREITA -- mesma convenção de ângulo 0=direita do renderizador de leitura
            // (`packagePinLeadSvg`). `component.rotation` (0/90/180/270, CSS) faz o papel do `angle` real
            // de um `PackagePin` sem nenhum campo novo -- reaproveita rotação genérica (teclado/toolbar).
            // SEM texto aqui -- o rótulo é um `graphics.text` vinculado separado (`linkedPinComponentId`),
            // arrastável independente da posição do pino, igual ao SimulIDE real (ver
            // `symbolAuthoring.ts`/`main.ts::requestAddComponent`).
            var length_4 = typeof (properties === null || properties === void 0 ? void 0 : properties.length) === "number" ? properties.length : 8;
            var tipX = midX + length_4;
            return ("<line x1=\"".concat(midX, "\" y1=\"").concat(yMid, "\" x2=\"").concat(tipX, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<circle cx=\"".concat(midX, "\" cy=\"").concat(yMid, "\" r=\"2\" class=\"symbol-stroke\" fill=\"currentColor\"/>"));
        }
        case "other.test_unit":
            return ("<rect x=\"10\" y=\"8\" width=\"".concat(box.width - 20, "\" height=\"").concat(box.height - 16, "\" rx=\"2\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<path d=\"M 20 ".concat(yMid, " L 30 ").concat(yMid + 10, " L 50 ").concat(yMid - 10, "\" class=\"symbol-stroke symbol-stroke--accent\" fill=\"none\"/>") +
                "<line x1=\"16\" y1=\"16\" x2=\"22\" y2=\"16\" class=\"symbol-stroke\"/>" +
                "<line x1=\"".concat(box.width - 22, "\" y1=\"").concat(box.height - 16, "\" x2=\"").concat(box.width - 16, "\" y2=\"").concat(box.height - 16, "\" class=\"symbol-stroke\"/>"));
        case "other.dial":
            return ("<circle cx=\"".concat(midX, "\" cy=\"").concat(yMid, "\" r=\"22\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<circle cx=\"".concat(midX, "\" cy=\"").concat(yMid, "\" r=\"12\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<line x1=\"".concat(midX, "\" y1=\"").concat(yMid, "\" x2=\"").concat(midX + 8, "\" y2=\"").concat(yMid - 12, "\" class=\"symbol-stroke symbol-stroke--thick\"/>"));
        case "sources.dc_voltage":
            return (horizontalLeads(box, yMid) +
                "<line x1=\"".concat(x1, "\" y1=\"").concat(yMid, "\" x2=\"").concat(midX - 14, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX + 14, "\" y1=\"").concat(yMid, "\" x2=\"").concat(x2, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<circle cx=\"".concat(midX, "\" cy=\"").concat(yMid, "\" r=\"14\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<text x=\"".concat(midX - 7, "\" y=\"").concat(yMid + 5, "\" text-anchor=\"middle\" class=\"symbol-text\">+</text>") +
                "<text x=\"".concat(midX + 7, "\" y=\"").concat(yMid + 5, "\" text-anchor=\"middle\" class=\"symbol-text\">&#8722;</text>") +
                "<line x1=\"".concat(PIN_INSET, "\" y1=\"").concat(yMid - 7, "\" x2=\"").concat(PIN_INSET, "\" y2=\"").concat(yMid + 7, "\" class=\"symbol-stroke symbol-stroke--accent\"/>") +
                "<line x1=\"".concat(box.width - PIN_INSET - 6, "\" y1=\"").concat(yMid, "\" x2=\"").concat(box.width - PIN_INSET + 6, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke symbol-stroke--accent\"/>"));
        case "switches.push": {
            var contactY = 22;
            return ("<line x1=\"".concat(PIN_INSET, "\" y1=\"").concat(contactY, "\" x2=\"17\" y2=\"").concat(contactY, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"51\" y1=\"".concat(contactY, "\" x2=\"").concat(box.width - PIN_INSET, "\" y2=\"").concat(contactY, "\" class=\"symbol-stroke\"/>") +
                "<rect x=\"24\" y=\"4\" width=\"20\" height=\"6\" rx=\"3\" class=\"push-actuator-bar\" fill=\"currentColor\"/>" +
                "<rect x=\"14\" y=\"".concat(contactY - 3, "\" width=\"16\" height=\"6\" rx=\"3\" fill=\"currentColor\"/>") +
                "<rect x=\"38\" y=\"".concat(contactY - 3, "\" width=\"16\" height=\"6\" rx=\"3\" fill=\"currentColor\"/>") +
                "<rect x=\"22\" y=\"29\" width=\"24\" height=\"22\" rx=\"4\" class=\"push-body\" fill=\"#dddddd\" stroke=\"#777777\" stroke-width=\"2\"/>");
        }
        case "switches.switch": {
            var contactY = 22;
            return ("<line x1=\"".concat(PIN_INSET, "\" y1=\"").concat(contactY, "\" x2=\"17\" y2=\"").concat(contactY, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"51\" y1=\"".concat(contactY, "\" x2=\"").concat(box.width - PIN_INSET, "\" y2=\"").concat(contactY, "\" class=\"symbol-stroke\"/>") +
                "<rect x=\"14\" y=\"".concat(contactY - 3, "\" width=\"16\" height=\"6\" rx=\"3\" fill=\"currentColor\"/>") +
                "<rect x=\"38\" y=\"".concat(contactY - 3, "\" width=\"16\" height=\"6\" rx=\"3\" fill=\"currentColor\"/>") +
                "<line x1=\"27\" y1=\"".concat(contactY, "\" x2=\"53\" y2=\"").concat(contactY, "\" class=\"symbol-stroke symbol-stroke--thick switch-lever\"/>") +
                "<rect x=\"22\" y=\"29\" width=\"24\" height=\"22\" rx=\"4\" class=\"switch-body\" fill=\"#dddddd\" stroke=\"#777777\" stroke-width=\"2\"/>");
        }
        case "logic.button": {
            var rise = box.height / 2 - 5;
            return (horizontalLeads(box, yMid) +
                "<line x1=\"".concat(x1, "\" y1=\"").concat(yMid, "\" x2=\"").concat(midX - 8, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX + 8, "\" y1=\"").concat(yMid, "\" x2=\"").concat(x2, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<circle cx=\"".concat(midX - 8, "\" cy=\"").concat(yMid, "\" r=\"2\" class=\"symbol-stroke\" fill=\"currentColor\"/>") +
                "<circle cx=\"".concat(midX + 8, "\" cy=\"").concat(yMid, "\" r=\"2\" class=\"symbol-stroke\" fill=\"currentColor\"/>") +
                "<line x1=\"".concat(midX - 8, "\" y1=\"").concat(yMid, "\" x2=\"").concat(midX + 6, "\" y2=\"").concat((yMid - rise).toFixed(1), "\" class=\"symbol-stroke\"/>"));
        }
        case "switches.relay":
            return ("<rect x=\"12\" y=\"10\" width=\"24\" height=\"20\" class=\"symbol-stroke\" fill=\"none\"/>" +
                "<line x1=\"".concat(PIN_INSET, "\" y1=\"20\" x2=\"12\" y2=\"20\" class=\"symbol-stroke\"/>") +
                "<line x1=\"36\" y1=\"20\" x2=\"".concat(midX - 2, "\" y2=\"20\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX + 4, "\" y1=\"").concat(box.height - 18, "\" x2=\"").concat(box.width - PIN_INSET, "\" y2=\"").concat(box.height - 18, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX + 4, "\" y1=\"").concat(box.height - 18, "\" x2=\"").concat(box.width - 28, "\" y2=\"").concat(box.height - 34, "\" class=\"symbol-stroke\"/>") +
                "<circle cx=\"".concat(midX + 4, "\" cy=\"").concat(box.height - 18, "\" r=\"2\" class=\"symbol-stroke\" fill=\"currentColor\"/>") +
                "<circle cx=\"".concat(box.width - 28, "\" cy=\"").concat(box.height - 18, "\" r=\"2\" class=\"symbol-stroke\" fill=\"currentColor\"/>"));
        case "switches.keypad":
            return ("<rect x=\"14\" y=\"12\" width=\"".concat(box.width - 28, "\" height=\"").concat(box.height - 24, "\" class=\"symbol-stroke\" fill=\"none\"/>") +
                Array.from({ length: 4 }, function (_, row) {
                    return Array.from({ length: 4 }, function (_, col) {
                        return "<rect x=\"".concat(24 + col * 12, "\" y=\"").concat(22 + row * 12, "\" width=\"8\" height=\"8\" rx=\"1\" class=\"symbol-stroke\" fill=\"none\"/>");
                    }).join("");
                }).join(""));
        case "active.diode":
        case "active.zener":
        case "active.diac":
        case "active.scr":
        case "active.triac":
        case "outputs.led":
            return diodeBody(typeId === "active.zener"
                ? "<path d=\"M ".concat(midX + 10, " ").concat(yMid - 13, " l 5 -5 M ").concat(midX + 10, " ").concat(yMid + 13, " l -5 5\" class=\"symbol-stroke\"/>")
                : typeId === "outputs.led"
                    ? "<path d=\"M ".concat(midX + 16, " ").concat(yMid - 14, " l 8 -8 M ").concat(midX + 20, " ").concat(yMid - 6, " l 8 -8\" class=\"symbol-stroke symbol-stroke--accent\"/>")
                    : "");
        case "active.bjt":
        case "active.mosfet":
        case "active.jfet":
            return ("<circle cx=\"".concat(midX, "\" cy=\"").concat(yMid, "\" r=\"18\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<line x1=\"".concat(PIN_INSET, "\" y1=\"").concat(yMid, "\" x2=\"").concat(midX - 12, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX, "\" y1=\"").concat(yMid - 16, "\" x2=\"").concat(box.width - PIN_INSET, "\" y2=\"").concat(PIN_INSET, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX, "\" y1=\"").concat(yMid + 16, "\" x2=\"").concat(box.width - PIN_INSET, "\" y2=\"").concat(box.height - PIN_INSET, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX - 12, "\" y1=\"").concat(yMid - 16, "\" x2=\"").concat(midX - 12, "\" y2=\"").concat(yMid + 16, "\" class=\"symbol-stroke\"/>"));
        case "active.opamp":
        case "active.comparator":
            return ("<path d=\"M 24 12 L 24 ".concat(box.height - 12, " L ").concat(box.width - 16, " ").concat(yMid, " Z\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<line x1=\"".concat(PIN_INSET, "\" y1=\"").concat(box.height * 0.35, "\" x2=\"24\" y2=\"").concat(box.height * 0.35, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(PIN_INSET, "\" y1=\"").concat(box.height * 0.65, "\" x2=\"24\" y2=\"").concat(box.height * 0.65, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(box.width - 16, "\" y1=\"").concat(yMid, "\" x2=\"").concat(box.width - PIN_INSET, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<text x=\"18\" y=\"".concat(box.height * 0.36 + 4, "\" text-anchor=\"middle\" class=\"symbol-text\">+</text>") +
                "<text x=\"18\" y=\"".concat(box.height * 0.66 + 4, "\" text-anchor=\"middle\" class=\"symbol-text\">-</text>"));
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
            return ("<rect x=\"24\" y=\"18\" width=\"".concat(box.width - 48, "\" height=\"").concat(box.height - 36, "\" rx=\"8\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<rect x=\"".concat(midX - 26, "\" y=\"").concat(yMid - 34, "\" width=\"52\" height=\"68\" rx=\"6\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<text x=\"".concat(midX, "\" y=\"").concat(yMid - 6, "\" text-anchor=\"middle\" class=\"symbol-text\">ESP32</text>") +
                "<text x=\"".concat(midX, "\" y=\"").concat(yMid + 14, "\" text-anchor=\"middle\" class=\"symbol-text\">QEMU</text>"));
        case "outputs.incandescent_lamp":
            return (horizontalLeads(box, yMid) +
                "<circle cx=\"".concat(midX, "\" cy=\"").concat(yMid, "\" r=\"14\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<path d=\"M ".concat(midX - 8, " ").concat(yMid - 8, " L ").concat(midX + 8, " ").concat(yMid + 8, " M ").concat(midX + 8, " ").concat(yMid - 8, " L ").concat(midX - 8, " ").concat(yMid + 8, "\" class=\"symbol-stroke\"/>"));
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
            return labelBox(((_b = typeId.split(".")[1]) !== null && _b !== void 0 ? _b : typeId).replace(/_/g, " ").toUpperCase());
        case "logic.buffer":
            return labelBox("BUF");
        case "logic.and_gate":
            return labelBox("AND");
        case "logic.or_gate":
            return labelBox("OR");
        case "logic.xor_gate":
            return labelBox("XOR");
        case "logic.counter":
            return labelBox("CNT");
        case "logic.bin_counter":
            return labelBox("BIN CNT");
        case "logic.full_adder":
            return labelBox("ADD");
        case "logic.magnitude_comp":
            return labelBox("A:B");
        case "logic.shift_reg":
            return labelBox("SHIFT");
        case "logic.function":
            return labelBox("F(x)");
        case "logic.flipflop_d":
            return labelBox("D FF");
        case "logic.flipflop_t":
            return labelBox("T FF");
        case "logic.flipflop_rs":
            return labelBox("RS");
        case "logic.flipflop_jk":
            return labelBox("JK");
        case "logic.latch_d":
            return labelBox("LATCH");
        case "logic.memory":
            return labelBox("RAM");
        case "logic.dynamic_memory":
            return labelBox("DRAM");
        case "logic.i2c_ram":
            return labelBox("I2C RAM");
        case "logic.mux":
            return labelBox("MUX");
        case "logic.demux":
            return labelBox("DEMUX");
        case "logic.bcd_to_dec":
            return labelBox("BCD>DEC");
        case "logic.dec_to_bcd":
            return labelBox("DEC>BCD");
        case "logic.bcd_to_7seg":
            return labelBox("BCD>7S");
        case "logic.i2c_to_parallel":
            return labelBox("I2C>P");
        case "logic.adc":
            return labelBox("ADC");
        case "logic.dac":
            return labelBox("DAC");
        case "logic.seven_segment_bcd":
            return labelBox("7S BCD");
        case "logic.lm555":
            return labelBox("555");
        case "instruments.voltmeter":
            // `device.lsconfig` não tem mais `symbolSvg` próprio (o antigo círculo+"V" tinha leads
            // horizontais em y=24 que nunca bateram com a posição real do pino, calculada pra ESTE
            // desenho -- ver pinLocalPosition acima). O 3º pino ("outPin", saída analógica da leitura, ver
            // devices/voltmeter/src/lib.c) usa o terminal da direita desenhado por smallMeterDisplaySvg.
            return smallMeterDisplaySvg(box, "V", symbolReadoutNumber(properties));
        // ── Medidores (pasta "Meters" do SimulIDE) ──────────────────────────────────
        case "meters.probe": {
            // Sonda de 1 pino: linha até o corpo + círculo, igual a Probe::paint do SimulIDE (Component::
            // paint + drawEllipse) -- sem leads horizontais (só 1 pino, no topo). Círculo deslocado mais
            // pra baixo (yMid menor que o centro real) pra abrir vão visível entre o terminal do pino
            // (ponta do lead, ver pinLocalPosition) e o corpo -- box baixa demais (44px) deixava os dois
            // quase colados, parecendo um "boneco de neve" em vez de pino+sonda.
            var bodyY = 30;
            var showVolt = (properties === null || properties === void 0 ? void 0 : properties.showVolt) !== false;
            return ("<line x1=\"".concat(midX, "\" y1=\"").concat(PIN_INSET, "\" x2=\"").concat(midX, "\" y2=\"").concat(bodyY - 10, "\" class=\"symbol-stroke\"/>") +
                "<circle cx=\"".concat(midX, "\" cy=\"").concat(bodyY, "\" r=\"10\" class=\"symbol-stroke\" fill=\"none\"/>") +
                (showVolt ? "<text x=\"".concat(midX, "\" y=\"").concat(box.height - 6, "\" text-anchor=\"middle\" class=\"probe-voltage-label\">").concat(escapeXmlText(formatRailVoltage((_c = symbolReadoutNumber(properties)) !== null && _c !== void 0 ? _c : 0)), " V</text>") : ""));
        }
        case "meters.ampmeter":
            return smallMeterDisplaySvg(box, "A", symbolReadoutNumber(properties));
        case "meters.freqmeter":
            return ("<rect x=\"8\" y=\"4\" width=\"".concat(box.width - 14, "\" height=\"").concat(box.height - 8, "\" rx=\"2\" class=\"meter-lcd\"/>") +
                "<rect x=\"0\" y=\"".concat(yMid - 3, "\" width=\"10\" height=\"6\" rx=\"3\" fill=\"currentColor\"/>") +
                "<text x=\"16\" y=\"".concat(yMid + 5, "\" class=\"freq-lcd-value\">").concat(escapeXmlText(formatHz(symbolReadoutNumber(properties))), "</text>"));
        case "meters.oscope":
            // Caixa preta com uma forma de onda simplificada -- mesmo espírito do Oscope::paint (corpo
            // preenchido) sem a janela de plotagem real (ver docstring de Oscope.hpp no Core).
            return scopePanelSvg(properties);
        case "meters.logic_analyzer":
            return logicAnalyzerPanelSvg(properties);
        // ── Fontes (pasta "Sources" do SimulIDE) ────────────────────────────────────
        case "sources.fixed_volt": {
            return ("<rect x=\"18\" y=\"7\" width=\"34\" height=\"40\" rx=\"6\" class=\"fixed-volt-body\" fill=\"#dddddd\" stroke=\"#777777\" stroke-width=\"4\"/>" +
                "<rect x=\"52\" y=\"22\" width=\"18\" height=\"10\" rx=\"5\" class=\"fixed-volt-terminal\" fill=\"currentColor\"/>");
        }
        case "sources.clock":
            // Pulso quadrado -- mesma sequência exata de drawLine do Clock::paint original.
            return ("<path d=\"M ".concat(midX - 11, " ").concat(yMid + 3, " L ").concat(midX - 11, " ").concat(yMid - 3, " L ").concat(midX - 5, " ").concat(yMid - 3, " L ").concat(midX - 5, " ").concat(yMid + 3, " ") +
                "L ".concat(midX + 1, " ").concat(yMid + 3, " L ").concat(midX + 1, " ").concat(yMid - 3, " L ").concat(midX + 4, " ").concat(yMid - 3, "\" class=\"symbol-stroke\" fill=\"none\"/>"));
        case "sources.wave_gen":
            return ("<rect x=\"4\" y=\"4\" width=\"".concat(box.width - 8, "\" height=\"").concat(box.height - 8, "\" rx=\"2\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<path d=\"M 10 ".concat(yMid, " Q ").concat(midX - 8, " ").concat(yMid - 12, ", ").concat(midX, " ").concat(yMid, " T ").concat(box.width - 10, " ").concat(yMid, "\" class=\"symbol-stroke symbol-stroke--accent\" fill=\"none\"/>"));
        case "sources.voltage_source":
            return (horizontalLeads(box, yMid) +
                "<line x1=\"".concat(x1, "\" y1=\"").concat(yMid, "\" x2=\"").concat(midX - 14, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX + 14, "\" y1=\"").concat(yMid, "\" x2=\"").concat(x2, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<circle cx=\"".concat(midX, "\" cy=\"").concat(yMid, "\" r=\"14\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<text x=\"".concat(midX, "\" y=\"").concat(yMid + 5, "\" text-anchor=\"middle\" class=\"symbol-text\">V</text>") +
                "<line x1=\"".concat(midX - 7, "\" y1=\"").concat(yMid - 11, "\" x2=\"").concat(midX + 7, "\" y2=\"").concat(yMid - 11, "\" class=\"symbol-stroke symbol-stroke--accent\"/>"));
        case "sources.current_source":
            return (horizontalLeads(box, yMid) +
                "<line x1=\"".concat(x1, "\" y1=\"").concat(yMid, "\" x2=\"").concat(midX - 14, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX + 14, "\" y1=\"").concat(yMid, "\" x2=\"").concat(x2, "\" y2=\"").concat(yMid, "\" class=\"symbol-stroke\"/>") +
                "<circle cx=\"".concat(midX, "\" cy=\"").concat(yMid, "\" r=\"14\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<line x1=\"".concat(midX, "\" y1=\"").concat(yMid + 8, "\" x2=\"").concat(midX, "\" y2=\"").concat(yMid - 8, "\" class=\"symbol-stroke symbol-stroke--accent\"/>") +
                "<path d=\"M ".concat(midX - 4, " ").concat(yMid - 4, " L ").concat(midX, " ").concat(yMid - 8, " L ").concat(midX + 4, " ").concat(yMid - 4, "\" class=\"symbol-stroke symbol-stroke--accent\" fill=\"none\"/>"));
        case "sources.controlled_source": {
            // Diamante (Csource::paint do original, modo "control pins": polígono de 4 pontos) com seta
            // de corrente -- mesma lógica de m_currSource do original.
            var cx = box.width / 2;
            var cy = box.height / 2;
            return ("<path d=\"M ".concat(cx - 16, " ").concat(cy, " L ").concat(cx, " ").concat(cy - 26, " L ").concat(cx + 16, " ").concat(cy, " L ").concat(cx, " ").concat(cy + 26, " Z\" class=\"symbol-stroke\" fill=\"none\"/>") +
                "<line x1=\"".concat(cx, "\" y1=\"").concat(cy - 10, "\" x2=\"").concat(cx, "\" y2=\"").concat(cy + 10, "\" class=\"symbol-stroke symbol-stroke--accent\"/>") +
                "<path d=\"M ".concat(cx - 4, " ").concat(cy + 4, " L ").concat(cx, " ").concat(cy + 10, " L ").concat(cx + 4, " ").concat(cy + 4, "\" class=\"symbol-stroke symbol-stroke--accent\" fill=\"none\"/>"));
        }
        case "sources.battery":
            // Barras alternadas longa/curta -- mesma sequência exata de drawLine do Battery::paint original.
            return ("<line x1=\"".concat(midX - 7, "\" y1=\"").concat(yMid - 8, "\" x2=\"").concat(midX - 7, "\" y2=\"").concat(yMid + 8, "\" class=\"symbol-stroke symbol-stroke--thick\"/>") +
                "<line x1=\"".concat(midX - 2, "\" y1=\"").concat(yMid - 3, "\" x2=\"").concat(midX - 2, "\" y2=\"").concat(yMid + 3, "\" class=\"symbol-stroke\"/>") +
                "<line x1=\"".concat(midX + 3, "\" y1=\"").concat(yMid - 8, "\" x2=\"").concat(midX + 3, "\" y2=\"").concat(yMid + 8, "\" class=\"symbol-stroke symbol-stroke--thick\"/>") +
                "<line x1=\"".concat(midX + 8, "\" y1=\"").concat(yMid - 3, "\" x2=\"").concat(midX + 8, "\" y2=\"").concat(yMid + 3, "\" class=\"symbol-stroke\"/>"));
        case "sources.rail": {
            var voltage = typeof (properties === null || properties === void 0 ? void 0 : properties.voltage) === "number" ? properties.voltage : 5.0;
            var label = "".concat(formatRailVoltage(voltage), " V");
            return ("<path d=\"M ".concat(midX - 20, " 20 L ").concat(midX + 20, " 20 L ").concat(midX + 8, " 48 L ").concat(midX - 8, " 48 Z\" fill=\"#ffa500\" stroke=\"currentColor\" stroke-width=\"4\" stroke-linejoin=\"round\"/>") +
                "<rect x=\"".concat(midX - 5, "\" y=\"46\" width=\"10\" height=\"18\" rx=\"5\" fill=\"currentColor\"/>") +
                "<text x=\"".concat(midX, "\" y=\"17\" text-anchor=\"middle\" class=\"rail-voltage-label\">").concat(escapeXmlText(label), "</text>"));
        }
        default:
            return horizontalLeads(box, yMid) + "<rect x=\"".concat(x1, "\" y=\"").concat(yMid - 10, "\" width=\"").concat(x2 - x1, "\" height=\"20\" class=\"symbol-stroke\" fill=\"none\"/>");
    }
}
