import { open, QuickSQLiteConnection } from 'react-native-quick-sqlite';
import { DB_NAME } from '../utils/constants';
import {
  encryptEmbedding,
  decryptEmbedding,
  encryptForTransit,
  generateUUID,
} from './securityService';
import { cosineSimilarity } from '../utils/mathUtils';

export interface User {
  id: string;
  name: string;
  createdAt: number;
}

export interface AuthEvent {
  id?: string;
  userId?: string;
  result: 'success' | 'fail';
  confidence: number;
  durationMs: number;
  livenessScore: number;
  timestamp: number;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface SyncEvent {
  id: string;
  eventType: string;
  payloadEncrypted: string;
  retryCount: number;
  status: string;
  createdAt: number;
}

export interface MatchResult {
  userId: string;
  name: string;
  confidence: number;
}

export interface DBStats {
  userCount: number;
  eventCount: number;
  pendingSyncCount: number;
}

class EmbeddingDB {
  private db: QuickSQLiteConnection | null = null;

  async initDatabase(): Promise<void> {
    try {
      this.db = open({ name: DB_NAME, location: 'default' });
      
      this.db.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);

      this.db.execute(`
        CREATE TABLE IF NOT EXISTS embeddings (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          embedding_encrypted TEXT NOT NULL,
          iv TEXT NOT NULL,
          tag TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      this.db.execute(`
        CREATE TABLE IF NOT EXISTS auth_events (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          result TEXT NOT NULL,
          confidence REAL NOT NULL,
          duration_ms INTEGER NOT NULL,
          liveness_score REAL NOT NULL,
          timestamp INTEGER NOT NULL,
          sync_status TEXT NOT NULL
        )
      `);

      this.db.execute(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          payload_encrypted TEXT NOT NULL,
          retry_count INTEGER DEFAULT 0,
          status TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);
      
    } catch (error) {
      console.error('Failed to initialize database', error);
      throw error;
    }
  }

  async enrollUser(name: string, embedding: number[]): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    
    const userId = generateUUID();
    const timestamp = Date.now();
    
    try {
      const encryptedData = await encryptEmbedding(embedding, userId);
      
      await this.db.transaction((tx) => {
        tx.execute('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)', [userId, name, timestamp]);
        tx.execute(
          'INSERT INTO embeddings (id, user_id, embedding_encrypted, iv, tag, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [generateUUID(), userId, encryptedData.ciphertext, encryptedData.iv, encryptedData.tag, timestamp]
        );
      });
      
      return userId;
    } catch (error) {
      console.error('Failed to enroll user', error);
      throw error;
    }
  }

  async findMatch(queryEmbedding: number[], threshold: number = 0.65): Promise<MatchResult | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const { rows } = this.db.execute('SELECT u.id, u.name, e.embedding_encrypted, e.iv, e.tag FROM users u JOIN embeddings e ON u.id = e.user_id');
      if (!rows || rows.length === 0) return null;
      
      let bestMatch: MatchResult | null = null;
      let highestConfidence = -1;
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows.item(i);
        const storedEmbedding = await decryptEmbedding({
          ciphertext: row.embedding_encrypted,
          iv: row.iv,
          tag: row.tag
        }, row.id);
        
        const confidence = cosineSimilarity(queryEmbedding, storedEmbedding);
        
        if (confidence > threshold && confidence > highestConfidence) {
          highestConfidence = confidence;
          bestMatch = {
            userId: row.id,
            name: row.name,
            confidence
          };
        }
      }
      
      return bestMatch;
    } catch (error) {
      console.error('Failed to find match', error);
      throw error;
    }
  }

  async logAuthEvent(event: AuthEvent): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    
    const eventId = event.id || generateUUID();
    
    try {
      this.db.execute(
        'INSERT INTO auth_events (id, user_id, result, confidence, duration_ms, liveness_score, timestamp, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [eventId, event.userId || null, event.result, event.confidence, event.durationMs, event.livenessScore, event.timestamp, event.syncStatus]
      );
      
      // Also add to sync queue if pending
      if (event.syncStatus === 'pending') {
        const payloadStr = JSON.stringify(event);
        const encryptedPayload = await encryptForTransit(payloadStr);
        this.db.execute(
          'INSERT INTO sync_queue (id, event_type, payload_encrypted, status, created_at) VALUES (?, ?, ?, ?, ?)',
          [eventId, 'auth_event', encryptedPayload, 'pending', Date.now()]
        );
      }
      
      return eventId;
    } catch (error) {
      console.error('Failed to log auth event', error);
      throw error;
    }
  }

  async getAuthHistory(limit: number = 50, filter?: string): Promise<AuthEvent[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM auth_events';
    const params: any[] = [];
    
    if (filter && filter !== 'All') {
      query += ' WHERE result = ?';
      params.push(filter.toLowerCase());
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);
    
    try {
      const { rows } = this.db.execute(query, params);
      const events: AuthEvent[] = [];
      
      if (rows) {
        for (let i = 0; i < rows.length; i++) {
          const row = rows.item(i);
          events.push({
            id: row.id,
            userId: row.user_id,
            result: row.result as 'success' | 'fail',
            confidence: row.confidence,
            durationMs: row.duration_ms,
            livenessScore: row.liveness_score,
            timestamp: row.timestamp,
            syncStatus: row.sync_status as any
          });
        }
      }
      
      return events;
    } catch (error) {
      console.error('Failed to get auth history', error);
      throw error;
    }
  }

  async getEnrolledUsers(): Promise<User[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const { rows } = this.db.execute('SELECT * FROM users ORDER BY created_at DESC');
      const users: User[] = [];
      
      if (rows) {
        for (let i = 0; i < rows.length; i++) {
          const row = rows.item(i);
          users.push({
            id: row.id,
            name: row.name,
            createdAt: row.created_at
          });
        }
      }
      
      return users;
    } catch (error) {
      console.error('Failed to get enrolled users', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      // ON DELETE CASCADE will handle embeddings
      this.db.execute('DELETE FROM users WHERE id = ?', [userId]);
    } catch (error) {
      console.error('Failed to delete user', error);
      throw error;
    }
  }

  async getPendingSyncEvents(limit: number): Promise<SyncEvent[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const { rows } = this.db.execute('SELECT * FROM sync_queue WHERE status IN (?, ?) ORDER BY created_at ASC LIMIT ?', ['pending', 'failed', limit]);
      const events: SyncEvent[] = [];
      
      if (rows) {
        for (let i = 0; i < rows.length; i++) {
          const row = rows.item(i);
          events.push({
            id: row.id,
            eventType: row.event_type,
            payloadEncrypted: row.payload_encrypted,
            retryCount: row.retry_count,
            status: row.status,
            createdAt: row.created_at
          });
        }
      }
      
      return events;
    } catch (error) {
      console.error('Failed to get pending sync events', error);
      throw error;
    }
  }

  async updateSyncStatus(ids: string[], status: string): Promise<void> {
    if (!this.db || ids.length === 0) return;
    
    try {
      const placeholders = ids.map(() => '?').join(',');
      
      await this.db.transaction((tx) => {
        tx.execute(`UPDATE sync_queue SET status = ? WHERE id IN (${placeholders})`, [status, ...ids]);
        tx.execute(`UPDATE auth_events SET sync_status = ? WHERE id IN (${placeholders})`, [status, ...ids]);
      });
    } catch (error) {
      console.error('Failed to update sync status', error);
      throw error;
    }
  }

  async deleteSyncEvents(ids: string[]): Promise<void> {
    if (!this.db || ids.length === 0) return;
    
    try {
      const placeholders = ids.map(() => '?').join(',');
      this.db.execute(`DELETE FROM sync_queue WHERE id IN (${placeholders})`, ids);
    } catch (error) {
      console.error('Failed to delete sync events', error);
      throw error;
    }
  }

  async getStats(): Promise<DBStats> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const { rows: users } = this.db.execute('SELECT COUNT(*) as c FROM users');
      const { rows: events } = this.db.execute('SELECT COUNT(*) as c FROM auth_events');
      const { rows: pending } = this.db.execute('SELECT COUNT(*) as c FROM sync_queue WHERE status = ?', ['pending']);
      
      return {
        userCount: users?.item(0).c || 0,
        eventCount: events?.item(0).c || 0,
        pendingSyncCount: pending?.item(0).c || 0
      };
    } catch (error) {
      console.error('Failed to get stats', error);
      throw error;
    }
  }
}

export const embeddingDB = new EmbeddingDB();
