import * as fs from 'fs/promises';
import * as path from 'path';
import { Patch, PatchConfig } from '../types/interfaces';
import { logger } from './logger';

export async function loadConfig(configPath: string = './config/patch-config.json'): Promise<PatchConfig> {
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData) as PatchConfig;
  } catch (error) {
    logger.error('PatchUtils', 'Failed to load config', { error: (error as Error).message });
    throw new Error(`Failed to load config from ${configPath}`);
  }
}

export async function savePatch(patch: Patch, config: PatchConfig): Promise<void> {
  const patchPath = path.join(config.patchDir, `${patch.id}.json`);
  try {
    await fs.mkdir(config.patchDir, { recursive: true });
    await fs.writeFile(patchPath, JSON.stringify(patch, null, 2));
    logger.info('PatchUtils', `Patch saved to ${patchPath}`, { patchId: patch.id });
  } catch (error) {
    logger.error('PatchUtils', 'Failed to save patch', { error: (error as Error).message, patchId: patch.id });
    throw error;
  }
}

export async function loadPatch(patchId: string, config: PatchConfig): Promise<Patch> {
  const patchPath = path.join(config.patchDir, `${patchId}.json`);
  try {
    const patchData = await fs.readFile(patchPath, 'utf-8');
    return JSON.parse(patchData) as Patch;
  } catch (error) {
    logger.error('PatchUtils', 'Failed to load patch', { error: (error as Error).message, patchId });
    throw error;
  }
}

export async function listPatches(config: PatchConfig): Promise<Patch[]> {
  try {
    await fs.mkdir(config.patchDir, { recursive: true });
    const files = await fs.readdir(config.patchDir);
    const patchFiles = files.filter(f => f.endsWith('.json'));
    const patches = await Promise.all(
      patchFiles.map(file => loadPatch(file.replace('.json', ''), config))
    );
    return patches;
  } catch (error) {
    logger.error('PatchUtils', 'Failed to list patches', { error: (error as Error).message });
    return [];
  }
}

export async function backupFile(filePath: string, config: PatchConfig): Promise<string> {
  try {
    await fs.mkdir(config.backupDir, { recursive: true });
    const fileName = path.basename(filePath);
    const backupPath = path.join(config.backupDir, `${fileName}.${Date.now()}.bak`);
    await fs.copyFile(filePath, backupPath);
    logger.info('PatchUtils', `Backup created at ${backupPath}`, { original: filePath, backup: backupPath });
    return backupPath;
  } catch (error) {
    logger.error('PatchUtils', 'Failed to create backup', { error: (error as Error).message, filePath });
    throw error;
  }
}

export function validatePatchContent(content: string): boolean {
  try {
    const patch = JSON.parse(content) as Patch;
    return !!patch.id && !!patch.type && !!patch.name && !!patch.content;
  } catch {
    return false;
  }
}
