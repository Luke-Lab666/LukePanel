import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, errorText, jsonBody, secureApi } from '../lib/api';
import { asArray, formatBytes, formatDate } from '../lib/format';
import { useApiData } from '../lib/useApiData';
import { useDialog } from '../components/Dialog';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Button, Card, EmptyState, ErrorState, Loading, PageHeader, ResourceRow, SearchBox, Status, Tabs } from '../components/UI';
import type { PageNavProps } from './SystemPages';

type Tab = 'containers' | 'images' | 'compose' | 'networks' | 'volumes' | 'cleanup';
type EditPort = { host_ip: string; host_port: string; container_port: string; protocol: string };
type EditMount = { type: string; source: string; target: string; read_only: boolean };
type EditSpec = {
  id: string; name: string; image: string; env: string[]; cmd: string[]; entrypoint: string[];
  working_dir: string; user: string; hostname: string; restart_policy: string;
  restart_maximum_retry_count: number; network_mode: string; privileged: boolean;
  auto_remove: boolean; running: boolean; compose_managed: boolean; compose_project?: string;
  compose_service?: string; compose_files?: string[]; ports: EditPort[]; mounts: EditMount[];
};
type Editor = EditSpec & { envText: string; cmdText: string; entrypointText: string; portsText: string; mountsText: string };

