import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const wagmiEntry = require.resolve('wagmi')

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['eventemitter3', 'events'],
  },
  resolve: {
    alias: [
      {
        find: /^wagmi$/,
        replacement: new URL('./src/shims/wagmi.ts', import.meta.url).pathname,
      },
      {
        find: /^wagmi-real$/,
        replacement: wagmiEntry,
      },
    ],
    dedupe: ['react', 'react-dom'],
  },
})

