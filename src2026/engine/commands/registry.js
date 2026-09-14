/**
 * src/engine/commands/registry.ts — 命令注册表
 *
 * 从 doge-code 移植命令系统。命令分为两类：
 * - 本地命令：直接在 Node.js 执行，返回结果
 * - AI 代理命令：将命令意图转为 prompt，由 LLM 执行
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
var CommandRegistry = /** @class */ (function () {
    function CommandRegistry() {
        this.commands = new Map();
    }
    CommandRegistry.prototype.register = function (cmd) {
        this.commands.set(cmd.name, cmd);
    };
    CommandRegistry.prototype.get = function (name) {
        return this.commands.get(name);
    };
    CommandRegistry.prototype.getAll = function () {
        return Array.from(this.commands.values());
    };
    CommandRegistry.prototype.has = function (name) {
        return this.commands.has(name);
    };
    CommandRegistry.prototype.getNames = function () {
        return Array.from(this.commands.keys());
    };
    return CommandRegistry;
}());
export var commandRegistry = new CommandRegistry();
// ==================== 基础命令 ====================
commandRegistry.register({
    name: 'help',
    description: '显示帮助信息',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        var all, lines;
        return __generator(this, function (_a) {
            all = commandRegistry.getAll();
            lines = all.map(function (c) { return "  /".concat(c.name, " \u2014 ").concat(c.description); });
            return [2 /*return*/, { success: true, output: "\u53EF\u7528\u547D\u4EE4 (".concat(all.length, "):\n\n").concat(lines.join('\n')) }];
        });
    }); },
});
commandRegistry.register({
    name: 'clear',
    description: '清空对话',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, { success: true, output: '对话已清空' }];
        });
    }); },
});
commandRegistry.register({
    name: 'new',
    description: '开始新对话',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, { success: true, output: '已开始新对话' }];
        });
    }); },
});
commandRegistry.register({
    name: 'pwd',
    description: '当前工作目录',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                return [2 /*return*/, { success: true, output: process.cwd() }];
            }
            catch (e) {
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); },
});
commandRegistry.register({
    name: 'ls',
    description: '列出目录文件',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var fs, path, target, entries, lines, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, import('fs')];
                case 1:
                    fs = _a.sent();
                    return [4 /*yield*/, import('path')];
                case 2:
                    path = _a.sent();
                    target = args[0] || process.cwd();
                    return [4 /*yield*/, fs.promises.readdir(target, { withFileTypes: true })];
                case 3:
                    entries = _a.sent();
                    lines = entries.map(function (e) { return e.isDirectory() ? "[DIR]  ".concat(e.name, "/") : "       ".concat(e.name); });
                    return [2 /*return*/, { success: true, output: lines.join('\n') || '(空目录)' }];
                case 4:
                    e_1 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_1.message }];
                case 5: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'dir',
    description: '列出目录文件 (Windows dir)',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var fs, target, entries, lines, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, import('fs')];
                case 1:
                    fs = _a.sent();
                    target = args[0] || process.cwd();
                    return [4 /*yield*/, fs.promises.readdir(target, { withFileTypes: true })];
                case 2:
                    entries = _a.sent();
                    lines = entries.map(function (e) { return e.isDirectory() ? "<DIR>  ".concat(e.name) : "       ".concat(e.name); });
                    return [2 /*return*/, { success: true, output: lines.join('\n') || '(空目录)' }];
                case 3:
                    e_2 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_2.message }];
                case 4: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'grep',
    description: '在文件中搜索文本 (用法: /grep <pattern> [file])',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, pattern, target, cmd, result, e_3, out;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    if (!args.length)
                        return [2 /*return*/, { success: false, error: '用法: /grep <pattern> [file]' }];
                    pattern = args[0];
                    target = args[1] || process.cwd();
                    cmd = process.platform === 'win32'
                        ? "findstr /s /n \"".concat(pattern, "\" \"").concat(target, "\"")
                        : "grep -rn \"".concat(pattern, "\" \"").concat(target, "\"");
                    result = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), timeout: 10000 });
                    return [2 /*return*/, { success: true, output: result || '(无匹配)' }];
                case 2:
                    e_3 = _a.sent();
                    out = e_3.stdout || e_3.message;
                    return [2 /*return*/, { success: true, output: out || '(无匹配)' }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'find',
    description: '查找文件 (用法: /find <name> [dir])',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, name_1, dir, cmd, result, e_4, out;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    if (!args.length)
                        return [2 /*return*/, { success: false, error: '用法: /find <name> [dir]' }];
                    name_1 = args[0];
                    dir = args[1] || process.cwd();
                    cmd = process.platform === 'win32'
                        ? "dir /s /b \"".concat(dir, "\" | findstr /i \"").concat(name_1, "\"")
                        : "find \"".concat(dir, "\" -name \"*").concat(name_1, "*\"");
                    result = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), timeout: 10000 });
                    return [2 /*return*/, { success: true, output: result || '(无匹配)' }];
                case 2:
                    e_4 = _a.sent();
                    out = e_4.stdout || e_4.message;
                    return [2 /*return*/, { success: true, output: out || '(无匹配)' }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'findstr',
    description: '在文件中搜索文本 (Windows findstr, 用法: /findstr <pattern> [file])',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, pattern, target, result, e_5, out;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    if (!args.length)
                        return [2 /*return*/, { success: false, error: '用法: /findstr <pattern> [file]' }];
                    pattern = args[0];
                    target = args[1] || process.cwd();
                    result = execSync("findstr /s /n \"".concat(pattern, "\" \"").concat(target, "\""), { encoding: 'utf-8', cwd: process.cwd(), timeout: 10000 });
                    return [2 /*return*/, { success: true, output: result || '(无匹配)' }];
                case 2:
                    e_5 = _a.sent();
                    out = e_5.stdout || e_5.message;
                    return [2 /*return*/, { success: true, output: out || '(无匹配)' }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'where',
    description: '查找可执行文件路径 (用法: /where <command>)',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, name_2, result, e_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    name_2 = args[0] || 'node';
                    result = execSync("where \"".concat(name_2, "\""), { encoding: 'utf-8', timeout: 10000 });
                    return [2 /*return*/, { success: true, output: result.trim() }];
                case 2:
                    e_6 = _a.sent();
                    return [2 /*return*/, { success: false, error: "\u672A\u627E\u5230: ".concat(args[0]) }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'python',
    description: '执行 Python 代码 (用法: /python <code>)',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, code, result, e_7, out;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    if (!args.length)
                        return [2 /*return*/, { success: false, error: '用法: /python <code>' }];
                    code = args.join(' ');
                    result = execSync("python -c \"".concat(code, "\""), { encoding: 'utf-8', timeout: 10000 });
                    return [2 /*return*/, { success: true, output: result.trim() }];
                case 2:
                    e_7 = _a.sent();
                    out = e_7.stdout || e_7.message;
                    return [2 /*return*/, { success: true, output: out.trim() }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'python3',
    description: '执行 Python3 代码 (用法: /python3 <code>)',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, code, result, e_8, out;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    if (!args.length)
                        return [2 /*return*/, { success: false, error: '用法: /python3 <code>' }];
                    code = args.join(' ');
                    result = execSync("python3 -c \"".concat(code, "\""), { encoding: 'utf-8', timeout: 10000 });
                    return [2 /*return*/, { success: true, output: result.trim() }];
                case 2:
                    e_8 = _a.sent();
                    out = e_8.stdout || e_8.message;
                    return [2 /*return*/, { success: true, output: out.trim() }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'cat',
    description: '查看文件内容',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var fs, content, e_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!args.length)
                        return [2 /*return*/, { success: false, error: '用法: /cat <文件路径>' }];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, import('fs')];
                case 2:
                    fs = _a.sent();
                    return [4 /*yield*/, fs.promises.readFile(args[0], 'utf-8')];
                case 3:
                    content = _a.sent();
                    return [2 /*return*/, { success: true, output: content }];
                case 4:
                    e_9 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_9.message }];
                case 5: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'tree',
    description: '目录树',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        function buildTree(dir, prefix, depth) {
            return __awaiter(this, void 0, void 0, function () {
                var entries, _a, lines;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (depth > 2)
                                return [2 /*return*/, []];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, fs_1.promises.readdir(dir, { withFileTypes: true })];
                        case 2:
                            entries = _b.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            _a = _b.sent();
                            return [2 /*return*/, []];
                        case 4:
                            lines = [];
                            entries.forEach(function (entry, i) {
                                var isLast = i === entries.length - 1;
                                var connector = isLast ? '└── ' : '├── ';
                                var name = entry.isDirectory() ? "".concat(entry.name, "/") : entry.name;
                                lines.push("".concat(prefix).concat(connector).concat(name));
                                if (entry.isDirectory() && depth < 2) {
                                    var nextPrefix = "".concat(prefix).concat(isLast ? '    ' : '│   ');
                                    lines.push.apply(lines, buildTree(path_1.join(dir, entry.name), nextPrefix, depth + 1));
                                }
                            });
                            return [2 /*return*/, lines];
                    }
                });
            });
        }
        var fs_1, path_1, cwd, tree, e_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, import('fs')];
                case 1:
                    fs_1 = _a.sent();
                    return [4 /*yield*/, import('path')];
                case 2:
                    path_1 = _a.sent();
                    cwd = process.cwd();
                    return [4 /*yield*/, buildTree(cwd, '', 0)];
                case 3:
                    tree = _a.sent();
                    return [2 /*return*/, { success: true, output: tree.join('\n') }];
                case 4:
                    e_10 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_10.message }];
                case 5: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'echo',
    description: '输出文本',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, { success: true, output: args.join(' ') }];
        });
    }); },
});
commandRegistry.register({
    name: 'date',
    description: '当前日期时间',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, { success: true, output: new Date().toLocaleString('zh-CN') }];
        });
    }); },
});
commandRegistry.register({
    name: 'whoami',
    description: '当前用户',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, { success: true, output: process.env.USER || process.env.USERNAME || 'unknown' }];
        });
    }); },
});
commandRegistry.register({
    name: 'stats',
    description: '使用统计',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, { success: true, output: '统计功能需要完整引擎支持' }];
        });
    }); },
});
commandRegistry.register({
    name: 'config',
    description: '查看配置',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, { success: true, output: '配置功能需要完整引擎支持' }];
        });
    }); },
});
commandRegistry.register({
    name: 'model',
    description: '切换模型',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!args.length)
                return [2 /*return*/, { success: false, error: '用法: /model <模型名称>' }];
            return [2 /*return*/, { success: true, output: "\u6A21\u578B\u5207\u6362\u4E3A: ".concat(args[0]) }];
        });
    }); },
});
commandRegistry.register({
    name: 'version',
    description: '显示版本',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        var pkg, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('../../../package.json', { assert: { type: 'json' } })];
                case 1:
                    pkg = _b.sent();
                    return [2 /*return*/, { success: true, output: "KX2Code v".concat(pkg.version) }];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, { success: true, output: 'KX2Code v1.0.0' }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
// ==================== 开发调试命令 ====================
// 仅 NODE_ENV=development 时可用
var isDev = process.env.NODE_ENV === 'development';
commandRegistry.register({
    name: 'test-tools',
    description: isDev ? '运行工具调用链路测试 (开发模式)' : '仅开发模式可用',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        var engineBridge, results, lines, e_11;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isDev) {
                        return [2 /*return*/, { success: false, error: '此命令仅在开发模式下可用 (NODE_ENV=development)' }];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, import('../../main/engine-bridge')];
                case 2:
                    engineBridge = _a.sent();
                    return [4 /*yield*/, engineBridge.runDirectToolTests()];
                case 3:
                    results = _a.sent();
                    lines = [
                        "\u5DE5\u5177\u94FE\u8DEF\u6D4B\u8BD5\u5B8C\u6210: ".concat(results.passed, "/").concat(results.total, " \u901A\u8FC7"),
                        results.failed > 0 ? "".concat(results.failed, " \u4E2A\u5931\u8D25") : '全部通过',
                        '',
                        "passed: ".concat(results.passed),
                        "failed: ".concat(results.failed),
                        "total: ".concat(results.total),
                    ];
                    return [2 /*return*/, { success: results.failed === 0, output: lines.join('\n') }];
                case 4:
                    e_11 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_11.message }];
                case 5: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'team',
    description: '多角色协作 (用法: /team <任务描述>)',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var Team, team, result, e_12;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, import('../../main/agent/team/team')];
                case 1:
                    Team = (_a.sent()).Team;
                    team = new Team({
                        mode: 'team',
                        roles: [
                            {
                                id: 'lead',
                                name: 'Team Leader',
                                profile: 'Team Leader',
                                goal: 'Coordinate team members and delegate tasks effectively',
                                constraints: ['Always assign tasks to appropriate team members', 'Ensure task completion'],
                            },
                            {
                                id: 'engineer',
                                name: 'Engineer',
                                profile: 'Software Engineer',
                                goal: 'Implement solutions based on requirements',
                                constraints: ['Write clean, maintainable code', 'Follow best practices'],
                            },
                        ],
                        leadRole: 'lead',
                        maxRounds: 3,
                    });
                    return [4 /*yield*/, team.process(args.join(' ') || 'No task specified')];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, { success: true, output: result }];
                case 3:
                    e_12 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_12.message }];
                case 4: return [2 /*return*/];
            }
        });
    }); },
});
// ==================== Git 命令 ====================
commandRegistry.register({
    name: 'git-status',
    description: 'Git 状态',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, result, e_13;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    result = execSync('git status --short', { encoding: 'utf-8', cwd: process.cwd() });
                    return [2 /*return*/, { success: true, output: result || '工作区干净' }];
                case 2:
                    e_13 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_13.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'git-diff',
    description: 'Git 差异',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, result, e_14;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    result = execSync('git diff', { encoding: 'utf-8', cwd: process.cwd() });
                    return [2 /*return*/, { success: true, output: result || '无差异' }];
                case 2:
                    e_14 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_14.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'git-log',
    description: 'Git 提交历史',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, count, result, e_15;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    count = args[0] || '10';
                    result = execSync("git log --oneline -".concat(count), { encoding: 'utf-8', cwd: process.cwd() });
                    return [2 /*return*/, { success: true, output: result || '无提交记录' }];
                case 2:
                    e_15 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_15.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'git-branch',
    description: 'Git 分支',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, result, e_16;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    result = execSync('git branch -a', { encoding: 'utf-8', cwd: process.cwd() });
                    return [2 /*return*/, { success: true, output: result || '无分支' }];
                case 2:
                    e_16 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_16.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
// ==================== 系统信息��令 ====================
commandRegistry.register({
    name: 'env',
    description: '环境变量',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var key, envs;
        return __generator(this, function (_a) {
            key = args[0];
            if (key) {
                return [2 /*return*/, { success: true, output: process.env[key] || "\u672A\u8BBE\u7F6E: ".concat(key) }];
            }
            envs = Object.entries(process.env).slice(0, 20).map(function (_a) {
                var k = _a[0], v = _a[1];
                return "".concat(k, "=").concat(v);
            });
            return [2 /*return*/, { success: true, output: envs.join('\n') }];
        });
    }); },
});
commandRegistry.register({
    name: 'ps',
    description: '进程列表',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        var execSync, result, lines, e_17;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('child_process')];
                case 1:
                    execSync = (_a.sent()).execSync;
                    result = execSync('ps aux', { encoding: 'utf-8' });
                    lines = result.split('\n').slice(0, 20).join('\n');
                    return [2 /*return*/, { success: true, output: lines }];
                case 2:
                    e_17 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_17.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'memory',
    description: '内存使用',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        var usage, lines;
        return __generator(this, function (_a) {
            usage = process.memoryUsage();
            lines = [
                "RSS: ".concat((usage.rss / 1024 / 1024).toFixed(1), " MB"),
                "Heap Used: ".concat((usage.heapUsed / 1024 / 1024).toFixed(1), " MB"),
                "Heap Total: ".concat((usage.heapTotal / 1024 / 1024).toFixed(1), " MB"),
                "External: ".concat((usage.external / 1024 / 1024).toFixed(1), " MB"),
            ];
            return [2 /*return*/, { success: true, output: lines.join('\n') }];
        });
    }); },
});
// ==================== 配置组管理命令 ====================
commandRegistry.register({
    name: 'login',
    description: '切换到指定配置组（用法: /login <name>）',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var ProfileManager, pm, name_3, active_1, list, result, names, getEngine, eng, e_18;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, import('../../main/profiles/manager')];
                case 1:
                    ProfileManager = (_b.sent()).ProfileManager;
                    pm = new ProfileManager();
                    name_3 = args[0];
                    if (!name_3) {
                        active_1 = pm.getActive();
                        list = pm.list().map(function (p) { return "  ".concat(p.name).concat(p === active_1 ? ' *' : '', "  ").concat(p.provider, "  ").concat(p.model); }).join('\n') || '(无配置组)';
                        return [2 /*return*/, { success: true, output: "\u5F53\u524D\u914D\u7F6E\u7EC4: ".concat((_a = active_1 === null || active_1 === void 0 ? void 0 : active_1.name) !== null && _a !== void 0 ? _a : '(无)', "\n\n\u53EF\u7528\u914D\u7F6E\u7EC4:\n").concat(list) }];
                    }
                    result = pm.setActive(name_3);
                    if (!result) {
                        names = pm.list().map(function (p) { return p.name; }).join(', ');
                        return [2 /*return*/, { success: false, error: "\u914D\u7F6E\u7EC4 \"".concat(name_3, "\" \u4E0D\u5B58\u5728\u3002\u53EF\u7528: ").concat(names || '(无)') }];
                    }
                    return [4 /*yield*/, import('../core')];
                case 2:
                    getEngine = (_b.sent()).getEngine;
                    eng = getEngine();
                    eng.updateConfig(pm.toEngineConfig(result));
                    return [2 /*return*/, { success: true, output: "\u5DF2\u5207\u6362\u5230\u914D\u7F6E\u7EC4: ".concat(name_3, "\n  provider: ").concat(result.provider, "\n  baseUrl: ").concat(result.baseUrl, "\n  model: ").concat(result.model) }];
                case 3:
                    e_18 = _b.sent();
                    return [2 /*return*/, { success: false, error: e_18.message }];
                case 4: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'profiles',
    description: '列出所有配置组',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        var ProfileManager, pm, active_2, lines, current, e_19;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('../../main/profiles/manager')];
                case 1:
                    ProfileManager = (_a.sent()).ProfileManager;
                    pm = new ProfileManager();
                    active_2 = pm.getActive();
                    lines = pm.list().map(function (p) {
                        return "  ".concat(p.name).concat(p === active_2 ? ' *' : '', "  ").concat(p.provider, "  ").concat(p.baseUrl, "  ").concat(p.model);
                    });
                    current = active_2 ? "\n\u5F53\u524D: ".concat(active_2.name) : '\n当前: (无)';
                    return [2 /*return*/, { success: true, output: "\u914D\u7F6E\u7EC4 (".concat(pm.list().length, "):\n").concat(lines.join('\n') || '(无)').concat(current) }];
                case 2:
                    e_19 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_19.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'add-profile',
    description: '添加配置组（用法: /add-profile <name> <provider> <baseUrl> <apiKey> [model]）',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var ProfileManager, pm, name_4, provider, baseUrl, apiKey, _a, model, e_20;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('../../main/profiles/manager')];
                case 1:
                    ProfileManager = (_b.sent()).ProfileManager;
                    pm = new ProfileManager();
                    if (args.length < 4) {
                        return [2 /*return*/, { success: false, error: '用法: /add-profile <name> <provider> <baseUrl> <apiKey> [model]' }];
                    }
                    name_4 = args[0], provider = args[1], baseUrl = args[2], apiKey = args[3], _a = args[4], model = _a === void 0 ? 'gpt-4o' : _a;
                    pm.upsert({ name: name_4, provider: provider, baseUrl: baseUrl, apiKey: apiKey, model: model });
                    return [2 /*return*/, { success: true, output: "\u914D\u7F6E\u7EC4 \"".concat(name_4, "\" \u5DF2\u6DFB\u52A0\n  provider: ").concat(provider, "\n  baseUrl: ").concat(baseUrl, "\n  model: ").concat(model) }];
                case 2:
                    e_20 = _b.sent();
                    return [2 /*return*/, { success: false, error: e_20.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
commandRegistry.register({
    name: 'del-profile',
    description: '删除配置组（用法: /del-profile <name>）',
    execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var ProfileManager, pm, name_5, e_21;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, import('../../main/profiles/manager')];
                case 1:
                    ProfileManager = (_a.sent()).ProfileManager;
                    pm = new ProfileManager();
                    name_5 = args[0];
                    if (!name_5)
                        return [2 /*return*/, { success: false, error: '用法: /del-profile <name>' }];
                    if (!pm.remove(name_5))
                        return [2 /*return*/, { success: false, error: "\u914D\u7F6E\u7EC4 \"".concat(name_5, "\" \u4E0D\u5B58\u5728") }];
                    return [2 /*return*/, { success: true, output: "\u914D\u7F6E\u7EC4 \"".concat(name_5, "\" \u5DF2\u5220\u9664") }];
                case 2:
                    e_21 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_21.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
// ==================== AI 代理命令占位 ====================
// 这些命令将通过 AI 代理执行，仅注册名称和描述
var aiAgentCommands = [
    { name: 'commit', description: 'Git 提交' },
    { name: 'review', description: '代码审查' },
    { name: 'refactor', description: '代码重构' },
    { name: 'test', description: '生成测试' },
    { name: 'docs', description: '生成文档' },
    { name: 'fix', description: '修复 bug' },
    { name: 'explain', description: '解释代码' },
    { name: 'search', description: '代码搜索' },
    { name: 'docker', description: 'Docker 操作' },
    { name: 'deploy', description: '部署操作' },
    { name: 'migrate', description: '数据库迁移' },
    { name: 'analyze', description: '代码分析' },
];
var _loop_1 = function (cmd) {
    commandRegistry.register({
        name: cmd.name,
        description: cmd.description,
        execute: function (args) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        success: true,
                        needsAgent: true,
                        output: "[AI \u4EE3\u7406] \u547D\u4EE4 /".concat(cmd.name, " ").concat(args.join(' '), " \u5DF2\u63A5\u6536\uFF0C\u5C06\u7531 AI \u6267\u884C\u3002"),
                    }];
            });
        }); },
    });
};
for (var _i = 0, aiAgentCommands_1 = aiAgentCommands; _i < aiAgentCommands_1.length; _i++) {
    var cmd = aiAgentCommands_1[_i];
    _loop_1(cmd);
}
// ==================== AI 代理命令 ====================
// ponytail: 这些命令通过 AI 代理执行，有明确上限
commandRegistry.register({
    name: 'add-dir',
    description: '添加新的工作目录',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /add-dir \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'add-model',
    description: '将自定义模型添加到已保存的模型列表',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /add-model \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'code-reviewer',
    description: '代码审查专家 - 深度分析代码质量、安全性和最佳实践',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /code-reviewer \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'agents',
    description: '管理代理配置',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /agents \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'agents-platform',
    description: '多代理编排平台 — 创建、管理和协调多个 AI 代理',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /agents-platform \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'api-debug',
    description: 'REST API 调试客户端 - Postman 风格的 API 测试工具',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /api-debug \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'api-test',
    description: 'API 测试 - 运行/批量运行/添加/列表/快速请求/历史/导出/集合导入/对比/状态/基准测试',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /api-test \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'auto',
    description: '项目无法编译、TypeScript 类型检查失败、构建流程中断',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /auto \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'auto-commit',
    description: 'Smart auto-commit - AI generates commit messages, supports conventional commits',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /auto-commit \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'auto-mode-reset',
    description: '重置自动模式配置为默认值 (更新日志 2.1.212)',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /auto-mode-reset \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'backfill-sessions',
    description: '扫描并恢复历史会话数据到当前工作区',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /backfill-sessions \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'background',
    description: '后台任务管理 - 运行/查看/终止/监控后台任务',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /background \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'backup',
    description: '备份当前会话数据到本地文件',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /backup \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'backup-full',
    description: 'Full backup - create/restore/list/delete/export/import/clean/verify/diff',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /backup-full \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'batch-han',
    description: '批量汉化 TypeScript 文件',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /batch-han \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'benchmark',
    description: '性能基准测试工具',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /benchmark \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'blame',
    description: 'Git Blame - 文件/作者统计/热力图/最近修改',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /blame \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'block-mode',
    description: '切换块状输出模式（为工具输出添加边框和折叠功能）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /block-mode \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'bookmark',
    description: '代码书签 - 标记和跳转到重要代码位置',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /bookmark \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'branch',
    description: '在当前位置创建对话分支',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /branch \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'break-cache',
    description: '清除和重建提示/响应缓存，提供详细的缓存管理功能',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /break-cache \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'remote-control',
    description: '连接此终端以进行远程控制会话',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /remote-control \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'bridge',
    description: '本地终端会话管理系统（类似 tmux/screen，支持多会话持久化、多窗口面板、SSH 远程访问）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /bridge \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'btw',
    description: '询问快速侧面问题，不中断主对话',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /btw \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'buddy',
    description: '孵化编程伙伴 pet 抚摸, off 静音',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /buddy \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'bundle',
    description: 'Bundle - 体积/最大文件/类型/分析/优化/历史/趋势/配置/导出',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /bundle \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'cache',
    description: '缓存操作',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /cache \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'changelog',
    description: '查看 Claude Code 最新的更新和变更',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /changelog \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'changelog-gen',
    description: '变更日志 - 生成/历史/预览/保存/统计/类型/作者',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /changelog-gen \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'chrome',
    description: 'Claude in Chrome 设置',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /chrome \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'cmd',
    description: '搜索和浏览可用命令',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /cmd \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'code-health',
    description: '代码健康检查 - 文件/复杂度/大小/文档/测试/重复/风格/安全/历史/基准',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /code-health \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'code-review-assistant',
    description: '智能代码审查助手（AI 审查 git diff）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /code-review-assistant \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'color',
    description: '设置此会话的提示栏颜色',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /color \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'compact',
    description: '清除对话历史但保留摘要在上下文中。可选：/compact [摘要指令]',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /compact \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'compare',
    description: '比较不同文件、分支或会话之间的差异',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /compare \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'complete',
    description: '${c.image} (${c.status})',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /complete \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'conflict',
    description: '合并冲突 - 列出/显示/解决(ours/theirs/both)/中止/继续',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /conflict \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'context',
    description: '以彩色网格可视化当前上下文使用情况',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /context \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'context-collapse',
    description: '折叠/展开对话上下文中的非关键部分以释放空间',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /context-collapse \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'contributors',
    description: '贡献者分析 - 列表/图表/文件/趋势/邮箱/全部',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /contributors \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'copy',
    description: '将 Claude 的最后一次响应复制到剪贴板（或 /copy N 复制第 N 条最新响应）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /copy \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'copy-page',
    description: '将当前页面或选中的内容复制为 Markdown 格式',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /copy-page \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'cost',
    description: '显示当前会话的成本和持续时间（支持 --by-model / --by-type / --trend / --export）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /cost \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'cost-history',
    description: '查看 API 成本历史记录与趋势（按会话/模型/时间）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /cost-history \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'cron',
    description: '管理 cron 定时任务',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /cron \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'custom-cmd',
    description: '管理自定义斜杠命令',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /custom-cmd \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'dashboard',
    description: '用量仪表盘 - 打开用量分析仪表盘',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /dashboard \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'database',
    description: '查看和操作数据库中存储的数据',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /database \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'db-migrate',
    description: '数据库迁移 - 状态/执行/回滚/创建/应用/验证/重置/历史/生成',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /db-migrate \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'dead-code',
    description: '死代码检测 - 静态/工具/导出/导入/函数/类/统计/历史/导出',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /dead-code \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'debug-tool-call',
    description: '调试和诊断工具调用，查看详细日志与分析',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /debug-tool-call \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'dependency-analyzer',
    description: '依赖分析工具',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /dependency-analyzer \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'dev',
    description: '部署 - 多环境/历史/健康/回滚/检查/配置',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /dev \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'deps',
    description: '依赖管理 - 状态/过期/更新/添加/移除/审计',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /deps \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'deps-viz',
    description: '分析代码库依赖关系和文件拓扑结构，生成依赖图',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /deps-viz \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'desktop',
    description: '在 Claude Desktop 中继续当前会话',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /desktop \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'diagram',
    description: '架构图自动生成（C4/依赖/序列/类图，Mermaid/Graphviz/ASCII）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /diagram \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'diff',
    description: '查看未提交的更改和每次对话的差异',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /diff \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'diff-mode',
    description: '并排差异视图 - 多模式/评论/书签/历史/导出/统计/三向合并',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /diff-mode \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'diff-review',
    description: '交互式 Diff 审查 - 逐 hunk 审查/暂存/比较 git diff',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /diff-review \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'sandbox-docker',
    description: 'Docker 沙箱隔离：在容器内运行 Agent（OpenHands/Devin 风格）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /sandbox-docker \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'doctor',
    description: '诊断并验证您的 Claude Code 安装和设置',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /doctor \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'documentation-index',
    description: '获取 Claude Code 文档索引，发现所有可用页面',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /documentation-index \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'doge-config',
    description: '管理 doge 配置（API 地址、密钥、模型等）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /doge-config \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'duplicate',
    description: '重复代码检测 - 列表/文件/比例/配置/历史/导出/建议',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /duplicate \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'eco',
    description: 'Bash 输出压缩模式：减少 token 消耗（on/off/status）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /eco \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'effort',
    description: '设置模型使用时的努力级别',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /effort \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'env-diff',
    description: '环境变量对比 - 比较/缺失/多余/共享/模板/验证/同步/导出/导入',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /env-diff \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'errors',
    description: '错误监控 - 扫描/追踪/自动修复/模式/导出',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /errors \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'event-stream',
    description: '连接并接收 Server-Sent Events (SSE) 事件流',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /event-stream \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'ship',
    description: '完整部署工作流',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /ship \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'excel',
    description: 'Excel 文件读取与转换：read/info/sheets/csv',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /excel \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'export',
    description: '将当前对话导出到文件或剪贴板',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /export \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'extra-usage',
    description: '配置额外用量以在达到限制时继续工作',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /extra-usage \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'feedback',
    description: '提交关于 Claude Code 的反馈',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /feedback \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'file-history',
    description: '文件历史 - 变更/对比/恢复/作者/趋势',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /file-history \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'file-search',
    description: '文件搜索 - 正则/搜索/统计/文件/替换/grep/rg/上下文',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /file-search \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'file-watcher',
    description: '监听文件变化并执行相应操作',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /file-watcher \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'files',
    description: '列出当前上下文中的所有文件',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /files \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'Prettier',
    description: '格式化器 - 检查/修复/全部/差异/统计/历史/配置/安装/语言',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /Prettier \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'focus',
    description: '切换焦点模式 — 仅显示最终回复，隐藏中间工具调用过程',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /focus \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'fork',
    description: '分支子代理 — 在后台派生子代理执行任务，完成后通知',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /fork \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'fuck',
    description: '清除本地 Claude Code 认证、自定义 API 配置和会话历史',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /fuck \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'game',
    description: '玩一个简单的猜数字游戏',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /game \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'getting-started',
    description: '快速入门 Claude Code 的交互式指南',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /getting-started \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'git-graph',
    description: 'Git 图表 - 统计/作者/时间线/热门文件/波动/活跃度/连续提交/洞察',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /git-graph \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'glossary',
    description: '显示术语表和定义',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /glossary \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'good-claude',
    description: '给 Claude 发送正面反馈，帮助改进 AI 能力',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /good-claude \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'graph',
    description: '依赖关系图 - mermaid/dot/html/stats/circular/orphans/tree/save',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /graph \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'graphql',
    description: '执行 GraphQL 查询',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /graphql \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'grep',
    description: '搜索 - 搜索/上下文/正则/统计/仅文件/配置/历史',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /grep \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'heapdump',
    description: '将 JS 堆转储到桌面',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /heapdump \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'hooks',
    description: '查看工具事件挂钩配置',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /hooks \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'security',
    description: '安全头部 + 保护敏感文件',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /security \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'http',
    description: '发送 HTTP 请求并查看响应结果',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /http \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'ide',
    description: '管理 IDE 集成并显示状态',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /ide \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'image',
    description: '图片信息查看与管理：info/ls/convert',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /image \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'import-map',
    description: '导入映射图 - stats/circular/orphans/external/dot/mermaid/depth/save',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /import-map \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'imports',
    description: 'Import management - analyze/unused/organize/sort/convert/circular/graph',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /imports \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'insights',
    description: '生成分析你的 Claude Code 会话模式的报告',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /insights \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'install-feishu-app',
    description: '安装飞书应用以启用远程控制',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /install-feishu-app \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'install-github-app',
    description: '为仓库设置 Claude GitHub Actions',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /install-github-app \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'install-slack-app',
    description: '安装 Claude Slack 应用',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /install-slack-app \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'issue',
    description: '修复 GitHub Issue #${issue.number}: ${issue.title}',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /issue \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'k8s',
    description: 'Kubernetes 集群管理：pods/deploy/svc/get/describe/logs',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /k8s \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'keybindings',
    description: '打开或创建按键绑定配置文件',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /keybindings \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'less-permission-prompts',
    description: '扫描会话，生成权限白名单',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /less-permission-prompts \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'license',
    description: 'License - list/check/audit/report/generate/templates/allow/restrict/history',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /license \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'lighthouse',
    description: 'Lighthouse - run/report/compare/trend/history/budgets/export/categories',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /lighthouse \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'logger',
    description: '查看和配置日志记录级别',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /logger \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'logout',
    description: '退出您的 Anthropic 账户',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /logout \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'logs',
    description: '日志查看器 - tail/follow/search/filter/stats/pm2/docker/nginx',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /logs \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'mcp',
    description: '管理 MCP 服务器',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /mcp \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'mcp-config',
    description: '管理 MCP 服务器配置',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /mcp-config \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'mcp-discovery',
    description: 'MCP Server 发现 - 分析项目并推荐合适的 MCP servers',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /mcp-discovery \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'mcp-tool-search',
    description: '搜索 MCP 工具',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /mcp-tool-search \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'memory-bank',
    description: '项目 Memory Bank - 结构化知识管理（上下文/决策/经验/参考）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /memory-bank \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'memory-monitor',
    description: '内存监控工具，实时监控应用内存使用情况',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /memory-monitor \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'memory-search',
    description: '跨会话记忆搜索 - 高级过滤/正则/知识图谱/导出/统计',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /memory-search \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'metrics',
    description: '显示系统性能指标和统计数据',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /metrics \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'mobile',
    description: '显示二维码以下载 Claude 移动应用',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /mobile \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'mock-limits',
    description: '模拟 API 速率限制，用于开发与测试',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /mock-limits \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'monitor',
    description: '启动实时监控界面',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /monitor \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'nginx',
    description: 'Nginx 管理：status/start/stop/reload/test/sites/logs/config',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /nginx \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'notebook',
    description: '记事本 - 创建、查看、搜索和管理笔记',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /notebook \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'notes',
    description: '快速笔记 - 列表/添加/查看/编辑/删除/搜索/置顶/标签/导出/导入',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /notes \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'notify',
    description: '通知 - 规则/事件/历史/Webhook',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /notify \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'oauth-refresh',
    description: '刷新 OAuth 认证令牌',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /oauth-refresh \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'outdated',
    description: '过期依赖 - 大版本/小版本/补丁/安全/安全更新/全部更新/统计/历史',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /outdated \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'output-style',
    description: '已弃用：使用 /config 更改输出样式',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /output-style \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'pdf',
    description: 'PDF 文件读取与信息查看：read/info',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /pdf \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'peers',
    description: '查看同伴会话 — 列出团队成员、会话状态，或向队友发送消息',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /peers \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'performance',
    description: '${f.lines} lines',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /performance \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'performance-profiler',
    description: '性能分析工具，检测应用性能瓶颈',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /performance-profiler \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'permissions',
    description: '管理允许和拒绝工具权限规则',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /permissions \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'plan',
    description: '启用计划模式或查看当前会话计划',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /plan \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'plan-mode',
    description: '切换计划模式，在生成前先制定详细计划',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /plan-mode \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'plugin',
    description: '管理 Claude Code 插件',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /plugin \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'ports',
    description: '端口管理 - 列出/检查/终止/查找/监控',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /ports \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'powerup',
    description: '与 Claude Code 交互式学习新功能',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /powerup \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'pr-review',
    description: 'GitHub PR 审查 - 摘要/问题/清单/批准/评论',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /pr-review \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'pr-comments',
    description: '获取 GitHub 拉取请求的评论',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /pr-comments \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'privacy-settings',
    description: '查看和更新您的隐私设置',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /privacy-settings \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'proactive',
    description: '主动建议 - 扫描问题与改进/自动修复/忽略规则/趋势报告',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /proactive \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'project-purge',
    description: '删除项目的所有 Claude Code 状态',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /project-purge \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'project-stats',
    description: '项目统计 - 全部/文件/行数/git/贡献者/活动/大小/健康/导出',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /project-stats \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'prompt-diff',
    description: '显示系统提示词变更差异（设置修改前后的对比）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /prompt-diff \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'queue',
    description: '管理消息队列',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /queue \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'rag',
    description: 'RAG 本地知识库 - 索引文件夹和搜索',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /rag \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'rate-limit-options',
    description: '显示达到速率限制时的选项',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /rate-limit-options \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'readme',
    description: 'README - 生成/预览/保存/徽章/目录/检查/更新/章节',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /readme \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'redis',
    description: 'Redis 缓存操作：get/set/del/keys/ping/info/flush',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /redis \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'reflect',
    description: '反思当前会话状态和项目环境，提供改进建议',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /reflect \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'release',
    description: '发布管理 - 版本提升/说明/变更日志/标签/创建/发布',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /release \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'release-notes',
    description: '查看发布说明',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /release-notes \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'reload-plugins',
    description: '在当前会话中激活待处理的插件更改',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /reload-plugins \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'remote-env',
    description: '配置远程会话的默认远程环境',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /remote-env \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'web-setup',
    description: '在网页上设置 Claude Code（需要连接您的 GitHub 账户）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /web-setup \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'remove-model',
    description: '从已保存的模型列表中移除自定义模型',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /remove-model \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'rename',
    description: '重命名当前对话',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /rename \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'resume',
    description: '恢复之前的对话',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /resume \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'rewind',
    description: '将代码和/或对话恢复到先前的状态',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /rewind \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'default',
    description: '标准模板 - 允许所有，拦截私有路径',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /default \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'rstk',
    description: '重置 token 统计数据（清空所有已累计的 token 数值）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /rstk \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'rules',
    description: '持久化规则管理 - 管理跨会话的 AI 交互指令',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /rules \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'scaffold',
    description: '由 doge scaffold 生成',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /scaffold \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'schedule',
    description: '管理定时调度任务',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /schedule \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'security-audit',
    description: '静态安全审计工具 - 检测 SQL 注入、XSS、硬编码密钥等',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /security-audit \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'session',
    description: '显示远程会话 URL 和二维码',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /session \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'share',
    description: '分享当前会话到团队或生成可分享链接',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /share \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'shell',
    description: '在一个新的 shell 中执行命令',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /shell \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'sitemap',
    description: 'Sitemap - generate/scan/preview/robots/validate/submit/config/base-url',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /sitemap \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'skills',
    description: '列出可用的技能',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /skills \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'skills-i18n',
    description: '检查并修复 SKILL.md 汉化问题。用法: /skills-i18n [check|fix|force|restore]',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /skills-i18n \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'snapshot',
    description: '创建或恢复会话快照',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /snapshot \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'snippet',
    description: '代码片段管理 - 保存、搜索、使用和分享代码片段',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /snippet \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'ssh',
    description: 'SSH 管理器 - 列出/添加/连接/执行/复制/密钥/测试/日志',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /ssh \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'status',
    description: '显示 Claude Code 状态，包括版本、模型、账户、API 连接性和工具状态',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /status \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'stickers',
    description: '订购 Claude Code 贴纸',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /stickers \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'stock',
    description: '股票行情 - 实时行情/技术分析/自选股/投资组合/筛选/图表/提醒',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /stock \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'summary',
    description: '总结当前会话内容和关键决策',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /summary \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'swe-fix',
    description: 'SWE-bench 风格测试驱动修复：定位→修复→验证闭环（吸收自 Agentless）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /swe-fix \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'symbol',
    description: '符号导航（高级） - 查找/定义/重命名/预览/提取/内联/用法/图谱/备份/恢复',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /symbol \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'tag',
    description: '为当前会话切换可搜索标签',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /tag \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'task',
    description: '快速创建简单任务（简化版任务创建）',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /task \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'task-create',
    description: '任务管理: 创建|list|done|delete|pause|resume|cancel|subtask|info|start|clear-done',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /task-create \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'tasks',
    description: '列出和管理后台任务',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /tasks \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'tc',
    description: '测试覆盖率 - 运行/报告/显示/缺失/趋势/徽章/HTML/JSON/阈值',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /tc \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'team',
    description: '团队管理命令',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /team \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'team-onboarding',
    description: '为团队成员生成 Claude Code 快速上手指南',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /team-onboarding \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'react-ts',
    description: 'React + TypeScript + Vite starter',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /react-ts \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'terminal',
    description: '打开新终端标签页',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /terminal \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'test-run',
    description: '测试运行器 - 运行/监视/覆盖率/调试/快照/耗时/框架',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /test-run \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'theme',
    description: '更改主题',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /theme \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'think-back',
    description: '您的 2025 Claude Code 年度回顾',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /think-back \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'thinkback-play',
    description: '播放 thinkback 动画',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /thinkback-play \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'todo',
    description: '任务管理工具 - 创建/查看/完成/暂停/恢复/搜索/导出',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /todo \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'translate',
    description: '翻译工具 - 文本/文件/批量翻译',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /translate \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'tui',
    description: '切换到闪烁免模式 (flicker-free) 的全屏终端界面',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /tui \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'updateapikey',
    description: '从 GitHub 更新免费 API Key 到 freeN 配置文件中',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /updateapikey \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'updateskills',
    description: '从素材库安装/更新技能 — /updateskills all / source:<name> / conflict',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /updateskills \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'upgrade',
    description: '升级到 Max 以获得更高的速率限制和更多 Opus',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /upgrade \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'usage',
    description: '显示计划用量限制',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /usage \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'vim',
    description: '在 Vim 和普通编辑模式之间切换',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /vim \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'voice',
    description: '切换语音模式',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /voice \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'watch',
    description: '文件监视 - 快照/检查/扫描/状态/日志/清空/配置/自动操作',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /watch \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'websocket',
    description: '通过 WebSocket 连接与服务器实时通信',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /websocket \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'api-doc',
    description: '项目 Wiki 生成 - 架构/API/文档/变更日志/依赖图/模板/搜索',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /api-doc \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
commandRegistry.register({
    name: 'workflows',
    description: '管理工作流脚本 — 创建、列出、运行和删除可复用任务序列',
    execute: function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    success: true,
                    needsAgent: true,
                    output: "[AI \u4EE3\u7406] /workflows \u547D\u4EE4\u9700\u8981 AI \u6267\u884C",
                }];
        });
    }); },
});
// Total AI agent commands: 210
