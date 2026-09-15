const fs = require('fs')
const ts = require('typescript')
const file = 'src/renderer/src/pages/ToolManagement/ToolGroupsPanel.tsx'
const src = fs.readFileSync(file, 'utf8')
const out = ts.transpileModule(src, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
  reportDiagnostics: true,
})
const diags = out.diagnostics || []
if (diags.length === 0) {
  console.log('OK: ToolGroupsPanel.tsx 语法通过')
} else {
  diags.forEach(d => {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n')
    const pos = d.start != null ? ts.getLineAndCharacterOfPosition(d.file, d.start) : null
    console.log(`  L${pos ? pos.line + 1 : '?'}:${pos ? pos.character + 1 : '?'} ${msg}`)
  })
}
console.log('总行数:', src.split('\n').length)