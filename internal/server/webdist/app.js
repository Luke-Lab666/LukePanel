const app = document.querySelector('#app')

const state = {
  authenticated: false,
  username: '',
  sessionID: '',
  csrf: '',
  overview: null,
  dashboardDocker: null,
  dashboardDockerTimer: null,
  docker: null,
  dockerStatus: null,
  dockerImages: null,
  dockerNetworks: null,
  dockerVolumes: null,
  dockerTab: 'containers',
  dockerCompose: null,
  dockerEdit: null,
  services: null,
  serviceFilter: 'running',
  serviceQuery: '',
  processes: null,
  network: null,
  storage: null,
  storageShowVirtual: false,
  timers: null,
  updates: null,
  processPrimed: false,
  files: null,
  fileView: 'files',
  fileFilter: '',
  recycle: null,
  fileContent: null,
  audit: null,
  auditFilter: '',
  logTab: 'audit',
  systemLogs: null,
  settings: null,
  ssh: null,
  sshUsers: null,
  sshKeys: null,
  sshUser: '',
  github: null,
  githubAuth: null,
  githubFlow: null,
  githubFlowTimer: null,
  githubImportPlan: null,
  loading: {},
  errors: {},
  refreshTimer: null,
  overviewStream: null,
  overviewStreamFailed: false,
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
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', move:'<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3"/><path d="M2 12h20M12 2v20"/>', github:'<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.28-.36 6.72-1.61 6.72-7A5.4 5.4 0 0 0 19.3 3.8 5 5 0 0 0 19.16 0S18.03-.36 15 1.48a13.4 13.4 0 0 0-7 0C4.97-.36 3.84 0 3.84 0a5 5 0 0 0-.14 3.8A5.4 5.4 0 0 0 2.28 7.5c0 5.38 3.44 6.63 6.72 7A4.8 4.8 0 0 0 7.5 18v4"/><path d="M7.5 19c-3 .9-3-1.5-4.2-2"/>', restore:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', external:'<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>', close:'<path d="M18 6 6 18M6 6l12 12"/>', play:'<path d="m5 3 14 9-14 9z"/>', stop:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
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
  if(res.status===401 && state.authenticated){ state.authenticated=false; stopOverviewUpdates(); render() }
  if(!res.ok){const error=new Error(body.error||`请求失败（${res.status}）`);error.status=res.status;throw error}
  return body
}
const ROUTE_STORAGE_KEY='lukepanel:last-route'
const knownRoutes=new Set(['/','/system','/services','/processes','/network','/storage','/tasks','/updates','/files','/docker','/tools','/github','/ssh','/audit','/security'])
const routeParents={'/system':'/','/services':'/system','/processes':'/system','/network':'/system','/storage':'/system','/tasks':'/system','/updates':'/system','/files':'/system','/ssh':'/system','/docker':'/','/tools':'/','/github':'/tools','/audit':'/security','/security':'/'}
let pendingElevation=null
function rememberRoute(pathname){if(knownRoutes.has(pathname))sessionStorage.setItem(ROUTE_STORAGE_KEY,pathname)}
function rememberedRoute(fallback='/'){const saved=sessionStorage.getItem(ROUTE_STORAGE_KEY);return knownRoutes.has(saved)?saved:fallback}
function passwordInputAttributes(){return 'inputmode="latin" lang="en" autocapitalize="none" autocorrect="off" spellcheck="false"'}
function requestElevation(){
  if(pendingElevation){pendingElevation.reject(new Error('已有二次验证请求'));pendingElevation=null}
  return new Promise((resolve,reject)=>{
    pendingElevation={resolve,reject}
    state.modal={kind:'elevation',title:'二次验证'}
    render()
    requestAnimationFrame(()=>document.querySelector('#elevation-password')?.focus())
  })
}
async function secureApi(url,options={}){
  try{return await api(url,options)}catch(error){
    if(error.status!==403||!String(error.message).includes('二次验证'))throw error
    await requestElevation()
    return api(url,options)
  }
}

function theme(){ return localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light') }
function applyTheme(value){ document.documentElement.dataset.theme=value; localStorage.setItem('theme',value); document.querySelector('meta[name=theme-color]')?.setAttribute('content',value==='dark'?'#101114':'#f6f7f9') }
applyTheme(theme())
function navigate(path,{replace=false}={}){
  const target=knownRoutes.has(path)?path:'/'
  if(location.pathname!==target){replace?history.replaceState({},'',target):history.pushState({},'',target)}
  rememberRoute(target);state.modal=null;render()
}
window.addEventListener('popstate',()=>{state.modal=null;rememberRoute(location.pathname);render()})
window.addEventListener('beforeunload',()=>rememberRoute(location.pathname))
document.addEventListener('click',e=>{const link=e.target.closest('[data-nav]');if(link){e.preventDefault();navigate(link.getAttribute('href'))}})

document.addEventListener('visibilitychange',()=>{
  syncOverviewUpdates()
  if(!document.hidden && location.pathname==='/' && state.authenticated) loadOverview(true)
})

async function restore(){
  const requestedPath=knownRoutes.has(location.pathname)?location.pathname:rememberedRoute('/')
  rememberRoute(requestedPath)
  try{
    const me=await api('/api/v1/auth/me'); state.authenticated=true; state.username=me.username; state.csrf=me.csrf_token; state.sessionID=me.session_id
    state.settings=await api('/api/v1/settings')
    const navigationType=performance.getEntriesByType?.('navigation')?.[0]?.type
    const saved=rememberedRoute(requestedPath)
    if(location.pathname==='/'&&navigationType==='reload'&&saved!=='/')history.replaceState({},'',saved)
    else if(!knownRoutes.has(location.pathname))history.replaceState({},'',requestedPath)
    rememberRoute(location.pathname)
  }catch{ state.authenticated=false; state.csrf='' }
  render()
}

function navItems(){return [
  ['概览','/','home'],['系统管理','/system','server'],['文件管理','/files','folder'],['Docker','/docker','container'],['常用工具','/tools','wrench'],['GitHub 助手','/github','github'],['日志审计','/audit','scroll'],['安全设置','/security','shield']
]}
function isActive(href){ return href==='/' ? location.pathname==='/' : location.pathname===href || (href==='/system' && ['/services','/processes','/network','/storage','/tasks','/updates','/ssh'].includes(location.pathname)) }
function shell(content){
  const nav=navItems()
  return `<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div><strong>LukePanel</strong><span>${escapeHTML(state.settings?.version||'轻量系统管理')}</span></div></div><nav class="sidebar-nav">${nav.map(([label,href,i])=>`<a data-nav href="${href}" class="${isActive(href)?'active':''}">${icon(i,19)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-footer"><button id="theme-toggle" class="icon-text-button">${icon(theme()==='dark'?'sun':'moon',18)}${theme()==='dark'?'浅色模式':'深色模式'}</button><button data-logout class="icon-text-button danger-text">${icon('logout',18)}退出登录</button></div></aside><main class="main-content">${content}</main><nav class="mobile-nav">${nav.filter(([,href])=>['/','/system','/docker','/tools','/security'].includes(href)).map(([label,href,i])=>`<a data-nav href="${href}" class="${isActive(href)?'active':''}">${icon(href==='/security'?'user':i,21)}<span>${href==='/security'?'我的':label.replace('管理','')}</span></a>`).join('')}</nav>${modalHTML()}</div>`
}
function pageHeader(title,description='',actions=''){const parent=routeParents[location.pathname];return `<header class="page-header"><div class="page-header__main">${parent?`<button class="page-back" data-back="${parent}" aria-label="返回">${icon('back',20)}<span>返回</span></button>`:''}<div class="page-header__copy"><h1>${escapeHTML(title)}</h1>${description?`<p>${escapeHTML(description)}</p>`:''}</div></div><div class="page-header__actions">${actions}</div></header>`}
function surfaceLoading(text='正在加载'){return `<section class="placeholder surface"><div class="spinner"></div><strong>${escapeHTML(text)}</strong></section>`}
function errorBox(message){return message?`<div class="alert error">${icon('alert',18)}${escapeHTML(message)}</div>`:''}
function formatBytes(value){let v=Number(value||0);const u=['B','KB','MB','GB','TB'];let i=0;while(v>=1024&&i<u.length-1){v/=1024;i++}return `${v.toFixed(i<2?0:1)} ${u[i]}`}
function formatRate(value){return `${formatBytes(value)}/s`}
function formatUptime(sec){const d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60);return `${d} 天 ${h} 小时 ${m} 分钟`}
function formatDate(value){try{return new Date(value).toLocaleString()}catch{return value||'-'}}
async function copyText(value,notice='已复制'){
  const text=String(value??'')
  try{
    if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text)
    else{const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove()}
    showToast(notice)
  }catch{alert('复制失败，请长按文本手动复制')}
}
function downloadText(filename,text,type='text/plain;charset=utf-8'){
  const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function showToast(message){
  document.querySelector('.toast')?.remove();const node=document.createElement('div');node.className='toast';node.textContent=message;document.body.appendChild(node);requestAnimationFrame(()=>node.classList.add('show'));setTimeout(()=>{node.classList.remove('show');setTimeout(()=>node.remove(),180)},1500)
}
function metric(label,value,detail,percent,id){return `<article class="metric-card surface" data-metric="${id}"><div class="metric-card__header"><span>${label}</span><strong data-value>${value}</strong></div>${percent!==undefined?`<div class="progress"><span data-progress style="width:${clamp(percent)}%"></span></div>`:''}<p data-detail>${detail||''}</p></article>`}
function clamp(v){return Math.min(100,Math.max(0,Number(v)||0))}
function statusBadge(status){const kind=['running','active'].includes(status)?'success':['exited','inactive','failed','dead'].includes(status)?'muted':'warning';return `<span class="status-badge ${kind}"><i></i>${escapeHTML(status||'unknown')}</span>`}

function renderLogin(){
  stopOverviewUpdates()
  app.innerHTML=`<main class="login-page"><section class="login-card surface"><div class="login-logo">L</div><h1>登录 LukePanel</h1><p>安全、轻量地管理你的服务器</p><form id="login-form"><label>用户名<input name="username" value="admin" autocomplete="username"></label><label>密码<div class="password-field"><input name="password" type="password" autocomplete="current-password" inputmode="latin" lang="en" autocapitalize="none" autocorrect="off" spellcheck="false" autofocus><button type="button" id="show-password">显示</button></div></label><div id="login-error" class="form-error" hidden></div><button class="primary-button" type="submit">登录</button></form><div class="security-note">${icon('shield',17)}会话仅通过 HttpOnly Cookie 保存</div></section></main>`
  document.querySelector('#show-password').onclick=e=>{const input=document.querySelector('[name=password]');input.type=input.type==='password'?'text':'password';e.currentTarget.textContent=input.type==='password'?'显示':'隐藏'}
  document.querySelector('#login-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type=submit]'),error=document.querySelector('#login-error');button.disabled=true;button.textContent='正在登录…';error.hidden=true;try{const r=await api('/api/v1/auth/login',{method:'POST',body:jsonBody({username:f.get('username'),password:f.get('password')})});state.authenticated=true;state.username=r.username;state.csrf=r.csrf_token;state.settings=await api('/api/v1/settings');navigate(rememberedRoute('/'),{replace:true})}catch(err){error.textContent=err.message;error.hidden=false}finally{button.disabled=false;button.textContent='登录'}}
}

