import { StreamQueueDetector } from '../streamQueueDetector'

const d = new StreamQueueDetector()

console.log('--- test 1: plain text ---')
let r = d.feed('hello world')
console.log(JSON.stringify(r, null, 2))

console.log('--- test 2: partial then complete tool call ---')
r = d.feed('[function')
console.log(JSON.stringify(r, null, 2))
r = d.feed('_calls][call:echo]{"cmd":"date"}[/call][/function_calls]')
console.log(JSON.stringify(r, null, 2))

console.log('--- test 3: flush ---')
r = d.flush()
console.log(JSON.stringify(r, null, 2))
