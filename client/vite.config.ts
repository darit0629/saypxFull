import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'SAYPX',
        short_name: 'SAYPX',
        description: 'Invoicing, CRM and expense tracking for SAYPX Photography',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0B0D12',
        theme_color: '#0B0D12',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // API/auth calls must always hit the network — never serve a cached invoice or session state.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 4210,
    proxy: {
      '/api': {
        target: 'http://localhost:4200',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4200',
        changeOrigin: true,
      },
    },
  },
})
