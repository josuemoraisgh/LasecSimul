"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var MockCoreServer_1 = require("../../ipc/testSupport/MockCoreServer");
var componentSymbols_1 = require("./componentSymbols");
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, test, finish, pkg;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = (0, MockCoreServer_1.createTestRunner)("componentSymbols — package real (Épico G)"), test = _a.test, finish = _a.finish;
                pkg = {
                    width: 60,
                    height: 40,
                    border: true,
                    pins: [
                        { id: "out", x: 60, y: 20, angle: 0, length: 8, label: "OUT" },
                        { id: "vcc", x: 0, y: 10, angle: 180, length: 8, label: "VCC" },
                        { id: "gnd", x: 0, y: 30, angle: 180, length: 8, label: "GND" },
                    ],
                };
                return [4 /*yield*/, test("sem package registrado, componentBox cai pro algoritmo genérico (fallback)", function () {
                        (0, componentSymbols_1.registerPackage)("test.example", undefined);
                        var box = (0, componentSymbols_1.componentBox)("test.example");
                        (0, MockCoreServer_1.assert)(box.width === 70 && box.height === 40, "esperado box gen\u00E9rico, recebido {".concat(box.width, ",").concat(box.height, "}"));
                    })];
            case 1:
                _b.sent();
                return [4 /*yield*/, test("com package registrado, componentBox usa o layout resolvido (com folga pra leads)", function () {
                        (0, componentSymbols_1.registerPackage)("test.example", pkg);
                        var box = (0, componentSymbols_1.componentBox)("test.example");
                        // leads de 8px nos dois lados (vcc/gnd à esquerda, out à direita) -- largura cresce 8 pra cada lado
                        (0, MockCoreServer_1.assert)(box.width === 76, "esperado largura 76 (60 + 8 esquerda + 8 direita), recebido ".concat(box.width));
                        (0, MockCoreServer_1.assert)(box.height === 40, "altura n\u00E3o deveria mudar (nenhum lead vertical), recebido ".concat(box.height));
                    })];
            case 2:
                _b.sent();
                return [4 /*yield*/, test("package com schematicWidth/schematicHeight desacopla o tamanho visual do espaco interno", function () {
                        (0, componentSymbols_1.registerPackage)("test.scaled", __assign(__assign({}, pkg), { schematicWidth: 38, schematicHeight: 20 }));
                        var box = (0, componentSymbols_1.componentBox)("test.scaled");
                        (0, MockCoreServer_1.assert)(box.width === 38, "esperado largura visual 38, recebido ".concat(box.width));
                        (0, MockCoreServer_1.assert)(box.height === 20, "esperado altura visual 20, recebido ".concat(box.height));
                        var pin = (0, componentSymbols_1.pinLocalPosition)("out", 0, 3, "test.scaled");
                        (0, MockCoreServer_1.assert)(Math.abs(pin.x - 38) < 0.001, "pino deveria escalar junto com a largura visual (38), recebido ".concat(pin.x));
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, test("pinLocalPosition casa por id, na ponta real do lead (corpo + length na direção do angle)", function () {
                        (0, componentSymbols_1.registerPackage)("test.example", pkg);
                        var outPos = (0, componentSymbols_1.pinLocalPosition)("out", 0, 3, "test.example");
                        // offsetX = 8 (pra cobrir o lead de vcc/gnd que vai a x=-8) -- ponta de "out" = 60+8(lead)+8(offset) = 76
                        (0, MockCoreServer_1.assert)(outPos.x === 76, "ponta de \"out\" esperada em x=76, recebido ".concat(outPos.x));
                        (0, MockCoreServer_1.assert)(outPos.y === 20, "y de \"out\" n\u00E3o deveria mudar, recebido ".concat(outPos.y));
                        var vccPos = (0, componentSymbols_1.pinLocalPosition)("vcc", 1, 3, "test.example");
                        // ponta de vcc = 0 - 8(lead) + 8(offset) = 0
                        (0, MockCoreServer_1.assert)(vccPos.x === 0, "ponta de \"vcc\" esperada em x=0, recebido ".concat(vccPos.x));
                    })];
            case 4:
                _b.sent();
                return [4 /*yield*/, test("pinLocalPosition cai pro algoritmo genérico quando o id não está no package", function () {
                        (0, componentSymbols_1.registerPackage)("test.example", pkg);
                        var fallback = (0, componentSymbols_1.pinLocalPosition)("nao-existe", 0, 2, "test.example");
                        // algoritmo genérico: índice par -> PIN_INSET (6) da borda esquerda do box resolvido (76)
                        (0, MockCoreServer_1.assert)(fallback.x === 6, "esperado fallback gen\u00E9rico x=6, recebido ".concat(fallback.x));
                    })];
            case 5:
                _b.sent();
                return [4 /*yield*/, test("packageSymbolSvg devolve undefined sem package, markup com package", function () {
                        (0, componentSymbols_1.registerPackage)("test.example", undefined);
                        (0, MockCoreServer_1.assert)((0, componentSymbols_1.packageSymbolSvg)("test.example") === undefined, "sem package registrado deveria devolver undefined");
                        (0, componentSymbols_1.registerPackage)("test.example", pkg);
                        var svg = (0, componentSymbols_1.packageSymbolSvg)("test.example");
                        (0, MockCoreServer_1.assert)(typeof svg === "string" && svg.includes("OUT") && svg.includes("VCC") && svg.includes("GND"), "markup deveria conter o rótulo de cada pino declarado");
                    })];
            case 6:
                _b.sent();
                return [4 /*yield*/, test("packagePinLeadSvg gira o rótulo -90° só em lead vertical (angle 90/270) -- evita rótulos colados quando há muitos pinos apertados num lado (ex: topo do ESP32 nu)", function () {
                        var verticalPkg = {
                            width: 40,
                            height: 40,
                            pins: [
                                { id: "top1", x: 10, y: 0, angle: 270, length: 8, label: "TOP1" },
                                { id: "side1", x: 0, y: 10, angle: 180, length: 8, label: "SIDE1" },
                            ],
                        };
                        (0, componentSymbols_1.registerPackage)("test.vertical", verticalPkg);
                        var svg = (0, componentSymbols_1.packageSymbolSvg)("test.vertical");
                        (0, MockCoreServer_1.assert)(svg.includes('rotate(-90') && /rotate\(-90[^)]*\)">TOP1/.test(svg), "pino vertical (angle 270) deveria ter <text> com transform rotate(-90...)");
                        (0, MockCoreServer_1.assert)(!/rotate\(-90[^)]*\)">SIDE1/.test(svg), "pino horizontal (angle 180) não deveria girar o rótulo");
                    })];
            case 7:
                _b.sent();
                return [4 /*yield*/, test("packagePinLeadSvg usa labelX/labelY do pino quando presentes, sem girar (posição já escolhida pelo usuário)", function () {
                        var customLabelPkg = {
                            width: 40,
                            height: 40,
                            pins: [{ id: "top1", x: 10, y: 0, angle: 270, length: 8, label: "TOP1", labelX: 20, labelY: 20 }],
                        };
                        (0, componentSymbols_1.registerPackage)("test.customlabel", customLabelPkg);
                        var svg = (0, componentSymbols_1.packageSymbolSvg)("test.customlabel");
                        (0, MockCoreServer_1.assert)(svg.includes('x="20.0" y="20.0"'), "texto deveria ficar na posi\u00E7\u00E3o customizada (20,20), markup: ".concat(svg));
                        (0, MockCoreServer_1.assert)(!svg.includes("rotate(-90"), "com labelX/labelY explícitos, não deveria girar automaticamente (usuário já escolheu a posição)");
                        (0, componentSymbols_1.registerPackage)("test.customlabel", undefined);
                    })];
            case 8:
                _b.sent();
                return [4 /*yield*/, test("hasRealPinPosition: sem package, qualquer pinId tem posição (algoritmo genérico já é a posição real)", function () {
                        (0, componentSymbols_1.registerPackage)("test.example", undefined);
                        (0, MockCoreServer_1.assert)((0, componentSymbols_1.hasRealPinPosition)("test.example", "qualquer-id") === true, "sem package deveria sempre devolver true");
                    })];
            case 9:
                _b.sent();
                return [4 /*yield*/, test("hasRealPinPosition: com package, só pinId presente no package tem posição -- ex: GPIO elétrico sem lead físico no encapsulamento", function () {
                        (0, componentSymbols_1.registerPackage)("test.example", pkg);
                        (0, MockCoreServer_1.assert)((0, componentSymbols_1.hasRealPinPosition)("test.example", "out") === true, "pino real do package deveria ter posição");
                        (0, MockCoreServer_1.assert)((0, componentSymbols_1.hasRealPinPosition)("test.example", "pin-eletrico-sem-lead") === false, "pino elétrico sem lead físico no package não deveria ter posição (não desenha terminal genérico por cima)");
                    })];
            case 10:
                _b.sent();
                return [4 /*yield*/, test("registerPackage com 3º argumento: properties.logicSymbol escolhe a variante alternativa (igual ao SubPackage::Logic_Symbol do SimulIDE real)", function () {
                        var _a, _b;
                        var logicSymbolPkg = {
                            width: 30,
                            height: 20,
                            pins: [{ id: "out", x: 30, y: 10, angle: 0, length: 8, label: "LOGIC-OUT" }],
                        };
                        (0, componentSymbols_1.registerPackage)("test.dual", pkg, logicSymbolPkg);
                        var defaultBox = (0, componentSymbols_1.componentBox)("test.dual");
                        (0, MockCoreServer_1.assert)(defaultBox.width === 76, "sem logicSymbol=true, deveria usar o package padr\u00E3o (largura 76), recebido ".concat(defaultBox.width));
                        var logicSymbolBox = (0, componentSymbols_1.componentBox)("test.dual", { logicSymbol: true });
                        (0, MockCoreServer_1.assert)(logicSymbolBox.width !== defaultBox.width, "com logicSymbol=true, deveria usar a variante alternativa (geometria diferente)");
                        var svgDefault = (_a = (0, componentSymbols_1.packageSymbolSvg)("test.dual")) !== null && _a !== void 0 ? _a : "";
                        (0, MockCoreServer_1.assert)(svgDefault.includes("OUT") && !svgDefault.includes("LOGIC-OUT"), "sem logicSymbol, markup deveria ser o package padrão");
                        var svgLogicSymbol = (_b = (0, componentSymbols_1.packageSymbolSvg)("test.dual", { logicSymbol: true })) !== null && _b !== void 0 ? _b : "";
                        (0, MockCoreServer_1.assert)(svgLogicSymbol.includes("LOGIC-OUT"), "com logicSymbol=true, markup deveria ser a variante alternativa");
                        (0, componentSymbols_1.registerPackage)("test.dual", undefined);
                    })];
            case 11:
                _b.sent();
                return [4 /*yield*/, test("registerPackage sem 3º argumento (típico de typeId sem variante Logic Symbol): logicSymbol=true não tem efeito, cai no package padrão", function () {
                        (0, componentSymbols_1.registerPackage)("test.example", pkg);
                        var box = (0, componentSymbols_1.componentBox)("test.example", { logicSymbol: true });
                        (0, MockCoreServer_1.assert)(box.width === 76, "sem variante registrada, logicSymbol=true deveria ser ignorado e cair no package padrão");
                    })];
            case 12:
                _b.sent();
                return [4 /*yield*/, test("connectors.tunnel cresce para caber o nome e mantem o pino na ponta da seta", function () {
                        var shortBox = (0, componentSymbols_1.componentBox)("connectors.tunnel", { name: "GND" });
                        var longBox = (0, componentSymbols_1.componentBox)("connectors.tunnel", { name: "GPIO_UART_DEBUG_LONG_NAME" });
                        (0, MockCoreServer_1.assert)(longBox.width > shortBox.width, "nome longo deveria aumentar a largura (".concat(shortBox.width, " -> ").concat(longBox.width, ")"));
                        var pin = (0, componentSymbols_1.pinLocalPosition)("pin", 0, 1, "connectors.tunnel", { name: "GPIO_UART_DEBUG_LONG_NAME" });
                        (0, MockCoreServer_1.assert)(pin.x === longBox.width - 20, "pino deveria ficar na ponta da seta (x=width-20), recebido ".concat(pin.x, " para width=").concat(longBox.width));
                        var svg = (0, componentSymbols_1.componentSymbolSvg)("connectors.tunnel", { name: "GPIO23" });
                        (0, MockCoreServer_1.assert)(svg.includes("GPIO23"), "nome do tunel deveria ser desenhado dentro do simbolo");
                    })];
            case 13:
                _b.sent();
                (0, componentSymbols_1.registerPackage)("test.example", undefined);
                (0, componentSymbols_1.registerPackage)("test.scaled", undefined);
                (0, componentSymbols_1.registerPackage)("test.vertical", undefined);
                (0, componentSymbols_1.registerPackage)("test.customlabel", undefined);
                (0, componentSymbols_1.registerPackage)("test.dual", undefined);
                finish();
                return [2 /*return*/];
        }
    });
}); })();
