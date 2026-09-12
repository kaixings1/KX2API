import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/renderer/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--border-color, transparent)',
      },
    },
  },
  plugins: [],
}

export default config
