/**
 * TaskDecomposer — 复杂任务自动拆解器
 *
 * 职责：把用户的复杂请求拆成有序的子任务列表，每个子任务可独立执行、
 * 追踪进度、验证结果，最终合并为完整输出。
 *
 * 拆解策略：
 *   - llm 模式：调用 LLM 生成子任务分解（基于用户请求 + 可用工具列表）
 *   - static 模式：基于命令注册表静态分析（fallback，无需 LLM）
 *   - single 模式：单任务，不拆解
 *
 * 用法：
 *   const decomposer = new TaskDecomposer({ mode: 'llm', config: llmConfig })
 *   const plan = await decomposer.decompose("重构登录模块并写测试")
 *   // plan.subtasks = [
 *   //   { id: 1, desc: "分析登录模块现有代码", tool: "analyze" },
 *   //   { id: 2, desc: "重构 auth.ts 中的验证逻辑", tool: "refactor" },
 *   //   { id: 3, desc: "为重构后的代码生成单元测试", tool: "generate-test" },
 *   //   { id: 4, desc: "运行测试验证结果", tool: "test" },
 *   // ]
 *   // plan.mergeStrategy = "sequential"  // 顺序执行，上一步结果传给下一步
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
import * as fs from "node:fs";
import * as path from "node:path";
// ==================== 拆解器 ====================
var TaskDecomposer = /** @class */ (function () {
    function TaskDecomposer(config) {
        var _a, _b;
        this.config = __assign({ availableTools: (_a = config.availableTools) !== null && _a !== void 0 ? _a : [], stateDir: (_b = config.stateDir) !== null && _b !== void 0 ? _b : "./.kx2code/tasks" }, config);
    }
    /**
     * 将复杂请求拆解为子任务
     */
    TaskDecomposer.prototype.decompose = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionId, plan, _a, _b, saved, completedIds;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        sessionId = this.getOrCreateSessionId();
                        plan = {
                            originalRequest: request,
                            subtasks: [],
                            mergeStrategy: "sequential",
                            createdAt: new Date().toISOString(),
                            sessionId: sessionId,
                        };
                        _a = this.config.mode;
                        switch (_a) {
                            case "llm": return [3 /*break*/, 1];
                            case "static": return [3 /*break*/, 3];
                            case "single": return [3 /*break*/, 3];
                        }
                        return [3 /*break*/, 3];
                    case 1:
                        _b = plan;
                        return [4 /*yield*/, this.decomposeWithLLM(request)];
                    case 2:
                        _b.subtasks = _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        plan.subtasks = this.decomposeStatic(request);
                        if (plan.subtasks.length === 1)
                            plan.mergeStrategy = "single";
                        return [3 /*break*/, 4];
                    case 4:
                        saved = this.tryResumePlan(sessionId);
                        if (saved && saved.subtasks.length > 0) {
                            completedIds = new Set(saved.subtasks.filter(function (s) { var _a; return (_a = s.result) === null || _a === void 0 ? void 0 : _a.success; }).map(function (s) { return s.id; }));
                            if (completedIds.size > 0 && completedIds.size < saved.subtasks.length) {
                                // 部分完成：合并已完成的 + 未完成的
                                plan.subtasks = saved.subtasks;
                                plan.mergeStrategy = saved.mergeStrategy;
                                plan.createdAt = saved.createdAt;
                            }
                        }
                        else {
                            this.persistPlan(plan);
                        }
                        return [2 /*return*/, plan];
                }
            });
        });
    };
    // ==================== LLM 拆解 ====================
    TaskDecomposer.prototype.decomposeWithLLM = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var toolsList, systemPrompt, userPrompt, raw;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.config.llmCall) {
                            console.log("[Decomposer] 无 llmCall 回调，降级为 static 模式");
                            return [2 /*return*/, this.decomposeStatic(request)];
                        }
                        toolsList = ((_a = this.config.availableTools) !== null && _a !== void 0 ? _a : [])
                            .map(function (t) { return "  /".concat(t.name, " \u2014 ").concat(t.description); })
                            .join("\n");
                        systemPrompt = "\u4F60\u662F KX2Code \u7684\u4EFB\u52A1\u89C4\u5212\u5668\u3002\u5C06\u7528\u6237\u7684\u8BF7\u6C42\u62C6\u89E3\u4E3A\u6709\u5E8F\u7684\u5B50\u4EFB\u52A1\u5217\u8868\u3002\n\n\u89C4\u5219\uFF1A\n1. \u6BCF\u4E2A\u5B50\u4EFB\u52A1\u5FC5\u987B\u4F7F\u7528\u53EF\u7528\u7684\u5DE5\u5177\u5B8C\u6210\n2. \u5B50\u4EFB\u52A1\u4E4B\u95F4\u6709\u5E8F\u4F9D\u8D56\u5173\u7CFB\uFF08\u4E0A\u6E38\u7ED3\u679C\u4F20\u7ED9\u4E0B\u6E38\uFF09\n3. \u6BCF\u4E2A\u5B50\u4EFB\u52A1\u53EA\u505A\u4E00\u4EF6\u4E8B\uFF0C\u5C0F\u800C\u5177\u4F53\n4. \u6700\u591A\u62C6 6 \u4E2A\u5B50\u4EFB\u52A1\n5. \u8F93\u51FA\u7EAF JSON \u683C\u5F0F\n\n\u53EF\u7528\u5DE5\u5177:\n".concat(toolsList, "\n\n\u8F93\u51FA\u683C\u5F0F:\n[\n  {\"id\": 1, \"description\": \"\u5B50\u4EFB\u52A1\u63CF\u8FF0\", \"tool\": \"\u5DE5\u5177\u540D\", \"args\": [\"\u53C2\u6570\"], \"dependsOn\": []},\n  {\"id\": 2, \"description\": \"\u5B50\u4EFB\u52A1\u63CF\u8FF0\", \"tool\": \"\u5DE5\u5177\u540D\", \"args\": [\"\u53C2\u6570\"], \"dependsOn\": [1]}\n]");
                        userPrompt = "\u8BF7\u62C6\u89E3\u4EE5\u4E0B\u8BF7\u6C42\u4E3A\u5B50\u4EFB\u52A1\u5217\u8868:\n".concat(request);
                        return [4 /*yield*/, this.config.llmCall(systemPrompt, userPrompt)];
                    case 1:
                        raw = _b.sent();
                        return [2 /*return*/, this.parseLLMResult(raw, request)];
                }
            });
        });
    };
    TaskDecomposer.prototype.parseLLMResult = function (raw, fallbackRequest) {
        try {
            // 提取 JSON 数组
            var match = raw.match(/\[[\s\S]*\]/);
            if (!match)
                throw new Error("no JSON found");
            var parsed = JSON.parse(match[0]);
            if (!Array.isArray(parsed))
                throw new Error("not an array");
            return parsed.map(function (item, i) {
                var _a, _b, _c, _d;
                return ({
                    id: (_a = item.id) !== null && _a !== void 0 ? _a : i + 1,
                    description: (_b = item.description) !== null && _b !== void 0 ? _b : fallbackRequest,
                    toolHint: item.tool,
                    args: (_c = item.args) !== null && _c !== void 0 ? _c : [],
                    dependsOn: (_d = item.dependsOn) !== null && _d !== void 0 ? _d : [],
                });
            });
        }
        catch (_a) {
            // 降级：单任务
            return [{ id: 1, description: fallbackRequest }];
        }
    };
    // ==================== 静态拆解 ====================
    TaskDecomposer.prototype.decomposeStatic = function (request) {
        var lower = request.toLowerCase();
        var tasks = [];
        var id = 0;
        // 重构类任务
        if (lower.includes("重构") || lower.includes("refactor")) {
            var target = this.extractTarget(lower);
            tasks.push({ id: ++id, description: "\u5206\u6790 ".concat(target || "目标代码", " \u7684\u5F53\u524D\u7ED3\u6784\u548C\u4F9D\u8D56"), toolHint: "analyze" });
            tasks.push({ id: ++id, description: "\u91CD\u6784 ".concat(target || "代码"), toolHint: "refactor", dependsOn: [id - 1] });
            if (lower.includes("测试") || lower.includes("test")) {
                tasks.push({ id: ++id, description: "生成单元测试", toolHint: "generate-test", dependsOn: [id - 1] });
            }
            tasks.push({ id: ++id, description: "运行测试验证", toolHint: "test", dependsOn: [id - 1] });
            return tasks;
        }
        // 修复 bug
        if (lower.includes("修复") || lower.includes("fix") || lower.includes("bug")) {
            tasks.push({ id: ++id, description: "检查 lint 错误", toolHint: "lint" });
            tasks.push({ id: ++id, description: "运行测试找出失败项", toolHint: "test" });
            tasks.push({ id: ++id, description: "分析并修复问题", toolHint: "fix", dependsOn: [id - 2, id - 1] });
            tasks.push({ id: ++id, description: "验证修复结果", toolHint: "test", dependsOn: [id - 1] });
            return tasks;
        }
        // 代码审查
        if (lower.includes("审查") || lower.includes("review")) {
            tasks.push({ id: ++id, description: "获取最近代码变更", toolHint: "git-diff" });
            tasks.push({ id: ++id, description: "执行代码审查", toolHint: "review", dependsOn: [id - 1] });
            return tasks;
        }
        // 生成文档
        if (lower.includes("文档") || lower.includes("docs") || lower.includes("document")) {
            tasks.push({ id: ++id, description: "分析项目结构", toolHint: "tree" });
            tasks.push({ id: ++id, description: "生成文档", toolHint: "generate-docs", dependsOn: [id - 1] });
            return tasks;
        }
        // 默认：单任务
        return [{ id: 1, description: request }];
    };
    TaskDecomposer.prototype.extractTarget = function (text) {
        var patterns = [
            /重构\s*(\S+?)(?:模块|文件|代码|的|并)/,
            /refactor\s+(\S+)/,
            /(\w+\.(ts|tsx|js|jsx|py|rs|go))/,
        ];
        for (var _i = 0, patterns_1 = patterns; _i < patterns_1.length; _i++) {
            var p = patterns_1[_i];
            var m = text.match(p);
            if (m)
                return m[1];
        }
        return "";
    };
    // ==================== 持久化（用于续跑） ====================
    TaskDecomposer.prototype.getOrCreateSessionId = function () {
        if (this.config.stateDir) {
            fs.mkdirSync(this.config.stateDir, { recursive: true });
            var idFile = path.join(this.config.stateDir, "current-session.id");
            if (fs.existsSync(idFile)) {
                return fs.readFileSync(idFile, "utf-8").trim();
            }
            var newId = "task-".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2, 6));
            fs.writeFileSync(idFile, newId, "utf-8");
            return newId;
        }
        return "task-".concat(Date.now());
    };
    TaskDecomposer.prototype.persistPlan = function (plan) {
        if (!this.config.stateDir)
            return;
        try {
            var file = path.join(this.config.stateDir, "".concat(plan.sessionId, ".plan.json"));
            var tmp = file + ".tmp";
            fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), "utf-8");
            fs.renameSync(tmp, file);
        }
        catch ( /* ignore */_a) { /* ignore */ }
    };
    TaskDecomposer.prototype.tryResumePlan = function (sessionId) {
        var _a;
        if (!this.config.stateDir)
            return null;
        try {
            var file = path.join(this.config.stateDir, "".concat(sessionId, ".plan.json"));
            if (!fs.existsSync(file))
                return null;
            var data = JSON.parse(fs.readFileSync(file, "utf-8"));
            if ((_a = data.subtasks) === null || _a === void 0 ? void 0 : _a.some(function (s) { var _a; return (_a = s.result) === null || _a === void 0 ? void 0 : _a.success; })) {
                return data;
            }
        }
        catch ( /* ignore */_b) { /* ignore */ }
        return null;
    };
    /** 更新某个子任务的结果（供 executor 调用） */
    TaskDecomposer.prototype.updateSubTaskResult = function (plan, subtaskId, result) {
        var task = plan.subtasks.find(function (s) { return s.id === subtaskId; });
        if (task) {
            task.result = result;
            this.persistPlan(plan);
        }
    };
    /** 获取已完成的子任务数 */
    TaskDecomposer.prototype.getCompletedCount = function (plan) {
        return plan.subtasks.filter(function (s) { var _a; return (_a = s.result) === null || _a === void 0 ? void 0 : _a.success; }).length;
    };
    TaskDecomposer.counter = 0;
    return TaskDecomposer;
}());
export { TaskDecomposer };
export default TaskDecomposer;
