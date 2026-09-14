/**
 * Coordinator 模块集成测试
 *
 * 策略：override Planner.callLLM 直接 mock LLM 响应
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
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { Orchestrator } from "../agent/coordinator/orchestrator.ts";
var TEST_PLANS_DIR = path.join(process.cwd(), ".kx2code", "plans", "__test__");
// ==================== LLM Mock ====================
var PLAN_RESPONSE = JSON.stringify({
    title: "测试计划",
    description: "测试描述",
    tasks: [
        { id: "task-1", description: "分析目标", command: "analyze", args: [], dependsOn: [], strategy: "sequential", priority: 1, validate: "输出分析结果" },
        { id: "task-2", description: "实施方案", command: "refactor", args: [], dependsOn: ["task-1"], strategy: "sequential", priority: 2, validate: "输出实施结果" },
    ],
});
var APPROVED_RESPONSE = "APPROVED";
// 直接 override Planner.prototype.callLLM（跳过 execSync）
import { Planner } from "../agent/coordinator/planner.ts";
var originalCallLLM = Planner.prototype.callLLM;
beforeEach(function () {
    if (fs.existsSync(TEST_PLANS_DIR)) {
        fs.rmSync(TEST_PLANS_DIR, { recursive: true });
    }
    // 每个测试前重新应用 mock
    Planner.prototype.callLLM = function (role, prompt) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (prompt.includes("汇总为一份可执行的 Plan")) {
                    return [2 /*return*/, PLAN_RESPONSE];
                }
                if (prompt.includes("审查以下计划")) {
                    return [2 /*return*/, APPROVED_RESPONSE];
                }
                if (prompt.includes("请提出你的初步想法")) {
                    if (role.id === "planner") {
                        return [2 /*return*/, "建议分三步：分析现状 → 实施方案 → 验证结果"];
                    }
                    return [2 /*return*/, "同意规划师思路，建议加入代码质量检查"];
                }
                // debate 阶段
                return [2 /*return*/, "补充意见：建议加入自动化测试环节"];
            });
        });
    };
});
afterEach(function () {
    // 恢复原始方法
    Planner.prototype.callLLM = originalCallLLM;
});
// ==================== 测试 ====================
describe("Orchestrator", function () {
    it("应执行单目标并返回报告", function () { return __awaiter(void 0, void 0, void 0, function () {
        var orchestrator, report;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    orchestrator = new Orchestrator({
                        llm: { provider: "openai", apiKey: "test-key", model: "gpt-4" },
                        maxDiscussionRounds: 1,
                        maxRetries: 0,
                        plansDir: TEST_PLANS_DIR,
                        cwd: process.cwd(),
                    }, {
                        onPhaseChange: function (phase, detail) { return console.log("  [test] ".concat(phase, ": ").concat(detail)); },
                        onTaskStart: function (task) { return console.log("  [test] start: ".concat(task.description)); },
                        onTaskComplete: function (task, result) { return console.log("  [test] done: ".concat(task.description, " (").concat(result.success, ")")); },
                    });
                    return [4 /*yield*/, orchestrator.execute({ id: "obj-1", description: "重构登录模块" })];
                case 1:
                    report = _a.sent();
                    expect(report.planId).toBe("obj-1");
                    expect(report.finishedAt).toBeTruthy();
                    expect(report.totalDurationMs).toBeGreaterThan(0);
                    expect(report.taskResults.length).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
    it("应执行多子目标", function () { return __awaiter(void 0, void 0, void 0, function () {
        var orchestrator, report;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    orchestrator = new Orchestrator({
                        llm: { provider: "openai", apiKey: "test-key", model: "gpt-4" },
                        maxDiscussionRounds: 1,
                        maxRetries: 0,
                        plansDir: TEST_PLANS_DIR,
                        cwd: process.cwd(),
                    });
                    return [4 /*yield*/, orchestrator.execute({
                            id: "obj-multi",
                            description: "多目标测试",
                            subObjectives: [
                                { id: "sub-1", description: "子目标1" },
                                { id: "sub-2", description: "子目标2" },
                            ],
                        })];
                case 1:
                    report = _a.sent();
                    expect(report.taskResults.length).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
    it("报告应持久化到磁盘", function () { return __awaiter(void 0, void 0, void 0, function () {
        var orchestrator, report, reportFile, saved;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    orchestrator = new Orchestrator({
                        llm: { provider: "openai", apiKey: "test-key", model: "gpt-4" },
                        maxDiscussionRounds: 1,
                        maxRetries: 0,
                        plansDir: TEST_PLANS_DIR,
                        cwd: process.cwd(),
                    });
                    return [4 /*yield*/, orchestrator.execute({ id: "obj-persist", description: "测试持久化" })];
                case 1:
                    report = _a.sent();
                    orchestrator.persistReport(report);
                    reportFile = path.join(TEST_PLANS_DIR, "obj-persist.report.json");
                    expect(fs.existsSync(reportFile)).toBe(true);
                    saved = JSON.parse(fs.readFileSync(reportFile, "utf-8"));
                    expect(saved.planId).toBe("obj-persist");
                    expect(saved.finishedAt).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("断点续跑应恢复未完成的计划", function () { return __awaiter(void 0, void 0, void 0, function () {
        var partialPlan, orchestrator, report;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    partialPlan = {
                        id: "plan-resume",
                        objectiveId: "obj-resume",
                        title: "续跑测试",
                        description: "测试续跑",
                        tasks: [
                            {
                                id: "task-1",
                                description: "已完成的任务",
                                strategy: "sequential",
                                priority: 1,
                                dependsOn: [],
                                result: { success: true, output: "已完成", durationMs: 100, executedAt: new Date().toISOString() },
                            },
                            {
                                id: "task-2",
                                description: "待执行的任务",
                                strategy: "sequential",
                                priority: 2,
                                dependsOn: ["task-1"],
                            },
                        ],
                        discussions: [],
                        createdAt: new Date().toISOString(),
                        status: "executing",
                        version: 1,
                    };
                    fs.mkdirSync(TEST_PLANS_DIR, { recursive: true });
                    fs.writeFileSync(path.join(TEST_PLANS_DIR, "obj-resume.plan.json"), JSON.stringify(partialPlan));
                    orchestrator = new Orchestrator({
                        llm: { provider: "openai", apiKey: "test-key", model: "gpt-4" },
                        maxDiscussionRounds: 1,
                        maxRetries: 0,
                        plansDir: TEST_PLANS_DIR,
                        cwd: process.cwd(),
                    });
                    return [4 /*yield*/, orchestrator.execute({ id: "obj-resume", description: "续跑测试" })];
                case 1:
                    report = _a.sent();
                    expect(report.planId).toBe("obj-resume");
                    expect(report.finishedAt).toBeTruthy();
                    expect(report.taskResults.length).toBeGreaterThanOrEqual(1);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("端到端集成", function () {
    it("完整流程：目标 → 规划 → 执行 → 报告", function () { return __awaiter(void 0, void 0, void 0, function () {
        var orchestrator, report, subPlanFile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    orchestrator = new Orchestrator({
                        llm: { provider: "openai", apiKey: "test-key", model: "gpt-4" },
                        maxDiscussionRounds: 1,
                        maxRetries: 1,
                        plansDir: TEST_PLANS_DIR,
                        cwd: process.cwd(),
                    }, {
                        onPhaseChange: function (phase, detail) { return console.log("  [e2e] ".concat(phase, ": ").concat(detail)); },
                        onTaskStart: function (task) { return console.log("  [e2e] start: ".concat(task.description)); },
                        onTaskComplete: function (task, result) { return console.log("  [e2e] done: ".concat(task.description, " (").concat(result.success, ")")); },
                    });
                    return [4 /*yield*/, orchestrator.execute({
                            id: "e2e-obj",
                            description: "重构 auth 模块并写测试",
                            priority: 1,
                            subObjectives: [
                                { id: "sub-analysis", description: "分析现有 auth 模块", priority: 1 },
                                { id: "sub-refactor", description: "重构 auth 模块", priority: 2 },
                            ],
                        })];
                case 1:
                    report = _a.sent();
                    expect(report.planId).toBe("e2e-obj");
                    expect(report.finishedAt).toBeTruthy();
                    expect(report.totalDurationMs).toBeGreaterThan(0);
                    expect(report.taskResults.length).toBeGreaterThan(0);
                    subPlanFile = path.join(TEST_PLANS_DIR, "sub-analysis.plan.json");
                    expect(fs.existsSync(subPlanFile)).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
});
