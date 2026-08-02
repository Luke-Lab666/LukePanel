import { useState, type FormEvent } from 'react';
import { ApiError, api, errorText, jsonBody } from '../lib/api';
import { Button } from '../components/UI';
import { Icon } from '../components/Icon';
import { publicKeyRequestOptions, serializeAssertion } from '../lib/webauthn';

export function LoginPage({ onAuthenticated }: { onAuthenticated: () => Promise<unknown> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOTP] = useState('');
  const [needsOTP, setNeedsOTP] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password || (needsOTP && !otp.trim())) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: jsonBody({
          username: username.trim(),
          password,
          otp: otp.trim(),
          trust_device: needsOTP && trustDevice,
          device_name: `${navigator.platform || 'Browser'} · ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}`,
        }),
      });
      await onAuthenticated();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'totp_required') {
        setNeedsOTP(true);
        setError('账号已启用两步验证，请输入验证码或恢复码。');
      } else {
        setError(errorText(cause));
      }
    } finally {
      setBusy(false);
    }
  };


  const passkey = async () => {
    if (!username.trim() || !('PublicKeyCredential' in window)) return;
    setBusy(true);
    setError('');
    try {
      const begin = await api<Record<string, any>>('/api/v1/auth/passkey/login/begin', { method: 'POST', body: jsonBody({ username: username.trim() }) });
      const credential = await navigator.credentials.get({ publicKey: publicKeyRequestOptions(begin) }) as PublicKeyCredential | null;
      if (!credential) throw new Error('Passkey 验证已取消');
      await api('/api/v1/auth/passkey/login/finish', { method: 'POST', body: jsonBody({ flow_id: begin.flow_id, credential: serializeAssertion(credential) }) });
      await onAuthenticated();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  return <main className="login-page">
    <section className="login-card">
      <div className="login-brand"><img src="/assets/lukepanel-icon-192.png" alt="LukePanel"/><div><h1>LukePanel</h1><p>安全、轻量的 Linux 管理面板</p></div></div>
      <form onSubmit={submit}>
        <label>管理员用户名<input autoFocus autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} /></label>
        <label>管理员密码<input type="password" autoComplete="current-password" inputMode="text" lang="en" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={password} onChange={event => setPassword(event.target.value)} /></label>
        {needsOTP ? <><label>验证码或恢复码<input autoFocus inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={event => setOTP(event.target.value)} /></label><label className="check-row"><input type="checkbox" checked={trustDevice} onChange={event => setTrustDevice(event.target.checked)} /><span>信任这台设备，后续登录免验证码</span></label></> : null}
        {error ? <div className="form-error"><Icon name="warning" size={18}/><pre>{error}</pre></div> : null}
        <Button tone="primary" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner--small"/>正在验证</> : '密码登录'}</Button>
        {'PublicKeyCredential' in window ? <Button type="button" disabled={busy || !username.trim()} onClick={passkey}><Icon name="key" size={17}/>使用 Passkey</Button> : null}
      </form>
      <footer><Icon name="shield" size={16}/><span>会话、CSRF 与高风险操作二次验证均由服务端强制执行</span></footer>
    </section>
  </main>;
}
