/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Neutral (standard slate-based) ───────────────────────────
        neutral: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // ── Ink (blue-tinted neutrals for page bg & surfaces) ────────
        ink: {
          50:  '#F0F5FF',
          100: '#E8EEFF',
          200: '#D1DBFF',
        },
        // ── Brand (wasal primary blue — full scale) ───────────────────
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',   // primary action
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        // ── Teal (wasal gradient end) ─────────────────────────────────
        teal: {
          50:  '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
        },
        // ── Amber (wasal warm section highlight) ──────────────────────
        amber: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        // ── Deep navy (sidebar) ───────────────────────────────────────
        navy: {
          950: '#050D1A',
          900: '#0A1628',
          800: '#0D1F3C',
          700: '#112447',
          600: '#1A3560',
          500: '#1E4778',
        },
      },
      fontFamily: {
        arabic: ['Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        // light page bg — very subtle blue tint
        'page-gradient':   'linear-gradient(150deg, #F0F5FF 0%, #EEF2FF 100%)',
        // dark sidebar gradient
        'sidebar-gradient':'linear-gradient(180deg, #0A1628 0%, #112447 100%)',
        // wasal hero gradient
        'brand-gradient':  'linear-gradient(135deg, #1D4ED8 0%, #0891B2 100%)',
        // amber warm gradient
        'amber-gradient':  'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
      },
      boxShadow: {
        card:       '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-md':  '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.05)',
        'card-lg':  '0 8px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)',
        // keep glass for sidebar
        glass:      '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        'brand-glow':'0 4px 20px rgba(37,99,235,0.25)',
        'btn':      '0 2px 8px rgba(37,99,235,0.30)',
        'btn-amber':'0 2px 8px rgba(245,158,11,0.30)',
      },
    },
  },
  plugins: [],
}
