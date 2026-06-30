"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcError = exports.PROTOCOL_VERSION = void 0;
exports.errorCodeFromPayload = errorCodeFromPayload;
exports.PROTOCOL_VERSION = 1;
/** Erro de uma requisição IPC rejeitada pelo Core. `code` é o `errorCode` estável que alguns
 * handlers (ex: `setProperty`) embutem em `payload` quando `ok === false` — ver
 * `core/src/app/CoreApplication.cpp::parsePropertyError` ("unknown_property"|"read_only"|
 * "type_mismatch"|"out_of_range"|"invalid_option"). `code` fica `undefined` para handlers que ainda
 * só devolvem `error` (texto livre), o que mantém quem só lê `.message` funcionando sem mudança. */
var IpcError = /** @class */ (function (_super) {
    __extends(IpcError, _super);
    function IpcError(message, code) {
        var _this = _super.call(this, message) || this;
        _this.name = "IpcError";
        _this.code = code;
        return _this;
    }
    return IpcError;
}(Error));
exports.IpcError = IpcError;
function errorCodeFromPayload(payload) {
    if (typeof payload !== "object" || payload === null)
        return undefined;
    var errorCode = payload.errorCode;
    return typeof errorCode === "string" ? errorCode : undefined;
}
