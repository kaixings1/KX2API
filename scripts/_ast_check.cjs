/**
 * 用 TS 编译器 API 检查 managedXml.ts 里 parseToolNameSubtagFormat 的作用域层级
 */
const ts = require('typescript')
const fs = require('fs')

const file = 'D:/KX2API/src/main/proxy/toolCalling/protocols/managedXml.ts'
const src = fs.readFileSync(file, 'utf-8')
const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)

const target = 'parseToolNameSubtagFormat'

function walk(node, depth, path) {
  if (ts.isFunctionDeclaration(node) && node.name && node.name.text === target) {
    console.log(`找到定义 @${sf.getLineAndCharacterOfPosition(node.pos).line + 1} 行，嵌套深度=${depth}`)
    console.log('  容器链:', path.join(' > ') || '(模块顶层)')
  }
  if (ts.isFunctionDeclaration(node) && node.name && node.name.text === 'parseBlocks') {
    console.log(`parseBlocks 定义 @${sf.getLineAndCharacterOfPosition(node.pos).line + 1}，深度=${depth}`)
  }

  const isContainer =
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isBlock(node) ||
    ts.isIfStatement(node) ||
    ts.isTryStatement(node)

  const label = isContainer
    ? (node.name && node.name.text) ||
      (ts.isBlock(node) ? '{}' : ts.SyntaxKind[node.kind])
    : null

  ts.forEachChild(node, child => {
    walk(child, label ? depth + 1 : depth, label ? [...path, label] : path)
  })
}

walk(sf, 0, [])

// 再统计顶层声明名
console.log('\n=== 模块顶层声明 ===')
sf.statements.forEach(st => {
  if (st.name && st.name.text) {
    console.log(`  @${sf.getLineAndCharacterOfPosition(st.pos).line + 1} ${ts.SyntaxKind[st.kind]} ${st.name.text}`)
  } else {
    console.log(`  @${sf.getLineAndCharacterOfPosition(st.pos).line + 1} ${ts.SyntaxKind[st.kind]}`)
  }
})
