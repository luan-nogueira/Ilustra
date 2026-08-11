import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true // Habilita o PWA mesmo rodando em localhost durante o demo
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // bundle inclui three.js/pdfjs, acima do limite padrão de 2MiB
      },
      manifest: {
        name: 'TYCON Site Designer',
        short_name: 'TYCON',
        description: 'Ferramenta de design de projetos de CFTV e controle de acesso (compatível C-CURE 9000)',
        theme_color: '#0F62FE',
        background_color: '#f9fafb',
        display: 'standalone', // Aqui é a mágica: abre numa janela separada, sem navegador!
        icons: [
          {
            src: '/icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
