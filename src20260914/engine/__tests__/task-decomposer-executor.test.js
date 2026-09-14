/**
 * 任务拆解 + 执行器集成测试（mock 模式）
 *
 * 测试场景：
 *   1. static 模式拆解 → 验证子任务数量、依赖链
 *   2. executor 执行 → 用 mock runners 验证顺序执行 + 结果合并
 *   3. 自动重试 → 模拟失败 → 验证重试次数
 *   4. 断点续跑 → 标记部分完成 → 恢复后跳过
 *   5. 端到端 → 拆解 → 执行 → 持久化验证
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
import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { TaskDecomposer } from "../agent/task-decomposer.ts";
import { TaskExecutor } from "../agent/task-executor.ts";
var TEST_STATE_DIR = path.join(process.cwd(), ".kx2code", "tasks", "__test__");
// ==================== Mock Runners ====================
function createMockRunner(overrides) {
    var _this = this;
    if (overrides === void 0) { overrides = {}; }
    return __assign({ type: "local", description: "mock", execute: function (_args, _cwd) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, "mock result"];
            });
        }); } }, overrides);
}
var mockRunners = new Map([
    ["analyze", createMockRunner({ description: "代码分析", type: "llm" })],
    ["refactor", createMockRunner({ description: "重构", type: "llm" })],
    ["generate-test", createMockRunner({ description: "生成测试", type: "llm" })],
    ["test", createMockRunner({ description: "运行测试", type: "local" })],
    ["git-diff", createMockRunner({ description: "Git Diff", type: "local" })],
    ["review", createMockRunner({ description: "代码审查", type: "llm" })],
    ["lint", createMockRunner({ description: "代码检查", type: "local" })],
    ["fix", createMockRunner({ description: "修复 Bug", type: "llm" })],
    ["tree", createMockRunner({ description: "目录树", type: "local" })],
    ["generate-docs", createMockRunner({ description: "生成文档", type: "llm" })],
]);
function createExecutor(opts) {
    var _this = this;
    var _a;
    if (opts === void 0) { opts = {}; }
    var failingTool = opts.failingTool;
    return new TaskExecutor({
        stateDir: TEST_STATE_DIR,
        maxRetries: (_a = opts.maxRetries) !== null && _a !== void 0 ? _a : 0,
        runners: new Map(Array.from(mockRunners.entries()).map(function (_a) {
            var name = _a[0], runner = _a[1];
            return [
                name,
                createMockRunner(__assign(__assign({}, runner), { execute: function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i] = arguments[_i];
                        }
                        return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                if (name === failingTool) {
                                    throw new Error("\u6A21\u62DF\u5931\u8D25: ".concat(name));
                                }
                                return [2 /*return*/, "[".concat(name, "] \u6267\u884C\u6210\u529F: ").concat(((_a = args[0]) === null || _a === void 0 ? void 0 : _a.join(" ")) || "(无参数)")];
                            });
                        });
                    } })),
            ];
        })),
    });
}
// ==================== TaskDecomposer 测试 ====================
describe("TaskDecomposer", function () {
    beforeEach(function () {
        if (fs.existsSync(TEST_STATE_DIR)) {
            fs.rmSync(TEST_STATE_DIR, { recursive: true });
        }
    });
    it("重构类任务应拆为 4 个子任务", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("重构登录模块并写测试")];
                case 1:
                    plan = _a.sent();
                    expect(plan.subtasks.length).toBe(4);
                    expect(plan.subtasks[0].description).toContain("分析");
                    expect(plan.subtasks[1].description).toContain("重构");
                    expect(plan.subtasks[2].description).toContain("测试");
                    expect(plan.subtasks[3].description).toContain("验证");
                    expect(plan.mergeStrategy).toBe("sequential");
                    expect(plan.sessionId).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("修复 bug 类任务应有依赖链", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan, fixTask;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("修复认证模块的 bug")];
                case 1:
                    plan = _a.sent();
                    expect(plan.subtasks.length).toBeGreaterThanOrEqual(3);
                    fixTask = plan.subtasks.find(function (s) { return s.description.includes("修复"); });
                    expect(fixTask).toBeTruthy();
                    expect(fixTask.dependsOn.length).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
    it("代码审查类任务应拆为 2 个子任务", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("审查最近的代码变更")];
                case 1:
                    plan = _a.sent();
                    expect(plan.subtasks.length).toBe(2);
                    expect(plan.subtasks[0].toolHint).toBe("git-diff");
                    expect(plan.subtasks[1].toolHint).toBe("review");
                    return [2 /*return*/];
            }
        });
    }); });
    it("未知任务应降级为单任务", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("做点什么")];
                case 1:
                    plan = _a.sent();
                    expect(plan.subtasks.length).toBe(1);
                    expect(plan.mergeStrategy).toBe("single");
                    return [2 /*return*/];
            }
        });
    }); });
    it("计划应持久化到文件", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan, planFile, saved;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("重构登录模块")];
                case 1:
                    plan = _a.sent();
                    planFile = path.join(TEST_STATE_DIR, "".concat(plan.sessionId, ".plan.json"));
                    expect(fs.existsSync(planFile)).toBe(true);
                    saved = JSON.parse(fs.readFileSync(planFile, "utf-8"));
                    expect(saved.originalRequest).toBe("重构登录模块");
                    expect(saved.subtasks.length).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
});
// ==================== TaskExecutor 测试 ====================
describe("TaskExecutor", function () {
    beforeEach(function () {
        if (fs.existsSync(TEST_STATE_DIR)) {
            fs.rmSync(TEST_STATE_DIR, { recursive: true });
        }
    });
    it("应顺序执行所有子任务并合并结果", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan, executor, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("重构登录模块并写测试")];
                case 1:
                    plan = _a.sent();
                    executor = createExecutor();
                    return [4 /*yield*/, executor.execute(plan, {
                            onProgress: function (current, total) {
                                expect(current).toBeGreaterThan(0);
                                expect(current).toBeLessThanOrEqual(total);
                            },
                        })];
                case 2:
                    result = _a.sent();
                    expect(result.subtaskResults.length).toBe(4);
                    expect(result.output).toContain("任务执行结果");
                    expect(result.output).toContain("重构登录模块并写测试");
                    return [2 /*return*/];
            }
        });
    }); });
    it("应记录每个子任务的执行时长", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan, executor, result, _i, _a, sr;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("重构登录模块")];
                case 1:
                    plan = _b.sent();
                    executor = createExecutor();
                    return [4 /*yield*/, executor.execute(plan)];
                case 2:
                    result = _b.sent();
                    for (_i = 0, _a = result.subtaskResults; _i < _a.length; _i++) {
                        sr = _a[_i];
                        expect(sr.durationMs).toBeGreaterThanOrEqual(0);
                    }
                    return [2 /*return*/];
            }
        });
    }); });
    it("结果应持久化为 .done 文件", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan, executor, doneFile, status;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("重构登录模块")];
                case 1:
                    plan = _a.sent();
                    executor = createExecutor();
                    return [4 /*yield*/, executor.execute(plan)];
                case 2:
                    _a.sent();
                    doneFile = path.join(TEST_STATE_DIR, "".concat(plan.sessionId, ".done"));
                    expect(fs.existsSync(doneFile)).toBe(true);
                    status = fs.readFileSync(doneFile, "utf-8");
                    expect(["SUCCESS", "FAILED"]).toContain(status);
                    return [2 /*return*/];
            }
        });
    }); });
    it("崩溃后应能从断点续跑", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan, executor, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("重构登录模块并写测试")
                        // 模拟：手动标记前两个子任务已完成
                        // 直接修改 in-memory plan，模拟之前执行过留下的结果
                    ];
                case 1:
                    plan = _a.sent();
                    // 模拟：手动标记前两个子任务已完成
                    // 直接修改 in-memory plan，模拟之前执行过留下的结果
                    plan.subtasks[0].result = { success: true, output: "步骤1完成", durationMs: 100 };
                    plan.subtasks[1].result = { success: true, output: "步骤2完成", durationMs: 200 };
                    executor = createExecutor();
                    return [4 /*yield*/, executor.execute(plan)];
                case 2:
                    result = _a.sent();
                    expect(result.subtaskResults.length).toBe(4);
                    // 前两个应保留原始结果（跳过重执行）
                    expect(result.subtaskResults[0].success).toBe(true);
                    expect(result.subtaskResults[0].output).toBe("步骤1完成");
                    expect(result.subtaskResults[1].success).toBe(true);
                    expect(result.subtaskResults[1].output).toBe("步骤2完成");
                    return [2 /*return*/];
            }
        });
    }); });
    it("失败子任务应自动重试", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan, executor, result, failed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("重构登录模块")];
                case 1:
                    plan = _a.sent();
                    executor = createExecutor({ maxRetries: 2, failingTool: "analyze" });
                    return [4 /*yield*/, executor.execute(plan)
                        // analyze 失败 3 次（1 + 2 次重试），应标记为失败
                        // 注意：executeSubtask 异常被 catch 后 output 为空，通过 error 字段判断
                    ];
                case 2:
                    result = _a.sent();
                    failed = result.subtaskResults.filter(function (r) { return !r.success; });
                    expect(failed.length).toBeGreaterThanOrEqual(1);
                    expect(failed[0].error).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("单任务计划应直接返回结果", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan, executor, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("做点什么")];
                case 1:
                    plan = _a.sent();
                    executor = createExecutor();
                    return [4 /*yield*/, executor.execute(plan)];
                case 2:
                    result = _a.sent();
                    expect(result.subtaskResults.length).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
});
// ==================== 端到端集成测试 ====================
describe("端到端流程", function () {
    beforeEach(function () {
        if (fs.existsSync(TEST_STATE_DIR)) {
            fs.rmSync(TEST_STATE_DIR, { recursive: true });
        }
    });
    it("完整流程：拆解 → 执行 → 校验 → 持久化", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan, executor, result, resultFile, savedResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("重构 auth 模块并写测试")];
                case 1:
                    plan = _a.sent();
                    expect(plan.subtasks.length).toBeGreaterThanOrEqual(3);
                    expect(plan.mergeStrategy).toBe("sequential");
                    expect(plan.sessionId).toBeTruthy();
                    executor = createExecutor();
                    return [4 /*yield*/, executor.execute(plan, {
                            onProgress: function (current, total, subtask) {
                                expect(current).toBeGreaterThan(0);
                                expect(current).toBeLessThanOrEqual(total);
                                expect(subtask.description.length).toBeGreaterThan(0);
                            },
                        })
                        // 3. 校验
                    ];
                case 2:
                    result = _a.sent();
                    // 3. 校验
                    expect(result.subtaskResults.length).toBe(plan.subtasks.length);
                    expect(result.totalDurationMs).toBeGreaterThan(0);
                    resultFile = path.join(TEST_STATE_DIR, "".concat(plan.sessionId, ".result.json"));
                    expect(fs.existsSync(resultFile)).toBe(true);
                    savedResult = JSON.parse(fs.readFileSync(resultFile, "utf-8"));
                    expect(savedResult.subtaskCount).toBe(plan.subtasks.length);
                    expect(savedResult.finishedAt).toBeTruthy();
                    expect(["SUCCESS", "FAILED"]).toContain(fs.readFileSync(path.join(TEST_STATE_DIR, "".concat(plan.sessionId, ".done")), "utf-8"));
                    return [2 /*return*/];
            }
        });
    }); });
    it("审查类任务的完整流程", function () { return __awaiter(void 0, void 0, void 0, function () {
        var decomposer, plan, executor, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decomposer = new TaskDecomposer({
                        mode: "static",
                        stateDir: TEST_STATE_DIR,
                    });
                    return [4 /*yield*/, decomposer.decompose("审查最近的代码变更")];
                case 1:
                    plan = _a.sent();
                    executor = createExecutor();
                    return [4 /*yield*/, executor.execute(plan)];
                case 2:
                    result = _a.sent();
                    expect(result.subtaskResults.length).toBe(2);
                    expect(result.subtaskResults[0].output).toContain("git-diff");
                    expect(result.subtaskResults[1].output).toContain("review");
                    return [2 /*return*/];
            }
        });
    }); });
});