async function loadOverview(silent=false){
  if(state.loading.overview) return
  state.loading.overview=true; state.errors.overview=''
  try{const d=await api('/api/v1/system/overview');state.overview=d;if(silent&&location.pathname==='/'&&document.querySelector('[data-dashboard]'))updateDashboard(d);else render()}
  catch(e){state.errors.overview=e.message;if(!silent)render()}
  finally{state.loading.overview=false;document.querySelector('#refresh-overview svg')?.classList.remove('spin')}
}
function dashboardDockerHTML(){
  const data=state.dashboardDocker
  if(!data)return `<div class="dashboard-docker-state"><div class="spinner"></div><span>读取容器状态…</span></div>`
  if(!data.available)return `<div class="dashboard-docker-state"><strong>Docker 不可用</strong><span>${escapeHTML(data.error||'无法连接 Docker Engine')}</span><a data-nav href="/docker">查看详情</a></div>`
  const containers=data.containers||[],running=containers.filter(c=>c.state==='running').length,stopped=containers.length-running
  return `<div class="dashboard-docker-summary"><div><strong>${running}</strong><span>运行中</span></div><div><strong>${stopped}</strong><span>已停止</span></div><div><strong>${containers.length}</strong><span>总容器</span></div></div><div class="dashboard-docker-footer"><span>Docker ${escapeHTML(data.version||'')}</span><a data-nav href="/docker">管理容器 ${icon('chevron',15)}</a></div>`
}
async function loadDashboardDocker(silent=false){
  if(state.loading.dashboardDocker)return
  state.loading.dashboardDocker=true
  try{
    const status=await api('/api/v1/docker/status')
    if(!status.available){state.dashboardDocker={available:false,error:status.error};return}
    const data=await api('/api/v1/docker/containers')
    state.dashboardDocker={available:true,version:status.version,containers:data.containers||[]}
  }catch(error){state.dashboardDocker={available:false,error:error.message}}
  finally{
    state.loading.dashboardDocker=false
    const root=document.querySelector('#dashboard-docker-content')
    if(silent&&root)root.innerHTML=dashboardDockerHTML();else if(location.pathname==='/')render()
  }
}
function dashboard(){
  const d=state.overview
  if(!d){if(state.errors.overview)return `<div class="page-wrap">${pageHeader('系统概览','系统状态读取失败',`<button id="refresh-overview" class="secondary-button compact">${icon('refresh',17)}重试</button>`)}${errorBox(state.errors.overview)}</div>`;queueMicrotask(()=>loadOverview());return `<div class="page-wrap">${pageHeader('系统概览','正在读取实时状态')}${surfaceLoading('正在采集系统信息')}</div>`}
  if(!state.dashboardDocker&&!state.loading.dashboardDocker)queueMicrotask(()=>loadDashboardDocker())
  const mp=d.memory.Total?d.memory.Used/d.memory.Total*100:0,dp=d.disk.Total?d.disk.Used/d.disk.Total*100:0,sp=d.memory.SwapTotal?d.memory.SwapUsed/d.memory.SwapTotal*100:0
  return `<div class="page-wrap" data-dashboard>${pageHeader('系统概览',`${d.hostname} · ${d.os}`,`<button id="refresh-overview" class="secondary-button compact">${icon('refresh',17,state.loading.overview?'spin':'')}<span>刷新</span></button>`)}${errorBox(state.errors.overview)}<section class="status-hero surface"><div><span class="status-dot"></span><strong>系统运行正常</strong><p>${icon('clock',16)}已运行 <span data-uptime>${formatUptime(d.uptime_seconds)}</span></p></div><div class="collection-time"><span data-stream-state>实时推送 · 2 秒</span><br><span data-collected>${formatDate(d.collected_at)}</span></div></section><section class="metrics-grid">${metric('CPU',`${d.cpu_percent.toFixed(1)}%`,`${d.cpu_cores} 核 · 负载 ${d.load_1.toFixed(2)} / ${d.load_5.toFixed(2)} / ${d.load_15.toFixed(2)}`,d.cpu_percent,'cpu')}${metric('内存',`${mp.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`,mp,'memory')}${metric('系统盘',`${dp.toFixed(1)}%`,`${formatBytes(d.disk.Used)} / ${formatBytes(d.disk.Total)}`,dp,'disk')}${metric('实时网络',`↓ ${formatRate(d.network.download_bps)}`,`↑ ${formatRate(d.network.upload_bps)} · 累计 ↓ ${formatBytes(d.network.received_bytes)}`,undefined,'network')}</section><section class="dashboard-grid"><article class="surface summary-card dashboard-docker-card" id="dashboard-docker"><div class="card-heading">${icon('container',19)}<strong>Docker</strong><span class="live-dot" title="每 10 秒同步"></span></div><div id="dashboard-docker-content">${dashboardDockerHTML()}</div></article><article class="surface summary-card"><div class="card-heading">${icon('server',19)}<strong>系统信息</strong></div><dl class="info-list"><div><dt>内核</dt><dd>${escapeHTML(d.kernel)}</dd></div><div><dt>架构</dt><dd>${escapeHTML(d.architecture)}</dd></div><div><dt>Swap 已用</dt><dd data-swap>${sp.toFixed(1)}% · ${formatBytes(d.memory.SwapUsed)} / ${formatBytes(d.memory.SwapTotal)}</dd></div></dl></article></section></div>`
}
function updateDashboard(d){
  const mp=d.memory.Total?d.memory.Used/d.memory.Total*100:0,dp=d.disk.Total?d.disk.Used/d.disk.Total*100:0,sp=d.memory.SwapTotal?d.memory.SwapUsed/d.memory.SwapTotal*100:0
  updateMetric('cpu',`${d.cpu_percent.toFixed(1)}%`,`${d.cpu_cores} 核 · 负载 ${d.load_1.toFixed(2)} / ${d.load_5.toFixed(2)} / ${d.load_15.toFixed(2)}`,d.cpu_percent)
  updateMetric('memory',`${mp.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`,mp)
  updateMetric('disk',`${dp.toFixed(1)}%`,`${formatBytes(d.disk.Used)} / ${formatBytes(d.disk.Total)}`,dp)
  updateMetric('network',`↓ ${formatRate(d.network.download_bps)}`,`↑ ${formatRate(d.network.upload_bps)} · 累计 ↓ ${formatBytes(d.network.received_bytes)}`)
  const uptime=document.querySelector('[data-uptime]');if(uptime)uptime.textContent=formatUptime(d.uptime_seconds)
  const collected=document.querySelector('[data-collected]');if(collected)collected.textContent=formatDate(d.collected_at)
  const swap=document.querySelector('[data-swap]');if(swap)swap.textContent=`${sp.toFixed(1)}% · ${formatBytes(d.memory.SwapUsed)} / ${formatBytes(d.memory.SwapTotal)}`
}
function updateMetric(id,value,detail,percent){const root=document.querySelector(`[data-metric="${id}"]`);if(!root)return;root.querySelector('[data-value]').textContent=value;root.querySelector('[data-detail]').textContent=detail;if(percent!==undefined){const p=root.querySelector('[data-progress]');if(p)p.style.width=`${clamp(percent)}%`}}
function syncOverviewUpdates(){
  stopOverviewUpdates()
  if(!state.authenticated||document.hidden||location.pathname!=='/')return
  loadDashboardDocker(true)
  state.dashboardDockerTimer=setInterval(()=>loadDashboardDocker(true),10000)
  const fallback=()=>{
    const seconds=Math.max(2,Number(state.settings?.auto_refresh_seconds||5))
    const label=document.querySelector('[data-stream-state]');if(label)label.textContent=`兼容刷新 · ${seconds} 秒`
    state.refreshTimer=setInterval(()=>loadOverview(true),seconds*1000)
  }
  if(!('EventSource' in window)){fallback();return}
  const stream=new EventSource('/api/v1/system/overview/stream')
  state.overviewStream=stream
  stream.addEventListener('open',()=>{state.overviewStreamFailed=false;const label=document.querySelector('[data-stream-state]');if(label)label.textContent='实时推送 · 2 秒'})
  stream.addEventListener('overview',event=>{
    try{const data=JSON.parse(event.data);state.overview=data;if(location.pathname==='/'&&document.querySelector('[data-dashboard]'))updateDashboard(data)}catch{}
  })
  stream.onerror=()=>{
    if(state.overviewStream!==stream)return
    stream.close();state.overviewStream=null
    if(!state.overviewStreamFailed){state.overviewStreamFailed=true;fallback()}
  }
}
function stopOverviewUpdates(){
  if(state.overviewStream){state.overviewStream.close();state.overviewStream=null}
  if(state.refreshTimer){clearInterval(state.refreshTimer);state.refreshTimer=null}
  if(state.dashboardDockerTimer){clearInterval(state.dashboardDockerTimer);state.dashboardDockerTimer=null}
}

function systemPage(){
  const modules=[
    ['服务管理','systemd 状态、控制与日志','/services','power',true],['文件管理','上传、下载与安全编辑','/files','folder',true],['日志中心','系统日志与操作审计','/audit','scroll',true],['Docker','容器状态、控制与日志','/docker','container',true],
    ['进程管理','CPU、内存排行与进程结束','/processes','activity',true],['网络管理','接口、流量与监听端口','/network','network',true],['存储管理','分区、文件系统与空间','/storage','drive',true],['计划任务','systemd timer 查看','/tasks','calendar',true],['软件更新','APT 可升级软件包检查','/updates','package',true],['SSH 管理','登录状态与公钥管理','/ssh','key',true],['GitHub 助手','检查仓库、标签与自动发布','/github','github',true]
  ]
  return `<div class="page-wrap">${pageHeader('系统管理','核心模块已可用，危险操作均需要明确确认')}<section class="module-grid">${modules.map(([t,d,p,i,ready])=>`<${ready?'a':'article'} ${ready?`data-nav href="${p}"`:''} class="module-card surface ${ready?'':'muted'}"><div class="module-icon">${icon(i,22)}</div><div><strong>${t}</strong><p>${d}</p></div>${icon('chevron',19)}${ready?'':'<span class="soon-badge">后续迭代</span>'}</${ready?'a':'article'}>`).join('')}</section></div>`
}

async function loadServices(query=state.serviceQuery||''){
  state.serviceQuery=query;state.loading.services=true;state.errors.services=''
  try{state.services=await api(`/api/v1/system/services?query=${encodeURIComponent(query)}`)}catch(e){state.errors.services=e.message}
  finally{state.loading.services=false;render()}
}
function visibleServices(){
  const all=state.services?.services||[]
  if(state.serviceQuery)return all
  if(state.serviceFilter==='all')return all
  if(state.serviceFilter==='failed')return all.filter(x=>x.active==='failed'||x.sub==='failed')
  return all.filter(x=>x.active==='active')
}
function servicesPage(){
  const data=state.services
  if(!data&&state.errors.services)return `<div class="page-wrap">${pageHeader('服务管理','无法读取 systemd 服务',`<button id="refresh-services" class="secondary-button compact">重试</button>`)}${errorBox(state.errors.services)}</div>`
  if(!data){queueMicrotask(()=>loadServices());return `<div class="page-wrap">${pageHeader('服务管理','读取 systemd 服务')}${surfaceLoading()}</div>`}
  const services=visibleServices(),all=data.services||[],failed=all.filter(x=>x.active==='failed'||x.sub==='failed').length
  return `<div class="page-wrap services-page">${pageHeader('服务管理','默认只显示运行中服务，避免无关系统单元刷屏',`<button id="refresh-services" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.services)}<div class="search-bar surface">${icon('search',18)}<input id="service-search" value="${escapeHTML(state.serviceQuery)}" placeholder="搜索服务名称或描述"><span>${services.length} / ${all.length}</span></div><div class="tab-bar surface service-filter"><button data-service-filter="running" class="${state.serviceFilter==='running'?'active':''}">运行中 ${all.filter(x=>x.active==='active').length}</button><button data-service-filter="failed" class="${state.serviceFilter==='failed'?'active':''}">异常 ${failed}</button><button data-service-filter="all" class="${state.serviceFilter==='all'?'active':''}">全部 ${all.length}</button></div><section class="card-list">${services.map(service=>`<article class="resource-card surface"><div class="resource-main"><div><strong title="${escapeHTML(service.name)}">${escapeHTML(service.name)}</strong>${statusBadge(service.active)}</div><p title="${escapeHTML(service.description||'无描述')}">${escapeHTML(service.description||'无描述')}</p><small>${escapeHTML(service.sub)} · ${escapeHTML(service.enabled||'unknown')}</small></div><div class="resource-actions"><button class="secondary-button compact" data-service-logs="${escapeHTML(service.name)}">日志</button>${service.active==='active'?`<button class="secondary-button compact" data-service-action="restart" data-name="${escapeHTML(service.name)}">重启</button><button class="danger-button compact" data-service-action="stop" data-name="${escapeHTML(service.name)}">停止</button>`:`<button class="primary-button compact" data-service-action="start" data-name="${escapeHTML(service.name)}">启动</button>`}</div></article>`).join('')||'<div class="empty-list surface">没有匹配的服务</div>'}</section></div>`
}
async function serviceAction(name,action){if(['stop','restart'].includes(action)&&!confirm(`确认${action==='stop'?'停止':'重启'} ${name}？`))return;setBusy(true);try{await secureApi('/api/v1/system/services/action',{method:'POST',body:jsonBody({name,action})});await loadServices(state.serviceQuery)}catch(e){alert(e.message)}finally{setBusy(false)}}
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
function storagePage(){
  if(!state.storage&&!state.errors.storage){queueMicrotask(loadStorage);return `<div class="page-wrap">${pageHeader('存储管理','读取文件系统')}${surfaceLoading()}</div>`}
  const all=state.storage?.mounts||[],meaningful=all.filter(m=>!m.virtual),mounts=state.storageShowVirtual?all:meaningful,hidden=all.length-meaningful.length
  const toggle=hidden?`<button id="toggle-virtual-mounts" class="secondary-button compact storage-toggle"><span>${state.storageShowVirtual?'隐藏虚拟挂载':'显示全部'}</span>${state.storageShowVirtual?'':`<b>+${hidden}</b>`}</button>`:''
  return `<div class="page-wrap">${pageHeader('存储管理','默认隐藏 Docker overlay、netns、BPF 等虚拟挂载',`${toggle}<button id="refresh-storage" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.storage)}<section class="storage-grid">${mounts.map(m=>{const pct=m.total?m.used/m.total*100:0;return `<article class="surface storage-card ${m.virtual?'virtual-mount':''}"><div class="storage-card__title"><strong title="${escapeHTML(m.mountpoint)}">${escapeHTML(m.mountpoint)}</strong><span>${escapeHTML(m.filesystem)}</span></div><div class="path-line"><code title="${escapeHTML(m.device)}">${escapeHTML(m.device)}</code><button class="copy-icon" data-copy-text="${escapeHTML(m.mountpoint)}" aria-label="复制挂载路径">${icon('copy',15)}</button></div><div class="progress"><span style="width:${clamp(pct)}%"></span></div><small>${pct.toFixed(1)}% · ${formatBytes(m.used)} / ${formatBytes(m.total)}</small></article>`}).join('')||'<div class="empty-list surface">暂无挂载点</div>'}</section></div>`
}


async function loadTimers(){state.errors.timers='';try{state.timers=await api('/api/v1/system/timers')}catch(e){state.errors.timers=e.message}finally{render()}}
function tasksPage(){if(!state.timers&&!state.errors.timers){queueMicrotask(loadTimers);return `<div class="page-wrap">${pageHeader('计划任务','读取 systemd timers')}${surfaceLoading()}</div>`}return `<div class="page-wrap">${pageHeader('计划任务','当前版本先提供 systemd timer 查看',`<button id="refresh-timers" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.timers)}<section class="result-panel surface"><pre>${escapeHTML(state.timers?.timers||'没有 timer')}</pre></section></div>`}

async function loadUpdates(){state.errors.updates='';try{state.updates=await api('/api/v1/system/updates')}catch(e){state.errors.updates=e.message}finally{render()}}
function updatesPage(){if(!state.updates&&!state.errors.updates){queueMicrotask(loadUpdates);return `<div class="page-wrap">${pageHeader('软件更新','模拟检查 APT 更新')}${surfaceLoading('检查可升级软件包')}</div>`}return `<div class="page-wrap">${pageHeader('软件更新','只读模拟检查，不会自动执行升级',`<button id="refresh-updates" class="secondary-button compact">${icon('refresh',17)}<span>重新检查</span></button>`)}${errorBox(state.errors.updates)}<section class="update-summary surface"><div class="update-count"><strong>${state.updates?.count||0}</strong><span>个软件包可升级</span></div><p>${state.updates?.available?'使用 apt-get 模拟升级结果，不会修改系统。':escapeHTML(state.updates?.output||'APT 不可用')}</p></section><section class="package-list surface">${(state.updates?.packages||[]).map(x=>`<span>${escapeHTML(x)}</span>`).join('')||'<div class="empty-list">系统已是最新状态或暂未获取到更新</div>'}</section></div>`}

async function loadDocker(){
  state.loading.docker=true;state.errors.docker=''
  try{
    const status=await api('/api/v1/docker/status');state.dockerStatus=status
    if(!status.available)throw new Error(status.error||'Docker 不可用')
    const [containers,images,networks,volumes,compose]=await Promise.all([api('/api/v1/docker/containers'),api('/api/v1/docker/images'),api('/api/v1/docker/networks'),api('/api/v1/docker/volumes'),api('/api/v1/docker/compose')])
    state.docker=containers;state.dockerImages=images;state.dockerNetworks=networks;state.dockerVolumes=volumes;state.dockerCompose=compose
  }catch(e){state.errors.docker=e.message}finally{state.loading.docker=false;render()}
}
function containerName(c){return (c.names?.[0]||c.id.slice(0,12)).replace(/^\//,'')}
function portText(c){const p=(c.ports||[]).filter(x=>x.PublicPort).map(x=>`${x.PublicPort}:${x.PrivatePort}/${x.Type}`);return p.length?p.join(' · '):'无公开端口'}
function imageName(i){return i.repo_tags?.[0]||i.id.replace(/^sha256:/,'').slice(0,12)}
function dockerPage(){
  if(!state.docker&&!state.errors.docker){queueMicrotask(loadDocker);return `<div class="page-wrap">${pageHeader('Docker','正在连接 Docker Engine')}${surfaceLoading()}</div>`}
  const containers=state.docker?.containers||[],images=state.dockerImages?.images||[],networks=state.dockerNetworks?.networks||[],volumes=state.dockerVolumes?.volumes||[],compose=state.dockerCompose?.projects||[]
  const tabs=[['containers',`容器 ${containers.length}`],['compose',`Compose ${compose.length}`],['images',`镜像 ${images.length}`],['networks',`网络 ${networks.length}`],['volumes',`存储卷 ${volumes.length}`]]
  return `<div class="page-wrap">${pageHeader('Docker',state.dockerStatus?.available?`Docker ${state.dockerStatus.version}`:'容器引擎不可用',`<button id="pull-image" class="primary-button compact">${icon('download',17)}<span>拉取镜像</span></button><button id="refresh-docker" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.docker||state.dockerStatus?.error)}${state.docker?`<div class="tab-bar surface">${tabs.map(([key,label])=>`<button data-docker-tab="${key}" class="${state.dockerTab===key?'active':''}">${label}</button>`).join('')}</div>${dockerTabContent(containers,images,networks,volumes,compose)}`:''}</div>`
}
function dockerTabContent(containers,images,networks,volumes,compose){
  if(state.dockerTab==='compose')return `<section class="compose-grid">${compose.map(project=>`<article class="surface compose-card"><div class="compose-card__top"><div><strong>${escapeHTML(project.name)}</strong><span>${project.running}/${project.total} 运行中</span></div>${statusBadge(project.running===project.total&&project.total>0?'running':project.running>0?'partial':'exited')}</div><p title="${escapeHTML(project.working_dir)}">${escapeHTML(project.working_dir||'未读取到工作目录')}</p><div class="compose-services">${(project.containers||[]).map(c=>`<span>${escapeHTML(c.service||c.name)} · ${escapeHTML(c.state)}</span>`).join('')}</div><div class="resource-actions">${project.config_files?.[0]?`<button class="secondary-button compact" data-compose-edit="${escapeHTML(project.config_files[0])}">编辑 YAML</button>`:''}<button class="secondary-button compact" data-compose-action="pull" data-project="${escapeHTML(project.name)}">拉取</button><button class="primary-button compact" data-compose-action="up" data-project="${escapeHTML(project.name)}">启动/更新</button><button class="secondary-button compact" data-compose-action="restart" data-project="${escapeHTML(project.name)}">重启</button><button class="danger-button compact" data-compose-action="down" data-project="${escapeHTML(project.name)}">停止并移除</button></div></article>`).join('')||'<div class="empty-list surface">没有检测到 Docker Compose 项目</div>'}</section>`
  if(state.dockerTab==='images')return `<section class="resource-grid">${images.map(i=>`<article class="surface docker-resource-card"><div><strong>${escapeHTML(imageName(i))}</strong><span>${formatBytes(i.size)}</span></div><p>${escapeHTML(i.id.replace(/^sha256:/,'').slice(0,20))}</p><small>${formatDate(Number(i.created)*1000)} · ${i.containers>=0?`${i.containers} 个容器引用`:'引用未知'}</small><button class="danger-button compact" data-image-delete="${escapeHTML(i.id)}">删除</button></article>`).join('')||'<div class="empty-list surface">暂无镜像</div>'}</section>`
  if(state.dockerTab==='networks')return `<section class="resource-grid">${networks.map(n=>`<article class="surface docker-resource-card"><div><strong>${escapeHTML(n.name)}</strong><span>${escapeHTML(n.driver)}</span></div><p>${escapeHTML(n.id.slice(0,20))}</p><small>${escapeHTML(n.scope)}${n.internal?' · 内部网络':''}</small>${['bridge','host','none'].includes(n.name)?'<em>系统网络</em>':`<button class="danger-button compact" data-network-delete="${escapeHTML(n.id)}" data-name="${escapeHTML(n.name)}">删除</button>`}</article>`).join('')||'<div class="empty-list surface">暂无网络</div>'}</section>`
  if(state.dockerTab==='volumes')return `<section class="resource-grid">${volumes.map(v=>`<article class="surface docker-resource-card"><div><strong>${escapeHTML(v.name)}</strong><span>${escapeHTML(v.driver)}</span></div><p>${escapeHTML(v.mountpoint)}</p><small>${escapeHTML(v.scope)}</small><button class="danger-button compact" data-volume-delete="${escapeHTML(v.name)}">删除</button></article>`).join('')||'<div class="empty-list surface">暂无存储卷</div>'}</section>`
  return `<section class="container-grid">${containers.map(c=>`<article class="container-card surface"><div class="container-card__top"><div class="container-icon">${icon('container',21)}</div><div><strong>${escapeHTML(containerName(c))}</strong>${statusBadge(c.state)}</div></div><p>${escapeHTML(c.image)}</p><small>${escapeHTML(c.status)}<br>${escapeHTML(portText(c))}</small><div class="resource-actions"><button class="secondary-button compact" data-docker-logs="${escapeHTML(c.id)}" data-title="${escapeHTML(containerName(c))}">日志</button><button class="secondary-button compact" data-docker-edit="${escapeHTML(c.id)}" data-title="${escapeHTML(containerName(c))}">编辑</button>${c.state==='running'?`<button class="secondary-button compact" data-docker-action="restart" data-id="${escapeHTML(c.id)}">重启</button><button class="danger-button compact" data-docker-action="stop" data-id="${escapeHTML(c.id)}">停止</button>`:`<button class="primary-button compact" data-docker-action="start" data-id="${escapeHTML(c.id)}">启动</button><button class="danger-button compact" data-docker-action="remove" data-id="${escapeHTML(c.id)}">删除</button>`}</div></article>`).join('')||'<div class="empty-list surface">暂未发现容器</div>'}</section>`
}
async function dockerAction(id,action){if(['stop','restart','kill','remove'].includes(action)&&!confirm(`确认执行 ${action}？`))return;setBusy(true);try{await secureApi('/api/v1/docker/action',{method:'POST',body:jsonBody({id,action})});await loadDocker()}catch(e){alert(e.message)}finally{setBusy(false)}}
async function showDockerLogs(id,title){state.modal={title,kind:'logs',content:'正在读取日志…'};render();try{const data=await api(`/api/v1/docker/logs?id=${encodeURIComponent(id)}&tail=500`);state.modal={title:`${title} 日志`,kind:'logs',content:data.logs||'暂无日志'};render()}catch(e){state.modal={title,kind:'error',content:e.message};render()}}
function lines(value){return String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function dockerPortsText(ports){return (ports||[]).map(p=>`${p.host_ip||''}|${p.host_port||''}|${p.container_port||''}|${p.protocol||'tcp'}`).join('\n')}
function dockerMountsText(mounts){return (mounts||[]).map(m=>`${m.type||'bind'}|${m.source||''}|${m.target||''}|${m.read_only?'ro':'rw'}`).join('\n')}
function parseDockerPorts(value){return lines(value).map((line,index)=>{const p=line.split('|').map(x=>x.trim());if(p.length!==4)throw new Error(`端口第 ${index+1} 行格式应为：主机IP|主机端口|容器端口|协议`);return {host_ip:p[0],host_port:p[1],container_port:p[2],protocol:p[3]||'tcp'}})}
function parseDockerMounts(value){return lines(value).map((line,index)=>{const p=line.split('|').map(x=>x.trim());if(p.length!==4)throw new Error(`挂载第 ${index+1} 行格式应为：类型|来源|容器路径|ro/rw`);return {type:p[0],source:p[1],target:p[2],read_only:p[3].toLowerCase()==='ro'}})}
async function openDockerEditor(id,title){
  state.modal={title:`编辑 ${title}`,kind:'loading',content:''};render()
  try{const spec=await api(`/api/v1/docker/inspect?id=${encodeURIComponent(id)}`);state.dockerEdit=spec;state.modal={title:`编辑 ${spec.name}`,kind:'docker-edit',spec};render()}
  catch(error){state.modal={title:'无法读取容器配置',kind:'error',content:error.message};render()}
}
async function submitDockerEdit(){
  const form=document.querySelector('#docker-edit-form');if(!form)return
  const f=new FormData(form),button=form.querySelector('button[type=submit]')
  let request
  try{request={id:state.dockerEdit.id,name:String(f.get('name')||'').trim(),image:String(f.get('image')||'').trim(),env:lines(f.get('env')),cmd:lines(f.get('cmd')),entrypoint:lines(f.get('entrypoint')),working_dir:String(f.get('working_dir')||'').trim(),user:String(f.get('user')||'').trim(),hostname:String(f.get('hostname')||'').trim(),restart_policy:String(f.get('restart_policy')||'no'),restart_maximum_retry_count:Number(f.get('restart_maximum_retry_count')||0),ports:parseDockerPorts(f.get('ports')),mounts:parseDockerMounts(f.get('mounts')),start:f.get('start')==='on'} }catch(error){alert(error.message);return}
  if(!confirm(`LukePanel 将安全重建容器 ${request.name}。旧容器会暂存，若新容器启动失败会自动恢复。确认继续？`))return
  button.disabled=true;button.textContent='正在安全重建…'
  try{const result=await secureApi('/api/v1/docker/recreate',{method:'POST',body:jsonBody(request)});state.modal=null;state.dockerEdit=null;await loadDocker();showToast(result.warning||'容器配置已更新')}
  catch(error){alert(error.message)}finally{button.disabled=false;button.textContent='保存并重建'}
}

async function composeAction(project,action){
  const labels={up:'启动或更新',restart:'重启',stop:'停止',down:'停止并移除',pull:'拉取镜像'}
  if(['down','restart'].includes(action)&&!confirm(`确认${labels[action]} Compose 项目 ${project}？`))return
  setBusy(true)
  try{const result=await secureApi('/api/v1/docker/compose/action',{method:'POST',body:jsonBody({project,action})});if(result.output)alert(result.output);await loadDocker()}catch(e){alert(e.message)}finally{setBusy(false)}
}
async function pullImage(){const reference=prompt('镜像名称，例如 nginx:latest');if(!reference)return;setBusy(true);try{await secureApi('/api/v1/docker/images/pull',{method:'POST',body:jsonBody({reference})});state.dockerTab='images';await loadDocker()}catch(e){alert(e.message)}finally{setBusy(false)}}
async function deleteDockerResource(kind,value,label=value){if(!confirm(`确认删除 ${label}？正在使用的资源会被 Docker 拒绝。`))return;const map={image:['/api/v1/docker/images/delete',{id:value}],network:['/api/v1/docker/networks/delete',{id:value}],volume:['/api/v1/docker/volumes/delete',{name:value}]};setBusy(true);try{await secureApi(map[kind][0],{method:'POST',body:jsonBody(map[kind][1])});await loadDocker()}catch(e){alert(e.message)}finally{setBusy(false)}}

async function loadFiles(path='/'){
  state.loading.files=true;state.errors.files=''
  try{state.files=await api(`/api/v1/files?path=${encodeURIComponent(path)}`);state.fileContent=null}catch(e){state.errors.files=e.message}
  finally{state.loading.files=false;render()}
}
async function loadRecycle(){
  state.loading.recycle=true;state.errors.recycle=''
  try{state.recycle=await api('/api/v1/files/recycle')}catch(e){state.errors.recycle=e.message}
  finally{state.loading.recycle=false;render()}
}
function filteredFileEntries(){
  const entries=state.files?.entries||[],q=state.fileFilter.trim().toLowerCase()
  return q?entries.filter(item=>item.name.toLowerCase().includes(q)):entries
}
function fileBreadcrumb(path){
  if(!path||path==='/')return '<span class="breadcrumb-current">允许访问的位置</span>'
  const parts=path.split('/').filter(Boolean),crumbs=['<button data-file-jump="/" aria-label="返回允许访问的位置">/</button>']
  let current=''
  parts.forEach((part,index)=>{current+=`/${part}`;crumbs.push('<span>/</span>');crumbs.push(index===parts.length-1?`<span class="breadcrumb-current" title="${escapeHTML(current)}">${escapeHTML(part)}</span>`:`<button data-file-jump="${escapeHTML(current)}" title="${escapeHTML(current)}">${escapeHTML(part)}</button>`)})
  return crumbs.join('')
}
function copiedName(name,isDir){
  if(isDir)return `${name}-副本`
  const dot=name.lastIndexOf('.')
  return dot>0?`${name.slice(0,dot)}-副本${name.slice(dot)}`:`${name}-副本`
}

function filesPage(){
  const l=state.files
  if(state.fileView==='recycle'){
    if(!state.recycle&&!state.errors.recycle){queueMicrotask(loadRecycle);return `<div class="page-wrap">${pageHeader('文件管理','读取回收站')}${surfaceLoading()}</div>`}
    const entries=state.recycle?.entries||[]
    return `<div class="page-wrap files-page">${pageHeader('文件管理','删除内容先进入回收站，可恢复或永久清理')}<div class="tab-bar surface file-tabs"><button data-file-view="files">文件</button><button class="active" data-file-view="recycle">回收站 ${entries.length}</button></div>${errorBox(state.errors.recycle)}<section class="recycle-list">${entries.map(item=>`<article class="surface recycle-card"><div class="recycle-main"><div class="file-icon">${icon(item.is_dir?'folder':'file',21)}</div><div><strong>${escapeHTML(item.name)}</strong><p title="${escapeHTML(item.original_path)}">${escapeHTML(item.original_path)}</p><small>${formatDate(item.deleted_at)}${item.is_dir?' · 文件夹':` · ${formatBytes(item.size)}`}</small></div></div><div class="resource-actions"><button class="secondary-button compact" data-copy-text="${escapeHTML(item.original_path)}">复制原路径</button><button class="primary-button compact" data-recycle-action="restore" data-recycle-id="${escapeHTML(item.id)}">恢复</button><button class="danger-button compact" data-recycle-action="purge" data-recycle-id="${escapeHTML(item.id)}">永久删除</button></div></article>`).join('')||'<div class="empty-list surface">回收站是空的</div>'}</section></div>`
  }
  if(!l&&!state.errors.files){queueMicrotask(()=>loadFiles('/'));return `<div class="page-wrap">${pageHeader('文件管理','读取允许访问的位置')}${surfaceLoading()}</div>`}
  const entries=filteredFileEntries()
  return `<div class="page-wrap files-page">${pageHeader('文件管理','支持上传、下载、编辑、复制、移动、权限和回收站',`<button id="new-file" class="secondary-button compact">${icon('plus',17)}<span>新建</span></button><button id="upload-file" class="primary-button compact">${icon('upload',17)}<span>上传</span></button><input id="upload-input" type="file" multiple hidden><input id="upload-folder-input" type="file" webkitdirectory directory multiple hidden><input id="upload-zip-input" type="file" accept=".zip,application/zip" hidden>`)}<div class="tab-bar surface file-tabs"><button class="active" data-file-view="files">文件</button><button data-file-view="recycle">回收站</button></div>${errorBox(state.errors.files)}${l?`<div class="file-toolbar surface"><button id="file-back" ${l.parent?'':'disabled'} aria-label="返回">${icon('back',19)}</button><button id="file-home" aria-label="根目录">${icon('home',18)}</button><div class="path-pill file-breadcrumb" title="${escapeHTML(l.path==='/'?'允许访问的位置':l.path)}">${fileBreadcrumb(l.path)}</div><button id="copy-current-path" data-copy-text="${escapeHTML(l.path)}" aria-label="复制当前路径">${icon('copy',18)}</button><button id="refresh-files" aria-label="刷新">${icon('refresh',18)}</button></div><div class="search-bar surface file-search">${icon('search',18)}<input id="file-search" value="${escapeHTML(state.fileFilter)}" placeholder="筛选当前目录"><span>${entries.length} / ${l.entries.length}</span></div><section class="file-list surface">${entries.map(item=>`<div class="file-row"><button class="file-open" data-file-path="${escapeHTML(item.path)}" data-directory="${item.is_dir}"><div class="file-icon">${icon(item.is_dir?'folder':'file',22)}</div><div class="file-main"><strong title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</strong><span>${item.is_dir?'文件夹':formatBytes(item.size)} · ${formatDate(item.modified_at)}</span></div><code>${escapeHTML(item.mode)}</code>${icon('chevron',18)}</button>${l.path==='/'?'':`<button class="file-more" data-file-menu="${escapeHTML(item.path)}" aria-label="更多操作">${icon('more',19)}</button>`}</div>`).join('')||'<div class="empty-list">这个目录是空的</div>'}</section>`:''}</div>`
}
async function openFile(path){state.modal={title:'读取文件',kind:'loading',content:''};render();try{const data=await api(`/api/v1/files/content?path=${encodeURIComponent(path)}`);state.fileContent=data;state.modal={title:data.name,kind:'editor',content:data.content,path:data.path,dirty:false};render()}catch(e){state.modal={title:'无法打开文件',kind:'error',content:e.message};render()}}
function openFileMenu(path){
  const item=(state.files?.entries||[]).find(entry=>entry.path===path)
  if(!item)return
  state.modal={title:item.name,kind:'file-actions',path:item.path,item};render()
}
async function saveFile(){const editor=document.querySelector('#file-editor');if(!editor||!state.modal?.path)return;const button=document.querySelector('#save-file');button.disabled=true;button.textContent='保存中…';try{await secureApi('/api/v1/files/content',{method:'PUT',body:jsonBody({path:state.modal.path,content:editor.value})});state.modal.content=editor.value;state.modal.dirty=false;button.textContent='已保存';setTimeout(()=>{if(document.querySelector('#save-file'))document.querySelector('#save-file').textContent='保存'},1200)}catch(e){alert(e.message);button.textContent='保存'}finally{button.disabled=false}}
async function createEntry(){if(!state.files||state.files.path==='/'){alert('请先进入一个实际目录');return}const type=confirm('创建文件夹请点“确定”；创建空文件请点“取消”。')?'folder':'file';const name=prompt(type==='folder'?'文件夹名称':'文件名称');if(!name)return;const base=state.files.path.replace(/\/$/,'');const path=`${base}/${name}`;try{await secureApi(type==='folder'?'/api/v1/files/mkdir':'/api/v1/files/create',{method:'POST',body:jsonBody({path})});await loadFiles(state.files.path)}catch(e){alert(e.message)}}
async function uploadSelected(files,preservePaths=false){
  if(!state.files||state.files.path==='/'){alert('请先进入目标目录');return}
  const list=Array.from(files||[]);if(!list.length)return
  setBusy(true);let completed=0
  try{
    for(const file of list){
      const form=new FormData();form.append('directory',state.files.path);form.append('relative_path',preservePaths?(file.webkitRelativePath||file.name):file.name);form.append('overwrite','false');form.append('file',file)
      await secureApi('/api/v1/files/upload',{method:'POST',body:form});completed++
    }
    await loadFiles(state.files.path);showToast(`已上传 ${completed} 个${preservePaths?'文件夹内文件':'文件'}`)
  }catch(e){alert(`已上传 ${completed}/${list.length} 个文件\n${e.message}`)}finally{setBusy(false)}
}
async function uploadAndExtractZIP(files){
  const file=Array.from(files||[])[0];if(!file||!state.files||state.files.path==='/')return
  if(!confirm(`将 ${file.name} 安全解压到 ${state.files.path}？同名文件默认不会覆盖。`))return
  const form=new FormData();form.append('directory',state.files.path);form.append('overwrite','false');form.append('file',file)
  setBusy(true);try{const result=await secureApi('/api/v1/files/archive/extract',{method:'POST',body:form});await loadFiles(state.files.path);showToast(`已解压 ${result.files||0} 个文件`)}catch(error){alert(error.message)}finally{setBusy(false)}
}
async function recycleAction(id,action){
  if(action==='purge'&&!confirm('永久删除后无法恢复，确认继续？'))return
  try{
    await secureApi('/api/v1/files/recycle',{method:'POST',body:jsonBody({id,action,destination:''})})
    await loadRecycle()
  }catch(error){
    if(action==='restore'&&String(error.message).includes('恢复目标已存在')){
      const item=(state.recycle?.entries||[]).find(entry=>entry.id===id)
      const destination=prompt('原位置已有同名文件，请输入新的完整恢复路径',item?.original_path?`${item.original_path}-恢复`:'')
      if(!destination)return
      try{await secureApi('/api/v1/files/recycle',{method:'POST',body:jsonBody({id,action,destination})});await loadRecycle()}catch(nextError){alert(nextError.message)}
      return
    }
    alert(error.message)
  }
}

function toolsPage(){return `<div class="page-wrap">${pageHeader('常用工具','结果实时返回，不保存敏感请求内容')}<section class="tools-grid">${[['ping','Ping','测试基础网络延迟','example.com',''],['dns','DNS 查询','解析 A / AAAA 地址','example.com',''],['tcp','TCP 端口','测试目标端口连通性','example.com','443'],['http','HTTP 检查','查看状态码、跳转与耗时','https://example.com','']].map(([tool,title,desc,placeholder,port])=>`<article class="tool-card surface"><div class="tool-icon">${icon(tool==='dns'?'network':tool==='tcp'?'server':tool==='http'?'activity':'terminal',22)}</div><h2>${title}</h2><p>${desc}</p><form class="tool-form" data-tool="${tool}"><input name="target" placeholder="${placeholder}" required>${port?`<input name="port" type="number" value="${port}" min="1" max="65535">`:''}<button class="primary-button" type="submit">开始测试</button></form></article>`).join('')}</section><section id="tool-result" class="result-panel surface" hidden><div class="card-heading">${icon('terminal',19)}<strong>测试结果</strong></div><pre></pre></section></div>`}
async function runTool(form){const f=new FormData(form),button=form.querySelector('button'),result=document.querySelector('#tool-result'),pre=result.querySelector('pre');button.disabled=true;button.textContent='测试中…';result.hidden=false;pre.textContent='正在执行…';try{const data=await api('/api/v1/tools/run',{method:'POST',body:jsonBody({tool:form.dataset.tool,target:f.get('target'),port:Number(f.get('port')||0)})});pre.textContent=(data.output||'完成')+`\n\n耗时：${data.duration_ms} ms`}catch(e){pre.textContent=e.message}finally{button.disabled=false;button.textContent='开始测试'}}

async function loadAudit(){state.loading.audit=true;state.errors.audit='';try{const [audit,logs]=await Promise.all([api('/api/v1/audit?limit=1000'),api('/api/v1/logs/system?lines=600')]);state.audit=audit;state.systemLogs=logs}catch(e){state.errors.audit=e.message}finally{state.loading.audit=false;render()}}
function auditEventText(e){return `${formatDate(e.time)} | ${e.result} | ${e.action} | ${e.target||'-'} | ${e.user||'-'} | ${e.ip||'-'}${e.detail?` | ${e.detail}`:''}`}
function filteredAuditEvents(){const items=state.audit?.events||[],q=state.auditFilter.trim().toLowerCase();return q?items.filter(e=>auditEventText(e).toLowerCase().includes(q)):items}
function auditPage(){
  if(!state.audit&&!state.errors.audit){queueMicrotask(loadAudit);return `<div class="page-wrap">${pageHeader('日志审计','读取日志')}${surfaceLoading()}</div>`}
  const events=filteredAuditEvents(),auditText=events.map(auditEventText).join('\n'),systemText=state.systemLogs?.logs||''
  const actions=`<button id="copy-current-log" class="secondary-button compact">${icon('copy',16)}<span>复制当前</span></button><button id="export-audit" class="secondary-button compact">${icon('download',16)}<span>导出</span></button><button id="refresh-audit" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`
  return `<div class="page-wrap">${pageHeader('日志审计','支持搜索、一键复制和导出，敏感凭据不会写入日志',actions)}${errorBox(state.errors.audit)}<div class="tab-bar surface"><button class="${state.logTab==='audit'?'active':''}" data-log-tab="audit">操作审计</button><button class="${state.logTab==='system'?'active':''}" data-log-tab="system">系统日志</button></div>${state.logTab==='audit'?`<div class="search-bar surface audit-search">${icon('search',18)}<input id="audit-search" value="${escapeHTML(state.auditFilter)}" placeholder="搜索操作、目标、IP 或结果"><span>${events.length} / ${state.audit?.events?.length||0}</span></div><section id="audit-panel" class="audit-list surface" data-copy-block="${escapeHTML(auditText)}">${events.map(e=>`<div class="audit-row"><time>${formatDate(e.time)}</time><div><strong>${escapeHTML(e.action)}</strong><p title="${escapeHTML(e.target||'-')}">${escapeHTML(e.target||'-')}</p></div><span>${escapeHTML(e.user||'-')} · ${escapeHTML(e.ip||'-')}</span><b class="${e.result==='success'?'ok':'bad'}">${escapeHTML(e.result)}</b><button class="copy-icon audit-copy" data-copy-text="${escapeHTML(auditEventText(e))}" aria-label="复制这条记录">${icon('copy',14)}</button></div>`).join('')||'<div class="empty-list">暂无审计记录</div>'}</section>`:`<section id="system-log-panel" class="log-view surface"><pre>${escapeHTML(systemText||'暂无系统日志')}</pre></section>`}</div>`
}


async function loadSSH(user=''){
  state.loading.ssh=true;state.errors.ssh=''
  try{
    const [status,users]=await Promise.all([api('/api/v1/ssh/status'),api('/api/v1/ssh/users')])
    state.ssh=status;state.sshUsers=users
    if(!user)user=state.sshUser||users.users?.[0]?.name||''
    state.sshUser=user
    state.sshKeys=user?await api(`/api/v1/ssh/keys?user=${encodeURIComponent(user)}`):{keys:[]}
  }catch(e){state.errors.ssh=e.message}
  finally{state.loading.ssh=false;render()}
}
function sshPage(){
  if(!state.ssh&&!state.errors.ssh){queueMicrotask(()=>loadSSH());return `<div class="page-wrap">${pageHeader('SSH 管理','读取 SSH 状态')}${surfaceLoading()}</div>`}
  const users=state.sshUsers?.users||[],keys=state.sshKeys?.keys||[],status=state.ssh||{}
  return `<div class="page-wrap">${pageHeader('SSH 管理','只管理公钥，不提供任意终端，也不会直接改坏 sshd_config',`<button id="refresh-ssh" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.ssh)}<section class="ssh-status-grid"><article class="surface status-card"><div class="card-heading">${icon('shield',19)}<strong>OpenSSH 状态</strong></div>${status.available?`<dl class="info-list"><div><dt>服务</dt><dd>${escapeHTML(status.service||'已安装')}</dd></div><div><dt>端口</dt><dd>${escapeHTML(status.port||'-')}</dd></div><div><dt>Root 登录</dt><dd>${escapeHTML(status.permit_root_login||'-')}</dd></div><div><dt>密码登录</dt><dd>${escapeHTML(status.password_authentication||'-')}</dd></div><div><dt>公钥登录</dt><dd>${escapeHTML(status.pubkey_authentication||'-')}</dd></div></dl>`:`<div class="empty-state"><span>${escapeHTML(status.error||'OpenSSH 不可用')}</span></div>`}</article><article class="surface status-card ssh-guide"><div class="card-heading">${icon('key',19)}<strong>新手建议</strong></div><ol><li>先添加并测试公钥登录。</li><li>确认手机或电脑能用密钥连接。</li><li>再考虑关闭密码登录，避免把自己锁在服务器外。</li></ol><p>LukePanel 暂不自动关闭密码登录，这是刻意的安全限制。</p></article></section><section class="surface ssh-keys-panel"><header><div><strong>授权公钥</strong><p>选择 Linux 用户后管理 <code>~/.ssh/authorized_keys</code></p></div><select id="ssh-user">${users.map(user=>`<option value="${escapeHTML(user.name)}" ${user.name===state.sshUser?'selected':''}>${escapeHTML(user.name)}（${user.key_count} 个密钥）</option>`).join('')}</select></header><div class="key-list">${keys.map(key=>`<article class="key-row"><div class="key-type">${escapeHTML(key.type.replace('ssh-',''))}</div><div><strong>${escapeHTML(key.comment||'未命名公钥')}</strong><p>${escapeHTML(key.fingerprint)}</p><small>${escapeHTML(key.preview)}</small></div><button class="danger-button compact" data-ssh-key-delete="${escapeHTML(key.id)}">删除</button></article>`).join('')||'<div class="empty-list">这个用户还没有公钥</div>'}</div><form id="ssh-key-form" class="ssh-key-form"><label>粘贴完整公钥<textarea name="key" rows="4" placeholder="ssh-ed25519 AAAA... iPhone" required></textarea></label><button class="primary-button" type="submit">添加公钥</button></form></section></div>`
}
async function addSSHKey(form){const button=form.querySelector('button'),key=new FormData(form).get('key');button.disabled=true;button.textContent='添加中…';try{await secureApi('/api/v1/ssh/keys/add',{method:'POST',body:jsonBody({user:state.sshUser,key})});form.reset();await loadSSH(state.sshUser);showToast('公钥已添加')}catch(e){alert(e.message)}finally{button.disabled=false;button.textContent='添加公钥'}}
async function deleteSSHKey(id){if(!confirm('确认删除这把 SSH 公钥？请确保你还有其他可用登录方式。'))return;try{await secureApi('/api/v1/ssh/keys/delete',{method:'POST',body:jsonBody({user:state.sshUser,id})});await loadSSH(state.sshUser)}catch(e){alert(e.message)}}

function githubDefaults(){return {owner:localStorage.getItem('github-owner')||'Luke-Lab666',repo:localStorage.getItem('github-repo')||'LukePanel',branch:localStorage.getItem('github-branch')||'main'}}
async function loadGitHubAuth(silent=false){
  try{state.githubAuth=await api('/api/v1/github/auth/status')}catch(error){state.githubAuth={connected:false,error:error.message}}
  if(!silent)render()
}
async function loadGitHub(owner,repo){
  const defaults=githubDefaults();owner=owner||defaults.owner;repo=repo||defaults.repo
  state.loading.github=true;state.errors.github='';localStorage.setItem('github-owner',owner);localStorage.setItem('github-repo',repo)
  try{state.github=await api(`/api/v1/github/summary?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)}catch(e){state.errors.github=e.message}
  finally{state.loading.github=false;render()}
}
function workflowStatus(run){if(run.status!=='completed')return '运行中';return run.conclusion==='success'?'成功':run.conclusion||'未知'}
function githubAuthCard(){
  const auth=state.githubAuth
  if(!auth)return `<section class="surface github-auth-card"><div class="spinner"></div><span>检查 GitHub 登录状态…</span></section>`
  if(auth.connected)return `<section class="surface github-auth-card connected"><div class="github-user">${auth.avatar_url?`<img src="${escapeHTML(auth.avatar_url)}" alt="">`:icon('github',24)}<div><strong>已连接 @${escapeHTML(auth.login)}</strong><span>授权仅保存在当前 LukePanel 会话内，退出或重启后自动清除</span></div></div><button id="github-disconnect" class="secondary-button compact">断开连接</button></section>`
  const clientID=localStorage.getItem('github-client-id')||''
  return `<section class="surface github-auth-card"><div><h2>通过 GitHub 网页登录</h2><p>首次需要创建一个 OAuth App，并开启 Device Flow。只填写公开的 Client ID，不需要 Client Secret。</p></div><details class="token-guide"><summary>一次性设置步骤</summary><ol><li>GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。</li><li>Homepage URL 填你的 LukePanel HTTPS 地址。</li><li>创建后勾选 <strong>Enable Device Flow</strong>。</li><li>复制 Client ID 到下方。以后只需在 GitHub 网页确认登录。</li></ol><a class="secondary-button compact" href="https://github.com/settings/developers" target="_blank" rel="noopener">${icon('external',15)}打开 OAuth Apps</a></details><form id="github-connect-form" class="github-connect-form"><label>OAuth App Client ID<input name="client_id" value="${escapeHTML(clientID)}" placeholder="例如 Ov23li..." required></label><button class="primary-button" type="submit">连接 GitHub</button></form>${state.githubFlow?`<div class="device-flow-box"><span>在 GitHub 页面输入代码</span><strong>${escapeHTML(state.githubFlow.user_code)}</strong><div><button id="copy-github-code" class="secondary-button compact">复制代码</button><a class="primary-button compact" href="${escapeHTML(state.githubFlow.verification_uri)}" target="_blank" rel="noopener">打开 GitHub 授权页</a></div><small>授权后此页面会自动检测，无需刷新。</small></div>`:''}</section>`
}
function githubImportHTML(data){
  if(!state.githubAuth?.connected)return `<section class="surface github-import-panel muted-panel"><h2>ZIP 推送</h2><p>连接 GitHub 后，可以像 Working Copy 一样上传源码 ZIP，预览变更并 Commit + Push。</p></section>`
  const defaults=githubDefaults(),plan=state.githubImportPlan
  return `<section class="surface github-import-panel"><div><h2>上传 ZIP 并推送</h2><p>适合我给你的更新包：上传后先比较文件，再写入目标分支。默认只新增或覆盖，不会删除仓库里 ZIP 缺少的文件，也不会强制推送。</p></div><form id="github-import-form"><label>所有者<input name="owner" value="${escapeHTML(data?.owner||defaults.owner)}" required></label><label>仓库<input name="repo" value="${escapeHTML(data?.name||defaults.repo)}" required></label><label>分支<input name="branch" value="${escapeHTML(data?.default_branch||defaults.branch)}" required></label><label class="wide-field">源码 ZIP<input name="file" type="file" accept=".zip,application/zip" required></label><button class="primary-button" type="submit">上传并预览差异</button></form>${plan?`<div class="import-preview"><div class="import-counts"><span><b>${plan.added}</b>新增</span><span><b>${plan.modified}</b>修改</span><span><b>${plan.unchanged}</b>未变化</span><span><b>${plan.skipped}</b>已忽略</span></div><div class="import-file-list">${(plan.changes||[]).slice(0,120).map(c=>`<div><b class="change-${escapeHTML(c.status)}">${c.status==='added'?'新增':c.status==='modified'?'修改':'不变'}</b><code>${escapeHTML(c.path)}</code><span>${formatBytes(c.size)}</span></div>`).join('')}</div><form id="github-import-commit-form"><label>提交说明<input name="message" value="update LukePanel from uploaded ZIP" maxlength="200" required></label><button class="primary-button" type="submit">Commit 并 Push 到 ${escapeHTML(plan.branch)}</button></form><p class="release-warning">${icon('shield',17)}提交前会再次确认远端分支没有变化；若别人刚推送过，LukePanel 会拒绝覆盖。</p></div>`:''}</section>`
}
function githubPage(){
  const defaults=githubDefaults(),data=state.github
  if(!state.githubAuth&&!state.loading.githubAuth){state.loading.githubAuth=true;queueMicrotask(async()=>{await loadGitHubAuth(true);state.loading.githubAuth=false;render()})}
  if(!data&&!state.errors.github&&!state.loading.github)queueMicrotask(()=>loadGitHub(defaults.owner,defaults.repo))
  const latest=data?.latest_release,tagSuggestion=latest?.tag_name?nextVersionSuggestion(latest.tag_name):'v0.4.0-alpha'
  const actions=data?`<a class="secondary-button compact" href="https://github.com/${escapeHTML(data.full_name)}/actions" target="_blank" rel="noopener">${icon('external',16)}<span>打开 Actions</span></a>`:''
  return `<div class="page-wrap github-page">${pageHeader('GitHub 助手','网页登录、ZIP 差异预览、Commit、Push、Tag 与 Actions',actions)}${githubAuthCard()}<form id="github-repo-form" class="surface github-repo-form"><label>所有者<input name="owner" value="${escapeHTML(data?.owner||defaults.owner)}" required></label><label>仓库<input name="repo" value="${escapeHTML(data?.name||defaults.repo)}" required></label><button class="primary-button" type="submit">检查仓库</button></form>${errorBox(state.errors.github)}${state.loading.github?surfaceLoading('读取 GitHub 仓库'):data?`<section class="github-summary-grid"><article class="surface status-card"><div class="card-heading">${icon('github',20)}<strong>${escapeHTML(data.full_name)}</strong></div><dl class="info-list"><div><dt>默认分支</dt><dd>${escapeHTML(data.default_branch)}</dd></div><div><dt>最新提交</dt><dd><code>${escapeHTML((data.main_sha||'').slice(0,12)||'-')}</code></dd></div><div><dt>最新标签</dt><dd>${escapeHTML(data.tags?.[0]?.name||'暂无')}</dd></div><div><dt>最新 Release</dt><dd>${escapeHTML(latest?.tag_name||'暂无')}</dd></div><div><dt>可见性</dt><dd>${escapeHTML(data.visibility)}</dd></div></dl><div class="quick-copy-grid"><button class="secondary-button compact" data-copy-text="curl -fsSL https://raw.githubusercontent.com/${escapeHTML(data.full_name)}/main/install.sh | bash">复制安装命令</button><button class="secondary-button compact" data-copy-text="https://github.com/${escapeHTML(data.full_name)}">复制仓库地址</button></div></article><article class="surface status-card"><div class="card-heading">${icon('activity',20)}<strong>最近 Actions</strong></div><div class="workflow-list">${(data.workflow_runs||[]).slice(0,8).map(run=>`<div><span class="workflow-dot ${run.conclusion==='success'?'ok':run.status!=='completed'?'running':'bad'}"></span><div><strong>${escapeHTML(run.name)}</strong><small>${escapeHTML(run.head_branch||run.event)} · ${formatDate(run.created_at)}</small></div><div class="workflow-actions"><b>${workflowStatus(run)}</b><a href="${escapeHTML(run.html_url)}" target="_blank" rel="noopener" aria-label="打开运行记录">${icon('external',14)}</a>${['failure','cancelled','timed_out'].includes(run.conclusion)&&state.githubAuth?.connected?`<button data-github-rerun="${run.id}" aria-label="重试失败任务">重试</button>`:''}</div></div>`).join('')||'<div class="empty-list">暂无 Actions 记录</div>'}</div></article></section>${githubImportHTML(data)}<section class="surface release-helper"><div><h2>创建版本标签并触发 Release</h2><p>标签会创建在当前默认分支最新提交上。需要 GitHub 连接拥有 Contents 写权限。</p></div><form id="github-tag-form"><label>版本号<input name="tag" value="${escapeHTML(tagSuggestion)}" pattern="v[0-9][A-Za-z0-9._-]*" required></label><label>目标提交<input name="sha" value="${escapeHTML(data.main_sha||'')}" readonly></label><div class="release-warning">${icon('shield',17)}不会自动 Force Push；创建标签前仍需 LukePanel 二次验证。</div><button class="primary-button" type="submit" ${state.githubAuth?.connected?'':'disabled'}>${state.githubAuth?.connected?'创建 Tag 并触发发布':'请先连接 GitHub'}</button></form></section>`:''}</div>`
}
function nextVersionSuggestion(current){const match=String(current).match(/^v(\d+)\.(\d+)\.(\d+)(.*)$/);if(!match)return 'v0.4.0-alpha';return `v${match[1]}.${Number(match[2])+1}.0-alpha`}
async function startGitHubDeviceFlow(form){const f=new FormData(form),clientID=String(f.get('client_id')||'').trim(),button=form.querySelector('button');localStorage.setItem('github-client-id',clientID);button.disabled=true;button.textContent='正在创建登录…';try{state.githubFlow=await api('/api/v1/github/auth/device/start',{method:'POST',body:jsonBody({client_id:clientID})});render();window.open(state.githubFlow.verification_uri,'_blank','noopener');scheduleGitHubPoll()}catch(error){alert(error.message)}finally{button.disabled=false;button.textContent='连接 GitHub'}}
function scheduleGitHubPoll(){if(state.githubFlowTimer)clearTimeout(state.githubFlowTimer);if(!state.githubFlow?.flow_id)return;const delay=Math.max(2,Number(state.githubFlow.interval||5))*1000;state.githubFlowTimer=setTimeout(pollGitHubDeviceFlow,delay)}
async function pollGitHubDeviceFlow(){if(!state.githubFlow?.flow_id)return;try{const result=await api('/api/v1/github/auth/device/poll',{method:'POST',body:jsonBody({flow_id:state.githubFlow.flow_id})});if(result.status==='authorized'){state.githubFlow=null;state.githubAuth={connected:true,...result};showToast(`已连接 GitHub @${result.login}`);await loadGitHub(githubDefaults().owner,githubDefaults().repo);return}if(['expired','denied'].includes(result.status)){state.githubFlow=null;alert(result.message||'GitHub 登录已取消或过期');render();return}state.githubFlow.interval=result.retry_after||state.githubFlow.interval;scheduleGitHubPoll()}catch(error){state.githubFlow=null;alert(error.message);render()}}
async function disconnectGitHub(){if(!confirm('断开当前 GitHub 登录？Token 会立即从内存移除。'))return;await api('/api/v1/github/auth/disconnect',{method:'POST'});state.githubAuth={connected:false};state.githubImportPlan=null;render()}
async function previewGitHubImport(form){const f=new FormData(form),button=form.querySelector('button');localStorage.setItem('github-owner',String(f.get('owner')));localStorage.setItem('github-repo',String(f.get('repo')));localStorage.setItem('github-branch',String(f.get('branch')));button.disabled=true;button.textContent='上传并比较中…';try{state.githubImportPlan=await api('/api/v1/github/import/preview',{method:'POST',body:f});render();showToast('差异预览已生成')}catch(error){alert(error.message)}finally{button.disabled=false;button.textContent='上传并预览差异'}}
async function commitGitHubImport(form){const f=new FormData(form),button=form.querySelector('button'),plan=state.githubImportPlan;if(!plan)return;if(!confirm(`确认将 ${plan.added} 个新增、${plan.modified} 个修改文件推送到 ${plan.owner}/${plan.repo}:${plan.branch}？`))return;button.disabled=true;button.textContent='正在 Commit + Push…';try{const result=await secureApi('/api/v1/github/import/commit',{method:'POST',body:jsonBody({plan_id:plan.id,message:f.get('message')})});state.githubImportPlan=null;showToast(`已推送 ${result.files} 个文件`);window.open(result.html_url,'_blank','noopener');await loadGitHub(plan.owner,plan.repo)}catch(error){alert(error.message)}finally{button.disabled=false;button.textContent=`Commit 并 Push 到 ${plan.branch}`}}
async function createGitHubTag(form){const f=new FormData(form),button=form.querySelector('button');if(!confirm(`确认创建标签 ${f.get('tag')}？创建后 GitHub Actions 会开始发布。`))return;button.disabled=true;button.textContent='正在创建…';try{await secureApi('/api/v1/github/tag',{method:'POST',body:jsonBody({owner:state.github.owner,repo:state.github.name,tag:f.get('tag'),targetSHA:f.get('sha')})});showToast('标签已创建，Release Actions 将自动运行');setTimeout(()=>loadGitHub(state.github.owner,state.github.name),2500)}catch(e){alert(e.message)}finally{button.disabled=false;button.textContent='创建 Tag 并触发发布'}}
async function rerunGitHubAction(runID){if(!confirm('确认重新运行这个 Actions 中失败的任务？'))return;try{await secureApi('/api/v1/github/rerun',{method:'POST',body:jsonBody({owner:state.github.owner,repo:state.github.name,run_id:Number(runID)})});showToast('已请求重试失败任务');setTimeout(()=>loadGitHub(state.github.owner,state.github.name),2200)}catch(error){alert(error.message)}}

