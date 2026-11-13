/**
 * HISOBOT AI — S+ Emerald Elite Fintech Design Constitution
 * Single source of truth for brand, surface, semantic colors, typography, spacing, and motion.
 */
export const designTokens = {
  brand: {
    emerald: '#10B981',
    emeraldHover: '#059669',
    teal: '#06B6D4',
    deepNavy: '#081220',
    darkBg: '#061A18',
    darkSurface: '#0D1927',
    elevatedSurface: '#111B27',
    lightBg: '#F4F7F8',
    whiteSurface: '#FFFFFF',
    primaryText: '#0F172A',
    mutedText: '#64748B',
  },
  semantic: {
    income: '#10B981',
    expense: '#EF4444',
    ai: '#06B6D4',
    premium: '#F59E0B',
    info: '#3B82F6',
    warning: '#F59E0B',
    danger: '#EF4444',
    success: '#10B981',
  },
  typography: {
    fontSans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontMono: '"JetBrains Mono", "Inter", monospace',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
  },
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },
  motion: {
    fast: '140ms',
    standard: '220ms',
    deliberate: '320ms',
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
} as const;

export type ThemeMode = 'dark' | 'light';
export type SemanticStatus = 'success' | 'info' | 'premium' | 'danger' | 'ai' | 'neutral';
