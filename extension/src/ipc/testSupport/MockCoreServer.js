"use strict";
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
exports.MockCoreServer = void 0;
exports.serverPath = serverPath;
exports.cleanupServerPath = cleanupServerPath;
exports.createTestRunner = createTestRunner;
exports.assert = assert;
var net = require("net");
var os = require("os");
var path = require("path");
var fs = require("fs");
var protocol_1 = require("../protocol");
function serverPath(name) {
    return process.platform === "win32"
        ? "\\\\.\\pipe\\".concat(name)
        : path.join(os.tmpdir(), "".concat(name, ".sock"));
}
function cleanupServerPath(name) {
    if (process.platform !== "win32") {
        try {
            fs.unlinkSync(serverPath(name));
        }
        catch ( /* ignore */_a) { /* ignore */ }
    }
}
/** Servidor mock mínimo de IPC do Core, reutilizável por qualquer teste da Extension que precise
 * de um Core falso (handshake + dispatch configurável). */
var MockCoreServer = /** @class */ (function () {
    function MockCoreServer(name, protocolVersion, handler) {
        if (protocolVersion === void 0) { protocolVersion = protocol_1.PROTOCOL_VERSION; }
        var _this = this;
        this.name = name;
        this.protocolVersion = protocolVersion;
        this.handler = handler;
        this.lineBuffer = "";
        this.server = net.createServer(function (s) {
            _this.socket = s;
            s.on("data", function (d) { return _this._onData(d); });
        });
    }
    MockCoreServer.prototype.start = function () {
        var _this = this;
        cleanupServerPath(this.name);
        return new Promise(function (resolve) { return _this.server.listen(serverPath(_this.name), resolve); });
    };
    MockCoreServer.prototype.stop = function () {
        var _this = this;
        var _a;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
        return new Promise(function (resolve) { return _this.server.close(function () { cleanupServerPath(_this.name); resolve(); }); });
    };
    MockCoreServer.prototype._onData = function (data) {
        var _a;
        this.lineBuffer += data.toString("utf8");
        var lines = this.lineBuffer.split("\n");
        this.lineBuffer = (_a = lines.pop()) !== null && _a !== void 0 ? _a : "";
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var t = line.trim();
            if (t)
                this._handle(t);
        }
    };
    MockCoreServer.prototype._handle = function (raw) {
        var _a, _b;
        var msg = JSON.parse(raw);
        var resp = this._dispatch(msg);
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.write(JSON.stringify(resp) + "\n");
        if (msg.type === "shutdown")
            (_b = this.socket) === null || _b === void 0 ? void 0 : _b.destroy();
    };
    MockCoreServer.prototype._dispatch = function (msg) {
        if (msg.type === "hello") {
            return {
                id: msg.id,
                ok: true,
                payload: { serverVersion: "0.1.0", protocolVersion: this.protocolVersion },
            };
        }
        if (this.handler)
            return this.handler(msg);
        return { id: msg.id, ok: true, payload: {} };
    };
    return MockCoreServer;
}());
exports.MockCoreServer = MockCoreServer;
function createTestRunner(suiteName) {
    var _this = this;
    var passed = 0;
    var failed = 0;
    console.log("\n".concat(suiteName, "\n"));
    return {
        test: function (name, fn) { return __awaiter(_this, void 0, void 0, function () {
            var e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fn()];
                    case 1:
                        _a.sent();
                        console.log("  \u2713 ".concat(name));
                        passed++;
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _a.sent();
                        console.error("  \u2717 ".concat(name, ": ").concat(e_1.message));
                        failed++;
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); },
        finish: function () {
            console.log("\nResultado: ".concat(passed, " passaram, ").concat(failed, " falharam\n"));
            return { passed: passed, failed: failed };
        },
    };
}
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
