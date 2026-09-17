import { describe, it, expect } from 'vitest'
import {
  applyImageBudget,
  countImageTokens,
  estimateImageTokens,
  isImageBlock,
  IMAGE_ELIDED_PLACEHOLDER,
} from '../../engine/imageBudget'

/**
 * 图片预算。
 *
 * 解决的问题：base64 图片**永久驻留对话历史**且无法被摘要压缩
 * （摘要是把消息换成文字描述；图片一旦进历史只能保留或整条丢弃）。
 * 几张截图就能堆出几十万 token，远超文本消息。
 *
 * 此前 `MessageLoopDeps.imageBudget` 只在类型里声明、**从未向下传递**，
 * 图片占用完全不受控。
 */

/** 构造一张 base64 图片块，size 为 base64 正文字符数 */
const img = (size: number, mime = 'image/png') => ({
  type: 'image_url',
  image_url: { url: `data:${mime};base64,${'A'.repeat(size)}` },
})

const txt = (t: string) => ({ type: 'text', text: t })

describe('isImageBlock', () => {
  it('识别 OpenAI 形态', () => {
    expect(isImageBlock({ type: 'image_url', image_url: { url: 'x' } })).toBe(true)
  })

  it('识别 Anthropic 形态', () => {
    expect(
      isImageBlock({ type: 'image', source: { type: 'base64', data: 'x' } }),
    ).toBe(true)
  })

  it('文本块与空值不算图片', () => {
    expect(isImageBlock({ type: 'text', text: 'hi' })).toBe(false)
    expect(isImageBlock(null)).toBe(false)
    expect(isImageBlock('string')).toBe(false)
  })
})

describe('estimateImageTokens', () => {
  it('按 base64 正文长度折算（前缀不计）', () => {
    const t = estimateImageTokens(img(2500))
    expect(t).toBe(1000) // 2500 / 2.5
  })

  it('data URL 前缀不占 token', () => {
    const short = estimateImageTokens({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,' + 'A'.repeat(2500) },
    })
    const noPrefix = estimateImageTokens({
      type: 'image_url',
      image_url: { url: 'A'.repeat(2500) },
    })
    expect(short).toBe(noPrefix)
  })

  it('仅有 URL 无内联数据时按固定值估算', () => {
    expect(estimateImageTokens({ type: 'image_url', image_url: { url: 'https://x/a.png' } }))
      .toBeGreaterThan(0)
  })
})

describe('applyImageBudget —— 未配置时不做事', () => {
  const messages = [{ role: 'user', content: [txt('hi'), img(50000)] }]

  it('两个预算都为 0 时原样返回（行为与改动前一致）', () => {
    const r = applyImageBudget(messages, {})
    expect(r.elidedImages).toBe(0)
    expect(r.messages[0]).toBe(messages[0])
  })

  it('未传 options 时原样返回', () => {
    expect(applyImageBudget(messages).elidedImages).toBe(0)
  })
})

describe('单条消息图片上限', () => {
  it('超限时从最旧开始替换，保留最后一张', () => {
    // 每张 2500 字符 ≈ 1000 token，阈值 2500 → 需替换掉 1 张
    const messages = [
      { role: 'user', content: [img(2500), img(2500), img(2500)] },
    ]
    const r = applyImageBudget(messages, {
      maxImageTokensPerMessage: 2000,
      keepRecentMessages: 0,
    })
    expect(r.elidedImages).toBeGreaterThan(0)
    // 首块被替换为占位符，最后一块保留
    const blocks = r.messages[0].content as unknown[]
    expect(JSON.stringify(blocks[0])).toContain('图片已移除')
    expect(JSON.stringify(blocks[blocks.length - 1])).toContain('base64')
  })

  it('未超限时不动', () => {
    const messages = [{ role: 'user', content: [img(250)] }]
    const r = applyImageBudget(messages, {
      maxImageTokensPerMessage: 10000,
      keepRecentMessages: 0,
    })
    expect(r.elidedImages).toBe(0)
  })
})

