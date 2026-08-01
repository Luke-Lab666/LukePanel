const app = document.querySelector('#app')

const state = {
  authenticated: false,
  username: '',
  sessionID: '',
  csrf: '',
  overview: null,
  docker: null,
  dockerStatus: null,
  dockerImages: null,
  dockerNetworks: null,
  dockerVolumes: null,
  dockerTab: 'containers',
  services: null,
  processes: null,
  network: null,
  storage: null,
  timers: null,
  updates: null,
  processPrimed: false,
  files: null,
  fileContent: null,
  audit: null,
  systemLogs: null,
  settings: null,
  loading: {},
  errors: {},
  refreshTimer: null,
  modal: null,
}

const icons = {
  home:'<path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  server:'<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
  container:'<path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
  user:'<path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/>',
  folder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  file:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v6h6"/>',
  scroll:'<path d="M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h9a2 2 0 0 0 2-2v-1H9v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2h3"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9 12 2 2 4-4"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.42"/>',
  refresh:'<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>', back:'<path d="m15 18-6-6 6-6"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  activity:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', power:'<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  network:'<rect width="6" height="6" x="9" y="2" rx="1"/><rect width="6" height="6" x="16" y="16" rx="1"/><rect width="6" height="6" x="2" y="16" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"/>',
  drive:'<path d="M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/><path d="M6 16h.01M10 16h.01"/>',
  key:'<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15 5l3 3M18 2l3 3"/>',
  calendar:'<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  package:'<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M20 16v4H4v-4"/>',
  download:'<path d="M12 4v12M7 11l5 5 5-5"/><path d="M20 20H4"/>', edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>', save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>', terminal:'<path d="m4 17 6-6-6-6M12 19h8"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>', play:'<path d="m5 3 14 9-14 9z"/>', stop:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
}
function icon(name, size=20, cls=''){ return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>` }
function escapeHTML(value=''){ return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])) }
function jsonBody(value){ return JSON.stringify(value) }

async function api(url, options={}){
  const headers = new Headers(options.headers||{})
  if(options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type','application/json')
  if(options.method && options.method!=='GET' && state.csrf) headers.set('X-CSRF-Token',state.csrf)
  const res = await fetch(url,{...options,headers,credentials:'same-origin'})
  const body = await res.json().catch(()=>({}))
  if(res.status===401 && state.authenticated){ state.authenticated=false; stopAutoRefresh(); render() }
  if(!res.ok){const error=new Error(body.error||`请求失败（${res.status}）`);error.status=res.status;throw error}
  return body
}
async function secureApi(url,options={}){
  try{return await api(url,options)}catch(error){
    if(error.status!==403||!String(error.message).includes('二次验证'))throw error
    const password=prompt('此操作需要二次验证，请输入当前登录密码')
    if(password===null)throw new Error('操作已取消')
    await api('/api/v1/auth/elevate',{method:'POST',body:jsonBody({password})})
    return api(url,options)
  }
}

function theme(){ return localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light') }
function applyTheme(value){ document.documentElement.dataset.theme=value; localStorage.setItem('theme',value); document.querySelector('meta[name=theme-color]')?.setAttribute('content',value==='dark'?'#101114':'#f6f7f9') }
applyTheme(theme())
function navigate(path){ if(location.pathname!==path) history.pushState({},'',path); state.modal=null; render() }
window.addEventListener('popstate',()=>{state.modal=null;render()})
document.addEventListener('click',e=>{const link=e.target.closest('[data-nav]');if(link){e.preventDefault();navigate(link.getAttribute('href'))}})

document.addEventListener('visibilitychange',()=>{
  syncAutoRefresh()
  if(!document.hidden && location.pathname==='/' && state.authenticated) loadOverview(true)
})

async function restore(){
  try{
    const me=await api('/api/v1/auth/me'); state.authenticated=true; state.username=me.username; state.csrf=me.csrf_token; state.sessionID=me.session_id
    state.settings=await api('/api/v1/settings')
  }catch{ state.authenticated=false; state.csrf='' }
  render()
}

function navItems(){return [
  ['概览','/','home'],['系统管理','/system','server'],['文件管理','/files','folder'],['Docker','/docker','container'],['常用工具','/tools','wrench'],['日志审计','/audit','scroll'],['安全设置','/security','shield']
]}
function isActive(href){ return href==='/' ? location.pathname==='/' : location.pathname===href || (href==='/system' && ['/services','/processes','/network','/storage','/tasks','/updates'].includes(location.pathname)) }
function shell(content){
  const nav=navItems()
  return `<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div><strong>LukePanel</strong><span>${escapeHTML(state.settings?.version||'轻量系统管理')}</span></div></div><nav class="sidebar-nav">${nav.map(([label,href,i])=>`<a data-nav href="${href}" class="${isActive(href)?'active':''}">${icon(i,19)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-footer"><button id="theme-toggle" class="icon-text-button">${icon(theme()==='dark'?'sun':'moon',18)}${theme()==='dark'?'浅色模式':'深色模式'}</button><button id="logout" class="icon-text-button danger-text">${icon('logout',18)}退出登录</button></div></aside><main class="main-content">${content}</main><nav class="mobile-nav">${nav.filter(([,href])=>['/','/system','/docker','/tools','/security'].includes(href)).map(([label,href,i])=>`<a data-nav href="${href}" class="${isActive(href)?'active':''}">${icon(href==='/security'?'user':i,21)}<span>${href==='/security'?'我的':label.replace('管理','')}</span></a>`).join('')}</nav>${modalHTML()}</div>`
}
function pageHeader(title,description='',actions=''){return `<header class="page-header"><div><h1>${escapeHTML(title)}</h1>${description?`<p>${escapeHTML(description)}</p>`:''}</div><div class="page-header__actions">${actions}</div></header>`}
function surfaceLoading(text='正在加载'){return `<section class="placeholder surface"><div class="spinner"></div><strong>${escapeHTML(text)}</strong></section>`}
function errorBox(message){return message?`<div class="alert error">${icon('alert',18)}${escapeHTML(message)}</div>`:''}
function formatBytes(value){let v=Number(value||0);const u=['B','KB','MB','GB','TB'];let i=0;while(v>=1024&&i<u.length-1){v/=1024;i++}return `${v.toFixed(i<2?0:1)} ${u[i]}`}
function formatRate(value){return `${formatBytes(value)}/s`}
function formatUptime(sec){const d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60);return `${d} 天 ${h} 小时 ${m} 分钟`}
function formatDate(value){try{return new Date(value).toLocaleString()}catch{return value||'-'}}
function metric(label,value,detail,percent,id){return `<article class="metric-card surface" data-metric="${id}"><div class="metric-card__header"><span>${label}</span><strong data-value>${value}</strong></div>${percent!==undefined?`<div class="progress"><span data-progress style="width:${clamp(percent)}%"></span></div>`:''}<p data-detail>${detail||''}</p></article>`}
function clamp(v){return Math.min(100,Math.max(0,Number(v)||0))}
function statusBadge(status){const kind=['running','active'].includes(status)?'success':['exited','inactive','failed','dead'].includes(status)?'muted':'warning';return `<span class="status-badge ${kind}"><i></i>${escapeHTML(status||'unknown')}</span>`}

function renderLogin(){
  stopAutoRefresh()
  app.innerHTML=`<main class="login-page"><section class="login-card surface"><div class="login-logo">L</div><h1>登录 LukePanel</h1><p>安全、轻量地管理你的服务器</p><form id="login-form"><label>用户名<input name="username" value="admin" autocomplete="username"></label><label>密码<div class="password-field"><input name="password" type="password" autocomplete="current-password" autofocus><button type="button" id="show-password">显示</button></div></label><div id="login-error" class="form-error" hidden></div><button class="primary-button" type="submit">登录</button></form><div class="security-note">${icon('shield',17)}会话仅通过 HttpOnly Cookie 保存</div></section></main>`
  document.querySelector('#show-password').onclick=e=>{const input=document.querySelector('[name=password]');input.type=input.type==='password'?'text':'password';e.currentTarget.textContent=input.type==='password'?'显示':'隐藏'}
  document.querySelector('#login-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type=submit]'),error=document.querySelector('#login-error');button.disabled=true;button.textContent='正在登录…';error.hidden=true;try{const r=await api('/api/v1/auth/login',{method:'POST',body:jsonBody({username:f.get('username'),password:f.get('password')})});state.authenticated=true;state.username=r.username;state.csrf=r.csrf_token;state.settings=await api('/api/v1/settings');navigate('/')}catch(err){error.textContent=err.message;error.hidden=false}finally{button.disabled=false;button.textContent='登录'}}
}

