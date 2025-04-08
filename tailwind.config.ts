import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',  // sayfa dosyaları
    './components/**/*.{js,ts,jsx,tsx}',  // bileşenler
    './layouts/**/*.{js,ts,jsx,tsx}',
    './node_modules/@shadcn/ui/**/*.{js,ts,jsx,tsx}',  // şablonlar

  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
