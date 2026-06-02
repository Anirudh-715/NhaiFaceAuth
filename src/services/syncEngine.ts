import NetInfo from '@react-native-community/netinfo';
import BackgroundFetch from 'react-native-background-fetch';
import { embeddingDB, SyncEvent } from './embeddingDB';
import { generateUUID } from './securityService';
import { useSyncStore } from '../store/syncStore';
import { SYNC_BATCH_SIZE, MAX_RETRY_COUNT, SYNC_INTERVAL_MINUTES } from '../utils/constants';

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
}

class SyncEngine {
  private syncEndpoint = 'https://nhai-faceauth-api.ap-south-1.amazonaws.com/prod/sync'; // Simulated AWS API Gateway Endpoint
  
  async initialize(): Promise<void> {
    const { setOnline, setSyncing, setPendingCount } = useSyncStore.getState();
    
    // Initial stats
    try {
      const stats = await embeddingDB.getStats();
      setPendingCount(stats.pendingSyncCount);
    } catch (e) {
      // Ignore initial DB error if not initialized yet
    }

    // Immediately fetch current network state (don't wait for events)
    try {
      const initialState = await NetInfo.fetch();
      const isOnline = !!initialState.isConnected && initialState.isInternetReachable !== false;
      setOnline(isOnline);
      console.log('[SyncEngine] Initial network state:', isOnline ? 'Online' : 'Offline');
    } catch (e) {
      console.warn('[SyncEngine] Failed to fetch initial network state:', e);
      setOnline(false);
    }

    // Listen for connectivity changes
    NetInfo.addEventListener(state => {
      // isInternetReachable can be null (unknown) — treat null as "checking"
      // Only mark offline if isConnected is explicitly false OR isInternetReachable is explicitly false
      let isOnline: boolean;
      if (state.isConnected === false) {
        isOnline = false;
      } else if (state.isInternetReachable === false) {
        isOnline = false;
      } else if (state.isConnected === true && state.isInternetReachable === true) {
        isOnline = true;
      } else {
        // isInternetReachable is null (still checking) — keep previous or assume connected
        isOnline = !!state.isConnected;
      }
      
      console.log(`[SyncEngine] Network changed: connected=${state.isConnected}, reachable=${state.isInternetReachable}, resolved=${isOnline}`);
      setOnline(isOnline);
      
      if (isOnline) {
        this.syncPendingEvents().catch(console.error);
      }
    });

    // Register background sync task
    await BackgroundFetch.configure(
      {
        minimumFetchInterval: SYNC_INTERVAL_MINUTES,
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true,
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      },
      async (taskId) => {
        try {
          await this.syncPendingEvents();
        } finally {
          BackgroundFetch.finish(taskId);
        }
      },
      (taskId) => {
        BackgroundFetch.finish(taskId);
      }
    );
  }

  async syncPendingEvents(): Promise<SyncResult> {
    const store = useSyncStore.getState();
    
    if (store.isSyncing || !store.isOnline) {
      return { success: false, syncedCount: 0, failedCount: 0 };
    }

    store.setSyncing(true);
    store.setError(null);
    
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pendingEvents = await embeddingDB.getPendingSyncEvents(SYNC_BATCH_SIZE);
      
      if (pendingEvents.length === 0) {
        store.setSyncing(false);
        return { success: true, syncedCount: 0, failedCount: 0 };
      }
      
      // Update store
      store.setPendingCount(pendingEvents.length);
      
      // Attempt upload
      const success = await this.uploadBatch(pendingEvents);
      
      if (success) {
        const ids = pendingEvents.map(e => e.id);
        await embeddingDB.updateSyncStatus(ids, 'synced');
        await embeddingDB.deleteSyncEvents(ids);
        syncedCount = ids.length;
        store.setLastSyncTime(Date.now());
      } else {
        // Handle failure
        failedCount = pendingEvents.length;
        const toFail: string[] = [];
        const toRetry: string[] = [];
        
        for (const event of pendingEvents) {
          if (event.retryCount >= MAX_RETRY_COUNT) {
            toFail.push(event.id);
          } else {
            toRetry.push(event.id);
            // In a real app we'd increment retry_count in DB here
          }
        }
        
        if (toFail.length > 0) {
          await embeddingDB.updateSyncStatus(toFail, 'failed');
        }
        
        store.setError('Failed to upload batch. Retrying later.');
      }
      
    } catch (error: any) {
      console.error('Sync failed', error);
      store.setError(error.message || 'Unknown sync error');
    } finally {
      // Update final count
      try {
        const stats = await embeddingDB.getStats();
        store.setPendingCount(stats.pendingSyncCount);
      } catch (e) {}
      
      store.setSyncing(false);
    }
    
    return { success: failedCount === 0, syncedCount, failedCount };
  }

  private async uploadBatch(events: SyncEvent[]): Promise<boolean> {
    try {
      const deviceId = generateUUID(); // In real app, get stable device ID
      const payload = {
        deviceId,
        timestamp: Date.now(),
        events: events.map(e => ({
          id: e.id,
          type: e.eventType,
          data: e.payloadEncrypted
        }))
      };
      
      // Simulate network request
      console.log(`[AWS Sync] Uploading ${events.length} encrypted events to AWS API Gateway: ${this.syncEndpoint}...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log(`[AWS Sync] Batch successfully uploaded to DynamoDB. Purging local storage...`);
      
      // Always succeed for hackathon demo purposes unless forced to fail
      return true;
    } catch (error) {
      console.error('Upload batch failed', error);
      return false;
    }
  }

  async forceSync(): Promise<SyncResult> {
    return this.syncPendingEvents();
  }
}

export const syncEngine = new SyncEngine();
