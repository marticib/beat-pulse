import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    // Genera source maps per facilitar el debugging
    sourcemap: false,
  },
  server: {
    // Permet accés des de dispositius a la mateixa xarxa (útil per testing)
    host: true,
  },
});
