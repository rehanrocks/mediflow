/* tailwind.config.js - Defines MediFlow design tokens and motion primitives. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4338CA',
          dark: '#352E9E',
          light: '#EEF2FF',
          muted: '#818CF8',
        },
        brandDark: '#352E9E',
        ink: '#14181F',
        slate: '#5B6472',
        mist: '#F6F8F9',
        hairline: '#E4E8EB',
        canvas: '#FFFFFF',
        glass: {
          white: 'rgba(255,255,255,0.72)',
          brand: 'rgba(67,56,202,0.08)',
          dark: 'rgba(20,24,31,0.48)',
        },
        status: {
          scheduled: {
            text: '#1D4ED8',
            bg: '#E7EEFF',
          },
          inProgress: {
            text: '#B45309',
            bg: '#FEF3C7',
          },
          completed: {
            text: '#0F9D66',
            bg: '#E3F7EC',
          },
          cancelled: {
            text: '#C8102E',
            bg: '#FCE4E8',
          },
        },
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        sans: ['Outfit', 'sans-serif'],
        mono: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        card: '8px',
        control: '8px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,24,31,.04), 0 10px 24px rgba(20,24,31,.05)',
      },
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fadeIn 0.3s ease both',
        'slide-right': 'slideRight 0.35s cubic-bezier(0.16,1,0.3,1) both',
        'slide-left': 'slideLeft 0.35s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-brand': 'pulseBrand 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'count-up': 'countUp 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'drawer-in': 'drawerIn 0.38s cubic-bezier(0.16,1,0.3,1) both',
        'drawer-out': 'drawerOut 0.28s cubic-bezier(0.4,0,1,1) both',
        float: 'float 3s ease-in-out infinite alternate',
        'route-in': 'routeIn 0.25s cubic-bezier(0.16,1,0.3,1) 0.15s both',
        'route-out': 'routeOut 0.15s ease both',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideRight: {
          '0%': { opacity: 0, transform: 'translateX(-16px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        slideLeft: {
          '0%': { opacity: 0, transform: 'translateX(16px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseBrand: {
          '0%,100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        countUp: {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        drawerIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        drawerOut: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%': { transform: 'translateY(-6px)' },
          '100%': { transform: 'translateY(6px)' },
        },
        routeIn: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        routeOut: {
          '0%': { opacity: 1, transform: 'translateY(0)' },
          '100%': { opacity: 0, transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
}
