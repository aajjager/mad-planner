import type { ReactNode } from 'react'

const paths: Record<string, ReactNode> = {
  planner: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18M7 15h3m4 0h3M7 18h3" /></>,
  groceries: <><path d="M8 6H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3" /><rect x="8" y="3" width="8" height="5" rx="2" /><path d="m8 15 3 3 5-6" /></>,
  recipes: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 3v18M12 8h5m-5 4h5m-5 4h3" /></>,
  family: <><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-7h6v7" /></>,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--surface)" /><circle cx="15" cy="17" r="3" fill="var(--surface)" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  updates: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8m-8 4h8m-8 4h5" /></>,
  filters: <><path d="M4 7h16M4 17h16" /><circle cx="8" cy="7" r="2" fill="var(--surface)" /><circle cx="16" cy="17" r="2" fill="var(--surface)" /></>,
}

export function AppIcon({ name }: { name: keyof typeof paths }) {
  return <svg className="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>
}
