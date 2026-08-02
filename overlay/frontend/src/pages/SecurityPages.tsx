import { useEffect, useState, type FormEvent } from 'react';
import { api, errorText, jsonBody, secureApi } from '../lib/api';
import { asArray, downloadBlob, formatDate } from '../lib/format';
import { publicKeyCreationOptions, serializeCreation } from '../lib/webauthn';
import { useApiData } from '../lib/useApiData';
import { useDialog } from '../components/Dialog';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Button, Card, CodeBlock, EmptyState, ErrorState, InfoList, Loading, PageHeader, ResourceRow, Status, Tabs } from '../components/UI';
import type { PageNavProps } from './SystemPages';

type SecurityTab = 'overview' | 'firewall' | 'fail2ban' | 'access' | 'account';
type DataState = ReturnType<typeof useApiData<Record<string, any>>>;
type ConfirmOptions = { message: string; danger?: boolean };
type Mutation = (endpoint: string, body: unknown, label: string, confirm?: ConfirmOptions, method?: string) => Promise<Record<string, any> | undefined>;

export function SecurityPage({ back }: PageNavProps) {
  const [tab, setTab] = useState<SecurityTab>('overview');
  const status = useApiData<Record<string, any>>('/api/v1/security/status');
  const firewall = useApiData<Record<string, any>>(tab === 'firewall' ? '/api/v1/security/firewall' : null, { deps: [tab] });
  const fail2ban = useApiData<Record<string, any>>(tab === 'fail2ban' ? '/api/v1/security/fail2ban' : null, { deps: [tab] });
  const allowlist = useApiData<Record<string, any>>(tab === 'access' ? '/api/v1/security/ip-allowlist' : null, { deps: [tab] });
  const sessions = useApiData<Record<string, any>>(tab === 'account' ? '/api/v1/auth/sessions' : null, { deps: [tab] });
  const totp = useApiData<Record<string, any>>(tab === 'account' ? '/api/v1/auth/totp/status' : null, { deps: [tab] });
  const passkeys = useApiData<Record<string, any>>(tab === 'account' ? '/api/v1/auth/passkeys' : null, { deps: [tab] });
  const devices = useApiData<Record<string, any>>(tab === 'account' ? '/api/v1/auth/trusted-devices' : null, { deps: [tab] });
  const notifications = useApiData<Record<string, any>>(tab === 'account' ? '/api/v1/security/login-notifications' : null, { deps: [tab] });
  const dialog = useDialog();
  const toast = useToast();
  const [busy, setBusy] = useState('');

  async function reloadAll() {
    await Promise.all([
      status.reload(), firewall.reload(), fail2ban.reload(), allowlist.reload(), sessions.reload(),
      totp.reload(), passkeys.reload(), devices.reload(), notifications.reload(),
    ]);
  }

  const mutate: Mutation = async (endpoint, body, label, confirm, method = 'POST') => {
    if (confirm && !await dialog.confirm({ title: label, message: confirm.message, confirmText: label, danger: confirm.danger })) return;
    setBusy(endpoint);
    try {
      const out = await secureApi<Record<string, any>>(endpoint, {
        method,
        body: body === null ? undefined : jsonBody(body),
      });
      toast(String(out.message || `${label}完成`));
      await reloadAll();
      return out;
    } catch (error) {
      await dialog.alert(errorText(error), `${label}失败`);
    } finally {
      setBusy('');
    }
  };

  return <div className="page">
    <PageHeader
      title="安全中心"
      description="所有高风险操作均由服务端强制二次验证，并写入审计日志"
      back={back}
      actions={<Button compact onClick={reloadAll}><Icon name="refresh" size={17}/>刷新</Button>}
    />
    <Tabs value={tab} onChange={setTab} items={[
      { value: 'overview', label: '安全体检' },
      { value: 'firewall', label: '防火墙' },
      { value: 'fail2ban', label: 'Fail2ban' },
      { value: 'access', label: '访问控制' },
      { value: 'account', label: '账户安全' },
    ]}/>
    {tab === 'overview' ? <SecurityOverview data={status} mutate={mutate} busy={busy}/> : null}
    {tab === 'firewall' ? <Firewall data={firewall} mutate={mutate} busy={busy}/> : null}
    {tab === 'fail2ban' ? <Fail2ban data={fail2ban} mutate={mutate} busy={busy}/> : null}
    {tab === 'access' ? <AccessControl data={allowlist} busy={busy}/> : null}
    {tab === 'account' ? <AccountSecurity sessions={sessions} totp={totp} passkeys={passkeys} devices={devices} notifications={notifications} mutate={mutate} busy={busy}/> : null}
  </div>;
}

