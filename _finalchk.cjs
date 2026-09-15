const fs = require('fs')
const ts = require('typescript')
const file = 'src/renderer/src/pages/ToolManagement/ToolGroupsPanel.tsx'
const src = fs.readFileSync(file, 'utf8')
const out = ts.transpileModule(src, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  reportDiagnostics: true,
})
const diags = out.diagnostics || []
console.log(diags.length === 0 ? '语法通过 ✓' : diags.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'))
// 错误引用扫描
const bad = ['ScrollArea', 'isCheckedInEditing', 'batchSetMembership', 'isPlatformSupported', 'GLOBAL_GROUP', 'selectedOk', 'switchedGlobal0', 'saveAsTitle2', 'saveAsHint2', 'savedAsGroup2', 'newGroupNamePlaceholder2', 'saveAsHint']
const fails = bad.filter(b => new RegExp('\\b' + b + '\\b').test(src))
console.log(fails.length ? '残留冲突: ' + fails.join(',') : '无冲突残留 ✓')
console.log('总行数:', src.split('\n').length)