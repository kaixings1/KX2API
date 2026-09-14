import type { ToolProtocolAdapter } from './base.ts';
import type { ToolProtocolId } from '../types.ts';
export declare function getToolProtocol(id: ToolProtocolId): ToolProtocolAdapter;
export declare function getManagedProtocols(): ToolProtocolAdapter[];
