import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Button } from './UI';

export type NavItem = { label: string; path: string; icon: IconName };

const primary: NavItem[] = [
  { label: '概览', path: '/', icon: 'home' },
  { label: '系统', path: '/system', icon: 'server' },
  { label: 'Docker', path: '/docker', icon: 'docker' },
  { label: '文件', path: '/files', icon: 'folder' },
  { label: '工具', path: '/tools', icon: 'tools' },
];
const secondary: NavItem[] = [
  { label: '软件管理', path: '/updates', icon: 'package' },
  { label: '日志审计', path: '/audit', icon: 'logs' },
  { label: '安全中心', path: '/security', icon: 'shield' },
];

function themeFromStorage() {
  return localStorage.getItem('lukepanel:theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function Layout({ path, username, settings, navigate, logout, children }: { path: string; username: string; settings: Record<string, any>; navigate: (path: string) => void; logout: () => void; children: ReactNode }) {
  const [theme, setTheme] = useState(themeFromStorage);
  const githubVisible = settings.github_helper_enabled ?? settings.github_enabled ?? settings.github?.enabled ?? true;
  const nav = useMemo(() => [...primary, ...(githubVisible ? [{ label: 'GitHub 助手', path: '/github', icon: 'github' as const }] : []), ...secondary], [githubVisible]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('lukepanel:theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111316' : '#f4f6f8');
  }, [theme]);

  const active = (item: NavItem) => item.path === '/' ? path === '/' : path === item.path || (item.path === '/system' && ['/services', '/processes', '/network', '/storage', '/timers', '/tasks', '/host', '/snapshots', '/ssh'].includes(path));

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate('/')}><img src="/assets/lukepanel-icon-192.png" alt="LukePanel"/><span><strong>LukePanel</strong><small>Server Console</small></span></button>
      <nav className="sidebar__nav">{nav.map(item => <button key={item.path} className={active(item) ? 'active' : ''} onClick={() => navigate(item.path)}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav>
      <footer className="sidebar__footer"><div className="account"><span className="account__avatar"><Icon name="user" size={18}/></span><span><strong>{username}</strong><small>管理员</small></span></div><div className="sidebar__footer-actions"><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="切换主题"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18}/></button><button className="icon-button" onClick={logout} aria-label="退出登录"><Icon name="logout" size={18}/></button></div></footer>
    </aside>
    <div className="app-main"><main>{children}</main></div>
    <nav className="mobile-nav">{primary.map(item => <button key={item.path} className={active(item) ? 'active' : ''} onClick={() => navigate(item.path)}><Icon name={item.icon} size={21}/><span>{item.label}</span></button>)}</nav>
    <div className="mobile-topbar"><button className="mobile-brand" onClick={() => navigate('/')}><img src="/assets/lukepanel-icon-192.png" alt=""/><strong>LukePanel</strong></button><div><Button compact tone="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18}/></Button><Button compact tone="ghost" onClick={logout}><Icon name="logout" size={18}/></Button></div></div>
  </div>;
}
