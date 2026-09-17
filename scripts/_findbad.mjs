import { readFileSync } from 'node:fs'

const p = process.argv[2]
const buf = readFileSync(p)

// 找 U+FFFD（EF BF BD）与其它可疑控制字符
const hits = []
for (let i = 0; i < buf.length; i++) {
  const b = buf[i]
  // U+FFFD 的 UTF-8 编码序列
  if (b === 0xef && buf[i + 1] === 0xbf && buf[i + 2] === 0xbd) {
    hits.push({ offset: i, kind: 'U+FFFD (替换字符)' })
  }
  // 其它 C0/C1 控制字符（除 \t \n \r）
  if ((b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) || b === 0x7f) {
    hits.push({ offset: i, kind: `控制字符 0x${b.toString(16)}` })
  }
}

for (const h of hits) {
  const from = Math.max(0, h.offset - 60)
  const to = Math.min(buf.length, h.offset + 40)
  const line = buf.subarray(0, h.offset).toString('utf8').split('\n').length
  console.log(`offset=${h.offset} 第${line}行 ${h.kind}`)
  console.log('  ' + JSON.stringify(buf.subarray(from, to).toString('utf8')))
}

console.log(`--- 共 ${hits.length} 处可疑字节 ---`)
