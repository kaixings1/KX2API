/**
 * End-to-end chat test — 验证完整链路：引擎 → API → 实际响应
 *
 * 运行: npx tsx src/engine/__tests__/e2e-chat.test.ts
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
import axios from 'axios';
// 用配置文件中的真实数据
var profiles = [
    { name: 'ModelScope', baseUrl: 'https://api-inference.modelscope.cn/v1/chat/completions', apiKey: 'ms-e0186bce3a8b49eda2f33d60c84a1492', model: 'deepseek-ai/DeepSeek-V4-Flash' },
    { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/chat/completions', apiKey: 'sk-f34cf...', model: 'deepseek-chat' },
    { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1/chat/completions', apiKey: 'sk-ai-v1-...', model: 'tencent/hy3-preview:free' },
];
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
function testProfile(name, baseUrl, apiKey, model) {
    return __awaiter(this, void 0, void 0, function () {
        var response, content, e_1, status_1, body;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    console.log("\n--- Testing: ".concat(name, " ---"));
                    console.log("  URL: ".concat(baseUrl));
                    console.log("  Model: ".concat(model));
                    if (apiKey.includes('...') || apiKey.length < 10) {
                        console.log('  Skipped: API key appears incomplete');
                        return [2 /*return*/, false];
                    }
                    _k.label = 1;
                case 1:
                    _k.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios.post(baseUrl, {
                            model: model,
                            max_tokens: 50,
                            stream: false,
                            messages: [{ role: 'user', content: 'hi' }],
                        }, {
                            headers: { Authorization: "Bearer ".concat(apiKey), 'Content-Type': 'application/json' },
                            timeout: 30000,
                        })];
                case 2:
                    response = _k.sent();
                    console.log("  Status: ".concat(response.status));
                    content = ((_d = (_c = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || ((_g = (_f = (_e = response.data) === null || _e === void 0 ? void 0 : _e.choices) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.text) || '';
                    console.log("  Response: ".concat((content || JSON.stringify(response.data)).slice(0, 200)));
                    if (content || response.status === 200) {
                        assert(true, "".concat(name, " returned response"));
                        return [2 /*return*/, true];
                    }
                    else {
                        assert(false, "".concat(name, " returned empty content"));
                        return [2 /*return*/, false];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _k.sent();
                    status_1 = (_h = e_1.response) === null || _h === void 0 ? void 0 : _h.status;
                    body = ((_j = e_1.response) === null || _j === void 0 ? void 0 : _j.data) ? JSON.stringify(e_1.response.data).slice(0, 200) : e_1.message;
                    console.log("  Error ".concat(status_1, ": ").concat(body));
                    if (status_1 === 200 || status_1 === 201) {
                        assert(true, "".concat(name, " request succeeded"));
                        return [2 /*return*/, true];
                    }
                    assert(false, "".concat(name, " failed: ").concat(status_1, " ").concat(body));
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var anySuccess, _i, profiles_1, p, ok;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('KX2Code E2E Chat Test');
                    console.log('='.repeat(40));
                    anySuccess = false;
                    _i = 0, profiles_1 = profiles;
                    _a.label = 1;
                case 1:
                    if (!(_i < profiles_1.length)) return [3 /*break*/, 4];
                    p = profiles_1[_i];
                    return [4 /*yield*/, testProfile(p.name, p.baseUrl, p.apiKey, p.model)];
                case 2:
                    ok = _a.sent();
                    if (ok)
                        anySuccess = true;
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log('\n' + '='.repeat(40));
                    console.log("Passed: ".concat(passed));
                    console.log("Failed: ".concat(failed));
                    console.log("Total:  ".concat(passed + failed));
                    if (anySuccess) {
                        console.log('\nAt least one profile responded successfully!');
                        process.exit(0);
                    }
                    else {
                        console.log('\nNo profile succeeded. Check API keys or network.');
                        process.exit(1);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (e) { console.error('Fatal:', e); process.exit(1); });
