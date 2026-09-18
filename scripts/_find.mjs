import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const rawTarget = process.argv[2] || ''
const kws = process.argv.slice(3)

// 诊断：把实际收到的参数打出来，避免"静默 0 处"骗人
const target = resolve(process.cwd(), rawTarget)
console.error(`[find] cwd=${process.cwd()}`)
console.error(`[find] arg=${JSON.stringify(rawTarget)} -> ${target}`)
console.error(`[find] exists=${existsSync(target)} kws=${JSON.stringify(kws)}`)

const hits = []

function scanFile(f) {
  let txt
  try {
    txt = readFileSync(f, 'utf-8')
  } catch (e) {
    console.error(`  读失败 ${f}: ${e.message}`)
    return
  }
  const lines = txt.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    for (const k of kws) {
      if (lines[i].includes(k)) {
        hits.push(`${f.replace(process.cwd() + '\\', '')}:${i + 1}: ${lines[i].trim().slice(0, 130)}`)
      }
    }
  }
}

if (!existsSync(target)) {
  console.error('目标不存在')
  process.exit(1)
}

const st = statSync(target)
if (st.isFile()) {
  scanFile(target)
} else {
  const walk = dir => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(e.name)) scanFile(full)
    }
  }
  walk(target)
}

console.log(hits.slice(0, 100).join('\n'))
console.log(`--- ${hits.length} 处 ---`)