function SecurityOverview({ data, mutate, busy }: { data: DataState; mutate: Mutation; busy: string }) {
  if (data.loading && !data.data) return <Loading/>;
  if (data.error && !data.data) return <ErrorState message={data.error} retry={data.reload}/>;
  const value = data.data ?? {};
  const checks = asArray<Record<string, any>>(value.checks ?? value.items);
  return <>
    <div className="kpi-inline">
      <Card><strong>{String(value.score ?? '-')}</strong><span>安全评分</span></Card>
      <Card><strong>{String(value.critical ?? value.high_risk ?? 0)}</strong><span>高风险项</span></Card>
      <Card><strong>{String(value.warnings ?? 0)}</strong><span>建议项</span></Card>
    </div>
    {checks.length ? <Card className="resource-list">{checks.map((item, index) => <ResourceRow
      key={`${item.id || item.name}-${index}`}
      title={String(item.title || item.name || '检查项')}
      subtitle={String(item.description || item.detail || '')}
      meta={String(item.recommendation || '')}
      status={<Status value={item.status || item.result}/>} />)}</Card> : <Card><InfoList rows={Object.entries(value).filter(([, item]) => typeof item !== 'object').slice(0, 16).map(([key, item]) => [key, String(item)])}/></Card>}
    <Card>
      <div className="card-heading"><div><strong>自动安全更新</strong><p>启用 unattended-upgrades，只安装安全更新，不自动重启服务器。</p></div></div>
      <Button tone="primary" disabled={!!busy} onClick={() => mutate('/api/v1/security/auto-updates/enable', {}, '启用自动安全更新')}>启用安全更新</Button>
    </Card>
  </>;
}

function Firewall({ data, mutate, busy }: { data: DataState; mutate: Mutation; busy: string }) {
  const value = data.data ?? {};
  const rules = asArray<Record<string, any>>(value.rules);
  if (data.loading && !data.data) return <Loading/>;
  if (data.error && !data.data) return <ErrorState message={data.error} retry={data.reload}/>;
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void mutate('/api/v1/security/firewall/rule', {
      operation: 'add',
      rule: {
        action: form.get('action'), direction: form.get('direction'), protocol: form.get('protocol'),
        port: String(form.get('port') || ''), from: String(form.get('from') || ''), comment: String(form.get('comment') || ''),
      },
    }, '添加规则');
  }
  return <>
    <Card>
      <div className="card-heading"><div><strong>UFW 状态</strong><p>{String(value.error || '规则变更后立即重新读取系统真实状态')}</p></div><Status value={value.enabled}/></div>
      <div className="toolbar">
        {value.installed === false ? <Button tone="primary" disabled={!!busy} onClick={() => mutate('/api/v1/security/firewall/install', {}, '安装 UFW')}>安装 UFW</Button> : value.enabled ? <>
          <Button tone="danger" disabled={!!busy} onClick={() => mutate('/api/v1/security/firewall/disable', {}, '关闭防火墙', { message: '关闭后服务器端口将失去 UFW 保护。', danger: true })}>关闭防火墙</Button>
          {value.recovery_pending ? <Button tone="primary" onClick={() => mutate('/api/v1/security/firewall/confirm', {}, '确认防火墙可用')}>确认连接正常</Button> : null}
        </> : <Button tone="primary" disabled={!!busy} onClick={() => mutate('/api/v1/security/firewall/enable', {}, '启用防火墙', { message: '后端会先保留当前来源 IP 和 SSH 端口，并创建限时恢复窗口。' })}>安全启用</Button>}
      </div>
    </Card>
    <Card><form className="firewall-form" onSubmit={add}>
      <label>动作<select name="action"><option value="allow">允许</option><option value="deny">拒绝</option><option value="reject">拒绝并响应</option><option value="limit">限速</option></select></label>
      <label>方向<select name="direction"><option value="in">入站</option><option value="out">出站</option></select></label>
      <label>协议<select name="protocol"><option value="tcp">TCP</option><option value="udp">UDP</option><option value="any">全部</option></select></label>
      <label>端口或范围<input name="port" placeholder="22 或 8000:9000"/></label>
      <label>来源地址<input name="from" placeholder="any 或 192.0.2.0/24" defaultValue="any"/></label>
      <label>备注<input name="comment" maxLength={80}/></label>
      <div className="form-actions span-2"><Button tone="primary" type="submit" disabled={!!busy}><Icon name="plus" size={17}/>添加规则</Button></div>
    </form></Card>
    {rules.length ? <Card className="resource-list firewall-rules">{rules.map((rule, index) => <ResourceRow
      key={String(rule.number ?? index)}
      title={`#${rule.number ?? index + 1} · ${rule.action || rule.to || '规则'}`}
      subtitle={`${rule.direction || ''} ${rule.protocol || ''} ${rule.port || rule.to || ''}`.trim()}
      meta={`${rule.from || 'any'}${rule.comment ? ` · ${rule.comment}` : ''}`}
      status={<Status value={rule.enabled ?? true}/>} actions={<Button compact tone="danger" onClick={() => mutate('/api/v1/security/firewall/rule', { operation: 'delete', number: Number(rule.number) }, '删除规则', { message: `规则 #${rule.number}`, danger: true })}>删除</Button>}/>)}</Card> : <Card><EmptyState title="暂无自定义规则"/></Card>}
  </>;
}

