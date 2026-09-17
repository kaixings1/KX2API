import { parsePlainTextToolCalls } from './src/utils/plainTextToolCallRepair.ts'
const allowed = new Set(['ls'])
const t1 = '<invoke name="list_dir">