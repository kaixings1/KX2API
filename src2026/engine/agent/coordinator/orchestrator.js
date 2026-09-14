/**
 * Orchestrator — 多目标协调器
 *
 * 职责：
 *   1. 接收高层目标（可能包含多个子目标）
 *   2. 用 Planner 生成执行计划（多角色讨论）
 *   3. 执行计划（并行/串行任务）
 *   4. 生成执行报告
 *   5. 全程持久化，支持断点续跑
 *
 * 用法：
 *   const orchestrator = new Orchestrator({ llm: { provider, apiKey, model } })
 *   const report = await orchestrator.execute({
 *     id: "obj-1",
 *     description: "重构认证模块并写测试",
 *   })
 *   // report 包含所有任务的执行结果、讨论记录、总耗时
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
import { Planner, BUILTIN_ROLES } from "./planner.ts";
import { commandRegistry } from "../../commands/registry.ts";
// ==================== Orchestrator ====================
var Orchestrator = /** @class */ (function () {
    function Orchestrator(config, callbacks, roles) {
        var _a, _b, _c, _d, _e;
        this.config = __assign({ maxDiscussionRounds: (_a = config.maxDiscussionRounds) !== null && _a !== void 0 ? _a : 3, maxParallelTasks: (_b = config.maxParallelTasks) !== null && _b !== void 0 ? _b : 4, maxRetries: (_c = config.maxRetries) !== null && _c !== void 0 ? _c : 2, plansDir: (_d = config.plansDir) !== null && _d !== void 0 ? _d : path.join(".kx2code", "plans"), cwd: (_e = config.cwd) !== null && _e !== void 0 ? _e : process.cwd() }, config);
        this.callbacks = callbacks;
        this.roles = roles !== null && roles !== void 0 ? roles : BUILTIN_ROLES;
    }
    /**
     * 执行一个高层目标
     *
     * 流程：
     *   1. 检查是否有未完成的计划（续跑）
     *   2. 如果有子目标，递归执行
     *   3. 生成计划（多角色讨论）
     *   4. 执行计划
     *   5. 返回报告
     */
    Orchestrator.prototype.execute = function (objective) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, plans, allTaskResults, allDiscussions, _i, _a, sub, report_1, existingPlan, planner, plan, taskResults, report;
            var _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        startTime = Date.now();
                        plans = [];
                        allTaskResults = [];
                        allDiscussions = [];
                        if (!(objective.subObjectives && objective.subObjectives.length > 0)) return [3 /*break*/, 5];
                        _i = 0, _a = objective.subObjectives;
                        _f.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        sub = _a[_i];
                        return [4 /*yield*/, this.execute(sub)];
                    case 2:
                        report_1 = _f.sent();
                        allTaskResults.push.apply(allTaskResults, report_1.taskResults);
                        _f.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, this.buildReport(objective.id, startTime, allTaskResults, allDiscussions, "子目标全部执行完成")];
                    case 5:
                        existingPlan = this.tryResumePlan(objective.id);
                        if (!(existingPlan && existingPlan.status === "executing")) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.resumePlan(objective, existingPlan, startTime)];
                    case 6: 
                    // 恢复执行
                    return [2 /*return*/, _f.sent()];
                    case 7:
                        // 生成新计划
                        (_c = (_b = this.callbacks) === null || _b === void 0 ? void 0 : _b.onPhaseChange) === null || _c === void 0 ? void 0 : _c.call(_b, "planning", "\u4E3A\u76EE\u6807 \"".concat(objective.description, "\" \u751F\u6210\u6267\u884C\u8BA1\u5212"));
                        planner = new Planner({
                            config: this.config,
                            roles: this.roles,
                            callbacks: this.callbacks,
                        });
                        return [4 /*yield*/, planner.generatePlan({ id: objective.id, description: objective.description })];
                    case 8:
                        plan = _f.sent();
                        plans.push(plan);
                        // 持久化计划
                        this.persistPlan(plan);
                        (_e = (_d = this.callbacks) === null || _d === void 0 ? void 0 : _d.onPlanGenerated) === null || _e === void 0 ? void 0 : _e.call(_d, plan);
                        return [4 /*yield*/, this.executePlan(plan)];
                    case 9:
                        taskResults = _f.sent();
                        allTaskResults.push.apply(allTaskResults, taskResults);
                        // 收集讨论记录
                        allDiscussions.push.apply(allDiscussions, plan.discussions);
                        // 标记完成
                        plan.status = "completed";
                        this.persistPlan(plan);
                        report = this.buildReport(objective.id, startTime, allTaskResults, allDiscussions, "\u76EE\u6807\u6267\u884C\u5B8C\u6210: ".concat(objective.description));
                        this.persistReport(report);
                        return [2 /*return*/, report];
                }
            });
        });
    };
    // ==================== 计划执行 ====================
    Orchestrator.prototype.executePlan = function (plan) {
        return __awaiter(this, void 0, void 0, function () {
            var results, sequential, parallel, standalone, _i, sequential_1, task, result, _a, parallel_1, task, depsMet, result, _b, standalone_1, task, result;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        results = [];
                        sequential = plan.tasks.filter(function (t) { return t.strategy === "sequential"; });
                        parallel = plan.tasks.filter(function (t) { return t.strategy === "parallel"; });
                        standalone = plan.tasks.filter(function (t) { return t.strategy === "standalone"; });
                        _i = 0, sequential_1 = sequential;
                        _c.label = 1;
                    case 1:
                        if (!(_i < sequential_1.length)) return [3 /*break*/, 4];
                        task = sequential_1[_i];
                        return [4 /*yield*/, this.executeTask(task, plan)];
                    case 2:
                        result = _c.sent();
                        results.push(result);
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        _a = 0, parallel_1 = parallel;
                        _c.label = 5;
                    case 5:
                        if (!(_a < parallel_1.length)) return [3 /*break*/, 8];
                        task = parallel_1[_a];
                        depsMet = task.dependsOn.every(function (depId) { return results.some(function (r) { return r.taskId === depId && r.success; }); });
                        if (!depsMet) {
                            results.push({
                                taskId: task.id,
                                description: task.description,
                                success: false,
                                output: "",
                                error: "\u4F9D\u8D56\u672A\u6EE1\u8DB3: ".concat(task.dependsOn.join(", ")),
                                durationMs: 0,
                            });
                            return [3 /*break*/, 7];
                        }
                        return [4 /*yield*/, this.executeTask(task, plan)];
                    case 6:
                        result = _c.sent();
                        results.push(result);
                        _c.label = 7;
                    case 7:
                        _a++;
                        return [3 /*break*/, 5];
                    case 8:
                        _b = 0, standalone_1 = standalone;
                        _c.label = 9;
                    case 9:
                        if (!(_b < standalone_1.length)) return [3 /*break*/, 12];
                        task = standalone_1[_b];
                        return [4 /*yield*/, this.executeTask(task, plan)];
                    case 10:
                        result = _c.sent();
                        results.push(result);
                        _c.label = 11;
                    case 11:
                        _b++;
                        return [3 /*break*/, 9];
                    case 12: return [2 /*return*/, results];
                }
            });
        });
    };
    Orchestrator.prototype.executeTask = function (task, plan) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, output, success, error, commandRunners, runner, cmd, result, e_1, durationMs, taskResult;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        startTime = Date.now();
                        (_b = (_a = this.callbacks) === null || _a === void 0 ? void 0 : _a.onTaskStart) === null || _b === void 0 ? void 0 : _b.call(_a, task);
                        output = "";
                        success = false;
                        if (!task.command) return [3 /*break*/, 10];
                        _h.label = 1;
                    case 1:
                        _h.trys.push([1, 8, , 9]);
                        return [4 /*yield*/, import("../command-runners.ts")];
                    case 2:
                        commandRunners = (_h.sent()).commandRunners;
                        runner = commandRunners.get(task.command);
                        if (!runner) return [3 /*break*/, 4];
                        return [4 /*yield*/, runner.execute((_c = task.args) !== null && _c !== void 0 ? _c : [], (_d = this.config.cwd) !== null && _d !== void 0 ? _d : process.cwd())];
                    case 3:
                        output = _h.sent();
                        success = true;
                        return [3 /*break*/, 7];
                    case 4:
                        cmd = commandRegistry.get(task.command);
                        if (!cmd) return [3 /*break*/, 6];
                        return [4 /*yield*/, cmd.execute((_e = task.args) !== null && _e !== void 0 ? _e : [])];
                    case 5:
                        result = _h.sent();
                        output = result.error || result.output || "命令执行完成";
                        success = true;
                        return [3 /*break*/, 7];
                    case 6:
                        output = "[Orchestrator] \u5DE5\u5177 \"".concat(task.command, "\" \u672A\u627E\u5230\uFF0C\u8DF3\u8FC7");
                        error = "Unknown command: ".concat(task.command);
                        _h.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        e_1 = _h.sent();
                        error = e_1.message;
                        output = "\u6267\u884C\u5931\u8D25: ".concat(error);
                        return [3 /*break*/, 9];
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        // 无 command：返回任务描述作为输出
                        output = "[Orchestrator] \u4EFB\u52A1: ".concat(task.description, "\n(\u65E0\u5177\u4F53\u547D\u4EE4\uFF0C\u9700\u8981\u624B\u52A8\u5904\u7406)");
                        success = true;
                        _h.label = 11;
                    case 11:
                        durationMs = Date.now() - startTime;
                        taskResult = {
                            taskId: task.id,
                            description: task.description,
                            success: success,
                            output: output.slice(0, 5000),
                            error: error,
                            durationMs: durationMs,
                        };
                        // 更新 plan 中的任务结果
                        task.result = {
                            success: success,
                            output: output.slice(0, 5000),
                            error: error,
                            durationMs: durationMs,
                            executedAt: new Date().toISOString(),
                        };
                        this.persistPlan(plan);
                        (_g = (_f = this.callbacks) === null || _f === void 0 ? void 0 : _f.onTaskComplete) === null || _g === void 0 ? void 0 : _g.call(_f, task, taskResult);
                        return [2 /*return*/, taskResult];
                }
            });
        });
    };
    // ==================== 续跑 ====================
    Orchestrator.prototype.tryResumePlan = function (objectiveId) {
        try {
            // 按 uniquePath 规则查找最新版本：base.ext > base-1.ext > base-2.ext ...
            var dir = this.config.plansDir;
            var candidates = new Set();
            for (var _i = 0, _a = fs.readdirSync(dir); _i < _a.length; _i++) {
                var f = _a[_i];
                if (f === "".concat(objectiveId, ".plan.json") || f.startsWith("".concat(objectiveId, "-"))) {
                    candidates.add(f);
                }
            }
            if (candidates.size === 0)
                return null;
            // 按文件名排序（数字后缀越大越新）
            var sorted = __spreadArray([], candidates, true).sort(function (a, b) {
                var aNum = a === "".concat(objectiveId, ".plan.json") ? 0 : parseInt(a.slice("".concat(objectiveId, "-").length, -11), 10) || 0;
                var bNum = b === "".concat(objectiveId, ".plan.json") ? 0 : parseInt(b.slice("".concat(objectiveId, "-").length, -11), 10) || 0;
                return bNum - aNum;
            });
            for (var _b = 0, sorted_1 = sorted; _b < sorted_1.length; _b++) {
                var f = sorted_1[_b];
                var data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
                if (data.status === "executing" || data.status === "draft") {
                    return data;
                }
            }
        }
        catch ( /* ignore */_c) { /* ignore */ }
        return null;
    };
    Orchestrator.prototype.resumePlan = function (objective, plan, startTime) {
        return __awaiter(this, void 0, void 0, function () {
            var allTaskResults, allDiscussions, completedIds, pendingTasks, _i, pendingTasks_1, task, result, _a, _b, task, report;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        allTaskResults = [];
                        allDiscussions = __spreadArray([], plan.discussions, true);
                        completedIds = new Set(plan.tasks.filter(function (t) { var _a; return (_a = t.result) === null || _a === void 0 ? void 0 : _a.success; }).map(function (t) { return t.id; }));
                        pendingTasks = plan.tasks.filter(function (t) { return !completedIds.has(t.id); });
                        console.log("[Orchestrator] \u7EED\u8DD1: ".concat(pendingTasks.length, " \u4E2A\u4EFB\u52A1\u5F85\u6267\u884C"));
                        _i = 0, pendingTasks_1 = pendingTasks;
                        _c.label = 1;
                    case 1:
                        if (!(_i < pendingTasks_1.length)) return [3 /*break*/, 4];
                        task = pendingTasks_1[_i];
                        return [4 /*yield*/, this.executeTask(task, plan)];
                    case 2:
                        result = _c.sent();
                        allTaskResults.push(result);
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        // 收集已完成的任务结果
                        for (_a = 0, _b = plan.tasks; _a < _b.length; _a++) {
                            task = _b[_a];
                            if (task.result) {
                                allTaskResults.push({
                                    taskId: task.id,
                                    description: task.description,
                                    success: task.result.success,
                                    output: task.result.output,
                                    error: task.result.error,
                                    durationMs: task.result.durationMs,
                                });
                            }
                        }
                        plan.status = "completed";
                        this.persistPlan(plan);
                        report = this.buildReport(objective.id, startTime, allTaskResults, allDiscussions, "续跑完成");
                        this.persistReport(report);
                        return [2 /*return*/, report];
                }
            });
        });
    };
    // ==================== 报告 ====================
    Orchestrator.prototype.buildReport = function (objectiveId, startTime, taskResults, discussions, conclusion) {
        var successful = taskResults.filter(function (r) { return r.success; }).length;
        var failed = taskResults.filter(function (r) { return !r.success; }).length;
        return {
            planId: objectiveId,
            success: failed === 0,
            taskResults: taskResults,
            totalDurationMs: Date.now() - startTime,
            discussionRounds: discussions.length,
            conclusion: conclusion,
            finishedAt: new Date().toISOString(),
        };
    };
    // ==================== 持久化 ====================
    /**
     * 返回不覆盖已有文件的唯一路径。
     * 规则：先试 baseName.ext，若存在则 baseName-1.ext，再存在 baseName-2.ext，依此类推。
     */
    Orchestrator.prototype.uniquePath = function (dir, baseName, ext) {
        fs.mkdirSync(dir, { recursive: true });
        var candidate = path.join(dir, "".concat(baseName).concat(ext));
        var seq = 1;
        while (fs.existsSync(candidate)) {
            candidate = path.join(dir, "".concat(baseName, "-").concat(seq).concat(ext));
            seq++;
        }
        return candidate;
    };
    Orchestrator.prototype.persistPlan = function (plan) {
        try {
            var file = this.uniquePath(this.config.plansDir, plan.objectiveId, ".plan.json");
            var tmp = file + ".tmp";
            fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), "utf-8");
            fs.renameSync(tmp, file);
        }
        catch ( /* ignore */_a) { /* ignore */ }
    };
    /** 持久化执行报告 */
    Orchestrator.prototype.persistReport = function (report) {
        try {
            var file = this.uniquePath(this.config.plansDir, report.planId, ".report.json");
            var tmp = file + ".tmp";
            fs.writeFileSync(tmp, JSON.stringify(report, null, 2), "utf-8");
            fs.renameSync(tmp, file);
        }
        catch ( /* ignore */_a) { /* ignore */ }
    };
    return Orchestrator;
}());
export { Orchestrator };
export default Orchestrator;
