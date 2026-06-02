/**
 * HistoryScreen — Auth event log
 * Light theme · navy filter chips · white cards · pull-to-refresh
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  Layout,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Radii, Typography, CommonStyles, Shadows } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { embeddingDB } from '../services/embeddingDB';

type FilterType = 'all' | 'success' | 'failed';

interface AuthEvent {
  id: string;
  timestamp: string;
  userName: string;
  success: boolean;
  confidence: number;
  duration: number;
}

const formatTimestamp = (iso: string): { date: string; time: string } => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
};

const EventItem: React.FC<{ item: AuthEvent; index: number }> = ({ item, index }) => {
  const { date, time } = formatTimestamp(item.timestamp);
  const statusColor = item.success ? Colors.success : Colors.error;

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 60).duration(400)}
      layout={Layout.springify()}
    >
      <GlassCard style={styles.eventCard} testID={`history-event-${item.id}`}>
        <View style={[styles.statusBar, { backgroundColor: statusColor }]} />

        <View style={styles.eventContent}>
          <View style={styles.eventTop}>
            <View style={styles.eventLeft}>
              <View style={[styles.avatar, { borderColor: statusColor }]}>
                <Text style={styles.avatarText}>
                  {item.userName === 'Unknown' ? '?' : item.userName.charAt(0)}
                </Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventName}>{item.userName}</Text>
                <Text style={styles.eventTime}>{date} · {time}</Text>
              </View>
            </View>
            <View
              style={[
                styles.resultBadge,
                { backgroundColor: statusColor + '15', borderColor: statusColor + '40' },
              ]}
            >
              <Text style={[styles.resultText, { color: statusColor }]}>
                {item.success ? 'PASS' : 'FAIL'}
              </Text>
            </View>
          </View>

          <View style={styles.eventStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Confidence</Text>
              <Text style={[styles.statValue, { color: statusColor }]}>
                {(item.confidence * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{item.duration.toFixed(1)}s</Text>
            </View>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
};

const filterChips: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'success', label: 'Success' },
  { key: 'failed', label: 'Failed' },
];

export const HistoryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<AuthEvent[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const dbEvents = await embeddingDB.getAuthHistory(50);
      const enrolled = await embeddingDB.getEnrolledUsers();
      
      const map: Record<string, string> = {};
      enrolled.forEach(u => { map[u.id] = u.name; });

      const mapped: AuthEvent[] = dbEvents.map(e => ({
        id: e.id || Math.random().toString(),
        timestamp: new Date(e.timestamp).toISOString(),
        userName: e.userId ? (map[e.userId] || 'Unknown User') : 'Unknown Face',
        success: e.result === 'success',
        confidence: e.confidence,
        duration: e.durationMs / 1000,
      }));

      setEvents(mapped);
    } catch (err) {
      console.error('[History] Failed to load history:', err);
    }
  }, []);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredEvents = useMemo(() => {
    switch (filter) {
      case 'success': return events.filter((e) => e.success);
      case 'failed': return events.filter((e) => !e.success);
      default: return events;
    }
  }, [filter, events]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadHistory().finally(() => setRefreshing(false));
  }, [loadHistory]);

  const renderItem = useCallback(
    ({ item, index }: { item: AuthEvent; index: number }) => (
      <EventItem item={item} index={index} />
    ),
    [],
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>No Events Found</Text>
        <Text style={styles.emptySubtitle}>
          {filter === 'all'
            ? 'Authentication events will appear here.'
            : `No ${filter} events to display.`}
        </Text>
      </View>
    ),
    [filter],
  );

  return (
    <View style={styles.screen}>
      {/* ─── Filter Chips ─────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={styles.filterRow}
      >
        {filterChips.map((chip) => (
          <TouchableOpacity
            key={chip.key}
            testID={`history-filter-${chip.key}`}
            style={[
              styles.chip,
              filter === chip.key && styles.chipActive,
            ]}
            onPress={() => setFilter(chip.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                filter === chip.key && styles.chipTextActive,
              ]}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* ─── Events List ──────────────────────────────── */}
      <FlatList
        data={filteredEvents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
          filteredEvents.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.saffron}
            colors={[Colors.saffron]}
            progressBackgroundColor={Colors.bgPrimary}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  // Filter
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipActive: {
    backgroundColor: Colors.navyLight,
    borderColor: Colors.navy,
  },
  chipText: {
    ...Typography.buttonSm,
    color: Colors.textTertiary,
    textTransform: 'none',
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: Colors.navy,
  },
  // List
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  emptyListContent: {
    flex: 1,
  },
  separator: {
    height: Spacing.sm,
  },
  // Event Card
  eventCard: {
    padding: 0,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  statusBar: {
    width: 4,
    borderTopLeftRadius: Radii.lg,
    borderBottomLeftRadius: Radii.lg,
  },
  eventContent: {
    flex: 1,
    padding: Spacing.md,
  },
  eventTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  eventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.bgTertiary,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  eventTime: {
    ...Typography.caption,
    marginTop: Spacing.xxs,
  },
  resultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radii.xs,
    borderWidth: 1,
  },
  resultText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  // Stats
  eventStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.divider,
  },
  statLabel: {
    ...Typography.captionSm,
    marginBottom: Spacing.xxs,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['4xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
    opacity: 0.6,
  },
  emptyTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    ...Typography.bodySm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});

export default HistoryScreen;
