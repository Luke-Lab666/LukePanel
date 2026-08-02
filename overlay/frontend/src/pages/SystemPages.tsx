import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api, errorText, jsonBody, secureApi } from '../lib/api';
import { asArray, asRecord, formatBytes, formatDate, formatPercent } from '../lib/format';
import { useApiData } from '../lib/useApiData';
import { useDialog } from '../components/Dialog';
import { useToast } from '../components/Toast';
import { Icon, type IconName } from '../components/Icon';
import { Button, Card, CodeBlock, EmptyState, ErrorState, InfoList, Loading, PageHeader, ResourceRow, SearchBox, Status, Tabs } from '../components/UI';

export type PageNavProps = { navigate: (path: string) => void; back?: () => void };

type Entry = { title: string; description: string; path: string; icon: IconName };
const systemEntries: Entry[] = [
  { title: '服务管理', description: '查看 systemd 状态、日志并执行生命周期操作', path: '/services', icon: 'server' },
  { title: '进程管理', description: '查看资源占用并发送 TERM 或 KILL 信号', path: '/processes', icon: 'activity' },
  { title: '网络信息', description: '接口、地址、流量和监听端口', path: '/network', icon: 'network' },
  { title: '存储空间', description: '文件系统、挂载点和空间使用率', path: '/storage', icon: 'drive' },
  { title: '系统定时器', description: '只读查看全部 systemd timer 和下次执行时间', path: '/timers', icon: 'clock' },
  { title: '计划任务', description: '管理 LukePanel 创建的安全 systemd timer', path: '/tasks', icon: 'clock' },
  { title: '软件管理', description: 'APT 预检、搜索、升级和软件源管理', path: '/updates', icon: 'package' },
  { title: '主机设置', description: '主机名、时区、DNS、Swap、NTP 与内核预设', path: '/host', icon: 'settings' },
  { title: '配置快照', description: '恢复或删除面板创建的配置回滚点', path: '/snapshots', icon: 'copy' },
  { title: 'SSH 管理', description: '账户、公钥、端口和登录策略', path: '/ssh', icon: 'key' },
];

export function SystemPage({ navigate }: PageNavProps) {
  return <div className="page"><PageHeader title="系统管理" description="只展示后端真实支持的主机管理能力"/><div className="module-grid">{systemEntries.map(item => <button className="module-card" key={item.path} onClick={() => navigate(item.path)}><span><Icon name={item.icon}/></span><div><strong>{item.title}</strong><p>{item.description}</p></div><Icon name="chevron" size={17}/></button>)}</div></div>;
}

function PageState({ data, loading, error, reload, children }: { data: unknown; loading: boolean; error: string; reload: () => void; children: ReactNode }) {
  if (loading && !data) return <Loading/>;
  if (error && !data) return <ErrorState message={error} retry={reload}/>;
  return <>{error ? <ErrorState message={error} retry={reload}/> : null}{children}</>;
}