function Fail2ban({ data, mutate, busy }: { data: DataState; mutate: Mutation; busy: string }) {
  if (data.loading && !data.data) return <Loading/>;
  if (data.error && !data.data) return <ErrorState message={data.error} retry={data.reload}/>;
  const value = data.data ?? {};
  const banned = asArray<string>(value.banned_ips);
  const ignored = asArray<string>(value.ignore_ips);
  return <>
    <Card>
      <div className="card-heading"><div><strong>Fail2ban · {String(value.jail || 'sshd')}</strong><p>{String(value.error || 'SSH 暴力破解防护')}</p></div><Status value={value.active}/></div>
      <InfoList rows={[
        ['已安装', value.installed ? '是' : '否'], ['当前失败', String(value.currently_failed ?? 0)],
        ['累计失败', String(value.total_failed ?? 0)], ['当前封禁', String(value.currently_banned ?? 0)], ['累计封禁', String(value.total_banned ?? 0)],
      ]}/>
      {!value.installed ? <Button tone="primary" disabled={!!busy} onClick={() => mutate('/api/v1/security/fail2ban/install', {}, '安装 Fail2ban')}>安装并保护当前 IP</Button> : null}
    </Card>
    <Card>
      <div className="card-heading"><strong>当前封禁</strong><span>{banned.length}</span></div>
      {banned.length ? <div className="resource-list">{banned.map(ip => <ResourceRow key={ip} title={ip} subtitle="sshd" actions={<Button compact onClick={() => mutate('/api/v1/security/fail2ban/unban', { ip }, `解封 ${ip}`)}>解封</Button>}/>)}</div> : <EmptyState title="当前没有封禁 IP"/>}
    </Card>
    <Card>
      <div className="card-heading"><strong>永久忽略地址</strong><span>{ignored.length}</span></div>
      <form className="inline-form" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate('/api/v1/security/fail2ban/ignore', { entry: form.get('entry'), action: 'add' }, '加入白名单'); event.currentTarget.reset(); }}>
        <label className="grow">IP 或 CIDR<input name="entry" placeholder="192.0.2.10 或 192.0.2.0/24" required/></label><Button type="submit" disabled={!!busy}>加入白名单</Button>
      </form>
      {ignored.length ? <div className="resource-list">{ignored.map(entry => <ResourceRow key={entry} title={entry} actions={<Button compact tone="danger" onClick={() => mutate('/api/v1/security/fail2ban/ignore', { entry, action: 'remove' }, '移除白名单', { message: entry, danger: true })}>移除</Button>}/>)}</div> : null}
    </Card>
  </>;
}