function containerName(item: Record<string, any>) { return asArray<string>(item.names)[0]?.replace(/^\//, '') || item.name || String(item.id || '').slice(0, 12); }
function portsText(item: Record<string, any>) { return asArray<Record<string, any>>(item.ports).map(port => port.PublicPort ? `${port.IP || '0.0.0.0'}:${port.PublicPort}→${port.PrivatePort}/${port.Type || 'tcp'}` : `${port.PrivatePort}/${port.Type || 'tcp'}`).join(' · '); }
function editPortLine(port: EditPort) { return `${port.host_ip || ''}|${port.host_port || ''}|${port.container_port || ''}|${port.protocol || 'tcp'}`; }
function editMountLine(mount: EditMount) { return `${mount.type || 'bind'}|${mount.source || ''}|${mount.target || ''}|${mount.read_only ? 'ro' : 'rw'}`; }
function parseLines(value: string) { return value.split('\n').map(line => line.trim()).filter(Boolean); }
function parsePorts(value: string): EditPort[] { return parseLines(value).map(line => { const [host_ip = '', host_port = '', container_port = '', protocol = 'tcp'] = line.split('|'); return { host_ip: host_ip.trim(), host_port: host_port.trim(), container_port: container_port.trim(), protocol: protocol.trim() || 'tcp' }; }); }
function parseMounts(value: string): EditMount[] { return parseLines(value).map(line => { const [type = 'bind', source = '', target = '', mode = 'rw'] = line.split('|'); return { type: type.trim(), source: source.trim(), target: target.trim(), read_only: mode.trim().toLowerCase() === 'ro' }; }); }
function toEditor(spec: EditSpec): Editor { return { ...spec, envText: asArray<string>(spec.env).join('\n'), cmdText: asArray<string>(spec.cmd).join('\n'), entrypointText: asArray<string>(spec.entrypoint).join('\n'), portsText: asArray<EditPort>(spec.ports).map(editPortLine).join('\n'), mountsText: asArray<EditMount>(spec.mounts).map(editMountLine).join('\n') }; }

export function DockerPage({ back }: PageNavProps) {
  const [tab, setTab] = useState<Tab>('containers');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const dialog = useDialog();
  const toast = useToast();
  const status = useApiData<Record<string, any>>('/api/v1/docker/status');
  const containers = useApiData<Record<string, any>>(status.data?.available ? '/api/v1/docker/containers' : null, { pollMs: 10000, deps: [status.data?.available] });
  const stats = useApiData<Record<string, any>>(status.data?.available ? '/api/v1/docker/stats' : null, { pollMs: 5000, deps: [status.data?.available] });
  const images = useApiData<Record<string, any>>(tab === 'images' ? '/api/v1/docker/images' : null, { deps: [tab] });
  const compose = useApiData<Record<string, any>>(tab === 'compose' ? '/api/v1/docker/compose' : null, { deps: [tab] });
  const networks = useApiData<Record<string, any>>(tab === 'networks' ? '/api/v1/docker/networks' : null, { deps: [tab] });
  const volumes = useApiData<Record<string, any>>(tab === 'volumes' ? '/api/v1/docker/volumes' : null, { deps: [tab] });
  const cleanup = useApiData<Record<string, any>>(tab === 'cleanup' ? '/api/v1/docker/cleanup/preview' : null, { deps: [tab] });
  const statMap = useMemo(() => new Map(asArray<Record<string, any>>(stats.data?.stats).map(item => [String(item.id), item])), [stats.data]);
  const allContainers = asArray<Record<string, any>>(containers.data?.containers);
  const containerItems = allContainers.filter(item => !query || `${containerName(item)} ${item.image} ${item.status}`.toLowerCase().includes(query.toLowerCase()));
  const counts = useMemo(() => ({ all: allContainers.length, running: allContainers.filter(item => item.state === 'running').length }), [allContainers]);

  async function mutate(endpoint: string, body: unknown, label: string, confirm?: { message: string; danger?: boolean }, method = 'POST') {
    if (confirm && !await dialog.confirm({ title: label, message: confirm.message, confirmText: label, danger: confirm.danger })) return undefined;
    setBusy(endpoint);
    try {
      const out = await secureApi<Record<string, any>>(endpoint, { method, body: body === undefined ? undefined : jsonBody(body) });
      if (out.output) await dialog.alert(String(out.output), `${label}输出`);
      toast(String(out.message || `${label}完成`));
      await Promise.all([containers.reload(), stats.reload(), images.reload(), compose.reload(), networks.reload(), volumes.reload(), cleanup.reload()]);
      return out;
    } catch (error) { await dialog.alert(errorText(error), `${label}失败`); return undefined; }
    finally { setBusy(''); }
  }

  async function logs(item: Record<string, any>) {
    try { const out = await api<Record<string, any>>(`/api/v1/docker/logs?id=${encodeURIComponent(item.id)}&tail=500`); await dialog.alert(String(out.logs ?? out.output ?? '暂无日志'), `${containerName(item)} 日志`); }
    catch (error) { await dialog.alert(errorText(error), '读取日志失败'); }
  }

  async function inspect(item: Record<string, any>) {
    try { const out = await api<EditSpec>(`/api/v1/docker/inspect?id=${encodeURIComponent(item.id)}`); setEditor(toEditor(out)); }
    catch (error) { await dialog.alert(errorText(error), '读取配置失败'); }
  }

  async function execDiagnostic(item: Record<string, any>) {
    const command = await dialog.prompt({
      title: '容器安全诊断',
      message: '仅执行服务端固定白名单命令，不接受任意 Shell。',
      value: 'os-release',
      required: true,
      options: [
        { value: 'os-release', label: '系统版本（/etc/os-release）' },
        { value: 'identity', label: '运行身份（id）' },
        { value: 'working-directory', label: '工作目录（pwd）' },
        { value: 'environment', label: '环境变量（env）' },
        { value: 'disk', label: '磁盘占用（df -h）' },
        { value: 'processes', label: '进程列表（ps aux）' },
        { value: 'network', label: '网络统计（/proc/net/dev）' },
        { value: 'list-root', label: '根目录列表（ls -la /）' },
      ],
    });
    if (!command) return;
    try {
      const out = await secureApi<Record<string, any>>('/api/v1/docker/exec', { method: 'POST', body: jsonBody({ id: item.id, command: command.trim() }) });
      await dialog.alert(String(out.output || '命令没有输出'), `${containerName(item)} · 诊断输出`);
    } catch (error) { await dialog.alert(errorText(error), '诊断失败'); }
  }

  async function saveContainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor || editor.compose_managed) return;
    const request = {
      id: editor.id, name: editor.name.trim(), image: editor.image.trim(),
      env: parseLines(editor.envText), cmd: parseLines(editor.cmdText), entrypoint: parseLines(editor.entrypointText),
      working_dir: editor.working_dir.trim(), user: editor.user.trim(), hostname: editor.hostname.trim(),
      restart_policy: editor.restart_policy, restart_maximum_retry_count: Number(editor.restart_maximum_retry_count || 0),
      network_mode: editor.network_mode.trim() || 'default', privileged: editor.privileged,
      ports: parsePorts(editor.portsText), mounts: parseMounts(editor.mountsText), start: editor.running,
    };
    const result = await mutate('/api/v1/docker/recreate', request, '重建容器', { message: `${editor.name}\n后端会先创建新容器；失败时自动恢复旧容器。`, danger: true });
    if (result) { setEditor(null); if (result.warning) await dialog.alert(String(result.warning), '容器已重建，但有警告'); }
  }

  if (status.loading && !status.data) return <div className="page"><PageHeader title="Docker" back={back}/><Loading label="正在检查 Docker Engine"/></div>;
  if (status.error && !status.data) return <div className="page"><PageHeader title="Docker" back={back}/><ErrorState message={status.error} retry={status.reload}/></div>;
  if (!status.data?.available) return <div className="page"><PageHeader title="Docker" description="当前服务器未检测到可用的 Docker Engine" back={back}/><Card className="state-card"><Icon name="docker" size={30}/><div><strong>Docker 不可用</strong><p>{String(status.data?.error || 'Docker socket 不存在')}</p></div><Button tone="primary" onClick={() => mutate('/api/v1/docker/install', {}, '安装 Docker', { message: '将使用发行版软件包安装 Docker Engine。' })}>安装 Docker</Button></Card></div>;

  return <div className="page">
    <PageHeader title="Docker" description={`Engine ${status.data.version || ''} · ${counts.running}/${counts.all} 个容器运行中`} back={back} actions={<Button compact onClick={() => { void status.reload(); void containers.reload(); void stats.reload(); }}><Icon name="refresh" size={17}/>刷新</Button>}/>
    <Tabs value={tab} onChange={setTab} items={[{ value: 'containers', label: '容器', count: counts.all }, { value: 'images', label: '镜像' }, { value: 'compose', label: 'Compose' }, { value: 'networks', label: '网络' }, { value: 'volumes', label: '存储卷' }, { value: 'cleanup', label: '清理' }]}/>
    {tab === 'containers' ? <Containers items={containerItems} query={query} setQuery={setQuery} loading={containers.loading} error={containers.error} reload={containers.reload} busy={busy} statMap={statMap} action={(item, next) => mutate('/api/v1/docker/action', { id: item.id, action: next }, { start: '启动', stop: '停止', restart: '重启', kill: '强制结束', remove: '删除' }[next] || next, next === 'start' ? undefined : { message: `${containerName(item)} · ${item.image}`, danger: ['kill', 'remove'].includes(next) })} logs={logs} inspect={inspect} execDiagnostic={execDiagnostic}/> : null}
    {tab === 'images' ? <Images data={images} busy={busy} mutate={mutate} dialog={dialog}/> : null}
    {tab === 'compose' ? <Compose data={compose} busy={busy} mutate={mutate} dialog={dialog} toast={toast}/> : null}
    {tab === 'networks' ? <Networks data={networks} busy={busy} mutate={mutate}/> : null}
    {tab === 'volumes' ? <Volumes data={volumes} busy={busy} mutate={mutate} dialog={dialog}/> : null}
    {tab === 'cleanup' ? <Cleanup data={cleanup} busy={busy} mutate={mutate}/> : null}

    {editor ? <div className="editor-overlay"><section className="editor-dialog docker-editor"><header><div><strong>编辑容器 · {editor.name}</strong><small>{editor.id}</small></div><Button compact onClick={() => setEditor(null)}>关闭</Button></header>{editor.compose_managed ? <ErrorState message={`此容器由 Compose 项目 ${editor.compose_project || '-'} 管理。直接重建会被下一次 compose up 覆盖，请在 Compose 标签页编辑配置。`}/> : <form className="form-grid docker-edit-form" onSubmit={saveContainer}><label>容器名称<input value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })} required/></label><label>镜像<input value={editor.image} onChange={event => setEditor({ ...editor, image: event.target.value })} required/></label><label>重启策略<select value={editor.restart_policy} onChange={event => setEditor({ ...editor, restart_policy: event.target.value })}><option value="no">不自动重启</option><option value="always">always</option><option value="unless-stopped">unless-stopped</option><option value="on-failure">on-failure</option></select></label><label>最大重试<input type="number" min="0" max="100000" disabled={editor.restart_policy !== 'on-failure'} value={editor.restart_maximum_retry_count || 0} onChange={event => setEditor({ ...editor, restart_maximum_retry_count: Number(event.target.value) })}/></label><label>网络模式<input value={editor.network_mode} onChange={event => setEditor({ ...editor, network_mode: event.target.value })} placeholder="default / bridge / host / none / 网络名"/></label><label>主机名<input value={editor.hostname} onChange={event => setEditor({ ...editor, hostname: event.target.value })}/></label><label>工作目录<input value={editor.working_dir} onChange={event => setEditor({ ...editor, working_dir: event.target.value })}/></label><label>运行用户<input value={editor.user} onChange={event => setEditor({ ...editor, user: event.target.value })}/></label><label className="span-2">环境变量（每行 KEY=VALUE）<textarea rows={7} value={editor.envText} onChange={event => setEditor({ ...editor, envText: event.target.value })}/></label><label className="span-2">端口（每行：监听IP|宿主端口|容器端口|协议）<textarea rows={5} value={editor.portsText} onChange={event => setEditor({ ...editor, portsText: event.target.value })} placeholder="0.0.0.0|8080|80|tcp"/></label><label className="span-2">挂载（每行：bind/volume|源|容器路径|ro/rw）<textarea rows={5} value={editor.mountsText} onChange={event => setEditor({ ...editor, mountsText: event.target.value })} placeholder="bind|/opt/app|/app|rw"/></label><label>命令（每行一个参数）<textarea rows={4} value={editor.cmdText} onChange={event => setEditor({ ...editor, cmdText: event.target.value })}/></label><label>Entrypoint（每行一个参数）<textarea rows={4} value={editor.entrypointText} onChange={event => setEditor({ ...editor, entrypointText: event.target.value })}/></label><label className="checkbox"><input type="checkbox" checked={editor.privileged} onChange={event => setEditor({ ...editor, privileged: event.target.checked })}/>特权模式</label><div className="form-actions span-2"><Button tone="primary" type="submit" disabled={!!busy}>校验并重建容器</Button></div></form>}</section></div> : null}
  </div>;
}

