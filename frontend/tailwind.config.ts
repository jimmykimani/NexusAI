import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Semantic colors are backed by CSS variables so the same class names
      // resolve to different tones in light vs. dark mode. See index.css.
      colors: {
        nexus: {
          bg: 'rgb(var(--nexus-bg) / <alpha-value>)',
          surface: 'rgb(var(--nexus-surface) / <alpha-value>)',
          card: 'rgb(var(--nexus-card) / <alpha-value>)',
          elevated: 'rgb(var(--nexus-elevated) / <alpha-value>)',
          border: 'rgb(var(--nexus-border) / <alpha-value>)',
          muted: 'rgb(var(--nexus-muted) / <alpha-value>)',
          subtle: 'rgb(var(--nexus-subtle) / <alpha-value>)',
          text: 'rgb(var(--nexus-text) / <alpha-value>)',
          accent: 'rgb(var(--nexus-accent) / <alpha-value>)',
          hot: 'rgb(var(--nexus-hot) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        display: [
          'Fraunces',
          'Georgia',
          'Times New Roman',
          'serif',
        ],
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        searchGlow: {
          '0%, 100%': {
            boxShadow:
              '0 0 0 1px rgb(var(--nexus-accent) / 0.35), 0 0 20px rgb(var(--nexus-accent) / 0.18)',
          },
          '50%': {
            boxShadow:
              '0 0 0 1px rgb(var(--nexus-accent) / 0.55), 0 0 28px rgb(var(--nexus-accent) / 0.35)',
          },
        },
        skeletonSweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 1.4s infinite ease-in-out',
        shimmer: 'shimmer 1.6s linear infinite',
        'search-glow': 'searchGlow 1.8s ease-in-out infinite',
        'skeleton-sweep': 'skeletonSweep 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
