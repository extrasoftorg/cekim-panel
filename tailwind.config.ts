import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx}',  // src klasörü (tüm dosyalar)
    './pages/**/*.{js,ts,jsx,tsx}',  // sayfa dosyaları
    './components/**/*.{js,ts,jsx,tsx}',  // bileşenler
    './layouts/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',  // app router dosyaları
    './node_modules/@shadcn/ui/**/*.{js,ts,jsx,tsx}',  // şablonlar
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