function Containers({ items, query, setQuery, loading, error, reload, busy, statMap, action, logs, inspect, execDiagnostic }: { items: Record<string, any>[]; query: string; setQuery: (value: string) => void; loading: boolean; error: string; reload: () => void; busy: string; statMap: Map<string, Record<string, any>>; action: (item: Record<string, any>, next: string) => void; logs: (item: Record<string, any>) => void; inspect: (item: Record<string, any>) => void; execDiagnostic: (item: Record<string, any>) => void }) {
  if (loading && !items.length) return <Loading label="正在读取容器"/>;
  if (error && !items.length) return <ErrorState message={error} retry={reload}/>;
  return <><SearchBox value={query} onChange={setQuery} placeholder="搜索容器、镜像或状态"/>{items.length ? <Card className="resource-list">{items.map(item => { const stat = statMap.get(String(item.id)) || {}; return <ResourceRow key={String(item.id)} icon="docker" title={containerName(item)} subtitle={String(item.image || '')} meta={`${item.status || item.state || '-'}${portsText(item) ? ` · ${portsText(item)}` : ''}${item.state === 'running' ? ` · CPU ${Number(stat.cpu_percent || 0).toFixed(1)}% · 内存 ${formatBytes(stat.memory_usage || 0)}` : ''}`} status={<Status value={item.state}/>} actions={<><Button compact onClick={() => logs(item)}>日志</Button><Button compact onClick={() => execDiagnostic(item)}>诊断</Button><Button compact onClick={() => inspect(item)}>编辑</Button>{item.state === 'running' ? <><Button compact onClick={() => action(item, 'restart')} disabled={!!busy}>重启</Button><Button compact tone="danger" onClick={() => action(item, 'stop')} disabled={!!busy}>停止</Button></> : <Button compact tone="primary" onClick={() => action(item, 'start')} disabled={!!busy}>启动</Button>}<Button compact tone="danger" onClick={() => action(item, 'remove')} disabled={!!busy}>删除</Button></>}/>; })}</Card> : <Card><EmptyState title="没有匹配的容器"/></Card>}</>;
}

