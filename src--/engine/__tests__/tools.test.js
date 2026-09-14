/**
 * 工具调用测试 — 验证 10 个工具命令：pwd, ls, dir, date, grep, find, findstr, where, python, python3
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
import { createEngine } from '../core';
import { commandRegistry } from '../commands/registry';
createEngine({
    apiKey: 'test',
    provider: 'openai',
    model: 'test',
    baseUrl: 'http://127.0.0.1:8080',
});
var toolArgs = {
    pwd: [],
    ls: [],
    dir: [],
    date: [],
    grep: ['TODO', 'src/engine'],
    find: ['package.json', 'src'],
    findstr: ['TODO', 'src/engine'],
    where: ['node'],
    python: ['print("hello")'],
    python3: ['print("hello")'],
};
var passed = 0;
var failed = 0;
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
function testTool(name) {
    return __awaiter(this, void 0, void 0, function () {
        var cmd, args, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cmd = commandRegistry.get(name);
                    if (!cmd) {
                        assert(false, "".concat(name, " \u2014 \u547D\u4EE4\u672A\u6CE8\u518C"));
                        return [2 /*return*/];
                    }
                    args = toolArgs[name] || [];
                    console.log("\n--- /".concat(name, " ").concat(args.join(' '), " ---"));
                    return [4 /*yield*/, cmd.execute(args)];
                case 1:
                    result = _a.sent();
                    if (result.success) {
                        assert(true, "".concat(name, " \u6267\u884C\u6210\u529F"));
                        console.log("  Output: ".concat((result.output || '').slice(0, 200)));
                    }
                    else {
                        assert(false, "".concat(name, ": ").concat(result.error));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
var tools = Object.keys(toolArgs);
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _i, tools_1, t;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Tool Call Test — 10 commands\n');
                    _i = 0, tools_1 = tools;
                    _a.label = 1;
                case 1:
                    if (!(_i < tools_1.length)) return [3 /*break*/, 4];
                    t = tools_1[_i];
                    return [4 /*yield*/, testTool(t)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("\n".concat('='.repeat(40)));
                    console.log("Passed: ".concat(passed, "  Failed: ").concat(failed, "  Total: ").concat(passed + failed));
                    if (failed === 0) {
                        console.log('All tools executed successfully!');
                        process.exit(0);
                    }
                    else {
                        console.log("".concat(failed, " tool(s) failed."));
                        process.exit(1);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (e) { console.error('Fatal:', e); process.exit(1); });
