import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#005B96',
        secondary: '#EAB61B',
        'accent-blue': '#148DD9',
        'light-accent': '#16B4F2',
        'accent-orange': '#F28B0C',
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        '3d-primary': '0 10px 30px -15px rgba(0, 91, 150, 0.3)',
        'inner-xl': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
      keyframes: {
        shine: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        }
      },
      animation: {
        shine: 'shine 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