function Images({ data, busy, mutate, dialog }: { data: ReturnType<typeof useApiData<Record<string, any>>>; busy: string; mutate: (endpoint: string, body: unknown, label: string, confirm?: { message: string; danger?: boolean }, method?: string) => Promise<Record<string, any> | undefined>; dialog: ReturnType<typeof useDialog> }) {
  const [reference, setReference] = useState('');
  const [hubQuery, setHubQuery] = useState('');
  const [hub, setHub] = useState<Record<string, any>[]>([]);
  const items = asArray<Record<string, any>>(data.data?.images);
  async function searchHub(event: FormEvent) { event.preventDefault(); if (!hubQuery.trim()) return; try { const out = await api<Record<string, any>>(`/api/v1/docker/hub/search?q=${encodeURIComponent(hubQuery.trim())}&limit=20`); setHub(asArray(out.repositories)); } catch (error) { await dialog.alert(errorText(error), 'Docker Hub 搜索失败'); } }
  async function build(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { context_dir: String(form.get('context_dir') || '').trim(), dockerfile: String(form.get('dockerfile') || 'Dockerfile').trim(), tag: String(form.get('tag') || '').trim(), no_cache: form.get('no_cache') === 'on', pull: form.get('pull') === 'on' };
    const out = await mutate('/api/v1/docker/images/build', body, '构建镜像', { message: `${body.tag}\n构建目录：${body.context_dir}` });
    if (out) event.currentTarget.reset();
  }
  return <>
    <Card><form className="inline-form" onSubmit={event => { event.preventDefault(); if (reference.trim()) void mutate('/api/v1/docker/images/pull', { reference: reference.trim() }, '拉取镜像'); }}><label className="grow">镜像引用<input value={reference} onChange={event => setReference(event.target.value)} placeholder="nginx:latest"/></label><Button tone="primary" type="submit" disabled={!!busy}><Icon name="download" size={17}/>拉取</Button></form></Card>
    <Card><div className="card-heading"><div><strong>从 Dockerfile 构建</strong><p>构建目录必须位于文件管理授权范围内</p></div></div><form className="form-grid" onSubmit={build}><label>构建目录<input name="context_dir" required placeholder="/opt/myapp"/></label><label>Dockerfile<input name="dockerfile" defaultValue="Dockerfile" required/></label><label className="span-2">镜像标签<input name="tag" required placeholder="myapp:latest"/></label><label className="checkbox"><input name="pull" type="checkbox"/>构建前拉取基础镜像</label><label className="checkbox"><input name="no_cache" type="checkbox"/>禁用构建缓存</label><div className="form-actions span-2"><Button tone="primary" type="submit" disabled={!!busy}>开始构建</Button></div></form></Card>
    <Card><form className="inline-form" onSubmit={searchHub}><label className="grow">Docker Hub 搜索<input value={hubQuery} onChange={event => setHubQuery(event.target.value)} placeholder="例如 adguardhome"/></label><Button type="submit">搜索</Button></form>{hub.length ? <div className="resource-list">{hub.map(item => { const name=String(item.name || ''); return <ResourceRow key={name} title={name} subtitle={String(item.description || '')} meta={`${item.official ? '官方镜像 · ' : ''}${Number(item.stars || 0)} Stars · ${Number(item.pulls || 0).toLocaleString()} Pulls`} actions={<Button compact onClick={() => void mutate('/api/v1/docker/images/pull', { reference: `${name}:latest` }, '拉取镜像')}>拉取 latest</Button>}/>; })}</div> : null}</Card>
    {data.loading && !data.data ? <Loading/> : data.error && !data.data ? <ErrorState message={data.error} retry={data.reload}/> : items.length ? <Card className="resource-list">{items.map(item => <ResourceRow key={String(item.id)} title={asArray<string>(item.repo_tags).join(', ') || '<none>'} subtitle={String(item.id || '').replace('sha256:', '').slice(0, 20)} meta={`${formatBytes(item.size)} · ${item.created ? formatDate(new Date(Number(item.created) * 1000).toISOString()) : '-'}`} actions={<Button compact tone="danger" onClick={() => void mutate('/api/v1/docker/images/delete', { id: item.id }, '删除镜像', { message: asArray<string>(item.repo_tags).join(', ') || String(item.id), danger: true })}>删除</Button>}/>)}</Card> : <Card><EmptyState title="暂无镜像"/></Card>}
  </>;
}

