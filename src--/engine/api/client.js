/**
 * engine/api/client.ts — LLM API 统一客户端
 *
 * 支持 Anthropic Messages API 和 OpenAI Chat Completions API
 * 流式传输 + Tool Use
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
import axios from 'axios';
import { createParser } from 'eventsource-parser';
var MAX_TOOL_ROUNDS = 5;
var requestCounter = 0;
export function sendMessageStream(config, messages, callbacks, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var reqId, isAnthropic, e_1, errMsg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    requestCounter++;
                    reqId = requestCounter;
                    isAnthropic = config.provider === 'anthropic' || (!config.baseUrl && !config.provider);
                    console.log('[API] sendMessageStream', { reqId: reqId, provider: config.provider, baseUrl: config.baseUrl, model: config.model, isAnthropic: isAnthropic });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    if (!isAnthropic) return [3 /*break*/, 3];
                    return [4 /*yield*/, sendAnthropicStream(config, messages, callbacks, signal, reqId)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, sendOpenAIStreamWithTools(config, messages, callbacks, signal, reqId)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_1 = _a.sent();
                    if ((e_1 === null || e_1 === void 0 ? void 0 : e_1.name) === 'AbortError')
                        return [2 /*return*/];
                    errMsg = e_1.message || '请求失败';
                    console.error('[API] sendMessageStream error:', errMsg);
                    callbacks.onError(errMsg);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function sendAnthropicStream(config, messages, callbacks, signal, reqId) {
    return __awaiter(this, void 0, void 0, function () {
        var baseUrl, client, anthropicMessages, systemMsg, body, anthropicEndpoint, response, fullText, toolCalls, parser, lines, _i, _a, line;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    baseUrl = config.baseUrl || 'https://api.anthropic.com';
                    console.log('[API] Anthropic request', { reqId: reqId, baseUrl: baseUrl, model: config.model });
                    client = axios.create({
                        baseURL: baseUrl,
                        headers: {
                            'x-api-key': config.apiKey,
                            'anthropic-version': '2023-06-01',
                            'content-type': 'application/json',
                        },
                        timeout: 120000,
                    });
                    anthropicMessages = messages
                        .filter(function (m) { return m.role !== 'system'; })
                        .map(function (m) { return ({
                        role: m.role,
                        content: typeof m.content === 'string' ? m.content : m.content,
                    }); });
                    systemMsg = messages.find(function (m) { return m.role === 'system'; });
                    body = {
                        model: config.model,
                        max_tokens: config.maxTokens || 4096,
                        stream: true,
                        messages: anthropicMessages,
                    };
                    if (systemMsg) {
                        body.system = typeof systemMsg.content === 'string' ? systemMsg.content : '';
                    }
                    anthropicEndpoint = '/v1/messages';
                    return [4 /*yield*/, client.post(anthropicEndpoint, body, { signal: signal })];
                case 1:
                    response = _b.sent();
                    fullText = '';
                    toolCalls = [];
                    parser = createParser({
                        onEvent: function (event) {
                            var _a;
                            if (event.data && event.data !== '[DONE]') {
                                try {
                                    var parsed = JSON.parse(event.data);
                                    if (parsed.type === 'content_block_delta') {
                                        var delta = parsed.delta;
                                        if (delta.type === 'text_delta') {
                                            fullText += delta.text;
                                            callbacks.onText(delta.text);
                                        }
                                        else if (delta.type === 'input_json_delta') {
                                            var lastTool = toolCalls[toolCalls.length - 1];
                                            if (lastTool && lastTool.type === 'tool_use') {
                                                lastTool.input = __assign(__assign({}, lastTool.input), JSON.parse(delta.partial_json || '{}'));
                                            }
                                        }
                                    }
                                    else if (parsed.type === 'content_block_start') {
                                        var block = parsed.content_block;
                                        if (block.type === 'tool_use') {
                                            toolCalls.push(__assign(__assign({}, block), { input: block.input || {} }));
                                            callbacks.onToolUse(toolCalls[toolCalls.length - 1]);
                                        }
                                    }
                                    else if (parsed.type === 'message_stop') {
                                        callbacks.onDone(fullText, toolCalls);
                                    }
                                    else if (parsed.type === 'error') {
                                        callbacks.onError(((_a = parsed.error) === null || _a === void 0 ? void 0 : _a.message) || 'API 错误');
                                    }
                                }
                                catch ( /* skip unparseable */_b) { /* skip unparseable */ }
                            }
                        },
                        onError: function (error) {
                            callbacks.onError(error);
                        },
                        onRetry: function () { },
                        onComment: function () { },
                    });
                    lines = typeof response.data === 'string' ? response.data : '';
                    for (_i = 0, _a = lines.split('\n'); _i < _a.length; _i++) {
                        line = _a[_i];
                        if (line.startsWith('data:')) {
                            parser.feed(line + '\n');
                        }
                    }
                    callbacks.onDone(fullText, toolCalls);
                    return [2 /*return*/];
            }
        });
    });
}
function sendOpenAIStream(config, messages, callbacks, signal, reqId) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, hasEndpoint, endpoint, client, body, response, lines, stream, reader, decoder, buffer, fullText, _a, done, value, _i, _b, line, data, parsed, delta;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    raw = (config.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
                    hasEndpoint = raw.includes('/chat/completions');
                    endpoint = hasEndpoint ? raw : raw + '/v1/chat/completions';
                    console.log('[API] OpenAI request', { reqId: reqId, endpoint: endpoint, model: config.model });
                    client = axios.create({
                        baseURL: raw,
                        headers: {
                            Authorization: "Bearer ".concat(config.apiKey),
                            'content-type': 'application/json',
                        },
                        timeout: 120000,
                    });
                    body = {
                        model: config.model,
                        max_tokens: config.maxTokens || 4096,
                        stream: true,
                        messages: messages.map(function (m) { return ({
                            role: m.role,
                            content: typeof m.content === 'string' ? m.content : m.content,
                        }); }),
                    };
                    return [4 /*yield*/, client.post(endpoint, body, { signal: signal })];
                case 1:
                    response = _d.sent();
                    lines = typeof response.data === 'string' ? response.data : '';
                    stream = new ReadableStream({
                        start: function (controller) {
                            controller.enqueue(new TextEncoder().encode(lines));
                            controller.close();
                        },
                    });
                    reader = stream.getReader();
                    decoder = new TextDecoder();
                    buffer = '';
                    fullText = '';
                    _d.label = 2;
                case 2:
                    if (!true) return [3 /*break*/, 4];
                    return [4 /*yield*/, reader.read()];
                case 3:
                    _a = _d.sent(), done = _a.done, value = _a.value;
                    if (done)
                        return [3 /*break*/, 4];
                    buffer += decoder.decode(value, { stream: true });
                    for (_i = 0, _b = buffer.split('\n'); _i < _b.length; _i++) {
                        line = _b[_i];
                        if (line.startsWith('data: ')) {
                            data = line.slice(6);
                            if (data === '[DONE]') {
                                callbacks.onDone(fullText, []);
                                return [2 /*return*/];
                            }
                            try {
                                parsed = JSON.parse(data);
                                if (!parsed.choices || parsed.choices.length === 0) {
                                    if (!parsed.error)
                                        console.log('[API] Non-streaming response:', JSON.stringify(parsed).slice(0, 200));
                                    return [2 /*return*/];
                                }
                                delta = ((_c = parsed.choices[0].delta) === null || _c === void 0 ? void 0 : _c.content) || '';
                                if (delta) {
                                    fullText += delta;
                                    callbacks.onText(delta);
                                }
                            }
                            catch (e) { /* skip */ }
                        }
                    }
                    return [3 /*break*/, 2];
                case 4:
                    callbacks.onDone(fullText, []);
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * 执行单个本地工具命令（通过 commandRegistry + AgentDispatcher）
 * needsAgent 命令会通过 AgentDispatcher 获得真实执行能力
 */
export function executeLocalTool(name, args) {
    return __awaiter(this, void 0, void 0, function () {
        var commandRegistry, cmd, result, AgentDispatcher, dispatcher, agentResult, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, import('../commands/registry')];
                case 1:
                    commandRegistry = (_a.sent()).commandRegistry;
                    cmd = commandRegistry.get(name);
                    if (!cmd) {
                        return [2 /*return*/, { tool_use_id: '', output: "\u9519\u8BEF: \u672A\u77E5\u547D\u4EE4 /".concat(name) }];
                    }
                    return [4 /*yield*/, cmd.execute(args)
                        // needsAgent 命令通过 AgentDispatcher 获得真实能力
                    ];
                case 2:
                    result = _a.sent();
                    if (!(result.needsAgent && !result.error)) return [3 /*break*/, 7];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 6, , 7]);
                    return [4 /*yield*/, import('../agent/dispatcher.ts')];
                case 4:
                    AgentDispatcher = (_a.sent()).AgentDispatcher;
                    dispatcher = new AgentDispatcher({
                        provider: 'openai',
                        apiKey: '',
                        model: 'gpt-4o',
                        baseUrl: 'http://127.0.0.1:8080',
                        maxTokens: 4096,
                    });
                    return [4 /*yield*/, dispatcher.dispatch(name, args)];
                case 5:
                    agentResult = _a.sent();
                    return [2 /*return*/, {
                            tool_use_id: '',
                            output: agentResult.error || agentResult.output || '(Agent 执行完成)',
                        }];
                case 6:
                    e_2 = _a.sent();
                    return [2 /*return*/, { tool_use_id: '', output: "Agent \u6267\u884C\u5931\u8D25: ".concat(e_2.message) }];
                case 7: return [2 /*return*/, { tool_use_id: '', output: result.error || result.output || '(无输出)' }];
            }
        });
    });
}
/**
 * 从 ToolCollection 构建 OpenAI tools 定义
 * 使用 toolCollection 统一管理工具，消除硬编码白名单
 * 使用动态 import 避免与 registry.ts 形成循环依赖
 */
