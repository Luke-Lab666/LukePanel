const app = document.querySelector('#app')
const state = { authenticated: false, username: '', csrf: '', overview: null, files: null, loading: false }

const iconPaths = {
  home:'<path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  server:'<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
  container:'<path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
  user:'<path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/>',
  folder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  file:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><polyline points="14 2 14 8 20 8"/>',
  scroll:'<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h9a2 2 0 0 0 2-2v-1H9v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2h3"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9 12 2 2 4-4"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.42"/>',
  refresh:'<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  alert:'<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  more:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  activity:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  power:'<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  network:'<rect width="6" height="6" x="9" y="2" rx="1"/><rect width="6" height="6" x="16" y="16" rx="1"/><rect width="6" height="6" x="2" y="16" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"/>',
  drive:'<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>',
  key:'<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15 5l3 3M18 2l3 3"/>',
  calendar:'<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  package:'<path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  construction:'<rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7M7 14v7M17 3v3M7 3v3M2 10h20M6 6l4 8M14 6l4 8"/>'
}
function icon(name, size=20, cls=''){ return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||''}</svg>` }
function escapeHTML(value=''){ return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])) }
async function api(url, options={}){
  const headers = new Headers(options.headers||{})
  if(options.body && !headers.has('Content-Type')) headers.set('Content-Type','application/json')
  if(options.method && options.method!=='GET' && state.csrf) headers.set('X-CSRF-Token',state.csrf)
  const res = await fetch(url,{...options,headers,credentials:'same-origin'})
  const body = await res.json().catch(()=>({}))
  if(!res.ok) throw new Error(body.error||`请求失败（${res.status}）`)
  return body
}
function navigate(path){ history.pushState({},'',path); render() }
window.addEventListener('popstate',render)
document.addEventListener('click',e=>{ const link=e.target.closest('[data-nav]'); if(link){e.preventDefault();navigate(link.getAttribute('href'))} })
function theme(){return localStorage.getItem('theme')||'light'}
function applyTheme(value){document.documentElement.dataset.theme=value;localStorage.setItem('theme',value)}
applyTheme(theme())

async function restore(){
  try{const me=await api('/api/v1/auth/me');state.authenticated=true;state.username=me.username;state.csrf=me.csrf_token}catch{state.authenticated=false;state.csrf=''}
  render()
}
function navItems(){return [
  ['概览','/','home'],['系统管理','/system','server'],['文件管理','/files','folder'],['Docker','/docker','container'],['常用工具','/tools','wrench'],['日志审计','/audit','scroll'],['安全设置','/security','shield']
]}
function shell(content){
  const path=location.pathname, nav=navItems()
  return `<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div><strong>LukePanel</strong><span>轻量系统管理</span></div></div><nav class="sidebar-nav">${nav.map(([label,href,i])=>`<a data-nav href="${href}" class="${path===href?'active':''}">${icon(i,19)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-footer"><button id="theme-toggle" class="icon-text-button">${icon(theme()==='dark'?'sun':'moon',18)}${theme()==='dark'?'浅色模式':'深色模式'}</button><button id="logout" class="icon-text-button danger-text">${icon('logout',18)}退出登录</button></div></aside><main class="main-content">${content}</main><nav class="mobile-nav">${nav.filter(([,href])=>['/','/system','/docker','/tools','/security'].includes(href)).map(([label,href,i])=>`<a data-nav href="${href}" class="${path===href?'active':''}">${icon(href==='/security'?'user':i,21)}<span>${href==='/security'?'我的':label.replace('管理','')}</span></a>`).join('')}</nav></div>`
}
function pageHeader(title, description='', action=''){return `<header class="page-header"><div><h1>${escapeHTML(title)}</h1>${description?`<p>${escapeHTML(description)}</p>`:''}</div><div class="page-header__actions">${action}</div></header>`}
function formatBytes(v){const u=['B','KB','MB','GB','TB'];let i=0;while(v>=1024&&i<u.length-1){v/=1024;i++}return `${v.toFixed(i<2?0:1)} ${u[i]}`}
function formatUptime(sec){const d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60);return `${d} 天 ${h} 小时 ${m} 分钟`}
function metric(label,value,detail,percent){return `<article class="metric-card surface"><div class="metric-card__header"><span>${label}</span><strong>${value}</strong></div>${percent!==undefined?`<div class="progress"><span style="width:${Math.min(100,Math.max(0,percent))}%"></span></div>`:''}<p>${detail||''}</p></article>`}
function renderLogin(){
  app.innerHTML=`<main class="login-page"><section class="login-card surface"><div class="login-logo">L</div><h1>登录 LukePanel</h1><p>安全、轻量地管理你的服务器</p><form id="login-form"><label>用户名<input name="username" value="admin" autocomplete="username"></label><label>密码<div class="password-field"><input name="password" type="password" autocomplete="current-password" autofocus><button type="button" id="show-password">显示</button></div></label><div id="login-error" class="form-error" hidden></div><button class="primary-button" type="submit">登录</button></form><div class="security-note">${icon('shield',17)}会话仅通过 HttpOnly Cookie 保存</div></section></main>`
  document.querySelector('#show-password').onclick=e=>{const input=document.querySelector('[name=password]');input.type=input.type==='password'?'text':'password';e.currentTarget.textContent=input.type==='password'?'显示':'隐藏'}
  document.querySelector('#login-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type=submit]'),error=document.querySelector('#login-error');button.disabled=true;button.textContent='正在登录…';error.hidden=true;try{const r=await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify({username:f.get('username'),password:f.get('password')})});state.authenticated=true;state.username=r.username;state.csrf=r.csrf_token;navigate('/')}catch(err){error.textContent=err.message;error.hidden=false}finally{button.disabled=false;button.textContent='登录'}}
}
async function loadOverview(){state.loading=true;try{state.overview=await api('/api/v1/system/overview')}catch(e){state.pageError=e.message}finally{state.loading=false;render()}}
function dashboard(){const d=state.overview;if(!d){queueMicrotask(loadOverview);return `<div class="page-wrap">${pageHeader('系统概览','正在读取系统状态')}<section class="placeholder surface"><div class="spinner"></div><strong>正在采集系统信息</strong></section></div>`}const mp=d.memory.Used/d.memory.Total*100,dp=d.disk.Used/d.disk.Total*100;return `<div class="page-wrap">${pageHeader('系统概览',`${d.hostname} · ${d.os}`,`<button id="refresh-overview" class="secondary-button compact">${icon('refresh',17,state.loading?'spin':'')}<span>刷新</span></button>`)}${state.pageError?`<div class="alert error">${icon('alert',18)}${escapeHTML(state.pageError)}</div>`:''}<section class="status-hero surface"><div><span class="status-dot"></span><strong>系统运行正常</strong><p>${icon('clock',16)}已运行 ${formatUptime(d.uptime_seconds)}</p></div>${icon('server',30)}</section><section class="metrics-grid">${metric('CPU',`${d.cpu_percent.toFixed(1)}%`,`负载 ${d.load_1.toFixed(2)} / ${d.load_5.toFixed(2)} / ${d.load_15.toFixed(2)}`,d.cpu_percent)}${metric('内存',`${mp.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`,mp)}${metric('系统盘',`${dp.toFixed(1)}%`,`${formatBytes(d.disk.Used)} / ${formatBytes(d.disk.Total)}`,dp)}${metric('网络累计',formatBytes(d.network.ReceivedBytes),`上传 ${formatBytes(d.network.SentBytes)}`)}</section><section class="dashboard-grid"><article class="surface summary-card"><div class="card-heading">${icon('container',19)}<strong>Docker</strong></div><div class="empty-state"><span>容器接口将在下一阶段接入</span><a data-nav href="/docker">查看模块</a></div></article><article class="surface summary-card"><div class="card-heading">${icon('alert',19)}<strong>异常提醒</strong></div><div class="empty-state"><span>暂无异常</span><small>后续接入 systemd 与审计告警</small></div></article></section></div>`}
function systemPage(){const modules=[['文件管理','浏览、上传与安全编辑','/files','folder',true],['服务管理','systemd 状态与控制','','power'],['进程管理','资源排行与进程控制','','activity'],['网络管理','接口、连接与监听端口','','network'],['存储管理','分区与空间分析','','drive'],['SSH 管理','密钥、登录与安全配置','','key'],['计划任务','Cron 与 systemd timer','','calendar'],['软件更新','APT 检查与安全升级','','package']];return `<div class="page-wrap">${pageHeader('系统管理','高频操作优先，手机端三步内完成')}<section class="module-grid">${modules.map(([t,d,p,i,r])=>`<${r?'a':'article'} ${r?'data-nav href="'+p+'"':''} class="module-card surface ${r?'':'muted'}"><div class="module-icon">${icon(i,22)}</div><div><strong>${t}</strong><p>${d}</p></div>${icon('chevron',19)}${r?'':'<span class="soon-badge">规划中</span>'}</${r?'a':'article'}>`).join('')}</section></div>`}
async function loadFiles(path='/'){state.loading=true;state.pageError='';try{state.files=await api(`/api/v1/files?path=${encodeURIComponent(path)}`)}catch(e){state.pageError=e.message}finally{state.loading=false;render()}}
function filesPage(){const l=state.files;if(!l){queueMicrotask(()=>loadFiles('/'));return `<div class="page-wrap">${pageHeader('文件管理','正在读取允许访问的位置')}<section class="placeholder surface"><div class="spinner"></div></section></div>`}return `<div class="page-wrap files-page">${pageHeader('文件管理','首版为安全只读浏览，写操作将在权限隔离完成后开放',`<button id="refresh-files" class="secondary-button compact">${icon('refresh',17,state.loading?'spin':'')}<span>刷新</span></button>`)}<div class="file-toolbar surface"><button id="file-back" ${l.parent?'':'disabled'}>${icon('back',19)}</button><button id="file-home">${icon('home',18)}</button><div class="path-pill">${escapeHTML(l.path==='/'?'允许访问的位置':l.path)}</div></div>${state.pageError?`<div class="alert error">${icon('alert',18)}${escapeHTML(state.pageError)}</div>`:''}<section class="file-list surface">${l.entries.map(item=>`<button class="file-row" data-file-path="${escapeHTML(item.path)}" data-directory="${item.is_dir}"><div class="file-icon">${icon(item.is_dir?'folder':'file',22)}</div><div class="file-main"><strong>${escapeHTML(item.name)}</strong><span>${item.is_dir?'文件夹':formatBytes(item.size)} · ${new Date(item.modified_at).toLocaleString()}</span></div><code>${escapeHTML(item.mode)}</code>${icon('more',20)}</button>`).join('')||'<div class="empty-list">这个目录是空的</div>'}</section></div>`}
function placeholder(title,description){return `<div class="page-wrap">${pageHeader(title,description)}<section class="placeholder surface">${icon('construction',36)}<strong>基础框架已就位</strong><p>该模块会在保持低资源占用的前提下逐步接入。</p></section></div>`}
function securityPage(){return `<div class="page-wrap">${pageHeader('我的与安全','账户、会话、主题与面板安全设置')}<section class="settings-list surface"><div class="setting-row"><div class="setting-icon">${icon('shield',21)}</div><div><strong>当前账户</strong><p>${escapeHTML(state.username)}</p></div></div>${[['user','Passkey / Face ID','后续版本接入 WebAuthn'],['key','TOTP 两步验证','后续版本开放绑定'],['clock','会话管理','查看和退出已登录设备']].map(([i,t,d])=>`<div class="setting-row muted"><div class="setting-icon">${icon(i,21)}</div><div><strong>${t}</strong><p>${d}</p></div><span>规划中</span></div>`).join('')}<div class="setting-row"><div class="setting-icon">${icon('moon',21)}</div><div><strong>外观模式</strong><p>当前为${theme()==='dark'?'深色':'浅色'}模式，电脑端可从侧栏切换</p></div></div></section><section class="password-panel surface"><h2>修改登录密码</h2><p>首次登录后请立即替换自动生成的初始密码。</p><form id="password-form"><label>当前密码<input name="current" type="password" autocomplete="current-password"></label><label>新密码<input name="next" type="password" minlength="12" autocomplete="new-password"></label><label>确认新密码<input name="confirm" type="password" minlength="12" autocomplete="new-password"></label><div id="password-message" class="form-error" hidden></div><button class="primary-button" type="submit">保存新密码</button></form></section></div>`}

function bindShell(){
  const toggle=document.querySelector('#theme-toggle');if(toggle)toggle.onclick=()=>{applyTheme(theme()==='dark'?'light':'dark');render()}
  const logout=document.querySelector('#logout');if(logout)logout.onclick=async()=>{await api('/api/v1/auth/logout',{method:'POST'});state.authenticated=false;state.csrf='';render()}
  const refresh=document.querySelector('#refresh-overview');if(refresh)refresh.onclick=loadOverview
  const rf=document.querySelector('#refresh-files');if(rf)rf.onclick=()=>loadFiles(state.files?.path||'/')
  const back=document.querySelector('#file-back');if(back)back.onclick=()=>state.files?.parent&&loadFiles(state.files.parent)
  const home=document.querySelector('#file-home');if(home)home.onclick=()=>loadFiles('/')
  document.querySelectorAll('[data-file-path]').forEach(row=>row.onclick=()=>row.dataset.directory==='true'&&loadFiles(row.dataset.filePath))
  const passwordForm=document.querySelector('#password-form');if(passwordForm)passwordForm.onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),message=document.querySelector('#password-message'),button=e.currentTarget.querySelector('button[type=submit]'),next=String(f.get('next')||''),confirm=String(f.get('confirm')||'');message.hidden=true;if(next!==confirm){message.textContent='两次输入的新密码不一致';message.hidden=false;return}button.disabled=true;button.textContent='正在保存…';try{await api('/api/v1/auth/password',{method:'POST',body:JSON.stringify({current_password:f.get('current'),new_password:next})});message.className='form-success';message.textContent='密码已更新';message.hidden=false;e.currentTarget.reset()}catch(err){message.className='form-error';message.textContent=err.message;message.hidden=false}finally{button.disabled=false;button.textContent='保存新密码'}}
}
function render(){
  if(!state.authenticated){if(location.pathname!='/login')history.replaceState({},'','/login');renderLogin();return}
  if(location.pathname==='/login')history.replaceState({},'','/')
  const routes={'/':dashboard,'/system':systemPage,'/files':filesPage,'/docker':()=>placeholder('Docker','容器、Compose、镜像、网络与存储卷管理将在下一阶段接入。'),'/tools':()=>placeholder('常用工具','Ping、DNS、端口、HTTP 与系统诊断工具将在这里统一提供。'),'/audit':()=>placeholder('日志审计','系统日志、Docker 日志和面板操作审计会集中到这里。'),'/security':securityPage}
  app.innerHTML=shell((routes[location.pathname]||routes['/'])());bindShell()
}
restore()
