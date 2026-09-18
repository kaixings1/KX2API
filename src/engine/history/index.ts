/**
 * engine/history/index.ts — 历史系统 barrel export
 */
export {
  historyManager,
} from './historyManager.ts'
export type {
  TimestampedHistoryEntry,
} from './historyManager.ts'
export {
  parseReferences,
  formatPastedTextRef,
  getPastedTextRefNumLines,
  expandPastedTextRefs,
  formatImageRef,
  type Reference,
  type FileReference,
  type ImageReference,
  type PasteReference,
  type UrlReference,
  type ReferenceType,
} from './references.ts'
