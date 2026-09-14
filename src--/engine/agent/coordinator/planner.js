/**
 * Planner — 多角色规划器
 *
 * 职责：组织多个角色（Planner、Discussant、Reviewer）进行讨论，
 * 最终生成一份可执行的 Plan JSON 文件。
 *
 * 讨论流程：
 *   1. brainstorm  — 每个角色提出自己的想法
 *   2. debate      — 角色之间质疑、补充、修正
 *   3. consensus   — 投票/协商达成共识
 *   4. finalize    — Planner 汇总为最终 Plan
 *
 * 输出：Plan 对象（包含 tasks、discussions），同时写入 .plan.json 文件
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
// ==================== 内置角色 ====================
export var BUILTIN_ROLES = [
    {
        id: "planner",
        name: "规划师",
        systemPrompt: "\u4F60\u662F KX2Code \u7684\u89C4\u5212\u5E08\u3002\u4F60\u7684\u804C\u8D23\u662F\uFF1A\n1. \u5206\u6790\u7528\u6237\u9700\u6C42\uFF0C\u5C06\u5176\u5206\u89E3\u4E3A\u53EF\u6267\u884C\u7684\u4EFB\u52A1\n2. \u5B9A\u4E49\u6BCF\u4E2A\u4EFB\u52A1\u7684\u76EE\u6807\u3001\u8F93\u5165\u3001\u8F93\u51FA\u3001\u9A8C\u8BC1\u6761\u4EF6\n3. \u786E\u5B9A\u4EFB\u52A1\u4E4B\u95F4\u7684\u4F9D\u8D56\u5173\u7CFB\u548C\u6267\u884C\u987A\u5E8F\n4. \u6700\u7EC8\u6C47\u603B\u6240\u6709\u8BA8\u8BBA\u7ED3\u679C\uFF0C\u751F\u6210\u53EF\u6267\u884C\u7684 Plan JSON\n\n\u8F93\u51FA\u8981\u6C42\uFF1A\n- \u4EFB\u52A1\u63CF\u8FF0\u5177\u4F53\u3001\u53EF\u6267\u884C\n- \u4F9D\u8D56\u5173\u7CFB\u6E05\u6670\n- \u6BCF\u4E2A\u4EFB\u52A1\u6709\u660E\u786E\u7684\u9A8C\u8BC1\u6761\u4EF6",
    },
    {
        id: "discussant",
        name: "讨论者",
        systemPrompt: "\u4F60\u662F KX2Code \u7684\u8BA8\u8BBA\u8005\u3002\u4F60\u7684\u804C\u8D23\u662F\uFF1A\n1. \u8BA4\u771F\u542C\u53D6\u5176\u4ED6\u89D2\u8272\u7684\u610F\u89C1\n2. \u63D0\u51FA\u5EFA\u8BBE\u6027\u7684\u8865\u5145\u3001\u8D28\u7591\u6216\u4FEE\u6B63\n3. \u6307\u51FA\u8BA1\u5212\u4E2D\u7684\u9057\u6F0F\u6216\u6F5C\u5728\u98CE\u9669\n4. \u63D0\u51FA\u66FF\u4EE3\u65B9\u6848\n\n\u8BA8\u8BBA\u539F\u5219\uFF1A\n- \u5BF9\u4E8B\u4E0D\u5BF9\u4EBA\n- \u6BCF\u4E2A\u89C2\u70B9\u8981\u6709\u5177\u4F53\u7406\u7531\n- \u5982\u679C\u540C\u610F\u524D\u4E00\u4E2A\u89C2\u70B9\uFF0C\u7B80\u8981\u8BF4\u660E\u540C\u610F\u7406\u7531",
    },
    {
        id: "reviewer",
        name: "审查员",
        systemPrompt: "\u4F60\u662F KX2Code \u7684\u5BA1\u67E5\u5458\u3002\u4F60\u7684\u804C\u8D23\u662F\uFF1A\n1. \u4ECE\u6267\u884C\u53EF\u884C\u6027\u89D2\u5EA6\u5BA1\u67E5\u8BA1\u5212\n2. \u68C0\u67E5\u662F\u5426\u6709\u9057\u6F0F\u7684\u6B65\u9AA4\n3. \u68C0\u67E5\u4F9D\u8D56\u5173\u7CFB\u662F\u5426\u5408\u7406\n4. \u63D0\u51FA\u6539\u8FDB\u5EFA\u8BAE\n\n\u5BA1\u67E5\u91CD\u70B9\uFF1A\n- \u8BA1\u5212\u662F\u5426\u53EF\u6267\u884C\n- \u662F\u5426\u6709\u6B7B\u9501\u6216\u5FAA\u73AF\u4F9D\u8D56\n- \u9A8C\u8BC1\u6761\u4EF6\u662F\u5426\u53EF\u5224\u65AD\n- \u662F\u5426\u6709\u8FC7\u5EA6\u590D\u6742\u5316\u7684\u6B65\u9AA4",
    },
    {
        id: "critic",
        name: "批评家",
        systemPrompt: "\u4F60\u662F KX2Code \u7684\u6279\u8BC4\u5BB6\u3002\u4F60\u7684\u804C\u8D23\u662F\uFF1A\n1. \u627E\u51FA\u8BA1\u5212\u4E2D\u6700\u574F\u7684\u60C5\u51B5\n2. \u6307\u51FA\u53EF\u80FD\u7684\u5931\u8D25\u70B9\n3. \u63D0\u51FA\u98CE\u9669\u7F13\u89E3\u65B9\u6848\n4. \u6311\u6218\u4E0D\u5408\u7406\u7684\u5047\u8BBE\n\n\u6279\u8BC4\u539F\u5219\uFF1A\n- \u5047\u8BBE\u6BCF\u4E00\u6B65\u90FD\u53EF\u80FD\u5931\u8D25\n- \u5173\u6CE8\u8FB9\u754C\u6761\u4EF6\u548C\u5F02\u5E38\u60C5\u51B5\n- \u63D0\u51FA\u5177\u4F53\u7684\u98CE\u9669\u7F13\u89E3\u63AA\u65BD",
    },
];
var Planner = /** @class */ (function () {
    function Planner(opts) {
        var _a;
        this.config = opts.config;
        this.roles = (_a = opts.roles) !== null && _a !== void 0 ? _a : BUILTIN_ROLES;
        this.callbacks = opts.callbacks;
    }
    /**
     * 生成执行计划
     *
     * 流程：
     *   1. brainstorm — 每个角色提出想法
     *   2. debate     — 多轮讨论（最多 maxDiscussionRounds 轮）
     *   3. consensus  — Planner 汇总为 Plan JSON
     *   4. finalize   — 审查和修正
     */
    Planner.prototype.generatePlan = function (objective) {
        return __awaiter(this, void 0, void 0, function () {
            var planId, discussions, brainstormResults, _i, brainstormResults_1, r, debateRounds, _a, debateRounds_1, r, plan, finalized;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            return __generator(this, function (_r) {
                switch (_r.label) {
                    case 0:
                        planId = "plan-".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2, 6));
                        discussions = [];
                        // 阶段 1： brainstorm
                        (_c = (_b = this.callbacks) === null || _b === void 0 ? void 0 : _b.onPhaseChange) === null || _c === void 0 ? void 0 : _c.call(_b, "brainstorm", "各角色提出初步想法");
                        return [4 /*yield*/, this.brainstorm(objective.description)];
                    case 1:
                        brainstormResults = _r.sent();
                        for (_i = 0, brainstormResults_1 = brainstormResults; _i < brainstormResults_1.length; _i++) {
                            r = brainstormResults_1[_i];
                            discussions.push(r);
                            (_e = (_d = this.callbacks) === null || _d === void 0 ? void 0 : _d.onDiscussionRound) === null || _e === void 0 ? void 0 : _e.call(_d, r);
                        }
                        // 阶段 2：debate（多轮）
                        (_g = (_f = this.callbacks) === null || _f === void 0 ? void 0 : _f.onPhaseChange) === null || _g === void 0 ? void 0 : _g.call(_f, "debate", "角色讨论和修正");
                        return [4 /*yield*/, this.debate(objective.description, discussions)];
                    case 2:
                        debateRounds = _r.sent();
                        discussions.push.apply(discussions, debateRounds);
                        for (_a = 0, debateRounds_1 = debateRounds; _a < debateRounds_1.length; _a++) {
                            r = debateRounds_1[_a];
                            (_j = (_h = this.callbacks) === null || _h === void 0 ? void 0 : _h.onDiscussionRound) === null || _j === void 0 ? void 0 : _j.call(_h, r);
                        }
                        // 阶段 3：consensus — Planner 汇总
                        (_l = (_k = this.callbacks) === null || _k === void 0 ? void 0 : _k.onPhaseChange) === null || _l === void 0 ? void 0 : _l.call(_k, "consensus", "汇总为执行计划");
                        return [4 /*yield*/, this.consolidate(objective, discussions)
                            // 阶段 4：finalize — 审查
                        ];
                    case 3:
                        plan = _r.sent();
                        // 阶段 4：finalize — 审查
                        (_o = (_m = this.callbacks) === null || _m === void 0 ? void 0 : _m.onPhaseChange) === null || _o === void 0 ? void 0 : _o.call(_m, "finalize", "审查和修正计划");
                        return [4 /*yield*/, this.finalize(plan, discussions)];
                    case 4:
                        finalized = _r.sent();
                        (_q = (_p = this.callbacks) === null || _p === void 0 ? void 0 : _p.onPlanGenerated) === null || _q === void 0 ? void 0 : _q.call(_p, finalized);
                        return [2 /*return*/, finalized];
                }
            });
        });
    };
    // ==================== 讨论阶段 ====================
    Planner.prototype.brainstorm = function (objective) {
        return __awaiter(this, void 0, void 0, function () {
            var rounds, activeRoles, _i, activeRoles_1, role, content;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        rounds = [];
                        activeRoles = this.roles.filter(function (r) { return r.id === "planner" || r.id === "discussant"; });
                        _i = 0, activeRoles_1 = activeRoles;
                        _a.label = 1;
                    case 1:
                        if (!(_i < activeRoles_1.length)) return [3 /*break*/, 4];
                        role = activeRoles_1[_i];
                        return [4 /*yield*/, this.callLLM(role, "\u7528\u6237\u76EE\u6807: ".concat(objective, "\n\n\u8BF7\u63D0\u51FA\u4F60\u7684\u521D\u6B65\u60F3\u6CD5\u548C\u65B9\u6848\u3002"))];
                    case 2:
                        content = _a.sent();
                        rounds.push({
                            id: "round-".concat(rounds.length + 1),
                            roleId: role.id,
                            content: content,
                            timestamp: new Date().toISOString(),
                            phase: "brainstorm",
                        });
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, rounds];
                }
            });
        });
    };
    Planner.prototype.debate = function (objective, previousRounds) {
        return __awaiter(this, void 0, void 0, function () {
            var rounds, maxRounds, context, i, rolesThisRound, _i, rolesThisRound_1, role, prompt_1, content;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        rounds = [];
                        maxRounds = (_a = this.config.maxDiscussionRounds) !== null && _a !== void 0 ? _a : 3;
                        context = previousRounds.map(function (r) {
                            var _a;
                            var role = _this.roles.find(function (rl) { return rl.id === r.roleId; });
                            return "[".concat((_a = role === null || role === void 0 ? void 0 : role.name) !== null && _a !== void 0 ? _a : r.roleId, "]: ").concat(r.content.slice(0, 500));
                        }).join("\n\n");
                        i = 0;
                        _b.label = 1;
                    case 1:
                        if (!(i < maxRounds)) return [3 /*break*/, 6];
                        rolesThisRound = i % 2 === 0
                            ? this.roles.filter(function (r) { return r.id === "discussant" || r.id === "critic"; })
                            : this.roles.filter(function (r) { return r.id === "reviewer" || r.id === "planner"; });
                        _i = 0, rolesThisRound_1 = rolesThisRound;
                        _b.label = 2;
                    case 2:
                        if (!(_i < rolesThisRound_1.length)) return [3 /*break*/, 5];
                        role = rolesThisRound_1[_i];
                        prompt_1 = "\u76EE\u6807: ".concat(objective, "\n\n\u4E4B\u524D\u7684\u8BA8\u8BBA:\n").concat(context, "\n\n").concat(rounds.length > 0 ? "本轮讨论:\n" + rounds.map(function (r) { var _a, _b; return "[".concat((_b = (_a = _this.roles.find(function (rl) { return rl.id === r.roleId; })) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : r.roleId, "]: ").concat(r.content.slice(0, 300)); }).join("\n\n") : "", "\n\n\u8BF7\u9488\u5BF9\u4E0A\u8FF0\u8BA8\u8BBA\u53D1\u8868\u4F60\u7684\u770B\u6CD5\uFF1A\u53EF\u4EE5\u8865\u5145\u3001\u8D28\u7591\u3001\u4FEE\u6B63\u6216\u63D0\u51FA\u65B0\u7684\u65B9\u6848\u3002");
                        return [4 /*yield*/, this.callLLM(role, prompt_1)];
                    case 3:
                        content = _b.sent();
                        rounds.push({
                            id: "round-".concat(previousRounds.length + rounds.length + 1),
                            roleId: role.id,
                            content: content,
                            timestamp: new Date().toISOString(),
                            phase: "debate",
                        });
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, rounds];
                }
            });
        });
    };
    Planner.prototype.consolidate = function (objective, discussions) {
        return __awaiter(this, void 0, void 0, function () {
            var plannerRole, context, prompt, content, tasks;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        plannerRole = (_a = this.roles.find(function (r) { return r.id === "planner"; })) !== null && _a !== void 0 ? _a : this.roles[0];
                        context = discussions.map(function (r) {
                            var _a;
                            var role = _this.roles.find(function (rl) { return rl.id === r.roleId; });
                            return "[".concat((_a = role === null || role === void 0 ? void 0 : role.name) !== null && _a !== void 0 ? _a : r.roleId, "]: ").concat(r.content.slice(0, 500));
                        }).join("\n\n");
                        prompt = "\u76EE\u6807: ".concat(objective.description, "\n\n\u8BA8\u8BBA\u8BB0\u5F55:\n").concat(context, "\n\n\u8BF7\u5C06\u4EE5\u4E0A\u8BA8\u8BBA\u6C47\u603B\u4E3A\u4E00\u4EFD\u53EF\u6267\u884C\u7684 Plan\u3002\u8F93\u51FA\u7EAF JSON \u683C\u5F0F\uFF1A\n\n{\n  \"title\": \"\u8BA1\u5212\u6807\u9898\",\n  \"description\": \"\u8BA1\u5212\u63CF\u8FF0\",\n  \"tasks\": [\n    {\n      \"id\": \"task-1\",\n      \"description\": \"\u5177\u4F53\u53EF\u6267\u884C\u7684\u6B65\u9AA4\",\n      \"command\": \"\u5EFA\u8BAE\u4F7F\u7528\u7684\u547D\u4EE4\u540D\uFF08\u5982 analyze\u3001refactor\u3001test\uFF09\",\n      \"args\": [\"\u547D\u4EE4\u53C2\u6570\"],\n      \"dependsOn\": [\"\u4F9D\u8D56\u7684\u4EFB\u52A1ID\"],\n      \"strategy\": \"sequential\",\n      \"priority\": 1,\n      \"validate\": \"\u5982\u4F55\u9A8C\u8BC1\u8BE5\u6B65\u9AA4\u5B8C\u6210\"\n    }\n  ]\n}\n\n\u89C4\u5219\uFF1A\n1. tasks \u6570\u7EC4\u6700\u591A 6 \u4E2A\u4EFB\u52A1\n2. dependsOn \u5FC5\u987B\u5F15\u7528\u540C\u6570\u7EC4\u4E2D\u5176\u4ED6\u4EFB\u52A1\u7684 id\n3. strategy: sequential\uFF08\u987A\u5E8F\uFF09\u3001parallel\uFF08\u5E76\u884C\uFF09\u3001standalone\uFF08\u72EC\u7ACB\uFF09\n4. priority: \u6570\u5B57\u8D8A\u5C0F\u8D8A\u4F18\u5148\n5. validate: \u7B80\u77ED\u63CF\u8FF0\u5982\u4F55\u9A8C\u8BC1\u8BE5\u6B65\u9AA4\u6210\u529F\u5B8C\u6210");
                        return [4 /*yield*/, this.callLLM(plannerRole, prompt)
                            // 解析 Plan JSON
                        ];
                    case 1:
                        content = _c.sent();
                        tasks = (_b = this.parseTasks(content)) !== null && _b !== void 0 ? _b : this.fallbackTasks(objective.description);
                        return [2 /*return*/, {
                                id: "plan-".concat(Date.now()),
                                objectiveId: objective.id,
                                title: objective.description.slice(0, 50),
                                description: objective.description,
                                tasks: tasks,
                                discussions: discussions,
                                createdAt: new Date().toISOString(),
                                status: "draft",
                                version: 1,
                            }];
                }
            });
        });
    };
    Planner.prototype.finalize = function (plan, discussions) {
        return __awaiter(this, void 0, void 0, function () {
            var reviewerRole, prompt, content, correctedTasks;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        reviewerRole = (_a = this.roles.find(function (r) { return r.id === "reviewer"; })) !== null && _a !== void 0 ? _a : this.roles[0];
                        prompt = "\u8BF7\u5BA1\u67E5\u4EE5\u4E0B\u8BA1\u5212\uFF0C\u68C0\u67E5\u662F\u5426\u6709\u95EE\u9898\uFF1A\n\n\u6807\u9898: ".concat(plan.title, "\n\u63CF\u8FF0: ").concat(plan.description, "\n\n\u4EFB\u52A1\u5217\u8868:\n").concat(plan.tasks.map(function (t) { return "  [".concat(t.id, "] ").concat(t.description, " (").concat(t.strategy, ", dependsOn: [").concat(t.dependsOn.join(","), "])"); }).join("\n"), "\n\n\u5982\u679C\u6709\u95EE\u9898\uFF0C\u8F93\u51FA\u4FEE\u6B63\u540E\u7684 Plan JSON\u3002\u5982\u679C\u6CA1\u6709\u95EE\u9898\uFF0C\u8F93\u51FA APPROVED\u3002");
                        return [4 /*yield*/, this.callLLM(reviewerRole, prompt)];
                    case 1:
                        content = _b.sent();
                        if (content.includes("APPROVED")) {
                            plan.status = "approved";
                            return [2 /*return*/, plan];
                        }
                        correctedTasks = this.parseTasks(content);
                        if (correctedTasks && correctedTasks.length > 0) {
                            plan.tasks = correctedTasks;
                            plan.version++;
                        }
                        plan.status = "approved";
                        return [2 /*return*/, plan];
                }
            });
        });
    };
    // ==================== LLM 调用 ====================
    /** 可被测试 override 的 LLM 调用方法 */
    Planner.prototype.callLLM = function (role, userPrompt) {
        return __awaiter(this, void 0, void 0, function () {
            var execSync, body, baseUrl, url, result, parsed, msg;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, import("node:child_process")];
                    case 1:
                        execSync = (_e.sent()).execSync;
                        body = JSON.stringify({
                            model: this.config.llm.model,
                            messages: [
                                { role: "system", content: role.systemPrompt },
                                { role: "user", content: userPrompt },
                            ],
                            max_tokens: (_a = this.config.llm.maxTokens) !== null && _a !== void 0 ? _a : 2048,
                            temperature: 0.4,
                        });
                        baseUrl = this.config.llm.baseUrl || "https://api.openai.com";
                        url = "".concat(baseUrl, "/v1/chat/completions");
                        try {
                            result = execSync("curl -s -X POST \"".concat(url, "\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer ").concat(this.config.llm.apiKey, "\" -d ").concat(JSON.stringify(body)), { encoding: "utf-8", timeout: 60000 });
                            parsed = JSON.parse(result);
                            msg = (_d = (_c = (_b = parsed.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) !== null && _d !== void 0 ? _d : {};
                            return [2 /*return*/, msg.content || msg.reasoning || ""];
                        }
                        catch (_f) {
                            return [2 /*return*/, "[".concat(role.name, "] \u65E0\u6CD5\u8C03\u7528 LLM")];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    // ==================== JSON 解析 ====================
    Planner.prototype.parseTasks = function (raw) {
        try {
            var match = raw.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
            if (!match)
                return null;
            var parsed = JSON.parse(match[0]);
            if (!Array.isArray(parsed.tasks))
                return null;
            return parsed.tasks.map(function (t) {
                var _a, _b, _c, _d, _e, _f;
                return ({
                    id: (_a = t.id) !== null && _a !== void 0 ? _a : "task-".concat(Math.random().toString(36).slice(2, 6)),
                    description: (_b = t.description) !== null && _b !== void 0 ? _b : "",
                    command: t.command,
                    args: (_c = t.args) !== null && _c !== void 0 ? _c : [],
                    dependsOn: (_d = t.dependsOn) !== null && _d !== void 0 ? _d : [],
                    strategy: (_e = t.strategy) !== null && _e !== void 0 ? _e : "sequential",
                    priority: (_f = t.priority) !== null && _f !== void 0 ? _f : 1,
                    validate: t.validate,
                });
            });
        }
        catch (_a) {
            return null;
        }
    };
    Planner.prototype.fallbackTasks = function (objective) {
        return [
            {
                id: "task-1",
                description: "\u5206\u6790: ".concat(objective),
                strategy: "sequential",
                priority: 1,
                dependsOn: [],
                validate: "输出分析结果",
            },
            {
                id: "task-2",
                description: "\u6267\u884C: ".concat(objective),
                strategy: "sequential",
                priority: 2,
                dependsOn: ["task-1"],
                validate: "输出执行结果",
            },
        ];
    };
    return Planner;
}());
export { Planner };
export default Planner;
