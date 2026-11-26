import type { ReactNode } from 'react'

const paths = {
  planner: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18M7 15h3m4 0h3M7 18h3" /></>,
  groceries: <><path d="M8 6H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3" /><rect x="8" y="3" width="8" height="5" rx="2" /><path d="m8 15 3 3 5-6" /></>,
  recipes: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 3v18M12 8h5m-5 4h5m-5 4h3" /></>,
  family: <><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-7h6v7" /></>,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--surface)" /><circle cx="15" cy="17" r="3" fill="var(--surface)" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  updates: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8m-8 4h8m-8 4h5" /></>,
  filters: <><path d="M4 7h16M4 17h16" /><circle cx="8" cy="7" r="2" fill="var(--surface)" /><circle cx="16" cy="17" r="2" fill="var(--surface)" /></>,
  beverages: <><path d="M5 8h14l-2 12H7L5 8Zm8 0 2-5h4M6 12h12" /></>,
  dinner: <><path d="M3 16h18m-17 0a8 8 0 0 1 16 0M12 7V5m-2 0h4M2 19h20" /></>,
  lunch: <><path d="M4 14 12 6l8 8M4 14v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3H4Zm0 2h16" /></>,
  breakfast: <><path d="M5 15a3 3 0 0 1-1-5c1-1 3-.8 4-2 1-1.4 1.7-3 4-3a4 4 0 0 1 4.1 3.6c.2 1.6 2 1.7 3.2 2.6 2.5 2 1 6.8-2.7 6.8H8a3 3 0 0 1-3-3Z" /><circle cx="12" cy="12" r="3" /></>,
  bakeOff: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16m-12 4h8v4H8zM8 6.5h.1m3.9 0h.1" /></>,
  bread: <><path d="M6 12a4 4 0 0 1-1.5-3C4.5 6.2 8 4 12 4s7.5 2.2 7.5 5a4 4 0 0 1-1.5 3v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6Z" /></>,
  cake: <><path d="M4 13h16v7H4zM7 13v-3h10v3m-5-3V7m0-4c.8 1 1.4 1.7 0 3-1.4-1.3-.8-2 0-3ZM4 16c2 0 2 1 4 1s2-1 4-1 2 1 4 1 2-1 4-1" /></>,
  dessert: <><path d="M7 12h10l-5 9-5-9Zm0 0a5 5 0 1 1 10 0M9 16h6" /></>,
  snack: <><circle cx="12" cy="12" r="8" /><path d="M9 8h.1m6 1h.1m-3.1 3h.1m-4.1 2h.1m7.9 1h.1m-3.1 2h.1" strokeWidth="2.4" /></>,
  soup: <><path d="M3 13h18a8 8 0 0 1-8 7h-2a8 8 0 0 1-8-7Zm6-3c-2-1 1-2 0-4m4 4c-2-1 1-2 0-4m4 4c-2-1 1-2 0-4" /></>,
  recipeTag: <><path d="M3 5v6l9 9 9-9-8-8H5a2 2 0 0 0-2 2Z" /><circle cx="8" cy="8" r="1.3" /></>,
} satisfies Record<string, ReactNode>

export function AppIcon({ name }: { name: keyof typeof paths }) {
  return <svg className="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>
}
