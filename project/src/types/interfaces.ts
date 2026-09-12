export interface PatchConfig {
  patchDir: string;
  backupDir: string;
  logLevel: string;
  autoBackup: boolean;
  allowedPatchTypes: string[];
  maxBackupCount: number;
}

export interface Patch {
  id: string;
  type: 'feature' | 'fix' | 'config';
  name: string;
  description: string;
  content: string;
  createdAt: string;
  appliedAt?: string;
  status: 'pending' | 'applied' | 'failed' | 'rolledback';
}

export interface AppLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  module: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface LogFilter {
  level?: string;
  module?: string;
  startTime?: string;
  endTime?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}
