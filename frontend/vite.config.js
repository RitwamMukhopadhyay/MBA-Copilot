import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load LAN setting from settings.json
let devHost = 'localhost'
try {
  const settingsPath = path.resolve(__dirname, '../backend/settings.json')
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    if (settings.lanEnabled) {
      devHost = '0.0.0.0'
    }
  }
} catch (e) {
  console.error('[Vite Config] Error reading LAN settings:', e)
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: devHost,
    port: 5173,
  }
})
// touched at 1782658747