function AccessControl({ data, busy }: { data: DataState; busy: string }) {
  const dialog = useDialog();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [recoveryPath, setRecoveryPath] = useState('');
  if (data.loading && !data.data) return <Loading/>;
  if (data.error && !data.data) return <ErrorState message={data.error} retry={data.reload}/>;
  const value = data.data ?? {};
  const entries = asArray<string>(value.entries);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const enabled = form.get('enabled') === 'on';
    const list = String(form.get('entries') || '').split(/\s+/).filter(Boolean);
    if (!await dialog.confirm({ title: '保存访问控制', message: enabled ? '当前来源 IP 会由后端自动加入。请保存随后显示的 15 分钟恢复地址。' : '将关闭面板 IP 允许列表。', confirmText: '保存', danger: enabled })) return;
    setSaving(true);
    try {
      const out = await secureApi<Record<string, any>>('/api/v1/security/ip-allowlist', { method: 'POST', body: jsonBody({ enabled, entries: list }) });
      const path = String(out.recovery_path || '');
      setRecoveryPath(path ? `${location.origin}${path}` : '');
      toast('访问控制已保存');
      await data.reload();
    } catch (error) {
      await dialog.alert(errorText(error), '保存失败');
    } finally {
      setSaving(false);
    }
  }
  return <Card>
    <div className="card-heading"><div><strong>面板 IP 允许列表</strong><p>启用后仅清单内地址可访问；当前来源 IP 自动保留，并生成 15 分钟恢复地址。</p></div><Status value={value.enabled}/></div>
    <InfoList rows={[["当前访问 IP", String(value.current_ip || '-')], ["恢复窗口", value.recovery_active ? '进行中' : '未开启']]}/>
    <form className="stack-form" onSubmit={save} key={`${value.enabled}-${entries.join(',')}`}>
      <label className="toggle"><input name="enabled" type="checkbox" defaultChecked={!!value.enabled}/><span>启用 IP 允许列表</span></label>
      <label>允许的 IP 或 CIDR<textarea name="entries" rows={7} defaultValue={entries.join('\n')} placeholder="每行一个地址"/></label>
      <Button tone="primary" type="submit" disabled={saving || !!busy}>保存并验证</Button>
    </form>
    {recoveryPath ? <><p className="field-note">恢复地址只在本次保存后显示，请立刻安全保存。</p><CodeBlock value={recoveryPath}/></> : null}
  </Card>;
}

