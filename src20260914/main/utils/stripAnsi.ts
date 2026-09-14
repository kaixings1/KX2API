/**
 * stripAnsi — 移除字符串中的 ANSI 转义序列
 * 从 doge-desktop src/vendor/stripAnsi.ts 移植
 */

const ansiRegex = (onlyFirst: boolean): RegExp => {
  const ST = '(?:\\u0007|\\u001B\\u005C|\\u009C)'
  const osc = '(?:\\u001B\\][\\s\\S]*?' + ST + ')'
  const csi = '[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;.]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]'
  return new RegExp(osc + '|' + csi, onlyFirst ? undefined : 'g')
}

export default function stripAnsi(string: unknown): string {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a `string`, got `' + typeof string + '`')
  }
  if (!string.includes('\u001B') && !string.includes('\u009B')) {
    return string
  }
  return string.replace(ansiRegex(false), '')
}
