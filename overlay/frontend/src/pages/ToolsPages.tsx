import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, apiBlob, errorText, jsonBody, secureApi } from '../lib/api';
import { asArray, downloadBlob, formatBytes, formatDate } from '../lib/format';
import { useApiData } from '../lib/useApiData';
import { useDialog } from '../components/Dialog';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Button, Card, CodeBlock, EmptyState, ErrorState, InfoList, Loading, PageHeader, ResourceRow, Status, Tabs } from '../components/UI';
import type { PageNavProps } from './SystemPages';

type ToolsTab = 'diagnostics' | 'backup' | 'jobs' | 'settings';

export function ToolsPage({ navigate, back }: PageNavProps) {
  const [tab, setTab] = useState<ToolsTab>('diagnostics');
  return <div className="page">
    <PageHeader title="常用工具" description="固定参数的诊断、备份、后台任务与面板设置" back={back}/>
    <Tabs value={tab} onChange={setTab} items={[
      { value: 'diagnostics', label: '网络诊断' }, { value: 'backup', label: '备份恢复' },
      { value: 'jobs', label: '后台任务' }, { value: 'settings', label: '面板设置' },
    ]}/>
    {tab === 'diagnostics' ? <Diagnostics/> : tab === 'backup' ? <Backups/> : tab === 'jobs' ? <Jobs/> : <Settings navigate={navigate}/>} 
  </div>;
}

function Diagnostics() {
  const [tool, setTool] = useState('ping');
  const [target, setTarget] = useState('1.1.1.1');
  const [port, setPort] = useState(443);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useDialog();
  async function run(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setResult(null);
    try {
      const out = await api<Record<string, any>>('/api/v1/tools/run', { method: 'POST', body: jsonBody({ tool, target, port }) });
      setResult(out);
    } catch (error) { await dialog.alert(errorText(error), '诊断失败'); }
    finally { setBusy(false); }
  }
  return <>
    <Card><form className="form-grid" onSubmit={run}>
      <label>工具<select value={tool} onChange={event => setTool(event.target.value)}><option value="ping">Ping</option><option value="dns">DNS 解析</option><option value="tcp">TCP 连通</option><option value="diagnostic">本机综合诊断</option><option value="http">HTTP 请求</option></select></label>
      <label>目标<input value={target} onChange={event => setTarget(event.target.value)} required={tool !== 'diagnostic'} disabled={tool === 'diagnostic'} placeholder={tool === 'http' ? 'https://example.com' : '域名或 IP'}/></label>
      {tool === 'tcp' ? <label>端口<input type="number" min="1" max="65535" value={port} onChange={event => setPort(Number(event.target.value))}/></label> : null}
      <div className="form-actions span-2"><Button tone="primary" type="submit" disabled={busy}><Icon name="play" size={17}/>{busy ? '执行中' : '开始诊断'}</Button></div>
    </form></Card>
    {result ? <Card><div className="card-heading"><strong>诊断结果</strong><Status value={result.success ?? result.ok ?? 'success'}/></div><CodeBlock value={result.output ?? result}/></Card> : <Card><EmptyState title="尚未执行诊断" description="工具和参数由服务端白名单校验，不执行任意 Shell。"/></Card>}
  </>;
}

