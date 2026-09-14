/**
 * E2E test — try each profile, find one that actually responds
 */
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
import { ProfileManager } from '../../main/profiles/manager.ts';
import { createEngine } from '../core.ts';
import { sendMessageStream } from '../api/client.ts';
var pm = new ProfileManager();
var profiles = pm.list();
var passed = 0;
var failed = 0;
var foundWorking = false;
function assert(condition, msg) {
    if (condition) {
        passed++;
        console.log("  OK: ".concat(msg));
    }
    else {
        failed++;
        console.error("  FAIL: ".concat(msg));
    }
}
function testProfile(p) {
    return __awaiter(this, void 0, void 0, function () {
        var messages, gotText, errorMsg, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\n--- [".concat(p.name, "] ").concat(p.baseUrl, " ---"));
                    if (!p.apiKey || p.apiKey.length < 8) {
                        console.log('  Skipped: no API key');
                        return [2 /*return*/];
                    }
                    createEngine({
                        apiKey: p.apiKey,
                        provider: p.provider === 'custom' ? 'openai' : p.provider,
                        model: p.model,
                        baseUrl: p.baseUrl,
                        maxTokens: 4096,
                    });
                    messages = [{ role: 'user', content: 'hi', timestamp: Date.now() }];
                    gotText = false;
                    errorMsg = '';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, sendMessageStream({
                            provider: p.provider === 'custom' ? 'openai' : p.provider,
                            apiKey: p.apiKey,
                            model: p.model,
                            baseUrl: p.baseUrl,
                            maxTokens: 4096,
                        }, messages, {
                            onText: function (text) { gotText = true; console.log("  Response: ".concat(text.slice(0, 100))); },
                            onToolUse: function () { },
                            onDone: function () { },
                            onError: function (err) { errorMsg = err; },
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    errorMsg = e_1.message;
                    return [3 /*break*/, 4];
                case 4:
                    if (gotText) {
                        assert(true, "".concat(p.name, " returned text"));
                        foundWorking = true;
                    }
                    else if (errorMsg) {
                        assert(false, "".concat(p.name, ": ").concat(errorMsg));
                    }
                    else {
                        assert(false, "".concat(p.name, ": empty response"));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _i, profiles_1, p;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('E2E Profile Test — finding working profile\n');
                    _i = 0, profiles_1 = profiles;
                    _a.label = 1;
                case 1:
                    if (!(_i < profiles_1.length)) return [3 /*break*/, 4];
                    p = profiles_1[_i];
                    return [4 /*yield*/, testProfile(p)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("\n".concat('='.repeat(40)));
                    console.log("Passed: ".concat(passed, "  Failed: ").concat(failed, "  Total: ").concat(passed + failed));
                    if (foundWorking) {
                        console.log('Found a working profile!');
                        process.exit(0);
                    }
                    else {
                        console.log('No profile returned a response.');
                        process.exit(1);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (e) { console.error('Fatal:', e); process.exit(1); });
