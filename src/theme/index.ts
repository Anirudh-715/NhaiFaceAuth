/**
 * NHAI FaceAuth — Design System
 * Indian Government Light Theme — inspired by NIC / gov.in / NHAI websites
 * Saffron · Navy · White palette with compact sizing
 */

import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Color Palette ────────────────────────────────────────────────────────────
export const Colors = {
  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F5F6F8',
  bgTertiary: '#EEF0F4',
  bgCard: '#FFFFFF',

  // Accent — Indian Government palette
  saffron: '#FF6B00',
  saffronDark: '#E25D00',
  saffronLight: '#FFF3E8',
  navy: '#003580',
  navyDark: '#002A66',
  navyLight: '#E8EEF7',

  // Semantic
  success: '#138808',
  successLight: '#E8F5E3',
  successDark: '#0E6B06',
  error: '#D32F2F',
  errorLight: '#FDECEA',
  errorDark: '#B71C1C',
  warning: '#F57C00',
  warningLight: '#FFF3E0',
  warningDark: '#E65100',
  info: '#1565C0',

  // Text
  textPrimary: '#1A1A2E',
  textSecondary: '#4A4A68',
  textTertiary: '#8E8EA0',
  textDisabled: '#BDBDCA',
  textOnDark: '#FFFFFF',

  // Card & Borders
  cardBorder: '#E0E0E8',
  cardBorderLight: '#EBEBF0',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.50)',
  overlayLight: 'rgba(0, 0, 0, 0.25)',
  divider: '#E8E8ED',
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ─── Gradient Presets ─────────────────────────────────────────────────────────
export const Gradients = {
  primary: [Colors.saffron, Colors.saffronDark] as readonly string[],
  primaryReversed: [Colors.saffronDark, Colors.saffron] as readonly string[],
  navy: [Colors.navy, Colors.navyDark] as readonly string[],
  success: [Colors.success, Colors.successDark] as readonly string[],
  error: [Colors.error, Colors.errorDark] as readonly string[],
  screenBg: [Colors.bgPrimary, Colors.bgSecondary, Colors.bgTertiary] as readonly string[],
  headerBg: [Colors.navy, Colors.navyDark] as readonly string[],
} as const;

// ─── Typography (compact sizing) ──────────────────────────────────────────────
const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

const fontFamilyBold = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const Typography = StyleSheet.create({
  h1: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: Colors.textPrimary,
    lineHeight: 38,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: Colors.textPrimary,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  h4: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.1,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.1,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  bodySm: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.1,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
  captionSm: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: Colors.textTertiary,
    lineHeight: 15,
  },
  button: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.textOnDark,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  buttonSm: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: Colors.textOnDark,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: Colors.textTertiary,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  mono: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
    color: Colors.navy,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

// ─── Spacing Scale (4px base, compact) ────────────────────────────────────────
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  '4xl': 36,
  '5xl': 44,
  '6xl': 56,
  '7xl': 72,
  '8xl': 88,
} as const;

// ─── Border Radii ─────────────────────────────────────────────────────────────
export const Radii = {
  xs: 3,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  full: 9999,
} as const;

// ─── Shadow Presets (light theme) ─────────────────────────────────────────────
export const Shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    shadowColor: Colors.saffron,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;

// ─── Common Reusable Styles ───────────────────────────────────────────────────
export const CommonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  screenPadded: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing.xl,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    ...Shadows.card,
  },
  cardLight: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorderLight,
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: Colors.navy,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
});

// ─── Layout Constants ─────────────────────────────────────────────────────────
export const Layout = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  isSmallDevice: SCREEN_WIDTH < 375,
  headerHeight: 50,
  tabBarHeight: 56,
  bottomInset: Platform.OS === 'ios' ? 34 : 0,
} as const;

// ─── Animation Constants ──────────────────────────────────────────────────────
export const AnimConfig = {
  springDefault: { damping: 15, stiffness: 150, mass: 1 },
  springBouncy: { damping: 12, stiffness: 180, mass: 0.8 },
  springGentle: { damping: 20, stiffness: 100, mass: 1 },
  timingFast: { duration: 200 },
  timingMedium: { duration: 350 },
  timingSlow: { duration: 600 },
} as const;

// ─── Unified Theme Object ─────────────────────────────────────────────────────
export const theme = {
  colors: {
    bgPrimary: Colors.bgPrimary,
    bgSecondary: Colors.bgSecondary,
    bgTertiary: Colors.bgTertiary,
    bgCard: Colors.bgCard,
    accentPrimary: Colors.saffron,
    accentSecondary: Colors.navy,
    accentPrimaryLight: Colors.saffronLight,
    accentSecondaryDark: Colors.navyDark,
    success: Colors.success,
    successDark: Colors.successDark,
    error: Colors.error,
    errorDark: Colors.errorDark,
    warning: Colors.warning,
    warningDark: Colors.warningDark,
    info: Colors.info,
    textPrimary: Colors.textPrimary,
    textSecondary: Colors.textSecondary,
    textTertiary: Colors.textTertiary,
    textDisabled: Colors.textDisabled,
    textOnDark: Colors.textOnDark,
    cardBorder: Colors.cardBorder,
    cardBorderLight: Colors.cardBorderLight,
    overlay: Colors.overlay,
    overlayLight: Colors.overlayLight,
    divider: Colors.divider,
    transparent: Colors.transparent,
    white: Colors.white,
    black: Colors.black,
  },
  gradients: Gradients,
  typography: {
    fonts: {
      display: fontFamily ?? 'System',
      displayBold: fontFamilyBold ?? 'System',
    },
    ...Typography,
  },
  spacing: Spacing,
  radii: Radii,
  shadows: Shadows,
  layout: Layout,
  animation: AnimConfig,
} as const;