async function loadOverview(silent=false){
  if(state.loading.overview) return
  state.loading.overview=true; state.errors.overview=''
  try{const d=await api('/api/v1/system/overview');state.overview=d;if(silent&&location.pathname==='/'&&document.querySelector('[data-dashboard]'))updateDashboard(d);else render()}
  catch(e){state.errors.overview=e.message;if(!silent)render()}
  finally{state.loading.overview=false;document.querySelector('#refresh-overview svg')?.classList.remove('spin')}
}
function dashboard(){
  const d=state.overview
  if(!d){if(state.errors.overview)return `<div class="page-wrap">${pageHeader('系统概览','系统状态读取失败',`<button id="refresh-overview" class="secondary-button compact">${icon('refresh',17)}重试</button>`)}${errorBox(state.errors.overview)}</div>`;queueMicrotask(()=>loadOverview());return `<div class="page-wrap">${pageHeader('系统概览','正在读取实时状态')}${surfaceLoading('正在采集系统信息')}</div>`}
  const mp=d.memory.Total?d.memory.Used/d.memory.Total*100:0,dp=d.disk.Total?d.disk.Used/d.disk.Total*100:0
  return `<div class="page-wrap" data-dashboard>${pageHeader('系统概览',`${d.hostname} · ${d.os}`,`<button id="refresh-overview" class="secondary-button compact">${icon('refresh',17,state.loading.overview?'spin':'')}<span>刷新</span></button>`)}${errorBox(state.errors.overview)}<section class="status-hero surface"><div><span class="status-dot"></span><strong>系统运行正常</strong><p>${icon('clock',16)}已运行 <span data-uptime>${formatUptime(d.uptime_seconds)}</span></p></div><div class="collection-time">自动刷新：${state.settings?.auto_refresh_seconds||5} 秒<br><span data-collected>${formatDate(d.collected_at)}</span></div></section><section class="metrics-grid">${metric('CPU',`${d.cpu_percent.toFixed(1)}%`,`${d.cpu_cores} 核 · 负载 ${d.load_1.toFixed(2)} / ${d.load_5.toFixed(2)} / ${d.load_15.toFixed(2)}`,d.cpu_percent,'cpu')}${metric('内存',`${mp.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`,mp,'memory')}${metric('系统盘',`${dp.toFixed(1)}%`,`${formatBytes(d.disk.Used)} / ${formatBytes(d.disk.Total)}`,dp,'disk')}${metric('实时网络',`↓ ${formatRate(d.network.download_bps)}`,`↑ ${formatRate(d.network.upload_bps)} · 累计 ↓ ${formatBytes(d.network.received_bytes)}`,undefined,'network')}</section><section class="dashboard-grid"><article class="surface summary-card" id="dashboard-docker"><div class="card-heading">${icon('container',19)}<strong>Docker</strong></div><div class="empty-state"><button class="text-link" id="load-dashboard-docker">读取容器状态</button></div></article><article class="surface summary-card"><div class="card-heading">${icon('server',19)}<strong>系统信息</strong></div><dl class="info-list"><div><dt>内核</dt><dd>${escapeHTML(d.kernel)}</dd></div><div><dt>架构</dt><dd>${escapeHTML(d.architecture)}</dd></div><div><dt>Swap</dt><dd>${formatBytes(d.memory.SwapUsed)} / ${formatBytes(d.memory.SwapTotal)}</dd></div></dl></article></section></div>`
}
function updateDashboard(d){
  const mp=d.memory.Total?d.memory.Used/d.memory.Total*100:0,dp=d.disk.Total?d.disk.Used/d.disk.Total*100:0
  updateMetric('cpu',`${d.cpu_percent.toFixed(1)}%`,`${d.cpu_cores} 核 · 负载 ${d.load_1.toFixed(2)} / ${d.load_5.toFixed(2)} / ${d.load_15.toFixed(2)}`,d.cpu_percent)
  updateMetric('memory',`${mp.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`,mp)
  updateMetric('disk',`${dp.toFixed(1)}%`,`${formatBytes(d.disk.Used)} / ${formatBytes(d.disk.Total)}`,dp)
  updateMetric('network',`↓ ${formatRate(d.network.download_bps)}`,`↑ ${formatRate(d.network.upload_bps)} · 累计 ↓ ${formatBytes(d.network.received_bytes)}`)
  const uptime=document.querySelector('[data-uptime]');if(uptime)uptime.textContent=formatUptime(d.uptime_seconds)
  const collected=document.querySelector('[data-collected]');if(collected)collected.textContent=formatDate(d.collected_at)
}
function updateMetric(id,value,detail,percent){const root=document.querySelector(`[data-metric="${id}"]`);if(!root)return;root.querySelector('[data-value]').textContent=value;root.querySelector('[data-detail]').textContent=detail;if(percent!==undefined){const p=root.querySelector('[data-progress]');if(p)p.style.width=`${clamp(percent)}%`}}
function syncAutoRefresh(){stopAutoRefresh();if(!state.authenticated||document.hidden||location.pathname!=='/')return;const seconds=Math.max(2,Number(state.settings?.auto_refresh_seconds||5));state.refreshTimer=setInterval(()=>loadOverview(true),seconds*1000)}
function stopAutoRefresh(){if(state.refreshTimer){clearInterval(state.refreshTimer);state.refreshTimer=null}}

function systemPage(){
  const modules=[
    ['服务管理','systemd 状态、控制与日志','/services','power',true],['文件管理','上传、下载与安全编辑','/files','folder',true],['日志中心','系统日志与操作审计','/audit','scroll',true],['Docker','容器状态、控制与日志','/docker','container',true],
    ['进程管理','CPU、内存排行与进程结束','/processes','activity',true],['网络管理','接口、流量与监听端口','/network','network',true],['存储管理','分区、文件系统与空间','/storage','drive',true],['计划任务','systemd timer 查看','/tasks','calendar',true],['软件更新','APT 可升级软件包检查','/updates','package',true],['SSH 管理','密钥、登录与安全配置','','key',false]
  ]
  return `<div class="page-wrap">${pageHeader('系统管理','核心模块已可用，危险操作均需要明确确认')}<section class="module-grid">${modules.map(([t,d,p,i,ready])=>`<${ready?'a':'article'} ${ready?`data-nav href="${p}"`:''} class="module-card surface ${ready?'':'muted'}"><div class="module-icon">${icon(i,22)}</div><div><strong>${t}</strong><p>${d}</p></div>${icon('chevron',19)}${ready?'':'<span class="soon-badge">后续迭代</span>'}</${ready?'a':'article'}>`).join('')}</section></div>`
}

async function loadServices(query=''){state.loading.services=true;state.errors.services='';try{state.services=await api(`/api/v1/system/services?query=${encodeURIComponent(query)}`)}catch(e){state.errors.services=e.message}finally{state.loading.services=false;render()}}
function servicesPage(){const data=state.services;if(!data&&state.errors.services){return `<div class="page-wrap">${pageHeader('服务管理','无法读取 systemd 服务',`<button id="refresh-services" class="secondary-button compact">重试</button>`)}${errorBox(state.errors.services)}</div>`}if(!data){queueMicrotask(()=>loadServices());return `<div class="page-wrap">${pageHeader('服务管理','读取 systemd 服务')}${surfaceLoading()}</div>`}return `<div class="page-wrap">${pageHeader('服务管理','启动、停止、重启与查看 journald 日志',`<button id="refresh-services" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.services)}<div class="search-bar surface">${icon('search',18)}<input id="service-search" placeholder="搜索服务名称或描述"><span>${data.services.length} 项</span></div><section class="card-list">${data.services.map(service=>`<article class="resource-card surface"><div class="resource-main"><div><strong>${escapeHTML(service.name)}</strong>${statusBadge(service.active)}</div><p>${escapeHTML(service.description||'无描述')}</p><small>${escapeHTML(service.sub)} · ${escapeHTML(service.enabled||'unknown')}</small></div><div class="resource-actions"><button class="secondary-button compact" data-service-logs="${escapeHTML(service.name)}">日志</button>${service.active==='active'?`<button class="secondary-button compact" data-service-action="restart" data-name="${escapeHTML(service.name)}">重启</button><button class="danger-button compact" data-service-action="stop" data-name="${escapeHTML(service.name)}">停止</button>`:`<button class="primary-button compact" data-service-action="start" data-name="${escapeHTML(service.name)}">启动</button>`}</div></article>`).join('')||'<div class="empty-list surface">没有匹配的服务</div>'}</section></div>`}
async function serviceAction(name,action){if(['stop','restart'].includes(action)&&!confirm(`确认${action==='stop'?'停止':'重启'} ${name}？`))return;setBusy(true);try{await secureApi('/api/v1/system/services/action',{method:'POST',body:jsonBody({name,action})});await loadServices(document.querySelector('#service-search')?.value||'')}catch(e){alert(e.message)}finally{setBusy(false)}}
async function showServiceLogs(name){state.modal={title:name,kind:'logs',content:'正在读取日志…'};render();try{const data=await api(`/api/v1/system/services/logs?name=${encodeURIComponent(name)}&lines=400`);state.modal={title:`${name} 日志`,kind:'logs',content:data.logs||'暂无日志'};render()}catch(e){state.modal={title:name,kind:'error',content:e.message};render()}}


async function loadProcesses(silent=false){
  if(state.loading.processes)return;state.loading.processes=true;state.errors.processes=''
  try{state.processes=await api('/api/v1/system/processes');if(!state.processPrimed){state.processPrimed=true;setTimeout(()=>{if(location.pathname==='/processes')loadProcesses(true)},1200)};if(!silent)render();else updateProcessRows()}
  catch(e){state.errors.processes=e.message;if(!silent)render()}finally{state.loading.processes=false}
}
function processesPage(){const data=state.processes;if(!data&&!state.errors.processes){queueMicrotask(()=>loadProcesses());return `<div class="page-wrap">${pageHeader('进程管理','采集进程状态')}${surfaceLoading()}</div>`}return `<div class="page-wrap">${pageHeader('进程管理','按实时 CPU 和内存占用排序',`<button id="refresh-processes" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.processes)}<section class="process-table surface"><div class="process-head"><span>进程</span><span>用户</span><span>CPU</span><span>内存</span><span>PID</span><span></span></div><div id="process-rows">${processRowsHTML()}</div></section></div>`}
function processRowsHTML(){return (state.processes?.processes||[]).map(p=>`<div class="process-row"><div><strong>${escapeHTML(p.command)}</strong><small>${escapeHTML(p.state)}</small></div><span>${escapeHTML(p.user)}</span><b>${Number(p.cpu_percent||0).toFixed(1)}%</b><span>${formatBytes(p.memory_bytes)}</span><code>${p.pid}</code><button class="more-button" data-process-pid="${p.pid}" data-process-name="${escapeHTML(p.command)}">${icon('more',18)}</button></div>`).join('')||'<div class="empty-list">暂无进程数据</div>'}
function updateProcessRows(){const root=document.querySelector('#process-rows');if(root)root.innerHTML=processRowsHTML();document.querySelectorAll('[data-process-pid]').forEach(bindProcessButton)}
function bindProcessButton(button){button.onclick=()=>{const pid=Number(button.dataset.processPid),name=button.dataset.processName;state.modal={title:`进程 ${pid}`,kind:'process',content:name,pid};render()}}
async function signalProcess(pid,signal){if(!confirm(signal==='kill'?`强制结束 PID ${pid}？可能导致数据损坏。`:`正常结束 PID ${pid}？`))return;try{await secureApi('/api/v1/system/processes/action',{method:'POST',body:jsonBody({pid,signal})});state.modal=null;await loadProcesses()}catch(e){alert(e.message)}}

async function loadNetwork(){state.errors.network='';try{state.network=await api('/api/v1/system/network')}catch(e){state.errors.network=e.message}finally{render()}}
function networkPage(){if(!state.network&&!state.errors.network){queueMicrotask(loadNetwork);return `<div class="page-wrap">${pageHeader('网络管理','读取网络接口')}${surfaceLoading()}</div>`}return `<div class="page-wrap">${pageHeader('网络管理','接口地址、累计流量与监听端口',`<button id="refresh-network" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.network)}<section class="interface-grid">${(state.network?.interfaces||[]).map(i=>`<article class="surface interface-card"><div><strong>${escapeHTML(i.name)}</strong><span>${escapeHTML(i.flags)}</span></div><p>${(i.addresses||[]).map(escapeHTML).join('<br>')||'无地址'}</p><small>MTU ${i.mtu} · ↓ ${formatBytes(i.received_bytes)} · ↑ ${formatBytes(i.sent_bytes)}</small></article>`).join('')}</section><section class="result-panel surface"><div class="card-heading">${icon('network',19)}<strong>监听端口</strong></div><pre>${escapeHTML(state.network?.listening||'未读取到监听端口')}</pre></section></div>`}

async function loadStorage(){state.errors.storage='';try{state.storage=await api('/api/v1/system/storage')}catch(e){state.errors.storage=e.message}finally{render()}}
function storagePage(){if(!state.storage&&!state.errors.storage){queueMicrotask(loadStorage);return `<div class="page-wrap">${pageHeader('存储管理','读取文件系统')}${surfaceLoading()}</div>`}return `<div class="page-wrap">${pageHeader('存储管理','文件系统、挂载点与空间占用',`<button id="refresh-storage" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.storage)}<section class="storage-grid">${(state.storage?.mounts||[]).map(m=>{const pct=m.total?m.used/m.total*100:0;return `<article class="surface storage-card"><div><strong>${escapeHTML(m.mountpoint)}</strong><span>${escapeHTML(m.filesystem)}</span></div><p>${escapeHTML(m.device)}</p><div class="progress"><span style="width:${clamp(pct)}%"></span></div><small>${pct.toFixed(1)}% · ${formatBytes(m.used)} / ${formatBytes(m.total)}</small></article>`}).join('')||'<div class="empty-list surface">暂无挂载点</div>'}</section></div>`}

async function loadTimers(){state.errors.timers='';try{state.timers=await api('/api/v1/system/timers')}catch(e){state.errors.timers=e.message}finally{render()}}
function tasksPage(){if(!state.timers&&!state.errors.timers){queueMicrotask(loadTimers);return `<div class="page-wrap">${pageHeader('计划任务','读取 systemd timers')}${surfaceLoading()}</div>`}return `<div class="page-wrap">${pageHeader('计划任务','当前版本先提供 systemd timer 查看',`<button id="refresh-timers" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.timers)}<section class="result-panel surface"><pre>${escapeHTML(state.timers?.timers||'没有 timer')}</pre></section></div>`}

async function loadUpdates(){state.errors.updates='';try{state.updates=await api('/api/v1/system/updates')}catch(e){state.errors.updates=e.message}finally{render()}}
function updatesPage(){if(!state.updates&&!state.errors.updates){queueMicrotask(loadUpdates);return `<div class="page-wrap">${pageHeader('软件更新','模拟检查 APT 更新')}${surfaceLoading('检查可升级软件包')}</div>`}return `<div class="page-wrap">${pageHeader('软件更新','只读模拟检查，不会自动执行升级',`<button id="refresh-updates" class="secondary-button compact">${icon('refresh',17)}<span>重新检查</span></button>`)}${errorBox(state.errors.updates)}<section class="update-summary surface"><div class="update-count"><strong>${state.updates?.count||0}</strong><span>个软件包可升级</span></div><p>${state.updates?.available?'使用 apt-get 模拟升级结果，不会修改系统。':escapeHTML(state.updates?.output||'APT 不可用')}</p></section><section class="package-list surface">${(state.updates?.packages||[]).map(x=>`<span>${escapeHTML(x)}</span>`).join('')||'<div class="empty-list">系统已是最新状态或暂未获取到更新</div>'}</section></div>`}

async function loadDocker(){
  state.loading.docker=true;state.errors.docker=''
  try{
    const status=await api('/api/v1/docker/status');state.dockerStatus=status
    if(!status.available)throw new Error(status.error||'Docker 不可用')
    const [containers,images,networks,volumes]=await Promise.all([api('/api/v1/docker/containers'),api('/api/v1/docker/images'),api('/api/v1/docker/networks'),api('/api/v1/docker/volumes')])
    state.docker=containers;state.dockerImages=images;state.dockerNetworks=networks;state.dockerVolumes=volumes
  }catch(e){state.errors.docker=e.message}finally{state.loading.docker=false;render()}
}
function containerName(c){return (c.names?.[0]||c.id.slice(0,12)).replace(/^\//,'')}
function portText(c){const p=(c.ports||[]).filter(x=>x.PublicPort).map(x=>`${x.PublicPort}:${x.PrivatePort}/${x.Type}`);return p.length?p.join(' · '):'无公开端口'}
function imageName(i){return i.repo_tags?.[0]||i.id.replace(/^sha256:/,'').slice(0,12)}
function dockerPage(){
  if(!state.docker&&!state.errors.docker){queueMicrotask(loadDocker);return `<div class="page-wrap">${pageHeader('Docker','正在连接 Docker Engine')}${surfaceLoading()}</div>`}
  const containers=state.docker?.containers||[],images=state.dockerImages?.images||[],networks=state.dockerNetworks?.networks||[],volumes=state.dockerVolumes?.volumes||[]
  const tabs=[['containers',`容器 ${containers.length}`],['images',`镜像 ${images.length}`],['networks',`网络 ${networks.length}`],['volumes',`存储卷 ${volumes.length}`]]
  return `<div class="page-wrap">${pageHeader('Docker',state.dockerStatus?.available?`Docker ${state.dockerStatus.version}`:'容器引擎不可用',`<button id="pull-image" class="primary-button compact">${icon('download',17)}<span>拉取镜像</span></button><button id="refresh-docker" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.docker||state.dockerStatus?.error)}${state.docker?`<div class="tab-bar surface">${tabs.map(([key,label])=>`<button data-docker-tab="${key}" class="${state.dockerTab===key?'active':''}">${label}</button>`).join('')}</div>${dockerTabContent(containers,images,networks,volumes)}`:''}</div>`
}
function dockerTabContent(containers,images,networks,volumes){
  if(state.dockerTab==='images')return `<section class="resource-grid">${images.map(i=>`<article class="surface docker-resource-card"><div><strong>${escapeHTML(imageName(i))}</strong><span>${formatBytes(i.size)}</span></div><p>${escapeHTML(i.id.replace(/^sha256:/,'').slice(0,20))}</p><small>${formatDate(Number(i.created)*1000)} · ${i.containers>=0?`${i.containers} 个容器引用`:'引用未知'}</small><button class="danger-button compact" data-image-delete="${escapeHTML(i.id)}">删除</button></article>`).join('')||'<div class="empty-list surface">暂无镜像</div>'}</section>`
  if(state.dockerTab==='networks')return `<section class="resource-grid">${networks.map(n=>`<article class="surface docker-resource-card"><div><strong>${escapeHTML(n.name)}</strong><span>${escapeHTML(n.driver)}</span></div><p>${escapeHTML(n.id.slice(0,20))}</p><small>${escapeHTML(n.scope)}${n.internal?' · 内部网络':''}</small>${['bridge','host','none'].includes(n.name)?'<em>系统网络</em>':`<button class="danger-button compact" data-network-delete="${escapeHTML(n.id)}" data-name="${escapeHTML(n.name)}">删除</button>`}</article>`).join('')||'<div class="empty-list surface">暂无网络</div>'}</section>`
  if(state.dockerTab==='volumes')return `<section class="resource-grid">${volumes.map(v=>`<article class="surface docker-resource-card"><div><strong>${escapeHTML(v.name)}</strong><span>${escapeHTML(v.driver)}</span></div><p>${escapeHTML(v.mountpoint)}</p><small>${escapeHTML(v.scope)}</small><button class="danger-button compact" data-volume-delete="${escapeHTML(v.name)}">删除</button></article>`).join('')||'<div class="empty-list surface">暂无存储卷</div>'}</section>`
  return `<section class="container-grid">${containers.map(c=>`<article class="container-card surface"><div class="container-card__top"><div class="container-icon">${icon('container',21)}</div><div><strong>${escapeHTML(containerName(c))}</strong>${statusBadge(c.state)}</div></div><p>${escapeHTML(c.image)}</p><small>${escapeHTML(c.status)}<br>${escapeHTML(portText(c))}</small><div class="resource-actions"><button class="secondary-button compact" data-docker-logs="${escapeHTML(c.id)}" data-title="${escapeHTML(containerName(c))}">日志</button>${c.state==='running'?`<button class="secondary-button compact" data-docker-action="restart" data-id="${escapeHTML(c.id)}">重启</button><button class="danger-button compact" data-docker-action="stop" data-id="${escapeHTML(c.id)}">停止</button>`:`<button class="primary-button compact" data-docker-action="start" data-id="${escapeHTML(c.id)}">启动</button><button class="danger-button compact" data-docker-action="remove" data-id="${escapeHTML(c.id)}">删除</button>`}</div></article>`).join('')||'<div class="empty-list surface">暂未发现容器</div>'}</section>`
}
async function dockerAction(id,action){if(['stop','restart','kill','remove'].includes(action)&&!confirm(`确认执行 ${action}？`))return;setBusy(true);try{await secureApi('/api/v1/docker/action',{method:'POST',body:jsonBody({id,action})});await loadDocker()}catch(e){alert(e.message)}finally{setBusy(false)}}
async function showDockerLogs(id,title){state.modal={title,kind:'logs',content:'正在读取日志…'};render();try{const data=await api(`/api/v1/docker/logs?id=${encodeURIComponent(id)}&tail=500`);state.modal={title:`${title} 日志`,kind:'logs',content:data.logs||'暂无日志'};render()}catch(e){state.modal={title,kind:'error',content:e.message};render()}}
async function pullImage(){const reference=prompt('镜像名称，例如 nginx:latest');if(!reference)return;setBusy(true);try{await secureApi('/api/v1/docker/images/pull',{method:'POST',body:jsonBody({reference})});state.dockerTab='images';await loadDocker()}catch(e){alert(e.message)}finally{setBusy(false)}}
async function deleteDockerResource(kind,value,label=value){if(!confirm(`确认删除 ${label}？正在使用的资源会被 Docker 拒绝。`))return;const map={image:['/api/v1/docker/images/delete',{id:value}],network:['/api/v1/docker/networks/delete',{id:value}],volume:['/api/v1/docker/volumes/delete',{name:value}]};setBusy(true);try{await secureApi(map[kind][0],{method:'POST',body:jsonBody(map[kind][1])});await loadDocker()}catch(e){alert(e.message)}finally{setBusy(false)}}

async function loadFiles(path='/'){state.loading.files=true;state.errors.files='';try{state.files=await api(`/api/v1/files?path=${encodeURIComponent(path)}`);state.fileContent=null}catch(e){state.errors.files=e.message}finally{state.loading.files=false;render()}}
function filesPage(){const l=state.files;if(!l&&!state.errors.files){queueMicrotask(()=>loadFiles('/'));return `<div class="page-wrap">${pageHeader('文件管理','读取允许访问的位置')}${surfaceLoading()}</div>`}return `<div class="page-wrap files-page">${pageHeader('文件管理','支持上传、下载、回收站删除与文本安全编辑',`<button id="new-file" class="secondary-button compact">${icon('plus',17)}<span>新建</span></button><button id="upload-file" class="primary-button compact">${icon('upload',17)}<span>上传</span></button><input id="upload-input" type="file" hidden>`)}${errorBox(state.errors.files)}${l?`<div class="file-toolbar surface"><button id="file-back" ${l.parent?'':'disabled'}>${icon('back',19)}</button><button id="file-home">${icon('home',18)}</button><div class="path-pill">${escapeHTML(l.path==='/'?'允许访问的位置':l.path)}</div><button id="refresh-files">${icon('refresh',18)}</button></div><section class="file-list surface">${l.entries.map(item=>`<button class="file-row" data-file-path="${escapeHTML(item.path)}" data-directory="${item.is_dir}"><div class="file-icon">${icon(item.is_dir?'folder':'file',22)}</div><div class="file-main"><strong>${escapeHTML(item.name)}</strong><span>${item.is_dir?'文件夹':formatBytes(item.size)} · ${formatDate(item.modified_at)}</span></div><code>${escapeHTML(item.mode)}</code>${icon('chevron',18)}</button>`).join('')||'<div class="empty-list">这个目录是空的</div>'}</section>`:''}</div>`}
async function openFile(path){state.modal={title:'读取文件',kind:'loading',content:''};render();try{const data=await api(`/api/v1/files/content?path=${encodeURIComponent(path)}`);state.fileContent=data;state.modal={title:data.name,kind:'editor',content:data.content,path:data.path,dirty:false};render()}catch(e){state.modal={title:'无法打开文件',kind:'error',content:e.message};render()}}
async function saveFile(){const editor=document.querySelector('#file-editor');if(!editor||!state.modal?.path)return;const button=document.querySelector('#save-file');button.disabled=true;button.textContent='保存中…';try{await secureApi('/api/v1/files/content',{method:'PUT',body:jsonBody({path:state.modal.path,content:editor.value})});state.modal.content=editor.value;state.modal.dirty=false;button.textContent='已保存';setTimeout(()=>{if(document.querySelector('#save-file'))document.querySelector('#save-file').textContent='保存'},1200)}catch(e){alert(e.message);button.textContent='保存'}finally{button.disabled=false}}
async function createEntry(){if(!state.files||state.files.path==='/'){alert('请先进入一个实际目录');return}const type=confirm('确定创建文件夹？\n点“取消”则创建文件。')?'folder':'file';const name=prompt(type==='folder'?'文件夹名称':'文件名称');if(!name)return;const base=state.files.path.replace(/\/$/,'');const path=`${base}/${name}`;try{await secureApi(type==='folder'?'/api/v1/files/mkdir':'/api/v1/files/create',{method:'POST',body:jsonBody({path})});await loadFiles(state.files.path)}catch(e){alert(e.message)}}
async function uploadSelected(file){if(!state.files||state.files.path==='/'){alert('请先进入目标目录');return}const form=new FormData();form.append('directory',state.files.path);form.append('file',file);setBusy(true);try{await secureApi('/api/v1/files/upload',{method:'POST',body:form});await loadFiles(state.files.path)}catch(e){alert(e.message)}finally{setBusy(false)}}
async function renameCurrent(){const old=state.modal?.path;if(!old)return;const name=prompt('新名称',old.split('/').pop());if(!name)return;const destination=`${old.slice(0,old.lastIndexOf('/'))}/${name}`;try{await secureApi('/api/v1/files/rename',{method:'POST',body:jsonBody({source:old,destination})});state.modal=null;await loadFiles(state.files.path)}catch(e){alert(e.message)}}
async function deleteCurrent(){const path=state.modal?.path;if(!path||!confirm(`将 ${path} 移入回收站？`))return;try{await secureApi('/api/v1/files/delete',{method:'POST',body:jsonBody({path})});state.modal=null;await loadFiles(state.files.path)}catch(e){alert(e.message)}}

function toolsPage(){return `<div class="page-wrap">${pageHeader('常用工具','结果实时返回，不保存敏感请求内容')}<section class="tools-grid">${[['ping','Ping','测试基础网络延迟','example.com',''],['dns','DNS 查询','解析 A / AAAA 地址','example.com',''],['tcp','TCP 端口','测试目标端口连通性','example.com','443'],['http','HTTP 检查','查看状态码、跳转与耗时','https://example.com','']].map(([tool,title,desc,placeholder,port])=>`<article class="tool-card surface"><div class="tool-icon">${icon(tool==='dns'?'network':tool==='tcp'?'server':tool==='http'?'activity':'terminal',22)}</div><h2>${title}</h2><p>${desc}</p><form class="tool-form" data-tool="${tool}"><input name="target" placeholder="${placeholder}" required>${port?`<input name="port" type="number" value="${port}" min="1" max="65535">`:''}<button class="primary-button" type="submit">开始测试</button></form></article>`).join('')}</section><section id="tool-result" class="result-panel surface" hidden><div class="card-heading">${icon('terminal',19)}<strong>测试结果</strong></div><pre></pre></section></div>`}
async function runTool(form){const f=new FormData(form),button=form.querySelector('button'),result=document.querySelector('#tool-result'),pre=result.querySelector('pre');button.disabled=true;button.textContent='测试中…';result.hidden=false;pre.textContent='正在执行…';try{const data=await api('/api/v1/tools/run',{method:'POST',body:jsonBody({tool:form.dataset.tool,target:f.get('target'),port:Number(f.get('port')||0)})});pre.textContent=(data.output||'完成')+`\n\n耗时：${data.duration_ms} ms`}catch(e){pre.textContent=e.message}finally{button.disabled=false;button.textContent='开始测试'}}

async function loadAudit(){state.loading.audit=true;state.errors.audit='';try{const [audit,logs]=await Promise.all([api('/api/v1/audit?limit=500'),api('/api/v1/logs/system?lines=400')]);state.audit=audit;state.systemLogs=logs}catch(e){state.errors.audit=e.message}finally{state.loading.audit=false;render()}}
function auditPage(){if(!state.audit&&!state.errors.audit){queueMicrotask(loadAudit);return `<div class="page-wrap">${pageHeader('日志审计','读取日志')}${surfaceLoading()}</div>`}return `<div class="page-wrap">${pageHeader('日志审计','系统日志与面板操作记录',`<button id="refresh-audit" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.audit)}<div class="tab-bar surface"><button class="active" data-log-tab="audit">操作审计</button><button data-log-tab="system">系统日志</button></div><section id="audit-panel" class="audit-list surface">${(state.audit?.events||[]).map(e=>`<div class="audit-row"><time>${formatDate(e.time)}</time><div><strong>${escapeHTML(e.action)}</strong><p>${escapeHTML(e.target||'-')}</p></div><span>${escapeHTML(e.user||'-')} · ${escapeHTML(e.ip||'-')}</span><b class="${e.result==='success'?'ok':'bad'}">${escapeHTML(e.result)}</b></div>`).join('')||'<div class="empty-list">暂无审计记录</div>'}</section><section id="system-log-panel" class="log-view surface" hidden><pre>${escapeHTML(state.systemLogs?.logs||'暂无系统日志')}</pre></section></div>`}

async function loadSecurity(){if(state.loading.security)return;state.loading.security=true;try{const [settings,sessions]=await Promise.all([api('/api/v1/settings'),api('/api/v1/auth/sessions')]);state.settings=settings;state.sessions=sessions}catch(e){state.errors.security=e.message}finally{state.loading.security=false;render()}}
function securityPage(){if((!state.settings||!state.sessions)&&!state.errors.security){queueMicrotask(loadSecurity)}return `<div class="page-wrap">${pageHeader('我的与安全','账户、会话、刷新策略与面板安全')}${errorBox(state.errors.security)}<section class="settings-list surface"><div class="setting-row"><div class="setting-icon">${icon('shield',21)}</div><div><strong>当前账户</strong><p>${escapeHTML(state.username)} · 当前会话 ${escapeHTML(state.sessionID||'-')}</p></div><span>${escapeHTML(state.settings?.version||'dev')}</span></div><div class="setting-row"><div class="setting-icon">${icon('refresh',21)}</div><div><strong>概览自动刷新</strong><p>页面在前台时自动刷新，切到后台会暂停</p></div><select id="refresh-interval"><option value="2">2 秒</option><option value="5">5 秒</option><option value="10">10 秒</option><option value="30">30 秒</option><option value="60">60 秒</option></select></div><div class="setting-row"><div class="setting-icon">${icon('clock',21)}</div><div><strong>活跃会话</strong><p>${state.sessions?.sessions?.length||1} 个会话，密码修改后其余会话会失效</p></div><button id="revoke-sessions" class="secondary-button compact">退出其他设备</button></div><div class="setting-row muted"><div class="setting-icon">${icon('key',21)}</div><div><strong>TOTP / Passkey</strong><p>需要下一阶段补充完整恢复流程后开放</p></div><span>规划中</span></div></section><section class="password-panel surface"><h2>修改登录密码</h2><p>新密码至少 12 个字符，保存后其他会话会自动退出。</p><form id="password-form"><label>当前密码<input name="current" type="password" autocomplete="current-password"></label><label>新密码<input name="next" type="password" minlength="12" autocomplete="new-password"></label><label>确认新密码<input name="confirm" type="password" minlength="12" autocomplete="new-password"></label><div id="password-message" class="form-error" hidden></div><button class="primary-button" type="submit">保存新密码</button></form></section><section class="security-meta surface"><dl class="info-list"><div><dt>监听</dt><dd>${escapeHTML(state.settings?.listen||'-')}</dd></div><div><dt>安全 Cookie</dt><dd>${state.settings?.secure_cookie?'已开启':'已关闭'}</dd></div><div><dt>Agent Socket</dt><dd>${escapeHTML(state.settings?.agent_socket||'-')}</dd></div></dl></section></div>`}

function modalHTML(){if(!state.modal)return'';const m=state.modal;let body='';if(m.kind==='loading')body='<div class="modal-loading"><div class="spinner"></div></div>';else if(m.kind==='logs')body=`<pre class="modal-log">${escapeHTML(m.content)}</pre>`;else if(m.kind==='error')body=`<div class="alert error">${icon('alert',18)}${escapeHTML(m.content)}</div>`;else if(m.kind==='editor')body=`<textarea id="file-editor" spellcheck="false">${escapeHTML(m.content)}</textarea>`;else if(m.kind==='process')body=`<div class="process-dialog"><p>${escapeHTML(m.content)}</p><code>PID ${m.pid}</code><button class="secondary-button" id="process-term">正常结束 SIGTERM</button><button class="danger-button" id="process-kill">强制结束 SIGKILL</button></div>`;return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal-card ${m.kind==='editor'||m.kind==='logs'?'wide':''}"><header><div><strong>${escapeHTML(m.title)}</strong>${m.path?`<small>${escapeHTML(m.path)}</small>`:''}</div><button id="modal-close">${icon('close',20)}</button></header><div class="modal-body">${body}</div>${m.kind==='editor'?`<footer><div><button id="download-file" class="secondary-button compact">${icon('download',16)}下载</button><button id="rename-file" class="secondary-button compact">重命名</button><button id="delete-file" class="danger-button compact">${icon('trash',16)}删除</button></div><button id="save-file" class="primary-button compact">${icon('save',16)}保存</button></footer>`:''}</section></div>`}

