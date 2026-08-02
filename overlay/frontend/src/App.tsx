import { useCallback, useEffect, useState } from 'react';
import { api, configureApi, jsonBody } from './lib/api';
import { useRouter } from './lib/router';
import { useDialog } from './components/Dialog';
import { Layout } from './components/Layout';
import { Loading } from './components/UI';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DockerPage } from './pages/DockerPage';
import { FilesPage } from './pages/FilesPage';
import { LogsPage } from './pages/LogsPage';
import { GitHubPage, ToolsPage } from './pages/ToolsPages';
import { SecurityPage, SSHPage } from './pages/SecurityPages';
import { HostPage, NetworkPage, ProcessesPage, ServicesPage, SnapshotsPage, StoragePage, SystemPage, TasksPage, TimersPage, UpdatesPage } from './pages/SystemPages';

type Session = { username: string; csrf: string; id: string };

export default function App() {
  const router = useRouter();
  const dialog = useDialog();
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [booting, setBooting] = useState(true);

  const refreshSession = useCallback(async () => {
    const me = await api<Record<string, any>>('/api/v1/auth/me');
    const next = { username: String(me.username ?? ''), csrf: String(me.csrf_token ?? ''), id: String(me.session_id ?? '') };
    setSession(next);
    const config = await api<Record<string, any>>('/api/v1/settings');
    setSettings(config);
    return next;
  }, []);

  const elevate = useCallback(async () => {
    const password = await dialog.prompt({ title: '二次验证', message: '高风险操作需要再次输入当前管理员密码，有效期 5 分钟。', type: 'password', required: true, confirmText: '验证' });
    if (!password) throw new Error('已取消二次验证');
    await api('/api/v1/auth/elevate', { method: 'POST', body: jsonBody({ password }) });
  }, [dialog]);

  useEffect(() => {
    configureApi({
      getCSRF: () => session?.csrf ?? '',
      onUnauthorized: () => setSession(null),
      elevate,
    });
  }, [session?.csrf, elevate]);

  useEffect(() => {
    let active = true;
    refreshSession().then(() => {
      if (active) router.restore();
    }).catch(() => {
      if (active) setSession(null);
    }).finally(() => {
      if (active) setBooting(false);
    });
    return () => { active = false; };
  }, [refreshSession]);

  async function logout() {
    const confirmed = await dialog.confirm({ title: '退出登录', message: '当前浏览器会话将立即失效。', confirmText: '退出' });
    if (!confirmed) return;
    try { await api('/api/v1/auth/logout', { method: 'POST', body: jsonBody({}) }); } finally { setSession(null); setSettings({}); router.navigate('/', true); }
  }

  if (booting) return <main className="boot-screen"><img src="/assets/lukepanel-icon-192.png" alt="LukePanel"/><Loading label="正在验证面板会话"/></main>;
  if (!session) return <LoginPage onAuthenticated={refreshSession}/>;

  const parent = router.parent;
  const common = { navigate: router.navigate, back: parent ? () => router.navigate(parent) : undefined };
  let page;
  switch (router.path) {
    case '/': page = <DashboardPage navigate={router.navigate}/>; break;
    case '/system': page = <SystemPage {...common}/>; break;
    case '/services': page = <ServicesPage {...common}/>; break;
    case '/processes': page = <ProcessesPage {...common}/>; break;
    case '/network': page = <NetworkPage {...common}/>; break;
    case '/storage': page = <StoragePage {...common}/>; break;
    case '/timers': page = <TimersPage {...common}/>; break;
    case '/tasks': page = <TasksPage {...common}/>; break;
    case '/updates': page = <UpdatesPage {...common}/>; break;
    case '/host': page = <HostPage {...common}/>; break;
    case '/snapshots': page = <SnapshotsPage {...common}/>; break;
    case '/ssh': page = <SSHPage {...common}/>; break;
    case '/docker': page = <DockerPage {...common}/>; break;
    case '/files': page = <FilesPage {...common}/>; break;
    case '/tools': page = <ToolsPage {...common}/>; break;
    case '/github': page = <GitHubPage {...common}/>; break;
    case '/audit': page = <LogsPage {...common}/>; break;
    case '/security': page = <SecurityPage {...common}/>; break;
    default: page = <DashboardPage navigate={router.navigate}/>;
  }

  return <Layout path={router.path} username={session.username} settings={settings} navigate={router.navigate} logout={logout}>{page}</Layout>;
}
