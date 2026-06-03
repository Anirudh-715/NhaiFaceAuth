/**
 * SettingsScreen — App configuration
 * Light theme · real sync status from store · saffron toggles
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Radii, Typography, CommonStyles, Shadows } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { SyncIndicator } from '../components/SyncIndicator';
import { useSyncStore } from '../store/syncStore';
import { syncEngine } from '../services/syncEngine';
import { useSettingsStore } from '../store/settingsStore';
import { triggerFeedback } from '../utils/feedbackHelper';

interface SettingRowProps {
  label: string;
  value?: string;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
  testID?: string;
}

const SettingRow: React.FC<SettingRowProps> = ({
  label,
  value,
  toggle,
  onToggle,
  testID,
}) => (
  <View style={styles.settingRow} testID={testID}>
    <Text style={styles.settingLabel}>{label}</Text>
    {toggle !== undefined && onToggle ? (
      <Switch
        value={toggle}
        onValueChange={onToggle}
        trackColor={{ false: Colors.cardBorder, true: Colors.saffron + '60' }}
        thumbColor={toggle ? Colors.saffron : Colors.textDisabled}
        ios_backgroundColor={Colors.cardBorder}
      />
    ) : (
      <Text style={styles.settingValue}>{value || '—'}</Text>
    )}
  </View>
);

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { hapticEnabled, soundEnabled, setHapticEnabled, setSoundEnabled } = useSettingsStore();

  const handleToggleHaptic = useCallback(async (value: boolean) => {
    await setHapticEnabled(value);
    if (value) {
      // Trigger a light preview tap
      triggerFeedback.click();
    }
  }, [setHapticEnabled]);

  const handleToggleSound = useCallback(async (value: boolean) => {
    await setSoundEnabled(value);
    if (value) {
      // Trigger a preview sound/haptic click
      triggerFeedback.click();
    }
  }, [setSoundEnabled]);

  // Real sync state from store
  const { isSyncing, pendingCount, lastSyncTime } = useSyncStore();

  const handleForceSync = useCallback(async () => {
    try {
      await syncEngine.forceSync();
    } catch (err) {
      console.error('[Settings] Force sync failed:', err);
    }
  }, []);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear Local Data',
      'This will remove all locally stored authentication events and face data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            // TODO: implement clear data logic
          },
        },
      ],
    );
  }, []);

  const lastSyncLabel = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : 'Never';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing['4xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Sync Status Section ────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={styles.sectionTitle}>Sync Status</Text>
          <GlassCard style={styles.sectionCard} testID="settings-sync-section">
            <View style={styles.syncHeader}>
              <SyncIndicator testID="settings-sync-indicator" />
            </View>
            <View style={styles.syncStats}>
              <SettingRow label="Events Pending" value={String(pendingCount)} />
              <View style={styles.rowDivider} />
              <SettingRow label="Last Sync" value={lastSyncLabel} />
            </View>
            <View style={styles.syncActions}>
              <GradientButton
                testID="settings-force-sync"
                title="Force Sync"
                onPress={handleForceSync}
                loading={isSyncing}
                size="md"
              />
            </View>
          </GlassCard>
        </Animated.View>

        {/* ─── Preferences Section ────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <GlassCard style={styles.sectionCard} testID="settings-prefs-section">
            <SettingRow
              testID="settings-haptic-toggle"
              label="Haptic Feedback"
              toggle={hapticEnabled}
              onToggle={handleToggleHaptic}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              testID="settings-sound-toggle"
              label="Sound Effects"
              toggle={soundEnabled}
              onToggle={handleToggleSound}
            />
          </GlassCard>
        </Animated.View>

        {/* ─── Data Management Section ────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <GlassCard style={styles.sectionCard} testID="settings-data-section">
            <TouchableOpacity
              testID="settings-clear-data"
              style={styles.dangerRow}
              onPress={handleClearData}
              activeOpacity={0.7}
            >
              <Text style={styles.dangerLabel}>Clear Local Data</Text>
              <Text style={styles.dangerIcon}>🗑️</Text>
            </TouchableOpacity>
          </GlassCard>
        </Animated.View>

        {/* ─── Device Info Section ─────────────────────── */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)}>
          <Text style={styles.sectionTitle}>Device Info</Text>
          <GlassCard style={styles.sectionCard} testID="settings-device-section">
            <SettingRow label="Platform" value={Platform.OS === 'ios' ? 'iOS' : 'Android'} />
            <View style={styles.rowDivider} />
            <SettingRow label="OS Version" value={String(Platform.Version)} />
            <View style={styles.rowDivider} />
            <SettingRow label="Model" value={Platform.OS === 'ios' ? 'iPhone' : 'Android Device'} />
          </GlassCard>
        </Animated.View>

        {/* ─── About Section ──────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(500).duration(500)}>
          <Text style={styles.sectionTitle}>About</Text>
          <GlassCard style={styles.sectionCard} testID="settings-about-section">
            <SettingRow label="App Version" value="1.0.0" />
            <View style={styles.rowDivider} />
            <SettingRow label="Build" value="2026.06.02" />
            <View style={styles.rowDivider} />
            <TouchableOpacity
              testID="settings-licenses"
              style={styles.settingRow}
              activeOpacity={0.7}
            >
              <Text style={styles.settingLabel}>Open-Source Licenses</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </GlassCard>
        </Animated.View>

        {/* ─── Footer ─────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>NHAI FaceAuth</Text>
          <Text style={styles.footerSubtext}>Offline Face Authentication System</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  // Section titles
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: Colors.navy,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  // Section card
  sectionCard: {
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  // Sync
  syncHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  syncStats: {
    marginBottom: Spacing.md,
  },
  syncActions: {
    marginTop: Spacing.xs,
  },
  // Setting rows
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  settingLabel: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  settingValue: {
    ...Typography.bodySm,
    color: Colors.textTertiary,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  // Danger
  dangerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dangerLabel: {
    ...Typography.bodyMedium,
    color: Colors.error,
    fontSize: 13,
  },
  dangerIcon: {
    fontSize: 16,
  },
  // Chevron
  chevron: {
    fontSize: 20,
    color: Colors.textTertiary,
    fontWeight: '300',
  },
  // Footer
  footer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textDisabled,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  footerSubtext: {
    ...Typography.captionSm,
    color: Colors.textDisabled,
    marginTop: Spacing.xxs,
  },
});

export default SettingsScreen;
