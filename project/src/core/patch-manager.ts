import * as fs from 'fs/promises';
import * as path from 'path';
import { Patch, PatchConfig } from '../types/interfaces';
import { loadConfig, savePatch, loadPatch, listPatches, backupFile, validatePatchContent } from '../utils/patch-utils';
import { logger } from '../utils/logger';

class PatchManager {
  private config: PatchConfig;
  private appliedPatches: Set<string> = new Set();

  constructor() {
    this.config = {
      patchDir: './patches',
      backupDir: './backups',
      logLevel: 'info',
      autoBackup: true,
      allowedPatchTypes: ['feature', 'fix', 'config'],
      maxBackupCount: 10
    };
  }

  async init(configPath?: string) {
    if (configPath) {
      this.config = await loadConfig(configPath);
    }
    logger.info('PatchManager', 'Patch manager initialized', { config: this.config });
    // Load already applied patches from history
    const patches = await listPatches(this.config);
    patches.filter(p => p.status === 'applied').forEach(p => this.appliedPatches.add(p.id));
  }

  async createPatch(type: Patch['type'], name: string, description: string, content: string): Promise<Patch> {
    if (!this.config.allowedPatchTypes.includes(type)) {
      throw new Error(`Patch type ${type} is not allowed`);
    }
    const patch: Patch = {
      id: `patch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      name,
      description,
      content,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    await savePatch(patch, this.config);
    logger.info('PatchManager', `Patch created: ${patch.id}`, { patch });
    return patch;
  }

  async applyPatch(patchId: string, targetPath: string): Promise<boolean> {
    if (this.appliedPatches.has(patchId)) {
      logger.warn('PatchManager', `Patch ${patchId} already applied`);
      return true;
    }

    try {
      const patch = await loadPatch(patchId, this.config);
      if (patch.status === 'applied') {
        this.appliedPatches.add(patchId);
        return true;
      }

      // Create backup if enabled
      if (this.config.autoBackup) {
        await backupFile(targetPath, this.config);
      }

      // Apply patch content to target file
      await fs.writeFile(targetPath, patch.content, 'utf-8');
      
      // Update patch status
      patch.status = 'applied';
      patch.appliedAt = new Date().toISOString();
      await savePatch(patch, this.config);
      this.appliedPatches.add(patchId);

      logger.info('PatchManager', `Patch ${patchId} applied successfully to ${targetPath}`);
      return true;
    } catch (error) {
      logger.error('PatchManager', `Failed to apply patch ${patchId}`, { error: (error as Error).message });
      return false;
    }
  }

  async rollbackPatch(patchId: string, targetPath: string): Promise<boolean> {
    try {
      const patch = await loadPatch(patchId, this.config);
      if (patch.status !== 'applied') {
        logger.warn('PatchManager', `Patch ${patchId} is not applied, cannot rollback`);
        return false;
      }

      // Find latest backup
      const backupFiles = await fs.readdir(this.config.backupDir);
      const targetBackups = backupFiles
        .filter(f => f.startsWith(path.basename(targetPath)) && f.endsWith('.bak'))
        .sort((a, b) => b.localeCompare(a)); // Sort by timestamp desc

      if (targetBackups.length === 0) {
        throw new Error('No backup found for rollback');
      }

      const latestBackup = path.join(this.config.backupDir, targetBackups[0]);
      await fs.copyFile(latestBackup, targetPath);

      // Update patch status
      patch.status = 'rolledback';
      await savePatch(patch, this.config);
      this.appliedPatches.delete(patchId);

      logger.info('PatchManager', `Patch ${patchId} rolled back successfully`);
      return true;
    } catch (error) {
      logger.error('PatchManager', `Failed to rollback patch ${patchId}`, { error: (error as Error).message });
      return false;
    }
  }

  async getPatchStatus(patchId: string): Promise<Patch | null> {
    try {
      return await loadPatch(patchId, this.config);
    } catch {
      return null;
    }
  }

  async getAllPatches(): Promise<Patch[]> {
    return listPatches(this.config);
  }

  async cleanOldBackups() {
    try {
      const backupFiles = await fs.readdir(this.config.backupDir);
      if (backupFiles.length <= this.config.maxBackupCount) return;

      // Sort by creation time (oldest first)
      const sortedBackups = backupFiles
        .filter(f => f.endsWith('.bak'))
        .sort((a, b) => a.localeCompare(b));

      const toDelete = sortedBackups.slice(0, sortedBackups.length - this.config.maxBackupCount);
      for (const file of toDelete) {
        await fs.unlink(path.join(this.config.backupDir, file));
        logger.info('PatchManager', `Deleted old backup ${file}`);
      }
    } catch (error) {
      logger.error('PatchManager', 'Failed to clean old backups', { error: (error as Error).message });
    }
  }
}

export const patchManager = new PatchManager();