function AccountSecurity({ sessions, totp, passkeys, devices, notifications, mutate, busy }: { sessions: DataState; totp: DataState; passkeys: DataState; devices: DataState; notifications: DataState; mutate: Mutation; busy: string }) {
  const dialog = useDialog();
  const toast = useToast();
  const sessionItems = asArray<Record<string, any>>(sessions.data?.sessions);
  const keyItems = asArray<Record<string, any>>(passkeys.data?.passkeys);
  const deviceItems = asArray<Record<string, any>>(devices.data?.devices);

  async function setupTOTP() {
    try {
      const out = await secureApi<Record<string, any>>('/api/v1/auth/totp/setup', { method: 'POST', body: jsonBody({}) });
      const code = await dialog.prompt({ title: '启用 TOTP', message: `密钥：${out.secret || ''}\n\n恢复码已由服务端生成，确认验证码后会再次展示。`, placeholder: '123456', required: true });
      if (!code) return;
      await secureApi('/api/v1/auth/totp/confirm', { method: 'POST', body: jsonBody({ code }) });
      await dialog.alert(`恢复码只显示一次，请立即保存：\n\n${asArray<string>(out.recovery_codes).join('\n')}`, 'TOTP 已启用');
      await totp.reload();
    } catch (error) {
      await dialog.alert(errorText(error), '启用失败');
    }
  }

  async function totpCode(title: string) {
    return dialog.prompt({ title, message: '请输入当前 6 位验证码或一个未使用的恢复码。', placeholder: '123456', required: true });
  }

  async function regenerateRecovery() {
    const code = await totpCode('重新生成恢复码');
    if (!code) return;
    if (!await dialog.confirm({ title: '确认重新生成', message: '旧恢复码会立即失效。', confirmText: '重新生成', danger: true })) return;
    try {
      const out = await secureApi<Record<string, any>>('/api/v1/auth/totp/recovery', { method: 'POST', body: jsonBody({ code }) });
      await dialog.alert(`新恢复码只显示一次：\n\n${asArray<string>(out.recovery_codes).join('\n')}`, '恢复码已更新');
      await totp.reload();
    } catch (error) {
      await dialog.alert(errorText(error), '生成失败');
    }
  }

  async function disableTOTP() {
    const code = await totpCode('关闭 TOTP');
    if (!code) return;
    await mutate('/api/v1/auth/totp/disable', { code }, '关闭 TOTP', { message: '关闭后账户登录只依赖密码。', danger: true });
  }

  async function registerPasskey() {
    if (!('PublicKeyCredential' in window) || !window.isSecureContext) {
      await dialog.alert('Passkey 只能在 HTTPS 安全上下文和支持 WebAuthn 的浏览器中注册。', '当前环境不支持');
      return;
    }
    const name = await dialog.prompt({ title: '注册 Passkey', message: '为这把凭据设置一个便于识别的名称。', value: '此设备 Passkey', required: true });
    if (!name) return;
    try {
      const begin = await secureApi<Record<string, any>>('/api/v1/auth/passkey/register/begin', { method: 'POST', body: jsonBody({ name }) });
      const credential = await navigator.credentials.create({ publicKey: publicKeyCreationOptions(begin) }) as PublicKeyCredential | null;
      if (!credential) throw new Error('Passkey 注册已取消');
      await secureApi('/api/v1/auth/passkey/register/finish', { method: 'POST', body: jsonBody({ flow_id: begin.flow_id, name, credential: serializeCreation(credential) }) });
      toast('Passkey 已注册');
      await passkeys.reload();
    } catch (error) {
      await dialog.alert(errorText(error), 'Passkey 注册失败');
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = String(form.get('current_password') || '');
    const next = String(form.get('new_password') || '');
    const confirm = String(form.get('confirm_password') || '');
    if (next !== confirm) { await dialog.alert('两次输入的新密码不一致。', '无法保存'); return; }
    try {
      await api('/api/v1/auth/password', { method: 'POST', body: jsonBody({ current_password: current, new_password: next }) });
      event.currentTarget.reset();
      toast('管理员密码已更新，其他会话已注销');
      await sessions.reload();
    } catch (error) { await dialog.alert(errorText(error), '修改密码失败'); }
  }

  async function changeUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/v1/auth/account', { method: 'PATCH', body: jsonBody({ current_password: form.get('current_password'), username: form.get('username') }) });
      await dialog.alert('管理员用户名已更新，页面将重新载入。', '修改完成');
      location.reload();
    } catch (error) { await dialog.alert(errorText(error), '修改用户名失败'); }
  }

  async function saveNotifications(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await secureApi('/api/v1/security/login-notifications', { method: 'POST', body: jsonBody({
        enabled: form.get('enabled') === 'on', bot_token: String(form.get('bot_token') || ''),
        chat_id: String(form.get('chat_id') || ''), test: form.get('test') === 'on',
      }) });
      toast('登录通知设置已保存');
      await notifications.reload();
    } catch (error) { await dialog.alert(errorText(error), '通知设置失败'); }
  }

  return <>
    {sessions.error ? <ErrorState message={sessions.error} retry={sessions.reload}/> : null}
    <div className="card-grid">
      <Card>
        <div className="card-heading"><div><strong>双重验证</strong><p>未启用时登录页不会显示验证码输入框。</p></div><Status value={totp.data?.enabled}/></div>
        {totp.data?.enabled ? <><InfoList rows={[["剩余恢复码", String(totp.data?.recovery_codes_remaining ?? 0)]]}/><div className="toolbar"><Button onClick={regenerateRecovery}>重新生成恢复码</Button><Button tone="danger" onClick={disableTOTP}>关闭 TOTP</Button></div></> : <Button tone="primary" onClick={setupTOTP}>启用 TOTP</Button>}
      </Card>
      <Card>
        <div className="card-heading"><div><strong>Passkey</strong><p>使用系统生物识别或安全密钥登录。</p></div><Status value={keyItems.length > 0}/></div>
        <Button tone="primary" onClick={registerPasskey}>注册 Passkey</Button>
        {keyItems.length ? <div className="resource-list">{keyItems.map(item => <ResourceRow key={String(item.id)} title={String(item.name || 'Passkey')} subtitle={item.created_at ? `创建 ${formatDate(item.created_at)}` : ''} meta={item.last_used ? `上次使用 ${formatDate(item.last_used)}` : '尚未使用'} actions={<Button compact tone="danger" onClick={() => mutate('/api/v1/auth/passkeys', { id: item.id }, '删除 Passkey', { message: String(item.name || item.id), danger: true }, 'DELETE')}>删除</Button>}/>)}</div> : <EmptyState title="尚未注册 Passkey"/>}
      </Card>
    </div>

    <div className="card-grid">
      <Card><div className="card-heading"><strong>修改密码</strong></div><form className="stack-form" onSubmit={changePassword}>
        <label>当前密码<input name="current_password" type="password" autoComplete="current-password" required/></label>
        <label>新密码<input name="new_password" type="password" autoComplete="new-password" minLength={12} required/></label>
        <label>确认新密码<input name="confirm_password" type="password" autoComplete="new-password" minLength={12} required/></label>
        <Button tone="primary" type="submit">修改密码</Button>
      </form></Card>
      <Card><div className="card-heading"><strong>修改管理员用户名</strong></div><form className="stack-form" onSubmit={changeUsername}>
        <label>新用户名<input name="username" pattern="[A-Za-z][A-Za-z0-9_.-]{2,31}" required/></label>
        <label>当前密码<input name="current_password" type="password" autoComplete="current-password" required/></label>
        <Button type="submit">修改用户名</Button>
      </form></Card>
    </div>

    <Card>
      <div className="card-heading"><strong>可信设备</strong><span>{deviceItems.length}</span></div>
      {deviceItems.length ? <div className="resource-list">{deviceItems.map(item => <ResourceRow key={String(item.id)} title={String(item.name || item.id)} subtitle={String(item.last_ip || '-')} meta={`上次使用 ${formatDate(item.last_used)} · 创建 ${formatDate(item.created_at)}`} actions={<Button compact tone="danger" onClick={() => mutate('/api/v1/auth/trusted-devices', { id: item.id, all: false }, '移除可信设备', { message: String(item.name || item.id), danger: true }, 'DELETE')}>移除</Button>}/>)}</div> : <EmptyState title="没有可信设备" description="在开启 TOTP 后登录时可选择信任当前设备 30 天。"/>}
      {deviceItems.length ? <Button tone="danger" disabled={!!busy} onClick={() => mutate('/api/v1/auth/trusted-devices', { id: '', all: true }, '移除全部可信设备', { message: '包括当前浏览器在内的所有可信设备都会失效。', danger: true }, 'DELETE')}>移除全部可信设备</Button> : null}
    </Card>

    <Card>
      <div className="card-heading"><div><strong>登录通知</strong><p>通过 Telegram Bot 发送登录事件；Bot Token 不会返回前端。</p></div><Status value={notifications.data?.enabled}/></div>
      <form className="form-grid" onSubmit={saveNotifications} key={`${notifications.data?.enabled}-${notifications.data?.chat_id}`}>
        <label className="toggle"><input name="enabled" type="checkbox" defaultChecked={!!notifications.data?.enabled}/><span>启用登录通知</span></label>
        <label>Telegram Chat ID<input name="chat_id" defaultValue={String(notifications.data?.chat_id || '')} placeholder="123456789"/></label>
        <label className="span-2">Bot Token<input name="bot_token" type="password" placeholder={notifications.data?.configured ? '已配置；留空保持不变' : '123456:AA...'} autoComplete="off"/></label>
        <label className="toggle"><input name="test" type="checkbox"/><span>保存后发送测试消息</span></label>
        <div className="form-actions span-2"><Button type="submit">保存通知设置</Button></div>
      </form>
    </Card>

    <Card>
      <div className="card-heading"><strong>活跃会话</strong><span>{sessionItems.length}</span></div>
      {sessionItems.length ? <div className="resource-list">{sessionItems.map(item => <ResourceRow key={String(item.id)} title={item.id === sessions.data?.current ? '当前会话' : '其他会话'} subtitle={String(item.ip || item.user_agent || '')} meta={`${formatDate(item.created_at)} · ${formatDate(item.last_seen_at)}`} status={<Status value={item.id === sessions.data?.current ? 'active' : 'available'}/>}/>)}</div> : <EmptyState/>}
      <Button tone="danger" disabled={!!busy} onClick={() => mutate('/api/v1/auth/sessions', null, '注销其他会话', { message: '当前会话会保留。', danger: true }, 'DELETE')}>注销其他会话</Button>
    </Card>
  </>;
}

