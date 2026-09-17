import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/renderer/src/**/*.{ts,tsx}',
  ],
  // 与 ThemeProvider 一致：dark: 前缀类跟随 html[data-theme="dark"]，
  // 而非默认的 prefers-color-scheme。此前未配置，dark: 只随系统深色，
  // 导致「界面主题设为深色但系统是浅色」时 dark: 分支不生效、字仍黑底。
  darkMode: ['class', '[data-theme="dark"]'],
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