type ComposeEditor = { project: string; working_dir: string; files: { path: string; content: string; size?: number }[]; deploy: boolean; activePath: string };

function Compose({ data, busy, mutate, dialog, toast }: { data: ReturnType<typeof useApiData<Record<string, any>>>; busy: string; mutate: (endpoint: string, body: unknown, label: string, confirm?: { message: string; danger?: boolean }, method?: string) => Promise<Record<string, any> | undefined>; dialog: ReturnType<typeof useDialog>; toast: ReturnType<typeof useToast> }) {
  const [config, setConfig] = useState<ComposeEditor | null>(null);
  const items = asArray<Record<string, any>>(data.data?.projects);
  async function openConfig(project: string) {
    try {
      const out = await api<Record<string, any>>(`/api/v1/docker/compose/config?project=${encodeURIComponent(project)}`);
      const files = asArray<Record<string, any>>(out.files).map(item => ({ path: String(item.path || ''), content: String(item.content || ''), size: Number(item.size || 0) })).filter(item => item.path);
      if (!files.length) throw new Error('后端没有返回可编辑的 Compose 文件');
      setConfig({ project: String(out.project || project), working_dir: String(out.working_dir || ''), files, deploy: false, activePath: files[0]!.path });
    } catch (error) { await dialog.alert(errorText(error), '读取 Compose 配置失败'); }
  }
  async function saveConfig() {
    if (!config || !await dialog.confirm({ title: '保存 Compose 配置', message: `${config.project}\n后端会保存全部配置文件、执行 docker compose config 校验，并自动创建快照。${config.deploy ? '\n校验通过后将重新部署。' : ''}`, confirmText: config.deploy ? '保存并部署' : '保存并校验', danger: true })) return;
    try {
      const files = Object.fromEntries(config.files.map(file => [file.path, file.content]));
      const out = await secureApi<Record<string, any>>('/api/v1/docker/compose/config', { method: 'PUT', body: jsonBody({ project: config.project, files, deploy: config.deploy }) });
      if (out.output) await dialog.alert(String(out.output), 'Compose 校验输出');
      toast('Compose 配置已保存'); setConfig(null); await data.reload();
    } catch (error) { await dialog.alert(errorText(error), '保存失败'); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const service = {
      name: String(form.get('service') || '').trim(), image: String(form.get('image') || '').trim(), container_name: String(form.get('container_name') || '').trim(), restart: String(form.get('restart') || 'unless-stopped'),
      environment: parseLines(String(form.get('environment') || '')), ports: parseLines(String(form.get('ports') || '')), volumes: parseLines(String(form.get('volumes') || '')), command: parseLines(String(form.get('command') || '')),
    };
    const body = { project: String(form.get('project') || '').trim(), directory: String(form.get('directory') || '').trim(), services: [service], start: form.get('start') === 'on' };
    const out = await mutate('/api/v1/docker/compose/create', body, '创建 Compose 项目', { message: `${body.project}\n目录：${body.directory}` });
    if (out) event.currentTarget.reset();
  }
  const active = config?.files.find(file => file.path === config.activePath) || config?.files[0];
  return <>
    <Card><div className="card-heading"><div><strong>新建 Compose 项目</strong><p>向导会生成 compose.yaml；创建后可在下方编辑完整配置</p></div></div><form className="form-grid" onSubmit={create}><label>项目名<input name="project" required/></label><label>绝对目录<input name="directory" required placeholder="/opt/myapp"/></label><label>服务名<input name="service" required placeholder="app"/></label><label>镜像<input name="image" required placeholder="nginx:latest"/></label><label>容器名（可选）<input name="container_name"/></label><label>重启策略<select name="restart" defaultValue="unless-stopped"><option value="no">no</option><option value="always">always</option><option value="unless-stopped">unless-stopped</option><option value="on-failure">on-failure</option></select></label><label>环境变量（每行一项）<textarea name="environment" rows={4} placeholder="TZ=Asia/Shanghai"/></label><label>端口（每行一项）<textarea name="ports" rows={4} placeholder="8080:80"/></label><label>挂载（每行一项）<textarea name="volumes" rows={4} placeholder="./data:/data"/></label><label>命令参数（每行一个）<textarea name="command" rows={4}/></label><label className="checkbox"><input name="start" type="checkbox" defaultChecked/>创建后启动</label><div className="form-actions span-2"><Button tone="primary" type="submit" disabled={!!busy}>生成项目</Button></div></form></Card>
    {data.loading && !data.data ? <Loading/> : data.error && !data.data ? <ErrorState message={data.error} retry={data.reload}/> : items.length ? <Card className="resource-list">{items.map(item => <ResourceRow key={String(item.name)} title={String(item.name)} subtitle={String(item.working_dir || '')} meta={`${item.running || 0}/${item.total || 0} 个容器运行中 · ${asArray<string>(item.config_files).join(', ')}`} status={<Status value={Number(item.running) > 0 ? 'running' : 'stopped'}/>} actions={<><Button compact onClick={() => openConfig(String(item.name))}>编辑配置</Button><Button compact onClick={() => void mutate('/api/v1/docker/compose/action', { project: item.name, action: 'pull' }, '拉取 Compose 镜像')}>拉取</Button><Button compact onClick={() => void mutate('/api/v1/docker/compose/action', { project: item.name, action: 'up' }, '启动 Compose')}>启动</Button><Button compact onClick={() => void mutate('/api/v1/docker/compose/action', { project: item.name, action: 'restart' }, '重启 Compose', { message: String(item.name) })} disabled={!!busy}>重启</Button><Button compact tone="danger" onClick={() => void mutate('/api/v1/docker/compose/action', { project: item.name, action: 'down' }, '停止 Compose', { message: String(item.name), danger: true })} disabled={!!busy}>停止</Button></>}/>)}</Card> : <Card><EmptyState title="未识别到 Compose 项目" description="可以使用上方向导创建，或先通过 Docker CLI 启动一个带 Compose 标签的项目。"/></Card>}
    {config && active ? <div className="editor-overlay"><section className="editor-dialog"><header><div><strong>Compose 配置 · {config.project}</strong><small>{config.working_dir}</small></div><div><Button compact onClick={() => setConfig(null)}>关闭</Button><Button compact tone="primary" onClick={saveConfig}>保存</Button></div></header><div className="toolbar compose-file-tabs">{config.files.map(file => <Button key={file.path} compact tone={config.activePath === file.path ? 'primary' : 'secondary'} onClick={() => setConfig({ ...config, activePath: file.path })}>{file.path.split('/').pop()}</Button>)}</div><textarea value={active.content} onChange={event => setConfig({ ...config, files: config.files.map(file => file.path === active.path ? { ...file, content: event.target.value } : file) })} spellCheck={false}/><label className="checkbox editor-deploy"><input type="checkbox" checked={config.deploy} onChange={event => setConfig({ ...config, deploy: event.target.checked })}/>保存校验通过后重新部署</label></section></div> : null}
  </>;
}

function Networks({ data, busy, mutate }: { data: ReturnType<typeof useApiData<Record<string, any>>>; busy: string; mutate: (endpoint: string, body: unknown, label: string, confirm?: { message: string; danger?: boolean }) => Promise<Record<string, any> | undefined> }) {
  const items = asArray<Record<string, any>>(data.data?.networks);
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const out = await mutate('/api/v1/docker/networks/create', { name: form.get('name'), driver: form.get('driver'), subnet: form.get('subnet'), gateway: form.get('gateway'), internal: form.get('internal') === 'on' }, '创建网络'); if (out) event.currentTarget.reset(); }
  return <><Card><form className="form-grid" onSubmit={create}><label>网络名称<input name="name" required/></label><label>驱动<select name="driver" defaultValue="bridge"><option value="bridge">bridge</option><option value="macvlan">macvlan</option><option value="ipvlan">ipvlan</option></select></label><label>子网 CIDR<input name="subnet" placeholder="172.30.0.0/16"/></label><label>网关<input name="gateway" placeholder="172.30.0.1"/></label><label className="checkbox"><input name="internal" type="checkbox"/>内部网络</label><div className="form-actions span-2"><Button tone="primary" type="submit" disabled={!!busy}>创建网络</Button></div></form></Card>{data.loading && !data.data ? <Loading/> : data.error && !data.data ? <ErrorState message={data.error} retry={data.reload}/> : items.length ? <Card className="resource-list">{items.map(item => <ResourceRow key={String(item.id)} title={String(item.name)} subtitle={`${item.driver || '-'} · ${item.scope || '-'}`} meta={`${item.containers || 0} 个容器${item.internal ? ' · 内部网络' : ''}`} actions={['bridge', 'host', 'none'].includes(String(item.name)) ? undefined : <Button compact tone="danger" onClick={() => void mutate('/api/v1/docker/networks/delete', { id: item.id }, '删除网络', { message: String(item.name), danger: true })}>删除</Button>}/>)}</Card> : <Card><EmptyState/></Card>}</>;
}

