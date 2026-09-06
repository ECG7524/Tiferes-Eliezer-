import type { Config } from 'tailwindcss';

/**
 * Palette lifted from the shul's crest: burnished gold lions on ivory marble,
 * with the deep walnut of the shield behind them.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FDF9EE',
          100: '#F8EFD3',
          200: '#EFDCA4',
          300: '#E3C766',
          400: '#D4AF37',
          500: '#C9A227',
          600: '#AC881D',
          700: '#8A6B18',
          800: '#6B5214',
          900: '#4E3C10',
        },
        ivory: {
          50: '#FEFCF7',
          100: '#FAF6EC',
          200: '#F2EADA',
          300: '#E7DBC3',
          400: '#D8C8A8',
        },
        walnut: {
          400: '#8A6B3D',
          500: '#6B4E23',
          600: '#543D1B',
          700: '#4A3418',
          800: '#33240F',
          900: '#20160A',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'Cambria', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        hebrew: ['var(--font-hebrew)', 'David Libre', 'Narkisim', 'serif'],
      },
      boxShadow: {
        crest: '0 1px 2px rgba(74,52,24,.06), 0 8px 24px -12px rgba(74,52,24,.25)',
        lift: '0 2px 4px rgba(74,52,24,.05), 0 18px 40px -20px rgba(74,52,24,.35)',
      },
      backgroundImage: {
        'gold-rule': 'linear-gradient(90deg, transparent, #C9A227 18%, #E3C766 50%, #C9A227 82%, transparent)',
      },
    },
  },
  plugins: [],
} satisfies Config;
