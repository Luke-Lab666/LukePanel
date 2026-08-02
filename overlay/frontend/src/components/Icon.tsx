import type { ReactNode, SVGProps } from 'react';

type IconName = 'home' | 'server' | 'docker' | 'folder' | 'tools' | 'github' | 'package' | 'logs' | 'shield' | 'logout' | 'sun' | 'moon' | 'refresh' | 'back' | 'chevron' | 'activity' | 'drive' | 'network' | 'clock' | 'search' | 'plus' | 'upload' | 'download' | 'edit' | 'trash' | 'copy' | 'terminal' | 'key' | 'user' | 'play' | 'stop' | 'more' | 'check' | 'warning' | 'settings' | 'star';

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>,
  server: <><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01M6 18h.01"/></>,
  docker: <><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></>,
  folder: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>,
  tools: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>,
  github: <><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.28-.36 6.72-1.61 6.72-7A5.4 5.4 0 0 0 19.3 3.8 5 5 0 0 0 19.16 0S18.03-.36 15 1.48a13.4 13.4 0 0 0-7 0C4.97-.36 3.84 0 3.84 0a5 5 0 0 0-.14 3.8A5.4 5.4 0 0 0 2.28 7.5c0 5.38 3.44 6.63 6.72 7A4.8 4.8 0 0 0 7.5 18v4"/><path d="M7.5 19c-3 .9-3-1.5-4.2-2"/></>,
  package: <><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></>,
  logs: <><path d="M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h9a2 2 0 0 0 2-2v-1H9v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2h3"/></>,
  shield: <><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9 12 2 2 4-4"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.42"/></>,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>,
  refresh: <><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></>,
  back: <path d="m15 18-6-6 6-6"/>, chevron: <path d="m9 18 6-6-6-6"/>,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>,
  drive: <><path d="M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/><path d="M6 16h.01M10 16h.01"/></>,
  network: <><rect width="6" height="6" x="9" y="2" rx="1"/><rect width="6" height="6" x="16" y="16" rx="1"/><rect width="6" height="6" x="2" y="16" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M20 16v4H4v-4"/></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5"/><path d="M20 20H4"/></>, edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>, copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  terminal: <><path d="m4 17 6-6-6-6M12 19h8"/></>, key: <><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15 5l3 3M18 2l3 3"/></>, user: <><path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/></>,
  play: <path d="m5 3 14 9-14 9z"/>, stop: <rect x="5" y="5" width="14" height="14" rx="1"/>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  check: <path d="m5 12 4 4L19 6"/>, warning: <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>,
  star: <path d="m12 2.7 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.77l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93Z"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1a1.7 1.7 0 0 0-1.4-1.67 1.7 1.7 0 0 0-1.2.47l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.77 8.2a1.7 1.7 0 0 0-.47-1.2l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.8 4.77a1.7 1.7 0 0 0 1.2-.47l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.35.3.56.74.6 1.2V11h-4v-.1"/></>,
};

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export type { IconName };
