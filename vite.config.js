import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main               : resolve(__dirname, 'src/index.html'),
        colour             : resolve(__dirname, 'src/colour/index.html'),
        typography         : resolve(__dirname, 'src/typography/index.html'),
        designTokens       : resolve(__dirname, 'src/design-tokens/index.html'),
        perceptualPatterns : resolve(__dirname, 'src/perceptual-patterns/index.html'),
        paperFold          : resolve(__dirname, 'src/paper-fold/index.html'),
        letterBounce       : resolve(__dirname, 'src/letter-bounce/index.html'),
        iconFactory        : resolve(__dirname, 'src/icon-factory/index.html'),
        structure          : resolve(__dirname, 'src/structure/index.html'),
        patterns           : resolve(__dirname, 'src/patterns/index.html'),
        sphere             : resolve(__dirname, 'src/sphere/index.html'),
        triGrid            : resolve(__dirname, 'src/tri-grid/index.html'),
      }
    }
  },
})