export function ServicesPage({ back }: PageNavProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'running' | 'failed' | 'all'>('running');
  const data = useApiData<Record<string, unknown>>(`/api/v1/system/services?query=${encodeURIComponent(query)}`, { deps: [query] });
  const dialog = useDialog(); const toast = useToast();
  const services = asArray<Record<string, any>>(data.data?.services);
  const visible = services.filter(service => filter === 'all' || (filter === 'running' ? service.active === 'active' : service.active === 'failed' || service.sub === 'failed'));
  async function action(service: Record<string, any>, next: string) {
    if (next !== 'start' && !await dialog.confirm({ title: `${next === 'stop' ? '停止' : '重启'}服务`, message: String(service.name), confirmText: next === 'stop' ? '停止' : '重启', danger: next === 'stop' })) return;
    try { await secureApi('/api/v1/system/services/action', { method: 'POST', body: jsonBody({ name: service.name, action: next }) }); toast('服务状态已更新'); await data.reload(); } catch (error) { await dialog.alert(errorText(error), '操作失败'); }
  }
  async function logs(name: string) {
    try { const result = await api<Record<string, any>>(`/api/v1/system/services/logs?name=${encodeURIComponent(name)}&lines=400`); await dialog.alert(String(result.logs ?? result.output ?? '暂无日志'), `${name} 日志`); } catch (error) { await dialog.alert(errorText(error), '读取日志失败'); }
  }
  return <div className="page"><PageHeader title="服务管理" description="默认聚焦运行中服务，所有操作直接调用 systemd 后端" back={back} actions={<Button compact onClick={data.reload}><Icon name="refresh" size={17}/>刷新</Button>}/><SearchBox value={query} onChange={setQuery} placeholder="搜索服务名称或描述"/><Tabs value={filter} onChange={setFilter} items={[{value:'running',label:'运行中',count:services.filter(x=>x.active==='active').length},{value:'failed',label:'异常',count:services.filter(x=>x.active==='failed'||x.sub==='failed').length},{value:'all',label:'全部',count:services.length}]}/><PageState {...data}>{visible.length ? <Card className="resource-list">{visible.map(service => <ResourceRow key={String(service.name)} title={String(service.name)} subtitle={String(service.description || '无描述')} meta={`${service.sub || '-'} · ${service.enabled || 'unknown'}`} status={<Status value={service.active}/>} actions={<><Button compact onClick={() => logs(String(service.name))}>日志</Button>{service.active === 'active' ? <><Button compact onClick={() => action(service, 'restart')}>重启</Button><Button compact tone="danger" onClick={() => action(service, 'stop')}>停止</Button></> : <Button compact tone="primary" onClick={() => action(service, 'start')}>启动</Button>}</>}/>)}</Card> : <Card><EmptyState title="没有匹配的服务"/></Card>}</PageState></div>;
}

export function ProcessesPage({ back }: PageNavProps) {
  const data = useApiData<Record<string, unknown>>('/api/v1/system/processes', { pollMs: 3000 });
  const [query, setQuery] = useState(''); const dialog = useDialog(); const toast = useToast();
  const processes = asArray<Record<string, any>>(data.data?.processes ?? data.data?.items).filter(item => !query || `${item.pid} ${item.name} ${item.user} ${item.command}`.toLowerCase().includes(query.toLowerCase()));
  async function signal(item: Record<string, any>, signal: 'term'|'kill') {
    if (!await dialog.confirm({ title: signal === 'kill' ? '强制结束进程' : '结束进程', message: `PID ${item.pid} · ${item.name || item.command || ''}${signal === 'kill' ? '\n强制结束可能导致数据损坏。' : ''}`, confirmText: signal === 'kill' ? '强制结束' : '发送 TERM', danger: true })) return;
    try { await secureApi('/api/v1/system/processes/action', { method: 'POST', body: jsonBody({ pid: Number(item.pid), signal }) }); toast('信号已发送'); await data.reload(); } catch (error) { await dialog.alert(errorText(error), '操作失败'); }
  }
  return <div className="page"><PageHeader title="进程管理" description="实时进程列表；危险信号必须二次验证" back={back} actions={<Button compact onClick={data.reload}><Icon name="refresh" size={17}/>刷新</Button>}/><SearchBox value={query} onChange={setQuery} placeholder="搜索 PID、名称、用户或命令"/><PageState {...data}>{processes.length ? <Card className="resource-list">{processes.map(item => <ResourceRow key={String(item.pid)} title={`${item.name || item.command || 'process'} · PID ${item.pid}`} subtitle={String(item.command || '')} meta={`${item.user || '-'} · CPU ${Number(item.cpu_percent ?? item.cpu ?? 0).toFixed(1)}% · 内存 ${formatBytes(item.memory_bytes ?? item.rss ?? 0)}`} actions={<><Button compact onClick={() => signal(item, 'term')}>TERM</Button><Button compact tone="danger" onClick={() => signal(item, 'kill')}>KILL</Button></>}/>)}</Card> : <Card><EmptyState title="没有匹配的进程"/></Card>}</PageState></div>;
}

