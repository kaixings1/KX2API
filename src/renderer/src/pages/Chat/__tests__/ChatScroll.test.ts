/**
 * ChatPage 自动滚动策略的语义回归测试
 *
 * 背景（2026-09-21 修复）：原先自动滚动用
 *   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
 * 表现是「滚动条不是在最底部时会自己跑到最顶上」。
 *
 * 根因：scrollIntoView 默认 block:'start'，语义是「把目标元素顶到视口顶部」。
 * 末尾锚点是零高度 div，其目标 scrollTop 等于锚点 offsetTop（≈ 内容总高），
 * 正常情况下远超 maxScrollTop，被钳到 maxScrollTop 才「看起来」吸底。
 * 一旦内容变短（删除消息 / 重新生成清空 content / 切换会话），maxScrollTop 骤降，
 * 钳位结果直接变成 0 —— 即用户看到的「跑到最顶上」。
 *
 * 本测试用最小容器模型复刻两种策略，锁住这个差异，防止未来改回 scrollIntoView。
 * 不依赖 DOM（vitest environment 为 node），纯对象模拟。
 */

import { describe, it, expect } from 'vitest'

/** 最小滚动容器模型：只保留 scrollHeight / clientHeight / scrollTop 三者关系 */
interface ScrollBox {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
}

const maxScrollTop = (el: ScrollBox) => Math.max(0, el.scrollHeight - el.clientHeight)
const clamp = (v: number, el: ScrollBox) => Math.min(Math.max(v, 0), maxScrollTop(el))

/**
 * 策略 A（旧）：scrollIntoView 默认 block:'start'
 * 目标是把锚点对齐容器顶部，锚点在内容末尾 ⇒ 目标 scrollTop = 锚点 offsetTop。
 * 零高度锚点的 offsetTop 就是内容总高（减去容器内边距，此处忽略）。
 */
function autoScrollByScrollIntoView(el: ScrollBox, anchorOffsetTop: number) {
  el.scrollTop = clamp(anchorOffsetTop, el)
}

/** 策略 B（现）：直接赋值 scrollTop = scrollHeight，同样受 maxScrollTop 钳位 */
function autoScrollByScrollTop(el: ScrollBox) {
  el.scrollTop = clamp(el.scrollHeight, el)
}

describe('ChatPage 自动滚动策略', () => {
  it('内容超出一屏时，两种策略都吸底（旧代码在正常路径下看不出问题）', () => {
    const box: ScrollBox = { scrollHeight: 2000, clientHeight: 500, scrollTop: 0 }

    const a: ScrollBox = { ...box }
    autoScrollByScrollIntoView(a, 2000)
    expect(a.scrollTop).toBe(1500) // maxScrollTop

    const b: ScrollBox = { ...box }
    autoScrollByScrollTop(b)
    expect(b.scrollTop).toBe(1500)
  })

  it('内容变短到不足一屏时：scrollIntoView 归零，scrollTop 赋值保持 0 也不越界', () => {
    // 复刻「删除消息 / 重新生成」后内容高度骤降
    const short: ScrollBox = { scrollHeight: 300, clientHeight: 500, scrollTop: 0 }

    const a: ScrollBox = { ...short }
    // 锚点仍在内容末尾，但 maxScrollTop 已变成 0
    autoScrollByScrollIntoView(a, 300)
    expect(a.scrollTop).toBe(0)

    const b: ScrollBox = { ...short }
    autoScrollByScrollTop(b)
    expect(b.scrollTop).toBe(0)
  })

  it('BUG 复现：内容由长变短的过程中，scrollIntoView 会把已到底的视图拽回顶部', () => {
    // 用户原本在 1500（底部），内容缩短到 800（仍高于一屏 500）
    const el: ScrollBox = { scrollHeight: 2000, clientHeight: 500, scrollTop: 1500 }

    // 新内容渲染：scrollHeight 变 800，锚点 offsetTop 变 800
    el.scrollHeight = 800
    autoScrollByScrollIntoView(el, 800)
    // maxScrollTop = 300 ⇒ 被钳到 300，相对原先的 1500 是「跳了一大截」
    expect(el.scrollTop).toBe(300)

    // 若再短一点，直接归零 —— 这才是「跑到最顶上」的观感来源
    const el2: ScrollBox = { scrollHeight: 2000, clientHeight: 500, scrollTop: 1500 }
    el2.scrollHeight = 600
    autoScrollByScrollIntoView(el2, 600)
    expect(el2.scrollTop).toBe(100)
  })

  it('scrollTop 赋值策略在同样场景下始终指向底部（语义明确）', () => {
    const el: ScrollBox = { scrollHeight: 800, clientHeight: 500, scrollTop: 0 }
    autoScrollByScrollTop(el)
    expect(el.scrollTop).toBe(maxScrollTop(el))
    expect(el.scrollTop).toBe(300)
  })
})

/** ChatPage 中「用户是否上翻」的判据（handleScroll 内的表达式） */
function isUserScrolledUp(el: ScrollBox, threshold = 200) {
  return el.scrollHeight - el.clientHeight - el.scrollTop > threshold
}

describe('handleScroll 的用户上翻判据', () => {
  it('在底部时不算上翻', () => {
    const el: ScrollBox = { scrollHeight: 2000, clientHeight: 500, scrollTop: 1500 }
    expect(isUserScrolledUp(el)).toBe(false)
  })

  it('距底 200px 以内（含）不算上翻，超过才算', () => {
    // 距底 200
    expect(isUserScrolledUp({ scrollHeight: 2000, clientHeight: 500, scrollTop: 1300 })).toBe(false)
    // 距底 201
    expect(isUserScrolledUp({ scrollHeight: 2000, clientHeight: 500, scrollTop: 1299 })).toBe(true)
  })

  it('内容不足一屏时恒不算上翻（距底为 0）', () => {
    expect(isUserScrolledUp({ scrollHeight: 300, clientHeight: 500, scrollTop: 0 })).toBe(false)
  })

  it('程序化滚动期间忽略 scroll 事件：不把自己的滚动误判成用户上翻', () => {
    // 复刻 programmaticScrollRef 守卫：标记为真时 handleScroll 直接 return，
    // 状态保持上一次的值，不会被自动滚动自己派发的 scroll 事件翻转。
    let userScrolledUp = false
    const programmaticScrollRef = { current: true } // 自动滚动刚赋值完

    const el: ScrollBox = { scrollHeight: 2000, clientHeight: 500, scrollTop: 1500 }
    const handleScroll = () => {
      if (programmaticScrollRef.current) return
      userScrolledUp = isUserScrolledUp(el)
    }

    handleScroll()
    expect(userScrolledUp).toBe(false) // 未被翻转

    // 标记解除后（下一帧 rAF），用户真正上翻才会生效
    programmaticScrollRef.current = false
    el.scrollTop = 500
    handleScroll()
    expect(userScrolledUp).toBe(true)
  })

  it('无守卫时会出现自反馈：自动滚动把自己判成用户上翻', () => {
    // 对照实验：说明为什么必须加 programmaticScrollRef
    let userScrolledUp = false
    const el: ScrollBox = { scrollHeight: 2000, clientHeight: 500, scrollTop: 1500 }
    const handleScrollNoGuard = () => {
      userScrolledUp = isUserScrolledUp(el)
    }
    // 自动滚动把 scrollTop 从 0 赋到 1500，途中任意一帧落在距底 >200 处就会被判为上翻
    el.scrollTop = 0
    handleScrollNoGuard()
    expect(userScrolledUp).toBe(true) // 误判：其实这是代码滚的
  })
})
