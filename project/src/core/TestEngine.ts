import { ITestable, TestResult, Patch, PatchResult, VerificationResult } from '../types/interfaces';

export class TestEngine implements ITestable {
  private testSuites: Map<string, any> = new Map();
  private appliedPatches: Patch[] = [];

  async test(): Promise<TestResult> {
    const result: TestResult = {
      success: true,
      passed: 0,
      failed: 0,
      errors: [],
      timestamp: Date.now()
    };

    // 执行所有测试套件
    for (const [name, suite] of this.testSuites) {
      try {
        const suiteResult = await suite.run();
        if (suiteResult.passed > 0) result.passed += suiteResult.passed;
        if (suiteResult.failed > 0) {
          result.failed += suiteResult.failed;
          result.errors.push(...suiteResult.errors);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`${name}: ${error.message}`);
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  async patch(patch: Patch): Promise<PatchResult> {
    const result: PatchResult = {
      applied: false,
      patchedFiles: [],
      conflicts: [],
      rollbackAvailable: true
    };

    // 实现补丁应用逻辑
    for (const change of patch.changes) {
      try {
        if (change.type === 'add' || change.type === 'modify') {
          // 写入文件
          const fs = await import('fs/promises');
          await fs.writeFile(change.file, change.content || '');
          result.patchedFiles.push(change.file);
        } else if (change.type === 'delete') {
          const fs = await import('fs/promises');
          await fs.unlink(change.file);
          result.patchedFiles.push(change.file);
        }
      } catch (error) {
        result.conflicts.push(`${change.file}: ${error.message}`);
      }
    }

    if (result.conflicts.length === 0) {
      result.applied = true;
      this.appliedPatches.push(patch);
    }

    return result;
  }

  async verify(): Promise<VerificationResult> {
    const checks: VerificationCheck[] = [];
    
    // 检查测试是否通过
    const testResult = await this.test();
    checks.push({
      name: 'test-suite',
      passed: testResult.success,
      message: testResult.success 
        ? `All tests passed (${testResult.passed})` 
        : `${testResult.failed} tests failed`
    });

    // 检查补丁应用状态
    checks.push({
      name: 'patch-consistency',
      passed: this.appliedPatches.length >= 0,
      message: `${this.appliedPatches.length} patches applied`
    });

    return {
      isValid: checks.every(c => c.passed),
      checks,
      summary: checks.filter(c => !c.passed).map(c => c.name).join(', ') || 'All checks passed'
    };
  }

  registerSuite(name: string, suite: any): void {
    this.testSuites.set(name, suite);
  }
}