export function NetworkPage({ back }: PageNavProps) {
  const data = useApiData<Record<string, any>>('/api/v1/system/network');
  const interfaces = asArray<Record<string, any>>(data.data?.interfaces);
  return <div className="page"><PageHeader title="网络信息" description="只读展示系统真实接口、累计流量和监听端口" back={back} actions={<Button compact onClick={data.reload}><Icon name="refresh" size={17}/>刷新</Button>}/><PageState {...data}><div className="card-grid">{interfaces.map(item => <Card key={String(item.name)}><div className="card-heading"><strong>{item.name}</strong><Status value={String(item.flags || '').includes('up') ? 'active' : 'inactive'}/></div><InfoList rows={[["地址", asArray<string>(item.addresses).join('\n') || '无地址'],['MTU',String(item.mtu ?? '-')],['接收',formatBytes(item.received_bytes)],['发送',formatBytes(item.sent_bytes)]]}/></Card>)}</div><Card><div className="card-heading"><strong>监听端口</strong></div><CodeBlock value={data.data?.listening ?? '未读取到监听端口'}/></Card></PageState></div>;
}

export function StoragePage({ back }: PageNavProps) {
  const data = useApiData<Record<string, any>>('/api/v1/system/storage');
  const items = asArray<Record<string, any>>(data.data?.mounts ?? data.data?.filesystems ?? data.data?.items);
  return <div className="page"><PageHeader title="存储空间" description="文件系统和挂载点的真实占用" back={back} actions={<Button compact onClick={data.reload}><Icon name="refresh" size={17}/>刷新</Button>}/><PageState {...data}>{items.length ? <Card className="resource-list">{items.map((item,index) => { const used=Number(item.used??0),total=Number(item.total??0),pct=Number(item.percent??(total?used/total*100:0)); const mount=String(item.mountpoint || item.mount_point || item.mount || item.device || '文件系统'); const fs=String(item.filesystem || item.type || item.fstype || ''); return <ResourceRow key={`${mount}-${index}`} icon="drive" title={mount} subtitle={String(item.device || fs || '')} meta={`${formatBytes(used)} / ${formatBytes(total)} · ${pct.toFixed(1)}%${item.virtual ? ' · 虚拟挂载' : ''}`} status={<Status value={pct >= 90 ? 'warning' : 'active'} label={fs}/>}/>;})}</Card>:<Card><EmptyState/></Card>}</PageState></div>;
}

export function TimersPage({ back }: PageNavProps) {
  const data = useApiData<Record<string, any>>('/api/v1/system/timers');
  return <div className="page">
    <PageHeader title="系统定时器" description="只读展示 systemd 的全部 timer；此页不会修改系统任务" back={back} actions={<Button compact onClick={data.reload}><Icon name="refresh" size={17}/>刷新</Button>}/>
    <PageState {...data}><Card><CodeBlock value={String(data.data?.timers || '当前没有可显示的 systemd timer')}/></Card></PageState>
  </div>;
}

