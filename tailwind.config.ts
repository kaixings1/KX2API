import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/renderer/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
      },
    },
  },
  plugins: [],
}

export default config
