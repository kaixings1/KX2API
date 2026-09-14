/**
 * Session Manager Module
 * Manages conversation sessions for stateless single-turn dialogue
 */
import { SessionRecord, SessionConfig, ChatMessage } from '../store/types';
export interface CreateSessionOptions {
    providerId: string;
    accountId: string;
    model?: string;
    sessionType?: 'chat' | 'agent';
}
export interface SessionContext {
    sessionId: string;
    providerSessionId: string | undefined;
    parentMessageId: string | undefined;
    messages: ChatMessage[];
    isNew: boolean;
}
declare class SessionManagerClass {
    private cleanupInterval;
    initialize(): void;
    destroy(): void;
    private startCleanupScheduler;
    getSessionConfig(): SessionConfig;
    updateSessionConfig(updates: Partial<SessionConfig>): SessionConfig;
    getOrCreateSession(options: CreateSessionOptions): SessionContext;
    getActiveSession(providerId: string, accountId: string): SessionRecord | undefined;
    createSession(options: CreateSessionOptions): SessionRecord;
    getSession(sessionId: string): SessionRecord | undefined;
    getAllActiveSessions(): SessionRecord[];
    getAllSessions(): SessionRecord[];
    deleteSession(sessionId: string): boolean;
    cleanExpiredSessions(): number;
    clearAllSessions(): void;
    getSessionsByAccount(accountId: string): SessionRecord[];
    getSessionsByProvider(providerId: string): SessionRecord[];
    shouldDeleteAfterChat(): boolean;
    updateProviderSessionId(sessionId: string, providerSessionId: string): void;
    updateParentMessageId(sessionId: string, parentMessageId: string): void;
    addMessage(sessionId: string, message: Omit<ChatMessage, 'timestamp'>): void;
    private generateSessionId;
}
export declare const sessionManager: SessionManagerClass;
export default sessionManager;
