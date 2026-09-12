import { TestEngine } from '../../src/core/TestEngine';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

describe('TestEngine', () => {
  let engine: TestEngine;

  beforeAll(() => {
    engine = new TestEngine();
  });

  it('should initialize with no tests', async () => {
    const result = await engine.test();
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.success).toBe(true);
  });

  it('should verify initial state', async () => {
    const result = await engine.verify();
    expect(result.isValid).toBe(true);
    expect(result.checks.length).toBeGreaterThan(0);
  });
});