export function TasksPage({ back }: PageNavProps) {
  const data = useApiData<Record<string, any>>('/api/v1/system/tasks');
  const dialog = useDialog();
  const toast = useToast();
  const [taskType, setTaskType] = useState('service-restart');
  const tasks = asArray<Record<string, any>>(data.data?.tasks ?? data.data?.items);

  const targetLabel = taskType === 'service-restart'
    ? 'systemd 服务名'
    : taskType === 'docker-restart'
      ? 'Docker 容器名称'
      : '目标由 LukePanel 固定';

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get('type') || '');
    const target = type === 'docker-cleanup-safe'
      ? 'safe'
      : type === 'panel-backup'
        ? 'scheduled-backups'
        : String(form.get('target') || '').trim();
    try {
      await secureApi('/api/v1/system/tasks/create', {
        method: 'POST',
        body: jsonBody({
          name: form.get('name'),
          type,
          target,
          frequency: form.get('frequency'),
          hour: Number(form.get('hour')),
          minute: Number(form.get('minute')),
          weekday: Number(form.get('weekday')),
        }),
      });
      event.currentTarget.reset();
      setTaskType('service-restart');
      toast('计划任务已创建');
      await data.reload();
    } catch (error) {
      await dialog.alert(errorText(error), '创建失败');
    }
  }

  async function action(item: Record<string, any>, next: string) {
    if (next === 'delete' && !await dialog.confirm({
      title: '删除计划任务',
      message: '对应的 systemd service 和 timer 会一起删除。',
      confirmText: '删除',
      danger: true,
    })) return;
    try {
      await secureApi('/api/v1/system/tasks/action', {
        method: 'POST',
        body: jsonBody({ id: item.id, action: next }),
      });
      toast('计划任务已更新');
      await data.reload();
    } catch (error) {
      await dialog.alert(errorText(error), '操作失败');
    }
  }

  return <div className="page">
    <PageHeader
      title="计划任务"
      description="仅创建后端白名单支持的安全任务，不接受任意 Shell"
      back={back}
      actions={<Button compact onClick={data.reload}><Icon name="refresh" size={17}/>刷新</Button>}
    />
    <Card>
      <form className="form-grid" onSubmit={create}>
        <label>名称<input name="name" required maxLength={80}/></label>
        <label>任务类型
          <select name="type" required value={taskType} onChange={event => setTaskType(event.target.value)}>
            <option value="service-restart">重启 systemd 服务</option>
            <option value="docker-restart">重启 Docker 容器</option>
            <option value="docker-cleanup-safe">Docker 安全清理</option>
            <option value="panel-backup">创建面板备份</option>
          </select>
        </label>
        <label className="span-2">{targetLabel}
          <input
            name="target"
            required={taskType === 'service-restart' || taskType === 'docker-restart'}
            disabled={taskType === 'docker-cleanup-safe' || taskType === 'panel-backup'}
            placeholder={taskType === 'service-restart' ? '例如 nginx.service' : taskType === 'docker-restart' ? '例如 adguardhome' : '由系统固定'}
          />
        </label>
        <label>频率
          <select name="frequency" defaultValue="daily">
            <option value="hourly">每小时</option>
            <option value="daily">每天</option>
            <option value="weekly">每周</option>
          </select>
        </label>
        <label>小时<input name="hour" type="number" min="0" max="23" defaultValue="3"/></label>
        <label>分钟<input name="minute" type="number" min="0" max="59" defaultValue="0"/></label>
        <label>星期（0 周日）<input name="weekday" type="number" min="0" max="6" defaultValue="1"/></label>
        <div className="form-actions span-2"><Button tone="primary" type="submit"><Icon name="plus" size={17}/>创建任务</Button></div>
      </form>
    </Card>
    <PageState {...data}>
      {tasks.length ? <Card className="resource-list">
        {tasks.map(item => <ResourceRow
          key={String(item.id)}
          title={String(item.name || item.id)}
          subtitle={`${String(item.frequency || '')} · 下次 ${String(item.next_run || '未读取')}`}
          meta={`${item.type || '-'} · ${item.target || '-'}${item.last_run ? ` · 上次 ${item.last_run}` : ''}`}
          status={<Status value={item.enabled} label={item.enabled ? '已启用' : '已停用'}/>}
          actions={<>
            <Button compact onClick={() => action(item, 'run')}>立即运行</Button>
            <Button compact onClick={() => action(item, item.enabled ? 'disable' : 'enable')}>{item.enabled ? '停用' : '启用'}</Button>
            <Button compact tone="danger" onClick={() => action(item, 'delete')}>删除</Button>
          </>}
        />)}
      </Card> : <Card><EmptyState title="暂无 LukePanel 计划任务"/></Card>}
    </PageState>
  </div>;
}

