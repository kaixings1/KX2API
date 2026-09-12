import { PatchManager } from '../../src/managers/PatchManager';
import { TestEngine } from '../../src/core/TestEngine';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('PatchManager', () => {
  let engine: TestEngine;
  let manager: PatchManager;
  const testDir = '.test-patches';

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    engine = new TestEngine();
    manager = new PatchManager(engine, path.join(testDir, 'backups'));
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should apply a simple patch', async () => {
    const testFile = path.join(testDir, 'test.txt');
    const patch = {
      id: 'test-1',
      target: 'test',
      changes: [{
        file: testFile,
        type: 'add' as const,
        content: 'Hello World'
      }],
      description: 'Test patch',
      version: '1.0.0'
    };

    const result = await manager.applyPatch(patch, false);
    expect(result.applied).toBe(true);
    expect(result.patchedFiles).toContain(testFile);
    
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe('Hello World');
  });

  it('should track patch history', async () => {
    const history = manager.getHistory();
    expect(history.length).toBeGreaterThan(0);
  });
});
