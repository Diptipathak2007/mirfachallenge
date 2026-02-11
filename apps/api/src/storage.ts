import { TxSecureRecord } from '@mirfa/crypto';

/**
 * In-memory storage for secure transaction records.
 * Uses a singleton Map instance.
 */
export const store = new Map<string, TxSecureRecord>();