async function loadSecurity(){if(state.loading.security)return;state.loading.security=true;try{const [settings,sessions]=await Promise.all([api('/api/v1/settings'),api('/api/v1/auth/sessions')]);state.settings=settings;state.sessions=sessions}catch(e){state.errors.security=e.message}finally{state.loading.security=false;render()}}
function securityPage(){
  if((!state.settings||!state.sessions)&&!state.errors.security){queueMicrotask(loadSecurity)}
  const uninstallCommand='lukepanel-uninstall'
  const purgeCommand='lukepanel-uninstall --purge'
  const headerActions=`<button data-logout class="danger-button compact">${icon('logout',16)}<span>退出</span></button>`
  return `<div class="page-wrap security-page">${pageHeader('我的与安全','账户、会话、刷新策略与面板安全',headerActions)}${errorBox(state.errors.security)}<section class="settings-list surface"><div class="setting-row"><div class="setting-icon">${icon('shield',21)}</div><div><strong>当前账户</strong><p>${escapeHTML(state.username)} · 当前会话 ${escapeHTML(state.sessionID||'-')}</p></div><span>${escapeHTML(state.settings?.version||'dev')}</span></div><div class="setting-row"><div class="setting-icon">${icon('refresh',21)}</div><div><strong>兼容刷新间隔</strong><p>实时推送不可用时才启用；页面后台仍会暂停</p></div><select id="refresh-interval"><option value="2">2 秒</option><option value="5">5 秒</option><option value="10">10 秒</option><option value="30">30 秒</option><option value="60">60 秒</option></select></div><div class="setting-row"><div class="setting-icon">${icon('clock',21)}</div><div><strong>活跃会话</strong><p>${state.sessions?.sessions?.length||1} 个会话，密码修改后其余会话会失效</p></div><button id="revoke-sessions" class="secondary-button compact">退出其他设备</button></div><div class="setting-row muted"><div class="setting-icon">${icon('key',21)}</div><div><strong>TOTP / Passkey</strong><p>需要完整恢复流程后开放，避免把自己锁在服务器外</p></div><span>规划中</span></div></section><section class="password-panel surface"><h2>修改登录密码</h2><p>新密码至少 12 个字符。密码框使用英文键盘提示并关闭自动纠正。</p><form id="password-form"><label>当前密码<input name="current" type="password" autocomplete="current-password" ${passwordInputAttributes()}></label><label>新密码<input name="next" type="password" minlength="12" autocomplete="new-password" ${passwordInputAttributes()}></label><label>确认新密码<input name="confirm" type="password" minlength="12" autocomplete="new-password" ${passwordInputAttributes()}></label><div id="password-message" class="form-error" hidden></div><button class="primary-button" type="submit">保存新密码</button></form></section><section class="account-actions surface"><div><h2>账户操作</h2><p>退出只会结束当前设备会话，不影响服务器服务。</p></div><button data-logout class="danger-button">${icon('logout',18)}退出当前账号</button></section><section class="uninstall-panel surface"><div><h2>卸载 LukePanel</h2><p>默认卸载程序和 systemd 服务，但保留配置、密码、审计日志及文件备份，方便重新安装。</p></div><div class="command-row"><code>${uninstallCommand}</code><button class="secondary-button compact" data-copy-text="${uninstallCommand}">${icon('copy',16)}复制</button></div><div class="command-row danger-command"><code>${purgeCommand}</code><button class="secondary-button compact" data-copy-text="${purgeCommand}">${icon('copy',16)}复制彻底卸载命令</button></div><small>彻底卸载会删除 /etc/lukepanel、/var/lib/lukepanel 和面板用户，执行前请自行备份。</small></section><section class="security-meta surface"><dl class="info-list"><div><dt>监听</dt><dd>${escapeHTML(state.settings?.listen||'-')}</dd></div><div><dt>安全 Cookie</dt><dd>${state.settings?.secure_cookie?'已开启':'已关闭'}</dd></div><div><dt>Agent Socket</dt><dd>${escapeHTML(state.settings?.agent_socket||'-')}</dd></div></dl></section></div>`
}
function modalHTML(){
  if(!state.modal)return''
  const m=state.modal;let body='',footer=''
  if(m.kind==='loading')body='<div class="modal-loading"><div class="spinner"></div></div>'
  else if(m.kind==='logs'){body=`<pre class="modal-log">${escapeHTML(m.content)}</pre>`;footer=`<footer><button class="secondary-button compact" id="copy-modal-log">${icon('copy',16)}复制全部</button><button class="primary-button compact" id="modal-done">完成</button></footer>`}
  else if(m.kind==='error')body=`<div class="alert error modal-error">${icon('alert',18)}${escapeHTML(m.content)}</div>`
  else if(m.kind==='editor'){
    body=`<textarea id="file-editor" spellcheck="false">${escapeHTML(m.content)}</textarea>`
    footer=`<footer><div class="editor-secondary-actions"><button id="copy-file-path" class="secondary-button compact">${icon('copy',16)}路径</button><button id="copy-file-content" class="secondary-button compact">${icon('copy',16)}内容</button><button id="download-file" class="secondary-button compact">${icon('download',16)}下载</button><button id="rename-file" class="secondary-button compact">重命名</button><button id="delete-file" class="danger-button compact">${icon('trash',16)}删除</button></div><button id="save-file" class="primary-button compact">${icon('save',16)}保存</button></footer>`
  }else if(m.kind==='file-actions'){
    const item=m.item
    body=`<div class="action-sheet"><button data-file-action="copy-path">${icon('copy',19)}<span>复制完整路径</span></button>${item.is_dir?'':`<button data-file-action="download">${icon('download',19)}<span>下载文件</span></button>`}<button data-file-action="rename">${icon('edit',19)}<span>重命名</span></button><button data-file-action="copy">${icon('copy',19)}<span>复制到…</span></button><button data-file-action="move">${icon('move',19)}<span>移动到…</span></button><button data-file-action="chmod">${icon('shield',19)}<span>修改权限</span><small>${escapeHTML(item.mode||'')}</small></button><button class="danger" data-file-action="delete">${icon('trash',19)}<span>移入回收站</span></button></div>`
  }else if(m.kind==='upload-menu'){
    body=`<div class="action-sheet"><button id="choose-files-upload">${icon('file',19)}<span>上传文件</span><small>可多选</small></button><button id="choose-folder-upload">${icon('folder',19)}<span>上传整个文件夹</span><small>保留目录结构</small></button><button id="choose-zip-extract">${icon('package',19)}<span>上传 ZIP 并解压</span><small>适合 iPhone 和大量文件</small></button></div>`
  }else if(m.kind==='docker-edit'){
    const x=m.spec
    if(x.compose_managed){body=`<div class="compose-managed-note">${icon('alert',20)}<h3>这个容器由 Docker Compose 管理</h3><p>直接重建会让配置和 Compose 文件失去同步。请编辑下面的 Compose YAML，再回到 Docker 页面点“启动/更新”。</p>${(x.compose_files||[]).map(path=>`<button class="secondary-button" data-open-compose-file="${escapeHTML(path)}">${icon('file',17)}${escapeHTML(path)}</button>`).join('')||'<span>未读取到 Compose 文件路径</span>'}</div>`}
    else{body=`<form id="docker-edit-form" class="docker-edit-form"><div class="form-grid"><label>容器名称<input name="name" value="${escapeHTML(x.name)}" required></label><label>镜像<input name="image" value="${escapeHTML(x.image)}" required></label><label>重启策略<select name="restart_policy"><option value="no" ${x.restart_policy==='no'?'selected':''}>不自动重启</option><option value="unless-stopped" ${x.restart_policy==='unless-stopped'?'selected':''}>除非手动停止</option><option value="always" ${x.restart_policy==='always'?'selected':''}>始终重启</option><option value="on-failure" ${x.restart_policy==='on-failure'?'selected':''}>失败时重启</option></select></label><label>失败最大重试<input name="restart_maximum_retry_count" type="number" min="0" value="${x.restart_maximum_retry_count||0}"></label><label>主机名<input name="hostname" value="${escapeHTML(x.hostname||'')}"></label><label>容器用户<input name="user" value="${escapeHTML(x.user||'')}"></label><label class="wide-field">工作目录<input name="working_dir" value="${escapeHTML(x.working_dir||'')}"></label><label class="wide-field">环境变量（每行一个 KEY=VALUE）<textarea name="env" rows="6">${escapeHTML((x.env||[]).join('\n'))}</textarea></label><label class="wide-field">端口（每行：主机IP|主机端口|容器端口|tcp/udp）<textarea name="ports" rows="5" placeholder="0.0.0.0|8080|80|tcp">${escapeHTML(dockerPortsText(x.ports))}</textarea></label><label class="wide-field">挂载（每行：bind/volume|来源|容器路径|ro/rw）<textarea name="mounts" rows="5" placeholder="bind|/opt/data|/data|rw">${escapeHTML(dockerMountsText(x.mounts))}</textarea></label><label>启动命令参数（每行一个）<textarea name="cmd" rows="4">${escapeHTML((x.cmd||[]).join('\n'))}</textarea></label><label>Entrypoint（每行一个）<textarea name="entrypoint" rows="4">${escapeHTML((x.entrypoint||[]).join('\n'))}</textarea></label></div><label class="checkbox-row"><input name="start" type="checkbox" ${x.running?'checked':''}><span>保存后启动新容器</span></label><div class="release-warning">${icon('shield',17)}保存时会先备份旧容器。新容器创建或启动失败会自动回滚。</div><button class="primary-button" type="submit">保存并重建</button></form>`}
  }else if(m.kind==='elevation')body=`<form id="elevation-form" class="elevation-form"><div class="elevation-icon">${icon('shield',24)}</div><p>此操作会修改服务器状态，请输入当前登录密码继续。</p><label>当前密码<input id="elevation-password" name="password" type="password" autocomplete="current-password" ${passwordInputAttributes()} required></label><div id="elevation-error" class="form-error" hidden></div><button class="primary-button" type="submit">验证并继续</button><button class="secondary-button" type="button" id="elevation-cancel">取消</button></form>`
  else if(m.kind==='process')body=`<div class="process-dialog"><p>${escapeHTML(m.content)}</p><code>PID ${m.pid}</code><button class="secondary-button" id="process-term">正常结束 SIGTERM</button><button class="danger-button" id="process-kill">强制结束 SIGKILL</button></div>`
  return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal-card ${['editor','logs','docker-edit'].includes(m.kind)?'wide':''}"><header><div><strong>${escapeHTML(m.title)}</strong>${m.path?`<small>${escapeHTML(m.path)}</small>`:''}</div><button id="modal-close">${icon('close',20)}</button></header><div class="modal-body">${body}</div>${footer}</section></div>`
}


