import { readFileSync } from 'node:fs'

const p = process.argv[2]
const buf = readFileSync(p)
console.log('文件大小:', buf.length, 'bytes')

// 1) 是否有 NUL
const nulIdx = buf.indexOf(0)
console.log('首个 NUL 字节位置:', nulIdx)

// 2) 尝试严格 UTF-8 解码，找出非法位置
const dec = new TextDecoder('utf-8', { fatal: true })
try {
  dec.decode(buf)
  console.log('UTF-8 解码: 正常')
} catch (e) {
  console.log('UTF-8 解码失败:', e.message)
  // 逐字节滑动找非法序列
  for (let i = 0; i < buf.length; i++) {
    try {
      dec.decode(buf.subarray(i, i + 4))
    } catch {
      console.log(`  非法字节 @ offset ${i}: 0x${buf[i].toString(16).padStart(2, '0')}`)
      // 打印上下文
      const from = Math.max(0, i - 40)
      const to = Math.min(buf.length, i + 40)
      console.log('  上下文(转义):', JSON.stringify(buf.subarray(from, to).toString('latin1')))
      const line = buf.subarray(0, i).toString('utf8').split(/\r?\n/).length
      console.log('  约在第', line, '行')
      break
    }
  }
}

// 3) 检查 BOM / CR 混用
console.log('前 4 字节:', [...buf.subarray(0, 4)].map(b => b.toString(16)).join(' '))
console.log('CR 数:', (buf.toString('latin1').match(/\r/g) || []).length)
console.log('LF 数:', (buf.toString('latin1').match(/\n/g) || []).length)
