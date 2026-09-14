"use strict";
/**
 * src/engine/__tests__/client.test.ts — API client URL 构建测试
 */
var passed = 0;
var failed = 0;
function assert(condition, msg) {
    if (condition) {
        passed++;
        console.log("  \u2713 ".concat(msg));
    }
    else {
        failed++;
        console.error("  \u2717 ".concat(msg));
    }
}
// ---- URL 构建逻辑（与 client.ts 中一致） ----
function buildOpenAIEndpoint(baseUrl) {
    var raw = (baseUrl || 'https://api.openai.com').replace(/\/$/, '');
    var hasEndpoint = raw.includes('/chat/completions');
    return hasEndpoint ? raw : raw + '/v1/chat/completions';
}
function buildAnthropicEndpoint(baseUrl) {
    var raw = (baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
    return raw + '/v1/messages';
}
// ---- tests ----
console.log('\n--- OpenAI URL Building ---');
assert(buildOpenAIEndpoint('https://api.openai.com') === 'https://api.openai.com/v1/chat/completions', 'Default baseUrl gets /v1/chat/completions appended');
assert(buildOpenAIEndpoint('http://127.0.0.1:8080') === 'http://127.0.0.1:8080/v1/chat/completions', 'Local proxy gets /v1/chat/completions appended');
assert(buildOpenAIEndpoint('https://api.stepfun.com/step_plan/v1/chat/completions') ===
    'https://api.stepfun.com/step_plan/v1/chat/completions', 'Full path baseUrl NOT double-appended');
assert(buildOpenAIEndpoint('https://api-inference.modelscope.cn/v1/chat/completions') ===
    'https://api-inference.modelscope.cn/v1/chat/completions', 'Modelscope full path NOT double-appended');
assert(buildOpenAIEndpoint('https://open.bigmodel.cn/api/paas/v4/chat/completions') ===
    'https://open.bigmodel.cn/api/paas/v4/chat/completions', 'BigModel full path NOT double-appended');
console.log('\n--- Anthropic URL Building ---');
assert(buildAnthropicEndpoint('https://api.anthropic.com') === 'https://api.anthropic.com/v1/messages', 'Default Anthropic gets /v1/messages appended');
assert(buildAnthropicEndpoint('http://127.0.0.1:8080') === 'http://127.0.0.1:8080/v1/messages', 'Local proxy Anthropic gets /v1/messages appended');
console.log('\n--- Trailing slash handling ---');
assert(buildOpenAIEndpoint('https://api.openai.com/') === 'https://api.openai.com/v1/chat/completions', 'Trailing slash stripped');
assert(buildOpenAIEndpoint('https://api.stepfun.com/step_plan/v1/chat/completions/') ===
    'https://api.stepfun.com/step_plan/v1/chat/completions', 'Trailing slash stripped from full path');
// ---- summary ----
console.log('\n' + '='.repeat(40));
console.log("Passed: ".concat(passed));
console.log("Failed: ".concat(failed));
console.log("Total:  ".concat(passed + failed));
if (failed > 0) {
    console.log('\nSome tests failed!');
    process.exit(1);
}
else {
    console.log('\nAll tests passed!');
    process.exit(0);
}