function bindShell(){
  document.querySelector('#theme-toggle')?.addEventListener('click',()=>{applyTheme(theme()==='dark'?'light':'dark');render()})
  document.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.back||'/')))
  document.querySelectorAll('[data-logout]').forEach(button=>button.addEventListener('click',performLogout))
  document.querySelectorAll('[data-copy-text]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();copyText(button.dataset.copyText)}))

  document.querySelector('#refresh-overview')?.addEventListener('click',e=>{e.currentTarget.querySelector('svg')?.classList.add('spin');loadOverview(true)})

  document.querySelector('#refresh-services')?.addEventListener('click',()=>loadServices(state.serviceQuery))
  let searchTimer;document.querySelector('#service-search')?.addEventListener('input',e=>{state.serviceQuery=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadServices(state.serviceQuery),350)})
  document.querySelectorAll('[data-service-filter]').forEach(button=>button.onclick=()=>{state.serviceFilter=button.dataset.serviceFilter;render()})
  document.querySelectorAll('[data-service-action]').forEach(b=>b.onclick=()=>serviceAction(b.dataset.name,b.dataset.serviceAction))
  document.querySelectorAll('[data-service-logs]').forEach(b=>b.onclick=()=>showServiceLogs(b.dataset.serviceLogs))

  document.querySelector('#refresh-processes')?.addEventListener('click',()=>loadProcesses())
  document.querySelectorAll('[data-process-pid]').forEach(bindProcessButton)
  document.querySelector('#refresh-network')?.addEventListener('click',loadNetwork)
  document.querySelector('#refresh-storage')?.addEventListener('click',loadStorage)
  document.querySelector('#toggle-virtual-mounts')?.addEventListener('click',()=>{state.storageShowVirtual=!state.storageShowVirtual;render()})
  document.querySelector('#refresh-timers')?.addEventListener('click',loadTimers)
  document.querySelector('#refresh-updates')?.addEventListener('click',loadUpdates)

  document.querySelector('#refresh-docker')?.addEventListener('click',loadDocker)
  document.querySelector('#pull-image')?.addEventListener('click',pullImage)
  document.querySelectorAll('[data-docker-tab]').forEach(b=>b.onclick=()=>{state.dockerTab=b.dataset.dockerTab;render()})
  document.querySelectorAll('[data-compose-action]').forEach(b=>b.onclick=()=>composeAction(b.dataset.project,b.dataset.composeAction))
  document.querySelectorAll('[data-compose-edit]').forEach(b=>b.onclick=()=>openFile(b.dataset.composeEdit))
  document.querySelectorAll('[data-image-delete]').forEach(b=>b.onclick=()=>deleteDockerResource('image',b.dataset.imageDelete,imageName((state.dockerImages?.images||[]).find(i=>i.id===b.dataset.imageDelete)||{id:b.dataset.imageDelete})))
  document.querySelectorAll('[data-network-delete]').forEach(b=>b.onclick=()=>deleteDockerResource('network',b.dataset.networkDelete,b.dataset.name))
  document.querySelectorAll('[data-volume-delete]').forEach(b=>b.onclick=()=>deleteDockerResource('volume',b.dataset.volumeDelete))
  document.querySelectorAll('[data-docker-action]').forEach(b=>b.onclick=()=>dockerAction(b.dataset.id,b.dataset.dockerAction))
  document.querySelectorAll('[data-docker-logs]').forEach(b=>b.onclick=()=>showDockerLogs(b.dataset.dockerLogs,b.dataset.title))
  document.querySelectorAll('[data-docker-edit]').forEach(b=>b.onclick=()=>openDockerEditor(b.dataset.dockerEdit,b.dataset.title))

  document.querySelectorAll('[data-file-view]').forEach(button=>button.onclick=()=>{state.fileView=button.dataset.fileView;if(state.fileView==='recycle'&&!state.recycle)loadRecycle();else render()})
  document.querySelector('#file-back')?.addEventListener('click',()=>state.files?.parent&&loadFiles(state.files.parent))
  document.querySelector('#file-home')?.addEventListener('click',()=>loadFiles('/'))
  document.querySelectorAll('[data-file-jump]').forEach(button=>button.onclick=()=>loadFiles(button.dataset.fileJump))
  document.querySelector('#refresh-files')?.addEventListener('click',()=>loadFiles(state.files?.path||'/'))
  document.querySelector('#file-search')?.addEventListener('input',event=>{
    state.fileFilter=event.target.value.toLowerCase();let shown=0
    document.querySelectorAll('.file-row').forEach(row=>{const match=row.textContent.toLowerCase().includes(state.fileFilter);row.hidden=!match;if(match)shown++})
    const count=document.querySelector('.file-search span');if(count)count.textContent=`${shown} / ${state.files?.entries?.length||0}`
  })
  document.querySelectorAll('[data-file-path]').forEach(row=>row.onclick=()=>row.dataset.directory==='true'?loadFiles(row.dataset.filePath):openFile(row.dataset.filePath))
  document.querySelectorAll('[data-file-menu]').forEach(button=>button.onclick=event=>{event.stopPropagation();openFileMenu(button.dataset.fileMenu)})
  document.querySelector('#new-file')?.addEventListener('click',createEntry)
  document.querySelector('#upload-file')?.addEventListener('click',()=>{state.modal={title:'上传到当前目录',kind:'upload-menu'};render()})
  document.querySelector('#upload-input')?.addEventListener('change',e=>uploadSelected(e.target.files,false))
  document.querySelector('#upload-folder-input')?.addEventListener('change',e=>uploadSelected(e.target.files,true))
  document.querySelector('#upload-zip-input')?.addEventListener('change',e=>uploadAndExtractZIP(e.target.files))
  document.querySelectorAll('[data-recycle-action]').forEach(button=>button.onclick=()=>recycleAction(button.dataset.recycleId,button.dataset.recycleAction))

  document.querySelectorAll('.tool-form').forEach(form=>form.onsubmit=e=>{e.preventDefault();runTool(form)})

  document.querySelector('#refresh-audit')?.addEventListener('click',loadAudit)
  document.querySelectorAll('[data-log-tab]').forEach(button=>button.onclick=()=>{state.logTab=button.dataset.logTab;render()})
  document.querySelector('#audit-search')?.addEventListener('input',event=>{
    state.auditFilter=event.target.value.toLowerCase();let shown=0
    document.querySelectorAll('.audit-row').forEach(row=>{const match=row.textContent.toLowerCase().includes(state.auditFilter);row.hidden=!match;if(match)shown++})
    const count=document.querySelector('.audit-search span');if(count)count.textContent=`${shown} / ${state.audit?.events?.length||0}`
  })
  document.querySelector('#copy-current-log')?.addEventListener('click',()=>copyText(state.logTab==='system'?(state.systemLogs?.logs||''):filteredAuditEvents().map(auditEventText).join('\n'),'日志已复制'))
  document.querySelector('#export-audit')?.addEventListener('click',()=>state.logTab==='system'?downloadText(`lukepanel-system-${Date.now()}.log`,state.systemLogs?.logs||''):downloadText(`lukepanel-audit-${Date.now()}.json`,JSON.stringify(filteredAuditEvents(),null,2),'application/json;charset=utf-8'))

  document.querySelector('#refresh-ssh')?.addEventListener('click',()=>loadSSH(state.sshUser))
  document.querySelector('#ssh-user')?.addEventListener('change',event=>loadSSH(event.target.value))
  const sshForm=document.querySelector('#ssh-key-form');if(sshForm)sshForm.onsubmit=event=>{event.preventDefault();addSSHKey(sshForm)}
  document.querySelectorAll('[data-ssh-key-delete]').forEach(button=>button.onclick=()=>deleteSSHKey(button.dataset.sshKeyDelete))

  const githubRepoForm=document.querySelector('#github-repo-form');if(githubRepoForm)githubRepoForm.onsubmit=event=>{event.preventDefault();const f=new FormData(githubRepoForm);loadGitHub(String(f.get('owner')).trim(),String(f.get('repo')).trim())}
  const githubConnectForm=document.querySelector('#github-connect-form');if(githubConnectForm)githubConnectForm.onsubmit=event=>{event.preventDefault();startGitHubDeviceFlow(githubConnectForm)}
  document.querySelector('#github-disconnect')?.addEventListener('click',disconnectGitHub)
  document.querySelector('#copy-github-code')?.addEventListener('click',()=>copyText(state.githubFlow?.user_code||'','授权代码已复制'))
  const githubImportForm=document.querySelector('#github-import-form');if(githubImportForm)githubImportForm.onsubmit=event=>{event.preventDefault();previewGitHubImport(githubImportForm)}
  const githubImportCommitForm=document.querySelector('#github-import-commit-form');if(githubImportCommitForm)githubImportCommitForm.onsubmit=event=>{event.preventDefault();commitGitHubImport(githubImportCommitForm)}
  const githubTagForm=document.querySelector('#github-tag-form');if(githubTagForm)githubTagForm.onsubmit=event=>{event.preventDefault();createGitHubTag(githubTagForm)}
  document.querySelectorAll('[data-github-rerun]').forEach(button=>button.onclick=()=>rerunGitHubAction(button.dataset.githubRerun))

  const interval=document.querySelector('#refresh-interval');if(interval){interval.value=String(state.settings?.auto_refresh_seconds||5);interval.onchange=async()=>{try{await api('/api/v1/settings',{method:'PATCH',body:jsonBody({auto_refresh_seconds:Number(interval.value)})});state.settings.auto_refresh_seconds=Number(interval.value);syncOverviewUpdates()}catch(e){alert(e.message)}}}
  document.querySelector('#revoke-sessions')?.addEventListener('click',async()=>{if(!confirm('确认退出其他所有设备？'))return;try{const r=await api('/api/v1/auth/sessions',{method:'DELETE'});alert(`已退出 ${r.revoked} 个会话`);await loadSecurity()}catch(e){alert(e.message)}})
  const passwordForm=document.querySelector('#password-form');if(passwordForm)passwordForm.onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),message=document.querySelector('#password-message'),button=e.currentTarget.querySelector('button'),next=String(f.get('next')||''),confirmValue=String(f.get('confirm')||'');message.hidden=true;if(next!==confirmValue){message.textContent='两次输入的新密码不一致';message.hidden=false;return}button.disabled=true;button.textContent='正在保存…';try{await api('/api/v1/auth/password',{method:'POST',body:jsonBody({current_password:f.get('current'),new_password:next})});message.className='form-success';message.textContent='密码已更新，其他设备已退出';message.hidden=false;e.currentTarget.reset()}catch(err){message.className='form-error';message.textContent=err.message;message.hidden=false}finally{button.disabled=false;button.textContent='保存新密码'}}

  document.querySelector('#choose-files-upload')?.addEventListener('click',()=>{state.modal=null;render();document.querySelector('#upload-input')?.click()})
  document.querySelector('#choose-folder-upload')?.addEventListener('click',()=>{state.modal=null;render();document.querySelector('#upload-folder-input')?.click()})
  document.querySelector('#choose-zip-extract')?.addEventListener('click',()=>{state.modal=null;render();document.querySelector('#upload-zip-input')?.click()})
  document.querySelector('#docker-edit-form')?.addEventListener('submit',event=>{event.preventDefault();submitDockerEdit()})
  document.querySelectorAll('[data-open-compose-file]').forEach(button=>button.onclick=()=>{state.modal=null;navigate('/files');setTimeout(()=>openFile(button.dataset.openComposeFile),50)})
  document.querySelector('#process-term')?.addEventListener('click',()=>signalProcess(state.modal.pid,'term'))
  document.querySelector('#process-kill')?.addEventListener('click',()=>signalProcess(state.modal.pid,'kill'))
  const elevationForm=document.querySelector('#elevation-form');if(elevationForm)elevationForm.onsubmit=async event=>{event.preventDefault();const password=String(new FormData(elevationForm).get('password')||''),button=elevationForm.querySelector('button[type=submit]'),error=document.querySelector('#elevation-error');button.disabled=true;button.textContent='正在验证…';error.hidden=true;try{await api('/api/v1/auth/elevate',{method:'POST',body:jsonBody({password})});const pending=pendingElevation;pendingElevation=null;state.modal=null;render();pending?.resolve(true)}catch(err){error.textContent=err.message;error.hidden=false;button.disabled=false;button.textContent='验证并继续';document.querySelector('#elevation-password')?.focus()}}
  document.querySelector('#elevation-cancel')?.addEventListener('click',closeModal)
  document.querySelector('#modal-close')?.addEventListener('click',closeModal)
  document.querySelector('#modal-done')?.addEventListener('click',closeModal)
  document.querySelector('#modal-backdrop')?.addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeModal()})
  document.querySelector('#copy-modal-log')?.addEventListener('click',()=>copyText(state.modal?.content||'','日志已复制'))
  document.querySelectorAll('[data-file-action]').forEach(button=>button.onclick=()=>{
    const action=button.dataset.fileAction,item=state.modal?.item;if(!item)return
    if(action==='copy-path'){copyText(item.path,'路径已复制');return}
    if(action==='download'){location.href=`/api/v1/files/download?path=${encodeURIComponent(item.path)}`;return}
    fileMutation(action,item)
  })
  document.querySelector('#file-editor')?.addEventListener('input',()=>{if(state.modal)state.modal.dirty=true})
  document.querySelector('#save-file')?.addEventListener('click',saveFile)
  document.querySelector('#copy-file-path')?.addEventListener('click',()=>copyText(state.modal?.path||'','路径已复制'))
  document.querySelector('#copy-file-content')?.addEventListener('click',()=>copyText(document.querySelector('#file-editor')?.value||'','内容已复制'))
  document.querySelector('#download-file')?.addEventListener('click',()=>{location.href=`/api/v1/files/download?path=${encodeURIComponent(state.modal.path)}`})
  document.querySelector('#rename-file')?.addEventListener('click',()=>fileMutation('rename',{path:state.modal.path,is_dir:false,mode:state.fileContent?.mode}))
  document.querySelector('#delete-file')?.addEventListener('click',()=>fileMutation('delete',{path:state.modal.path,is_dir:false,mode:state.fileContent?.mode}))
}