export function UpdatesPage({ back }: PageNavProps) {
  const data = useApiData<Record<string, any>>('/api/v1/system/apt/preflight');
  const sourcesData = useApiData<Record<string, any>>('/api/v1/system/apt/sources');
  const dialog = useDialog();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Record<string, any>[]>([]);
  const [busy, setBusy] = useState('');

  const packages = asArray<string>(data.data?.packages);

  async function aptAction(endpoint: string, label: string) {
    if (!await dialog.confirm({
      title: label,
      message: endpoint.endsWith('/upgrade')
        ? '系统会先创建配置快照，再下载并执行 dist-upgrade。升级期间不要关闭面板服务。'
        : '仅下载可升级的软件包，不修改已安装版本。',
      confirmText: '继续',
      danger: endpoint.endsWith('/upgrade'),
    })) return;
    setBusy(endpoint);
    try {
      const out = await secureApi<Record<string, any>>(endpoint, { method: 'POST' });
      const output = String(out.output || '').trim();
      if (output) await dialog.alert(output, `${label}结果`);
      toast(`${label}已完成`);
      await data.reload();
    } catch (error) {
      await dialog.alert(errorText(error), `${label}失败`);
    } finally {
      setBusy('');
    }
  }

  async function packageAction(item: Record<string, any>, action: 'install' | 'remove') {
    const name = String(item.name || '');
    if (!name) return;
    const label = action === 'install' ? `安装 ${name}` : `删除 ${name}`;
    if (!await dialog.confirm({
      title: label,
      message: 'APT 将直接修改系统软件包，并在操作前创建配置快照。',
      confirmText: action === 'install' ? '安装' : '删除',
      danger: action === 'remove',
    })) return;
    setBusy(`${action}:${name}`);
    try {
      const out = await secureApi<Record<string, any>>('/api/v1/system/apt/package', {
        method: 'POST',
        body: jsonBody({ action, packages: [name] }),
      });
      const output = String(out.output || '').trim();
      if (output) await dialog.alert(output, `${label}结果`);
      toast(`${label}已完成`);
      await Promise.all([data.reload(), runSearch(query)]);
    } catch (error) {
      await dialog.alert(errorText(error), `${label}失败`);
    } finally {
      setBusy('');
    }
  }

  async function runSearch(value: string) {
    const clean = value.trim();
    if (clean.length < 2) {
      setResults([]);
      return;
    }
    const out = await api<Record<string, any>>(`/api/v1/system/apt/search?q=${encodeURIComponent(clean)}`);
    setResults(asArray(out.packages ?? out.results));
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy('search');
    try {
      await runSearch(query);
    } catch (error) {
      await dialog.alert(errorText(error), '搜索失败');
    } finally {
      setBusy('');
    }
  }

  const sources = asArray<Record<string, any>>(sourcesData.data?.sources);

  async function sourceAction(action: 'enable' | 'disable' | 'delete', item: Record<string, any>) {
    const path = String(item.path || '');
    if (!path) return;
    if ((action === 'delete' || action === 'disable') && !await dialog.confirm({
      title: action === 'delete' ? '删除软件源文件' : '停用软件源',
      message: path,
      confirmText: action === 'delete' ? '删除' : '停用',
      danger: action === 'delete',
    })) return;
    setBusy(`source:${action}:${path}`);
    try {
      await secureApi('/api/v1/system/apt/sources', { method: 'POST', body: jsonBody({ action, path }) });
      toast(action === 'enable' ? '软件源已启用' : action === 'disable' ? '软件源已停用' : '软件源已删除');
      await Promise.all([sourcesData.reload(), data.reload()]);
    } catch (error) {
      await dialog.alert(errorText(error), '软件源操作失败');
    } finally {
      setBusy('');
    }
  }

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const content = String(form.get('content') || '').trim();
    setBusy('source:add');
    try {
      await secureApi('/api/v1/system/apt/sources', { method: 'POST', body: jsonBody({ action: 'add', name, content }) });
      event.currentTarget.reset();
      toast('软件源已添加');
      await Promise.all([sourcesData.reload(), data.reload()]);
    } catch (error) {
      await dialog.alert(errorText(error), '添加软件源失败');
    } finally {
      setBusy('');
    }
  }

  const unavailable = data.data?.available === false;
  const locked = Boolean(data.data?.locked);
  const upgradeCount = Number(data.data?.upgrade_count ?? packages.length);

  return <div className="page">
    <PageHeader
      title="软件管理"
      description="先模拟、再下载、最后升级；所有结果来自系统真实 APT"
      back={back}
      actions={<Button compact onClick={data.reload}><Icon name="refresh" size={17}/>重新预检</Button>}
    />
    {locked ? <ErrorState message={`APT 正被其他任务占用：${String(data.data?.lock_detail || '请稍后再试')}`} retry={data.reload}/> : null}
    <div className="toolbar">
      <Button onClick={() => aptAction('/api/v1/system/apt/download', '下载更新')} disabled={!!busy || locked || unavailable || upgradeCount === 0}>只下载更新</Button>
      <Button tone="primary" onClick={() => aptAction('/api/v1/system/apt/upgrade', '安全升级')} disabled={!!busy || locked || unavailable || upgradeCount === 0}>开始安全升级</Button>
    </div>
    <PageState {...data}>
      <div className="kpi-inline">
        <Card><strong>{upgradeCount}</strong><span>可升级</span></Card>
        <Card><strong>{Number(data.data?.install_count ?? 0)}</strong><span>新增安装</span></Card>
        <Card><strong>{Number(data.data?.remove_count ?? 0)}</strong><span>计划移除</span></Card>
        <Card><strong>{formatBytes(data.data?.download_bytes ?? 0)}</strong><span>预计下载</span></Card>
      </div>
      <Card>
        <InfoList rows={[
          ['APT 可用', unavailable ? '否' : '是'],
          ['需要重启', data.data?.reboot_required ? '是' : '否'],
          ['磁盘变化', `${formatBytes(Math.abs(Number(data.data?.disk_delta_bytes ?? 0)))}${Number(data.data?.disk_delta_bytes ?? 0) < 0 ? ' 减少' : ' 增加'}`],
        ]}/>
      </Card>
      {packages.length ? <Card className="package-list">
        {packages.map(name => <span key={name}>{name}</span>)}
      </Card> : <Card><EmptyState title="当前没有可升级软件包"/></Card>}
    </PageState>
    <Card>
      <form className="inline-form" onSubmit={search}>
        <label className="grow">搜索软件包<input value={query} onChange={event => setQuery(event.target.value)} minLength={2} placeholder="例如 curl、htop"/></label>
        <Button type="submit" disabled={busy === 'search'}>搜索</Button>
      </form>
      {results.length ? <div className="resource-list">
        {results.map((item, index) => <ResourceRow
          key={`${item.name}-${index}`}
          title={String(item.name)}
          subtitle={item.installed ? `已安装 ${String(item.version || '')}` : '未安装'}
          meta={String(item.description || '')}
          actions={<Button
            compact
            tone={item.installed ? 'danger' : 'primary'}
            disabled={Boolean(busy)}
            onClick={() => packageAction(item, item.installed ? 'remove' : 'install')}
          >{item.installed ? '删除' : '安装'}</Button>}
        />)}
      </div> : null}
    </Card>
    <Card>
      <div className="card-heading"><div><strong>APT 软件源</strong><p>仅管理 /etc/apt 下的真实源文件；修改前后端自动创建快照</p></div><Button compact onClick={sourcesData.reload}><Icon name="refresh" size={16}/>刷新</Button></div>
      {sourcesData.error ? <ErrorState message={sourcesData.error} retry={sourcesData.reload}/> : null}
      {sources.length ? <div className="resource-list">{sources.map((item,index) => {
        const enabled = item.enabled !== false;
        const path = String(item.path || item.name || `source-${index}`);
        return <ResourceRow key={path} title={String(item.name || path.split('/').pop() || path)} subtitle={path} meta={String(item.content || item.summary || '')} status={<Status value={enabled} label={enabled ? '已启用' : '已停用'}/>} actions={<>
          <Button compact onClick={() => sourceAction(enabled ? 'disable' : 'enable', item)}>{enabled ? '停用' : '启用'}</Button>
          <Button compact tone="danger" onClick={() => sourceAction('delete', item)}>删除</Button>
        </>}/>;
      })}</div> : <EmptyState title={sourcesData.loading ? '正在读取软件源' : '未读取到可管理的软件源'}/>} 
      <form className="stack-form top-gap" onSubmit={addSource}>
        <label>文件名<input name="name" required maxLength={80} placeholder="例如 custom.list"/></label>
        <label>源内容<textarea name="content" rows={4} required placeholder="deb https://example.invalid/debian stable main"/></label>
        <Button type="submit" tone="primary" disabled={busy === 'source:add'}>添加软件源</Button>
      </form>
    </Card>
  </div>;
}

