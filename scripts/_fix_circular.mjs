import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/api/client.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const old = [
  '    } catch (postError) {',
  '      const err = postError as Error & { response?: { status?: number; data?: unknown } }',
  "      console.error(`[API] POST FAILED after ${Date.now() - postStart}ms: status=${err.response?.status ?? 'n/a'} body=${JSON.stringify(err.response?.data).slice(0, 500)}`, err.message)",
  '      throw postError',
  '    }',
].join('\r\n')

const oldLF = old.replace(/\r\n/g, '\n')

// 根因：responseType:'stream' 时 err.response.data 是 IncomingMessage（活流），
// 它经 Socket._httpMessage ↔ ClientRequest.socket 形成循环引用，JSON.stringify 直接抛
//   TypeError: Converting circular structure to JSON
// 该新异常会**替换掉原始错误**冒泡上去，用户就只能看到这句序列化报错，
// 真正的上游错误（如 400 的具体原因）被完全掩盖 —— 表现为「正文刚出一点就异常」。
const neu = [
  '    } catch (postError) {',
  '      const err = postError as Error & { response?: { status?: number; data?: unknown } }',
  '      // 注意：responseType 为 stream 时，err.response.data 是**活的 IncomingMessage**，',
  '      // 经 Socket ↔ ClientRequest 循环引用，JSON.stringify 会抛',
  '      //   TypeError: Converting circular structure to JSON',
  '      // 而该异常会替换掉原始错误、把真实失败原因彻底掩盖（日志不能成为故障源）。',
  '      // 因此这里只做安全提取：字符串直接用；流对象则尝试同步读出已到达的错误正文。',
  '      const rawBody = err.response?.data',
  '      const bodyPreview = extractErrorBodyPreview(rawBody)',
  "      console.error(`[API] POST FAILED after ${Date.now() - postStart}ms: status=${err.response?.status ?? 'n/a'} body=${bodyPreview}`, err.message)",
  '      throw postError',
  '    }',
].join('\r\n')

let used = null
if (s.includes(old)) used = old
else if (s.includes(oldLF)) used = oldLF

if (!used) {
  console.log('未命中 POST catch 块')
  process.exit(1)
}

s = s.replace(used, used.includes('\r\n') ? neu : neu.replace(/\r\n/g, '\n'))

writeFileSync(p, s)
console.log('已改: ' + p)
