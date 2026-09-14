/**
 * src/engine/__tests__/model.test.ts — 模型连接测试
 *
 * 用法:
 *   npx tsx src/engine/__tests__/model.test.ts --apiKey sk-... --provider openai --model gpt-4o
 *   或设置环境变量:
 *   KX2_API_KEY=sk-... npx tsx src/engine/__tests__/model.test.ts
 *
 * 测试覆盖:
 * 1. 纯文本对话
 * 2. 流式输出（打字机效果）
 * 3. 工具调用 (function calling)
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
import { createEngine, getEngine } from '../core.ts';
import { importCommands } from '../commands/importer.ts';
// ---- parse args ----
var args = process.argv.slice(2);
var get = function (flag, fallback) {
    var idx = args.indexOf(flag);
    if (idx >= 0 && idx + 1 < args.length)
        return args[idx + 1];
    var eq = args.find(function (a) { return a.startsWith("".concat(flag, "=")); });
    if (eq)
        return eq.split('=')[1];
    return fallback;
};
var apiKey = get('--apiKey', process.env.KX2_API_KEY || '');
var provider = get('--provider', process.env.KX2_PROVIDER || 'openai');
var model = get('--model', process.env.KX2_MODEL || 'gpt-4o');
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
function section(title) {
    console.log("\n--- ".concat(title, " ---"));
}
function testChat(engine) {
    return __awaiter(this, void 0, void 0, function () {
        var result, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    section('Chat (non-streaming)');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, engine.query('你好，请用一句话回复。')];
                case 2:
                    result = _a.sent();
                    assert(result.content.length > 0, 'Got non-empty response');
                    console.log("  Response: ".concat(result.content.slice(0, 120)));
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    assert(false, "Chat works: ".concat(e_1.message));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function testStream(engine) {
    return __awaiter(this, void 0, void 0, function () {
        var chunks_1, fullText_1, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    section('Stream');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    chunks_1 = 0;
                    fullText_1 = '';
                    return [4 /*yield*/, engine.query('请用中文说：一二三四五。', undefined, {
                            onText: function (chunk) {
                                chunks_1++;
                                fullText_1 += chunk;
                            },
                        })];
                case 2:
                    _a.sent();
                    assert(chunks_1 > 0, "Received ".concat(chunks_1, " stream chunks"));
                    assert(fullText_1.length > 0, 'Stream produced non-empty text');
                    console.log("  Response: ".concat(fullText_1.slice(0, 120)));
                    return [3 /*break*/, 4];
                case 3:
                    e_2 = _a.sent();
                    assert(false, "Stream works: ".concat(e_2.message));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function testTools(engine) {
    return __awaiter(this, void 0, void 0, function () {
        var result, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    section('Tools (function calling)');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, engine.query('现在几点了？')];
                case 2:
                    result = _a.sent();
                    assert(result.content.length > 0 || result.toolCalls.length > 0, 'Got response or tool call');
                    console.log("  Response: ".concat((result.content || '').slice(0, 120)));
                    if (result.toolCalls.length > 0) {
                        console.log("  Tool calls: ".concat(result.toolCalls.length));
                    }
                    return [3 /*break*/, 4];
                case 3:
                    e_3 = _a.sent();
                    assert(false, "Tools work: ".concat(e_3.message));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var engine, count, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('KX2Code Model Test');
                    console.log('='.repeat(40));
                    console.log("Provider: ".concat(provider));
                    console.log("Model: ".concat(model));
                    console.log("API Key: ".concat(apiKey ? apiKey.slice(0, 8) + '...' : '(none)'));
                    if (!apiKey) {
                        console.error('\nError: API key required.');
                        console.log('Usage:');
                        console.log('  npx tsx src/engine/__tests__/model.test.ts --apiKey sk-... --provider openai --model gpt-4o');
                        console.log('  KX2_API_KEY=sk-... npx tsx src/engine/__tests__/model.test.ts');
                        process.exit(1);
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    console.log('\n[Init] Creating engine...');
                    createEngine({
                        apiKey: apiKey,
                        provider: provider,
                        model: model,
                        maxTokens: 4096,
                    });
                    engine = getEngine();
                    assert(engine !== null, 'Engine created');
                    return [4 /*yield*/, importCommands()];
                case 2:
                    count = _a.sent();
                    console.log("[Init] ".concat(count, " commands loaded"));
                    return [4 /*yield*/, testChat(engine)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, testStream(engine)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, testTools(engine)];
                case 5:
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
                        console.log('\nAll model tests passed!');
                        process.exit(0);
                    }
                    return [3 /*break*/, 7];
                case 6:
                    e_4 = _a.sent();
                    console.error('\n[Fatal]', e_4);
                    process.exit(1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
main();
