/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        /** Identidade visual: corporativo moderno (roxo + âmbar + lavanda) */
        mm: {
          purple: '#6C5CE7',
          'purple-deep': '#5548c9',
          'purple-dark': '#4a3db8',
          'purple-ink': '#3d2fa3',
          accent: '#FFB347',
          surface: '#F3F0FF',
          ink: '#1A1A1A',
          muted: '#666666',
        },
        brand: {
          ink: '#1A1A1A',
          deep: '#4a3db8',
          primary: '#6C5CE7',
          accent: '#FFB347',
          glow: '#FFB347',
        },
        status: {
          pending: '#64748b',
          paid: '#6C5CE7',
          completed: '#16a34a',
          dispute: '#dc2626',
        },
      },
      backgroundImage: {
        'brand-mesh':
          'radial-gradient(at 14% 16%, rgba(108, 92, 231, 0.16) 0px, transparent 44%), radial-gradient(at 90% 10%, rgba(255, 179, 71, 0.12) 0px, transparent 36%), radial-gradient(at 48% 94%, rgba(108, 92, 231, 0.08) 0px, transparent 48%)',
        'btn-primary':
          'linear-gradient(135deg, #5B4BC4 0%, #6C5CE7 48%, #7B68EE 100%)',
        'btn-primary-hover':
          'linear-gradient(135deg, #6C5CE7 0%, #7B68EE 45%, #8B7AEE 100%)',
        'btn-ghost-fill': 'linear-gradient(145deg, #ffffff 0%, #faf8ff 100%)',
        /** Barra de progresso / destaques */
        'mm-progress':
          'linear-gradient(90deg, #6C5CE7 0%, #9B7BFF 45%, #FFB347 100%)',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(26,26,26,.05), 0 1px 2px -1px rgba(108,92,231,.06)',
        'brand-glow':
          '0 4px 22px rgba(108, 92, 231, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.14) inset',
        'brand-glow-lg':
          '0 10px 36px rgba(108, 92, 231, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.16) inset',
        'float-nav': '0 12px 40px -12px rgba(108, 92, 231, 0.18), 0 4px 16px rgba(26, 26, 26, 0.06)',
        'cta-accent': '0 4px 18px rgba(255, 179, 71, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.35) inset',
      },
      borderRadius: {
        mm: '1rem',
        'mm-card': '1.25rem',
        'mm-xl': '1.75rem',
        'mm-pill': '9999px',
      },
    },
  },
  plugins: [],
};