export function SSHPage({ back }: PageNavProps) {
  const status = useApiData<Record<string, any>>('/api/v1/ssh/status');
  const users = useApiData<Record<string, any>>('/api/v1/ssh/users');
  const [selected, setSelected] = useState('');
  const keys = useApiData<Record<string, any>>(selected ? `/api/v1/ssh/keys?user=${encodeURIComponent(selected)}` : null, { deps: [selected] });
  const dialog = useDialog();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const userItems = asArray<Record<string, any>>(users.data?.users);
  useEffect(() => { if (!selected && userItems[0]) setSelected(String(userItems[0].name)); }, [userItems, selected]);

  async function mutate(endpoint: string, body: unknown, label: string, method = 'POST', confirm?: string) {
    if (confirm && !await dialog.confirm({ title: label, message: confirm, confirmText: label, danger: true })) return undefined;
    setBusy(endpoint);
    try {
      const out = await secureApi<Record<string, any>>(endpoint, { method, body: body === null ? undefined : jsonBody(body) });
      toast(String(out.message || `${label}完成`));
      await Promise.all([status.reload(), users.reload(), keys.reload()]);
      return out;
    } catch (error) {
      await dialog.alert(errorText(error), `${label}失败`);
      return undefined;
    } finally {
      setBusy('');
    }
  }

  async function generate() {
    const comment = await dialog.prompt({ title: '生成 ED25519 密钥', value: `lukepanel-${selected}`, required: true });
    if (!comment) return;
    const passphrase = await dialog.prompt({ title: '私钥口令', message: '可留空。设置后请牢记，LukePanel 不保存口令。', type: 'password', value: '' });
    const out = await mutate('/api/v1/ssh/keys/generate', { user: selected, comment, passphrase: passphrase || '' }, '生成密钥') as Record<string, any> | undefined;
    if (out?.private_key) {
      const blob = new Blob([String(out.private_key)], { type: 'application/x-pem-file' });
      downloadBlob(blob, String(out.filename || `${selected}-ed25519`));
      await dialog.alert(`公钥：
${out.public_key}

指纹：${out.fingerprint}

私钥已经下载，后端不会再次提供。`, '密钥已生成');
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const port = Number(form.get('port'));
    const payload = {
      port,
      permit_root_login: String(form.get('permit_root_login') || 'prohibit-password'),
      allow_tcp_forwarding: form.get('allow_tcp_forwarding') === 'on',
      allow_agent_forwarding: form.get('allow_agent_forwarding') === 'on',
      x11_forwarding: form.get('x11_forwarding') === 'on',
    };
    await mutate('/api/v1/ssh/settings', payload, '保存 SSH 设置', 'POST', `新配置会先通过 sshd -t 校验。若端口从 ${status.data?.port || '22'} 改为 ${port}，旧端口会暂时保留，直到你确认新端口可连接。`);
  }


  async function createUser() {
    const name = await dialog.prompt({ title: '创建 SSH 登录用户', message: '用户名只允许小写字母、数字、下划线和短横线；新用户默认锁定密码，请先添加公钥。', placeholder: 'deploy', required: true });
    if (!name) return;
    const sudo = await dialog.confirm({ title: '授予 sudo 权限？', message: `${name}
仅在确实需要管理权限时授予。`, confirmText: '授予 sudo' });
    const out = await mutate('/api/v1/ssh/users/manage', { action: 'create', name: name.trim(), sudo }, '创建用户');
    if (out) setSelected(name.trim());
  }

  async function toggleSudo(user: Record<string, any>) {
    const enabled = !Boolean(user.sudo);
    await mutate('/api/v1/ssh/users/manage', { action: 'sudo', name: String(user.name), enabled }, enabled ? '授予 sudo' : '移除 sudo', 'POST', `${user.name}
${enabled ? '该用户将获得管理员权限。' : '该用户将失去 sudo/wheel 组权限。'}`);
  }

  async function deleteUser(user: Record<string, any>) {
    const name = String(user.name);
    const removeHome = await dialog.confirm({ title: '是否同时删除 Home 目录？', message: `${name}
选择“删除 Home”会执行 userdel --remove；取消则只删除账号。`, confirmText: '删除 Home', danger: true });
    const out = await mutate('/api/v1/ssh/users/manage', { action: 'delete', name, remove_home: removeHome }, '删除用户', 'POST', `${name}
后端会拒绝删除 root、lukepanel、系统服务用户或仍有运行进程的用户。`);
    if (out && selected === name) setSelected('');
  }

  const value = status.data ?? {};
  const passwordEnabled = String(value.password_authentication).toLowerCase() === 'yes';
  const yes = (input: unknown) => String(input).toLowerCase() === 'yes';
  if (status.loading && !status.data) return <div className="page"><PageHeader title="SSH 管理" back={back}/><Loading/></div>;
  if (status.error && !status.data) return <div className="page"><PageHeader title="SSH 管理" back={back}/><ErrorState message={status.error} retry={status.reload}/></div>;

  return <div className="page">
    <PageHeader title="SSH 管理" description="配置校验、自动回滚和双端口确认都由后端强制执行" back={back} actions={<Button compact onClick={() => { void status.reload(); void users.reload(); void keys.reload(); }}><Icon name="refresh" size={17}/>刷新</Button>}/>
    {value.pending_new_port ? <Card className="warning-card"><div><strong>SSH 端口等待确认</strong><p>旧端口 {String(value.pending_old_port || '-')} 与新端口 {String(value.pending_new_port)} 目前同时监听。请先用新的 SSH 连接实际登录，再确认关闭旧端口。</p></div><div className="toolbar"><Button tone="primary" onClick={() => mutate('/api/v1/ssh/port/confirm', { keep_new: true }, '保留新端口', 'POST', `确认新端口 ${value.pending_new_port} 可连接，并关闭旧端口 ${value.pending_old_port}。`)}>新端口已验证</Button><Button tone="danger" onClick={() => mutate('/api/v1/ssh/port/confirm', { keep_new: false }, '回退旧端口', 'POST', `放弃新端口 ${value.pending_new_port}，恢复只监听旧端口 ${value.pending_old_port}。`)}>回退旧端口</Button></div></Card> : null}
    <div className="card-grid">
      <Card><div className="card-heading"><strong>OpenSSH</strong><Status value={value.available}/></div><InfoList rows={[["服务", String(value.service || '-')], ["端口", String(value.port || '-')], ["Root 登录", String(value.permit_root_login || '-')], ["密码登录", String(value.password_authentication || '-')], ["公钥登录", String(value.pubkey_authentication || '-')], ["TCP 转发", String(value.allow_tcp_forwarding || '-')]]}/><Button tone={passwordEnabled ? 'danger' : 'primary'} onClick={() => mutate('/api/v1/ssh/password', { enabled: !passwordEnabled }, passwordEnabled ? '关闭密码登录' : '开启密码登录', 'POST', passwordEnabled ? '请先用另一条 SSH 连接确认至少一把公钥可以正常登录。关闭后密码和键盘交互认证都会停用。' : undefined)}>{passwordEnabled ? '关闭密码登录' : '开启密码登录'}</Button></Card>
      <Card><div className="card-heading"><strong>高级设置</strong></div><form className="stack-form" key={`${value.port}-${value.permit_root_login}-${value.allow_tcp_forwarding}`} onSubmit={saveSettings}><label>SSH 端口<input name="port" type="number" min="1" max="65535" defaultValue={Number(String(value.port || '22').split(/\s+/)[0])}/></label><label>Root 登录策略<select name="permit_root_login" defaultValue={String(value.permit_root_login || 'prohibit-password')}><option value="no">禁止 Root 登录</option><option value="prohibit-password">仅允许 Root 公钥登录</option><option value="forced-commands-only">仅允许强制命令</option><option value="yes">允许 Root 登录</option></select></label><label className="checkbox"><input name="allow_tcp_forwarding" type="checkbox" defaultChecked={yes(value.allow_tcp_forwarding)}/>允许 TCP 转发</label><label className="checkbox"><input name="allow_agent_forwarding" type="checkbox" defaultChecked={yes(value.allow_agent_forwarding)}/>允许 Agent 转发</label><label className="checkbox"><input name="x11_forwarding" type="checkbox" defaultChecked={yes(value.x11_forwarding)}/>允许 X11 转发</label><Button tone="primary" type="submit" disabled={!!busy}>校验并保存</Button></form></Card>
    </div>
    <Card><div className="card-heading"><div><strong>登录用户</strong><p>新建用户默认禁用密码，只能在添加公钥后登录。</p></div><div className="toolbar"><span>{userItems.length}</span><Button compact tone="primary" onClick={createUser} disabled={!!busy}>创建用户</Button></div></div><div className="user-tabs">{userItems.map(user => <div className={`user-tab-row ${selected === user.name ? 'active' : ''}`} key={String(user.name)}><button onClick={() => setSelected(String(user.name))}><strong>{String(user.name)}</strong><small>UID {user.uid} · {user.key_count || 0} 把密钥{user.sudo ? ' · sudo' : ''}</small></button><div className="toolbar"><Button compact onClick={() => toggleSudo(user)} disabled={!!busy || ['root','lukepanel'].includes(String(user.name))}>{user.sudo ? '移除 sudo' : '授予 sudo'}</Button><Button compact tone="danger" onClick={() => deleteUser(user)} disabled={!!busy || ['root','lukepanel'].includes(String(user.name))}>删除</Button></div></div>)}</div></Card>
    {selected ? <Card><div className="card-heading"><div><strong>{selected} 的公钥</strong><p>authorized_keys 真实内容按指纹管理</p></div><div><Button compact onClick={async () => { const key = await dialog.prompt({ title: '添加 SSH 公钥', message: '粘贴完整的 ssh-ed25519、ssh-rsa 或 ECDSA 公钥', required: true }); if (key) void mutate('/api/v1/ssh/keys/add', { user: selected, key }, '添加公钥'); }}>添加公钥</Button><Button compact tone="primary" onClick={generate}>生成密钥</Button></div></div>{keys.loading && !keys.data ? <Loading/> : asArray<Record<string, any>>(keys.data?.keys).length ? <div className="resource-list">{asArray<Record<string, any>>(keys.data?.keys).map(item => <ResourceRow key={String(item.id)} title={String(item.comment || item.type)} subtitle={String(item.fingerprint)} meta={String(item.preview || '')} actions={<Button compact tone="danger" onClick={() => mutate('/api/v1/ssh/keys/delete', { user: selected, id: item.id }, '删除公钥', 'POST', String(item.fingerprint))}>删除</Button>}/>)}</div> : <EmptyState title="这个用户没有公钥"/>}</Card> : null}
    {busy ? <span className="sr-only">操作进行中</span> : null}
  </div>;
}

