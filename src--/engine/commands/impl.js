/**
 * Agent 命令具体实现
 * 每个命令都有真实的执行逻辑，而非空桩
 *
 * 分类：
 * - local: 本地直接执行（git、文件系统、进程等）
 * - llm: 通过 LLM 执行（代码生成、分析等）
 * - team: 多角色协作（复杂任务）
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
import { execaCommand } from '../utils/exec.ts';
// ==================== Git 相关 ====================
export var gitCommitImpl = {
    type: 'local',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var msg, _a, stdout, stderr;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    msg = args.join(' ') || 'chore: auto commit';
                    return [4 /*yield*/, execaCommand("git add -A && git commit -m \"".concat(msg.replace(/"/g, '\\"'), "\""), cwd || process.cwd())];
                case 1:
                    _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                    return [2 /*return*/, stdout || stderr || 'Git 提交完成'];
            }
        });
    }); },
};
export var gitBlameImpl = {
    type: 'local',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var file, stdout;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    file = args[0] || '.';
                    return [4 /*yield*/, execaCommand("git blame ".concat(file), cwd || process.cwd())];
                case 1:
                    stdout = (_a.sent()).stdout;
                    return [2 /*return*/, stdout || 'Git Blame 完成'];
            }
        });
    }); },
};
// ==================== 文件操作 ====================
export var searchImpl = {
    type: 'local',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var query, target, stdout, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    query = args.join(' ');
                    if (!query)
                        return [2 /*return*/, '用法: /search <关键词>'];
                    target = cwd || process.cwd();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, execaCommand("grep -r -n --include=\"*.ts\" --include=\"*.tsx\" --include=\"*.js\" --include=\"*.py\" --include=\"*.rs\" --include=\"*.go\" \"".concat(query, "\" \"").concat(target, "\" 2>/dev/null || echo \"\u672A\u627E\u5230\u5339\u914D\""), target)];
                case 2:
                    stdout = (_b.sent()).stdout;
                    return [2 /*return*/, stdout || '未找到匹配'];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, '搜索完成，未找到匹配结果'];
                case 4: return [2 /*return*/];
            }
        });
    }); },
};
// ==================== Docker 相关 ====================
export var dockerImpl = {
    type: 'local',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var sub, rest, _a, stdout, stderr;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (args.length === 0)
                        return [2 /*return*/, '用法: /docker <build|run|ps|logs|stop|rm> [参数...]'];
                    sub = args[0];
                    rest = args.slice(1).join(' ');
                    return [4 /*yield*/, execaCommand("docker ".concat(sub, " ").concat(rest), cwd || process.cwd())];
                case 1:
                    _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                    return [2 /*return*/, stdout || stderr || "Docker ".concat(sub, " \u5B8C\u6210")];
            }
        });
    }); },
};
// ==================== 系统命令 ====================
export var execImpl = {
    type: 'local',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var cmd, _a, stdout, stderr, output, e_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (args.length === 0)
                        return [2 /*return*/, '用法: /exec <命令> [参数...]'];
                    cmd = args.join(' ');
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, execaCommand(cmd, cwd || process.cwd())];
                case 2:
                    _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                    output = [stdout, stderr].filter(Boolean).join('\n');
                    return [2 /*return*/, output || '(命令执行成功，无输出)'];
                case 3:
                    e_1 = _b.sent();
                    return [2 /*return*/, "\u6267\u884C\u5931\u8D25: ".concat(e_1.message)];
                case 4: return [2 /*return*/];
            }
        });
    }); },
};
// ==================== 命令描述映射 ====================
export var commandImpls = new Map([
    // Git
    ['commit', gitCommitImpl],
    ['blame', gitBlameImpl],
    // 搜索
    ['search', searchImpl],
    // Docker
    ['docker', dockerImpl],
    // 通用执行
    ['exec', execImpl],
]);
