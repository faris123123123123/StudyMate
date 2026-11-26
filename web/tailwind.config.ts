import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', soft: 'var(--soft)', line: 'var(--line)',
        text: 'var(--text)', muted: 'var(--muted)', primary: 'var(--primary)', secondary: 'var(--secondary)',
        gold: 'var(--gold)', grass: 'var(--grass)', danger: 'var(--danger)', plum: 'var(--plum)',
      },
      fontFamily: { pixel: ['"Press Start 2P"', 'monospace'], body: ['"Pixelify Sans"', 'monospace'] },
    },
  },
} satisfies Config;
