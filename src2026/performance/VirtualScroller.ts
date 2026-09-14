/**
 * VirtualScroller — KX2API 适配版
 *
 * 从 doge-desktop src/performance/VirtualScroller.ts 移植
 * 虚拟滚动管理器，支持动态高度和 overscan
 */

export interface VirtualScrollItem<T = any> {
  index: number
  offset: number
  size: number
  item: T
}

export interface VirtualScrollConfig {
  itemHeight: number | ((index: number) => number)
  viewportHeight: number
  overscan: number
}

export class VirtualScroller<T> {
  private items: T[] = []
  private config: VirtualScrollConfig
  private scrollTop = 0

  constructor(config: Partial<VirtualScrollConfig> = {}) {
    this.config = {
      itemHeight: 24,
      viewportHeight: 600,
      overscan: 5,
      ...config,
    }
  }

  setItems(items: T[]): void {
    this.items = items
  }

  setScrollTop(scrollTop: number): void {
    this.scrollTop = Math.max(0, scrollTop)
  }

  getVisibleItems(): VirtualScrollItem<T>[] {
    const visibleItems: VirtualScrollItem<T>[] = []
    const startIndex = this.getStartIndex()
    const endIndex = this.getEndIndex(startIndex)

    for (let i = startIndex; i <= endIndex && i < this.items.length; i++) {
      visibleItems.push({
        index: i,
        offset: this.getOffsetForIndex(i),
        size: this.getItemHeight(i),
        item: this.items[i],
      })
    }

    return visibleItems
  }

  getTotalHeight(): number {
    let total = 0
    for (let i = 0; i < this.items.length; i++) {
      total += this.getItemHeight(i)
    }
    return total
  }

  private getStartIndex(): number {
    let offset = 0
    for (let i = 0; i < this.items.length; i++) {
      const height = this.getItemHeight(i)
      if (offset + height >= this.scrollTop) {
        return Math.max(0, i - this.config.overscan)
      }
      offset += height
    }
    return 0
  }

  private getEndIndex(startIndex: number): number {
    let offset = this.getOffsetForIndex(startIndex)
    for (let i = startIndex; i < this.items.length; i++) {
      offset += this.getItemHeight(i)
      if (offset >= this.scrollTop + this.config.viewportHeight) {
        return Math.min(this.items.length - 1, i + this.config.overscan)
      }
    }
    return this.items.length - 1
  }

  private getOffsetForIndex(index: number): number {
    let offset = 0
    for (let i = 0; i < index; i++) {
      offset += this.getItemHeight(i)
    }
    return offset
  }

  private getItemHeight(index: number): number {
    if (typeof this.config.itemHeight === 'function') {
      return this.config.itemHeight(index)
    }
    return this.config.itemHeight
  }
}