function Volumes({ data, busy, mutate, dialog }: { data: ReturnType<typeof useApiData<Record<string, any>>>; busy: string; mutate: (endpoint: string, body: unknown, label: string, confirm?: { message: string; danger?: boolean }) => Promise<Record<string, any> | undefined>; dialog: ReturnType<typeof useDialog> }) {
  const [name, setName] = useState(''); const [usage, setUsage] = useState<Record<string, any>[]>([]); const items = asArray<Record<string, any>>(data.data?.volumes);
  useEffect(() => { api<Record<string, any>>('/api/v1/docker/volumes/usage').then(out => setUsage(asArray(out.volumes ?? out.usage))).catch(() => setUsage([])); }, [data.data]);
  const usageMap = useMemo(() => new Map(usage.map(item => [item.name, item])), [usage]);
  async function archive(item: Record<string, any>, action: 'backup' | 'restore') { const path = await dialog.prompt({ title: action === 'backup' ? '备份存储卷' : '恢复存储卷', message: action === 'backup' ? '输入授权目录中的目标 .tar.gz 路径。' : '输入授权目录中的 .tar.gz 备份路径。恢复会覆盖卷内同名文件。', placeholder: action === 'backup' ? `/root/${item.name}.tar.gz` : `/root/${item.name}.tar.gz`, required: true }); if (!path) return; await mutate('/api/v1/docker/volumes/archive', { action, name: item.name, path }, action === 'backup' ? '备份存储卷' : '恢复存储卷', action === 'restore' ? { message: `${item.name}\n${path}`, danger: true } : undefined); }
  return <><Card><form className="inline-form" onSubmit={event => { event.preventDefault(); if (name.trim()) void mutate('/api/v1/docker/volumes/create', { name: name.trim(), driver: 'local' }, '创建存储卷'); }}><label className="grow">存储卷名称<input value={name} onChange={event => setName(event.target.value)} required/></label><Button tone="primary" type="submit" disabled={!!busy}>创建</Button></form></Card>{data.loading && !data.data ? <Loading/> : data.error && !data.data ? <ErrorState message={data.error} retry={data.reload}/> : items.length ? <Card className="resource-list">{items.map(item => { const usageItem = usageMap.get(item.name) || {}; return <ResourceRow key={String(item.name)} title={String(item.name)} subtitle={`${item.driver || '-'} · ${item.scope || '-'}`} meta={`${formatBytes(usageItem.size || 0)} · ${usageItem.ref_count || 0} 个引用 · ${item.mountpoint || ''}`} actions={<><Button compact onClick={() => archive(item, 'backup')}>备份</Button><Button compact onClick={() => archive(item, 'restore')}>恢复</Button><Button compact tone="danger" onClick={() => void mutate('/api/v1/docker/volumes/delete', { name: item.name }, '删除存储卷', { message: `${item.name}\n仅允许删除未使用的卷。`, danger: true })}>删除</Button></>}/>; })}</Card> : <Card><EmptyState/></Card>}</>;
}

