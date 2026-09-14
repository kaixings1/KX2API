#!/usr/bin/env node
/**
 * src/engine/cli.ts — KX2Code 引擎命令行入口
 *
 * 用法:
 *   node src/engine/cli.ts
 *   node src/engine/cli.ts --provider openai --model gpt-4o --apiKey sk-...
 *
 * 交互式输入，按 Enter 发送，Ctrl+C 退出
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
import * as readline from 'readline';
import { createEngine, getEngine } from './core';
import { importCommands } from './commands/importer';
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
// ---- init ----
function init() {
    return __awaiter(this, void 0, void 0, function () {
        var engine, count, rl;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[CLI] Initializing engine: provider=".concat(provider, ", model=").concat(model));
                    createEngine({
                        apiKey: apiKey,
                        provider: provider,
                        model: model,
                        maxTokens: 4096,
                    });
                    engine = getEngine();
                    return [4 /*yield*/, importCommands()];
                case 1:
                    count = _a.sent();
                    console.log("[CLI] ".concat(count, " commands loaded\n"));
                    console.log('Type a message and press Enter. /help for commands. Ctrl+C to exit.\n');
                    rl = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout,
                        prompt: '❯ ',
                    });
                    rl.prompt();
                    rl.on('line', function (line) { return __awaiter(_this, void 0, void 0, function () {
                        var text, parts, cmdName, cmdArgs, result, result, e_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    text = line.trim();
                                    if (!text) {
                                        rl.prompt();
                                        return [2 /*return*/];
                                    }
                                    if (!text.startsWith('/')) return [3 /*break*/, 2];
                                    parts = text.split(' ').filter(Boolean);
                                    cmdName = parts[0].replace(/^\//, '');
                                    cmdArgs = parts.slice(1);
                                    return [4 /*yield*/, engine.executeCommand(cmdName, cmdArgs)];
                                case 1:
                                    result = _a.sent();
                                    if (result.success) {
                                        console.log("\n".concat(result.output, "\n"));
                                    }
                                    else {
                                        console.log("\n\u26A0 ".concat(result.error, "\n"));
                                    }
                                    rl.prompt();
                                    return [2 /*return*/];
                                case 2:
                                    _a.trys.push([2, 4, , 5]);
                                    process.stdout.write('… ');
                                    return [4 /*yield*/, engine.query(text)];
                                case 3:
                                    result = _a.sent();
                                    console.log("\n".concat(result.content || result.toolOutput || '(empty)', "\n"));
                                    return [3 /*break*/, 5];
                                case 4:
                                    e_1 = _a.sent();
                                    console.log("\n\u26A0 ".concat(e_1.message, "\n"));
                                    return [3 /*break*/, 5];
                                case 5:
                                    rl.prompt();
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    rl.on('close', function () {
                        console.log('\n[CLI] Bye!');
                        process.exit(0);
                    });
                    return [2 /*return*/];
            }
        });
    });
}
init().catch(function (err) {
    console.error('[CLI] Fatal:', err);
    process.exit(1);
});
