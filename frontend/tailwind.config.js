/** @type {import('tailwindcss').Config} */
// Palm Guard — unified "Field Instrument" design tokens.
// ONE brand system: forest (#003F2E) + gold (#C2A14D). Tailwind's built-in
// accent ramps (green/emerald/amber/red) are intentionally REMAPPED to the brand
// so legacy components that still use `green-500`, `emerald-400`, `amber-300`,
// `red-700` harmonise to the brand automatically — no per-file rewrite needed.
// Neutral gray is left as Tailwind's cool gray (works in both warm-light and
// forest-dark surfaces).
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Space Grotesk"', '"Inter Variable"', 'ui-sans-serif', 'sans-serif'],
        mono:    ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // ─── Brand ───────────────────────────────────────────────────────
        forest: { DEFAULT: '#003F2E', 900: '#003F2E', 800: '#064734', 700: '#0A5C44', 600: '#0A6E4C', 500: '#11935C', 400: '#19A66A', 300: '#5FB888' },
        gold:   { DEFAULT: '#C2A14D', 300: '#E0C77E', 400: '#D4B265', 500: '#C2A14D', 600: '#A8862F' },
        caution: '#D89B2B',
        crit:   { DEFAULT: '#C94A3A', 300: '#E08A7D', 400: '#D66557', 500: '#C94A3A', 600: '#A83828' },
        bone:   '#F6F2E8',
        panel:  '#FFFDF6',
        ink:    { 950: '#050C0A', 900: '#08110E', 800: '#0E1713', 700: '#101C17', 600: '#16241E', 500: '#1E2B25' },
        charcoal: '#1B2420',
        muted:  '#8C9B91',
        // ─── Tailwind built-ins remapped to brand (legacy-component harmony) ─
        green:   { 50: '#E7F3EC', 100: '#C7E5D2', 200: '#9FD2B3', 300: '#5FB888', 400: '#19A66A', 500: '#11935C', 600: '#0A6E4C', 700: '#075440', 800: '#054334', 900: '#003F2E', 950: '#03211A' },
        emerald: { 50: '#E7F3EC', 100: '#C7E5D2', 200: '#9FD2B3', 300: '#5FB888', 400: '#19A66A', 500: '#11935C', 600: '#0A6E4C', 700: '#075440', 800: '#054334', 900: '#003F2E', 950: '#03211A' },
        amber:   { 50: '#FBF4E2', 100: '#F5E6BE', 200: '#EAD08A', 300: '#DDB85C', 400: '#D4B265', 500: '#C2A14D', 600: '#A8862F', 700: '#866823', 800: '#6B521D', 900: '#574418', 950: '#332810' },
        red:     { 50: '#FBECEA', 100: '#F6D6D0', 200: '#ECAFA6', 300: '#DD8579', 400: '#D66557', 500: '#C94A3A', 600: '#A83828', 700: '#882C20', 800: '#70261C', 900: '#5E231B', 950: '#33100C' },
      },
      borderRadius: {
        xl2: '1.125rem',
      },
      boxShadow: {
        instrument: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -16px rgba(0,0,0,0.45)',
        card:    '0 1px 2px 0 rgba(16,33,28,0.04), 0 12px 32px -22px rgba(16,33,28,0.30)',
        elevated:'0 2px 4px 0 rgba(16,33,28,0.05), 0 24px 56px -28px rgba(16,33,28,0.40)',
        glow:    '0 0 0 1px rgba(25,166,106,0.30), 0 8px 30px -10px rgba(25,166,106,0.35)',
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
    },
  },
  plugins: [],
};