function Backups() {
  const scheduled = useApiData<Record<string, any>>('/api/v1/backup/scheduled');
  const dialog = useDialog();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const items = asArray<Record<string, any>>(scheduled.data?.backups);

  async function exportBackup() {
    setBusy('export');
    try {
      const blob = await apiBlob('/api/v1/backup/export', {}, true);
      downloadBlob(blob, `lukepanel-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`);
      toast('面板备份已下载');
    } catch (error) { await dialog.alert(errorText(error), '导出失败'); }
    finally { setBusy(''); }
  }

  async function restore(file: File) {
    if (!await dialog.confirm({ title: '恢复面板备份', message: `${file.name}\n恢复会覆盖当前面板配置和数据，并使当前会话失效。`, confirmText: '恢复', danger: true })) return;
    const body = new FormData(); body.append('file', file);
    setBusy('import');
    try {
      const out = await secureApi<Record<string, any>>('/api/v1/backup/import', { method: 'POST', body });
      await dialog.alert(String(out.message || '备份已恢复，页面将重新载入。'), '恢复完成');
      location.reload();
    } catch (error) { await dialog.alert(errorText(error), '恢复失败'); }
    finally { setBusy(''); if (importRef.current) importRef.current.value = ''; }
  }

  async function scheduledAction(action: 'create' | 'delete', name = '') {
    if (action === 'delete' && !await dialog.confirm({ title: '删除计划备份', message: name, confirmText: '删除', danger: true })) return;
    setBusy(action);
    try {
      await secureApi('/api/v1/backup/scheduled', { method: 'POST', body: jsonBody({ action, name }) });
      toast(action === 'create' ? '计划备份已创建' : '计划备份已删除');
      await scheduled.reload();
    } catch (error) { await dialog.alert(errorText(error), action === 'create' ? '创建失败' : '删除失败'); }
    finally { setBusy(''); }
  }

  async function downloadScheduled(name: string) {
    setBusy(`download:${name}`);
    try {
      const blob = await apiBlob(`/api/v1/backup/scheduled?download=${encodeURIComponent(name)}`, {}, true);
      downloadBlob(blob, name);
    } catch (error) { await dialog.alert(errorText(error), '下载失败'); }
    finally { setBusy(''); }
  }

  return <>
    <Card>
      <div className="card-heading"><div><strong>完整面板备份</strong><p>包含 LukePanel 配置、审计源数据、文件历史、快照和回收站；不包含整台服务器。</p></div></div>
      <div className="toolbar"><Button tone="primary" onClick={exportBackup} disabled={!!busy}><Icon name="download" size={17}/>导出备份</Button><Button onClick={() => importRef.current?.click()} disabled={!!busy}><Icon name="upload" size={17}/>导入备份</Button><input ref={importRef} hidden type="file" accept=".tar.gz,.tgz" onChange={event => event.target.files?.[0] && restore(event.target.files[0])}/></div>
    </Card>
    <Card>
      <div className="card-heading"><div><strong>计划备份存档</strong><p>由固定 systemd 任务创建，当前服务端固定保留 {Number(scheduled.data?.retention ?? 7)} 份。</p></div><Button compact tone="primary" onClick={() => scheduledAction('create')} disabled={!!busy}>立即创建</Button></div>
      {scheduled.loading && !scheduled.data ? <Loading/> : scheduled.error && !scheduled.data ? <ErrorState message={scheduled.error} retry={scheduled.reload}/> : items.length ? <div className="resource-list">{items.map(item => <ResourceRow key={String(item.name)} title={String(item.name)} subtitle={formatBytes(item.size)} meta={formatDate(item.modified_at)} actions={<><Button compact onClick={() => downloadScheduled(String(item.name))} disabled={!!busy}>下载</Button><Button compact tone="danger" onClick={() => scheduledAction('delete', String(item.name))} disabled={!!busy}>删除</Button></>}/>)}</div> : <EmptyState title="暂无计划备份" description="可立即创建，或在计划任务中添加“面板备份”任务。"/>}
    </Card>
  </>;
}

function Jobs() {
  const data = useApiData<Record<string, any>>('/api/v1/jobs', { pollMs: 3000 });
  const dialog = useDialog();
  const items = asArray<Record<string, any>>(data.data?.jobs);
  if (data.loading && !data.data) return <Loading/>;
  if (data.error && !data.data) return <ErrorState message={data.error} retry={data.reload}/>;
  return items.length ? <Card className="resource-list">{items.map(item => <ResourceRow
    key={String(item.id)} title={String(item.title || item.action || item.id)} subtitle={String(item.message || item.target || '')}
    meta={`${formatDate(item.created_at)}${item.progress !== undefined ? ` · ${item.progress}%` : ''}`} status={<Status value={item.status}/>} actions={item.output ? <Button compact onClick={() => dialog.alert(String(item.output), '任务输出')}>查看输出</Button> : undefined}/>)}</Card> : <Card><EmptyState title="暂无后台任务"/></Card>;
}

