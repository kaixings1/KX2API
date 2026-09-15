export interface Message {
  role: string;
  content?: unknown;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  tool_use_id?: string;
  [key: string]: unknown;
}

export interface ToolCall {
  id?: string;
  type?: string;
  [key: string]: unknown;
}

export interface NormalizedToolCall {
  id: string | null;
  rawId: unknown;
}

export interface NormalizedToolResult {
  id: string | null;
  rawId: unknown;
}

export interface HistoryAdapter<TMessage extends Message = Message> {
  getToolCalls(message: TMessage): NormalizedToolCall[];
  getToolResults(message: TMessage): NormalizedToolResult[];
}

export type ValidationIssueCode =
  | "tool_call_without_result"
  | "tool_result_without_call"
  | "tool_result_before_call"
  | "tool_result_ordering"
  | "duplicate_tool_result"
  | "malformed_tool_call_id"
  | "malformed_tool_result_id"
  | "applied_reorder_adjacent_tool_result"
  | "applied_remove_orphan_tool_result"
  | "applied_dedupe_tool_result";

export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  severity: "error" | "warning";
  index: number;
  relatedIndex?: number;
  toolCallId?: string;
  fixable?: boolean;
}

export interface ValidateOptions<TMessage extends Message = Message> {
  adapter?: HistoryAdapter<TMessage>;
}

export interface FixOptions<TMessage extends Message = Message>
  extends ValidateOptions<TMessage> {
  removeOrphanToolResults?: boolean;
  reorderAdjacentToolResults?: boolean;
  dedupeToolResults?: boolean;
}

export interface ValidationResult<TMessage extends Message = Message> {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  fixedMessages?: TMessage[];
}

export interface FixResult<TMessage extends Message = Message>
  extends ValidationResult<TMessage> {
  fixedMessages: TMessage[];
}

export interface MessageAnalysis {
  callIds: NormalizedToolCall[];
  resultIds: NormalizedToolResult[];
  pureToolCallContainer: boolean;
  pureToolResultContainer: boolean;
}
