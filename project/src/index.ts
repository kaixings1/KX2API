import { TestEngine } from './core/TestEngine';
import { PatchManager } from './managers/PatchManager';
import { AppLogManager } from './managers/AppLogManager';

export class SelfTestApp {
  private engine: TestEngine;
  private patchManager: PatchManager;
  private logger: AppLogManager;

  constructor() {
    this.engine = new TestEngine();
    this.patchManager = new PatchManager(this.engine);
    this.logger = new AppLogManager();
  }

  async runTestCycle(): Promise<void> {
    this.logger.log('info', 'app', 'Starting test cycle');
    
    const testResult = await this.engine.test();
    this.logger.log('info', 'app', `Tests completed: ${testResult.passed} passed, ${testResult.failed} failed`);
    
    const verifyResult = await this.engine.verify();
    this.logger.log('info', 'app', `Verification: ${verifyResult.isValid ? 'PASSED' : 'FAILED'}`);
    
    if (!verifyResult.isValid) {
      this.logger.log('error', 'app', `Verification failed: ${verifyResult.summary}`);
    }
  }

  getEngine(): TestEngine {
    return this.engine;
  }

  getPatchManager(): PatchManager {
    return this.patchManager;
  }

  async shutdown(): Promise<void> {
    await this.logger.shutdown();
  }
}

export default SelfTestApp;