function Settings({ navigate }: { navigate: (path: string) => void }) {
  const data = useApiData<Record<string, any>>('/api/v1/settings');
  const dialog = useDialog(); const toast = useToast();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      await secureApi('/api/v1/settings', { method: 'PATCH', body: jsonBody({ auto_refresh_seconds: Number(form.get('auto_refresh_seconds')) }) });
      toast('面板设置已保存'); await data.reload();
    } catch (error) { await dialog.alert(errorText(error), '保存失败'); }
  }
  if (data.loading && !data.data) return <Loading/>;
  if (data.error && !data.data) return <ErrorState message={data.error} retry={data.reload}/>;
  const value = data.data ?? {};
  return <>
    <Card><InfoList rows={[["版本", String(value.version || '-')], ["监听地址", String(value.listen || '-')], ["HTTPS Cookie", value.secure_cookie ? '已启用' : '未启用'], ["Agent Socket", String(value.agent_socket || '-')], ["管理员", String(value.admin_user || '-')], ["允许根目录", asArray<string>(value.allowed_roots).join(', ') || '/']]}/></Card>
    <Card><form className="stack-form" onSubmit={save}><label>自动刷新间隔（秒）<input name="auto_refresh_seconds" type="number" min="2" max="300" defaultValue={Number(value.auto_refresh_seconds ?? 10)}/></label><Button tone="primary" type="submit">保存</Button></form></Card>
    <Card><div className="card-heading"><div><strong>GitHub 助手</strong><p>授权仅保存在当前服务会话内，服务重启后清除。</p></div></div><Button onClick={() => navigate('/github')}>打开 GitHub 助手</Button></Card>
  </>;
}

