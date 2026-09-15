const fs = require('fs')
const ts = require('typescript')
const file = 'src/main/ipc/handlers.ts'
const src = fs.readFileSync(file, 'utf8')
const result = ts.transpileModule(src, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, esModuleInterop: true },
  reportDiagnostics: true,
})
const diags = result.diagnostics || []
if (diags.length === 0) {
  console.log('OK: handlers.ts 语法解析通过')
} else {
  diags.forEach(d => {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n')
    const pos = d.file && d.start != null ? ts.getLineAndCharacterOfPosition(d.file, d.start) : null
    console.log(`错误位置 ${pos ? pos.line + 1 + ':' + (pos.character + 1) : '?'}: ${msg}`)
  })
}
console.log('总行数:', src.split('\n').length)