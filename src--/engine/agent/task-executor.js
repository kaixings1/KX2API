/**
 * TaskExecutor — 子任务执行器 + 进度追踪 + 结果校验
 *
 * 职责：
 *   1. 按依赖关系顺序执行子任务
 *   2. 每个子任务执行后自动校验结果（非空检查、错误码检查）
 *   3. 失败自动重试（最多 N 次）
 *   4. 结果合并为最终输出
 *   5. 全程进度可观测
 *   6. 崩溃后自动续跑
 *
 * 用法：
 *   const executor = new TaskExecutor({ registry: commandRegistry, toolCollection })
 *   const result = await executor.execute(plan, {
 *     onProgress: (current, total, subtask) => console.log(`${current}/${total}: ${subtask.description}`),
 *     onComplete: (finalResult) => console.log("全部完成"),
 *   })
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import * as fs from "node:fs";
import * as path from "node:path";
import { commandRegistry } from "../commands/registry.ts";
import { commandRunners } from "./command-runners.ts";
// ==================== 执行器 ====================
var TaskExecutor = /** @class */ (function () {
    function TaskExecutor(opts) {
        if (opts === void 0) { opts = {}; }
        var _a, _b, _c, _d, _e, _f;
        this.registry = (_a = opts.registry) !== null && _a !== void 0 ? _a : commandRegistry;
        this.runners = (_b = opts.runners) !== null && _b !== void 0 ? _b : commandRunners;
        this.cwd = (_c = opts.cwd) !== null && _c !== void 0 ? _c : process.cwd();
        this.maxRetries = (_d = opts.maxRetries) !== null && _d !== void 0 ? _d : 2;
        this.validators = (_e = opts.validators) !== null && _e !== void 0 ? _e : new Map();
        this.stateDir = (_f = opts.stateDir) !== null && _f !== void 0 ? _f : path.join(".kx2code", "tasks");
        this.llmConfig = opts.llmConfig;
    }
    /**
     * 执行完整计划
     */
    TaskExecutor.prototype.execute = function (plan, callbacks) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, results, failed, aborted, resumeFrom, i, subtask, depsMet, depErrors, attempts, lastResult, e_1, mergedOutput, totalDurationMs, finalResult;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        startTime = Date.now();
                        results = [];
                        failed = [];
                        aborted = false;
                        resumeFrom = this.findResumePoint(plan);
                        i = 0;
                        _f.label = 1;
                    case 1:
                        if (!(i < plan.subtasks.length)) return [3 /*break*/, 9];
                        subtask = plan.subtasks[i];
                        // 如果这个子任务已经成功完成，跳过
                        if (((_a = subtask.result) === null || _a === void 0 ? void 0 : _a.success) && subtask.id <= resumeFrom) {
                            results.push(subtask.result);
                            (_b = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onProgress) === null || _b === void 0 ? void 0 : _b.call(callbacks, i + 1, plan.subtasks.length, subtask);
                            return [3 /*break*/, 8];
                        }
                        // 检查依赖是否都已完成
                        if (subtask.dependsOn && subtask.dependsOn.length > 0) {
                            depsMet = subtask.dependsOn.every(function (depId) { return results.some(function (r) { var _a, _b; return r.success && ((_b = (_a = plan.subtasks.find(function (s) { return s.id === depId; })) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.success); }); });
                            if (!depsMet) {
                                depErrors = subtask.dependsOn
                                    .map(function (id) {
                                    var _a;
                                    var dep = plan.subtasks.find(function (s) { return s.id === id; });
                                    return ((_a = dep === null || dep === void 0 ? void 0 : dep.result) === null || _a === void 0 ? void 0 : _a.error) ? "#".concat(id, ": ").concat(dep.result.error) : null;
                                })
                                    .filter(Boolean);
                                results.push({
                                    success: false,
                                    output: "",
                                    error: "\u4F9D\u8D56\u672A\u6EE1\u8DB3: ".concat(depErrors === null || depErrors === void 0 ? void 0 : depErrors.join(", ")),
                                    durationMs: 0,
                                });
                                failed.push({ id: subtask.id, description: subtask.description, error: "依赖未满足" });
                                return [3 /*break*/, 8];
                            }
                        }
                        attempts = 0;
                        lastResult = null;
                        _f.label = 2;
                    case 2:
                        if (!(attempts <= this.maxRetries)) return [3 /*break*/, 7];
                        attempts++;
                        _f.label = 3;
                    case 3:
                        _f.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.executeSubtask(subtask, results)];
                    case 4:
                        lastResult = _f.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        e_1 = _f.sent();
                        lastResult = {
                            success: false,
                            output: "",
                            error: e_1.message,
                            durationMs: 0,
                        };
                        return [3 /*break*/, 6];
                    case 6:
                        // 校验结果
                        if (lastResult.success && !this.validateResult(subtask, lastResult)) {
                            lastResult.success = false;
                            lastResult.error = "\u7ED3\u679C\u6821\u9A8C\u5931\u8D25: \u8F93\u51FA\u4E0D\u7B26\u5408\u9884\u671F";
                        }
                        // 更新计划中的子任务结果
                        subtask.result = lastResult;
                        this.persistPlan(plan);
                        if (lastResult.success)
                            return [3 /*break*/, 7];
                        if (attempts <= this.maxRetries) {
                            console.log("[Executor] \u5B50\u4EFB\u52A1 #".concat(subtask.id, " \u91CD\u8BD5 ").concat(attempts, "/").concat(this.maxRetries, ": ").concat(subtask.description));
                        }
                        return [3 /*break*/, 2];
                    case 7:
                        results.push(lastResult);
                        if (!lastResult.success) {
                            failed.push({ id: subtask.id, description: subtask.description, error: (_c = lastResult.error) !== null && _c !== void 0 ? _c : "未��错误" });
                            // 非关键子任务失败继续，关键失败中断
                            if (!subtask.toolHint) {
                                aborted = true;
                                return [3 /*break*/, 9];
                            }
                        }
                        (_d = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onProgress) === null || _d === void 0 ? void 0 : _d.call(callbacks, i + 1, plan.subtasks.length, subtask);
                        _f.label = 8;
                    case 8:
                        i++;
                        return [3 /*break*/, 1];
                    case 9:
                        mergedOutput = this.mergeResults(results, plan);
                        totalDurationMs = Date.now() - startTime;
                        finalResult = {
                            success: failed.length === 0 && !aborted,
                            output: mergedOutput,
                            subtaskResults: results,
                            totalDurationMs: totalDurationMs,
                            failedSubtasks: failed,
                        };
                        // 持久化最终结果
                        this.persistResult(plan, finalResult);
                        (_e = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onComplete) === null || _e === void 0 ? void 0 : _e.call(callbacks, finalResult);
                        return [2 /*return*/, finalResult];
                }
            });
        });
    };
    // ==================== 子任务执行 ====================
    TaskExecutor.prototype.executeSubtask = function (subtask, previousResults) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, toolName, args, context, output, runner, cmd, result;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        startTime = Date.now();
                        toolName = subtask.toolHint;
                        args = (_a = subtask.args) !== null && _a !== void 0 ? _a : [];
                        context = this.buildContext(previousResults);
                        output = "";
                        if (!toolName) return [3 /*break*/, 6];
                        runner = this.runners.get(toolName);
                        if (!runner) return [3 /*break*/, 2];
                        return [4 /*yield*/, runner.execute(__spreadArray(__spreadArray([], args, true), ((_b = context.args) !== null && _b !== void 0 ? _b : []), true), this.cwd, this.toLlmConfig())];
                    case 1:
                        output = _d.sent();
                        return [3 /*break*/, 5];
                    case 2:
                        cmd = this.registry.get(toolName);
                        if (!cmd) return [3 /*break*/, 4];
                        return [4 /*yield*/, cmd.execute(__spreadArray(__spreadArray([], args, true), ((_c = context.args) !== null && _c !== void 0 ? _c : []), true))];
                    case 3:
                        result = _d.sent();
                        output = result.error || result.output || "命令执行完成";
                        return [3 /*break*/, 5];
                    case 4:
                        output = "[Executor] \u5DE5\u5177 \"".concat(toolName, "\" \u672A\u627E\u5230\uFF0C\u8DF3\u8FC7");
                        _d.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        // 无 toolHint：作为自由文本任务，返回上下文摘要
                        output = "[Executor] \u5B50\u4EFB\u52A1: ".concat(subtask.description, "\n\u4E0A\u4E0B\u6587:\n").concat(context.summary);
                        _d.label = 7;
                    case 7: return [2 /*return*/, {
                            success: !output.includes("错误") && !output.includes("Error") && !output.includes("失败"),
                            output: output,
                            durationMs: Date.now() - startTime,
                            artifact: { tool: toolName, args: args, context: context },
                        }];
                }
            });
        });
    };
    // ==================== 结果校验 ====================
    TaskExecutor.prototype.validateResult = function (subtask, result) {
        var _a;
        // 基础校验：必须有输出
        if (!result.output || result.output.trim().length === 0)
            return false;
        // 校验器映射
        var validator = this.validators.get((_a = subtask.toolHint) !== null && _a !== void 0 ? _a : "");
        if (validator)
            return validator(result.output);
        // 默认校验：不包含致命错误标记
        var errorMarkers = ["FATAL", "segmentation fault", "Out of memory", "Unhandled"];
        return !errorMarkers.some(function (m) { return result.output.includes(m); });
    };
    // ==================== 结果合并 ====================
    TaskExecutor.prototype.mergeResults = function (results, plan) {
        if (results.length === 0)
            return "无结果";
        var successful = results.filter(function (r) { return r.success; });
        var failed = results.filter(function (r) { return !r.success; });
        var parts = [];
        parts.push("# \u4EFB\u52A1\u6267\u884C\u7ED3\u679C: ".concat(plan.originalRequest));
        parts.push("# \u603B\u5B50\u4EFB\u52A1: ".concat(results.length, " | \u6210\u529F: ").concat(successful.length, " | \u5931\u8D25: ").concat(failed.length));
        parts.push("");
        for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
            var r = results_1[_i];
            var status_1 = r.success ? "✓" : "✗";
            parts.push("## [".concat(status_1, "] ").concat(r.success ? "成功" : "失败", " (").concat(r.durationMs, "ms)"));
            parts.push(r.output.slice(0, 2000));
            if (r.error)
                parts.push("\u9519\u8BEF: ".concat(r.error));
            parts.push("");
        }
        return parts.join("\n");
    };
    // ==================== 持久化 ====================
    TaskExecutor.prototype.persistPlan = function (plan) {
        try {
            fs.mkdirSync(this.stateDir, { recursive: true });
            var file = path.join(this.stateDir, "".concat(plan.sessionId, ".plan.json"));
            var tmp = file + ".tmp";
            fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), "utf-8");
            fs.renameSync(tmp, file);
        }
        catch ( /* ignore */_a) { /* ignore */ }
    };
    TaskExecutor.prototype.findResumePoint = function (plan) {
        var completed = plan.subtasks.filter(function (s) { var _a; return (_a = s.result) === null || _a === void 0 ? void 0 : _a.success; });
        if (completed.length === 0)
            return 0;
        return Math.max.apply(Math, completed.map(function (s) { return s.id; }));
    };
    // ==================== 上下文构建 ====================
    TaskExecutor.prototype.buildContext = function (previousResults) {
        if (previousResults.length === 0)
            return { summary: "" };
        var successful = previousResults.filter(function (r) { return r.success; });
        if (successful.length === 0)
            return { summary: "(前序步骤均失败)" };
        var summary = successful
            .map(function (r, i) { return "[\u6B65\u9AA4 ".concat(i + 1, "] ").concat(r.output.slice(0, 500)); })
            .join("\n\n");
        return { summary: summary, args: [] };
    };
    TaskExecutor.prototype.toLlmConfig = function () {
        if (!this.llmConfig)
            return undefined;
        return {
            provider: this.llmConfig.provider,
            apiKey: this.llmConfig.apiKey,
            model: this.llmConfig.model,
            baseUrl: this.llmConfig.baseUrl,
            maxTokens: this.llmConfig.maxTokens,
        };
    };
    // ==================== 结果持久化 ====================
    TaskExecutor.prototype.persistResult = function (plan, result) {
        try {
            fs.mkdirSync(this.stateDir, { recursive: true });
            var file = path.join(this.stateDir, "".concat(plan.sessionId, ".result.json"));
            var tmp = file + ".tmp";
            fs.writeFileSync(tmp, JSON.stringify({
                sessionId: plan.sessionId,
                originalRequest: plan.originalRequest,
                success: result.success,
                totalDurationMs: result.totalDurationMs,
                subtaskCount: plan.subtasks.length,
                successCount: result.subtaskResults.filter(function (r) { return r.success; }).length,
                failedSubtasks: result.failedSubtasks,
                finishedAt: new Date().toISOString(),
            }, null, 2), "utf-8");
            fs.renameSync(tmp, file);
            // 完成标记
            var doneFile = path.join(this.stateDir, "".concat(plan.sessionId, ".done"));
            fs.writeFileSync(doneFile, result.success ? "SUCCESS" : "FAILED", "utf-8");
        }
        catch ( /* ignore */_a) { /* ignore */ }
    };
    return TaskExecutor;
}());
export { TaskExecutor };
export default TaskExecutor;