export function GitHubPage({ back }: PageNavProps) {
  const auth = useApiData<Record<string, any>>('/api/v1/github/auth/status');
  const [owner, setOwner] = useState(''); const [repo, setRepo] = useState('');
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [flow, setFlow] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState('');
  const dialog = useDialog(); const toast = useToast();

  useEffect(() => {
    if (!flow?.flow_id) return;
    let stopped = false;
    const poll = async () => {
      try {
        const out = await api<Record<string, any>>('/api/v1/github/auth/device/poll', { method: 'POST', body: jsonBody({ flow_id: flow.flow_id }) });
        if (stopped) return;
        if (out.connected || out.status === 'authorized') {
          setFlow(null); toast('GitHub 已连接'); await auth.reload(); return;
        }
        if (out.status === 'expired' || out.status === 'denied') {
          setFlow(null); await dialog.alert(String(out.message || `GitHub 授权${out.status === 'expired' ? '已过期' : '被拒绝'}`), '授权未完成'); return;
        }
        window.setTimeout(poll, Math.max(1, Number(out.retry_after ?? flow.interval ?? 5)) * 1000);
      } catch (error) {
        if (!stopped) { setFlow(null); await dialog.alert(errorText(error), 'GitHub 授权失败'); }
      }
    };
    const timer = window.setTimeout(poll, Math.max(1, Number(flow.interval ?? 5)) * 1000);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [flow?.flow_id]);

  async function connect() {
    setBusy('connect');
    try {
      const out = await api<Record<string, any>>('/api/v1/github/auth/device/start', { method: 'POST', body: jsonBody({}) });
      setFlow(out); if (out.user_code) await navigator.clipboard.writeText(String(out.user_code));
    } catch (error) { await dialog.alert(errorText(error), '无法开始授权'); }
    finally { setBusy(''); }
  }

  async function cancelFlow() {
    if (!flow?.flow_id) return;
    try { await api('/api/v1/github/auth/device/cancel', { method: 'POST', body: jsonBody({ flow_id: flow.flow_id }) }); } finally { setFlow(null); }
  }

  async function tokenConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy('token');
    try { await api('/api/v1/github/auth/token', { method: 'POST', body: jsonBody({ token: form.get('token') }) }); event.currentTarget.reset(); toast('GitHub 已连接'); await auth.reload(); }
    catch (error) { await dialog.alert(errorText(error), 'Token 连接失败'); }
    finally { setBusy(''); }
  }

  async function disconnect() {
    if (!await dialog.confirm({ title: '断开 GitHub', message: '当前服务会话中的 GitHub 凭据会立即清除。', confirmText: '断开', danger: true })) return;
    try { await secureApi('/api/v1/github/auth/disconnect', { method: 'POST', body: jsonBody({}) }); setSummary(null); await auth.reload(); toast('已断开 GitHub'); }
    catch (error) { await dialog.alert(errorText(error), '断开失败'); }
  }

  async function fetchSummary() {
    if (!owner.trim() || !repo.trim()) return;
    setBusy('summary');
    try { setSummary(await api<Record<string, any>>(`/api/v1/github/summary?owner=${encodeURIComponent(owner.trim())}&repo=${encodeURIComponent(repo.trim())}`)); }
    catch (error) { await dialog.alert(errorText(error), '读取仓库失败'); }
    finally { setBusy(''); }
  }

  async function mutation(endpoint: string, body: unknown, label: string) {
    setBusy(endpoint);
    try {
      const out = await secureApi<Record<string, any>>(endpoint, { method: 'POST', body: body instanceof FormData ? body : jsonBody(body) });
      toast(`${label}完成`); await fetchSummary(); return out;
    } catch (error) { await dialog.alert(errorText(error), `${label}失败`); }
    finally { setBusy(''); }
  }

  const connected = !!auth.data?.connected;
  return <div className="page">
    <PageHeader title="GitHub 助手" description="Device Flow 或临时 Token 授权；Token 不返回前端、不写审计日志" back={back} actions={connected ? <Button compact tone="danger" onClick={disconnect}>断开</Button> : undefined}/>
    {auth.loading && !auth.data ? <Loading/> : auth.error && !auth.data ? <ErrorState message={auth.error} retry={auth.reload}/> : !connected ? <>
      <Card className="github-connect"><Icon name="github" size={42}/><div><strong>连接 GitHub</strong><p>推荐 Device Flow。授权码已自动复制，凭据只保存在服务内存。</p></div><Button tone="primary" onClick={connect} disabled={busy === 'connect' || !auth.data?.device_login_available}>生成设备码</Button>
        {flow ? <div className="device-flow"><strong>{String(flow.user_code || '')}</strong><p>访问 GitHub Device 页面并输入上方代码。</p>{flow.verification_uri ? <a href={String(flow.verification_uri)} target="_blank" rel="noreferrer">打开授权页面</a> : null}<span>正在等待授权…</span><Button compact onClick={cancelFlow}>取消</Button></div> : null}
      </Card>
      <Card><div className="card-heading"><div><strong>Personal Access Token</strong><p>只在 Device Flow 不可用时使用；连接后只存于当前服务内存。</p></div></div><form className="inline-form" onSubmit={tokenConnect}><label className="grow">Token<input name="token" type="password" autoComplete="off" required minLength={20}/></label><Button type="submit" disabled={busy === 'token'}>临时连接</Button></form></Card>
    </> : <>
      <Card><div className="card-heading"><div><strong>{String(auth.data?.name || auth.data?.login)}</strong><p>@{String(auth.data?.login || '')} · {String(auth.data?.scope || '')}</p></div><Status value="active" label="已连接"/></div></Card>
      <Card><form className="inline-form" onSubmit={event => { event.preventDefault(); void fetchSummary(); }}><label>所有者<input value={owner} onChange={event => setOwner(event.target.value)} placeholder="Luke-Lab666" required/></label><label className="grow">仓库<input value={repo} onChange={event => setRepo(event.target.value)} placeholder="LukePanel" required/></label><Button tone="primary" type="submit" disabled={busy === 'summary'}>读取仓库</Button></form></Card>
      {summary ? <Repository summary={summary} owner={owner} repo={repo} mutation={mutation} busy={busy} dialog={dialog}/> : <Card><EmptyState title="尚未选择仓库"/></Card>}
    </>}
  </div>;
}

