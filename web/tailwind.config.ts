import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A73E8',
          50:  '#EBF3FD',
          100: '#D6E7FB',
          200: '#ADD0F7',
          300: '#85B8F4',
          400: '#5CA1F0',
          500: '#1A73E8',
          600: '#1558B8',
          700: '#104090',
          800: '#0A2A60',
          900: '#051530',
        },
        danger:  '#D32F2F',
        warning: '#F57C00',
        success: '#2E7D32',
        surface: '#F8FAFE',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        pulse_border: {
          '0%, 100%': { borderColor: '#D32F2F', opacity: '1' },
          '50%':       { borderColor: '#FF8A80', opacity: '0.6' },
        },
      },
      animation: {
        'pulse-border': 'pulse_border 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
