/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Stadium dark background
        pitch:   '#0a1628',
        'pitch-light': '#111f3a',
        'pitch-card': '#162035',
        // Gold / FIFA accent
        gold:    '#f5a623',
        'gold-light': '#ffd97d',
        'gold-dim': 'rgba(245,166,35,0.15)',
        // Grass green
        grass:   '#22c55e',
        'grass-dim': 'rgba(34,197,94,0.15)',
        // Live red
        live:    '#ef4444',
        // Soft text
        chalk:   '#e2e8f0',
        fog:     '#94a3b8',
        // Legacy aliases kept for components that use them
        accent:  '#f5a623',
        'accent-light': 'rgba(245,166,35,0.15)',
        subtle:  '#162035',
        border:  'rgba(255,255,255,0.08)',
        muted:   '#94a3b8',
        ink:     '#e2e8f0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.5)',
        gold: '0 0 20px rgba(245,166,35,0.3)',
        glow: '0 0 40px rgba(34,197,94,0.2)',
      },
      backgroundImage: {
        'stadium': 'linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)',
        'hero-gradient': 'linear-gradient(135deg, #0f2847 0%, #1a3a5c 50%, #0d2e1a 100%)',
        'gold-gradient': 'linear-gradient(135deg, #f5a623 0%, #ffd97d 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(22,32,53,0.9) 0%, rgba(10,22,40,0.95) 100%)',
        'match-hero': 'linear-gradient(135deg, #0f2847 0%, #0a2d1a 100%)',
        'team-home': 'linear-gradient(135deg, #162035 0%, #0f2847 100%)',
        'team-away': 'linear-gradient(135deg, #1a1a35 0%, #2d0f47 100%)',
      },
    },
  },
  plugins: [],
}
