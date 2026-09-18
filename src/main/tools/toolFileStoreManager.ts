/**
 * main/tools/toolFileStoreManager.ts — 工具分组/文件化存储全局管理器
 *
 * 基于 toolFileStore.ts 构建，对外提供统一的单例接口。
 */

import { toolFileStore } from './toolFileStore.ts'

export class ToolFileStoreManager {
  private static _instance: ToolFileStoreManager | null = null

  static getInstance(): ToolFileStoreManager {
    if (!ToolFileStoreManager._instance) {
      ToolFileStoreManager._instance = new ToolFileStoreManager()
    }
    return ToolFileStoreManager._instance
  }

  /** 底层文件化存储实例 */
  readonly store = toolFileStore
}

export const toolFileStoreManager = ToolFileStoreManager.getInstance()
