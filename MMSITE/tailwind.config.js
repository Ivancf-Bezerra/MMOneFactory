/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#0f172a',
          deep: '#1e1b4b',
          primary: '#2563eb',
          accent: '#0891b2',
          glow: '#22d3ee',
        },
        status: {
          pending: '#64748b',
          paid: '#2563eb',
          completed: '#16a34a',
          dispute: '#dc2626',
        },
      },
      backgroundImage: {
        'brand-mesh':
          'radial-gradient(at 12% 18%, rgba(37, 99, 235, 0.14) 0px, transparent 42%), radial-gradient(at 88% 12%, rgba(14, 116, 144, 0.12) 0px, transparent 38%), radial-gradient(at 50% 92%, rgba(99, 102, 241, 0.08) 0px, transparent 45%)',
        'btn-primary':
          'linear-gradient(135deg, #1e3a8a 0%, #2563eb 42%, #0e7490 100%)',
        'btn-primary-hover':
          'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 40%, #06b6d4 100%)',
        'btn-ghost-fill': 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(15,23,42,.06), 0 1px 2px -1px rgba(15,23,42,.04)',
        'brand-glow': '0 4px 20px rgba(37, 99, 235, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.14) inset',
        'brand-glow-lg': '0 8px 28px rgba(37, 99, 235, 0.38), 0 0 0 1px rgba(255, 255, 255, 0.16) inset',
      },
    },
  },
  plugins: [],
};
