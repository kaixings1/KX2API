/**
 * engine/core.ts — 简化版 QueryEngine 核心
 *
 * 职责：
 * - 管理对话历史
 * - 调用 API 客户端
 * - 处理流式响应
 * - 执行命令
 *
 * 设计目标：轻量、无死循环、可扩展
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
import { sendMessageStream } from './api/client.ts';
import { commandRegistry } from './commands/registry.ts';
import { toolCollection } from '../main/proxy/tools/toolCollection.ts';
import { Team } from '../main/agent/team/team.ts';
var QueryEngine = /** @class */ (function () {
    function QueryEngine(config) {
        this.history = [];
        this.systemPrompt = '你是 KX2Code，一个智能编程助手。你可以使用工具帮助用户。当用户用中文提问时，请用中文回答。当用户询问文件、代码或项目结构时，请提供有用的分析和建议。';
        this.config = config;
    }
    QueryEngine.prototype.updateConfig = function (config) {
        this.config = __assign(__assign({}, this.config), config);
    };
    QueryEngine.prototype.getMaxToolRounds = function () {
        return this.config.maxToolRounds || 5;
    };
    QueryEngine.prototype.getHistory = function () {
        return { messages: this.history.map(function (m) { return ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }); }) };
    };
    QueryEngine.prototype.clearHistory = function () {
        this.history = [];
    };
    QueryEngine.prototype.addMessage = function (msg) {
        this.history.push(msg);
    };
    QueryEngine.prototype.query = function (text, _signal, onStream) {
        return __awaiter(this, void 0, void 0, function () {
            var trimmed, result, cmdName, cmdArgs, cmd, result, output, userMsg, apiMessages, fullContent, toolCalls, assistantMsg;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        trimmed = text.trim();
                        if (!trimmed.startsWith('/team ')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.runTeamMode(trimmed.slice(6).trim())];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, { content: result, toolCalls: [] }];
                    case 2:
                        if (!trimmed.startsWith('/')) return [3 /*break*/, 4];
                        cmdName = trimmed.split(' ')[0].slice(1);
                        cmdArgs = trimmed.slice(cmdName.length + 1).trim().split(' ').filter(Boolean);
                        cmd = commandRegistry.get(cmdName);
                        if (!cmd) return [3 /*break*/, 4];
                        return [4 /*yield*/, cmd.execute(cmdArgs)];
                    case 3:
                        result = _a.sent();
                        output = result.error || result.output || '命令执行完成';
                        return [2 /*return*/, { content: output, toolCalls: [] }];
                    case 4:
                        userMsg = { role: 'user', content: text };
                        this.addMessage(userMsg);
                        apiMessages = __spreadArray([
                            { role: 'system', content: this.systemPrompt }
                        ], this.history.slice(-50), true);
                        fullContent = '';
                        toolCalls = [];
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                sendMessageStream({
                                    provider: _this.config.provider,
                                    apiKey: _this.config.apiKey,
                                    model: _this.config.model,
                                    baseUrl: _this.config.baseUrl,
                                    maxTokens: _this.config.maxTokens,
                                    maxRepeat: _this.config.maxRepeat,
                                }, apiMessages, {
                                    onText: function (chunk) {
                                        fullContent += chunk;
                                        if (onStream)
                                            onStream(chunk);
                                    },
                                    onToolUse: function (block) { toolCalls.push(block); },
                                    onDone: function () { resolve(); },
                                    onError: function (err) { reject(new Error(err)); },
                                }, _signal);
                            })];
                    case 5:
                        _a.sent();
                        assistantMsg = { role: 'assistant', content: fullContent };
                        this.addMessage(assistantMsg);
                        return [2 /*return*/, { content: fullContent, toolCalls: toolCalls }];
                }
            });
        });
    };
    /**
     * 执行命令（/xxx 格式）
     */
    QueryEngine.prototype.executeCommand = function (name, args) {
        return __awaiter(this, void 0, void 0, function () {
            var trimmed, result, cmd, result, agentResult, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        trimmed = name.startsWith('/') ? name.slice(1) : name;
                        if (!(trimmed === 'team')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.runTeamMode(args.join(' ') || '未指定任务')];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, { success: true, output: result }];
                    case 2:
                        cmd = toolCollection.getTool(trimmed) || commandRegistry.get(trimmed);
                        if (!cmd) return [3 /*break*/, 8];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 7, , 8]);
                        return [4 /*yield*/, cmd.execute(args)
                            // needsAgent 命令：通过 AgentDispatcher 实际执行
                        ];
                    case 4:
                        result = _a.sent();
                        if (!result.needsAgent) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.runAgentCommand(trimmed, args)];
                    case 5:
                        agentResult = _a.sent();
                        return [2 /*return*/, {
                                success: agentResult.success,
                                output: agentResult.output,
                                error: agentResult.error,
                                needsAgent: true,
                            }];
                    case 6: return [2 /*return*/, {
                            success: result.success,
                            output: result.error || result.output || '命令执行完成',
                            error: result.error,
                            needsAgent: result.needsAgent,
                        }];
                    case 7:
                        e_1 = _a.sent();
                        return [2 /*return*/, { success: false, output: '', error: e_1.message }];
                    case 8: return [2 /*return*/, { success: false, output: '', error: "\u672A\u77E5\u547D\u4EE4: /".concat(trimmed) }];
                }
            });
        });
    };
    QueryEngine.prototype.getConfig = function () {
        return __assign({}, this.config);
    };
    /**
     * Team 多角色协作模式
     * 统一管理 Lead + Engineer 角色配置，避免重复代码
     */
    QueryEngine.prototype.runTeamMode = function (task) {
        return __awaiter(this, void 0, void 0, function () {
            var team;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        team = new Team({
                            mode: 'team',
                            roles: [
                                {
                                    id: 'lead',
                                    name: '组长',
                                    profile: '团队领导',
                                    goal: '协调团队成员并有效分配任务',
                                    constraints: ['始终将任务分配给合适的团队成员', '确保任务完成'],
                                },
                                {
                                    id: 'engineer',
                                    name: '工程师',
                                    profile: '软件工程师',
                                    goal: '基于需求实现解决方案',
                                    constraints: ['编写整洁、可维护的代码', '遵循最佳实践'],
                                },
                            ],
                            leadRole: 'lead',
                            maxRounds: 3,
                        });
                        return [4 /*yield*/, team.process(task)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Agent 命令执行（v2 — 任务拆解 + 结果校验 + 自动续跑）
     *
     * 执行链路：
     *   team/llm 类型 → TaskDecomposer 拆解 → TaskExecutor 执行(含校验/重试/续跑) → 合并结果
     *   local 类型     → 直接执行
     */
    QueryEngine.prototype.runAgentCommand = function (commandName, args) {
        return __awaiter(this, void 0, void 0, function () {
            var AgentDispatcher, dispatcher, result, cmd, cmdResult, e_2, response, plan;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, import('./agent/dispatcher.ts')];
                    case 1:
                        AgentDispatcher = (_e.sent()).AgentDispatcher;
                        dispatcher = new AgentDispatcher({
                            provider: this.config.provider,
                            apiKey: this.config.apiKey,
                            model: this.config.model,
                            baseUrl: this.config.baseUrl,
                            maxTokens: this.config.maxTokens,
                        });
                        return [4 /*yield*/, dispatcher.dispatch(commandName, args)
                            // 如果 dispatcher 不认识该命令，回退到 commandRegistry 直接执行
                        ];
                    case 2:
                        result = _e.sent();
                        if (!(!result.success && ((_a = result.error) === null || _a === void 0 ? void 0 : _a.includes('未知命令')))) return [3 /*break*/, 6];
                        cmd = commandRegistry.get(commandName);
                        if (!cmd) return [3 /*break*/, 6];
                        _e.label = 3;
                    case 3:
                        _e.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, cmd.execute(args)];
                    case 4:
                        cmdResult = _e.sent();
                        return [2 /*return*/, {
                                success: cmdResult.success,
                                output: cmdResult.output || cmdResult.error || '命令执行完成',
                                error: cmdResult.error,
                                needsAgent: cmdResult.needsAgent,
                            }];
                    case 5:
                        e_2 = _e.sent();
                        return [2 /*return*/, { success: false, output: '', error: e_2.message }];
                    case 6:
                        response = {
                            success: result.success,
                            output: result.output,
                            error: result.error,
                            needsAgent: true,
                        };
                        // 如果有拆解计划，附带计划摘要（方便前端展示进度）
                        if (result.plan) {
                            plan = result.plan;
                            response.plan = {
                                originalRequest: plan.originalRequest,
                                subtaskCount: (_c = (_b = plan.subtasks) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0,
                                subtasks: (_d = plan.subtasks) === null || _d === void 0 ? void 0 : _d.map(function (s) { return ({
                                    description: s.description,
                                    result: s.result ? { success: s.result.success, durationMs: s.result.durationMs } : null,
                                }); }),
                            };
                        }
                        return [2 /*return*/, response];
                }
            });
        });
    };
    return QueryEngine;
}());
// 单例
var engine = null;
export function createEngine(config) {
    var defaultConfig = {
        apiKey: '',
        provider: 'openai',
        model: 'gpt-4o',
        maxTokens: 4096,
    };
    engine = new QueryEngine(__assign(__assign({}, defaultConfig), config));
    return engine;
}
export function getEngine() {
    if (!engine)
        throw new Error('Engine not initialized');
    return engine;
}
