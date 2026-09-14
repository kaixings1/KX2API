/**
 * src/engine/__tests__/integration.test.ts — 端到端集成测试
 *
 * 模拟完整的 API 请求流程，验证：
 * 1. ProfileManager 读取配置
 * 2. engine-bridge 初始化引擎
 * 3. API client 构建正确的 URL
 * 4. 实际 HTTP 请求（如果能通）
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
import { createEngine, getEngine } from '../core.ts';
import { sendMessageStream } from '../api/client.ts';
var passed = 0;
var failed = 0;
function assert(condition, msg) {
    if (condition) {
        passed++;
        console.log("  \u2713 ".concat(msg));
    }
    else {
        failed++;
        console.error("  \u2717 ".concat(msg));
    }
}
function testProfileToEngine() {
    return __awaiter(this, void 0, void 0, function () {
        var pm, active, engineConfig, engine, config;
        var _a;
        return __generator(this, function (_b) {
            console.log('\n--- Profile → Engine Config ---');
            pm = new ProfileManager();
            active = pm.getActive();
            assert(active !== null, 'Active profile exists');
            if (!active)
                return [2 /*return*/];
            console.log("  Active: ".concat(active.name));
            console.log("  baseUrl: ".concat(active.baseUrl));
            console.log("  model: ".concat(active.model));
            console.log("  apiKey: ".concat(active.apiKey.slice(0, 8), "..."));
            engineConfig = {
                apiKey: active.apiKey,
                provider: (active.provider === 'custom' ? 'openai' : active.provider),
                model: active.model,
                baseUrl: active.baseUrl || undefined,
                maxTokens: 4096,
            };
            createEngine(engineConfig);
            engine = getEngine();
            config = engine.getConfig();
            console.log("  Engine config:", {
                provider: config.provider,
                model: config.model,
                baseUrl: config.baseUrl,
                apiKey: ((_a = config.apiKey) === null || _a === void 0 ? void 0 : _a.slice(0, 8)) + '...',
            });
            assert(config.provider === engineConfig.provider, 'Engine provider matches profile');
            assert(config.model === engineConfig.model, 'Engine model matches profile');
            assert(config.baseUrl === engineConfig.baseUrl, 'Engine baseUrl matches profile');
            assert(config.apiKey === engineConfig.apiKey, 'Engine apiKey matches profile');
            return [2 /*return*/];
        });
    });
}
function testApiRequest() {
    return __awaiter(this, void 0, void 0, function () {
        var pm, active, messages, gotResponse, gotError, errorMsg, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\n--- API Request Test ---');
                    pm = new ProfileManager();
                    active = pm.getActive();
                    if (!active) {
                        console.log('  Skipped: no active profile');
                        return [2 /*return*/];
                    }
                    messages = [
                        { role: 'user', content: 'Say hi in 3 words', timestamp: Date.now() }
                    ];
                    gotResponse = false;
                    gotError = false;
                    errorMsg = [];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, sendMessageStream({
                            provider: active.provider === 'custom' ? 'openai' : active.provider,
                            apiKey: active.apiKey,
                            model: active.model,
                            baseUrl: active.baseUrl,
                            maxTokens: 100,
                        }, messages, {
                            onText: function (text) {
                                gotResponse = true;
                                console.log("  [Stream] ".concat(text.slice(0, 100)));
                            },
                            onToolUse: function () { },
                            onDone: function (fullText) {
                                console.log("  [Done] Full length: ".concat(fullText.length));
                            },
                            onError: function (err) {
                                gotError = true;
                                errorMsg.push(err);
                                console.log("  [Error] ".concat(err));
                            },
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    gotError = true;
                    errorMsg.push(e_1.message);
                    console.log("  [Fatal] ".concat(e_1.message));
                    return [3 /*break*/, 4];
                case 4:
                    if (gotResponse) {
                        assert(true, 'Got streaming response');
                        assert(!gotError, 'No error');
                    }
                    else if (gotError) {
                        console.log("  Error detail: ".concat(errorMsg.join(', ')));
                        assert(false, "Request failed: ".concat(errorMsg[0]));
                    }
                    else {
                        assert(false, 'No response and no error (timeout?)');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function testAllProfileUrls() {
    return __awaiter(this, void 0, void 0, function () {
        var pm, profiles, _i, profiles_1, p, raw, hasEndpoint, endpoint;
        return __generator(this, function (_a) {
            console.log('\n--- All Profile URL Check ---');
            pm = new ProfileManager();
            profiles = pm.list();
            for (_i = 0, profiles_1 = profiles; _i < profiles_1.length; _i++) {
                p = profiles_1[_i];
                raw = (p.baseUrl || '').replace(/\/$/, '');
                hasEndpoint = raw.includes('/chat/completions');
                endpoint = hasEndpoint ? raw : raw + '/v1/chat/completions';
                console.log("  [".concat(p.name, "] ").concat(endpoint));
            }
            assert(profiles.length > 0, "Found ".concat(profiles.length, " profiles"));
            return [2 /*return*/];
        });
    });
}
// ---- main ----
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('KX2Code Integration Test Suite');
                    console.log('='.repeat(40));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, testAllProfileUrls()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, testProfileToEngine()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, testApiRequest()];
                case 4:
                    _a.sent();
                    console.log('\n' + '='.repeat(40));
                    console.log("Passed: ".concat(passed));
                    console.log("Failed: ".concat(failed));
                    console.log("Total:  ".concat(passed + failed));
                    if (failed > 0) {
                        console.log('\nSome tests failed!');
                        process.exit(1);
                    }
                    else {
                        console.log('\nAll tests passed!');
                        process.exit(0);
                    }
                    return [3 /*break*/, 6];
                case 5:
                    e_2 = _a.sent();
                    console.error('\n[Fatal]', e_2);
                    process.exit(1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
main();
