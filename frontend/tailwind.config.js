/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // VDAJ Brand Kit
        'vdaj-purple':  '#534AB7',
        'soft-aura':    '#AFA9EC',
        'signal-teal':  '#1D9E75',
        'deep-black':   '#0F0F0F',
        'aura-white':   '#F8F7FF',

        // Semantic aliases
        brand: {
          DEFAULT:  '#534AB7',
          light:    '#AFA9EC',
          dark:     '#3B3499',
          muted:    '#7A73C9',
        },
        teal: {
          DEFAULT:  '#1D9E75',
          light:    '#26C18E',
          dark:     '#148059',
        },
        'teal-light': '#26C18E',
        'brand-muted': '#7A73C9',
        surface: {
          DEFAULT:  '#F8F7FF',
          elevated: '#FFFFFF',
          card:     '#FFFFFF',
          border:   '#E6E4F5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'brand-sm':  '0 1px 8px rgba(83, 74, 183, 0.15)',
        'brand-md':  '0 4px 20px rgba(83, 74, 183, 0.25)',
        'brand-lg':  '0 8px 40px rgba(83, 74, 183, 0.35)',
        'teal-sm':   '0 1px 8px rgba(29, 158, 117, 0.15)',
        'teal-md':   '0 4px 20px rgba(29, 158, 117, 0.25)',
        'glass':     '0 8px 32px rgba(83, 74, 183, 0.08)',
      },
      backgroundImage: {
        'brand-gradient':  'linear-gradient(135deg, #534AB7 0%, #3B3499 100%)',
        'teal-gradient':   'linear-gradient(135deg, #1D9E75 0%, #148059 100%)',
        'hero-gradient':   'linear-gradient(135deg, #F8F7FF 0%, #FAFAFE 50%, #F3F2FD 100%)',
        'card-gradient':   'linear-gradient(145deg, #FFFFFF 0%, #F8F7FF 100%)',
        'aurora':          'radial-gradient(ellipse at top left, rgba(83,74,183,0.08) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(29,158,117,0.05) 0%, transparent 60%)',
      },
      animation: {
        'fade-in':      'fadeIn 0.3s ease-out',
        'slide-up':     'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down':   'slideDown 0.3s ease-out',
        'scale-in':     'scaleIn 0.2s ease-out',
        'pulse-brand':  'pulseBrand 2s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn:     { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:    { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideDown:  { from: { opacity: 0, transform: 'translateY(-16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn:    { from: { opacity: 0, transform: 'scale(0.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
        pulseBrand: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(83, 74, 183, 0.4)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(83, 74, 183, 0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
      transitionTimingFunction: {
        'bounce-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