export function buildToolsFromRegistry() {
    return __awaiter(this, void 0, void 0, function () {
        var toolCollection, tools, _i, _a, cmd;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, import('../../main/proxy/tools/toolCollection.ts')];
                case 1:
                    toolCollection = (_b.sent()).toolCollection;
                    tools = [];
                    for (_i = 0, _a = toolCollection.getAllTools(); _i < _a.length; _i++) {
                        cmd = _a[_i];
                        tools.push({
                            type: 'function',
                            function: {
                                name: cmd.name,
                                description: cmd.description,
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        args: { type: 'array', items: { type: 'string' }, description: '命令参数列表' },
                                    },
                                },
                            },
                        });
                    }
                    return [2 /*return*/, tools];
            }
        });
    });
}
/**
 * OpenAI tool_use 工具调用循环 — 最多 MAX_TOOL_ROUNDS 轮
 * 每轮：LLM 返回 tool_calls → 本地执行 → 结果喂回 → 再问 LLM
 */
export function sendOpenAIStreamWithTools(config, messages, callbacks, signal, reqId) {
    return __awaiter(this, void 0, void 0, function () {
        function toolSignature(tools) {
            return tools.map(function (tc) { return "".concat(tc.name, ":").concat(JSON.stringify(tc.input || {})); }).join('|');
        }
        var tools, apiMessages, maxRounds, maxRepeat, repeatCount, lastToolSignature, _loop_1, round, state_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, buildToolsFromRegistry()];
                case 1:
                    tools = _c.sent();
                    console.log('[API] Tool mode enabled, tools:', tools.map(function (t) { return t.function.name; }).join(', '));
                    apiMessages = messages.map(function (m) { return ({
                        role: m.role,
                        content: typeof m.content === 'string' ? m.content : m.content,
                    }); });
                    maxRounds = config.maxToolRounds || MAX_TOOL_ROUNDS;
                    maxRepeat = config.maxRepeat || 3;
                    repeatCount = 0;
                    lastToolSignature = '';
                    _loop_1 = function (round) {
                        var raw, hasEndpoint, endpoint, client, body, response, httpStream, buffer, fullText, toolCalls, streamDone, _i, toolCalls_1, tc, toolResults, _d, toolCalls_2, tc, args, result, currentSignature, _e, toolResults_1, tr;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    raw = (config.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
                                    hasEndpoint = raw.includes('/chat/completions');
                                    endpoint = hasEndpoint ? raw : raw + '/v1/chat/completions';
                                    console.log("[API] Tool round ".concat(round + 1, "/").concat(maxRounds), { endpoint: endpoint, model: config.model, repeatCount: repeatCount });
                                    client = axios.create({
                                        baseURL: raw,
                                        headers: { Authorization: "Bearer ".concat(config.apiKey), 'content-type': 'application/json' },
                                        timeout: 120000,
                                    });
                                    body = {
                                        model: config.model,
                                        max_tokens: config.maxTokens || 4096,
                                        stream: true,
                                        messages: apiMessages,
                                        tools: tools,
                                    };
                                    return [4 /*yield*/, client.post(endpoint, body, { signal: signal, responseType: 'stream' })];
                                case 1:
                                    response = _f.sent();
                                    httpStream = response.data;
                                    buffer = '';
                                    fullText = '';
                                    toolCalls = [];
                                    streamDone = new Promise(function (resolve, reject) {
                                        httpStream.on('data', function (chunk) {
                                            var _a, _b, _c, _d;
                                            buffer += chunk.toString();
                                            var lines = buffer.split('\n');
                                            buffer = lines.pop() || '';
                                            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                                                var line = lines_1[_i];
                                                if (!line.startsWith('data: '))
                                                    continue;
                                                var raw_1 = line.slice(6).trim();
                                                if (raw_1 === '[DONE]')
                                                    continue;
                                                try {
                                                    var parsed = JSON.parse(raw_1);
                                                    if (!((_a = parsed.choices) === null || _a === void 0 ? void 0 : _a.length))
                                                        continue;
                                                    var delta = parsed.choices[0].delta;
                                                    if (delta === null || delta === void 0 ? void 0 : delta.tool_calls) {
                                                        for (var _e = 0, _f = delta.tool_calls; _e < _f.length; _e++) {
                                                            var tc = _f[_e];
                                                            var idx = (_b = tc.index) !== null && _b !== void 0 ? _b : 0;
                                                            if (!toolCalls[idx]) {
                                                                toolCalls[idx] = {
                                                                    type: 'tool_use',
                                                                    id: tc.id || "tc_".concat(Date.now(), "_").concat(idx),
                                                                    name: ((_c = tc.function) === null || _c === void 0 ? void 0 : _c.name) || '',
                                                                    input: {},
                                                                };
                                                            }
                                                            if ((_d = tc.function) === null || _d === void 0 ? void 0 : _d.arguments) {
                                                                try {
                                                                    toolCalls[idx].input = __assign(__assign({}, toolCalls[idx].input), JSON.parse(tc.function.arguments));
                                                                }
                                                                catch (e) {
                                                                    toolCalls[idx].input = __assign(__assign({}, toolCalls[idx].input), { raw: tc.function.arguments });
                                                                }
                                                            }
                                                        }
                                                    }
                                                    var text = (delta === null || delta === void 0 ? void 0 : delta.content) || '';
                                                    if (text) {
                                                        fullText += text;
                                                        callbacks.onText(text);
                                                    }
                                                }
                                                catch (e) { /* skip */ }
                                            }
                                        });
                                        httpStream.on('end', function () { return resolve(); });
                                        httpStream.on('error', function (err) { return reject(err); });
                                    });
                                    return [4 /*yield*/, streamDone];
                                case 2:
                                    _f.sent();
                                    if (toolCalls.length === 0) {
                                        callbacks.onDone(fullText, []);
                                        return [2 /*return*/, { value: void 0 }];
                                    }
                                    for (_i = 0, toolCalls_1 = toolCalls; _i < toolCalls_1.length; _i++) {
                                        tc = toolCalls_1[_i];
                                        callbacks.onToolUse(tc);
                                    }
                                    toolResults = [];
                                    _d = 0, toolCalls_2 = toolCalls;
                                    _f.label = 3;
                                case 3:
                                    if (!(_d < toolCalls_2.length)) return [3 /*break*/, 6];
                                    tc = toolCalls_2[_d];
                                    args = [];
                                    if (Array.isArray((_a = tc.input) === null || _a === void 0 ? void 0 : _a.args)) {
                                        args = tc.input.args.map(function (a) { return String(a); });
                                    }
                                    else if ((_b = tc.input) === null || _b === void 0 ? void 0 : _b.raw) {
                                        args = [String(tc.input.raw)];
                                    }
                                    else if (tc.input && typeof tc.input === 'object') {
                                        args = Object.entries(tc.input).filter(function (_a) {
                                            var k = _a[0];
                                            return k !== 'raw';
                                        }).map(function (_a) {
                                            var v = _a[1];
                                            return String(v);
                                        });
                                    }
                                    console.log("[API] Executing tool: /".concat(tc.name), { args: args, input: JSON.stringify(tc.input).slice(0, 50) });
                                    return [4 /*yield*/, executeLocalTool(tc.name, args)];
                                case 4:
                                    result = _f.sent();
                                    toolResults.push({ role: 'tool', content: result.output, tool_call_id: tc.id || '' });
                                    _f.label = 5;
                                case 5:
                                    _d++;
                                    return [3 /*break*/, 3];
                                case 6:
                                    currentSignature = toolSignature(toolCalls);
                                    if (currentSignature && currentSignature === lastToolSignature) {
                                        repeatCount++;
                                        console.log("[API] Repeat detected (".concat(repeatCount, "/").concat(maxRepeat, "): ").concat(currentSignature.slice(0, 80)));
                                        if (repeatCount >= maxRepeat) {
                                            callbacks.onDone("(\u68C0\u6D4B\u5230\u5DE5\u5177\u8C03\u7528\u91CD\u590D\u5FAA\u73AF\uFF0C\u5DF2\u505C\u6B62\u3002\u91CD\u590D\u6B21\u6570: ".concat(repeatCount, ")"), []);
                                            return [2 /*return*/, { value: void 0 }];
                                        }
                                    }
                                    else {
                                        repeatCount = 0;
                                    }
                                    lastToolSignature = currentSignature;
                                    apiMessages.push({ role: 'assistant', content: fullText || null, tool_calls: toolCalls.map(function (tc) { return ({
                                            id: tc.id,
                                            type: 'function',
                                            function: { name: tc.name || '', arguments: JSON.stringify(tc.input || {}) },
                                        }); }) });
                                    for (_e = 0, toolResults_1 = toolResults; _e < toolResults_1.length; _e++) {
                                        tr = toolResults_1[_e];
                                        apiMessages.push({ role: 'tool', content: tr.content, tool_call_id: tr.tool_call_id });
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    };
                    round = 0;
                    _c.label = 2;
                case 2:
                    if (!(round < maxRounds)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_1(round)];
                case 3:
                    state_1 = _c.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _c.label = 4;
                case 4:
                    round++;
                    return [3 /*break*/, 2];
                case 5:
                    callbacks.onDone('(工具调用达到最大轮数限制)', []);
                    return [2 /*return*/];
            }
        });
    });
}