function bindShell(){
  document.querySelector('#theme-toggle')?.addEventListener('click',()=>{applyTheme(theme()==='dark'?'light':'dark');render()})
  document.querySelector('#logout')?.addEventListener('click',async()=>{await api('/api/v1/auth/logout',{method:'POST'});state.authenticated=false;state.csrf='';render()})
  document.querySelector('#refresh-overview')?.addEventListener('click',e=>{e.currentTarget.querySelector('svg')?.classList.add('spin');loadOverview(true)})
  document.querySelector('#load-dashboard-docker')?.addEventListener('click',async()=>{const box=document.querySelector('#dashboard-docker .empty-state');box.innerHTML='<div class="spinner"></div>';try{const [status,data]=await Promise.all([api('/api/v1/docker/status'),api('/api/v1/docker/containers')]);box.innerHTML=status.available?`<strong>${data.containers.filter(c=>c.state==='running').length} 个运行中</strong><span>${data.containers.length} 个容器 · Docker ${escapeHTML(status.version)}</span><a data-nav href="/docker">进入 Docker</a>`:`<span>${escapeHTML(status.error||'Docker 不可用')}</span>`}catch(e){box.innerHTML=`<span>${escapeHTML(e.message)}</span>`}})
  document.querySelector('#refresh-services')?.addEventListener('click',()=>loadServices(document.querySelector('#service-search')?.value||''))
  let searchTimer;document.querySelector('#service-search')?.addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadServices(e.target.value),350)})
  document.querySelectorAll('[data-service-action]').forEach(b=>b.onclick=()=>serviceAction(b.dataset.name,b.dataset.serviceAction))
  document.querySelectorAll('[data-service-logs]').forEach(b=>b.onclick=()=>showServiceLogs(b.dataset.serviceLogs))
  document.querySelector('#refresh-processes')?.addEventListener('click',()=>loadProcesses())
  document.querySelectorAll('[data-process-pid]').forEach(bindProcessButton)
  document.querySelector('#refresh-network')?.addEventListener('click',loadNetwork)
  document.querySelector('#refresh-storage')?.addEventListener('click',loadStorage)
  document.querySelector('#refresh-timers')?.addEventListener('click',loadTimers)
  document.querySelector('#refresh-updates')?.addEventListener('click',loadUpdates)
  document.querySelector('#refresh-docker')?.addEventListener('click',loadDocker)
  document.querySelector('#pull-image')?.addEventListener('click',pullImage)
  document.querySelectorAll('[data-docker-tab]').forEach(b=>b.onclick=()=>{state.dockerTab=b.dataset.dockerTab;render()})
  document.querySelectorAll('[data-image-delete]').forEach(b=>b.onclick=()=>deleteDockerResource('image',b.dataset.imageDelete,imageName((state.dockerImages?.images||[]).find(i=>i.id===b.dataset.imageDelete)||{id:b.dataset.imageDelete})))
  document.querySelectorAll('[data-network-delete]').forEach(b=>b.onclick=()=>deleteDockerResource('network',b.dataset.networkDelete,b.dataset.name))
  document.querySelectorAll('[data-volume-delete]').forEach(b=>b.onclick=()=>deleteDockerResource('volume',b.dataset.volumeDelete))
  document.querySelectorAll('[data-docker-action]').forEach(b=>b.onclick=()=>dockerAction(b.dataset.id,b.dataset.dockerAction))
  document.querySelectorAll('[data-docker-logs]').forEach(b=>b.onclick=()=>showDockerLogs(b.dataset.dockerLogs,b.dataset.title))
  document.querySelector('#file-back')?.addEventListener('click',()=>state.files?.parent&&loadFiles(state.files.parent))
  document.querySelector('#file-home')?.addEventListener('click',()=>loadFiles('/'))
  document.querySelector('#refresh-files')?.addEventListener('click',()=>loadFiles(state.files?.path||'/'))
  document.querySelectorAll('[data-file-path]').forEach(row=>row.onclick=()=>row.dataset.directory==='true'?loadFiles(row.dataset.filePath):openFile(row.dataset.filePath))
  document.querySelector('#new-file')?.addEventListener('click',createEntry)
  document.querySelector('#upload-file')?.addEventListener('click',()=>document.querySelector('#upload-input')?.click())
  document.querySelector('#upload-input')?.addEventListener('change',e=>e.target.files?.[0]&&uploadSelected(e.target.files[0]))
  document.querySelectorAll('.tool-form').forEach(form=>form.onsubmit=e=>{e.preventDefault();runTool(form)})
  document.querySelector('#refresh-audit')?.addEventListener('click',loadAudit)
  document.querySelectorAll('[data-log-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-log-tab]').forEach(x=>x.classList.toggle('active',x===button));document.querySelector('#audit-panel').hidden=button.dataset.logTab!=='audit';document.querySelector('#system-log-panel').hidden=button.dataset.logTab!=='system'})
  const interval=document.querySelector('#refresh-interval');if(interval){interval.value=String(state.settings?.auto_refresh_seconds||5);interval.onchange=async()=>{try{await api('/api/v1/settings',{method:'PATCH',body:jsonBody({auto_refresh_seconds:Number(interval.value)})});state.settings.auto_refresh_seconds=Number(interval.value);syncAutoRefresh()}catch(e){alert(e.message)}}}
  document.querySelector('#revoke-sessions')?.addEventListener('click',async()=>{if(!confirm('确认退出其他所有设备？'))return;try{const r=await api('/api/v1/auth/sessions',{method:'DELETE'});alert(`已退出 ${r.revoked} 个会话`);await loadSecurity()}catch(e){alert(e.message)}})
  const passwordForm=document.querySelector('#password-form');if(passwordForm)passwordForm.onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),message=document.querySelector('#password-message'),button=e.currentTarget.querySelector('button'),next=String(f.get('next')||''),confirmValue=String(f.get('confirm')||'');message.hidden=true;if(next!==confirmValue){message.textContent='两次输入的新密码不一致';message.hidden=false;return}button.disabled=true;button.textContent='正在保存…';try{await api('/api/v1/auth/password',{method:'POST',body:jsonBody({current_password:f.get('current'),new_password:next})});message.className='form-success';message.textContent='密码已更新，其他设备已退出';message.hidden=false;e.currentTarget.reset()}catch(err){message.className='form-error';message.textContent=err.message;message.hidden=false}finally{button.disabled=false;button.textContent='保存新密码'}}
  document.querySelector('#process-term')?.addEventListener('click',()=>signalProcess(state.modal.pid,'term'))
  document.querySelector('#process-kill')?.addEventListener('click',()=>signalProcess(state.modal.pid,'kill'))
  document.querySelector('#modal-close')?.addEventListener('click',closeModal)
  document.querySelector('#modal-backdrop')?.addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeModal()})
  document.querySelector('#file-editor')?.addEventListener('input',()=>{if(state.modal)state.modal.dirty=true})
  document.querySelector('#save-file')?.addEventListener('click',saveFile)
  document.querySelector('#download-file')?.addEventListener('click',()=>{location.href=`/api/v1/files/download?path=${encodeURIComponent(state.modal.path)}`})
  document.querySelector('#rename-file')?.addEventListener('click',renameCurrent)
  document.querySelector('#delete-file')?.addEventListener('click',deleteCurrent)
}
function closeModal(){if(state.modal?.dirty&&!confirm('有未保存的修改，确认关闭？'))return;state.modal=null;render()}
function setBusy(value){document.body.classList.toggle('busy',value)}

function render(){
  if(!state.authenticated){if(location.pathname!='/login')history.replaceState({},'','/login');renderLogin();return}
  if(location.pathname==='/login')history.replaceState({},'','/')
  const routes={'/':dashboard,'/system':systemPage,'/services':servicesPage,'/processes':processesPage,'/network':networkPage,'/storage':storagePage,'/tasks':tasksPage,'/updates':updatesPage,'/files':filesPage,'/docker':dockerPage,'/tools':toolsPage,'/audit':auditPage,'/security':securityPage}
  app.innerHTML=shell((routes[location.pathname]||routes['/'])());bindShell();syncAutoRefresh()
}

restore()
