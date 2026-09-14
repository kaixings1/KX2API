/**
 * Debounce — KX2API 适配版
 *
 * 从 doge-desktop src/performance/Debounce.ts 移植
 * 防抖与节流工具，修复 Timer 类型为 Node.js 兼容的 ReturnType<typeof setTimeout>
 */

export class Debounce {
  static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number,
  ): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null

    return (...args: Parameters<T>) => {
      if (timer) {
        clearTimeout(timer)
      }

      timer = setTimeout(() => {
        fn(...args)
        timer = null
      }, delay)
    }
  }

  static throttle<T extends (...args: any[]) => any>(
    fn: T,
    interval: number,
  ): (...args: Parameters<T>) => void {
    let lastCall = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    return (...args: Parameters<T>) => {
      const now = Date.now()
      const remaining = interval - (now - lastCall)

      if (remaining <= 0) {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        lastCall = now
        fn(...args)
      } else if (!timer) {
        timer = setTimeout(() => {
          lastCall = Date.now()
          timer = null
          fn(...args)
        }, remaining)
      }
    }
  }

  static debounceImmediate<T extends (...args: any[]) => any>(
    fn: T,
    delay: number,
  ): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null
    let called = false

    return (...args: Parameters<T>) => {
      if (!called) {
        fn(...args)
        called = true
      }

      if (timer) {
        clearTimeout(timer)
      }

      timer = setTimeout(() => {
        called = false
        timer = null
      }, delay)
    }
  }
}
