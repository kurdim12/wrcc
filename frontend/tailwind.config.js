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
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        forest:   { DEFAULT: '#0E3322', 600: '#2BAE5E', 400: '#43C76E' }, // primary + fresh telemetry green
        gold:     '#CBA45B',   // brand accent
        caution:  '#F0B040',   // watch / amber
        crit:     '#EE5A48',   // critical
        bone:     '#F6F2E8',   // light background
        panel:    '#FFFDF6',   // light surface
        ink:      { 900: '#0E1312', 800: '#141A17', 700: '#161C1A', 600: '#1C231F' }, // neutral charcoal bg + surfaces
        charcoal: '#1B2420',
        muted:    '#98A69D',
      },
      boxShadow: {
        instrument: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -16px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};
