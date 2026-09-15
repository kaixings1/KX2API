/**
 * utils/file.ts — 文件查找工具函数
 */

import { readdir } from 'fs/promises';
import path from 'path';

/**
 * 在 rootDir 中查找与 targetName 最相似的文件名
 * 用于编辑块应用失败时，通过模糊文件名匹配定位实际文件
 */
export async function findSimilarFile(targetName: string, rootDir?: string): Promise<string | null> {
  const dir = rootDir || process.cwd();
  const baseName = path.basename(targetName);

  let entries: { name: string; fullPath: string }[] = [];
  try {
    const names = await readdir(dir, { withFileTypes: true });
    for (const entry of names) {
      if (entry.isFile()) {
        entries.push({ name: entry.name, fullPath: path.join(dir, entry.name) });
      }
    }
  } catch {
    return null;
  }

  if (entries.length === 0) return null;

  // 精确匹配
  const exact = entries.find(e => e.name === baseName);
  if (exact) return exact.fullPath;

  // 去掉扩展名再匹配
  const baseNoExt = baseName.replace(/\.[^.]+$/, '');
  const partial = entries.find(e => e.name.replace(/\.[^.]+$/, '') === baseNoExt);
  if (partial) return partial.fullPath;

  // 包含关系匹配
  const contains = entries.find(e =>
    e.name.toLowerCase().includes(baseName.toLowerCase()) ||
    baseName.toLowerCase().includes(e.name.toLowerCase())
  );
  if (contains) return contains.fullPath;

  return null;
}