function Repository({ summary, owner, repo, mutation, busy, dialog }: { summary: Record<string, any>; owner: string; repo: string; mutation: (endpoint: string, body: unknown, label: string) => Promise<Record<string, any> | undefined>; busy: string; dialog: ReturnType<typeof useDialog> }) {
  const branches = asArray<Record<string, any>>(summary.branches);
  const runs = asArray<Record<string, any>>(summary.workflow_runs);
  const pulls = asArray<Record<string, any>>(summary.pull_requests);
  const tags = asArray<Record<string, any>>(summary.tags);
  const importRef = useRef<HTMLInputElement>(null);
  const assetRef = useRef<HTMLInputElement>(null);
  const [assetTag, setAssetTag] = useState('');

  async function createPR() {
    const head = await dialog.prompt({ title: '创建 Pull Request', message: `目标分支：${summary.default_branch}`, placeholder: 'feature/name', required: true });
    if (!head) return;
    const title = await dialog.prompt({ title: 'PR 标题', required: true }); if (!title) return;
    const body = await dialog.prompt({ title: 'PR 说明', message: '可留空。', value: '' });
    await mutation('/api/v1/github/pull', { owner, repo, title, body: body || '', head, base: summary.default_branch }, '创建 Pull Request');
  }

  async function createRelease() {
    const tag = await dialog.prompt({ title: '创建 Release', placeholder: 'v2.0.0', required: true }); if (!tag) return;
    const name = await dialog.prompt({ title: 'Release 名称', value: tag, required: true }); if (!name) return;
    const body = await dialog.prompt({ title: 'Release 说明', value: '' });
    await mutation('/api/v1/github/release', { owner, repo, tag, name, body: body || '', draft: false, prerelease: false }, '创建 Release');
  }

  async function showJobs(runID: number) {
    try {
      const out = await api<Record<string, any>>(`/api/v1/github/actions/jobs?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&run_id=${runID}`);
      const jobs = asArray<Record<string, any>>(out.jobs);
      if (!jobs.length) { await dialog.alert('这个 Actions Run 没有 Job 数据。', 'Actions Jobs'); return; }
      const text = jobs.map(job => `${job.id} · ${job.name}\n${job.status} / ${job.conclusion || '-'}\n${job.started_at || ''}`).join('\n\n');
      await dialog.alert(text, `Run #${runID} Jobs`);
    } catch (error) { await dialog.alert(errorText(error), '读取 Jobs 失败'); }
  }

  async function showJobLogs() {
    const id = await dialog.prompt({ title: '读取 Job 日志', message: '输入 Actions Job ID。可先在某个 Run 中查看 Jobs。', required: true });
    if (!id) return;
    try {
      const out = await api<Record<string, any>>(`/api/v1/github/actions/job-logs?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&job_id=${encodeURIComponent(id)}`);
      await dialog.alert(String(out.logs || '暂无日志'), `Job #${id} 日志`);
    } catch (error) { await dialog.alert(errorText(error), '读取日志失败'); }
  }

  async function importZip(file: File) {
    const branch = await dialog.prompt({ title: 'ZIP 推送目标分支', value: String(summary.default_branch || 'main'), required: true }); if (!branch) return;
    const form = new FormData(); form.append('owner', owner); form.append('repo', repo); form.append('branch', branch); form.append('file', file);
    try {
      const plan = await api<Record<string, any>>('/api/v1/github/import/preview', { method: 'POST', body: form });
      const confirmed = await dialog.confirm({ title: '确认 ZIP 推送', message: `新增 ${plan.added ?? 0} · 修改 ${plan.modified ?? 0} · 不变 ${plan.unchanged ?? 0}\n目标：${owner}/${repo}:${branch}`, confirmText: '提交', danger: true });
      if (!confirmed) return;
      const message = await dialog.prompt({ title: '提交信息', value: 'Update files from LukePanel', required: true }); if (!message) return;
      await mutation('/api/v1/github/import/commit', { plan_id: plan.id ?? plan.plan_id, message }, '提交 ZIP');
    } catch (error) { await dialog.alert(errorText(error), 'ZIP 推送失败'); }
    finally { if (importRef.current) importRef.current.value = ''; }
  }

  async function listReleaseAssets() {
    const tag = await dialog.prompt({ title: '查看 Release 附件', value: String(summary.latest_release?.tag_name || ''), placeholder: 'v2.0.0', required: true });
    if (!tag) return;
    try {
      const out = await api<Record<string, any>>(`/api/v1/github/release/assets?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&tag=${encodeURIComponent(tag)}`);
      const assets = asArray<Record<string, any>>(out.assets);
      await dialog.alert(
        assets.length
          ? assets.map(item => `${item.name || '-'}\n${formatBytes(item.size || 0)} · ${item.download_count || 0} 次下载`).join('\n\n')
          : '这个 Release 没有附件。',
        `${tag} 附件`,
      );
    } catch (error) { await dialog.alert(errorText(error), '读取附件失败'); }
  }

  async function chooseReleaseAsset() {
    const tag = await dialog.prompt({ title: '上传 Release 附件', value: String(summary.latest_release?.tag_name || ''), placeholder: 'v2.0.0', required: true });
    if (!tag) return;
    setAssetTag(tag);
    window.setTimeout(() => assetRef.current?.click(), 0);
  }

  async function uploadReleaseAsset(file: File) {
    if (!assetTag) return;
    const form = new FormData();
    form.append('owner', owner); form.append('repo', repo); form.append('tag', assetTag); form.append('file', file);
    try { await mutation('/api/v1/github/release/assets/upload', form, '上传 Release 附件'); }
    finally { setAssetTag(''); if (assetRef.current) assetRef.current.value = ''; }
  }


  return <>
    <div className="kpi-inline"><Card><strong>{String(summary.default_branch || '-')}</strong><span>默认分支</span></Card><Card><strong>{branches.length}</strong><span>分支</span></Card><Card><strong>{pulls.length}</strong><span>Pull Requests</span></Card><Card><strong>{runs.length}</strong><span>Actions Runs</span></Card></div>
    <Card>
      <div className="card-heading"><div><strong>{summary.full_name || `${owner}/${repo}`}</strong><p>{String(summary.description || '无仓库描述')}</p></div><Status value={summary.visibility || 'public'}/></div>
      <InfoList rows={[["主分支 SHA", String(summary.main_sha || '-').slice(0, 12)], ["最近更新", formatDate(summary.updated_at)], ["最新 Release", String(summary.latest_release?.tag_name || '无')], ["Tags", String(tags.length)]]}/>
      <div className="toolbar">
        <Button onClick={async () => { const name = await dialog.prompt({ title: '创建分支', placeholder: 'feature/name', required: true }); if (name) void mutation('/api/v1/github/branch', { owner, repo, name, source: summary.default_branch }, '创建分支'); }}>创建分支</Button>
        <Button onClick={async () => { const tag = await dialog.prompt({ title: '创建 Tag', placeholder: 'v2.0.0', required: true }); if (tag) void mutation('/api/v1/github/tag', { owner, repo, tag, targetSHA: '', token: '' }, '创建 Tag'); }}>创建 Tag</Button>
        <Button onClick={createPR}>创建 PR</Button><Button onClick={createRelease}>创建 Release</Button><Button onClick={listReleaseAssets}>查看附件</Button><Button onClick={chooseReleaseAsset}>上传附件</Button><input ref={assetRef} hidden type="file" onChange={event => event.target.files?.[0] && uploadReleaseAsset(event.target.files[0])}/><Button onClick={showJobLogs}>读取 Job 日志</Button>
        <Button onClick={() => importRef.current?.click()}>ZIP 推送</Button><input ref={importRef} hidden type="file" accept=".zip" onChange={event => event.target.files?.[0] && importZip(event.target.files[0])}/>
      </div>
    </Card>
    {runs.length ? <Card className="resource-list">{runs.slice(0, 20).map(item => <ResourceRow key={String(item.id)} title={String(item.name || `Run #${item.id}`)} subtitle={String(item.head_branch || item.event || '')} meta={`${item.conclusion || item.status || '-'} · ${formatDate(item.created_at)}`} status={<Status value={item.conclusion || item.status}/>} actions={<><Button compact onClick={() => showJobs(Number(item.id))}>Jobs</Button>{item.conclusion === 'failure' ? <Button compact onClick={() => mutation('/api/v1/github/rerun', { owner, repo, run_id: Number(item.id), token: '' }, '重新运行失败任务')} disabled={!!busy}>重跑失败任务</Button> : null}</>}/>)}</Card> : null}
    {pulls.length ? <Card className="resource-list">{pulls.map(item => <ResourceRow key={String(item.number)} title={`#${item.number} ${item.title}`} subtitle={`${item.head || '-'} → ${item.base || '-'}`} meta={`${item.draft ? '草稿 · ' : ''}${String(item.head_sha || '').slice(0, 12)}`} status={<Status value={item.state}/>} actions={<Button compact tone="primary" onClick={async () => { if (!await dialog.confirm({ title: `合并 PR #${item.number}`, message: `${item.head} → ${item.base}\n将使用 squash，并校验当前 Head SHA。`, confirmText: '合并', danger: true })) return; void mutation('/api/v1/github/pull/merge', { owner, repo, number: Number(item.number), expected_sha: item.head_sha, method: 'squash' }, '合并 Pull Request'); }}>Squash 合并</Button>}/>)}</Card> : null}
  </>;
}