describe('最近消息受保护（关键行为）', () => {
  it('最后一轮的图片永不被替换 —— 用户刚发的图正在被讨论', () => {
    const messages = [
      { role: 'user', content: [img(50000)] },
      { role: 'assistant', content: [txt('我看看')] },
      { role: 'user', content: [img(50000)] }, // 最新
    ]
    const r = applyImageBudget(messages, {
      historyBase64TokenThreshold: 100,
      keepRecentMessages: 1,
    })
    // 最后一条的图必须原样保留
    const lastBlocks = r.messages[2].content as unknown[]
    expect(JSON.stringify(lastBlocks[0])).toContain('base64')
    // 更早的那张被替换
    const firstBlocks = r.messages[0].content as unknown[]
    expect(JSON.stringify(firstBlocks[0])).toContain('图片已移除')
  })

  it('keepRecentMessages 可调大以保护更多轮', () => {
    const messages = [
      { role: 'user', content: [img(50000)] },
      { role: 'user', content: [img(50000)] },
    ]
    const r = applyImageBudget(messages, {
      historyBase64TokenThreshold: 100,
      keepRecentMessages: 5,
    })
    expect(r.elidedImages).toBe(0)
  })
})

describe('历史总量预算', () => {
  it('超阈值时从最旧的开始替换', () => {
    const messages = [
      { role: 'user', content: [img(25000)] }, // ≈10000 token
      { role: 'user', content: [img(25000)] },
      { role: 'user', content: [img(25000)] },
    ]
    const r = applyImageBudget(messages, {
      historyBase64TokenThreshold: 12000,
      keepRecentMessages: 0,
    })
    // 需替换到总量 <= 12000，即至少替换 2 张
    expect(r.elidedImages).toBeGreaterThanOrEqual(2)
    expect(r.elidedTokens).toBeGreaterThan(0)
  })

  it('未超阈值时不动', () => {
    const messages = [{ role: 'user', content: [img(250)] }]
    const r = applyImageBudget(messages, {
      historyBase64TokenThreshold: 100000,
      keepRecentMessages: 0,
    })
    expect(r.elidedImages).toBe(0)
  })
})

describe('健壮性', () => {
  it('不改入参（纯函数）', () => {
    const messages = [{ role: 'user', content: [img(50000)] }]
    const before = JSON.stringify(messages)
    applyImageBudget(messages, {
      historyBase64TokenThreshold: 1,
      keepRecentMessages: 0,
    })
    expect(JSON.stringify(messages)).toBe(before)
  })

  it('幂等：已替换的占位块不会被重复计数或再次替换', () => {
    const withPlaceholder = [
      { role: 'user', content: [{ type: 'text', text: IMAGE_ELIDED_PLACEHOLDER }] },
      { role: 'user', content: [img(25000)] },
    ]
    const r = applyImageBudget(withPlaceholder, {
      historyBase64TokenThreshold: 100,
      keepRecentMessages: 0,
    })
    // 只应处理那一张真图
    expect(r.elidedImages).toBe(1)
  })

  it('字符串内容的消息不受影响', () => {
    const messages = [{ role: 'user', content: 'plain text' }]
    const r = applyImageBudget(messages, {
      historyBase64TokenThreshold: 1,
      keepRecentMessages: 0,
    })
    expect(r.messages[0].content).toBe('plain text')
  })

  it('非数组内容（undefined / null）不崩', () => {
    const messages = [{ role: 'user' }, { role: 'assistant', content: null }]
    expect(() =>
      applyImageBudget(messages as never, {
        historyBase64TokenThreshold: 1,
        keepRecentMessages: 0,
      }),
    ).not.toThrow()
  })
})

describe('countImageTokens 统计', () => {
  it('累加所有图片的估算值', () => {
    const messages = [
      { content: [img(2500), txt('hi')] },
      { content: [img(2500)] },
    ]
    expect(countImageTokens(messages)).toBe(2000) // 1000 + 1000
  })

  it('忽略已被替换的占位块', () => {
    const messages = [{ content: [{ type: 'text', text: IMAGE_ELIDED_PLACEHOLDER }] }]
    expect(countImageTokens(messages)).toBe(0)
  })
})
