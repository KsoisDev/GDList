import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: mode === 'github' ? '/GDList/' : '/',
  plugins: [react()],
  build: {
    // Firebase is a cohesive dependency graph. Keeping it in one cached vendor
    // chunk avoids circular chunk warnings; its gzip size remains about 120 kB.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@firebase/') || id.includes('/node_modules/firebase/')) return 'firebase'
          if (id.includes('/node_modules/framer-motion/')) return 'motion'
          if (
            id.includes('/node_modules/react/')
            || id.includes('/node_modules/react-dom/')
            || id.includes('/node_modules/react-router')
            || id.includes('/node_modules/@remix-run/')
          ) return 'react-vendor'
          return undefined
        },
      },
    },
  },
  preview: {
    allowedHosts: ['.ngrok-free.app'],
  },
}))
