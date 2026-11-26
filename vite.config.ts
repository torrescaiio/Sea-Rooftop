import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // Rotas do conector do Claude (Netlify Function) não podem cair no app em cache
          navigateFallbackDenylist: [/^\/mcp/, /^\/oauth\//, /^\/\.well-known\//]
        },
        manifest: {
          name: 'Sea Rooftop Command Center',
          short_name: 'Sea Rooftop',
          description: 'Comando e Controle Sea Rooftop',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
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
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Em desenvolvimento, as rotas do conector vão para o servidor local (scripts/mcp-dev.ts)
      proxy: {
        '/mcp': 'http://localhost:8788',
        '/oauth': 'http://localhost:8788',
        '/.well-known/oauth-': 'http://localhost:8788',
      },
    },
  };
});
