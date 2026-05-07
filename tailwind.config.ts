import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Status filter pill — selected state
    'bg-slate-700', 'border-slate-700',
    'bg-teal-600',  'border-teal-600',
    'bg-amber-500', 'border-amber-500',
    'bg-blue-600',  'border-blue-600',
    'bg-red-500',   'border-red-500',
    'bg-orange-500','border-orange-500',
    'bg-purple-600','border-purple-600',
    // Status filter pill — unselected state
    'bg-slate-100', 'text-slate-600', 'border-slate-300',
    'bg-teal-100',  'text-teal-700',  'border-teal-300',
    'bg-amber-100', 'text-amber-800', 'border-amber-300',
    'bg-blue-100',  'text-blue-800',  'border-blue-300',
    'bg-red-100',   'text-red-800',   'border-red-300',
    'bg-orange-100','text-orange-800','border-orange-300',
    'bg-purple-100','text-purple-800','border-purple-300',
    // Status list background tint
    'bg-teal-50', 'bg-amber-50', 'bg-blue-50',
    'bg-red-50',  'bg-orange-50','bg-purple-50',
  ],
  theme: {
    extend: {
      colors: {
        sidebar: '#1a1f2e',
      },
    },
  },
  plugins: [],
}
export default config