function closeModal(){
  if(state.modal?.dirty&&!confirm('有未保存的修改，确认关闭？'))return
  if(state.modal?.kind==='elevation'&&pendingElevation){const pending=pendingElevation;pendingElevation=null;pending.reject(new Error('操作已取消'))}
  state.modal=null;render()
}
async function performLogout(){
  if(!confirm('确认退出当前账号？'))return
  try{await api('/api/v1/auth/logout',{method:'POST'})}catch{}
  state.authenticated=false;state.csrf='';state.sessionID='';stopOverviewUpdates();history.replaceState({},'','/login');render()
}
function setBusy(value){document.body.classList.toggle('busy',value)}

function render(){
  if(!state.authenticated){if(location.pathname!='/login')history.replaceState({},'','/login');renderLogin();return}
  if(location.pathname==='/login'){const target=rememberedRoute('/');history.replaceState({},'',target)}
  const routes={'/':dashboard,'/system':systemPage,'/services':servicesPage,'/processes':processesPage,'/network':networkPage,'/storage':storagePage,'/tasks':tasksPage,'/updates':updatesPage,'/files':filesPage,'/docker':dockerPage,'/tools':toolsPage,'/github':githubPage,'/ssh':sshPage,'/audit':auditPage,'/security':securityPage}
  if(!routes[location.pathname])history.replaceState({},'','/')
  rememberRoute(location.pathname)
  app.innerHTML=shell((routes[location.pathname]||routes['/'])());bindShell();syncOverviewUpdates()
}

restore()
