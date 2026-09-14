/**
 * src/engine/__tests__/engine.test.ts — 引擎测试套件
 *
 * 运行: npx tsx src/engine/__tests__/engine.test.ts
 *
 * 测试覆盖:
 * 1. 命令注册表
 * 2. 本地命令执行
 * 3. AI 代理命令标记
 * 4. 引擎配置
 * 5. 历史管理
 * 6. 命令导入器
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
import { commandRegistry } from '../commands/registry.ts';
import { importCommands } from '../commands/importer.ts';
// ---- helpers ----
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
// ---- tests ----
function testRegistry() {
    return __awaiter(this, void 0, void 0, function () {
        var count, core, _i, core_1, name_1, cmd, names, unique;
        return __generator(this, function (_a) {
            section('Command Registry');
            count = commandRegistry.getNames().length;
            assert(count > 200, "Total commands >= 200 (got ".concat(count, ")"));
            core = ['help', 'ls', 'cat', 'pwd', 'whoami', 'date', 'git-status', 'echo'];
            for (_i = 0, core_1 = core; _i < core_1.length; _i++) {
                name_1 = core_1[_i];
                assert(commandRegistry.has(name_1), "Core command /".concat(name_1, " registered"));
                cmd = commandRegistry.get(name_1);
                assert(cmd !== undefined && typeof cmd.execute === 'function', "/".concat(name_1, " has execute"));
            }
            names = commandRegistry.getNames();
            unique = new Set(names);
            assert(unique.size === names.length, 'No duplicate command names');
            return [2 /*return*/];
        });
    });
}
function testLocalCommands() {
    return __awaiter(this, void 0, void 0, function () {
        var engine, help, pwd, whoami, date, echo, ls, gitStatus;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    section('Local Commands');
                    engine = getEngine();
                    return [4 /*yield*/, engine.executeCommand('help', [])];
                case 1:
                    help = _b.sent();
                    assert(help.success === true, '/help succeeds');
                    assert((_a = help.output) === null || _a === void 0 ? void 0 : _a.includes('可用命令'), '/help output contains header');
                    return [4 /*yield*/, engine.executeCommand('pwd', [])];
                case 2:
                    pwd = _b.sent();
                    assert(pwd.success === true, '/pwd succeeds');
                    assert(typeof pwd.output === 'string' && pwd.output.length > 0, '/pwd returns path');
                    return [4 /*yield*/, engine.executeCommand('whoami', [])];
                case 3:
                    whoami = _b.sent();
                    assert(whoami.success === true, '/whoami succeeds');
                    return [4 /*yield*/, engine.executeCommand('date', [])];
                case 4:
                    date = _b.sent();
                    assert(date.success === true, '/date succeeds');
                    return [4 /*yield*/, engine.executeCommand('echo', ['hello', 'world'])];
                case 5:
                    echo = _b.sent();
                    assert(echo.success === true, '/echo succeeds');
                    assert(echo.output === 'hello world', '/echo output correct');
                    return [4 /*yield*/, engine.executeCommand('ls', [])];
                case 6:
                    ls = _b.sent();
                    assert(ls.success === true, '/ls succeeds');
                    return [4 /*yield*/, engine.executeCommand('git-status', [])];
                case 7:
                    gitStatus = _b.sent();
                    assert(typeof gitStatus.success === 'boolean', '/git-status returns boolean');
                    return [2 /*return*/];
            }
        });
    });
}
function testAIAgentCommands() {
    return __awaiter(this, void 0, void 0, function () {
        var engine, agentCmds, _i, agentCmds_1, cmd, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    section('AI Agent Commands');
                    engine = getEngine();
                    agentCmds = ['explain', 'refactor', 'review', 'docs', 'fix'];
                    _i = 0, agentCmds_1 = agentCmds;
                    _a.label = 1;
                case 1:
                    if (!(_i < agentCmds_1.length)) return [3 /*break*/, 4];
                    cmd = agentCmds_1[_i];
                    return [4 /*yield*/, engine.executeCommand(cmd, ['test'])];
                case 2:
                    result = _a.sent();
                    assert(result.success === true, "/".concat(cmd, " returns success"));
                    assert(result.needsAgent === true, "/".concat(cmd, " marked as needsAgent"));
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function testEngineConfig() {
    return __awaiter(this, void 0, void 0, function () {
        var engine, config;
        return __generator(this, function (_a) {
            section('Engine Config');
            engine = getEngine();
            config = engine.getConfig();
            assert(config.provider === 'openai', "Default provider is openai (got ".concat(config.provider, ")"));
            assert(config.model === 'gpt-4o', "Default model is gpt-4o (got ".concat(config.model, ")"));
            assert(typeof config.apiKey === 'string', 'apiKey is string');
            engine.updateConfig({ model: 'gpt-3.5-turbo' });
            assert(engine.getConfig().model === 'gpt-3.5-turbo', 'updateConfig works');
            engine.updateConfig({ model: 'gpt-4o' });
            assert(engine.getConfig().model === 'gpt-4o', 'Config restored');
            return [2 /*return*/];
        });
    });
}
function testHistory() {
    return __awaiter(this, void 0, void 0, function () {
        var engine, history;
        return __generator(this, function (_a) {
            section('History Management');
            engine = getEngine();
            engine.clearHistory();
            history = engine.getHistory();
            assert(Array.isArray(history.messages), 'getHistory returns messages array');
            return [2 /*return*/];
        });
    });
}
function testImporter() {
    return __awaiter(this, void 0, void 0, function () {
        var count;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    section('Command Importer');
                    return [4 /*yield*/, importCommands()];
                case 1:
                    count = _a.sent();
                    assert(count === commandRegistry.getNames().length, "Importer count matches registry (".concat(count, " vs ").concat(commandRegistry.getNames().length, ")"));
                    return [2 /*return*/];
            }
        });
    });
}
// ---- main ----
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('KX2Code Engine Test Suite');
                    console.log('='.repeat(40));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    console.log('\n[Init] Creating engine...');
                    createEngine({
                        apiKey: '',
                        provider: 'openai',
                        model: 'gpt-4o',
                        maxTokens: 4096,
                    });
                    assert(getEngine() !== null, 'Engine created');
                    return [4 /*yield*/, testRegistry()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, testLocalCommands()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, testAIAgentCommands()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, testEngineConfig()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, testHistory()];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, testImporter()];
                case 7:
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
                    return [3 /*break*/, 9];
                case 8:
                    e_1 = _a.sent();
                    console.error('\n[Fatal]', e_1);
                    process.exit(1);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
main();
