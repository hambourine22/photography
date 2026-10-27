import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import { resolve } from 'path'
import { existsSync } from 'fs'
import react from '@vitejs/plugin-react'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const pages = {
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
  taurus             : resolve(__dirname, 'src/taurus/index.html'),
  taurusEmbed        : resolve(__dirname, 'src/taurus-embed/index.html'),
  distanceTravelled  : resolve(__dirname, 'src/distance-travelled/index.html'),
  droneOdometer      : resolve(__dirname, 'src/drone-odometer/index.html'),
}

// Pages not yet committed (taurus) would otherwise fail the build in a clean checkout.
const input = Object.fromEntries(Object.entries(pages).filter(([, path]) => existsSync(path)))

export default defineConfig({
  plugins: [react()],
  root: 'src',
  publicDir: '../public',
  base: './',                     // ← add this
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input,
    }
  },
})