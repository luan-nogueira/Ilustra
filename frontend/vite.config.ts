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
      manifest: {
        name: 'CCURE Site Designer',
        short_name: 'SiteDesigner',
        description: 'Ferramenta de design de projetos para C-CURE 9000',
        theme_color: '#ffffff',
        background_color: '#f9fafb',
        display: 'standalone', // Aqui é a mágica: abre numa janela separada, sem navegador!
        icons: [
          {
            src: 'https://via.placeholder.com/192x192.png?text=CCURE', // Placeholder rápido
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://via.placeholder.com/512x512.png?text=CCURE',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
