/**
 * Shared design tokens — consumed by both apps/app (NativeWind/Tailwind)
 * and apps/web (Tailwind CSS).
 *
 * Single source of truth for brand colours, spacing, and typography scale.
 * Import into tailwind.config.js on each app:
 *   const { colors, spacing } = require('@care-suite/shared/theme');
 */

export const colors = {
  primary: {
    50:  '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a8a',
  },
  danger:  '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  gray: {
    50:  '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
} as const;

/** Minimum touch target (Apple HIG / Android Material). */
export const TAP_TARGET = 44;

export const fontSizes = {
  xs:   12,
  sm:   14,
  base: 16,
  lg:   18,
  xl:   20,
  '2xl': 24,
  '3xl': 30,
} as const;