export function HostPage({ back }: PageNavProps) {
  const host=useApiData<Record<string,any>>('/api/v1/system/host'); const ntp=useApiData<Record<string,any>>('/api/v1/system/host/ntp'); const dialog=useDialog(); const toast=useToast(); const x=host.data??{}; const sys=asRecord(x.sysctl); const swap=asRecord(x.swap);
  async function mutation(endpoint:string,body:unknown,method='POST'){try{await secureApi(`/api/v1/system/host/${endpoint}`,{method,body:body===null?undefined:jsonBody(body)});toast('主机设置已更新');await Promise.all([host.reload(),ntp.reload()]);}catch(error){await dialog.alert(errorText(error),'修改失败');}}
  async function formBasic(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);const hostname=String(f.get('hostname')||'');const timezone=String(f.get('timezone')||'');if(hostname!==x.hostname)await mutation('hostname',{hostname});if(timezone!==x.timezone)await mutation('timezone',{timezone});}
  async function formDNS(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);const servers=String(f.get('dns')||'').split(/\s+/).filter(Boolean);await mutation('dns',{servers});}
  return <div className="page"><PageHeader title="主机设置" description="固定动作、参数校验、失败回滚，不开放任意 sysctl 或 Shell" back={back} actions={<Button compact onClick={()=>{host.reload();ntp.reload();}}><Icon name="refresh" size={17}/>刷新</Button>}/><PageState {...host}><div className="card-grid"><Card><div className="card-heading"><strong>基础信息</strong></div><form className="stack-form" onSubmit={formBasic}><label>主机名<input name="hostname" defaultValue={String(x.hostname||'')} required/></label><label>时区<input name="timezone" defaultValue={String(x.timezone||'UTC')} required/></label><Button tone="primary" type="submit">保存基础设置</Button></form></Card><Card><div className="card-heading"><strong>系统 DNS</strong><Status value={x.systemd_resolved}/></div><form className="stack-form" onSubmit={formDNS}><label>DNS 服务器<textarea name="dns" rows={4} defaultValue={asArray<string>(x.dns).join('\n')} placeholder="每行一个 IP"/></label><Button tone="primary" type="submit" disabled={!x.systemd_resolved}>测试并保存</Button></form></Card><Card><div className="card-heading"><strong>Swap</strong><Status value={swap.enabled}/></div><InfoList rows={[["使用量",`${formatBytes(swap.used)} / ${formatBytes(swap.total)}`],["路径",String(swap.path||'-')],["LukePanel 管理",swap.managed?'是':'否']]}/>{swap.managed?<Button tone="danger" onClick={async()=>{if(await dialog.confirm({title:'删除 Swap',message:'仅删除 LukePanel 管理的 /swapfile。',confirmText:'删除',danger:true}))mutation('swap',null,'DELETE');}}>删除 Swap</Button>:<form className="inline-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);mutation('swap',{size_mb:Number(f.get('size_mb'))});}}><label>大小（MB）<input name="size_mb" type="number" min="256" max="32768" defaultValue="2048"/></label><Button tone="primary" type="submit">创建</Button></form>}</Card><Card><div className="card-heading"><strong>时间同步</strong><Status value={ntp.data?.synchronized?'active':ntp.data?.enabled?'warning':'inactive'} label={ntp.data?.synchronized?'已同步':ntp.data?.enabled?'等待同步':'未启用'}/></div><InfoList rows={[["服务",String(ntp.data?.service||'未检测到')],["时区",String(ntp.data?.timezone||x.timezone||'-')],["服务器",String(ntp.data?.server_name||ntp.data?.server_address||'自动')],["上次同步",String(ntp.data?.last_sync||'-')]]}/><Button tone={ntp.data?.enabled?'secondary':'primary'} disabled={!ntp.data?.available} onClick={()=>mutation('ntp',{enabled:!ntp.data?.enabled})}>{ntp.data?.enabled?'关闭时间同步':'开启时间同步'}</Button></Card></div><Card><div className="card-heading"><div><strong>内核优化预设</strong><p>当前：{String(sys.label||'系统默认')}</p></div><Status value={sys.managed}/></div><div className="preset-grid">{[{id:'balanced',name:'均衡',desc:'适合通用服务器'},{id:'network',name:'网络吞吐',desc:'BBR + fq，偏向网络服务'},{id:'low-memory',name:'小内存 VPS',desc:'降低脏页比例和内存压力'},{id:'reset',name:'恢复默认',desc:'删除 LukePanel 管理配置'}].map(p=><button key={p.id} className={sys.preset===p.id?'active':''} onClick={()=>mutation('sysctl',{preset:p.id})}><strong>{p.name}</strong><span>{p.desc}</span></button>)}</div><InfoList rows={[["拥塞控制",String(sys.congestion_control||'未读取')],["队列算法",String(sys.default_qdisc||'未读取')],["Swappiness",String(sys.swappiness??'-')],["BBR",sys.bbr?'已启用':'未启用']]}/></Card></PageState></div>;
}