function Cleanup({ data, busy, mutate }: { data: ReturnType<typeof useApiData<Record<string, any>>>; busy: string; mutate: (endpoint: string, body: unknown, label: string, confirm?: { message: string; danger?: boolean }) => Promise<Record<string, any> | undefined> }) {
  const info = data.data ?? {};
  return data.loading && !data.data ? <Loading/> : data.error && !data.data ? <ErrorState message={data.error} retry={data.reload}/> : <Card><div className="card-heading"><div><strong>可清理资源预览</strong><p>安全模式仅删除已停止容器、悬空镜像和未使用网络，不删除存储卷。</p></div><strong>{formatBytes(info.reclaimable_bytes || 0)}</strong></div><div className="kpi-inline"><Card><strong>{String(info.stopped_containers || 0)}</strong><span>已停止容器</span></Card><Card><strong>{String(info.dangling_images || 0)}</strong><span>悬空镜像</span></Card><Card><strong>{String(info.unused_networks || 0)}</strong><span>未使用网络</span></Card><Card><strong>{String(info.unused_volumes || 0)}</strong><span>未使用卷</span></Card></div><div className="form-actions"><Button tone="danger" disabled={!!busy} onClick={() => void mutate('/api/v1/docker/cleanup', { mode: 'safe', include_volumes: false }, '安全清理', { message: `预计可释放 ${formatBytes(info.reclaimable_bytes || 0)}。不会删除存储卷。`, danger: true })}>开始安全清理</Button></div></Card>;
}
