/**
 * HomeScreen — Government-styled dashboard
 * Navy header · white cards · saffron accents · real sync status
 */

import React from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, Spacing, Radii, Shadows, Typography, CommonStyles } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { SyncIndicator } from '../components/SyncIndicator';
import type { RootStackParamList } from '../navigation/AppNavigator';

type HomeNav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeNav>();

  return (
    <View style={styles.screen}>
      {/* ─── Navy Header Bar ─────────────────────────────── */}
      <View style={[styles.headerBar, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerContent}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>◉</Text>
          </View>
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>NHAI FaceAuth</Text>
            <Text style={styles.headerSubtitle}>Offline Face Authentication System</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Main Action Cards ───────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(500).springify()}
          style={styles.mainActions}
        >
          <GlassCard
            testID="home-auth-card"
            variant="accent"
            onPress={() => navigation.navigate('Auth')}
            style={styles.mainCard}
          >
            <View style={styles.cardIconRow}>
              <View style={[styles.cardIcon, { backgroundColor: Colors.saffron }]}>
                <Text style={styles.cardIconText}>🔐</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>Authenticate</Text>
            <Text style={styles.cardDescription}>
              Verify identity with face recognition
            </Text>
            <View style={styles.cardArrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </GlassCard>

          <GlassCard
            testID="home-enroll-card"
            variant="default"
            onPress={() => navigation.navigate('Enroll')}
            style={styles.mainCard}
          >
            <View style={styles.cardIconRow}>
              <View style={[styles.cardIcon, { backgroundColor: Colors.navy }]}>
                <Text style={styles.cardIconText}>👤</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>Enroll New Face</Text>
            <Text style={styles.cardDescription}>
              Register a new person for authentication
            </Text>
            <View style={styles.cardArrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ─── Secondary Actions ──────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(500).springify()}
          style={styles.secondaryActions}
        >
          <GlassCard
            testID="home-history-card"
            onPress={() => navigation.navigate('History')}
            style={styles.secondaryCard}
          >
            <Text style={styles.secondaryIcon}>📋</Text>
            <Text style={styles.secondaryTitle}>History</Text>
            <Text style={styles.secondarySubtitle}>View logs</Text>
          </GlassCard>

          <GlassCard
            testID="home-settings-card"
            onPress={() => navigation.navigate('Settings')}
            style={styles.secondaryCard}
          >
            <Text style={styles.secondaryIcon}>⚙️</Text>
            <Text style={styles.secondaryTitle}>Settings</Text>
            <Text style={styles.secondarySubtitle}>Configure</Text>
          </GlassCard>
        </Animated.View>

        {/* ─── Sync Status — reads from Zustand store ──────── */}
        <Animated.View
          entering={FadeInUp.delay(450).duration(400)}
          style={styles.syncContainer}
        >
          <SyncIndicator testID="home-sync-indicator" />
        </Animated.View>

        {/* ─── Footer Branding ────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.delay(550).duration(400)}
          style={styles.footerBranding}
        >
          <View style={styles.footerDivider} />
          <Text style={styles.footerOrg}>National Highways Authority of India</Text>
          <Text style={styles.footerMinistry}>
            Ministry of Road Transport & Highways
          </Text>
          <Text style={styles.footerGov}>Government of India</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  // Navy Header
  headerBar: {
    backgroundColor: Colors.navy,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    ...Shadows.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.saffron,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 24,
    color: Colors.white,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  // Scroll
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    flexGrow: 1,
  },
  // Main Action Cards
  mainActions: {
    width: '100%',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  mainCard: {
    width: '100%',
    padding: Spacing.xl,
  },
  cardIconRow: {
    marginBottom: Spacing.md,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconText: {
    fontSize: 22,
  },
  cardTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
  cardArrow: {
    position: 'absolute',
    right: Spacing.xl,
    top: Spacing.xl,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 18,
    color: Colors.textSecondary,
  },
  // Secondary Cards
  secondaryActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    width: '100%',
    marginBottom: Spacing['2xl'],
  },
  secondaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.xl,
  },
  secondaryIcon: {
    fontSize: 30,
    marginBottom: Spacing.sm,
  },
  secondaryTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  secondarySubtitle: {
    ...Typography.caption,
  },
  // Sync
  syncContainer: {
    marginTop: Spacing.md,
  },
  // Footer branding
  footerBranding: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  footerDivider: {
    width: 40,
    height: 2,
    backgroundColor: Colors.saffron,
    marginBottom: Spacing.md,
    borderRadius: 1,
  },
  footerOrg: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.navy,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  footerMinistry: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },
  footerGov: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textDisabled,
    textAlign: 'center',
    marginTop: 1,
    letterSpacing: 0.3,
  },
});

export default HomeScreen;
