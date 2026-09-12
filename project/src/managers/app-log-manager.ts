import * as fs from 'fs/promises';
import * as path from 'path';
import { AppLog, LogFilter } from '../types/interfaces';
import { logger } from '../utils/logger';

class AppLogManager {
  private logFile: string;
  private logs: AppLog[] = [];
  private bufferSize: number = 100;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(logFile: string = './logs/app.json') {
    this.logFile = logFile;
    this.init();
  }

  private async init() {
    try {
      await fs.mkdir(path.dirname(this.logFile), { recursive: true });
      const data = await fs.readFile(this.logFile, 'utf-8');
      const legacyLogs = JSON.parse(data) as AppLog[];
      this.logs = legacyLog
