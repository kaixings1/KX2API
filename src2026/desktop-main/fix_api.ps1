path = r'D:\doge-code\desktop\src\main\apiClient.ts'
with open(path, 'r', encoding='utf-8') as f:
    data = f.read()

# replace only the else block in the non-Anthropic branch
old = '''\t} else {
\t\tconst reqTools = request.tools && request.tools.length > 0
\t\tbody = {
\t\t\tmodel: request.model,
\t\t\tmax_tokens: request.max_tokens,
\t\t\tstream: true,
\t\t\tmessages: request.messages,
\t\t\t...(reqTools ? { tools: request.tools.map(t => ({
\t\t\t\ttype: 'function',
\t\t\t\tfunction: { name: t.name, description: t.description, parameters: t.input_schema },
\t\t\t}))} : {}),
\t\t\t...(request.temperature ? { temperature: request.temperature } : {}),
\t\t}
\t}'''

new = '''\t} else {
\t\t// OpenAI \u517c\u5bb9\u683c\u5f0f\uff1a\u5148\u5c06 Anthropic \u683c\u5f0f\u7684 request \u8f6c\u6362\u4e3a OpenAI \u683c\u5f0f
\t\tconst converted = convertAnthropicRequestToOpenAI(request)
\t\tconverted.stream = true
\t\tbody = converted
\t}'''

if old not in data:
    print('ERROR: old block not found')
else:
    data = data.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(data)
    print('SUCCESS: apiClient.ts fixed')
