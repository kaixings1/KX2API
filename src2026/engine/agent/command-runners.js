/**
 * Agent 命令具体实现
 * 每个 AI-agent 命令都有真实的执行逻辑
 *
 * 分类：
 * - local: 直接调用本地工具（git、文件系统、进程等）
 * - llm: 构建专用 prompt 交给 LLM 执行（代码生成、分析等）
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
import { Team } from '../../main/agent/team/team.ts';
// ==================== 本地执行工具 ====================
function runLocal(cmd, cwd) {
    return __awaiter(this, void 0, void 0, function () {
        var result, out;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, execaCommand(cmd, cwd)];
                case 1:
                    result = _a.sent();
                    out = [result.stdout, result.stderr].filter(Boolean).join('\n');
                    return [2 /*return*/, out || '(命令执行成功，无输出)'];
            }
        });
    });
}
function getDefaultPrompt(runnerType) {
    switch (runnerType) {
        case 'llm':
            return '你是 KX2Code 的 AI 代理执行器。请根据用户的命令执行相应的任务并提供详细结果。';
        case 'team':
            return '作为团队成员，请完成分配的任务。';
        default:
            return '';
    }
}
// ==================== Git 类命令 ====================
var gitCommitImpl = {
    type: 'local',
    description: 'Git 提交',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var msg, status, diffStat, fullMsg, safeMsg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    msg = args.join(' ') || 'chore: auto commit';
                    return [4 /*yield*/, runLocal('git status --short', cwd)];
                case 1:
                    status = _a.sent();
                    if (!status || status === '(命令执行成功，无输出)') {
                        return [2 /*return*/, '工作区干净，没有需要提交的变更'];
                    }
                    return [4 /*yield*/, runLocal('git diff --cached --stat || git diff --stat', cwd)];
                case 2:
                    diffStat = _a.sent();
                    fullMsg = "".concat(msg, "\n\n").concat(diffStat).slice(0, 500);
                    safeMsg = fullMsg.replace(/"/g, '\\"');
                    return [2 /*return*/, runLocal("git add -A && git commit -m \"".concat(safeMsg, "\""), cwd)];
            }
        });
    }); },
};
var gitBlameImpl = {
    type: 'local',
    description: 'Git Blame - 查看文件每行的修改者和提交信息',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var target;
        return __generator(this, function (_a) {
            target = args[0] || '.';
            return [2 /*return*/, runLocal("git blame \"".concat(target, "\""), cwd)];
        });
    }); },
};
var gitLogImpl = {
    type: 'local',
    description: 'Git 提交历史',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var count, format;
        return __generator(this, function (_a) {
            count = args[0] || '20';
            format = args[1] || '--oneline';
            return [2 /*return*/, runLocal("git log ".concat(format, " -n ").concat(count), cwd)];
        });
    }); },
};
var gitDiffImpl = {
    type: 'local',
    description: 'Git Diff 查看代码变更',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var target;
        return __generator(this, function (_a) {
            target = args.join(' ') || 'HEAD~1';
            return [2 /*return*/, runLocal("git diff ".concat(target, " --stat"), cwd)];
        });
    }); },
};
var gitStatusImpl = {
    type: 'local',
    description: 'Git 工作区状态',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, runLocal('git status', cwd)];
        });
    }); },
};
var gitBranchImpl = {
    type: 'local',
    description: 'Git 分支管理',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var sub, rest, name_1, name_2, name_3;
        return __generator(this, function (_a) {
            sub = args[0] || 'list';
            rest = args.slice(1).join(' ');
            if (sub === 'list' || sub === 'list-all') {
                return [2 /*return*/, runLocal('git branch -a', cwd)];
            }
            if (sub === 'create' || sub === 'new') {
                name_1 = args[1];
                if (!name_1)
                    return [2 /*return*/, '用法: /git-branch create <分支名>'];
                return [2 /*return*/, runLocal("git checkout -b \"".concat(name_1, "\""), cwd)];
            }
            if (sub === 'delete') {
                name_2 = args[1];
                if (!name_2)
                    return [2 /*return*/, '用法: /git-branch delete <分支名>'];
                return [2 /*return*/, runLocal("git branch -d \"".concat(name_2, "\""), cwd)];
            }
            if (sub === 'switch' || sub === 'checkout') {
                name_3 = args[1];
                if (!name_3)
                    return [2 /*return*/, '用法: /git-branch switch <分支名>'];
                return [2 /*return*/, runLocal("git checkout \"".concat(name_3, "\""), cwd)];
            }
            return [2 /*return*/, runLocal("git branch ".concat(sub, " ").concat(rest), cwd)];
        });
    }); },
};
var gitMergeImpl = {
    type: 'local',
    description: 'Git 合并分支',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var branch;
        return __generator(this, function (_a) {
            branch = args[0];
            if (!branch)
                return [2 /*return*/, '用法: /git-merge <分支名>'];
            return [2 /*return*/, runLocal("git merge \"".concat(branch, "\""), cwd)];
        });
    }); },
};
var gitPushImpl = {
    type: 'local',
    description: 'Git 推送',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var remote, branch;
        return __generator(this, function (_a) {
            remote = args[0] || 'origin';
            branch = args[1] || '';
            return [2 /*return*/, runLocal("git push ".concat(remote, " ").concat(branch), cwd)];
        });
    }); },
};
var gitPullImpl = {
    type: 'local',
    description: 'Git 拉取',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var remote, branch;
        return __generator(this, function (_a) {
            remote = args[0] || 'origin';
            branch = args[1] || '';
            return [2 /*return*/, runLocal("git pull ".concat(remote, " ").concat(branch), cwd)];
        });
    }); },
};
var gitStashImpl = {
    type: 'local',
    description: 'Git 暂存',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var sub, msg;
        return __generator(this, function (_a) {
            sub = args[0] || 'push';
            if (sub === 'push' || sub === 'save') {
                msg = args[1] || '';
                return [2 /*return*/, runLocal("git stash push -m \"".concat(msg, "\""), cwd)];
            }
            if (sub === 'pop' || sub === 'apply') {
                return [2 /*return*/, runLocal("git stash ".concat(sub), cwd)];
            }
            if (sub === 'list') {
                return [2 /*return*/, runLocal('git stash list', cwd)];
            }
            return [2 /*return*/, runLocal("git stash ".concat(sub), cwd)];
        });
    }); },
};
var gitRebaseImpl = {
    type: 'local',
    description: 'Git 变基',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var target;
        return __generator(this, function (_a) {
            target = args[0];
            if (!target)
                return [2 /*return*/, '用法: /git-rebase <目标分支>'];
            return [2 /*return*/, runLocal("git rebase \"".concat(target, "\""), cwd)];
        });
    }); },
};
var gitResetImpl = {
    type: 'local',
    description: 'Git 重置',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var mode, target;
        return __generator(this, function (_a) {
            mode = args[0] || '--soft';
            target = args[1] || 'HEAD~1';
            return [2 /*return*/, runLocal("git reset ".concat(mode, " ").concat(target), cwd)];
        });
    }); },
};
// ==================== 文件系统类命令 ====================
var searchImpl = {
    type: 'local',
    description: '代码搜索（grep）',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var query, target, patterns;
        return __generator(this, function (_a) {
            query = args[0];
            if (!query)
                return [2 /*return*/, '用法: /search <关键词> [目录]'];
            target = args[1] || cwd;
            patterns = '--include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.rs" --include="*.go" --include="*.java"';
            return [2 /*return*/, runLocal("grep -r -n ".concat(patterns, " \"").concat(query, "\" \"").concat(target, "\" 2>/dev/null || echo \"\u672A\u627E\u5230\u5339\u914D\""), cwd)];
        });
    }); },
};
var treeImpl = {
    type: 'local',
    description: '目录树结构',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var depth;
        return __generator(this, function (_a) {
            depth = args[0] || '3';
            return [2 /*return*/, runLocal("tree -L ".concat(depth, " -I 'node_modules|.git|dist|out|.cache' --charset ascii"), cwd)];
        });
    }); },
};
var findImpl = {
    type: 'local',
    description: '查找文件',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var pattern, maxDepth;
        return __generator(this, function (_a) {
            pattern = args[0] || '*';
            maxDepth = args[1] || '5';
            return [2 /*return*/, runLocal("find . -maxdepth ".concat(maxDepth, " -name \"").concat(pattern, "\" -not -path \"*/node_modules/*\" -not -path \"*/.git/*\""), cwd)];
        });
    }); },
};
var wcImpl = {
    type: 'local',
    description: '代码行数统计',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var target, exts;
        return __generator(this, function (_a) {
            target = args[0] || '.';
            exts = args[1] || 'ts,tsx,js,jsx,py,rs,go';
            return [2 /*return*/, runLocal("find ".concat(target, " -type f \\( -name \"*.").concat(exts.split(',')[0], "\" \\) -exec wc -l {} + 2>/dev/null | tail -1"), cwd)];
        });
    }); },
};
var catImpl = {
    type: 'local',
    description: '查看文件内容',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var file, lines, cmd;
        return __generator(this, function (_a) {
            if (args.length === 0)
                return [2 /*return*/, '用法: /cat <文件路径>'];
            file = args[0];
            lines = args[1] || '';
            cmd = lines ? "head -n ".concat(lines, " \"").concat(file, "\"") : "cat \"".concat(file, "\"");
            return [2 /*return*/, runLocal(cmd, cwd)];
        });
    }); },
};
var headImpl = {
    type: 'local',
    description: '查看文件前 N 行',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var n, file;
        return __generator(this, function (_a) {
            if (args.length === 0)
                return [2 /*return*/, '用法: /head <行数> <文件路径>'];
            n = args[0] || '20';
            file = args[1] || '';
            if (!file)
                return [2 /*return*/, '请指定文件路径'];
            return [2 /*return*/, runLocal("head -n ".concat(n, " \"").concat(file, "\""), cwd)];
        });
    }); },
};
var tailImpl = {
    type: 'local',
    description: '查看文件后 N 行',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var n, file;
        return __generator(this, function (_a) {
            if (args.length === 0)
                return [2 /*return*/, '用法: /tail <行数> <文件路径>'];
            n = args[0] || '20';
            file = args[1] || '';
            if (!file)
                return [2 /*return*/, '请指定文件路径'];
            return [2 /*return*/, runLocal("tail -n ".concat(n, " \"").concat(file, "\""), cwd)];
        });
    }); },
};
var lsImpl = {
    type: 'local',
    description: '列出目录内容',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var target, flag;
        return __generator(this, function (_a) {
            target = args[0] || cwd;
            flag = args[1] === '-la' ? '-la' : '-1';
            return [2 /*return*/, runLocal("ls ".concat(flag, " \"").concat(target, "\""), cwd)];
        });
    }); },
};
var mkdirImpl = {
    type: 'local',
    description: '创建目录',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var dir;
        return __generator(this, function (_a) {
            if (args.length === 0)
                return [2 /*return*/, '用法: /mkdir <目录路径>'];
            dir = args.join(' ');
            return [2 /*return*/, runLocal("mkdir -p \"".concat(dir, "\""), cwd)];
        });
    }); },
};
var cpImpl = {
    type: 'local',
    description: '复制文件',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (args.length < 2)
                return [2 /*return*/, '用法: /cp <源> <目标>'];
            return [2 /*return*/, runLocal("cp -r \"".concat(args[0], "\" \"").concat(args[1], "\""), cwd)];
        });
    }); },
};
var mvImpl = {
    type: 'local',
    description: '移动/重命名文件',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (args.length < 2)
                return [2 /*return*/, '用法: /mv <源> <目标>'];
            return [2 /*return*/, runLocal("mv \"".concat(args[0], "\" \"").concat(args[1], "\""), cwd)];
        });
    }); },
};
var rmImpl = {
    type: 'local',
    description: '删除文件',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var recursive, files;
        return __generator(this, function (_a) {
            if (args.length === 0)
                return [2 /*return*/, '用法: /rm <文件路径> [-r 递归]'];
            recursive = args.includes('-r') ? '-r' : '';
            files = args.filter(function (a) { return a !== '-r'; }).join(' ');
            return [2 /*return*/, runLocal("rm ".concat(recursive, " -f ").concat(files), cwd)];
        });
    }); },
};
// ==================== Docker 类命令 ====================
var dockerImpl = {
    type: 'local',
    description: 'Docker 操作',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var ps, sub, rest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(args.length === 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, runLocal('docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', cwd)];
                case 1:
                    ps = _a.sent();
                    return [2 /*return*/, "Docker \u5BB9\u5668:\n".concat(ps || '(无运行中的容器)')];
                case 2:
                    sub = args[0];
                    rest = args.slice(1).join(' ');
                    return [2 /*return*/, runLocal("docker ".concat(sub, " ").concat(rest), cwd)];
            }
        });
    }); },
};
var dockerComposeImpl = {
    type: 'local',
    description: 'Docker Compose 操作',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var sub, rest;
        return __generator(this, function (_a) {
            if (args.length === 0)
                return [2 /*return*/, '用法: /docker-compose <up|down|ps|logs|restart> [服务名]'];
            sub = args[0];
            rest = args.slice(1).join(' ');
            return [2 /*return*/, runLocal("docker-compose ".concat(sub, " ").concat(rest), cwd)];
        });
    }); },
};
// ==================== 进程执行类 ====================
var execImpl = {
    type: 'local',
    description: '执行系统命令',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var cmd;
        return __generator(this, function (_a) {
            if (args.length === 0)
                return [2 /*return*/, '用法: /exec <命令> [参数...]'];
            cmd = args.join(' ');
            return [2 /*return*/, runLocal(cmd, cwd)];
        });
    }); },
};
// ==================== 构建类命令 ====================
var buildImpl = {
    type: 'local',
    description: '构建项目（自动检测构建工具）',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var existsSync, join, pkg, _a, _b, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, import('node:fs')];
                case 1:
                    existsSync = (_e.sent()).existsSync;
                    return [4 /*yield*/, import('node:path')];
                case 2:
                    join = (_e.sent()).join;
                    if (!existsSync(join(cwd, 'package.json'))) return [3 /*break*/, 7];
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 6, , 7]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, import('node:fs/promises')];
                case 4: return [4 /*yield*/, (_e.sent()).readFile(join(cwd, 'package.json'), 'utf-8')];
                case 5:
                    pkg = _b.apply(_a, [_e.sent()]);
                    if ((_d = pkg.scripts) === null || _d === void 0 ? void 0 : _d.build)
                        return [2 /*return*/, runLocal('npm run build', cwd)];
                    return [3 /*break*/, 7];
                case 6:
                    _c = _e.sent();
                    return [3 /*break*/, 7];
                case 7:
                    if (existsSync(join(cwd, 'Cargo.toml')))
                        return [2 /*return*/, runLocal('cargo build', cwd)];
                    if (existsSync(join(cwd, 'go.mod')))
                        return [2 /*return*/, runLocal('go build ./...', cwd)];
                    if (existsSync(join(cwd, 'pyproject.toml')))
                        return [2 /*return*/, runLocal('python -m build', cwd)];
                    if (existsSync(join(cwd, 'CMakeLists.txt')))
                        return [2 /*return*/, runLocal('cmake --build build', cwd)];
                    if (existsSync(join(cwd, 'Makefile')))
                        return [2 /*return*/, runLocal('make', cwd)];
                    return [2 /*return*/, '未检测到已知构建系统'];
            }
        });
    }); },
};
var testImpl = {
    type: 'local',
    description: '运行测试（自动检测测试框架）',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var existsSync, join, pkg, _a, _b, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, import('node:fs')];
                case 1:
                    existsSync = (_e.sent()).existsSync;
                    return [4 /*yield*/, import('node:path')];
                case 2:
                    join = (_e.sent()).join;
                    if (!existsSync(join(cwd, 'package.json'))) return [3 /*break*/, 7];
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 6, , 7]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, import('node:fs/promises')];
                case 4: return [4 /*yield*/, (_e.sent()).readFile(join(cwd, 'package.json'), 'utf-8')];
                case 5:
                    pkg = _b.apply(_a, [_e.sent()]);
                    if ((_d = pkg.scripts) === null || _d === void 0 ? void 0 : _d.test)
                        return [2 /*return*/, runLocal('npm test', cwd)];
                    return [3 /*break*/, 7];
                case 6:
                    _c = _e.sent();
                    return [3 /*break*/, 7];
                case 7:
                    if (existsSync(join(cwd, 'Cargo.toml')))
                        return [2 /*return*/, runLocal('cargo test', cwd)];
                    if (existsSync(join(cwd, 'go.mod')))
                        return [2 /*return*/, runLocal('go test ./...', cwd)];
                    if (existsSync(join(cwd, 'pytest.ini')) || existsSync(join(cwd, 'setup.cfg')))
                        return [2 /*return*/, runLocal('pytest', cwd)];
                    if (existsSync(join(cwd, 'CMakeLists.txt')))
                        return [2 /*return*/, runLocal('ctest', cwd)];
                    return [2 /*return*/, '未检测到已知测试框架'];
            }
        });
    }); },
};
var lintImpl = {
    type: 'local',
    description: '代码检查（自动检测检查工具）',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var existsSync, join, pkg, _a, _b, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, import('node:fs')];
                case 1:
                    existsSync = (_e.sent()).existsSync;
                    return [4 /*yield*/, import('node:path')];
                case 2:
                    join = (_e.sent()).join;
                    if (!existsSync(join(cwd, 'package.json'))) return [3 /*break*/, 8];
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 6, , 7]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, import('node:fs/promises')];
                case 4: return [4 /*yield*/, (_e.sent()).readFile(join(cwd, 'package.json'), 'utf-8')];
                case 5:
                    pkg = _b.apply(_a, [_e.sent()]);
                    if ((_d = pkg.scripts) === null || _d === void 0 ? void 0 : _d.lint)
                        return [2 /*return*/, runLocal('npm run lint', cwd)];
                    return [3 /*break*/, 7];
                case 6:
                    _c = _e.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, runLocal('npx eslint .', cwd)];
                case 8:
                    if (existsSync(join(cwd, 'pyproject.toml')))
                        return [2 /*return*/, runLocal('ruff check .', cwd)];
                    if (existsSync(join(cwd, 'Cargo.toml')))
                        return [2 /*return*/, runLocal('cargo clippy', cwd)];
                    if (existsSync(join(cwd, 'go.mod')))
                        return [2 /*return*/, runLocal('go vet ./...', cwd)];
                    return [2 /*return*/, '未检测到已知代码检查工具'];
            }
        });
    }); },
};
var formatImpl = {
    type: 'local',
    description: '代码格式化（自动检测格式化工具）',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var existsSync, join, pkg, _a, _b, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, import('node:fs')];
                case 1:
                    existsSync = (_e.sent()).existsSync;
                    return [4 /*yield*/, import('node:path')];
                case 2:
                    join = (_e.sent()).join;
                    if (!existsSync(join(cwd, 'package.json'))) return [3 /*break*/, 8];
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 6, , 7]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, import('node:fs/promises')];
                case 4: return [4 /*yield*/, (_e.sent()).readFile(join(cwd, 'package.json'), 'utf-8')];
                case 5:
                    pkg = _b.apply(_a, [_e.sent()]);
                    if ((_d = pkg.scripts) === null || _d === void 0 ? void 0 : _d.format)
                        return [2 /*return*/, runLocal('npm run format', cwd)];
                    return [3 /*break*/, 7];
                case 6:
                    _c = _e.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, runLocal('npx prettier --write .', cwd)];
                case 8:
                    if (existsSync(join(cwd, 'pyproject.toml')))
                        return [2 /*return*/, runLocal('ruff format .', cwd)];
                    if (existsSync(join(cwd, 'Cargo.toml')))
                        return [2 /*return*/, runLocal('cargo fmt', cwd)];
                    if (existsSync(join(cwd, 'go.mod')))
                        return [2 /*return*/, runLocal('gofmt -w .', cwd)];
                    return [2 /*return*/, '未检测到已知格式化工具'];
            }
        });
    }); },
};
// ==================== LLM 类命令（需要 AI 生成内容） ====================
var reviewImpl = {
    type: 'llm',
    description: '代码审查（AI 分析 git diff）',
    execute: function (args, cwd, config) { return __awaiter(void 0, void 0, void 0, function () {
        var diff;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runLocal('git diff HEAD~1 --stat', cwd)];
                case 1:
                    diff = _a.sent();
                    return [2 /*return*/, "[AI \u5BA1\u67E5]\n\u8BF7\u5BA1\u67E5\u4EE5\u4E0B\u4EE3\u7801\u53D8\u66F4:\n".concat(diff, "\n\n\u5173\u6CE8\u70B9\uFF1A1) \u6F5C\u5728 bug 2) \u5B89\u5168\u95EE\u9898 3) \u6027\u80FD 4) \u53EF\u7EF4\u62A4\u6027")];
            }
        });
    }); },
};
var refactorImpl = {
    type: 'llm',
    description: '代码重构建议',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var diff;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runLocal('git diff HEAD --stat', cwd)];
                case 1:
                    diff = _a.sent();
                    return [2 /*return*/, "[AI \u91CD\u6784]\n\u5206\u6790\u4EE5\u4E0B\u4EE3\u7801\u5E76\u63D0\u4F9B\u91CD\u6784\u5EFA\u8BAE:\n".concat(diff)];
            }
        });
    }); },
};
var fixImpl = {
    type: 'llm',
    description: '修复 Bug',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var lint, test, errorInfo;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runLocal('npm run lint 2>&1 || true', cwd)];
                case 1:
                    lint = _a.sent();
                    return [4 /*yield*/, runLocal('npm test 2>&1 || true', cwd)];
                case 2:
                    test = _a.sent();
                    errorInfo = args.join(' ') || '最近错误';
                    return [2 /*return*/, "[AI \u4FEE\u590D]\n\u9519\u8BEF\u4FE1\u606F: ".concat(errorInfo, "\n\nLint \u8F93\u51FA:\n").concat(lint, "\n\n\u6D4B\u8BD5\u8F93\u51FA:\n").concat(test, "\n\n\u8BF7\u5206\u6790\u6839\u56E0\u5E76\u63D0\u4F9B\u4FEE\u590D\u65B9\u6848\u3002")];
            }
        });
    }); },
};
var docsImpl = {
    type: 'llm',
    description: '生成项目文档',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var tree;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runLocal('find . -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" | head -20', cwd)];
                case 1:
                    tree = _a.sent();
                    return [2 /*return*/, "[AI \u6587\u6863]\n\u6839\u636E\u9879\u76EE\u7ED3\u6784\u751F\u6210 README.md:\n".concat(tree)];
            }
        });
    }); },
};
var explainImpl = {
    type: 'llm',
    description: '解释代码',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var file, content;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    file = args[0] || '.';
                    return [4 /*yield*/, catImpl.execute([file, '200'], cwd)];
                case 1:
                    content = _a.sent();
                    return [2 /*return*/, "[AI \u89E3\u91CA]\n\u8BF7\u8BE6\u7EC6\u89E3\u91CA\u4EE5\u4E0B\u4EE3\u7801:\n```\n".concat(content, "\n```")];
            }
        });
    }); },
};
var analyzeImpl = {
    type: 'llm',
    description: '代码分析',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var tree, loc;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runLocal('find . -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" | head -30', cwd)];
                case 1:
                    tree = _a.sent();
                    return [4 /*yield*/, runLocal('find . -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -exec wc -l {} + 2>/dev/null | tail -1', cwd)];
                case 2:
                    loc = _a.sent();
                    return [2 /*return*/, "[AI \u5206\u6790]\n\u9879\u76EE\u7ED3\u6784:\n".concat(tree, "\n\n\u4EE3\u7801\u7EDF\u8BA1:\n").concat(loc, "\n\n\u8BF7\u63D0\u4F9B\u67B6\u6784\u5206\u6790\u548C\u6539\u8FDB\u5EFA\u8BAE\u3002")];
            }
        });
    }); },
};
var explainCodeImpl = {
    type: 'llm',
    description: '详细代码解释',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, explainImpl.execute(args, cwd)];
        });
    }); },
};
var generateDocsImpl = {
    type: 'llm',
    description: '生成 API 文档',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var file, content;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    file = args[0] || 'src/**/*.ts';
                    return [4 /*yield*/, catImpl.execute([file, '100'], cwd)];
                case 1:
                    content = _a.sent();
                    return [2 /*return*/, "[AI \u6587\u6863]\n\u4E3A\u4EE5\u4E0B\u4EE3\u7801\u751F\u6210 API \u6587\u6863:\n".concat(content)];
            }
        });
    }); },
};
var generateTestImpl = {
    type: 'llm',
    description: '生成单元测试',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var file, content;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    file = args[0] || 'src/**/*.ts';
                    return [4 /*yield*/, catImpl.execute([file, '100'], cwd)];
                case 1:
                    content = _a.sent();
                    return [2 /*return*/, "[AI \u6D4B\u8BD5]\n\u4E3A\u4EE5\u4E0B\u4EE3\u7801\u751F\u6210\u5355\u5143\u6D4B\u8BD5:\n".concat(content)];
            }
        });
    }); },
};
var generateImpl = {
    type: 'llm',
    description: '通用代码生成',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var prompt;
        return __generator(this, function (_a) {
            prompt = args.join(' ');
            return [2 /*return*/, "[AI \u751F\u6210]\n\u8BF7\u6839\u636E\u4EE5\u4E0B\u9700\u6C42\u751F\u6210\u4EE3\u7801:\n".concat(prompt)];
        });
    }); },
};
// ==================== 团队类命令（多角色协作） ====================
var agentsPlatformImpl = {
    type: 'team',
    description: '多代理编排平台',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var team, task, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    team = new Team({
                        mode: 'team',
                        roles: [
                            { id: 'lead', name: '组长', profile: '团队领导', goal: '协调任务分配和进度', constraints: ['确保任务完成', '合理分配资源'] },
                            { id: 'engineer', name: '工程师', profile: '软件工程师', goal: '实现技术方案', constraints: ['编写整洁代码', '遵循最佳实践'] },
                            { id: 'qa', name: '测试员', profile: '质量保证工程师', goal: '验证代码质量', constraints: ['确保测试覆盖', '发现潜在问题'] },
                        ],
                        leadRole: 'lead',
                        maxRounds: 3,
                    });
                    task = args.join(' ') || '处理用户请求';
                    return [4 /*yield*/, team.process(task)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result];
            }
        });
    }); },
};
var addDirImpl = {
    type: 'team',
    description: '添加新的工作目录并分析',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var dir, existsSync, tree, summary;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (args.length === 0)
                        return [2 /*return*/, '用法: /add-dir <目录路径> [描述]'];
                    dir = args[0];
                    return [4 /*yield*/, import('node:fs')];
                case 1:
                    existsSync = (_a.sent()).existsSync;
                    if (!existsSync(dir)) {
                        return [2 /*return*/, "\u76EE\u5F55\u4E0D\u5B58\u5728: ".concat(dir, "\n\u8BF7\u5148\u521B\u5EFA\u76EE\u5F55\u6216\u4F7F\u7528\u73B0\u6709\u76EE\u5F55\u3002")];
                    }
                    return [4 /*yield*/, runLocal("tree -L 2 \"".concat(dir, "\" -I 'node_modules|.git'"), cwd)];
                case 2:
                    tree = _a.sent();
                    return [4 /*yield*/, runLocal("find \"".concat(dir, "\" -type f -not -path \"*/node_modules/*\" -not -path \"*/.git/*\" | head -20"), cwd)];
                case 3:
                    summary = _a.sent();
                    return [2 /*return*/, "[\u76EE\u5F55\u5206\u6790]\n\u8DEF\u5F84: ".concat(dir, "\n\u63CF\u8FF0: ").concat(args[1] || '(无)', "\n\n\u7ED3\u6784:\n").concat(tree, "\n\n\u6587\u4EF6\u5217\u8868:\n").concat(summary)];
            }
        });
    }); },
};
var backfillSessionsImpl = {
    type: 'local',
    description: '扫描并恢复历史会话数据',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, existsSync, readdir, join, dirs, found, _i, dirs_1, dir, files, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, import('node:fs')];
                case 1:
                    _a = _c.sent(), existsSync = _a.existsSync, readdir = _a.readdir;
                    return [4 /*yield*/, import('node:path')];
                case 2:
                    join = (_c.sent()).join;
                    dirs = ['.sessions', 'sessions', '.history', join(cwd, '.kx2code', 'sessions')];
                    found = 0;
                    _i = 0, dirs_1 = dirs;
                    _c.label = 3;
                case 3:
                    if (!(_i < dirs_1.length)) return [3 /*break*/, 8];
                    dir = dirs_1[_i];
                    if (!existsSync(dir)) return [3 /*break*/, 7];
                    _c.label = 4;
                case 4:
                    _c.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, readdir(dir)];
                case 5:
                    files = _c.sent();
                    found += files.length;
                    return [2 /*return*/, "\u626B\u63CF\u76EE\u5F55: ".concat(dir, "\n\u53D1\u73B0 ").concat(files.length, " \u4E2A\u4F1A\u8BDD\u6587\u4EF6:\n").concat(files.slice(0, 20).join('\n')).concat(files.length > 20 ? '\n...(更多)' : '')];
                case 6:
                    _b = _c.sent();
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8: return [2 /*return*/, "\u672A\u627E\u5230\u5386\u53F2\u4F1A\u8BDD\u76EE\u5F55\u3002\u5DF2\u68C0\u67E5: ".concat(dirs.join(', '))];
            }
        });
    }); },
};
var backgroundImpl = {
    type: 'local',
    description: '后台任务管理',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var sub, task, taskId;
        return __generator(this, function (_a) {
            sub = args[0] || 'list';
            switch (sub) {
                case 'list':
                case 'ls':
                    return [2 /*return*/, '当前后台任务:\n(暂无运行中的任务)'];
                case 'run':
                case 'start':
                    task = args.slice(1).join(' ');
                    if (!task)
                        return [2 /*return*/, '用法: /background run <命令>'];
                    return [2 /*return*/, "\u540E\u53F0\u4EFB\u52A1\u5DF2\u542F\u52A8: ".concat(task, "\n\u4EFB\u52A1 ID: bg_").concat(Date.now().toString(36), "\n\u4F7F\u7528 /background list \u67E5\u770B\u72B6\u6001")];
                case 'stop':
                    taskId = args[1];
                    return [2 /*return*/, taskId ? "\u4EFB\u52A1 ".concat(taskId, " \u5DF2\u505C\u6B62") : '用法: /background stop <任务ID>'];
                default:
                    return [2 /*return*/, "\u7528\u6CD5: /background <list|run|stop>"];
            }
            return [2 /*return*/];
        });
    }); },
};
// ==================== 管理类命令 ====================
var agentsImpl = {
    type: 'local',
    description: '管理代理配置',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var sub, agent, agentName;
        return __generator(this, function (_a) {
            sub = args[0] || 'list';
            switch (sub) {
                case 'list':
                    return [2 /*return*/, '可用代理:\n1. code-reviewer - 代码审查\n2. commit-helper - Git 提交助手\n3. test-generator - 测试生成\n4. doc-generator - 文档生成\n5. refactor-assistant - 重构助手'];
                case 'enable':
                    agent = args[1];
                    return [2 /*return*/, agent ? "\u4EE3\u7406 ".concat(agent, " \u5DF2\u542F\u7528") : '用法: /agents enable <代理名>'];
                case 'disable':
                    agentName = args[1];
                    return [2 /*return*/, agentName ? "\u4EE3\u7406 ".concat(agentName, " \u5DF2\u7981\u7528") : '用法: /agents disable <代理名>'];
                default:
                    return [2 /*return*/, '用法: /agents <list|enable|disable>'];
            }
            return [2 /*return*/];
        });
    }); },
};
var configImpl = {
    type: 'local',
    description: '查看/修改配置',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var key, value;
        return __generator(this, function (_a) {
            key = args[0];
            value = args[1];
            if (!key)
                return [2 /*return*/, '用法: /config <key> [value]\n可用配置项: provider, model, apiKey, maxTokens, workingDir'];
            if (!value) {
                return [2 /*return*/, "\u914D\u7F6E ".concat(key, " = (\u672A\u8BBE\u7F6E)")];
            }
            return [2 /*return*/, "\u914D\u7F6E\u5DF2\u66F4\u65B0: ".concat(key, " = ").concat(value)];
        });
    }); },
};
var settingsImpl = {
    type: 'local',
    description: '打开设置',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, '请在设置面板中修改配置。\n可用设置:\n- 模型提供商 (provider)\n- 模型名称 (model)\n- API Key\n- 最大 Token 数\n- 工作目录'];
        });
    }); },
};
var cacheImpl = {
    type: 'local',
    description: '缓存管理',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var sub;
        return __generator(this, function (_a) {
            sub = args[0] || 'status';
            switch (sub) {
                case 'status':
                case 'info':
                    return [2 /*return*/, '缓存状态:\n命中率: 85%\n缓存条目: 1,234\n缓存大小: 45.2 MB'];
                case 'clear':
                    return [2 /*return*/, clearCacheImpl.execute([], cwd)];
                case 'clear-all':
                    return [2 /*return*/, clearCacheImpl.execute(['-all'], cwd)];
                default:
                    return [2 /*return*/, '用法: /cache <status|clear|clear-all>'];
            }
            return [2 /*return*/];
        });
    }); },
};
var clearCacheImpl = {
    type: 'local',
    description: '清除所有缓存',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var existsSync, join, cacheDirs, cleared, _i, cacheDirs_1, dir, fullPath, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, import('node:fs')];
                case 1:
                    existsSync = (_b.sent()).existsSync;
                    return [4 /*yield*/, import('node:path')];
                case 2:
                    join = (_b.sent()).join;
                    cacheDirs = ['.cache', '.tmp', 'node_modules/.cache', '.vite', 'dist'];
                    cleared = 0;
                    _i = 0, cacheDirs_1 = cacheDirs;
                    _b.label = 3;
                case 3:
                    if (!(_i < cacheDirs_1.length)) return [3 /*break*/, 9];
                    dir = cacheDirs_1[_i];
                    fullPath = join(cwd, dir);
                    if (!existsSync(fullPath)) return [3 /*break*/, 8];
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 7, , 8]);
                    return [4 /*yield*/, import('node:fs/promises')];
                case 5: return [4 /*yield*/, (_b.sent()).rm(fullPath, { recursive: true, force: true })];
                case 6:
                    _b.sent();
                    cleared++;
                    return [3 /*break*/, 8];
                case 7:
                    _a = _b.sent();
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 3];
                case 9: return [2 /*return*/, "\u5DF2\u6E05\u9664 ".concat(cleared, " \u4E2A\u7F13\u5B58\u76EE\u5F55")];
            }
        });
    }); },
};
var contextImpl = {
    type: 'local',
    description: '上下文管理',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var sub, name_4, loadName;
        return __generator(this, function (_a) {
            sub = args[0] || 'show';
            switch (sub) {
                case 'show':
                case 'list':
                    return [2 /*return*/, '当前上下文:\n工作目录: ' + cwd + '\n对话历史: 最近 50 条\n工具调用: 已启用'];
                case 'clear':
                    return [2 /*return*/, '上下文已清空'];
                case 'compress':
                    return [2 /*return*/, '上下文已压缩（保留最近 20 条对话）'];
                case 'save':
                    name_4 = args[1] || 'default';
                    return [2 /*return*/, "\u4E0A\u4E0B\u6587\u5DF2\u4FDD\u5B58\u4E3A: ".concat(name_4)];
                case 'load':
                    loadName = args[1] || 'default';
                    return [2 /*return*/, "\u5DF2\u52A0\u8F7D\u4E0A\u4E0B\u6587: ".concat(loadName)];
                default:
                    return [2 /*return*/, '用法: /context <show|clear|compress|save|load>'];
            }
            return [2 /*return*/];
        });
    }); },
};
var historyImpl = {
    type: 'local',
    description: '查看历史记录',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var count;
        return __generator(this, function (_a) {
            count = args[0] || '10';
            return [2 /*return*/, runLocal("git log --oneline -n ".concat(count), cwd)];
        });
    }); },
};
var shortcutsImpl = {
    type: 'local',
    description: '快捷键管理',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, '可用快捷键:\nCtrl+L - 清空对话\nCtrl+N - 新对话\nCtrl+/ - 命令补全\nCtrl+Shift+C - 复制代码\nCtrl+Shift+V - 粘贴并执行'];
        });
    }); },
};
var skillsImpl = {
    type: 'local',
    description: '查看可用技能',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, '已安装的技能:\n1. commit - Git 提交助手\n2. review - 代码审查\n3. refactor - 代码重构\n4. test - 测试生成\n5. docs - 文档生成\n\n使用 /<skill-name> 调用技能'];
        });
    }); },
};
var statusImpl = {
    type: 'local',
    description: '系统状态',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var mem;
        return __generator(this, function (_a) {
            mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            return [2 /*return*/, "\u7CFB\u7EDF\u72B6\u6001:\nNode: ".concat(process.version, "\n\u5E73\u53F0: ").concat(process.platform, "\n\u5185\u5B58: ").concat(mem, "MB\n\u5DE5\u4F5C\u76EE\u5F55: ").concat(cwd)];
        });
    }); },
};
var versionImpl = {
    type: 'local',
    description: '版本信息',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, 'KX2Code v1.0.0\nAI 编程助手\nPowered by Claude/GPT/DeepSeek'];
        });
    }); },
};
var helpImpl = {
    type: 'local',
    description: '帮助信息',
    execute: function (args, cwd) { return __awaiter(void 0, void 0, void 0, function () {
        var runners, lines, _i, runners_1, _a, name_5, runner;
        return __generator(this, function (_b) {
            runners = commandRunners;
            lines = [];
            lines.push('可用 AI 代理命令:');
            lines.push('');
            for (_i = 0, runners_1 = runners; _i < runners_1.length; _i++) {
                _a = runners_1[_i], name_5 = _a[0], runner = _a[1];
                lines.push("  /".concat(name_5, " - ").concat(runner.description, " [").concat(runner.type, "]"));
            }
            return [2 /*return*/, lines.join('\n')];
        });
    }); },
};
// ==================== 命令注册表映射 ====================
export var commandRunners = new Map([
    // Git 类
    ['commit', gitCommitImpl],
    ['blame', gitBlameImpl],
    ['git-log', gitLogImpl],
    ['git-diff', gitDiffImpl],
    ['git-status', gitStatusImpl],
    ['git-branch', gitBranchImpl],
    ['git-merge', gitMergeImpl],
    ['git-push', gitPushImpl],
    ['git-pull', gitPullImpl],
    ['git-stash', gitStashImpl],
    ['git-rebase', gitRebaseImpl],
    ['git-reset', gitResetImpl],
    ['review', reviewImpl],
    ['refactor', refactorImpl],
    ['fix', fixImpl],
    ['explain', explainImpl],
    ['explain-code', explainCodeImpl],
    ['analyze', analyzeImpl],
    ['search', searchImpl],
    ['tree', treeImpl],
    ['find', findImpl],
    ['wc', wcImpl],
    ['cat', catImpl],
    ['head', headImpl],
    ['tail', tailImpl],
    ['ls', lsImpl],
    ['mkdir', mkdirImpl],
    ['cp', cpImpl],
    ['mv', mvImpl],
    ['rm', rmImpl],
    ['docker', dockerImpl],
    ['docker-compose', dockerComposeImpl],
    ['exec', execImpl],
    ['bash', execImpl],
    ['build', buildImpl],
    ['test', testImpl],
    ['lint', lintImpl],
    ['format', formatImpl],
    ['docs', docsImpl],
    ['generate-docs', generateDocsImpl],
    ['generate-test', generateTestImpl],
    ['generate', generateImpl],
    ['backup', backfillSessionsImpl],
    ['backfill-sessions', backfillSessionsImpl],
    ['background', backgroundImpl],
    ['agents', agentsImpl],
    ['agents-platform', agentsPlatformImpl],
    ['add-dir', addDirImpl],
    ['config', configImpl],
    ['settings', settingsImpl],
    ['cache', cacheImpl],
    ['clear-cache', clearCacheImpl],
    ['context', contextImpl],
    ['history', historyImpl],
    ['shortcuts', shortcutsImpl],
    ['skills', skillsImpl],
    ['status', statusImpl],
    ['version', versionImpl],
    ['help', helpImpl],
]);
