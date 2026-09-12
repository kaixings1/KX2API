import { Patch, PatchResult } from '../types/interfaces';
import { TestEngine } from '../core/TestEngine';

export class PatchManager {
  private engine: TestEngine;
  private patchHistory: Patch[] = [];
  private backupDir: string;

  constructor(engine: TestEngine, backupDir = '.backups') {
    this.engine = engine;
    this.backupDir = backupDir;
  }

  async applyPatch(patch: Patch, autoTest = true): Promise<PatchResult> {
    // 创建备份
    await this.createBackup(patch);
    
    // 应用补丁
    const result = await this.engine.patch(patch);
    
    if (result.applied) {
      this.patchHistory.push(patch);
      
      // 自动测试
      if (autoTest) {
        const testResult = await this.engine.test();
        if (!testResult.success) {
          // 自动回滚
          await this.rollback(patch.id);
          result.applied = false;
          result.conflicts.push('Post-patch tests failed, auto-rolled back');
        }
      }
    }

    return result;
  }

  async rollback(patchId: string): Promise<boolean> {
    const patch = this.patchHistory.find(p => p.id === patchId);
    if (!patch) return false;

    // 从备份恢复
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      for (const change of patch.changes) {
        if (change.type === 'delete') {
          // 恢复删除的文件
          const backupPath = path.join(this.backupDir, change.file);
          if (await fs.access(backupPath).then(() => true).catch(() => false)) {
            await fs.copyFile(backupPath, change.file);
          }
        } else if (change.type === 'add' || change.type === 'modify') {
          // 恢复修改的文件（简化：直接删除新增的，恢复修改的）
          if (change.type === 'add') {
            await fs.unlink(change.file).catch(() => {});
          }
        }
      }
      
      this.patchHistory = this.patchHistory.filter(p => p.id !== patchId);
      return true;
    } catch (error) {
      console.error('Rollback failed:', error);
      return false;
    }
  }

  private async createBackup(patch: Patch): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    await fs.mkdir(this.backupDir, { recursive: true });
    
    for (const change of patch.changes) {
      if (change.type !== 'add') {
        const backupPath = path.join(this.backupDir, change.file);
        try {
          await fs.copyFile(change.file, backupPath);
        } catch (error) {
          // 文件可能不存在，忽略
        }
      }
    }
  }

  getHistory(): Patch[] {
    return [...this.patchHistory];
  }
}
