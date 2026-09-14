/**
 * Agent Dispatcher - 统一处理所有 needsAgent 命令
 *
 * 执行链路升级（v2 — 任务拆解 + 结果校验）：
 *   team / llm 类型 → TaskDecomposer 拆解为子任务 → TaskExecutor 顺序执行 + 校验 → 合并结果
 *   local 类型       → 直接执行（不变）
 *
 * 新增能力：
 *   1. 复杂任务自动拆解（静态规则 + LLM 动态拆解）
 *   2. 子任务依赖管理（上一步结果传给下一步）
 *   3. 自动重试（失败 N 次自动重跑）
 *   4. 结果校验（每个子任务完成后验证输出）
 *   5. 结果合并（所有子任务输出合并为最终报告）
 *   6. 断点续跑（崩溃后从上次完成处继续）
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
import { sendMessageStream } from '../api/client.ts';
import { commandRunners } from './command-runners.ts';
import { TaskDecomposer } from './task-decomposer.ts';
import { TaskExecutor } from './task-executor.ts';
import * as path from "node:path";
var AgentDispatcher = /** @class */ (function () {
    function AgentDispatcher(config) {
        this.config = config;
    }
    /**
     * 分发命令到对应的实现
     */
    AgentDispatcher.prototype.dispatch = function (commandName, args, context) {
        return __awaiter(this, void 0, void 0, function () {
            var runner, _a, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        runner = commandRunners.get(commandName);
                        if (!runner) {
                            return [2 /*return*/, {
                                    success: false,
                                    output: '',
                                    error: "\u672A\u77E5\u547D\u4EE4: /".concat(commandName),
                                    agentUsed: 'unknown',
                                }];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 11, , 12]);
                        _a = runner.type;
                        switch (_a) {
                            case 'team': return [3 /*break*/, 2];
                            case 'llm': return [3 /*break*/, 4];
                            case 'local': return [3 /*break*/, 6];
                        }
                        return [3 /*break*/, 8];
                    case 2: return [4 /*yield*/, this.dispatchWithDecomposition(runner, commandName, args, context)];
                    case 3: return [2 /*return*/, _b.sent()];
                    case 4: return [4 /*yield*/, this.dispatchWithDecomposition(runner, commandName, args, context)];
                    case 5: return [2 /*return*/, _b.sent()];
                    case 6: return [4 /*yield*/, this.dispatchLocal(runner, commandName, args, context)];
                    case 7: return [2 /*return*/, _b.sent()];
                    case 8: return [4 /*yield*/, this.dispatchLocal(runner, commandName, args, context)];
                    case 9: return [2 /*return*/, _b.sent()];
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        e_1 = _b.sent();
                        return [2 /*return*/, {
                                success: false,
                                output: '',
                                error: "".concat(runner.description, "\u6267\u884C\u5931\u8D25: ").concat(e_1.message),
                                agentUsed: runner.type,
                            }];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    // ==================== 任务拆解 + 执行链路 ====================
    /**
     * 对 team/llm 类型命令启用任务拆解：
     * 1. TaskDecomposer 拆解为子任务
     * 2. TaskExecutor 顺序执行 + 校验 + 重试
     * 3. 合并结果为最终输出
     */
    AgentDispatcher.prototype.dispatchWithDecomposition = function (runner, commandName, args, context) {
        return __awaiter(this, void 0, void 0, function () {
            var cwd, fullRequest, contextOutput, availableTools, decomposer, plan, output, executorOpts, executor, executeResult;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cwd = this.getCwd(context);
                        fullRequest = args.join(' ') || runner.description;
                        if (!(runner.type === 'llm' && !this.config.apiKey)) return [3 /*break*/, 2];
                        return [4 /*yield*/, runner.execute(args, cwd, this.config)];
                    case 1:
                        contextOutput = _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                output: "[AI \u5F85\u6267\u884C] \u547D\u4EE4: /".concat(commandName, "\n\u53C2\u6570: ").concat(args.join(' ') || '(无)', "\n\n\u4E0A\u4E0B\u6587\u4FE1\u606F:\n").concat(contextOutput.slice(0, 2000), "\n\n\u63D0\u793A: \u914D\u7F6E API key \u540E\u5C06\u81EA\u52A8\u8C03\u7528 LLM \u6267\u884C\u3002"),
                                agentUsed: "llm(pending)",
                            }];
                    case 2:
                        availableTools = Array.from(commandRunners.entries()).map(function (_a) {
                            var name = _a[0], r = _a[1];
                            return ({
                                name: name,
                                description: r.description,
                            });
                        });
                        decomposer = new TaskDecomposer({
                            mode: 'static',
                            availableTools: availableTools,
                            stateDir: path.join(cwd, '.kx2code', 'tasks'),
                            llmCall: this.config.apiKey
                                ? function (systemPrompt, userPrompt) { return __awaiter(_this, void 0, void 0, function () {
                                    var output;
                                    var _this = this;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                output = '';
                                                return [4 /*yield*/, new Promise(function (resolve, reject) {
                                                        sendMessageStream({
                                                            provider: _this.config.provider,
                                                            apiKey: _this.config.apiKey,
                                                            model: _this.config.model,
                                                            baseUrl: _this.config.baseUrl,
                                                            maxTokens: 1024,
                                                        }, [
                                                            { role: 'system', content: systemPrompt },
                                                            { role: 'user', content: userPrompt },
                                                        ], {
                                                            onText: function (chunk) { output += chunk; },
                                                            onDone: function () { resolve(); },
                                                            onError: function (err) { reject(new Error(err)); },
                                                        });
                                                    })];
                                            case 1:
                                                _a.sent();
                                                return [2 /*return*/, output];
                                        }
                                    });
                                }); }
                                : undefined,
                        });
                        return [4 /*yield*/, decomposer.decompose(fullRequest)
                            // 单任务：直接执行 runner
                        ];
                    case 3:
                        plan = _a.sent();
                        if (!(plan.subtasks.length === 1 && !plan.subtasks[0].toolHint)) return [3 /*break*/, 5];
                        return [4 /*yield*/, runner.execute(args, cwd, this.config)];
                    case 4:
                        output = _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                output: output,
                                agentUsed: "".concat(runner.type === 'team' ? 'Team' : runner.type, "(").concat(commandName, ")"),
                                plan: plan,
                            }];
                    case 5:
                        executorOpts = {
                            cwd: cwd,
                            maxRetries: 2,
                            stateDir: path.join(cwd, '.kx2code', 'tasks'),
                            llmConfig: this.config.apiKey
                                ? {
                                    provider: this.config.provider,
                                    apiKey: this.config.apiKey,
                                    model: this.config.model,
                                    baseUrl: this.config.baseUrl,
                                    maxTokens: 4096,
                                }
                                : undefined,
                        };
                        executor = new TaskExecutor(executorOpts);
                        return [4 /*yield*/, executor.execute(plan, {
                                onProgress: function (current, total, subtask) {
                                    console.log("[Dispatcher] \u8FDB\u5EA6: ".concat(current, "/").concat(total, " \u2014 ").concat(subtask.description));
                                },
                                onComplete: function (result) {
                                    console.log("[Dispatcher] \u6267\u884C\u5B8C\u6BD5: \u6210\u529F ".concat(result.subtaskResults.filter(function (r) { return r.success; }).length, "/").concat(result.subtaskResults.length));
                                },
                            })];
                    case 6:
                        executeResult = _a.sent();
                        return [2 /*return*/, {
                                success: executeResult.success,
                                output: executeResult.output,
                                error: executeResult.failedSubtasks.length > 0 ? "".concat(executeResult.failedSubtasks.length, " \u4E2A\u5B50\u4EFB\u52A1\u5931\u8D25") : '',
                                agentUsed: "".concat(runner.type === 'team' ? 'Team' : runner.type, "(").concat(commandName, ")"),
                                plan: plan,
                                executeResult: executeResult,
                            }];
                }
            });
        });
    };
    // ==================== 原有的执行策略 ====================
    /**
     * Team 策略：使用多角色协作处理复杂任务
     */
    AgentDispatcher.prototype.dispatchTeam = function (runner, commandName, args, context) {
        return __awaiter(this, void 0, void 0, function () {
            var cwd, output;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cwd = this.getCwd(context);
                        return [4 /*yield*/, runner.execute(args, cwd, this.config)];
                    case 1:
                        output = _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                output: output,
                                agentUsed: "Team(".concat(commandName, ")"),
                            }];
                }
            });
        });
    };
    /**
     * LLM 策略：构建专用 prompt 交给 LLM 执行
     */
    AgentDispatcher.prototype.dispatchLLM = function (runner, commandName, args, context) {
        return __awaiter(this, void 0, void 0, function () {
            var cwd, contextOutput, systemPrompt, userPrompt, output, e_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cwd = this.getCwd(context);
                        return [4 /*yield*/, runner.execute(args, cwd, this.config)];
                    case 1:
                        contextOutput = _a.sent();
                        if (!this.config.apiKey) {
                            return [2 /*return*/, {
                                    success: true,
                                    output: "[AI \u5F85\u6267\u884C] \u547D\u4EE4: /".concat(commandName, "\n\u53C2\u6570: ").concat(args.join(' ') || '(无)', "\n\n\u4E0A\u4E0B\u6587\u4FE1\u606F:\n").concat(contextOutput.slice(0, 2000), "\n\n\u63D0\u793A: \u914D\u7F6E API key \u540E\u5C06\u81EA\u52A8\u8C03\u7528 LLM \u6267\u884C\u3002"),
                                    agentUsed: 'llm(pending)',
                                }];
                        }
                        systemPrompt = this.buildSystemPrompt(runner.description);
                        userPrompt = this.buildUserPrompt(commandName, args, contextOutput);
                        output = '';
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, Promise.race([
                                new Promise(function (resolve, reject) {
                                    sendMessageStream(__assign(__assign({}, _this.config), { maxTokens: 4096 }), [
                                        { role: 'system', content: systemPrompt },
                                        { role: 'user', content: userPrompt },
                                    ], {
                                        onText: function (chunk) { output += chunk; },
                                        onDone: function () { resolve(); },
                                        onError: function (err) { reject(new Error(err)); },
                                    });
                                }),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error("".concat(runner.description, "\u6267\u884C\u8D85\u65F6\uFF0830s\uFF09"))); }, 30000);
                                }),
                            ])];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                output: output || "".concat(runner.description, "\u5B8C\u6210\uFF0C\u65E0\u8F93\u51FA"),
                                agentUsed: "llm(".concat(commandName, ")"),
                            }];
                    case 4:
                        e_2 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                output: contextOutput,
                                error: "".concat(runner.description, "\u6267\u884C\u5931\u8D25: ").concat(e_2.message),
                                agentUsed: "llm(".concat(commandName, ")"),
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 本地策略：直接执行本地命令
     */
    AgentDispatcher.prototype.dispatchLocal = function (runner, commandName, args, context) {
        return __awaiter(this, void 0, void 0, function () {
            var cwd, output;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cwd = this.getCwd(context);
                        return [4 /*yield*/, runner.execute(args, cwd, this.config)];
                    case 1:
                        output = _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                output: output,
                                agentUsed: "local(".concat(commandName, ")"),
                            }];
                }
            });
        });
    };
    // ==================== Prompt 构建 ====================
    AgentDispatcher.prototype.buildSystemPrompt = function (commandDesc) {
        return "\u4F60\u662F KX2Code \u7684 AI \u4EE3\u7406\u6267\u884C\u5668\u3002\u4F60\u6B63\u5728\u6267\u884C\"".concat(commandDesc, "\"\u4EFB\u52A1\u3002\n\n\u8BF7\u9075\u5FAA\u4EE5\u4E0B\u539F\u5219\uFF1A\n1. \u5206\u6790\u63D0\u4F9B\u7684\u4E0A\u4E0B\u6587\u4FE1\u606F\uFF08\u4EE3\u7801\u3001diff\u3001\u9519\u8BEF\u4FE1\u606F\u7B49\uFF09\n2. \u63D0\u4F9B\u5177\u4F53\u7684\u3001\u53EF\u6267\u884C\u7684\u5EFA\u8BAE\u6216\u4EE3\u7801\n3. \u5982\u679C\u53D1\u73B0\u95EE\u9898\uFF0C\u7ED9\u51FA\u8BE6\u7EC6\u7684\u4FEE\u590D\u65B9\u6848\n4. \u4F7F\u7528\u4E2D\u6587\u56DE\u7B54\uFF0C\u9664\u975E\u7528\u6237\u660E\u786E\u8981\u6C42\u82F1\u6587\n5. \u4EE3\u7801\u793A\u4F8B\u4F7F\u7528 Markdown \u4EE3\u7801\u5757\u683C\u5F0F");
    };
    AgentDispatcher.prototype.buildUserPrompt = function (commandName, args, contextOutput) {
        var lines = [];
        lines.push("\u6267\u884C\u547D\u4EE4: /".concat(commandName));
        if (args.length > 0) {
            lines.push("\u53C2\u6570: ".concat(args.join(' ')));
        }
        lines.push('');
        lines.push('上下文信息:');
        lines.push('```');
        lines.push(contextOutput.slice(0, 10000));
        lines.push('```');
        lines.push('');
        lines.push('请分析以上信息并提供详细结果。');
        return lines.join('\n');
    };
    // ==================== 工具方法 ====================
    /**
     * 获取命令的执行类型
     */
    AgentDispatcher.prototype.getRunnerType = function (commandName) {
        var runner = commandRunners.get(commandName);
        return runner === null || runner === void 0 ? void 0 : runner.type;
    };
    /**
     * 获取所有已注册的命令名
     */
    AgentDispatcher.prototype.getRegisteredCommands = function () {
        return Array.from(commandRunners.keys());
    };
    AgentDispatcher.prototype.getCwd = function (context) {
        if ((context === null || context === void 0 ? void 0 : context.cwd) && typeof context.cwd === 'string') {
            return context.cwd;
        }
        return process.cwd();
    };
    return AgentDispatcher;
}());
export { AgentDispatcher };