export function SnapshotsPage({ back }: PageNavProps) {
  const data=useApiData<Record<string,any>>('/api/v1/system/snapshots');const dialog=useDialog();const toast=useToast();const items=asArray<Record<string,any>>(data.data?.snapshots??data.data?.items);
  async function action(item:Record<string,any>,next:'restore'|'delete'){if(!await dialog.confirm({title:next==='restore'?'恢复配置快照':'删除配置快照',message:next==='restore'?'恢复会覆盖当前配置，后端会先创建回滚点。':'删除后无法恢复。',confirmText:next==='restore'?'恢复':'删除',danger:true}))return;try{await secureApi('/api/v1/system/snapshots',{method:'POST',body:jsonBody({id:item.id,action:next})});toast(next==='restore'?'快照已恢复':'快照已删除');await data.reload();}catch(error){await dialog.alert(errorText(error),'操作失败');}}
  return <div className="page"><PageHeader title="配置快照" description="关键系统操作前创建的真实回滚点" back={back} actions={<Button compact onClick={data.reload}><Icon name="refresh" size={17}/>刷新</Button>}/><PageState {...data}>{items.length?<Card className="resource-list">{items.map(item=><ResourceRow key={String(item.id)} title={String(item.name||item.id)} subtitle={String(item.reason||item.description||'')} meta={`${formatDate(item.created_at)} · ${formatBytes(item.size)}`} actions={<><Button compact onClick={()=>action(item,'restore')}>恢复</Button><Button compact tone="danger" onClick={()=>action(item,'delete')}>删除</Button></>}/>)}</Card>:<Card><EmptyState title="暂无配置快照"/></Card>}</PageState></div>;
}
