/** @type {import('tailwindcss').Config} */
// Palm Guard "Living Telemetry Interface" design tokens.
// NOTE: custom names only (forest/gold/caution/crit/ink/...) so we never shadow
// Tailwind's built-in scales (green/amber/red/gray) still used by older components.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Display face for headings/titles only — body stays Inter, numbers stay mono.
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        forest:   { DEFAULT: '#003F2E', 600: '#0A5C44', 400: '#19A66A' }, // primary + telemetry green
        gold:     '#C2A14D',   // muted accent
        caution:  '#D89B2B',   // watch / amber
        crit:     '#C94A3A',   // critical
        bone:     '#F6F2E8',   // light background
        panel:    '#FFFDF6',   // light surface
        ink:      { 900: '#08110E', 800: '#0E1713', 700: '#101C17', 600: '#16241E' }, // dark bg + surfaces
        charcoal: '#1B2420',
        muted:    '#8C9B91',
      },
      boxShadow: {
        instrument: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -16px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};
