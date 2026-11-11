import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the React app runs on :5173 and forwards /api calls to the
// Express server, so the browser sees one origin and no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    // Lets the dev server serve ../shared, which the API imports too.
    fs: { allow: ['..'] },
    proxy: {
      '/api': process.env.VITE_API_PROXY || 'http://localhost:3001',

      '/lt': {target: 'http://localhost:5000', rewrite: (path) => path.replace(/^\/lt/, ''),
    },
    },
  },
})

