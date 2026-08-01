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
  dockerStats: {},
  dockerStatsTimer: null,
  dockerLogTimer: null,
  dockerLogPaused: false,
  dockerCleanupPreview: null,
  services: null,
  serviceFilter: 'running',
  serviceQuery: '',
  processes: null,
  network: null,
  storage: null,
  storageShowVirtual: false,
  timers: null,
  tasks: null,
  updates: null,
  aptPreflight: null,
  aptSearchResults: null,
  aptQuery: '',
  hostSettings: null,
  snapshots: null,
  scheduledBackups: null,
  fileSearchResults: null,
  composeConfig: null,
  processPrimed: false,
  files: null,
  fileView: 'files',
  fileFilter: '',
  recycle: null,
  fileContent: null,
  fileBackups: null,
  fileDiff: null,
  audit: null,
  auditFilter: '',
  logTab: 'audit',
  logSource: '',
  systemLogs: null,
  systemLogTimer: null,
  settings: null,
  totpStatus: null,
  totpSetup: null,
  securityReport: null,
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
  firewall: null,
  fail2ban: null,
  ntp: null,
  aptSources: null,
  dockerHubResults: null,
  dockerHubQuery: '',
  dockerVolumeUsage: null,
  filePreferences: null,
  passkeys: null,
  trustedDevices: null,
  ipAllowlist: null,
  loginNotifications: null,
  auditQuery: {q:'',user:'',ip:'',action:'',result:'',from:'',to:'',offset:0,limit:200},
  githubJobs: null,
  githubAssets: null,
  backgroundJobs: null,
  activeJob: null,
  jobsLoading: false,
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
  check:'<path d="m5 12 4 4L19 6"/>',
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
function brandIcon(className='brand-mark',alt='LukePanel'){return `<img class="${className}" src="/assets/lukepanel-icon-192.png" alt="${escapeHTML(alt)}" width="44" height="44">`}
function escapeHTML(value=''){ return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])) }
function jsonBody(value){ return JSON.stringify(value) }

async function api(url, options={}){
  const headers = new Headers(options.headers||{})
  if(options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type','application/json')
  if(options.method && options.method!=='GET' && state.csrf) headers.set('X-CSRF-Token',state.csrf)
  const res = await fetch(url,{...options,headers,credentials:'same-origin'})
  const body = await res.json().catch(()=>({}))
  if(res.status===401 && state.authenticated){ state.authenticated=false; stopOverviewUpdates(); render() }
  if(!res.ok){const error=new Error(body.error||`请求失败（${res.status}）`);error.status=res.status;error.code=body.code||'';throw error}
  return body
}
const ROUTE_STORAGE_KEY='lukepanel:last-route'
const knownRoutes=new Set(['/','/system','/services','/processes','/network','/storage','/tasks','/updates','/host','/snapshots','/files','/docker','/tools','/github','/ssh','/audit','/security'])
const routeParents={'/system':'/','/services':'/system','/processes':'/system','/network':'/system','/storage':'/system','/tasks':'/system','/updates':'/system','/host':'/system','/snapshots':'/system','/files':'/system','/ssh':'/system','/docker':'/','/tools':'/','/github':'/tools','/audit':'/security','/security':'/'}
let pendingElevation=null
function rememberRoute(pathname){if(knownRoutes.has(pathname))sessionStorage.setItem(ROUTE_STORAGE_KEY,pathname)}
function rememberedRoute(fallback='/'){const saved=sessionStorage.getItem(ROUTE_STORAGE_KEY);return knownRoutes.has(saved)?saved:fallback}
function passwordInputAttributes(){return 'inputmode="latin" lang="en" autocapitalize="none" autocorrect="off" spellcheck="false"'}
let requestElevation
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
  syncDockerStats()
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
  ['概览','/','home'],['系统管理','/system','server'],['文件管理','/files','folder'],['Docker','/docker','container'],['常用工具','/tools','wrench'],['日志审计','/audit','scroll'],['安全设置','/security','shield']
]}
function isActive(href){ return href==='/' ? location.pathname==='/' : location.pathname===href || (href==='/system' && ['/services','/processes','/network','/storage','/tasks','/updates','/host','/snapshots','/ssh'].includes(location.pathname)) }
function shell(content){
  const nav=navItems()
  const mobileRoutes=new Set(['/','/system','/docker','/tools','/security'])
  const showMobileNav=mobileRoutes.has(location.pathname)
  const mobileNav=showMobileNav?`<nav class="mobile-nav">${nav.filter(([,href])=>mobileRoutes.has(href)).map(([label,href,i])=>`<a data-nav href="${href}" class="${isActive(href)?'active':''}">${icon(href==='/security'?'user':i,21)}<span>${href==='/security'?'我的':label.replace('管理','')}</span></a>`).join('')}</nav>`:''
  return `<div class="app-shell ${showMobileNav?'has-mobile-nav':'no-mobile-nav'}"><aside class="sidebar"><div class="brand">${brandIcon()}<div><strong>LukePanel</strong><span>${escapeHTML(state.settings?.version||'轻量系统管理')}</span></div></div><nav class="sidebar-nav">${nav.map(([label,href,i])=>`<a data-nav href="${href}" class="${isActive(href)?'active':''}">${icon(i,19)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-footer"><button id="theme-toggle" class="icon-text-button">${icon(theme()==='dark'?'sun':'moon',18)}${theme()==='dark'?'浅色模式':'深色模式'}</button><button data-logout class="icon-text-button danger-text">${icon('logout',18)}退出登录</button></div></aside><main class="main-content">${content}</main>${mobileNav}${modalHTML()}</div>`
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
  }catch{await showError('复制失败，请长按文本手动复制')}
}
function downloadText(filename,text,type='text/plain;charset=utf-8'){
  const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function showToast(message){
  document.querySelector('.toast')?.remove();const node=document.createElement('div');node.className='toast';node.textContent=message;document.body.appendChild(node);requestAnimationFrame(()=>node.classList.add('show'));setTimeout(()=>{node.classList.remove('show');setTimeout(()=>node.remove(),180)},1500)
}
function appDialog({title='提示',message='',confirmText='确定',cancelText='取消',danger=false,input=null,choices=null}){
  return new Promise(resolve=>{
    document.querySelector('.app-dialog-backdrop')?.remove()
    const root=document.createElement('div');root.className='app-dialog-backdrop'
    const choiceHTML=Array.isArray(choices)?`<div class="dialog-choices">${choices.map((choice,index)=>`<button type="button" data-choice="${index}" class="${choice.danger?'danger':''}"><strong>${escapeHTML(choice.label)}</strong>${choice.description?`<small>${escapeHTML(choice.description)}</small>`:''}</button>`).join('')}</div>`:''
    const inputHTML=input?`<label class="dialog-input">${escapeHTML(input.label||'请输入')}<input id="app-dialog-input" type="${escapeHTML(input.type||'text')}" inputmode="${escapeHTML(input.inputmode||'text')}" autocomplete="${escapeHTML(input.autocomplete||'off')}" autocapitalize="none" autocorrect="off" spellcheck="false" value="${escapeHTML(input.value||'')}" placeholder="${escapeHTML(input.placeholder||'')}" ${input.required?'required':''}></label>`:''
    root.innerHTML=`<section class="app-dialog-card" role="dialog" aria-modal="true"><header><strong>${escapeHTML(title)}</strong></header><div class="app-dialog-body">${message?`<p>${escapeHTML(message)}</p>`:''}${choiceHTML}${inputHTML}</div>${choices?'':`<footer class="${cancelText===null?'single':''}">${cancelText===null?'':`<button type="button" data-dialog-cancel class="secondary-button">${escapeHTML(cancelText)}</button>`}<button type="button" data-dialog-confirm class="${danger?'danger-button':'primary-button'}">${escapeHTML(confirmText)}</button></footer>`}</section>`
    const close=value=>{root.remove();resolve(value)}
    root.addEventListener('click',event=>{if(event.target===root)close(input?null:false)})
    root.querySelector('[data-dialog-cancel]')?.addEventListener('click',()=>close(input?null:false))
    root.querySelector('[data-dialog-confirm]')?.addEventListener('click',()=>{const field=root.querySelector('#app-dialog-input');if(field&&input?.required&&!field.value.trim()){field.focus();field.classList.add('invalid');return}close(field?field.value:true)})
    root.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>close(Number(button.dataset.choice))))
    document.body.appendChild(root)
    requestAnimationFrame(()=>{root.classList.add('show');root.querySelector('#app-dialog-input')?.focus()})
  })
}
function askConfirm(message,{title='确认操作',confirmText='继续',danger=false}={}){return appDialog({title,message,confirmText,danger})}
function askText(message,{title='输入内容',value='',placeholder='',confirmText='确定',required=true,type='text',inputmode='text',autocomplete='off'}={}){return appDialog({title,message,confirmText,input:{label:'',value,placeholder,required,type,inputmode,autocomplete}})}
function chooseAction(title,choices){return appDialog({title,choices})}
function showError(message,title='操作失败'){return appDialog({title,message,confirmText:'知道了',cancelText:null,danger:false})}
function metric(label,value,detail,percent,id){return `<article class="metric-card surface" data-metric="${id}"><div class="metric-card__header"><span>${label}</span><strong data-value>${value}</strong></div>${percent!==undefined?`<div class="progress"><span data-progress style="width:${clamp(percent)}%"></span></div>`:''}<p data-detail>${detail||''}</p></article>`}
function clamp(v){return Math.min(100,Math.max(0,Number(v)||0))}
function statusBadge(status){const kind=['running','active'].includes(status)?'success':['exited','inactive','failed','dead'].includes(status)?'muted':'warning';return `<span class="status-badge ${kind}"><i></i>${escapeHTML(status||'unknown')}</span>`}

let renderLogin

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
function swapDisplay(memory){
  const total=Number(memory?.SwapTotal||0),used=Number(memory?.SwapUsed||0),percent=total?used/total*100:0
  if(!total)return {value:'未启用',detail:'当前系统没有启用 Swap',percent:0}
  if(!used)return {value:'未使用',detail:`已启用 · 总量 ${formatBytes(total)}`,percent:0}
  return {value:`${percent.toFixed(1)}%`,detail:`${formatBytes(used)} / ${formatBytes(total)}`,percent}
}
function dashboard(){
  const d=state.overview
  if(!d){if(state.errors.overview)return `<div class="page-wrap">${pageHeader('系统概览','系统状态读取失败',`<button id="refresh-overview" class="secondary-button compact">${icon('refresh',17)}重试</button>`)}${errorBox(state.errors.overview)}</div>`;queueMicrotask(()=>loadOverview());return `<div class="page-wrap">${pageHeader('系统概览','正在读取实时状态')}${surfaceLoading('正在采集系统信息')}</div>`}
  if(!state.dashboardDocker&&!state.loading.dashboardDocker)queueMicrotask(()=>loadDashboardDocker())
  const mp=d.memory.Total?d.memory.Used/d.memory.Total*100:0,dp=d.disk.Total?d.disk.Used/d.disk.Total*100:0,swap=swapDisplay(d.memory)
  return `<div class="page-wrap" data-dashboard>${pageHeader('系统概览',`${d.hostname} · ${d.os}`,`<button id="refresh-overview" class="secondary-button compact">${icon('refresh',17,state.loading.overview?'spin':'')}<span>刷新</span></button>`)}${errorBox(state.errors.overview)}<section class="status-hero surface"><div><span class="status-dot"></span><strong>系统运行正常</strong><p>${icon('clock',16)}已运行 <span data-uptime>${formatUptime(d.uptime_seconds)}</span></p></div><div class="collection-time"><span data-stream-state>实时推送 · 2 秒</span><br><span data-collected>${formatDate(d.collected_at)}</span></div></section><section class="metrics-grid">${metric('CPU',`${d.cpu_percent.toFixed(1)}%`,`${d.cpu_cores} 核 · 负载 ${d.load_1.toFixed(2)} / ${d.load_5.toFixed(2)} / ${d.load_15.toFixed(2)}`,d.cpu_percent,'cpu')}${metric('内存',`${mp.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`,mp,'memory')}${metric('系统盘',`${dp.toFixed(1)}%`,`${formatBytes(d.disk.Used)} / ${formatBytes(d.disk.Total)}`,dp,'disk')}${metric('实时网络',`↓ ${formatRate(d.network.download_bps)}`,`↑ ${formatRate(d.network.upload_bps)} · 累计 ↓ ${formatBytes(d.network.received_bytes)}`,undefined,'network')}${metric('Swap',swap.value,swap.detail,swap.percent,'swap')}</section><section class="dashboard-grid"><article class="surface summary-card dashboard-docker-card" id="dashboard-docker"><div class="card-heading">${icon('container',19)}<strong>Docker</strong><span class="live-dot" title="每 10 秒同步"></span></div><div id="dashboard-docker-content">${dashboardDockerHTML()}</div></article><article class="surface summary-card"><div class="card-heading">${icon('server',19)}<strong>系统信息</strong></div><dl class="info-list"><div><dt>内核</dt><dd>${escapeHTML(d.kernel)}</dd></div><div><dt>架构</dt><dd>${escapeHTML(d.architecture)}</dd></div></dl></article></section></div>`
}
function updateDashboard(d){
  const mp=d.memory.Total?d.memory.Used/d.memory.Total*100:0,dp=d.disk.Total?d.disk.Used/d.disk.Total*100:0,swap=swapDisplay(d.memory)
  updateMetric('cpu',`${d.cpu_percent.toFixed(1)}%`,`${d.cpu_cores} 核 · 负载 ${d.load_1.toFixed(2)} / ${d.load_5.toFixed(2)} / ${d.load_15.toFixed(2)}`,d.cpu_percent)
  updateMetric('memory',`${mp.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`,mp)
  updateMetric('disk',`${dp.toFixed(1)}%`,`${formatBytes(d.disk.Used)} / ${formatBytes(d.disk.Total)}`,dp)
  updateMetric('network',`↓ ${formatRate(d.network.download_bps)}`,`↑ ${formatRate(d.network.upload_bps)} · 累计 ↓ ${formatBytes(d.network.received_bytes)}`)
  updateMetric('swap',swap.value,swap.detail,swap.percent)
  const uptime=document.querySelector('[data-uptime]');if(uptime)uptime.textContent=formatUptime(d.uptime_seconds)
  const collected=document.querySelector('[data-collected]');if(collected)collected.textContent=formatDate(d.collected_at)
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
    ['服务管理','systemd 状态、控制与日志','/services','power'],['文件管理','上传、预览、压缩与安全编辑','/files','folder'],['日志中心','系统日志与操作审计','/audit','scroll'],['Docker','容器、Compose、镜像与资源','/docker','container'],
    ['进程管理','CPU、内存排行与进程结束','/processes','activity'],['网络管理','接口、流量与监听端口','/network','network'],['存储管理','分区、文件系统与空间','/storage','drive'],['主机设置','主机名、时区、DNS、Swap 与内核','/host','server'],['配置快照','关键配置修改前自动备份与回滚','/snapshots','restore'],['计划任务','安全模板定时任务','/tasks','calendar'],['软件管理','APT 预检、下载、升级与软件包','/updates','package'],['SSH 管理','端口、登录策略、转发与密钥','/ssh','key']
  ]
  return `<div class="page-wrap">${pageHeader('系统管理','日常操作可视化，关键修改先快照、再校验、可回滚')}<section class="module-grid">${modules.map(([t,d,p,i])=>`<a data-nav href="${p}" class="module-card surface"><div class="module-icon">${icon(i,22)}</div><div><strong>${t}</strong><p>${d}</p></div>${icon('chevron',19)}</a>`).join('')}</section></div>`
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
async function serviceAction(name,action){const label=action==='stop'?'停止':action==='restart'?'重启':'启动';if(['stop','restart'].includes(action)&&!await askConfirm(`确认${label} ${name}？`,{title:`${label}服务`,confirmText:label,danger:action==='stop'}))return;setBusy(true);try{await secureApi('/api/v1/system/services/action',{method:'POST',body:jsonBody({name,action})});await loadServices(state.serviceQuery);showToast(`服务已${label}`)}catch(e){await showError(e.message)}finally{setBusy(false)}}
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
async function signalProcess(pid,signal){const force=signal==='kill';if(!await askConfirm(force?'强制结束可能导致数据损坏。':'进程将收到 SIGTERM，可自行清理并退出。',{title:`结束 PID ${pid}`,confirmText:force?'强制结束':'正常结束',danger:force}))return;try{await secureApi('/api/v1/system/processes/action',{method:'POST',body:jsonBody({pid,signal})});state.modal=null;await loadProcesses();showToast('结束信号已发送')}catch(e){await showError(e.message)}}

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
async function loadTasks(){
  state.loading.tasks=true;state.errors.tasks=''
  try{const [managed,timers]=await Promise.all([api('/api/v1/system/tasks'),api('/api/v1/system/timers')]);state.tasks=managed;state.timers=timers}
  catch(error){state.errors.tasks=error.message}
  finally{state.loading.tasks=false;render()}
}
function taskTypeLabel(type){return ({'service-restart':'重启 systemd 服务','docker-restart':'重启 Docker 容器','docker-cleanup-safe':'安全清理 Docker','panel-backup':'完整面板备份'})[type]||type}
function taskScheduleLabel(task){if(task.frequency==='hourly')return `每小时 ${String(task.minute).padStart(2,'0')} 分`;if(task.frequency==='weekly')return `每周${'日一二三四五六'[task.weekday]} ${String(task.hour).padStart(2,'0')}:${String(task.minute).padStart(2,'0')}`;return `每天 ${String(task.hour).padStart(2,'0')}:${String(task.minute).padStart(2,'0')}`}
function tasksPage(){
  if(!state.tasks&&!state.errors.tasks){queueMicrotask(loadTasks);return `<div class="page-wrap">${pageHeader('计划任务','读取安全计划任务')}${surfaceLoading()}</div>`}
  const tasks=state.tasks?.tasks||[]
  return `<div class="page-wrap tasks-page">${pageHeader('计划任务','只允许固定的安全动作，不接受任意 Shell 命令',`<button id="create-task" class="primary-button compact">${icon('plus',17)}<span>新建任务</span></button><button id="refresh-timers" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.tasks)}<section class="task-grid">${tasks.map(task=>`<article class="surface task-card"><div class="task-card__top"><div><strong>${escapeHTML(task.name)}</strong>${statusBadge(task.enabled?'active':'inactive')}</div></div><p>${escapeHTML(taskTypeLabel(task.type))}${task.target&&task.target!=='safe'?` · ${escapeHTML(task.target)}`:''}</p><div class="task-meta"><span>${icon('calendar',14)}${escapeHTML(taskScheduleLabel(task))}</span><span>${icon('clock',14)}下次：${escapeHTML(task.next_run||'等待 systemd 计算')}</span></div><div class="resource-actions"><button class="secondary-button compact" data-task-action="run" data-task-id="${escapeHTML(task.id)}">立即运行</button><button class="secondary-button compact" data-task-action="${task.enabled?'disable':'enable'}" data-task-id="${escapeHTML(task.id)}">${task.enabled?'停用':'启用'}</button><button class="danger-button compact" data-task-action="delete" data-task-id="${escapeHTML(task.id)}">删除</button></div></article>`).join('')||'<div class="empty-list surface">还没有自定义计划任务</div>'}</section><details class="surface native-timers"><summary>查看系统原生 Timers</summary><pre>${escapeHTML(state.timers?.timers||'没有 systemd timer')}</pre></details></div>`
}
async function taskAction(id,action){
  if(action==='delete'&&!await askConfirm('删除后对应的 systemd service 和 timer 会一起移除。',{title:'删除计划任务',confirmText:'确认删除',danger:true}))return
  try{await secureApi('/api/v1/system/tasks/action',{method:'POST',body:jsonBody({id,action})});showToast(action==='run'?'任务已开始执行':'计划任务已更新');await loadTasks()}catch(error){await showError(error.message)}
}
async function createTask(form){
  const f=new FormData(form),button=form.querySelector('button[type=submit]')
  button.disabled=true;button.textContent='正在创建…'
  try{await secureApi('/api/v1/system/tasks/create',{method:'POST',body:jsonBody({name:f.get('name'),type:f.get('type'),target:f.get('target'),frequency:f.get('frequency'),hour:Number(f.get('hour')),minute:Number(f.get('minute')),weekday:Number(f.get('weekday'))})});state.modal=null;showToast('计划任务已创建');await loadTasks()}
  catch(error){await showError(error.message)}finally{button.disabled=false;button.textContent='创建计划任务'}
}

async function loadUpdates(){
  state.errors.updates='';state.loading.updates=true
  try{state.aptPreflight=await api('/api/v1/system/apt/preflight');state.updates=state.aptPreflight}
  catch(e){state.errors.updates=e.message}
  finally{state.loading.updates=false;render()}
}
function updatesPage(){
  const x=state.aptPreflight
  if(!x&&!state.errors.updates){queueMicrotask(loadUpdates);return `<div class="page-wrap">${pageHeader('软件管理','执行安全预检')}${surfaceLoading('模拟 APT 升级')}</div>`}
  const lock=x?.locked?`<div class="alert error">${icon('alert',18)}APT 正被占用：${escapeHTML(x.lock_detail||'请稍后再试')}</div>`:''
  return `<div class="page-wrap apt-page">${pageHeader('软件管理','先模拟、再下载、最后升级；升级前自动创建系统配置快照',`<button id="refresh-updates" class="secondary-button compact">${icon('refresh',17)}<span>重新预检</span></button>`)}${errorBox(state.errors.updates)}${lock}<section class="apt-summary-grid"><article class="surface update-summary"><div class="update-count"><strong>${x?.upgrade_count||0}</strong><span>个软件包可升级</span></div><dl class="info-list"><div><dt>新增</dt><dd>${x?.install_count||0}</dd></div><div><dt>移除</dt><dd>${x?.remove_count||0}</dd></div><div><dt>下载</dt><dd>${formatBytes(x?.download_bytes||0)}</dd></div><div><dt>磁盘变化</dt><dd>${formatBytes(Math.abs(x?.disk_delta_bytes||0))}${Number(x?.disk_delta_bytes||0)<0?' 减少':' 增加'}</dd></div><div><dt>需要重启</dt><dd>${x?.reboot_required?'是':'否'}</dd></div></dl><div class="resource-actions"><button id="apt-download" class="secondary-button" ${(x?.locked||!x?.available||!x?.upgrade_count)?'disabled':''}>只下载更新</button><button id="apt-upgrade" class="primary-button" ${(x?.locked||!x?.available||!x?.upgrade_count)?'disabled':''}>开始安全升级</button></div></article><article class="surface apt-search-card"><h2>搜索软件包</h2><p>安装或删除前会再次确认，并记录完整结果。</p><form id="apt-search-form" class="inline-form"><input name="q" value="${escapeHTML(state.aptQuery)}" placeholder="例如 curl、htop" minlength="2" required><button class="secondary-button" type="submit">搜索</button></form><div class="apt-search-results">${(state.aptSearchResults||[]).map(pkg=>`<div class="apt-package"><div><strong>${escapeHTML(pkg.name)}</strong><p>${escapeHTML(pkg.description||'')}</p><small>${pkg.installed?`已安装 ${escapeHTML(pkg.version||'')}`:'未安装'}</small></div><button class="${pkg.installed?'danger-button':'primary-button'} compact" data-apt-package="${escapeHTML(pkg.name)}" data-apt-action="${pkg.installed?'remove':'install'}">${pkg.installed?'删除':'安装'}</button></div>`).join('')||'<div class="empty-list">输入关键词查找 Debian/Ubuntu 软件包</div>'}</div></article></section><section class="surface package-list">${(x?.packages||[]).slice(0,120).map(name=>`<span>${escapeHTML(name)}</span>`).join('')||'<div class="empty-list">当前没有可升级的软件包</div>'}</section></div>`
}


async function aptSearch(query){
  state.aptQuery=query;state.loading.aptSearch=true
  try{const out=await api(`/api/v1/system/apt/search?q=${encodeURIComponent(query)}`);state.aptSearchResults=out.packages||out||[]}
  catch(error){await showError(error.message)}finally{state.loading.aptSearch=false;render()}
}
async function aptAction(action,packages=[]){
  const labels={download:'下载更新',upgrade:'升级系统',install:'安装软件包',remove:'删除软件包'}
  const danger=action==='upgrade'||action==='remove'
  const detail=action==='upgrade'?'升级会在 Agent 后台执行，关闭页面不会中止。开始前会创建快照并先下载软件包。':`${labels[action]}：${packages.join(', ')||'全部可升级软件包'}`
  if(!await askConfirm(detail,{title:labels[action],confirmText:'启动后台任务',danger}))return
  try{
    const job=await startBackgroundJob(`apt.${action}`,{packages})
    state.modal={title:labels[action],kind:'job-progress',job};render()
    await monitorBackgroundJob(job.id,labels[action])
    await loadUpdates()
  }catch(error){await showError(error.message)}
}

async function loadBackgroundJobs(renderAfter=true){
  if(state.jobsLoading)return
  state.jobsLoading=true
  try{const out=await api('/api/v1/jobs');state.backgroundJobs=out.jobs||[]}catch(error){state.errors.jobs=error.message}finally{state.jobsLoading=false;if(renderAfter)render()}
}
async function startBackgroundJob(action,payload={}){
  const out=await secureApi('/api/v1/jobs/start',{method:'POST',body:jsonBody({action,...payload})})
  const job=out.job
  if(!job?.id)throw new Error('后台任务没有返回任务编号')
  state.backgroundJobs=[job,...(state.backgroundJobs||[]).filter(item=>item.id!==job.id)]
  return job
}
function jobResultOutput(job){
  const result=job?.result||{}
  if(typeof result==='string')return result
  return result.output||result.message||job?.error||''
}
async function monitorBackgroundJob(id,title){
  for(let count=0;count<1800;count++){
    const out=await api(`/api/v1/jobs?id=${encodeURIComponent(id)}`),job=out.job
    state.activeJob=job
    state.backgroundJobs=[job,...(state.backgroundJobs||[]).filter(item=>item.id!==id)]
    if(state.modal?.kind==='job-progress'&&state.modal?.job?.id===id){state.modal={...state.modal,job};render()}
    if(job.status==='success'||job.status==='failed'){
      const output=jobResultOutput(job)
      if(state.modal?.kind==='job-progress'&&state.modal?.job?.id===id){state.modal={title:job.status==='success'?`${title}完成`:`${title}失败`,kind:'logs',content:output||job.error||'任务结束'};render()}
      else showToast(job.status==='success'?`${title}已完成`:`${title}失败`)
      await loadBackgroundJobs(false)
      if(job.status==='failed')throw new Error(job.error||'后台任务失败')
      return job
    }
    await new Promise(resolve=>setTimeout(resolve,1500))
  }
  throw new Error('后台任务等待超时，可在最近任务中继续查看')
}
function backgroundJobPanel(prefix){
  if(!state.backgroundJobs&&!state.jobsLoading)queueMicrotask(()=>loadBackgroundJobs())
  const items=(state.backgroundJobs||[]).filter(job=>job.kind.startsWith(prefix)).slice(0,8)
  return `<section class="surface feature-panel background-jobs-panel"><div class="section-heading"><div><h2>最近后台任务</h2><p>长时间操作由 Agent 执行，离开页面或反向代理断开不会中止。</p></div><button id="refresh-background-jobs" class="secondary-button compact">${icon('refresh',16)}刷新</button></div><div class="compact-list">${items.map(job=>`<button class="job-row" data-background-job="${escapeHTML(job.id)}"><span><strong>${escapeHTML(job.kind)}</strong><small>${escapeHTML(job.target||'')} · ${formatDate(job.created_at)}</small></span><span class="status-badge ${job.status==='success'?'active':job.status==='failed'?'danger':'pending'}">${job.status==='success'?'完成':job.status==='failed'?'失败':job.status==='running'?'运行中':'排队中'}</span></button>`).join('')||'<div class="empty-list">暂无后台任务</div>'}</div></section>`
}
async function loadHostSettings(){state.errors.host='';try{state.hostSettings=await api('/api/v1/system/host')}catch(error){state.errors.host=error.message}finally{render()}}
function hostPage(){
  const x=state.hostSettings
  if(!x&&!state.errors.host){queueMicrotask(loadHostSettings);return `<div class="page-wrap">${pageHeader('主机设置','读取主机配置')}${surfaceLoading()}</div>`}
  return `<div class="page-wrap host-page">${pageHeader('主机设置','修改前自动快照并校验，失败会回滚',`<button id="refresh-host" class="secondary-button compact">${icon('refresh',17)}刷新</button>`)}${errorBox(state.errors.host)}<section class="settings-grid"><form id="host-basic-form" class="surface settings-card"><h2>基础信息</h2><label>主机名<input name="hostname" value="${escapeHTML(x?.hostname||'')}" required></label><label>时区<input name="timezone" value="${escapeHTML(x?.timezone||'UTC')}" placeholder="Asia/Shanghai" required></label><button class="primary-button" type="submit">保存基础设置</button></form><form id="host-dns-form" class="surface settings-card"><h2>系统 DNS</h2><p>${x?.systemd_resolved?'使用 systemd-resolved 管理':'当前未启用 systemd-resolved，保存时会按系统能力处理'}</p><label>DNS 服务器<textarea name="dns" rows="4" placeholder="每行一个，例如 1.1.1.1">${escapeHTML((x?.dns||[]).join('\n'))}</textarea></label><button class="primary-button" type="submit">测试并保存 DNS</button></form><article class="surface settings-card"><h2>Swap</h2><div class="setting-status"><strong>${x?.swap?.enabled?'已启用':'未启用'}</strong><span>${formatBytes(x?.swap?.used||0)} / ${formatBytes(x?.swap?.total||0)}</span></div>${x?.swap?.managed?`<button id="host-swap-delete" class="danger-button">删除 LukePanel 管理的 Swap</button>`:`<form id="host-swap-form" class="inline-form"><input name="size_mb" type="number" min="256" max="32768" value="2048"><button class="primary-button" type="submit">创建 Swap（MB）</button></form>`}</article><article class="surface settings-card"><h2>内核优化预设</h2><p>只应用固定、可审计的 sysctl 模板，不允许任意命令。</p><div class="preset-grid"><button data-sysctl-preset="balanced" class="secondary-button">均衡（推荐）</button><button data-sysctl-preset="network" class="secondary-button">网络吞吐</button><button data-sysctl-preset="low-memory" class="secondary-button">小内存 VPS</button><button data-sysctl-preset="reset" class="danger-button">恢复默认</button></div><small>当前 BBR：${x?.bbr?'已启用':'未启用或不可用'}</small></article></section></div>`
}
async function hostMutation(endpoint,body,method='POST'){
  setBusy(true);try{await secureApi(`/api/v1/system/host/${endpoint}`,{method,body:body===null?undefined:jsonBody(body)});showToast('主机设置已更新');await loadHostSettings()}catch(error){await showError(error.message)}finally{setBusy(false)}
}
async function loadSnapshots(){state.errors.snapshots='';try{const [out,scheduled]=await Promise.all([api('/api/v1/system/snapshots'),api('/api/v1/backup/scheduled')]);state.snapshots=out.snapshots||out||[];state.scheduledBackups=scheduled}catch(error){state.errors.snapshots=error.message}finally{render()}}
function snapshotsPage(){
  if(!state.snapshots&&!state.errors.snapshots){queueMicrotask(loadSnapshots);return `<div class="page-wrap">${pageHeader('配置快照','读取快照')}${surfaceLoading()}</div>`}
  const backupPanel=`<section class="surface panel-backup-card"><div class="section-heading"><div><h2>面板完整备份</h2><p>导出账号、安全设置、审计索引、文件历史、回收站与配置快照。恢复时保留当前监听地址和 Agent 密钥，避免服务失联。</p></div><button id="panel-backup-export" class="primary-button compact">${icon('download',17)}导出备份</button></div><form id="panel-backup-import" class="backup-import-form"><label><span>恢复 LukePanel 备份</span><input name="file" type="file" accept=".tar.gz,.tgz,application/gzip" required></label><button class="danger-button" type="submit">校验并恢复</button></form><div class="backup-safety-note">${icon('shield',17)}恢复前建议先导出当前状态。上传上限 512MB；危险路径、软链接和超大归档会被拒绝。</div></section>`
  return `<div class="page-wrap snapshots-page">${pageHeader('配置快照','APT、SSH、DNS、Compose 等关键修改会自动留下可恢复快照',`<button id="refresh-snapshots" class="secondary-button compact">${icon('refresh',17)}刷新</button>`)}${errorBox(state.errors.snapshots)}${backupPanel}<section class="snapshot-list">${(state.snapshots||[]).map(item=>`<article class="surface snapshot-card"><div><span class="status-badge muted"><i></i>${escapeHTML(item.kind)}</span><h2>${escapeHTML(item.name)}</h2><p>${escapeHTML(item.note||'自动创建的配置快照')}</p><small>${formatDate(item.created_at)} · ${formatBytes(item.size)} · ${item.items?.length||0} 项</small></div><details><summary>查看包含内容</summary><div class="snapshot-paths">${(item.items||[]).map(x=>`<code>${escapeHTML(x.original)}${x.exists?'':'（当时不存在）'}</code>`).join('')}</div></details><div class="resource-actions"><button class="primary-button compact" data-snapshot-action="restore" data-snapshot-id="${escapeHTML(item.id)}">恢复</button><button class="danger-button compact" data-snapshot-action="delete" data-snapshot-id="${escapeHTML(item.id)}">删除</button></div></article>`).join('')||'<div class="empty-list surface">还没有配置快照。执行关键系统修改后会自动出现在这里。</div>'}</section></div>`
}

async function snapshotAction(id,action){
  if(!await askConfirm(action==='restore'?'恢复会覆盖当前配置，但恢复前还会再创建一个回滚点。':'确认永久删除这个快照？',{title:action==='restore'?'恢复配置快照':'删除配置快照',confirmText:action==='restore'?'确认恢复':'确认删除',danger:true}))return
  try{await secureApi('/api/v1/system/snapshots',{method:'POST',body:jsonBody({id,action})});showToast(action==='restore'?'快照已恢复':'快照已删除');await loadSnapshots()}catch(error){await showError(error.message)}
}

async function exportPanelBackup(){
  let response=await fetch('/api/v1/backup/export',{credentials:'same-origin'})
  if(response.status===403){await requestElevation();response=await fetch('/api/v1/backup/export',{credentials:'same-origin'})}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||`导出失败（${response.status}）`)}
  const disposition=response.headers.get('content-disposition')||''
  const match=disposition.match(/filename="?([^";]+)"?/i)
  const filename=match?.[1]||`lukepanel-backup-${new Date().toISOString().slice(0,10)}.tar.gz`
  const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a')
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)
  showToast('完整备份已导出')
}
async function importPanelBackup(file){
  if(!file)throw new Error('请选择备份文件')
  if(!await askConfirm('恢复会替换账号、安全设置和面板数据，但保留当前监听地址与 Agent 通信参数。建议先导出当前备份。',{title:'恢复 LukePanel 完整备份',confirmText:'校验并恢复',danger:true}))return
  const body=new FormData();body.append('file',file)
  setBusy(true)
  try{
    const out=await secureApi('/api/v1/backup/import',{method:'POST',body})
    showToast(out.message||'备份已恢复')
    const reload=await askConfirm('恢复已完成。重新载入后使用备份中的账号与安全设置。',{title:'恢复完成',confirmText:'立即重新载入',cancelText:'稍后'})
    if(reload)location.reload()
  }finally{setBusy(false)}
}

async function loadDocker(){
  state.loading.docker=true;state.errors.docker=''
  try{
    const status=await api('/api/v1/docker/status');state.dockerStatus=status
    if(!status.available){state.docker=null;state.dockerImages=null;state.dockerNetworks=null;state.dockerVolumes=null;state.dockerCompose=null;return}
    const [containers,images,networks,volumes,compose]=await Promise.all([api('/api/v1/docker/containers'),api('/api/v1/docker/images'),api('/api/v1/docker/networks'),api('/api/v1/docker/volumes'),api('/api/v1/docker/compose')])
    state.docker=containers;state.dockerImages=images;state.dockerNetworks=networks;state.dockerVolumes=volumes;state.dockerCompose=compose
  }catch(e){state.errors.docker=e.message}finally{state.loading.docker=false;render()}
}

async function loadDockerStats(){
  const running=(state.docker?.containers||[]).filter(container=>container.state==='running').slice(0,40)
  if(!running.length){state.dockerStats={};updateDockerStatRows();return}
  try{
    const query=running.map(container=>`id=${encodeURIComponent(container.id)}`).join('&')
    const data=await api(`/api/v1/docker/stats?${query}`)
    state.dockerStats=Object.fromEntries((data.stats||[]).map(item=>[item.id,item]))
    updateDockerStatRows()
  }catch{}
}
function syncDockerStats(){
  if(state.dockerStatsTimer){clearInterval(state.dockerStatsTimer);state.dockerStatsTimer=null}
  if(!state.authenticated||document.hidden||location.pathname!=='/docker'||state.dockerTab!=='containers')return
  loadDockerStats()
  state.dockerStatsTimer=setInterval(loadDockerStats,5000)
}
function dockerStatHTML(id){
  const stat=state.dockerStats[id]
  if(!stat)return '<span class="container-stat-muted">正在读取资源…</span>'
  return `<span>CPU ${Number(stat.cpu_percent||0).toFixed(1)}%</span><span>内存 ${formatBytes(stat.memory_usage)} / ${formatBytes(stat.memory_limit)}</span><span>网络 ↓${formatBytes(stat.network_rx)} ↑${formatBytes(stat.network_tx)}</span>`
}
function updateDockerStatRows(){
  document.querySelectorAll('[data-container-stats]').forEach(root=>{root.innerHTML=dockerStatHTML(root.dataset.containerStats)})
}
function containerName(c){return (c.names?.[0]||c.id.slice(0,12)).replace(/^\//,'')}
function portText(c){const p=(c.ports||[]).filter(x=>x.PublicPort).map(x=>`${x.PublicPort}:${x.PrivatePort}/${x.Type}`);return p.length?p.join(' · '):'无公开端口'}
function imageName(i){return i.repo_tags?.[0]||i.id.replace(/^sha256:/,'').slice(0,12)}
function dockerPage(){
  if(!state.dockerStatus&&!state.errors.docker){queueMicrotask(loadDocker);return `<div class="page-wrap">${pageHeader('Docker','正在连接 Docker Engine')}${surfaceLoading()}</div>`}
  if(state.dockerStatus&&!state.dockerStatus.available)return `<div class="page-wrap docker-empty-page">${pageHeader('Docker','容器引擎尚未安装或服务未启动',`<button id="refresh-docker" class="secondary-button compact">${icon('refresh',17)}<span>重新检测</span></button>`)}${errorBox(state.errors.docker)}<section class="surface docker-install-card"><div class="feature-illustration">${icon('container',34)}</div><div><h2>安装 Docker</h2><p>${escapeHTML(state.dockerStatus.error||'未检测到 Docker Engine')}。LukePanel 可以使用系统软件源安装 Docker，并自动启用服务。</p><ul><li>仅支持 Debian / Ubuntu 快捷安装</li><li>使用发行版软件包，不执行未知 curl 脚本</li><li>安装过程可能需要几分钟</li></ul></div><button id="install-docker" class="primary-button">${icon('download',18)}快捷安装 Docker</button></section></div>`
  if(!state.docker&&state.errors.docker)return `<div class="page-wrap">${pageHeader('Docker','Docker 状态读取失败',`<button id="refresh-docker" class="secondary-button compact">${icon('refresh',17)}重试</button>`)}${errorBox(state.errors.docker)}</div>`
  const containers=state.docker?.containers||[],images=state.dockerImages?.images||[],networks=state.dockerNetworks?.networks||[],volumes=state.dockerVolumes?.volumes||[],compose=state.dockerCompose?.projects||[]
  const tabs=[['containers',`容器 ${containers.length}`],['compose',`Compose ${compose.length}`],['images',`镜像 ${images.length}`],['networks',`网络 ${networks.length}`],['volumes',`存储卷 ${volumes.length}`]]
  const createAction=state.dockerTab==='networks'?`<button id="create-network" class="primary-button compact">${icon('plus',17)}<span>新建网络</span></button>`:state.dockerTab==='volumes'?`<button id="create-volume" class="primary-button compact">${icon('plus',17)}<span>新建卷</span></button>`:state.dockerTab==='images'?`<button id="build-image" class="secondary-button compact">${icon('package',17)}<span>构建镜像</span></button><button id="pull-image" class="primary-button compact">${icon('download',17)}<span>拉取镜像</span></button>`:state.dockerTab==='containers'?`<button id="pull-image" class="primary-button compact">${icon('download',17)}<span>拉取镜像</span></button>`:''
  return `<div class="page-wrap">${pageHeader('Docker',state.dockerStatus?.available?`Docker ${state.dockerStatus.version}`:'容器引擎不可用',`${createAction}<button id="docker-cleanup" class="secondary-button compact">${icon('trash',17)}<span>清理</span></button><button id="refresh-docker" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.docker)}<div class="tab-bar surface">${tabs.map(([key,label])=>`<button data-docker-tab="${key}" class="${state.dockerTab===key?'active':''}">${label}</button>`).join('')}</div>${dockerTabContent(containers,images,networks,volumes,compose)}</div>`
}

function dockerTabContent(containers,images,networks,volumes,compose){
  if(state.dockerTab==='compose')return `<section class="compose-grid">${compose.map(project=>`<article class="surface compose-card"><div class="compose-card__top"><div><strong>${escapeHTML(project.name)}</strong><span>${project.running}/${project.total} 运行中</span></div>${statusBadge(project.running===project.total&&project.total>0?'running':project.running>0?'partial':'exited')}</div><p title="${escapeHTML(project.working_dir)}">${escapeHTML(project.working_dir||'未读取到工作目录')}</p><div class="compose-services">${(project.containers||[]).map(c=>`<span>${escapeHTML(c.service||c.name)} · ${escapeHTML(c.state)}</span>`).join('')}</div><div class="resource-actions">${project.config_files?.[0]?`<button class="secondary-button compact" data-compose-config="${escapeHTML(project.name)}">可视化编辑 YAML</button>`:''}<button class="secondary-button compact" data-compose-action="pull" data-project="${escapeHTML(project.name)}">拉取</button><button class="primary-button compact" data-compose-action="up" data-project="${escapeHTML(project.name)}">启动/更新</button><button class="secondary-button compact" data-compose-action="restart" data-project="${escapeHTML(project.name)}">重启</button><button class="danger-button compact" data-compose-action="down" data-project="${escapeHTML(project.name)}">停止并移除</button></div></article>`).join('')||'<div class="empty-list surface">没有检测到 Docker Compose 项目</div>'}</section>`
  if(state.dockerTab==='images')return `<section class="resource-grid">${images.map(i=>`<article class="surface docker-resource-card"><div><strong>${escapeHTML(imageName(i))}</strong><span>${formatBytes(i.size)}</span></div><p>${escapeHTML(i.id.replace(/^sha256:/,'').slice(0,20))}</p><small>${formatDate(Number(i.created)*1000)} · ${i.containers>=0?`${i.containers} 个容器引用`:'引用未知'}</small><button class="danger-button compact" data-image-delete="${escapeHTML(i.id)}">删除</button></article>`).join('')||'<div class="empty-list surface">暂无镜像</div>'}</section>`
  if(state.dockerTab==='networks')return `<section class="resource-grid">${networks.map(n=>`<article class="surface docker-resource-card"><div><strong>${escapeHTML(n.name)}</strong><span>${escapeHTML(n.driver)}</span></div><p>${escapeHTML(n.id.slice(0,20))}</p><small>${escapeHTML(n.scope)}${n.internal?' · 内部网络':''} · ${n.containers||0} 个容器</small>${['bridge','host','none'].includes(n.name)?'<em>系统网络</em>':`<button class="danger-button compact" data-network-delete="${escapeHTML(n.id)}" data-name="${escapeHTML(n.name)}">删除</button>`}</article>`).join('')||'<div class="empty-list surface">暂无网络</div>'}</section>`
  if(state.dockerTab==='volumes')return `<section class="resource-grid">${volumes.map(v=>`<article class="surface docker-resource-card"><div><strong>${escapeHTML(v.name)}</strong><span>${escapeHTML(v.driver)}</span></div><p>${escapeHTML(v.mountpoint)}</p><small>${escapeHTML(v.scope)}</small><button class="danger-button compact" data-volume-delete="${escapeHTML(v.name)}">删除</button></article>`).join('')||'<div class="empty-list surface">暂无存储卷</div>'}</section>`
  return `<section class="container-grid">${containers.map(c=>`<article class="container-card surface"><div class="container-card__top"><div class="container-icon">${icon('container',21)}</div><div><strong>${escapeHTML(containerName(c))}</strong>${statusBadge(c.state)}</div></div><p>${escapeHTML(c.image)}</p><small>${escapeHTML(c.status)}<br>${escapeHTML(portText(c))}</small><div class="container-live-stats" data-container-stats="${escapeHTML(c.id)}">${c.state==='running'?dockerStatHTML(c.id):'<span class="container-stat-muted">容器未运行</span>'}</div><div class="resource-actions"><button class="secondary-button compact" data-docker-logs="${escapeHTML(c.id)}" data-title="${escapeHTML(containerName(c))}">日志</button><button class="secondary-button compact" data-docker-edit="${escapeHTML(c.id)}" data-title="${escapeHTML(containerName(c))}">编辑</button>${c.state==='running'?`<button class="secondary-button compact" data-docker-action="restart" data-id="${escapeHTML(c.id)}">重启</button><button class="danger-button compact" data-docker-action="stop" data-id="${escapeHTML(c.id)}">停止</button>`:`<button class="primary-button compact" data-docker-action="start" data-id="${escapeHTML(c.id)}">启动</button><button class="danger-button compact" data-docker-action="remove" data-id="${escapeHTML(c.id)}">删除</button>`}</div></article>`).join('')||'<div class="empty-list surface">暂未发现容器</div>'}</section>`
}
async function dockerAction(id,action){
  const labels={stop:'停止',restart:'重启',kill:'强制结束',remove:'删除',start:'启动'}
  if(['stop','restart','kill','remove'].includes(action)&&!await askConfirm(`确认${labels[action]}这个容器？`,{title:`${labels[action]}容器`,confirmText:labels[action],danger:['kill','remove'].includes(action)}))return
  setBusy(true);try{await secureApi('/api/v1/docker/action',{method:'POST',body:jsonBody({id,action})});await loadDocker();showToast(`容器已${labels[action]}`)}catch(e){await showError(e.message)}finally{setBusy(false)}
}
async function showDockerLogs(id,title){stopDockerLogPolling();state.dockerLogPaused=false;state.modal={title:`${title} 实时日志`,kind:'logs',content:'正在读取日志…',dockerLogID:id,dockerLogTitle:title};render();await refreshDockerLogs(id);state.dockerLogTimer=setInterval(()=>refreshDockerLogs(id),2000)}
function lines(value){return String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function dockerEnvRow(value=''){
  const index=String(value).indexOf('='),key=index>=0?String(value).slice(0,index):String(value),val=index>=0?String(value).slice(index+1):''
  return `<div class="visual-row docker-env-row"><input data-env-key placeholder="变量名，例如 TZ" value="${escapeHTML(key)}"><input data-env-value placeholder="值，例如 Asia/Shanghai" value="${escapeHTML(val)}"><button type="button" data-remove-docker-row aria-label="删除">${icon('trash',16)}</button></div>`
}
function dockerPortRow(port={}){return `<div class="visual-row docker-port-row"><input data-port-host-ip placeholder="主机 IP（留空=全部）" value="${escapeHTML(port.host_ip||'')}"><input data-port-host-port inputmode="numeric" placeholder="主机端口" value="${escapeHTML(port.host_port||'')}"><input data-port-container-port inputmode="numeric" placeholder="容器端口" value="${escapeHTML(port.container_port||'')}"><select data-port-protocol><option value="tcp" ${port.protocol!=='udp'?'selected':''}>TCP</option><option value="udp" ${port.protocol==='udp'?'selected':''}>UDP</option></select><button type="button" data-remove-docker-row aria-label="删除">${icon('trash',16)}</button></div>`}
function dockerMountRow(mount={}){return `<div class="visual-row docker-mount-row"><select data-mount-type><option value="bind" ${mount.type!=='volume'?'selected':''}>主机目录</option><option value="volume" ${mount.type==='volume'?'selected':''}>Docker 卷</option></select><input data-mount-source placeholder="主机路径或卷名" value="${escapeHTML(mount.source||'')}"><input data-mount-target placeholder="容器内路径" value="${escapeHTML(mount.target||'')}"><label class="mini-check"><input data-mount-readonly type="checkbox" ${mount.read_only?'checked':''}><span>只读</span></label><button type="button" data-remove-docker-row aria-label="删除">${icon('trash',16)}</button></div>`}
function collectDockerEnv(form){return [...form.querySelectorAll('.docker-env-row')].map(row=>{const key=row.querySelector('[data-env-key]').value.trim(),value=row.querySelector('[data-env-value]').value;if(!key&&!value)return null;if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))throw new Error(`环境变量名 ${key||'(空)'} 无效`);return `${key}=${value}`}).filter(Boolean)}
function collectDockerPorts(form){return [...form.querySelectorAll('.docker-port-row')].map((row,index)=>{const host_ip=row.querySelector('[data-port-host-ip]').value.trim(),host_port=row.querySelector('[data-port-host-port]').value.trim(),container_port=row.querySelector('[data-port-container-port]').value.trim(),protocol=row.querySelector('[data-port-protocol]').value;if(!host_port&&!container_port&&!host_ip)return null;if(!/^\d{1,5}$/.test(container_port))throw new Error(`第 ${index+1} 个端口缺少有效的容器端口`);if(host_port&&!/^\d{1,5}$/.test(host_port))throw new Error(`第 ${index+1} 个主机端口无效`);return {host_ip,host_port,container_port,protocol}}).filter(Boolean)}
function collectDockerMounts(form){return [...form.querySelectorAll('.docker-mount-row')].map((row,index)=>{const type=row.querySelector('[data-mount-type]').value,source=row.querySelector('[data-mount-source]').value.trim(),target=row.querySelector('[data-mount-target]').value.trim();if(!source&&!target)return null;if(!source||!target)throw new Error(`第 ${index+1} 个挂载需要同时填写来源和容器路径`);return {type,source,target,read_only:row.querySelector('[data-mount-readonly]').checked}}).filter(Boolean)}

async function installDocker(){
  if(!await askConfirm('将使用 Debian / Ubuntu 官方软件源安装 Docker，并启用 docker.service。安装期间请不要关闭页面。',{title:'快捷安装 Docker',confirmText:'开始安装'}))return
  setBusy(true)
  try{const result=await secureApi('/api/v1/docker/install',{method:'POST',body:'{}'});showToast('Docker 安装完成');if(result.output)state.modal={title:'Docker 安装结果',kind:'logs',content:String(result.output)};await loadDocker()}catch(error){await showError(error.message)}finally{setBusy(false)}
}
function addDockerVisualRow(type){const targets={env:['#docker-env-rows',dockerEnvRow],port:['#docker-port-rows',dockerPortRow],mount:['#docker-mount-rows',dockerMountRow]},item=targets[type];if(!item)return;const root=document.querySelector(item[0]);if(!root)return;root.insertAdjacentHTML('beforeend',item[1]());root.lastElementChild?.querySelector('[data-remove-docker-row]')?.addEventListener('click',event=>event.currentTarget.closest('.visual-row')?.remove())}
async function openDockerEditor(id,title){state.modal={title:`编辑 ${title}`,kind:'loading',content:''};render();try{const spec=await api(`/api/v1/docker/inspect?id=${encodeURIComponent(id)}`);state.dockerEdit=spec;state.modal={title:`编辑 ${spec.name}`,kind:'docker-edit',spec};render()}catch(error){state.modal={title:'无法读取容器配置',kind:'error',content:error.message};render()}}
async function submitDockerEdit(){
  const form=document.querySelector('#docker-edit-form');if(!form)return
  const f=new FormData(form),button=form.querySelector('button[type=submit]');let request
  try{request={id:state.dockerEdit.id,name:String(f.get('name')||'').trim(),image:String(f.get('image')||'').trim(),env:collectDockerEnv(form),cmd:lines(f.get('cmd')),entrypoint:lines(f.get('entrypoint')),working_dir:String(f.get('working_dir')||'').trim(),user:String(f.get('user')||'').trim(),hostname:String(f.get('hostname')||'').trim(),restart_policy:String(f.get('restart_policy')||'no'),restart_maximum_retry_count:Number(f.get('restart_maximum_retry_count')||0),network_mode:String(f.get('network_mode')||'default'),privileged:f.get('privileged')==='on',ports:collectDockerPorts(form),mounts:collectDockerMounts(form),start:f.get('start')==='on'}}catch(error){await showError(error.message);return}
  if(!await askConfirm(`LukePanel 会先保留旧容器，只有新容器成功启动后才清理备份。`,{title:`重建 ${request.name}`,confirmText:'安全重建'}))return
  button.disabled=true;button.textContent='正在安全重建…'
  try{const result=await secureApi('/api/v1/docker/recreate',{method:'POST',body:jsonBody(request)});state.modal=null;state.dockerEdit=null;await loadDocker();showToast(result.warning||'容器配置已更新')}
  catch(error){await showError(error.message)}finally{button.disabled=false;button.textContent='保存并重建'}
}
async function composeAction(project,action){
  const labels={up:'启动或更新',restart:'重启',stop:'停止',down:'停止并移除',pull:'拉取镜像'}
  if(['down','restart'].includes(action)&&!await askConfirm(`确认${labels[action]} Compose 项目 ${project}？`,{title:'Compose 操作',confirmText:labels[action],danger:action==='down'}))return
  setBusy(true);try{const result=await secureApi('/api/v1/docker/compose/action',{method:'POST',body:jsonBody({project,action})});if(result.output)showToast(result.output.slice(0,120));await loadDocker()}catch(e){await showError(e.message)}finally{setBusy(false)}
}
async function pullImage(){
  const reference=await askText('输入完整镜像名称',{title:'拉取 Docker 镜像',value:'nginx:latest',placeholder:'例如 nginx:latest',confirmText:'开始拉取'});if(!reference)return
  setBusy(true);try{await secureApi('/api/v1/docker/images/pull',{method:'POST',body:jsonBody({reference})});state.dockerTab='images';await loadDocker();showToast('镜像拉取完成')}catch(e){await showError(e.message)}finally{setBusy(false)}
}
async function deleteDockerResource(kind,value,label=value){
  if(!await askConfirm(`正在使用的资源会被 Docker 拒绝删除。`,{title:`删除 ${label}`,confirmText:'确认删除',danger:true}))return
  const map={image:['/api/v1/docker/images/delete',{id:value}],network:['/api/v1/docker/networks/delete',{id:value}],volume:['/api/v1/docker/volumes/delete',{name:value}]};setBusy(true)
  try{await secureApi(map[kind][0],{method:'POST',body:jsonBody(map[kind][1])});await loadDocker();showToast('Docker 资源已删除')}catch(e){await showError(e.message)}finally{setBusy(false)}
}
async function openDockerCleanup(){
  state.modal={title:'Docker 清理',kind:'loading'};render()
  try{state.dockerCleanupPreview=await api('/api/v1/docker/cleanup/preview');state.modal={title:'Docker 清理',kind:'docker-cleanup',preview:state.dockerCleanupPreview};render()}catch(error){state.modal={title:'无法分析 Docker 空间',kind:'error',content:error.message};render()}
}
async function submitDockerCleanup(form){
  const f=new FormData(form),mode=String(f.get('mode')||'safe'),includeVolumes=f.get('volumes')==='on'
  if(!await askConfirm(mode==='deep'?'深度清理会删除更多未使用镜像，确认继续？':'只清理明确未使用的 Docker 资源。',{title:'执行 Docker 清理',confirmText:'开始清理',danger:mode==='deep'||includeVolumes}))return
  try{const result=await secureApi('/api/v1/docker/cleanup',{method:'POST',body:jsonBody({mode,include_volumes:includeVolumes})});state.modal=null;await loadDocker();showToast(`清理完成，释放 ${formatBytes(result.space_reclaimed||0)}`)}catch(error){await showError(error.message)}
}
async function createDockerNetwork(form){const f=new FormData(form),button=form.querySelector('button');button.disabled=true;try{await secureApi('/api/v1/docker/networks/create',{method:'POST',body:jsonBody({name:f.get('name'),driver:f.get('driver'),subnet:f.get('subnet'),gateway:f.get('gateway'),internal:f.get('internal')==='on'})});state.modal=null;state.dockerTab='networks';await loadDocker();showToast('Docker 网络已创建')}catch(error){await showError(error.message)}finally{button.disabled=false}}
async function createDockerVolume(form){const f=new FormData(form),button=form.querySelector('button');button.disabled=true;try{await secureApi('/api/v1/docker/volumes/create',{method:'POST',body:jsonBody({name:f.get('name'),driver:f.get('driver')})});state.modal=null;state.dockerTab='volumes';await loadDocker();showToast('Docker 存储卷已创建')}catch(error){await showError(error.message)}finally{button.disabled=false}}

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
  if(!path||path==='/')return '<span class="breadcrumb-current">根目录</span>'
  const parts=path.split('/').filter(Boolean),crumbs=['<button data-file-jump="/" aria-label="返回根目录">/</button>']
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
  if(!l&&!state.errors.files){queueMicrotask(()=>loadFiles('/'));return `<div class="page-wrap">${pageHeader('文件管理','读取文件系统根目录')}${surfaceLoading()}</div>`}
  const entries=filteredFileEntries()
  return `<div class="page-wrap files-page">${pageHeader('文件管理','支持上传、下载、编辑、复制、移动、权限和回收站',`<button id="global-file-search" class="secondary-button compact">${icon('search',17)}<span>搜索</span></button><button id="new-file" class="secondary-button compact">${icon('plus',17)}<span>新建</span></button><button id="upload-file" class="primary-button compact">${icon('upload',17)}<span>上传</span></button><input id="upload-input" type="file" multiple hidden><input id="upload-folder-input" type="file" webkitdirectory directory multiple hidden><input id="upload-zip-input" type="file" accept=".zip,application/zip" hidden>`)}<div class="tab-bar surface file-tabs"><button class="active" data-file-view="files">文件</button><button data-file-view="recycle">回收站</button></div>${errorBox(state.errors.files)}${l?`<div class="file-toolbar surface"><button id="file-back" ${l.parent?'':'disabled'} aria-label="返回">${icon('back',19)}</button><button id="file-home" aria-label="根目录">${icon('home',18)}</button><div class="path-pill file-breadcrumb" title="${escapeHTML(l.path)}">${fileBreadcrumb(l.path)}</div><button id="copy-current-path" data-copy-text="${escapeHTML(l.path)}" aria-label="复制当前路径">${icon('copy',18)}</button><button id="refresh-files" aria-label="刷新">${icon('refresh',18)}</button></div><div class="search-bar surface file-search">${icon('search',18)}<input id="file-search" value="${escapeHTML(state.fileFilter)}" placeholder="筛选当前目录"><span>${entries.length} / ${l.entries.length}</span></div><section class="file-list surface">${entries.map(item=>`<div class="file-row"><button class="file-open" data-file-path="${escapeHTML(item.path)}" data-directory="${item.is_dir}"><div class="file-icon">${icon(item.is_dir?'folder':'file',22)}</div><div class="file-main"><strong title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</strong><span>${item.is_dir?'文件夹':formatBytes(item.size)} · ${formatDate(item.modified_at)}</span></div><code>${escapeHTML(item.mode)}</code>${icon('chevron',18)}</button><button class="file-more" data-file-menu="${escapeHTML(item.path)}" aria-label="更多操作">${icon('more',19)}</button></div>`).join('')||'<div class="empty-list">这个目录是空的</div>'}</section>`:''}</div>`
}
async function openFile(path){
  state.modal={title:'读取文件',kind:'loading',content:''};render()
  try{
    const preview=await secureApi(`/api/v1/files/preview?path=${encodeURIComponent(path)}`)
    if(['text','markdown'].includes(preview.kind)){
      const data=await secureApi(`/api/v1/files/content?path=${encodeURIComponent(path)}`);state.fileContent=data;state.modal={title:data.name,kind:'editor',content:data.content,path:data.path,dirty:false,preview_kind:preview.kind};render();return
    }
    if(['image','pdf'].includes(preview.kind)){state.modal={title:preview.name,kind:'file-preview',preview};render();return}
    if(preview.kind==='archive'){const list=await secureApi(`/api/v1/files/archive/list?path=${encodeURIComponent(path)}`);state.modal={title:preview.name,kind:'archive-list',preview,list};render();return}
    await downloadManagedFile(path);state.modal=null;render()
  }catch(e){state.modal={title:'无法打开文件',kind:'error',content:e.message};render()}
}
function openFileMenu(path){const item=(state.files?.entries||[]).find(entry=>entry.path===path);if(!item)return;state.modal={title:item.name,kind:'file-actions',path:item.path,item};render()}
async function saveFile(){const editor=document.querySelector('#file-editor');if(!editor||!state.modal?.path)return;const button=document.querySelector('#save-file');button.disabled=true;button.textContent='保存中…';try{await secureApi('/api/v1/files/content',{method:'PUT',body:jsonBody({path:state.modal.path,content:editor.value})});state.modal.content=editor.value;state.modal.dirty=false;button.textContent='已保存';showToast('文件已保存，并创建历史版本');setTimeout(()=>{if(document.querySelector('#save-file'))document.querySelector('#save-file').textContent='保存'},1200)}catch(e){await showError(e.message);button.textContent='保存'}finally{button.disabled=false}}
async function createEntry(){
  if(!state.files)return
  const choice=await chooseAction('新建内容',[{label:'新建文件夹',description:'创建一个空目录'},{label:'新建文件',description:'创建一个空文本文件'}]);if(choice===false||choice===null)return
  const type=choice===0?'folder':'file',name=await askText('',{title:type==='folder'?'文件夹名称':'文件名称',placeholder:type==='folder'?'例如 config':'例如 config.yaml'});if(!name)return
  const base=state.files.path.replace(/\/$/,''),path=`${base}/${name}`
  try{await secureApi(type==='folder'?'/api/v1/files/mkdir':'/api/v1/files/create',{method:'POST',body:jsonBody({path})});await loadFiles(state.files.path);showToast(`${type==='folder'?'文件夹':'文件'}已创建`)}catch(e){await showError(e.message)}
}
async function uploadSelected(files,preservePaths=false){
  if(!state.files)return
  const list=Array.from(files||[]);if(!list.length)return
  setBusy(true);let completed=0
  try{for(const file of list){const form=new FormData();form.append('directory',state.files.path);form.append('relative_path',preservePaths?(file.webkitRelativePath||file.name):file.name);form.append('overwrite','false');form.append('file',file);await secureApi('/api/v1/files/upload',{method:'POST',body:form});completed++}await loadFiles(state.files.path);showToast(`已上传 ${completed} 个${preservePaths?'文件夹内文件':'文件'}`)}catch(e){await showError(`已上传 ${completed}/${list.length} 个文件。${e.message}`)}finally{setBusy(false)}
}
async function uploadAndExtractZIP(files){
  const file=Array.from(files||[])[0];if(!file||!state.files)return
  if(!await askConfirm(`将 ${file.name} 解压到 ${state.files.path}，同名文件默认不覆盖。`,{title:'上传并解压 ZIP',confirmText:'开始解压'}))return
  const form=new FormData();form.append('directory',state.files.path);form.append('overwrite','false');form.append('file',file)
  setBusy(true);try{const result=await secureApi('/api/v1/files/archive/extract',{method:'POST',body:form});await loadFiles(state.files.path);showToast(`已解压 ${result.files||0} 个文件`)}catch(error){await showError(error.message)}finally{setBusy(false)}
}
async function fileMutation(action,item){
  const source=item.path,base=source.slice(0,source.lastIndexOf('/'))||'/',name=source.split('/').pop()
  try{
    if(action==='rename'){
      const next=await askText('',{title:'重命名',value:name,placeholder:'新名称'});if(!next||next===name)return
      await secureApi('/api/v1/files/rename',{method:'POST',body:jsonBody({source,destination:`${base==='/'?'':base}/${next}`})})
    }else if(action==='copy'||action==='move'){
      const suggestion=action==='copy'?`${base==='/'?'':base}/${copiedName(name,item.is_dir)}`:source
      const destination=await askText('',{title:action==='copy'?'复制到完整路径':'移动到完整路径',value:suggestion,placeholder:'/opt/example'});if(!destination||destination===source)return
      await secureApi(`/api/v1/files/${action}`,{method:'POST',body:jsonBody({source,destination})})
    }else if(action==='chmod'){
      const current=String(item.mode||'').match(/[0-7]{3,4}$/)?.[0]||'644',mode=await askText('',{title:'修改八进制权限',value:current,placeholder:'文件常用 644，目录常用 755'});if(!mode)return
      await secureApi('/api/v1/files/chmod',{method:'POST',body:jsonBody({path:source,mode})})
    }else if(action==='chown'){
      const value=await askText('格式：用户:用户组，可只填写其中一项，例如 root:root 或 :www-data',{title:'修改文件所有者',placeholder:'root:root'});if(!value)return
      const [owner='',group='']=String(value).split(':',2);await secureApi('/api/v1/files/chown',{method:'POST',body:jsonBody({path:source,owner:owner.trim(),group:group.trim()})})
    }else if(action==='delete'){
      if(!await askConfirm(source,{title:'移入回收站',confirmText:'确认删除',danger:true}))return
      await secureApi('/api/v1/files/delete',{method:'POST',body:jsonBody({path:source})})
    }
    state.modal=null;await loadFiles(state.files.path);showToast('文件操作已完成')
  }catch(e){await showError(e.message)}
}
async function recycleAction(id,action){
  if(action==='purge'&&!await askConfirm('永久删除后无法恢复。',{title:'永久删除',confirmText:'永久删除',danger:true}))return
  try{await secureApi('/api/v1/files/recycle',{method:'POST',body:jsonBody({id,action,destination:''})});await loadRecycle();showToast(action==='restore'?'文件已恢复':'已永久删除')}
  catch(error){if(action==='restore'&&String(error.message).includes('恢复目标已存在')){const item=(state.recycle?.entries||[]).find(entry=>entry.id===id),destination=await askText('',{title:'原位置已有同名文件',value:item?.original_path?`${item.original_path}-恢复`:'',placeholder:'输入新的完整恢复路径'});if(!destination)return;try{await secureApi('/api/v1/files/recycle',{method:'POST',body:jsonBody({id,action,destination})});await loadRecycle()}catch(nextError){await showError(nextError.message)};return}await showError(error.message)}
}
async function loadFileBackups(path){
  state.modal={title:'历史版本',kind:'loading'};render()
  try{state.fileBackups=await api(`/api/v1/files/backups?path=${encodeURIComponent(path)}`);state.modal={title:'历史版本',kind:'file-backups',path,backups:state.fileBackups.versions||[]};render()}catch(error){state.modal={title:'无法读取历史版本',kind:'error',content:error.message};render()}
}
async function showFileBackupDiff(path,id){state.modal={title:'对比历史版本',kind:'loading'};render();try{state.fileDiff=await api(`/api/v1/files/backups/diff?path=${encodeURIComponent(path)}&id=${encodeURIComponent(id)}`);state.modal={title:'版本差异',kind:'file-diff',path,id,diff:state.fileDiff};render()}catch(error){state.modal={title:'无法对比版本',kind:'error',content:error.message};render()}}
async function restoreFileBackup(path,id){if(!await askConfirm('恢复前会自动备份当前内容，可以再次回滚。',{title:'恢复历史版本',confirmText:'恢复此版本'}))return;try{await secureApi('/api/v1/files/backups/restore',{method:'POST',body:jsonBody({path,id})});showToast('历史版本已恢复');await openFile(path)}catch(error){await showError(error.message)}}

function toolsPage(){
  const githubEnabled=githubHelperEnabled()
  const basic=[['ping','Ping','测试基础网络延迟','example.com',''],['dns','DNS 查询','解析 A / AAAA 地址','example.com',''],['tcp','TCP 端口','测试目标端口连通性','example.com','443'],['http','HTTP 检查','查看状态码、跳转与耗时','https://example.com','']]
  const diagnosticCard=`<article class="tool-card surface"><div class="tool-icon">${icon('activity',22)}</div><h2>一键系统诊断</h2><p>固定读取负载、内存、Swap、磁盘、异常服务和监听端口，不提供任意命令。</p><button id="run-diagnostic" class="primary-button">生成诊断报告</button></article>`
  const githubCard=`<article class="tool-card surface optional-tool-card"><div class="tool-icon">${icon('github',22)}</div><div class="optional-tool-heading"><h2>GitHub 助手</h2><span>${githubEnabled?'入口已显示':'默认隐藏'}</span></div><p>这是内置功能，无需安装。可按需显示入口，用于设备登录、仓库管理、Actions 和 Release。</p>${githubEnabled?`<div class="optional-tool-actions"><a data-nav href="/github" class="primary-button">打开助手</a><button id="github-helper-remove" class="secondary-button">隐藏入口</button></div>`:`<button id="github-helper-install" class="primary-button">显示 GitHub 助手入口</button>`}</article>`
  return `<div class="page-wrap">${pageHeader('常用工具','按需执行，用完即停，不在后台常驻采集')}<section class="tools-grid">${basic.map(([tool,title,desc,placeholder,port])=>`<article class="tool-card surface"><div class="tool-icon">${icon(tool==='dns'?'network':tool==='tcp'?'server':tool==='http'?'activity':'terminal',22)}</div><h2>${title}</h2><p>${desc}</p><form class="tool-form" data-tool="${tool}"><input name="target" placeholder="${placeholder}" required>${port?`<input name="port" type="number" value="${port}" min="1" max="65535">`:''}<button class="primary-button" type="submit">开始测试</button></form></article>`).join('')}${diagnosticCard}${githubCard}</section><section id="tool-result" class="result-panel surface" hidden><div class="card-heading">${icon('terminal',19)}<strong>测试结果</strong><button id="copy-tool-result" class="secondary-button compact">${icon('copy',15)}复制</button></div><pre></pre></section></div>`
}

async function runTool(form){const f=new FormData(form),button=form.querySelector('button'),result=document.querySelector('#tool-result'),pre=result.querySelector('pre');button.disabled=true;button.textContent='测试中…';result.hidden=false;pre.textContent='正在执行…';try{const data=await api('/api/v1/tools/run',{method:'POST',body:jsonBody({tool:form.dataset.tool,target:f.get('target'),port:Number(f.get('port')||0)})});pre.textContent=(data.output||'完成')+`\n\n耗时：${data.duration_ms} ms`}catch(e){pre.textContent=e.message}finally{button.disabled=false;button.textContent='开始测试'}}
async function runDiagnostic(){const button=document.querySelector('#run-diagnostic'),result=document.querySelector('#tool-result'),pre=result.querySelector('pre');button.disabled=true;button.textContent='诊断中…';result.hidden=false;pre.textContent='正在收集固定诊断项…';try{const data=await api('/api/v1/tools/run',{method:'POST',body:jsonBody({tool:'diagnostic',target:'',port:0})});pre.textContent=(data.output||'完成')+`\n\n耗时：${data.duration_ms} ms`;result.scrollIntoView({behavior:'smooth',block:'start'})}catch(e){pre.textContent=e.message}finally{button.disabled=false;button.textContent='生成诊断报告'}}

async function loadAudit(){state.loading.audit=true;state.errors.audit='';try{const [audit,logs]=await Promise.all([api('/api/v1/audit?limit=1000'),api('/api/v1/logs/system?lines=600')]);state.audit=audit;state.systemLogs=logs}catch(e){state.errors.audit=e.message}finally{state.loading.audit=false;render()}}
function auditEventText(e){return `${formatDate(e.time)} | ${e.result} | ${e.action} | ${e.target||'-'} | ${e.user||'-'} | ${e.ip||'-'}${e.detail?` | ${e.detail}`:''}`}
function filteredAuditEvents(){const items=state.audit?.events||[],q=state.auditFilter.trim().toLowerCase();return q?items.filter(e=>auditEventText(e).toLowerCase().includes(q)):items}
function auditPage(){
  if(!state.audit&&!state.errors.audit){queueMicrotask(loadAudit);return `<div class="page-wrap">${pageHeader('日志审计','读取日志')}${surfaceLoading()}</div>`}
  const events=filteredAuditEvents(),auditText=events.map(auditEventText).join('\n'),systemText=state.systemLogs?.logs||''
  const actions=`<button id="copy-current-log" class="secondary-button compact">${icon('copy',16)}<span>复制当前</span></button><button id="export-audit" class="secondary-button compact">${icon('download',16)}<span>导出</span></button><button id="refresh-audit" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`
  return `<div class="page-wrap">${pageHeader('日志审计','支持搜索、一键复制和导出，敏感凭据不会写入日志',actions)}${errorBox(state.errors.audit)}<div class="tab-bar surface"><button class="${state.logTab==='audit'?'active':''}" data-log-tab="audit">操作审计</button><button class="${state.logTab==='system'?'active':''}" data-log-tab="system">系统日志</button></div>${state.logTab==='audit'?`<div class="search-bar surface audit-search">${icon('search',18)}<input id="audit-search" value="${escapeHTML(state.auditFilter)}" placeholder="搜索操作、目标、IP 或结果"><span>${events.length} / ${state.audit?.events?.length||0}</span></div><section id="audit-panel" class="audit-list surface" data-copy-block="${escapeHTML(auditText)}">${events.map(e=>`<div class="audit-row"><time>${formatDate(e.time)}</time><div><strong>${escapeHTML(e.action)}</strong><p title="${escapeHTML(e.target||'-')}">${escapeHTML(e.target||'-')}</p></div><span>${escapeHTML(e.user||'-')} · ${escapeHTML(e.ip||'-')}</span><b class="${e.result==='success'?'ok':'bad'}">${escapeHTML(e.result)}</b><button class="copy-icon audit-copy" data-copy-text="${escapeHTML(auditEventText(e))}" aria-label="复制这条记录">${icon('copy',14)}</button></div>`).join('')||'<div class="empty-list">暂无审计记录</div>'}</section>`:`<section id="system-log-panel" class="log-view surface"><pre>${escapeHTML(systemText||'暂无系统日志')}</pre></section>`}</div>`
}



async function globalFileSearch(){
  const root=state.files?.path||'/';const q=await askText(`在 ${root} 中递归查找文件或文件夹`,{title:'全局文件搜索',placeholder:'输入名称关键词'});if(!q)return
  state.modal={title:'搜索文件',kind:'loading'};render()
  try{const out=await api(`/api/v1/files/search?root=${encodeURIComponent(root)}&q=${encodeURIComponent(q)}`);state.modal={title:`搜索：${q}`,kind:'file-search-results',result:out};render()}catch(error){state.modal={title:'搜索失败',kind:'error',content:error.message};render()}
}
async function createArchive(item){
  const base=item.path.replace(/\/+$/,'').split('/').pop()||'archive';const choice=await chooseAction('选择压缩格式',[{label:'ZIP（兼容性最好）'},{label:'TAR.GZ（Linux 推荐）'}]);if(choice===false||choice===null)return;const format=choice===0?'zip':'tar.gz'
  const ext=format==='zip'?'.zip':'.tar.gz';const destination=await askText('压缩包保存路径',{title:'创建压缩包',value:`${state.files?.path||'/'}\/${base}${ext}`.replace(/\/+/g,'/')});if(!destination)return
  try{const out=await secureApi('/api/v1/files/archive/create',{method:'POST',body:jsonBody({destination,sources:[item.path],format})});showToast(`压缩完成：${out.path}`);state.modal=null;await loadFiles(state.files?.path||'/')}catch(error){await showError(error.message)}
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
  const users=state.sshUsers?.users||[],keys=state.sshKeys?.keys||[],status=state.ssh||{},totalKeys=users.reduce((sum,user)=>sum+Number(user.key_count||0),0)
  const passwordEnabled=String(status.password_authentication||'').toLowerCase()!=='no'
  const boolValue=v=>String(v||'').toLowerCase()!=='no'
  const passwordAction=passwordEnabled?`<button id="ssh-disable-password" class="danger-button" ${totalKeys<1?'disabled':''}>${icon('shield',17)}关闭密码登录</button>`:`<button id="ssh-enable-password" class="secondary-button">恢复密码登录</button>`
  const pending=status.pending_new_port?`<div class="alert warning ssh-port-pending">${icon('alert',18)}新端口 <b>${escapeHTML(status.pending_new_port)}</b> 和旧端口 <b>${escapeHTML(status.pending_old_port)}</b> 当前同时监听。请先用新端口成功登录，再确认关闭旧端口。<div><button id="ssh-port-keep-new" class="primary-button compact">新端口已验证</button><button id="ssh-port-revert" class="danger-button compact">恢复旧端口</button></div></div>`:''
  return `<div class="page-wrap ssh-page">${pageHeader('SSH 管理','关键设置自动校验，修改端口采用双端口过渡，避免把自己锁在门外',`<button id="refresh-ssh" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.ssh)}${pending}<section class="ssh-status-grid"><article class="surface status-card"><div class="card-heading">${icon('shield',19)}<strong>OpenSSH 状态</strong></div>${status.available?`<dl class="info-list"><div><dt>服务</dt><dd>${escapeHTML(status.service||'已安装')}</dd></div><div><dt>端口</dt><dd>${escapeHTML(status.port||'-')}</dd></div><div><dt>Root 登录</dt><dd>${escapeHTML(status.permit_root_login||'-')}</dd></div><div><dt>密码登录</dt><dd>${escapeHTML(status.password_authentication||'-')}</dd></div><div><dt>公钥登录</dt><dd>${escapeHTML(status.pubkey_authentication||'-')}</dd></div></dl><div class="ssh-hardening-actions">${passwordAction}<small>${passwordEnabled?(totalKeys?`已检测到 ${totalKeys} 把公钥。关闭前请先在另一个终端测试密钥登录。`:'没有检测到公钥，为避免锁死服务器，暂不允许关闭密码登录。'):'密码登录已关闭；保留此页面可随时恢复。'}</small></div>`:`<div class="empty-state"><span>${escapeHTML(status.error||'OpenSSH 不可用')}</span></div>`}</article><form id="ssh-settings-form" class="surface status-card settings-card"><div class="card-heading">${icon('wrench',19)}<strong>高级设置</strong></div><label>SSH 端口<input name="port" type="number" min="1" max="65535" value="${escapeHTML(String(status.port||'22').split(' ')[0])}" required></label><label>Root 登录<select name="permit_root_login"><option value="prohibit-password" ${status.permit_root_login==='prohibit-password'?'selected':''}>只允许密钥（推荐）</option><option value="no" ${status.permit_root_login==='no'?'selected':''}>完全禁止</option><option value="yes" ${status.permit_root_login==='yes'?'selected':''}>允许</option><option value="forced-commands-only" ${status.permit_root_login==='forced-commands-only'?'selected':''}>仅强制命令</option></select></label><label class="toggle-field"><input name="allow_tcp_forwarding" type="checkbox" ${boolValue(status.allow_tcp_forwarding)?'checked':''}><span><strong>TCP 转发</strong><small>代理、隧道或 VS Code Remote 可能需要</small></span></label><label class="toggle-field"><input name="allow_agent_forwarding" type="checkbox" ${boolValue(status.allow_agent_forwarding)?'checked':''}><span><strong>Agent 转发</strong><small>不使用跳板机时建议关闭</small></span></label><label class="toggle-field"><input name="x11_forwarding" type="checkbox" ${boolValue(status.x11_forwarding)?'checked':''}><span><strong>X11 转发</strong><small>服务器通常不需要</small></span></label><button class="primary-button" type="submit">校验并应用</button></form></section><section class="surface ssh-keys-panel"><header><div><strong>授权公钥</strong><p>管理所选用户的 <code>~/.ssh/authorized_keys</code></p></div><select id="ssh-user">${users.map(user=>`<option value="${escapeHTML(user.name)}" ${user.name===state.sshUser?'selected':''}>${escapeHTML(user.name)}（${user.key_count} 个密钥）</option>`).join('')}</select></header><div class="key-list">${keys.map(key=>`<article class="key-row"><div class="key-type">${escapeHTML(key.type.replace('ssh-',''))}</div><div><strong>${escapeHTML(key.comment||'未命名公钥')}</strong><p>${escapeHTML(key.fingerprint)}</p><small>${escapeHTML(key.preview)}</small></div><button class="danger-button compact" data-ssh-key-delete="${escapeHTML(key.id)}">删除</button></article>`).join('')||'<div class="empty-list">这个用户还没有公钥</div>'}</div><div class="ssh-key-actions"><button id="ssh-generate-key" class="primary-button">${icon('key',18)}生成 ED25519 密钥</button><span>私钥只显示一次，可直接下载；公钥会自动加入当前用户。</span></div><form id="ssh-key-form" class="ssh-key-form"><label>已有公钥<textarea name="key" rows="4" placeholder="ssh-ed25519 AAAA... iPhone" required></textarea></label><button class="secondary-button" type="submit">添加已有公钥</button></form></section></div>`
}
async function addSSHKey(form){const button=form.querySelector('button'),key=new FormData(form).get('key');button.disabled=true;button.textContent='添加中…';try{await secureApi('/api/v1/ssh/keys/add',{method:'POST',body:jsonBody({user:state.sshUser,key})});form.reset();await loadSSH(state.sshUser);showToast('公钥已添加')}catch(e){await showError(e.message)}finally{button.disabled=false;button.textContent='添加已有公钥'}}
async function deleteSSHKey(id){if(!await askConfirm('请确保还有其他可用登录方式，避免把自己锁在服务器外。',{title:'删除 SSH 公钥',confirmText:'确认删除',danger:true}))return;try{await secureApi('/api/v1/ssh/keys/delete',{method:'POST',body:jsonBody({user:state.sshUser,id})});await loadSSH(state.sshUser);showToast('SSH 公钥已删除')}catch(e){await showError(e.message)}}
async function toggleSSHPassword(enabled){
  const message=enabled?'恢复 SSH 密码登录后，账号密码将再次可以用于远程登录。':'请先在另一个 SSH 窗口使用公钥成功登录。LukePanel 会校验配置并在失败时回滚。'
  if(!await askConfirm(message,{title:enabled?'恢复密码登录':'关闭密码登录',confirmText:enabled?'确认恢复':'我已测试密钥，关闭密码',danger:!enabled}))return
  try{await secureApi('/api/v1/ssh/password',{method:'POST',body:jsonBody({enabled})});showToast(enabled?'密码登录已恢复':'密码登录已关闭');await loadSSH(state.sshUser)}catch(error){await showError(error.message)}
}
function openSSHKeyGenerator(){state.modal={title:'生成 SSH 密钥',kind:'ssh-key-generate',user:state.sshUser};render()}
async function generateSSHKey(form){
  const f=new FormData(form),button=form.querySelector('button[type=submit]'),passphrase=String(f.get('passphrase')||''),confirmValue=String(f.get('confirm')||'')
  if(passphrase!==confirmValue){const error=form.querySelector('.form-error');error.textContent='两次输入的私钥口令不一致';error.hidden=false;return}
  button.disabled=true;button.textContent='正在生成…'
  try{const result=await secureApi('/api/v1/ssh/keys/generate',{method:'POST',body:jsonBody({user:state.sshUser,comment:f.get('comment'),passphrase})});state.modal={title:'立即保存私钥',kind:'ssh-generated-key',key:result};await loadSSH(state.sshUser);state.modal={title:'立即保存私钥',kind:'ssh-generated-key',key:result};render()}catch(error){await showError(error.message)}finally{button.disabled=false;button.textContent='生成并加入授权列表'}
}

function githubHelperEnabled(){return localStorage.getItem('github-helper-enabled')==='1'}
function githubDefaults(){return {owner:localStorage.getItem('github-owner')||'',repo:localStorage.getItem('github-repo')||'',branch:localStorage.getItem('github-branch')||'main'}}
async function loadGitHubAuth(silent=false){
  try{state.githubAuth=await api('/api/v1/github/auth/status')}catch(error){state.githubAuth={connected:false,error:error.message}}
  if(!silent)render()
}
async function loadGitHub(owner,repo){
  const defaults=githubDefaults();owner=String(owner||defaults.owner||'').trim();repo=String(repo||defaults.repo||'').trim()
  if(!owner||!repo){state.github=null;state.errors.github='';render();return}
  state.loading.github=true;state.errors.github='';localStorage.setItem('github-owner',owner);localStorage.setItem('github-repo',repo)
  try{state.github=await api(`/api/v1/github/summary?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)}catch(e){state.errors.github=e.message}
  finally{state.loading.github=false;render()}
}
function workflowStatus(run){if(run.status!=='completed')return '运行中';return run.conclusion==='success'?'成功':run.conclusion||'未知'}
function githubAuthCard(){
  const auth=state.githubAuth
  if(!auth)return `<section class="surface github-auth-card"><div class="spinner"></div><span>检查 GitHub 登录状态…</span></section>`
  if(auth.connected)return `<section class="surface github-auth-card connected"><div class="github-user">${auth.avatar_url?`<img src="${escapeHTML(auth.avatar_url)}" alt="">`:icon('github',24)}<div><strong>已连接 @${escapeHTML(auth.login)}</strong><span>设备授权已完成；访问凭据仅保存在当前 LukePanel 会话内</span></div></div><button id="github-disconnect" class="secondary-button compact">断开连接</button></section>`
  return `<section class="surface github-auth-card"><div class="github-auth-heading"><h2>连接 GitHub</h2><p>点击后会打开 GitHub Device 页面。输入一次性代码并授权，LukePanel 会自动完成登录。</p></div><form id="github-connect-form" class="github-device-form"><button class="primary-button" type="submit">${icon('github',18)}使用 GitHub 设备登录</button></form>${state.githubFlow?`<div class="device-flow-box"><span>在 GitHub Device 页面输入以下代码</span><strong>${escapeHTML(state.githubFlow.user_code)}</strong><p class="device-flow-hint">授权完成后会自动登录，无需复制 Token，也无需从 GitHub 页面返回任何内容。</p><div><button id="copy-github-code" class="secondary-button compact">复制代码</button><a class="primary-button compact" href="${escapeHTML(state.githubFlow.verification_uri)}" target="_blank" rel="noopener">打开 GitHub 并授权</a><button id="cancel-github-device" class="secondary-button compact">取消</button></div><small class="device-flow-waiting">${icon('activity',14)}正在等待 GitHub 授权…</small></div>`:''}<details class="token-guide"><summary>高级登录方式：Fine-grained Token</summary><form id="github-token-form" class="github-token-form"><label>Fine-grained Token<input name="token" type="password" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" required></label><button class="secondary-button" type="submit">使用 Token 连接</button></form></details></section>`
}

function githubImportHTML(data){
  if(!state.githubAuth?.connected)return `<section class="surface github-import-panel muted-panel"><h2>ZIP 推送</h2><p>连接 GitHub 后，可以像 Working Copy 一样上传源码 ZIP，预览变更并 Commit + Push。</p></section>`
  const defaults=githubDefaults(),plan=state.githubImportPlan
  return `<section class="surface github-import-panel"><div><h2>上传 ZIP 并推送</h2><p>适合我给你的更新包：上传后先比较文件，再写入目标分支。默认只新增或覆盖，不会删除仓库里 ZIP 缺少的文件，也不会强制推送。</p></div><form id="github-import-form"><label>所有者<input name="owner" value="${escapeHTML(data?.owner||defaults.owner)}" required></label><label>仓库<input name="repo" value="${escapeHTML(data?.name||defaults.repo)}" required></label><label>分支<input name="branch" value="${escapeHTML(defaults.branch||data?.default_branch)}" required></label><label class="wide-field">源码 ZIP<input name="file" type="file" accept=".zip,application/zip" required></label><button class="primary-button" type="submit">上传并预览差异</button></form>${plan?`<div class="import-preview"><div class="import-counts"><span><b>${plan.added}</b>新增</span><span><b>${plan.modified}</b>修改</span><span><b>${plan.unchanged}</b>未变化</span><span><b>${plan.skipped}</b>已忽略</span></div><div class="import-file-list">${(plan.changes||[]).slice(0,120).map(c=>`<div><b class="change-${escapeHTML(c.status)}">${c.status==='added'?'新增':c.status==='modified'?'修改':'不变'}</b><code>${escapeHTML(c.path)}</code><span>${formatBytes(c.size)}</span></div>`).join('')}</div><form id="github-import-commit-form"><label>提交说明<input name="message" value="update LukePanel from uploaded ZIP" maxlength="200" required></label><button class="primary-button" type="submit">Commit 并 Push 到 ${escapeHTML(plan.branch)}</button></form><p class="release-warning">${icon('shield',17)}提交前会再次确认远端分支没有变化；若别人刚推送过，LukePanel 会拒绝覆盖。</p></div>`:''}</section>`
}
function githubBranchHTML(data){
  const branches=data.branches||[],pulls=data.pull_requests||[],defaults=githubDefaults()
  return `<section class="surface github-workflow-panel"><div><h2>分支与 Pull Request</h2><p>建议先从 main 新建分支，把 ZIP 推送到新分支，确认 Build 通过后再合并。LukePanel 不会强制推送或绕过分支保护。</p></div><div class="branch-chips">${branches.slice(0,20).map(branch=>`<span>${escapeHTML(branch.name)}${branch.protected?' · 受保护':''}</span>`).join('')||'<span>暂无分支数据</span>'}</div><div class="github-workflow-forms"><form id="github-branch-form"><h3>1. 新建分支</h3><label>新分支名称<input name="name" value="agent/update-${new Date().toISOString().slice(0,10)}" placeholder="agent/update-panel" required></label><label>基于分支<select name="source">${branches.map(branch=>`<option value="${escapeHTML(branch.name)}" ${branch.name===(data.default_branch||defaults.branch)?'selected':''}>${escapeHTML(branch.name)}</option>`).join('')}</select></label><button class="primary-button" type="submit" ${state.githubAuth?.connected?'':'disabled'}>创建分支</button></form><form id="github-pr-form"><h3>2. 创建 Pull Request</h3><label>提交分支<select name="head">${branches.filter(branch=>branch.name!==data.default_branch).map(branch=>`<option value="${escapeHTML(branch.name)}">${escapeHTML(branch.name)}</option>`).join('')}</select></label><label>目标分支<input name="base" value="${escapeHTML(data.default_branch)}" readonly></label><label>标题<input name="title" value="更新 LukePanel" maxlength="200" required></label><label>说明<textarea name="body" rows="4" placeholder="这次更新做了什么、为什么要更新"></textarea></label><button class="primary-button" type="submit" ${state.githubAuth?.connected&&branches.some(branch=>branch.name!==data.default_branch)?'':'disabled'}>创建 Pull Request</button></form></div><div class="open-pr-section"><div class="section-heading"><div><h3>待合并 Pull Request</h3><p>合并时会校验当前 Head SHA；如果 PR 刚被别人更新，会停止而不是覆盖。</p></div></div><div class="source-list">${pulls.map(pr=>`<article><div><strong>#${pr.number} ${escapeHTML(pr.title)}</strong><p>${escapeHTML(pr.head)} → ${escapeHTML(pr.base)}${pr.draft?' · 草稿':''}</p></div><div class="resource-actions"><a class="secondary-button compact" href="${escapeHTML(pr.html_url)}" target="_blank" rel="noopener">查看</a>${pr.draft?'':`<button class="primary-button compact" data-github-pr-merge="${pr.number}" data-head-sha="${escapeHTML(pr.head_sha||'')}">检查并合并</button>`}</div></article>`).join('')||'<div class="empty-list">没有待合并的 Pull Request</div>'}</div></div></section>`
}

function githubPage(){
  if(!githubHelperEnabled())return `<div class="page-wrap github-page">${pageHeader('GitHub 助手','可选功能，不使用时不会发起任何 GitHub 请求')}<section class="surface optional-feature-empty"><div class="feature-illustration">${icon('github',34)}</div><h2>GitHub 助手入口已隐藏</h2><p>这是内置功能，无需安装。显示入口后可使用设备登录、仓库管理、Actions 和 Release。</p><button id="github-helper-install" class="primary-button">显示 GitHub 助手入口</button><a data-nav href="/tools" class="secondary-button">返回常用工具</a></section></div>`
  const defaults=githubDefaults(),data=state.github
  if(!state.githubAuth&&!state.loading.githubAuth){state.loading.githubAuth=true;queueMicrotask(async()=>{await loadGitHubAuth(true);state.loading.githubAuth=false;render()})}
  const latest=data?.latest_release,tagSuggestion=latest?.tag_name?nextVersionSuggestion(latest.tag_name):'v0.9.10-beta'
  const actions=`<button id="github-helper-remove" class="secondary-button compact">停用助手</button>${data?`<a class="secondary-button compact" href="https://github.com/${escapeHTML(data.full_name)}/actions" target="_blank" rel="noopener">${icon('external',16)}<span>打开 Actions</span></a>`:''}`
  const repoEmpty=!data&&!state.loading.github&&!state.errors.github
  return `<div class="page-wrap github-page">${pageHeader('GitHub 助手','可选启用；仓库信息由你填写，不预设任何个人仓库',actions)}${githubAuthCard()}<form id="github-repo-form" class="surface github-repo-form"><div class="form-intro"><strong>选择要管理的仓库</strong><span>只会操作你明确填写并授权的仓库</span></div><label>所有者<input name="owner" value="${escapeHTML(data?.owner||defaults.owner)}" placeholder="例如 Luke-Lab666" autocomplete="off" required></label><label>仓库<input name="repo" value="${escapeHTML(data?.name||defaults.repo)}" placeholder="例如 LukePanel" autocomplete="off" required></label><button class="primary-button" type="submit">读取仓库</button></form>${errorBox(state.errors.github)}${state.loading.github?surfaceLoading('读取 GitHub 仓库'):repoEmpty?`<section class="surface github-repo-empty"><div>${icon('github',28)}</div><h2>还没有选择仓库</h2><p>填写所有者和仓库名后再读取。LukePanel 不会默认绑定开发者或你的任何仓库。</p></section>`:data?`<section class="github-summary-grid"><article class="surface status-card"><div class="card-heading">${icon('github',20)}<strong>${escapeHTML(data.full_name)}</strong></div><dl class="info-list"><div><dt>默认分支</dt><dd>${escapeHTML(data.default_branch)}</dd></div><div><dt>最新提交</dt><dd><code>${escapeHTML((data.main_sha||'').slice(0,12)||'-')}</code></dd></div><div><dt>分支</dt><dd>${data.branches?.length||0}</dd></div><div><dt>最新标签</dt><dd>${escapeHTML(data.tags?.[0]?.name||'暂无')}</dd></div><div><dt>最新 Release</dt><dd>${escapeHTML(latest?.tag_name||'暂无')}</dd></div></dl><div class="quick-copy-grid"><button class="secondary-button compact" data-copy-text="curl -fsSL https://raw.githubusercontent.com/${escapeHTML(data.full_name)}/main/install.sh | bash">复制安装命令</button><button class="secondary-button compact" data-copy-text="https://github.com/${escapeHTML(data.full_name)}">复制仓库地址</button></div></article><article class="surface status-card"><div class="card-heading">${icon('activity',20)}<strong>最近 Actions</strong></div><div class="workflow-list">${(data.workflow_runs||[]).slice(0,8).map(run=>`<div><span class="workflow-dot ${run.conclusion==='success'?'ok':run.status!=='completed'?'running':'bad'}"></span><div><strong>${escapeHTML(run.name)}</strong><small>${escapeHTML(run.head_branch||run.event)} · ${formatDate(run.created_at)}</small></div><div class="workflow-actions"><b>${workflowStatus(run)}</b><a href="${escapeHTML(run.html_url)}" target="_blank" rel="noopener">${icon('external',14)}</a>${['failure','cancelled','timed_out'].includes(run.conclusion)&&state.githubAuth?.connected?`<button data-github-rerun="${run.id}">重试</button>`:''}</div></div>`).join('')||'<div class="empty-list">暂无 Actions 记录</div>'}</div></article></section>${githubBranchHTML(data)}${githubImportHTML(data)}<section class="surface github-release-create"><div><h2>创建 GitHub Release</h2><p>适合已有 Tag 的版本，可生成发布说明；二进制附件仍建议由 Actions 自动上传。</p></div><form id="github-release-form" class="dialog-form"><label>Tag<input name="tag" value="${escapeHTML(data.tags?.[0]?.name||tagSuggestion)}" required></label><label>标题<input name="name" placeholder="留空则使用 Tag"></label><label>发布说明<textarea name="body" rows="5" placeholder="留空会让 GitHub 自动生成 Release Notes"></textarea></label><div class="option-row"><label class="checkbox-row"><input name="prerelease" type="checkbox" checked><span>预发布版本</span></label><label class="checkbox-row"><input name="draft" type="checkbox"><span>先保存为草稿</span></label></div><button class="primary-button" type="submit" ${state.githubAuth?.connected?'':'disabled'}>创建 Release</button></form></section><section class="surface release-helper"><div><h2>创建版本标签并触发 Release</h2><p>确认默认分支已经是要发布的版本后再创建 Tag。</p></div><form id="github-tag-form"><label>版本号<input name="tag" value="${escapeHTML(tagSuggestion)}" pattern="v[0-9][A-Za-z0-9._-]*" required></label><label>目标提交<input name="sha" value="${escapeHTML(data.main_sha||'')}" readonly></label><div class="release-warning">${icon('shield',17)}不会 Force Push，创建标签前需要二次验证。</div><button class="primary-button" type="submit" ${state.githubAuth?.connected?'':'disabled'}>${state.githubAuth?.connected?'创建 Tag 并触发发布':'请先连接 GitHub'}</button></form></section>`:''}</div>`
}
function nextVersionSuggestion(current){const match=String(current).match(/^v(\d+)\.(\d+)\.(\d+)(.*)$/);if(!match)return 'v0.9.10-beta';const major=Number(match[1]),minor=Number(match[2]),patch=Number(match[3]),suffix=match[4]||'';if(major===0&&minor<9)return 'v0.9.10-beta';if(major===0&&minor===9)return `v0.9.${patch+1}${suffix||'-beta'}`;return `v${major}.${minor+1}.0`}

async function startGitHubDeviceFlow(form){
  const button=form.querySelector('button[type=submit]'),popup=window.open('about:blank','_blank')
  button.disabled=true;button.textContent='正在生成设备代码…'
  try{
    state.githubFlow=await api('/api/v1/github/auth/device/start',{method:'POST',body:jsonBody({})})
    if(popup)popup.location.href=state.githubFlow.verification_uri
    render();scheduleGitHubPoll()
  }catch(error){
    popup?.close();await showError(error.message)
  }finally{
    if(button.isConnected){button.disabled=false;button.innerHTML=`${icon('github',18)}使用 GitHub 设备登录`}
  }
}
function scheduleGitHubPoll(){if(state.githubFlowTimer)clearTimeout(state.githubFlowTimer);if(!state.githubFlow?.flow_id)return;const delay=Math.max(2,Number(state.githubFlow.interval||5))*1000;state.githubFlowTimer=setTimeout(pollGitHubDeviceFlow,delay)}
async function pollGitHubDeviceFlow(){if(!state.githubFlow?.flow_id)return;try{const result=await api('/api/v1/github/auth/device/poll',{method:'POST',body:jsonBody({flow_id:state.githubFlow.flow_id})});if(result.status==='authorized'){state.githubFlow=null;state.githubAuth={connected:true,...result};showToast(`已连接 GitHub @${result.login}`);const defaults=githubDefaults();if(defaults.owner&&defaults.repo)await loadGitHub(defaults.owner,defaults.repo);else render();return}if(['expired','denied'].includes(result.status)){state.githubFlow=null;await showError(result.message||'GitHub 登录已取消或过期');render();return}state.githubFlow.interval=result.retry_after||state.githubFlow.interval;scheduleGitHubPoll()}catch(error){state.githubFlow=null;await showError(error.message);render()}}
async function disconnectGitHub(){if(!await askConfirm('Token 会立即从内存移除。',{title:'断开 GitHub 登录',confirmText:'断开连接'}))return;await api('/api/v1/github/auth/disconnect',{method:'POST'});state.githubAuth={connected:false};state.githubImportPlan=null;render()}
async function previewGitHubImport(form){const f=new FormData(form),button=form.querySelector('button');localStorage.setItem('github-owner',String(f.get('owner')));localStorage.setItem('github-repo',String(f.get('repo')));localStorage.setItem('github-branch',String(f.get('branch')));button.disabled=true;button.textContent='上传并比较中…';try{state.githubImportPlan=await api('/api/v1/github/import/preview',{method:'POST',body:f});render();showToast('差异预览已生成')}catch(error){await showError(error.message)}finally{button.disabled=false;button.textContent='上传并预览差异'}}
async function commitGitHubImport(form){const f=new FormData(form),button=form.querySelector('button'),plan=state.githubImportPlan;if(!plan)return;if(!await askConfirm(`将 ${plan.added} 个新增、${plan.modified} 个修改文件推送到 ${plan.owner}/${plan.repo}:${plan.branch}。`,{title:'Commit 并 Push',confirmText:'确认推送'}))return;button.disabled=true;button.textContent='正在 Commit + Push…';try{const result=await secureApi('/api/v1/github/import/commit',{method:'POST',body:jsonBody({plan_id:plan.id,message:f.get('message')})});state.githubImportPlan=null;showToast(`已推送 ${result.files} 个文件`);window.open(result.html_url,'_blank','noopener');await loadGitHub(plan.owner,plan.repo)}catch(error){await showError(error.message)}finally{button.disabled=false;button.textContent=`Commit 并 Push 到 ${plan.branch}`}}
async function createGitHubTag(form){const f=new FormData(form),button=form.querySelector('button'),tag=String(f.get('tag')||'');if(!await askConfirm(`创建 ${tag} 后 Release Actions 会自动开始。`,{title:'创建版本标签',confirmText:'创建 Tag'}))return;button.disabled=true;button.textContent='正在创建…';try{await secureApi('/api/v1/github/tag',{method:'POST',body:jsonBody({owner:state.github.owner,repo:state.github.name,tag,targetSHA:f.get('sha')})});showToast('标签已创建，Release Actions 将自动运行');setTimeout(()=>loadGitHub(state.github.owner,state.github.name),2500)}catch(e){await showError(e.message)}finally{button.disabled=false;button.textContent='创建 Tag 并触发发布'}}
async function createGitHubBranch(form){const f=new FormData(form),button=form.querySelector('button'),name=String(f.get('name')||'').trim();button.disabled=true;try{await secureApi('/api/v1/github/branch',{method:'POST',body:jsonBody({owner:state.github.owner,repo:state.github.name,name,source:f.get('source')})});showToast(`分支 ${name} 已创建`);localStorage.setItem('github-branch',name);await loadGitHub(state.github.owner,state.github.name)}catch(error){await showError(error.message)}finally{button.disabled=false}}
async function createGitHubPullRequest(form){const f=new FormData(form),button=form.querySelector('button');if(!await askConfirm(`${f.get('head')} → ${f.get('base')}`,{title:'创建 Pull Request',confirmText:'创建 PR'}))return;button.disabled=true;try{const result=await secureApi('/api/v1/github/pull',{method:'POST',body:jsonBody({owner:state.github.owner,repo:state.github.name,title:f.get('title'),body:f.get('body'),head:f.get('head'),base:f.get('base')})});showToast(`PR #${result.number} 已创建`);window.open(result.html_url,'_blank','noopener')}catch(error){await showError(error.message)}finally{button.disabled=false}}
async function rerunGitHubAction(runID){if(!await askConfirm('只会重新运行失败的任务，不会重跑已成功任务。',{title:'重试 GitHub Actions',confirmText:'重新运行'}))return;try{await secureApi('/api/v1/github/rerun',{method:'POST',body:jsonBody({owner:state.github.owner,repo:state.github.name,run_id:Number(runID)})});showToast('已请求重试失败任务');setTimeout(()=>loadGitHub(state.github.owner,state.github.name),2200)}catch(error){await showError(error.message)}}

function passwordAssessment(value,username=''){
  const password=String(value||''),lower=password.toLowerCase(),user=String(username||'').toLowerCase()
  const checks=[
    ['length',password.length>=12,'至少 12 个字符'],
    ['categories',[/[a-z]/,/[A-Z]/,/[0-9]/,/[^A-Za-z0-9]/].filter(pattern=>pattern.test(password)).length>=(password.length>=16?2:3),'混合大小写、数字和符号'],
    ['username',!user||user.length<3||!lower.includes(user),'不包含用户名'],
    ['common',!['password','password123','admin123456','qwerty123456','123456789012','letmein123456'].includes(lower),'不是常见弱密码'],
    ['spaces',password===password.trim(),'首尾没有空格']
  ]
  const passed=checks.filter(item=>item[1]).length,score=Math.round(passed/checks.length*100)
  return {ok:checks.every(item=>item[1]),score,label:score===100?'强':score>=80?'可用':score>=60?'偏弱':'弱',checks}
}
async function loadSecurity(){
  if(state.loading.security)return;state.loading.security=true;state.errors.security=''
  try{const [settings,sessions,totp,report]=await Promise.all([api('/api/v1/settings'),api('/api/v1/auth/sessions'),api('/api/v1/auth/totp/status'),api('/api/v1/security/status')]);state.settings=settings;state.sessions=sessions;state.totpStatus=totp;state.securityReport=report;state.username=settings.admin_user||state.username}
  catch(e){state.errors.security=e.message}finally{state.loading.security=false;render()}
}
function securityCheckIcon(status){return status==='good'?icon('check',16):status==='bad'?icon('alert',16):icon('shield',16)}
function securityPage(){
  if((!state.settings||!state.sessions||!state.totpStatus||!state.securityReport)&&!state.errors.security)queueMicrotask(loadSecurity)
  const uninstallCommand='lukepanel-uninstall',purgeCommand='lukepanel-uninstall --purge',totp=state.totpStatus||{},report=state.securityReport||{score:0,checks:[]},fail2ban=report.checks?.find(check=>check.id==='fail2ban')
  const headerActions=`<button id="refresh-security" class="secondary-button compact">${icon('refresh',16)}<span>复查</span></button><button data-logout class="danger-button compact">${icon('logout',16)}<span>退出</span></button>`
  return `<div class="page-wrap security-page">${pageHeader('我的与安全','账号、安全体检、两步验证与主机防护',headerActions)}${errorBox(state.errors.security)}<section class="security-overview surface"><div class="security-score" style="--score:${Number(report.score||0)}"><strong>${Number(report.score||0)}</strong><span>安全分</span></div><div><h2>${report.score>=90?'防护状态良好':report.score>=70?'还有加固空间':'建议尽快处理高风险项'}</h2><p>LukePanel 只提供可回滚的安全操作，不会自动封端口或强行关闭你的登录方式。</p></div></section><section class="security-check-grid">${(report.checks||[]).map(check=>`<article class="surface security-check ${escapeHTML(check.status)}"><div>${securityCheckIcon(check.status)}<strong>${escapeHTML(check.title)}</strong><span>${check.status==='good'?'正常':check.status==='bad'?'高风险':'建议改进'}</span></div><p>${escapeHTML(check.detail||'')}</p>${check.recommendation?`<small>${escapeHTML(check.recommendation)}</small>`:''}${check.id==='fail2ban'&&check.status!=='good'?`<button id="install-fail2ban" class="primary-button compact">一键启用防暴力破解</button>`:''}${check.id==='auto-updates'&&check.status!=='good'?`<button id="enable-auto-updates" class="primary-button compact">启用自动安全更新</button>`:''}</article>`).join('')}</section><section class="account-grid"><article class="surface account-panel"><h2>修改用户名</h2><p>修改后其他设备会退出，当前设备继续登录。</p><form id="username-form"><label>新用户名<input name="username" value="${escapeHTML(state.settings?.admin_user||state.username)}" pattern="[A-Za-z][A-Za-z0-9_.-]{2,31}" autocomplete="username" required></label><label>当前密码<input name="current_password" type="password" autocomplete="current-password" ${passwordInputAttributes()} required></label><div class="form-error" hidden></div><button class="primary-button" type="submit">保存用户名</button></form></article><article class="surface password-panel"><h2>修改登录密码</h2><p>拒绝常见弱密码；两次输入必须完全一致。</p><form id="password-form"><label>当前密码<input name="current" type="password" autocomplete="current-password" ${passwordInputAttributes()} required></label><label>新密码<input id="new-password" name="next" type="password" minlength="12" maxlength="128" autocomplete="new-password" ${passwordInputAttributes()} required></label><label>确认新密码<input id="confirm-password" name="confirm" type="password" minlength="12" maxlength="128" autocomplete="new-password" ${passwordInputAttributes()} required></label><div id="password-strength" class="password-strength"><div><span></span></div><strong>尚未输入</strong></div><ul id="password-checks" class="password-checks"></ul><div id="password-message" class="form-error" hidden></div><button class="primary-button" type="submit" disabled>保存新密码</button></form></article></section><section class="totp-panel surface"><div><div class="card-heading">${icon('key',20)}<strong>身份验证器（TOTP）</strong>${statusBadge(totp.enabled?'active':'inactive')}</div><p>${totp.enabled?`登录时需要 6 位验证码；剩余 ${totp.recovery_codes_remaining||0} 个恢复码。`:'开启后，即使密码泄露也不能直接登录面板。'}</p></div><div class="resource-actions">${totp.enabled?`<button id="totp-regenerate" class="secondary-button">重新生成恢复码</button><button id="totp-disable" class="danger-button">关闭两步验证</button>`:`<button id="totp-enable" class="primary-button">开启两步验证</button>`}</div></section><section class="settings-list surface"><div class="setting-row"><div class="setting-icon">${icon('refresh',21)}</div><div><strong>兼容刷新间隔</strong><p>实时推送不可用时启用；后台仍会暂停</p></div><select id="refresh-interval"><option value="2">2 秒</option><option value="5">5 秒</option><option value="10">10 秒</option><option value="30">30 秒</option><option value="60">60 秒</option></select></div><div class="setting-row"><div class="setting-icon">${icon('clock',21)}</div><div><strong>活跃会话</strong><p>${state.sessions?.sessions?.length||1} 个会话</p></div><button id="revoke-sessions" class="secondary-button compact">退出其他设备</button></div></section><section class="account-actions surface"><div><h2>账户操作</h2><p>退出只结束当前设备会话，不影响服务器服务。</p></div><button data-logout class="danger-button">${icon('logout',18)}退出当前账号</button></section><section class="uninstall-panel surface"><div><h2>卸载 LukePanel</h2><p>默认保留配置和数据；加 <code>--purge</code> 才彻底删除。</p></div><div class="command-row"><code>${uninstallCommand}</code><button class="secondary-button compact" data-copy-text="${uninstallCommand}">${icon('copy',16)}复制</button></div><div class="command-row danger-command"><code>${purgeCommand}</code><button class="secondary-button compact" data-copy-text="${purgeCommand}">${icon('copy',16)}复制彻底卸载命令</button></div></section><section class="security-meta surface"><dl class="info-list"><div><dt>版本</dt><dd>${escapeHTML(state.settings?.version||'dev')}</dd></div><div><dt>监听</dt><dd>${escapeHTML(state.settings?.listen||'-')}</dd></div><div><dt>安全 Cookie</dt><dd>${state.settings?.secure_cookie?'已开启':'已关闭'}</dd></div><div><dt>Agent Socket</dt><dd>${escapeHTML(state.settings?.agent_socket||'-')}</dd></div></dl></section></div>`
}
function updatePasswordStrength(){
  const input=document.querySelector('#new-password'),confirm=document.querySelector('#confirm-password'),form=document.querySelector('#password-form');if(!input||!form)return
  const assessment=passwordAssessment(input.value,state.settings?.admin_user||state.username),strength=document.querySelector('#password-strength'),list=document.querySelector('#password-checks'),matches=input.value!==''&&input.value===confirm?.value
  strength.querySelector('span').style.width=`${assessment.score}%`;strength.querySelector('strong').textContent=input.value?`${assessment.label} · ${assessment.score}%`:'尚未输入'
  list.innerHTML=assessment.checks.map(([,ok,label])=>`<li class="${ok?'ok':''}">${ok?'✓':'○'} ${escapeHTML(label)}</li>`).join('')+`<li class="${matches?'ok':''}">${matches?'✓':'○'} 两次输入一致</li>`
  form.querySelector('button[type=submit]').disabled=!(assessment.ok&&matches)
}
async function changeUsername(form){const f=new FormData(form),button=form.querySelector('button[type=submit]'),error=form.querySelector('.form-error');button.disabled=true;error.hidden=true;try{const result=await api('/api/v1/auth/account',{method:'PATCH',body:jsonBody({username:String(f.get('username')||'').trim(),current_password:f.get('current_password')})});state.username=result.username;state.settings.admin_user=result.username;localStorage.setItem('lukepanel-login-user',result.username);form.querySelector('[name=current_password]').value='';showToast('用户名已更新，其他设备已退出')}catch(e){error.textContent=e.message;error.hidden=false}finally{button.disabled=false}}
async function installFail2Ban(){if(!await askConfirm('将安装 Fail2ban，启用 SSH 防暴力破解，并自动把当前访问 IP 与内网网段加入忽略列表。',{title:'启用 SSH 防暴力破解',confirmText:'安装并启用'}))return;setBusy(true);try{await secureApi('/api/v1/security/fail2ban/install',{method:'POST',body:'{}'});showToast('Fail2ban 已启用');await loadSecurity()}catch(error){await showError(error.message)}finally{setBusy(false)}}
async function enableAutomaticUpdates(){if(!await askConfirm('将安装 unattended-upgrades，并自动安装 Debian/Ubuntu 安全更新。不会自动重启服务器。',{title:'启用自动安全更新',confirmText:'安装并启用'}))return;setBusy(true);try{await secureApi('/api/v1/security/auto-updates/enable',{method:'POST',body:'{}'});showToast('自动安全更新已启用');await loadSecurity()}catch(error){await showError(error.message)}finally{setBusy(false)}}

async function startTOTPSetup(){try{state.totpSetup=await secureApi('/api/v1/auth/totp/setup',{method:'POST'});state.modal={title:'开启两步验证',kind:'totp-setup',setup:state.totpSetup};render()}catch(error){await showError(error.message)}}
async function confirmTOTPSetup(form){const code=String(new FormData(form).get('code')||''),button=form.querySelector('button');button.disabled=true;try{await secureApi('/api/v1/auth/totp/confirm',{method:'POST',body:jsonBody({code})});const codes=state.totpSetup?.recovery_codes||[];state.totpSetup=null;state.modal={title:'保存恢复码',kind:'recovery-codes',codes};await loadSecurity();state.modal={title:'保存恢复码',kind:'recovery-codes',codes};render()}catch(error){await showError(error.message)}finally{button.disabled=false}}
async function disableTOTP(){const code=await askText('输入当前 6 位验证码或一个恢复码',{title:'关闭两步验证',placeholder:'验证码或恢复码',confirmText:'关闭',required:true});if(!code)return;if(!await askConfirm('关闭后登录只依赖密码。',{title:'确认关闭两步验证',confirmText:'确认关闭',danger:true}))return;try{await secureApi('/api/v1/auth/totp/disable',{method:'POST',body:jsonBody({code})});showToast('两步验证已关闭');await loadSecurity()}catch(error){await showError(error.message)}}
async function regenerateRecoveryCodes(){const code=await askText('输入当前 6 位验证码或一个恢复码',{title:'重新生成恢复码',placeholder:'验证码或恢复码'});if(!code)return;try{const result=await secureApi('/api/v1/auth/totp/recovery',{method:'POST',body:jsonBody({code})});state.modal={title:'新的恢复码',kind:'recovery-codes',codes:result.recovery_codes||[]};render();await loadSecurity();state.modal={title:'新的恢复码',kind:'recovery-codes',codes:result.recovery_codes||[]};render()}catch(error){await showError(error.message)}}


async function openComposeConfig(project){state.modal={title:`${project} · Compose`,kind:'loading'};render();try{const config=await api(`/api/v1/docker/compose/config?project=${encodeURIComponent(project)}`);state.composeConfig=config;state.modal={title:`${project} · Compose 配置`,kind:'compose-config',config};render()}catch(error){state.modal={title:'读取 Compose 失败',kind:'error',content:error.message};render()}}
async function saveComposeConfig(form){const files={};form.querySelectorAll('[data-compose-path]').forEach(area=>files[area.dataset.composePath]=area.value);const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='正在验证…';try{const out=await secureApi('/api/v1/docker/compose/config',{method:'PUT',body:jsonBody({project:state.composeConfig.project,files,deploy:new FormData(form).get('deploy')==='on'})});state.modal={title:'Compose 保存结果',kind:'logs',content:out.output||'配置已保存并通过校验'};await loadDocker();state.modal={title:'Compose 保存结果',kind:'logs',content:out.output||'配置已保存并通过校验'};render()}catch(error){await showError(error.message)}finally{button.disabled=false;button.textContent='保存并验证'}}
async function buildDockerImage(form){
  const f=new FormData(form),button=form.querySelector('button[type=submit]')
  button.disabled=true
  try{
    const job=await startBackgroundJob('docker.image.build',{build:{context_dir:f.get('context_dir'),dockerfile:f.get('dockerfile'),tag:f.get('tag'),pull:f.get('pull')==='on',no_cache:f.get('no_cache')==='on'}})
    state.modal={title:`构建镜像 ${f.get('tag')}`,kind:'job-progress',job};render()
    await monitorBackgroundJob(job.id,`构建镜像 ${f.get('tag')}`)
    await loadDocker()
  }catch(error){await showError(error.message)}finally{button.disabled=false}
}

async function confirmSSHPort(keepNew){if(!await askConfirm(keepNew?'确认你已经从另一个终端通过新端口成功登录？确认后旧端口将关闭。':'将删除新端口并恢复旧端口。',{title:keepNew?'确认新 SSH 端口':'恢复旧 SSH 端口',confirmText:'确认',danger:!keepNew}))return;try{await secureApi('/api/v1/ssh/port/confirm',{method:'POST',body:jsonBody({keep_new:keepNew})});showToast(keepNew?'已关闭旧端口':'已恢复旧端口');await loadSSH(state.sshUser)}catch(error){await showError(error.message)}}
async function createGitHubRelease(form){const f=new FormData(form),defaults=githubDefaults(),data=state.github;if(!data)return;try{const out=await secureApi('/api/v1/github/release',{method:'POST',body:jsonBody({owner:data.owner||defaults.owner,repo:data.name||defaults.repo,tag:f.get('tag'),name:f.get('name'),body:f.get('body'),draft:f.get('draft')==='on',prerelease:f.get('prerelease')==='on'})});showToast(`Release ${out.tag_name||f.get('tag')} 已创建`);await loadGitHub(data.owner,data.name)}catch(error){await showError(error.message)}}

async function mergeGitHubPullRequest(button){
  const choice=await chooseAction(`PR #${button.dataset.githubPrMerge} 合并方式`,[
    {label:'Squash 合并（推荐）',description:'把更新整理成一个提交，历史最清晰'},
    {label:'普通 Merge',description:'保留分支中的全部提交'},
    {label:'Rebase 合并',description:'线性历史，适合熟悉 Git 的用户'}
  ])
  if(choice===false||choice===null)return
  const method=['squash','merge','rebase'][choice]
  if(!await askConfirm('GitHub 分支保护和 Actions 检查仍然生效；检查不通过时不会强行合并。',{title:`合并 PR #${button.dataset.githubPrMerge}`,confirmText:'确认合并',danger:false}))return
  try{
    const out=await secureApi('/api/v1/github/pull/merge',{method:'POST',body:jsonBody({owner:state.github.owner,repo:state.github.name,number:Number(button.dataset.githubPrMerge),expected_sha:button.dataset.headSha||'',method})})
    showToast(out.message||'Pull Request 已合并')
    await loadGitHub(state.github.owner,state.github.name)
  }catch(error){await showError(error.message)}
}

function modalHTML(){
  if(!state.modal)return''
  const m=state.modal;let body='',footer=''
  if(m.kind==='loading')body='<div class="modal-loading"><div class="spinner"></div></div>'
  else if(m.kind==='logs'){body=`<pre class="modal-log">${escapeHTML(m.content)}</pre>`;footer=`<footer><button class="secondary-button compact" id="copy-modal-log">${icon('copy',16)}复制全部</button><button class="primary-button compact" id="modal-done">完成</button></footer>`}
  else if(m.kind==='error')body=`<div class="alert error modal-error">${icon('alert',18)}${escapeHTML(m.content)}</div>`
  else if(m.kind==='editor'){
    body=`<textarea id="file-editor" spellcheck="false">${escapeHTML(m.content)}</textarea>`
    footer=`<footer><div class="editor-secondary-actions"><button id="copy-file-path" class="secondary-button compact">${icon('copy',16)}路径</button><button id="copy-file-content" class="secondary-button compact">${icon('copy',16)}内容</button>${m.preview_kind==='markdown'?`<button id="preview-markdown" class="secondary-button compact">${icon('file',16)}预览</button>`:''}<button id="download-file" class="secondary-button compact">${icon('download',16)}下载</button><button id="file-history" class="secondary-button compact">${icon('restore',16)}历史</button><button id="rename-file" class="secondary-button compact">重命名</button><button id="delete-file" class="danger-button compact">${icon('trash',16)}删除</button></div><button id="save-file" class="primary-button compact">${icon('save',16)}保存</button></footer>`
  }else if(m.kind==='file-actions'){
    const item=m.item
    body=`<div class="action-sheet"><button data-file-action="copy-path">${icon('copy',19)}<span>复制完整路径</span></button>${item.is_dir?'':`<button data-file-action="download">${icon('download',19)}<span>下载文件</span></button><button data-file-action="history">${icon('restore',19)}<span>历史版本</span></button>`}<button data-file-action="rename">${icon('edit',19)}<span>重命名</span></button><button data-file-action="copy">${icon('copy',19)}<span>复制到…</span></button><button data-file-action="move">${icon('move',19)}<span>移动到…</span></button><button data-file-action="archive">${icon('package',19)}<span>压缩为…</span></button><button data-file-action="chmod">${icon('shield',19)}<span>修改权限</span><small>${escapeHTML(item.mode||'')}</small></button><button data-file-action="chown">${icon('user',19)}<span>修改所有者</span></button><button class="danger" data-file-action="delete">${icon('trash',19)}<span>移入回收站</span></button></div>`
  }else if(m.kind==='upload-menu'){
    body=`<div class="action-sheet"><button id="choose-files-upload">${icon('file',19)}<span>上传文件</span><small>可多选</small></button><button id="choose-folder-upload">${icon('folder',19)}<span>上传整个文件夹</span><small>保留目录结构</small></button><button id="choose-zip-extract">${icon('package',19)}<span>上传 ZIP 并解压</span><small>适合 iPhone 和大量文件</small></button></div>`
  }else if(m.kind==='docker-cleanup'){
    const x=m.preview||{}
    body=`<form id="docker-cleanup-form" class="dialog-form"><div class="cleanup-summary"><span><b>${x.stopped_containers||0}</b>停止容器</span><span><b>${(x.dangling_images||0)+(x.unused_images||0)}</b>未用镜像</span><span><b>${x.unused_networks||0}</b>未用网络</span><span><b>${x.unused_volumes||0}</b>未用卷</span><span><b>${formatBytes(x.reclaimable_bytes||0)}</b>预计可释放</span></div><label>清理模式<select name="mode"><option value="safe">安全清理（推荐）</option><option value="deep">深度清理未使用镜像</option></select></label><label class="checkbox-row"><input type="checkbox" name="volumes"><span>同时清理未使用的存储卷</span></label><div class="release-warning">${icon('shield',17)}正在运行或被引用的资源不会删除；存储卷可能包含重要数据，默认不勾选。</div><button class="danger-button" type="submit">检查后执行清理</button></form>`
  }else if(m.kind==='docker-network')body=`<form id="docker-network-form" class="dialog-form"><label>网络名称<input name="name" placeholder="例如 app-network" required></label><label>驱动<select name="driver"><option value="bridge">bridge（推荐）</option><option value="macvlan">macvlan</option><option value="ipvlan">ipvlan</option></select></label><label>子网（可选）<input name="subnet" placeholder="172.30.0.0/16"></label><label>网关（可选）<input name="gateway" placeholder="172.30.0.1"></label><label class="checkbox-row"><input type="checkbox" name="internal"><span>仅内部网络，不访问外网</span></label><button class="primary-button" type="submit">创建网络</button></form>`
  else if(m.kind==='docker-volume')body=`<form id="docker-volume-form" class="dialog-form"><label>存储卷名称<input name="name" placeholder="例如 app-data" required></label><label>驱动<input name="driver" value="local" required></label><button class="primary-button" type="submit">创建存储卷</button></form>`
  else if(m.kind==='task-create')body=`<form id="task-create-form" class="dialog-form"><label>任务名称<input name="name" placeholder="例如每天重启 mosdns" required></label><label>安全任务类型<select name="type" id="task-type"><option value="service-restart">重启 systemd 服务</option><option value="docker-restart">重启 Docker 容器</option><option value="docker-cleanup-safe">安全清理 Docker</option><option value="panel-backup">完整面板备份</option></select></label><label id="task-target-label">目标名称<input name="target" placeholder="例如 mosdns.service" required></label><label>执行频率<select name="frequency" id="task-frequency"><option value="daily">每天</option><option value="weekly">每周</option><option value="hourly">每小时</option></select></label><div class="time-fields"><label>小时<input name="hour" type="number" min="0" max="23" value="4"></label><label>分钟<input name="minute" type="number" min="0" max="59" value="0"></label><label id="task-weekday-label">星期<select name="weekday"><option value="1">周一</option><option value="2">周二</option><option value="3">周三</option><option value="4">周四</option><option value="5">周五</option><option value="6">周六</option><option value="0">周日</option></select></label></div><div class="release-warning">${icon('shield',17)}不支持自定义 Shell，避免计划任务变成远程 WebShell。</div><button class="primary-button" type="submit">创建计划任务</button></form>`
  else if(m.kind==='file-backups')body=`<div class="backup-list">${(m.backups||[]).map(version=>`<article><div><strong>${formatDate(version.created_at)}</strong><small>${formatBytes(version.size)} · ${escapeHTML(version.id)}</small></div><div><button class="secondary-button compact" data-backup-diff="${escapeHTML(version.id)}">对比</button><button class="primary-button compact" data-backup-restore="${escapeHTML(version.id)}">恢复</button></div></article>`).join('')||'<div class="empty-list">还没有历史版本。文件每次在线保存前会自动备份。</div>'}</div>`
  else if(m.kind==='file-diff'){body=`<div class="diff-note">备份时间：${formatDate(m.diff?.backup_time)}${m.diff?.truncated?' · 内容较长，已截断':''}</div><pre class="file-diff">${escapeHTML(m.diff?.diff||'没有差异')}</pre>`;footer=`<footer><button class="secondary-button" id="back-to-backups">返回版本列表</button><button class="primary-button" data-backup-restore="${escapeHTML(m.id)}">恢复此版本</button></footer>`}
  else if(m.kind==='totp-setup')body=`<form id="totp-setup-form" class="totp-setup"><p>在身份验证器中添加下面的密钥，或点击按钮尝试直接打开 App。</p><div class="secret-box"><code>${escapeHTML(m.setup.secret)}</code><button type="button" data-copy-text="${escapeHTML(m.setup.secret)}">复制密钥</button></div><a href="${escapeHTML(m.setup.otpauth_uri)}" class="secondary-button">打开身份验证器</a><label>输入身份验证器显示的 6 位验证码<input name="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" required></label><button class="primary-button" type="submit">验证并开启</button></form>`
  else if(m.kind==='recovery-codes'){const text=(m.codes||[]).join('\n');body=`<div class="recovery-codes"><div class="alert warning">${icon('alert',18)}每个恢复码只能用一次。请保存到密码管理器，不要只留在这台服务器上。</div><pre>${escapeHTML(text)}</pre><button class="secondary-button" data-copy-text="${escapeHTML(text)}">复制全部恢复码</button><button class="secondary-button" id="download-recovery-codes">下载文本文件</button></div>`;footer=`<footer><button class="primary-button" id="modal-done">我已安全保存</button></footer>`}
  else if(m.kind==='ssh-key-generate')body=`<form id="ssh-key-generate-form" class="dialog-form"><p>为 <strong>${escapeHTML(m.user||'')}</strong> 生成 ED25519 密钥，并自动加入授权列表。</p><label>密钥备注<input name="comment" value="${escapeHTML(`${m.user||'user'}@LukePanel-${new Date().toISOString().slice(0,10)}`)}" maxlength="128" required></label><label>私钥口令（推荐）<input name="passphrase" type="password" autocomplete="new-password" ${passwordInputAttributes()} placeholder="留空则私钥不加密"></label><label>再次输入私钥口令<input name="confirm" type="password" autocomplete="new-password" ${passwordInputAttributes()}></label><div class="form-error" hidden></div><div class="release-warning">${icon('shield',17)}私钥只返回一次。设置口令更安全，但连接时需要输入口令或使用密钥代理。</div><button class="primary-button" type="submit">生成并加入授权列表</button></form>`
  else if(m.kind==='ssh-generated-key'){const key=m.key||{};body=`<div class="generated-key-panel"><div class="alert warning">${icon('alert',18)}这是唯一一次显示私钥。关闭前请立即下载，并确认文件已保存。</div><dl class="info-list"><div><dt>文件名</dt><dd>${escapeHTML(key.filename||'id_ed25519')}</dd></div><div><dt>指纹</dt><dd><code>${escapeHTML(key.fingerprint||'-')}</code></dd></div><div><dt>备注</dt><dd>${escapeHTML(key.comment||'-')}</dd></div></dl><div class="generated-key-actions"><button id="download-generated-private-key" class="primary-button">${icon('download',17)}下载私钥</button><button id="copy-generated-public-key" class="secondary-button">${icon('copy',17)}复制公钥</button></div><details><summary>查看公钥</summary><pre>${escapeHTML(key.public_key||'')}</pre></details></div>`;footer=`<footer><button class="primary-button" id="modal-done">我已保存私钥</button></footer>`}
  else if(m.kind==='docker-edit'){
    const x=m.spec
    if(x.compose_managed){body=`<div class="compose-managed-note">${icon('alert',20)}<h3>这个容器由 Docker Compose 管理</h3><p>直接重建会让配置和 Compose 文件失去同步。请编辑下面的 Compose YAML，再回到 Docker 页面点“启动/更新”。</p>${(x.compose_files||[]).map(path=>`<button class="secondary-button" data-open-compose-file="${escapeHTML(path)}">${icon('file',17)}${escapeHTML(path)}</button>`).join('')||'<span>未读取到 Compose 文件路径</span>'}</div>`}
    else{
      const networks=(state.dockerNetworks?.networks||[]).map(network=>network.name).filter(name=>!['host','none'].includes(name)),networkOptions=[...new Set(['default','bridge','host','none',...networks,x.network_mode].filter(Boolean))]
      body=`<form id="docker-edit-form" class="docker-edit-form visual-docker-editor"><section class="editor-section"><div class="editor-section-title"><div><strong>基础设置</strong><span>名称、镜像和自动重启</span></div></div><div class="form-grid"><label>容器名称<input name="name" value="${escapeHTML(x.name)}" required></label><label>镜像<input name="image" value="${escapeHTML(x.image)}" required></label><label>重启策略<select name="restart_policy"><option value="no" ${x.restart_policy==='no'?'selected':''}>不自动重启</option><option value="unless-stopped" ${x.restart_policy==='unless-stopped'?'selected':''}>除非手动停止</option><option value="always" ${x.restart_policy==='always'?'selected':''}>始终重启</option><option value="on-failure" ${x.restart_policy==='on-failure'?'selected':''}>失败时重启</option></select></label><label>失败最大重试<input name="restart_maximum_retry_count" type="number" min="0" value="${x.restart_maximum_retry_count||0}"></label><label>主机名<input name="hostname" value="${escapeHTML(x.hostname||'')}" placeholder="通常留空"></label><label>容器用户<input name="user" value="${escapeHTML(x.user||'')}" placeholder="例如 1000:1000"></label><label class="wide-field">工作目录<input name="working_dir" value="${escapeHTML(x.working_dir||'')}" placeholder="例如 /app"></label></div></section><section class="editor-section"><div class="editor-section-title"><div><strong>环境变量</strong><span>每行拆成清晰的名称和值</span></div><button type="button" class="secondary-button compact" data-add-docker-row="env">${icon('plus',15)}添加</button></div><div id="docker-env-rows" class="visual-row-list">${(x.env||[]).map(dockerEnvRow).join('')||dockerEnvRow()}</div></section><section class="editor-section"><div class="editor-section-title"><div><strong>端口映射</strong><span>主机端口 → 容器端口</span></div><button type="button" class="secondary-button compact" data-add-docker-row="port">${icon('plus',15)}添加</button></div><div id="docker-port-rows" class="visual-row-list">${(x.ports||[]).map(dockerPortRow).join('')||dockerPortRow()}</div></section><section class="editor-section"><div class="editor-section-title"><div><strong>目录与存储卷</strong><span>选择主机目录或 Docker 卷</span></div><button type="button" class="secondary-button compact" data-add-docker-row="mount">${icon('plus',15)}添加</button></div><div id="docker-mount-rows" class="visual-row-list">${(x.mounts||[]).map(dockerMountRow).join('')||dockerMountRow()}</div></section><details class="editor-section advanced-section"><summary>高级设置</summary><div class="form-grid"><label>网络模式<select name="network_mode">${networkOptions.map(name=>`<option value="${escapeHTML(name)}" ${name===(x.network_mode||'default')?'selected':''}>${escapeHTML(name==='default'?'默认网络':name)}</option>`).join('')}</select></label><label class="toggle-field"><input name="privileged" type="checkbox" ${x.privileged?'checked':''}><span><strong>特权模式</strong><small>仅在明确需要访问宿主硬件时开启</small></span></label><label class="wide-field">启动命令参数（每行一个）<textarea name="cmd" rows="4">${escapeHTML((x.cmd||[]).join('\n'))}</textarea></label><label class="wide-field">Entrypoint（每行一个）<textarea name="entrypoint" rows="4">${escapeHTML((x.entrypoint||[]).join('\n'))}</textarea></label></div></details><label class="checkbox-row"><input name="start" type="checkbox" ${x.running?'checked':''}><span>保存后启动新容器</span></label><div class="release-warning">${icon('shield',17)}保存时会先备份旧容器。新容器创建或启动失败会自动回滚。</div><button class="primary-button" type="submit">保存并安全重建</button></form>`
    }
  }else if(m.kind==='compose-config'){
    const config=m.config||{},files=config.files||[]
    body=`<form id="compose-config-form" class="compose-config-editor"><div class="release-warning">${icon('shield',17)}保存前会创建快照并执行 <code>docker compose config -q</code>。验证失败自动恢复原文件。</div>${files.map((file,index)=>`<section class="compose-file-editor"><div><strong>${escapeHTML(file.path)}</strong><span>${formatBytes(file.size)}</span></div><textarea name="compose_${index}" data-compose-path="${escapeHTML(file.path)}" spellcheck="false">${escapeHTML(file.content)}</textarea></section>`).join('')}<label class="checkbox-row"><input name="deploy" type="checkbox"><span>验证通过后立即执行启动/更新</span></label><button class="primary-button" type="submit">保存并验证</button></form>`
  }else if(m.kind==='image-build'){
    body=`<form id="image-build-form" class="dialog-form"><label>构建上下文目录<input name="context_dir" placeholder="例如 /opt/myapp" required></label><label>Dockerfile<input name="dockerfile" value="Dockerfile" required></label><label>镜像标签<input name="tag" placeholder="例如 myapp:latest" required></label><label class="checkbox-row"><input name="pull" type="checkbox" checked><span>构建前拉取更新的基础镜像</span></label><label class="checkbox-row"><input name="no_cache" type="checkbox"><span>不使用构建缓存</span></label><button class="primary-button" type="submit">开始构建</button></form>`
  }else if(m.kind==='file-preview'){
    const preview=m.preview||{},url=`/api/v1/files/preview/raw?path=${encodeURIComponent(preview.path||'')}`
    body=preview.kind==='image'?`<div class="media-preview"><img src="${url}" alt="${escapeHTML(preview.name||'图片')}"></div>`:`<iframe class="pdf-preview" src="${url}" title="${escapeHTML(preview.name||'PDF')}"></iframe>`
    footer=`<footer><a class="secondary-button compact" href="/api/v1/files/download?path=${encodeURIComponent(preview.path||'')}">${icon('download',16)}下载</a><button class="primary-button compact" id="modal-done">完成</button></footer>`
  }else if(m.kind==='archive-list'){
    const list=m.list||{}
    body=`<div class="archive-list">${(list.entries||[]).map(entry=>`<div><span>${icon(entry.is_dir?'folder':'file',17)}${escapeHTML(entry.name)}</span><small>${entry.is_dir?'文件夹':formatBytes(entry.size)}</small></div>`).join('')||'<div class="empty-list">压缩包为空</div>'}${list.limited?'<div class="alert warning">内容较多，仅显示前一部分。</div>':''}</div>`
    footer=`<footer><a class="secondary-button compact" href="/api/v1/files/download?path=${encodeURIComponent(m.preview?.path||'')}">${icon('download',16)}下载</a><button class="primary-button compact" id="modal-done">完成</button></footer>`
  }else if(m.kind==='file-search-results'){
    const result=m.result||{}
    body=`<div class="file-search-results">${(result.entries||[]).map(item=>`<button data-search-result="${escapeHTML(item.path)}" data-directory="${item.is_dir}">${icon(item.is_dir?'folder':'file',19)}<span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.path)}</small></span></button>`).join('')||'<div class="empty-list">没有找到匹配内容</div>'}${result.limited?'<div class="alert warning">搜索结果已限制，请使用更具体的关键词。</div>':''}</div>`
  }else if(m.kind==='elevation')body=`<form id="elevation-form" class="elevation-form"><div class="elevation-icon">${icon('shield',24)}</div><p>此操作会修改服务器状态，请输入当前登录密码继续。</p><label>当前密码<input id="elevation-password" name="password" type="password" autocomplete="current-password" ${passwordInputAttributes()} required></label><div id="elevation-error" class="form-error" hidden></div><button class="primary-button" type="submit">验证并继续</button><button class="secondary-button" type="button" id="elevation-cancel">取消</button></form>`
  else if(m.kind==='process')body=`<div class="process-dialog"><p>${escapeHTML(m.content)}</p><code>PID ${m.pid}</code><button class="secondary-button" id="process-term">正常结束 SIGTERM</button><button class="danger-button" id="process-kill">强制结束 SIGKILL</button></div>`
  return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal-card ${['editor','logs','docker-edit','file-diff','file-backups','docker-cleanup','task-create','ssh-generated-key','compose-config','file-preview','archive-list','file-search-results'].includes(m.kind)?'wide':''}"><header><div><strong>${escapeHTML(m.title)}</strong>${m.path?`<small>${escapeHTML(m.path)}</small>`:''}</div><button id="modal-close">${icon('close',20)}</button></header><div class="modal-body">${body}</div>${footer}</section></div>`
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
  document.querySelector('#refresh-timers')?.addEventListener('click',loadTasks)
  document.querySelector('#create-task')?.addEventListener('click',()=>{state.modal={title:'新建计划任务',kind:'task-create'};render()})
  document.querySelectorAll('[data-task-action]').forEach(button=>button.onclick=()=>taskAction(button.dataset.taskId,button.dataset.taskAction))
  document.querySelector('#refresh-updates')?.addEventListener('click',loadUpdates)
  const aptSearchForm=document.querySelector('#apt-search-form');if(aptSearchForm)aptSearchForm.onsubmit=event=>{event.preventDefault();aptSearch(String(new FormData(aptSearchForm).get('q')||''))}
  document.querySelector('#apt-download')?.addEventListener('click',()=>aptAction('download'))
  document.querySelector('#apt-upgrade')?.addEventListener('click',()=>aptAction('upgrade'))
  document.querySelectorAll('[data-apt-package]').forEach(button=>button.onclick=()=>aptAction(button.dataset.aptAction,[button.dataset.aptPackage]))
  document.querySelector('#refresh-host')?.addEventListener('click',loadHostSettings)
  const hostBasicForm=document.querySelector('#host-basic-form');if(hostBasicForm)hostBasicForm.onsubmit=async event=>{event.preventDefault();const f=new FormData(hostBasicForm);await hostMutation('hostname',{hostname:f.get('hostname')});await hostMutation('timezone',{timezone:f.get('timezone')})}
  const hostDNSForm=document.querySelector('#host-dns-form');if(hostDNSForm)hostDNSForm.onsubmit=event=>{event.preventDefault();const servers=String(new FormData(hostDNSForm).get('dns')||'').split(/\s+/).filter(Boolean);hostMutation('dns',{servers})}
  const hostSwapForm=document.querySelector('#host-swap-form');if(hostSwapForm)hostSwapForm.onsubmit=event=>{event.preventDefault();hostMutation('swap',{size_mb:Number(new FormData(hostSwapForm).get('size_mb'))})}
  document.querySelector('#host-swap-delete')?.addEventListener('click',async()=>{if(await askConfirm('确认删除 LukePanel 管理的 Swap 文件？',{title:'删除 Swap',confirmText:'确认删除',danger:true}))hostMutation('swap',null,'DELETE')})
  document.querySelectorAll('[data-sysctl-preset]').forEach(button=>button.onclick=()=>hostMutation('sysctl',{preset:button.dataset.sysctlPreset}))
  document.querySelector('#refresh-snapshots')?.addEventListener('click',loadSnapshots)
  document.querySelector('#panel-backup-export')?.addEventListener('click',()=>exportPanelBackup().catch(error=>showError(error.message)))
  document.querySelector('#panel-backup-import')?.addEventListener('submit',event=>{event.preventDefault();importPanelBackup(new FormData(event.currentTarget).get('file')).catch(error=>showError(error.message))})
  document.querySelectorAll('[data-snapshot-action]').forEach(button=>button.onclick=()=>snapshotAction(button.dataset.snapshotId,button.dataset.snapshotAction))

  document.querySelector('#refresh-docker')?.addEventListener('click',loadDocker)
  document.querySelector('#install-docker')?.addEventListener('click',installDocker)
  document.querySelector('#pull-image')?.addEventListener('click',pullImage)
  document.querySelector('#build-image')?.addEventListener('click',()=>{state.modal={title:'构建 Docker 镜像',kind:'image-build'};render()})
  document.querySelector('#docker-cleanup')?.addEventListener('click',openDockerCleanup)
  document.querySelector('#create-network')?.addEventListener('click',()=>{state.modal={title:'新建 Docker 网络',kind:'docker-network'};render()})
  document.querySelector('#create-volume')?.addEventListener('click',()=>{state.modal={title:'新建 Docker 存储卷',kind:'docker-volume'};render()})
  document.querySelectorAll('[data-docker-tab]').forEach(b=>b.onclick=()=>{state.dockerTab=b.dataset.dockerTab;render()})
  document.querySelectorAll('[data-compose-action]').forEach(b=>b.onclick=()=>composeAction(b.dataset.project,b.dataset.composeAction))
  document.querySelectorAll('[data-compose-config]').forEach(b=>b.onclick=()=>openComposeConfig(b.dataset.composeConfig))
  document.querySelectorAll('[data-image-delete]').forEach(b=>b.onclick=()=>deleteDockerResource('image',b.dataset.imageDelete,imageName((state.dockerImages?.images||[]).find(i=>i.id===b.dataset.imageDelete)||{id:b.dataset.imageDelete})))
  document.querySelectorAll('[data-network-delete]').forEach(b=>b.onclick=()=>deleteDockerResource('network',b.dataset.networkDelete,b.dataset.name))
  document.querySelectorAll('[data-volume-delete]').forEach(b=>b.onclick=()=>deleteDockerResource('volume',b.dataset.volumeDelete))
  document.querySelectorAll('[data-docker-action]').forEach(b=>b.onclick=()=>dockerAction(b.dataset.id,b.dataset.dockerAction))
  document.querySelectorAll('[data-docker-logs]').forEach(b=>b.onclick=()=>showDockerLogs(b.dataset.dockerLogs,b.dataset.title))
  document.querySelectorAll('[data-docker-edit]').forEach(b=>b.onclick=()=>openDockerEditor(b.dataset.dockerEdit,b.dataset.title))
  document.querySelectorAll('[data-add-docker-row]').forEach(button=>button.onclick=()=>addDockerVisualRow(button.dataset.addDockerRow))
  document.querySelectorAll('[data-remove-docker-row]').forEach(button=>button.onclick=()=>button.closest('.visual-row')?.remove())

  document.querySelectorAll('[data-file-view]').forEach(button=>button.onclick=()=>{state.fileView=button.dataset.fileView;if(state.fileView==='recycle'&&!state.recycle)loadRecycle();else render()})
  document.querySelector('#file-back')?.addEventListener('click',()=>state.files?.parent&&loadFiles(state.files.parent))
  document.querySelector('#file-home')?.addEventListener('click',()=>loadFiles('/'))
  document.querySelectorAll('[data-file-jump]').forEach(button=>button.onclick=()=>loadFiles(button.dataset.fileJump))
  document.querySelector('#refresh-files')?.addEventListener('click',()=>loadFiles(state.files?.path||'/'))
  document.querySelector('#global-file-search')?.addEventListener('click',globalFileSearch)
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
  document.querySelector('#run-diagnostic')?.addEventListener('click',runDiagnostic)
  document.querySelector('#copy-tool-result')?.addEventListener('click',()=>copyText(document.querySelector('#tool-result pre')?.textContent||'','诊断结果已复制'))
  document.querySelector('#github-helper-install')?.addEventListener('click',()=>{if(localStorage.getItem('github-helper-v07')!=='1'){localStorage.removeItem('github-owner');localStorage.removeItem('github-repo');localStorage.removeItem('github-branch');localStorage.setItem('github-helper-v07','1')}localStorage.setItem('github-helper-enabled','1');showToast('GitHub 助手入口已显示');render()})
  document.querySelector('#github-helper-remove')?.addEventListener('click',async()=>{if(!await askConfirm('隐藏入口不会删除授权，也不会修改任何 GitHub 仓库。',{title:'隐藏 GitHub 助手入口',confirmText:'隐藏入口'}))return;localStorage.removeItem('github-helper-enabled');state.github=null;state.githubAuth=null;if(location.pathname==='/github')navigate('/tools');else render()})

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
  const sshSettingsForm=document.querySelector('#ssh-settings-form');if(sshSettingsForm)sshSettingsForm.onsubmit=async event=>{event.preventDefault();const f=new FormData(sshSettingsForm);try{const result=await secureApi('/api/v1/ssh/settings',{method:'POST',body:jsonBody({port:Number(f.get('port')),permit_root_login:f.get('permit_root_login'),allow_tcp_forwarding:f.get('allow_tcp_forwarding')==='on',allow_agent_forwarding:f.get('allow_agent_forwarding')==='on',x11_forwarding:f.get('x11_forwarding')==='on'})});showToast(result.message||'SSH 设置已应用');await loadSSH(state.sshUser)}catch(error){await showError(error.message)}}
  document.querySelector('#ssh-port-keep-new')?.addEventListener('click',()=>confirmSSHPort(true))
  document.querySelector('#ssh-port-revert')?.addEventListener('click',()=>confirmSSHPort(false))
  document.querySelector('#ssh-user')?.addEventListener('change',event=>loadSSH(event.target.value))
  const sshForm=document.querySelector('#ssh-key-form');if(sshForm)sshForm.onsubmit=event=>{event.preventDefault();addSSHKey(sshForm)}
  document.querySelectorAll('[data-ssh-key-delete]').forEach(button=>button.onclick=()=>deleteSSHKey(button.dataset.sshKeyDelete))
  document.querySelector('#ssh-disable-password')?.addEventListener('click',()=>toggleSSHPassword(false))
  document.querySelector('#ssh-enable-password')?.addEventListener('click',()=>toggleSSHPassword(true))
  document.querySelector('#ssh-generate-key')?.addEventListener('click',openSSHKeyGenerator)

  const githubRepoForm=document.querySelector('#github-repo-form');if(githubRepoForm)githubRepoForm.onsubmit=event=>{event.preventDefault();const f=new FormData(githubRepoForm);loadGitHub(String(f.get('owner')).trim(),String(f.get('repo')).trim())}
  const githubConnectForm=document.querySelector('#github-connect-form');if(githubConnectForm)githubConnectForm.onsubmit=event=>{event.preventDefault();startGitHubDeviceFlow(githubConnectForm)}
  document.querySelector('#github-disconnect')?.addEventListener('click',disconnectGitHub)
  document.querySelector('#copy-github-code')?.addEventListener('click',()=>copyText(state.githubFlow?.user_code||'','授权代码已复制'))
  const githubImportForm=document.querySelector('#github-import-form');if(githubImportForm)githubImportForm.onsubmit=event=>{event.preventDefault();previewGitHubImport(githubImportForm)}
  const githubImportCommitForm=document.querySelector('#github-import-commit-form');if(githubImportCommitForm)githubImportCommitForm.onsubmit=event=>{event.preventDefault();commitGitHubImport(githubImportCommitForm)}
  const githubTagForm=document.querySelector('#github-tag-form');if(githubTagForm)githubTagForm.onsubmit=event=>{event.preventDefault();createGitHubTag(githubTagForm)}
  const githubBranchForm=document.querySelector('#github-branch-form');if(githubBranchForm)githubBranchForm.onsubmit=event=>{event.preventDefault();createGitHubBranch(githubBranchForm)}
  const githubPRForm=document.querySelector('#github-pr-form');if(githubPRForm)githubPRForm.onsubmit=event=>{event.preventDefault();createGitHubPullRequest(githubPRForm)}
  const githubReleaseForm=document.querySelector('#github-release-form');if(githubReleaseForm)githubReleaseForm.onsubmit=event=>{event.preventDefault();createGitHubRelease(githubReleaseForm)}
  document.querySelectorAll('[data-github-rerun]').forEach(button=>button.onclick=()=>rerunGitHubAction(button.dataset.githubRerun))

  document.querySelector('#refresh-security')?.addEventListener('click',loadSecurity)
  document.querySelector('#install-fail2ban')?.addEventListener('click',installFail2Ban)
  document.querySelector('#enable-auto-updates')?.addEventListener('click',enableAutomaticUpdates)
  const usernameForm=document.querySelector('#username-form');if(usernameForm)usernameForm.onsubmit=event=>{event.preventDefault();changeUsername(usernameForm)}
  document.querySelector('#new-password')?.addEventListener('input',updatePasswordStrength)
  document.querySelector('#confirm-password')?.addEventListener('input',updatePasswordStrength)
  const interval=document.querySelector('#refresh-interval');if(interval){interval.value=String(state.settings?.auto_refresh_seconds||5);interval.onchange=async()=>{try{await api('/api/v1/settings',{method:'PATCH',body:jsonBody({auto_refresh_seconds:Number(interval.value)})});state.settings.auto_refresh_seconds=Number(interval.value);syncOverviewUpdates();showToast('刷新策略已保存')}catch(e){await showError(e.message)}}}
  document.querySelector('#revoke-sessions')?.addEventListener('click',async()=>{if(!await askConfirm('当前设备会继续登录，其他设备会立即失效。',{title:'退出其他设备',confirmText:'确认退出'}))return;try{const r=await api('/api/v1/auth/sessions',{method:'DELETE'});showToast(`已退出 ${r.revoked} 个会话`);await loadSecurity()}catch(e){await showError(e.message)}})
  document.querySelector('#totp-enable')?.addEventListener('click',startTOTPSetup)
  document.querySelector('#totp-disable')?.addEventListener('click',disableTOTP)
  document.querySelector('#totp-regenerate')?.addEventListener('click',regenerateRecoveryCodes)
  const passwordForm=document.querySelector('#password-form');if(passwordForm){updatePasswordStrength();passwordForm.onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),message=document.querySelector('#password-message'),button=e.currentTarget.querySelector('button[type=submit]'),next=String(f.get('next')||''),confirmValue=String(f.get('confirm')||''),assessment=passwordAssessment(next,state.settings?.admin_user||state.username);message.hidden=true;if(next!==confirmValue){message.textContent='两次输入的新密码不一致';message.hidden=false;return}if(!assessment.ok){message.textContent='新密码仍不符合强度要求';message.hidden=false;return}button.disabled=true;button.textContent='正在保存…';try{await api('/api/v1/auth/password',{method:'POST',body:jsonBody({current_password:f.get('current'),new_password:next})});message.className='form-success';message.textContent='密码已更新，其他设备已退出';message.hidden=false;e.currentTarget.reset();updatePasswordStrength()}catch(err){message.className='form-error';message.textContent=err.message;message.hidden=false}finally{button.disabled=false;button.textContent='保存新密码';updatePasswordStrength()}}}

  document.querySelector('#choose-files-upload')?.addEventListener('click',()=>{state.modal=null;render();document.querySelector('#upload-input')?.click()})
  document.querySelector('#choose-folder-upload')?.addEventListener('click',()=>{state.modal=null;render();document.querySelector('#upload-folder-input')?.click()})
  document.querySelector('#choose-zip-extract')?.addEventListener('click',()=>{state.modal=null;render();document.querySelector('#upload-zip-input')?.click()})
  const composeConfigForm=document.querySelector('#compose-config-form');if(composeConfigForm)composeConfigForm.onsubmit=event=>{event.preventDefault();saveComposeConfig(composeConfigForm)}
  const imageBuildForm=document.querySelector('#image-build-form');if(imageBuildForm)imageBuildForm.onsubmit=event=>{event.preventDefault();buildDockerImage(imageBuildForm)}
  document.querySelectorAll('[data-search-result]').forEach(button=>button.onclick=()=>{const path=button.dataset.searchResult,isDir=button.dataset.directory==='true';state.modal=null;if(isDir)loadFiles(path);else openFile(path)})
  document.querySelector('#docker-edit-form')?.addEventListener('submit',event=>{event.preventDefault();submitDockerEdit()})
  const sshKeyGenerateForm=document.querySelector('#ssh-key-generate-form');if(sshKeyGenerateForm)sshKeyGenerateForm.onsubmit=event=>{event.preventDefault();generateSSHKey(sshKeyGenerateForm)}
  document.querySelector('#docker-cleanup-form')?.addEventListener('submit',event=>{event.preventDefault();submitDockerCleanup(event.currentTarget)})
  document.querySelector('#docker-network-form')?.addEventListener('submit',event=>{event.preventDefault();createDockerNetwork(event.currentTarget)})
  document.querySelector('#docker-volume-form')?.addEventListener('submit',event=>{event.preventDefault();createDockerVolume(event.currentTarget)})
  const taskForm=document.querySelector('#task-create-form');if(taskForm){taskForm.onsubmit=event=>{event.preventDefault();createTask(taskForm)};const type=taskForm.querySelector('#task-type'),frequency=taskForm.querySelector('#task-frequency'),syncTaskForm=()=>{const target=taskForm.querySelector('#task-target-label'),weekday=taskForm.querySelector('#task-weekday-label'),hour=taskForm.querySelector('[name=hour]');target.hidden=['docker-cleanup-safe','panel-backup'].includes(type.value);target.querySelector('input').required=!target.hidden;weekday.hidden=frequency.value!=='weekly';hour.closest('label').hidden=frequency.value==='hourly'};type.onchange=syncTaskForm;frequency.onchange=syncTaskForm;syncTaskForm()}
  const totpSetupForm=document.querySelector('#totp-setup-form');if(totpSetupForm)totpSetupForm.onsubmit=event=>{event.preventDefault();confirmTOTPSetup(totpSetupForm)}
  document.querySelectorAll('[data-open-compose-file]').forEach(button=>button.onclick=()=>{state.modal=null;navigate('/files');setTimeout(()=>openFile(button.dataset.openComposeFile),50)})
  document.querySelector('#process-term')?.addEventListener('click',()=>signalProcess(state.modal.pid,'term'))
  document.querySelector('#process-kill')?.addEventListener('click',()=>signalProcess(state.modal.pid,'kill'))
  const elevationForm=document.querySelector('#elevation-form');if(elevationForm)elevationForm.onsubmit=async event=>{event.preventDefault();const password=String(new FormData(elevationForm).get('password')||''),button=elevationForm.querySelector('button[type=submit]'),error=document.querySelector('#elevation-error');button.disabled=true;button.textContent='正在验证…';error.hidden=true;try{await api('/api/v1/auth/elevate',{method:'POST',body:jsonBody({password})});const pending=pendingElevation;pendingElevation=null;state.modal=null;render();pending?.resolve(true)}catch(err){error.textContent=err.message;error.hidden=false;button.disabled=false;button.textContent='验证并继续';document.querySelector('#elevation-password')?.focus()}}
  document.querySelector('#elevation-cancel')?.addEventListener('click',closeModal)
  document.querySelector('#modal-close')?.addEventListener('click',closeModal)
  document.querySelector('#modal-done')?.addEventListener('click',closeModal)
  document.querySelector('#modal-backdrop')?.addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeModal()})
  document.querySelector('#copy-modal-log')?.addEventListener('click',()=>copyText(state.modal?.content||'','日志已复制'))
  document.querySelectorAll('[data-file-action]').forEach(button=>button.onclick=async()=>{
    const action=button.dataset.fileAction,item=state.modal?.item;if(!item)return
    if(action==='copy-path'){copyText(item.path,'路径已复制');return}
    if(action==='download'){await downloadManagedFile(item.path);return}
    if(action==='history'){loadFileBackups(item.path);return}
    if(action==='archive'){createArchive(item);return}
    fileMutation(action,item)
  })
  document.querySelector('#file-editor')?.addEventListener('input',()=>{if(state.modal)state.modal.dirty=true})
  document.querySelector('#save-file')?.addEventListener('click',saveFile)
  document.querySelector('#copy-file-path')?.addEventListener('click',()=>copyText(state.modal?.path||'','路径已复制'))
  document.querySelector('#copy-file-content')?.addEventListener('click',()=>copyText(document.querySelector('#file-editor')?.value||'','内容已复制'))
  document.querySelector('#download-file')?.addEventListener('click',()=>downloadManagedFile(state.modal.path).catch(error=>showError(error.message)))
  document.querySelector('#file-history')?.addEventListener('click',()=>loadFileBackups(state.modal.path))
  document.querySelectorAll('[data-backup-diff]').forEach(button=>button.onclick=()=>showFileBackupDiff(state.modal.path,button.dataset.backupDiff))
  document.querySelectorAll('[data-backup-restore]').forEach(button=>button.onclick=()=>restoreFileBackup(state.modal.path,button.dataset.backupRestore))
  document.querySelector('#back-to-backups')?.addEventListener('click',()=>loadFileBackups(state.modal.path))
  document.querySelector('#download-recovery-codes')?.addEventListener('click',()=>downloadText('lukepanel-recovery-codes.txt',(state.modal?.codes||[]).join('\n')))
  document.querySelector('#download-generated-private-key')?.addEventListener('click',()=>{const key=state.modal?.key||{};downloadText(key.filename||'id_ed25519',key.private_key||'','application/octet-stream')})
  document.querySelector('#copy-generated-public-key')?.addEventListener('click',()=>copyText(state.modal?.key?.public_key||'','公钥已复制'))
  document.querySelector('#rename-file')?.addEventListener('click',()=>fileMutation('rename',{path:state.modal.path,is_dir:false,mode:state.fileContent?.mode}))
  document.querySelector('#delete-file')?.addEventListener('click',()=>fileMutation('delete',{path:state.modal.path,is_dir:false,mode:state.fileContent?.mode}))
}

async function closeModal(){
  if(state.modal?.dirty&&!await askConfirm('当前编辑内容还没有保存。',{title:'放弃未保存的修改',confirmText:'放弃修改',danger:true}))return
  if(state.modal?.kind==='elevation'&&pendingElevation){const pending=pendingElevation;pendingElevation=null;pending.reject(new Error('操作已取消'))}
  state.modal=null;render()
}
async function performLogout(){
  if(!await askConfirm('退出后需要重新输入密码登录。',{title:'退出当前账号',confirmText:'退出登录'}))return
  try{await api('/api/v1/auth/logout',{method:'POST'})}catch{}
  state.authenticated=false;state.csrf='';state.sessionID='';stopOverviewUpdates();syncDockerStats();history.replaceState({},'','/login');render()
}
function setBusy(value){document.body.classList.toggle('busy',value)}

function render(){
  if(!state.authenticated){if(location.pathname!='/login')history.replaceState({},'','/login');renderLogin();return}
  if(location.pathname==='/login'){const target=rememberedRoute('/');history.replaceState({},'',target)}
  const routes={'/':dashboard,'/system':systemPage,'/services':servicesPage,'/processes':processesPage,'/network':networkPage,'/storage':storagePage,'/tasks':tasksPage,'/updates':updatesPage,'/host':hostPage,'/snapshots':snapshotsPage,'/files':filesPage,'/docker':dockerPage,'/tools':toolsPage,'/github':githubPage,'/ssh':sshPage,'/audit':auditPage,'/security':securityPage}
  if(!routes[location.pathname])history.replaceState({},'','/')
  rememberRoute(location.pathname)
  app.innerHTML=shell((routes[location.pathname]||routes['/'])());bindShell();syncOverviewUpdates();syncDockerStats();syncSystemLogPolling()
}

// v0.9 feature-complete integration layer.
function v09InsertBeforePageEnd(html, section){const index=html.lastIndexOf('</div>');return index>=0?html.slice(0,index)+section+html.slice(index):html+section}
function b64urlToBytes(value){const text=String(value||'').replace(/-/g,'+').replace(/_/g,'/');const padded=text+'='.repeat((4-text.length%4)%4);const binary=atob(padded);return Uint8Array.from(binary,c=>c.charCodeAt(0))}
function bytesToB64url(value){const bytes=value instanceof ArrayBuffer?new Uint8Array(value):new Uint8Array(value||[]);let binary='';bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function passkeyAvailable(){return !!(window.PublicKeyCredential&&navigator.credentials)}
function serializeAssertion(credential){return {id:credential.id,raw_id:bytesToB64url(credential.rawId),response:{client_data_json:bytesToB64url(credential.response.clientDataJSON),authenticator_data:bytesToB64url(credential.response.authenticatorData),signature:bytesToB64url(credential.response.signature),user_handle:credential.response.userHandle?bytesToB64url(credential.response.userHandle):''}}}
function serializeCreation(credential){return {id:credential.id,raw_id:bytesToB64url(credential.rawId),response:{client_data_json:bytesToB64url(credential.response.clientDataJSON),attestation_object:bytesToB64url(credential.response.attestationObject)}}}

const v09LoadDocker=loadDocker
loadDocker=async function(){await v09LoadDocker();if(!state.dockerStatus?.available)return;try{const [usage]=await Promise.all([api('/api/v1/docker/volumes/usage')]);state.dockerVolumeUsage=usage}catch{}if(location.pathname==='/docker')render()}
const v09DockerPage=dockerPage
dockerPage=function(){let html=v09DockerPage();if(!state.dockerStatus?.available)return html;let extra='';if(state.dockerTab==='images'){extra=`<section class="surface feature-panel"><div class="section-heading"><div><h2>Docker Hub 镜像搜索</h2><p>搜索公开镜像并一键填入拉取操作</p></div></div><form id="docker-hub-search-form" class="inline-form"><input name="query" value="${escapeHTML(state.dockerHubQuery)}" placeholder="例如 nginx、adguardhome" required><button class="primary-button" type="submit">搜索</button></form>${state.dockerHubResults?`<div class="hub-results">${(state.dockerHubResults.repositories||[]).map(item=>`<article><div><strong>${item.official?'✓ 官方 · ':''}${escapeHTML(item.namespace?item.namespace+'/'+item.name:item.name)}</strong><p>${escapeHTML(item.description||'暂无说明')}</p><small>★ ${item.stars||0} · 拉取 ${Number(item.pulls||0).toLocaleString()}</small></div><button class="secondary-button compact" data-hub-pull="${escapeHTML(item.namespace?item.namespace+'/'+item.name:item.name)}">拉取</button></article>`).join('')||'<div class="empty-list">没有匹配镜像</div>'}</div>`:''}</section>`}else if(state.dockerTab==='volumes'){const usage=new Map((state.dockerVolumeUsage?.volumes||[]).map(item=>[item.name,item]));extra=`<section class="surface feature-panel"><div class="section-heading"><div><h2>存储卷占用</h2><p>按 Docker Engine 实际统计，引用为 0 的卷才适合清理</p></div><button id="refresh-volume-usage" class="secondary-button compact">重新扫描</button></div><div class="compact-list">${(state.dockerVolumes?.volumes||[]).map(v=>{const item=usage.get(v.name)||{};return `<div><strong>${escapeHTML(v.name)}</strong><span>${formatBytes(item.size||0)} · ${item.ref_count??'未知'} 个引用</span></div>`}).join('')||'<div class="empty-list">暂无存储卷</div>'}</div></section>`}else if(state.dockerTab==='compose'){extra=`<section class="surface feature-panel"><div class="section-heading"><div><h2>Compose 新建向导</h2><p>无需手写完整 YAML，先创建一个可运行项目，再进入编辑器细化</p></div></div><form id="compose-wizard-form" class="dialog-form"><div class="form-grid"><label>项目名称<input name="project" placeholder="例如 my-app" required></label><label>项目目录<input name="directory" placeholder="例如 /opt/my-app" required></label><label>服务名称<input name="service_name" value="app" required></label><label>镜像<input name="image" placeholder="例如 nginx:alpine" required></label><label>容器名称<input name="container_name" placeholder="可选"></label><label>重启策略<select name="restart"><option value="unless-stopped">除非手动停止</option><option value="always">始终重启</option><option value="no">不自动重启</option></select></label></div><label>端口映射（每行一个）<textarea name="ports" rows="3" placeholder="8080:80"></textarea></label><label>环境变量（每行一个）<textarea name="environment" rows="3" placeholder="TZ=Asia/Shanghai"></textarea></label><label>挂载（每行一个）<textarea name="volumes" rows="3" placeholder="./data:/data"></textarea></label><label class="checkbox-row"><input name="start" type="checkbox" checked><span>创建后立即启动</span></label><button class="primary-button" type="submit">创建 Compose 项目</button></form></section>`}return v09InsertBeforePageEnd(html,extra)}

const v09LoadFiles=loadFiles
loadFiles=async function(path='/'){await v09LoadFiles(path);try{state.filePreferences=await api('/api/v1/files/preferences')}catch{}if(location.pathname==='/files')render()}
const v09FilesPage=filesPage
filesPage=function(){let html=v09FilesPage();if(state.fileView!=='files')return html;const prefs=state.filePreferences||{favorites:[],recent:[]},current=state.files?.path||'/';const favorite=(prefs.favorites||[]).some(item=>item.path===current);const section=`<section class="surface file-shortcuts"><div class="section-heading"><div><h2>快捷访问</h2><p>收藏目录与最近操作只保存在本机面板</p></div><button class="secondary-button compact" id="toggle-current-favorite" data-enabled="${favorite}">${favorite?'取消收藏':'收藏当前目录'}</button></div><div class="shortcut-columns"><div><h3>收藏</h3>${(prefs.favorites||[]).map(item=>`<button class="shortcut-item" data-file-shortcut="${escapeHTML(item.path)}" data-dir="${item.is_dir}">${icon(item.is_dir?'folder':'file',17)}<span>${escapeHTML(item.name||item.path)}</span></button>`).join('')||'<p class="muted-text">暂无收藏</p>'}</div><div><h3>最近访问</h3>${(prefs.recent||[]).slice(0,8).map(item=>`<button class="shortcut-item" data-file-shortcut="${escapeHTML(item.path)}" data-dir="${item.is_dir}">${icon(item.is_dir?'folder':'file',17)}<span>${escapeHTML(item.name||item.path)}</span><small>${formatDate(item.last_access)}</small></button>`).join('')||'<p class="muted-text">暂无记录</p>'}</div></div></section>`;return v09InsertBeforePageEnd(html,section)}

const v09LoadUpdates=loadUpdates
loadUpdates=async function(){await v09LoadUpdates();try{state.aptSources=await api('/api/v1/system/apt/sources')}catch{}if(location.pathname==='/updates')render()}
function aptSourceView(source){
  const content=String(source?.content||'').trim()
  const firstLine=content.split('\n').map(line=>line.trim()).find(line=>line&&!line.startsWith('#'))||'空配置'
  const url=(firstLine.match(/https?:\/\/[^\s\]]+/i)||[])[0]||''
  let host='未识别地址'
  try{if(url)host=new URL(url).hostname}catch{}
  const lower=host.toLowerCase()
  let provider='第三方软件源',kind='generic'
  if(lower==='deb.debian.org'||lower.endsWith('.debian.org')){provider='Debian 官方源';kind='debian'}
  else if(lower.endsWith('.ubuntu.com')){provider='Ubuntu 官方源';kind='ubuntu'}
  else if(lower.includes('docker.com')){provider='Docker 官方源';kind='docker'}
  else if(lower.includes('microsoft.com')){provider='Microsoft 软件源';kind='microsoft'}
  else if(lower.includes('nodesource.com')){provider='NodeSource 软件源';kind='node'}
  else if(source?.name==='sources.list'){provider='系统主软件源';kind='system'}
  return {content:firstLine,host,provider,kind}
}
function aptSourceCard(source){
  const view=aptSourceView(source),deletable=source.path!='/etc/apt/sources.list'
  return `<article class="apt-source-card"><div class="apt-source-card__head"><div class="apt-source-card__identity"><span class="apt-source-icon ${escapeHTML(view.kind)}">${icon(view.kind==='docker'?'container':'package',18)}</span><div><strong>${escapeHTML(view.provider)}</strong><small>${escapeHTML(source.name||'未命名软件源')}</small></div></div><span class="apt-source-state ${source.enabled?'enabled':'disabled'}"><i></i>${source.enabled?'已启用':'已停用'}</span></div><div class="apt-source-card__meta"><code>${escapeHTML(view.host)}</code><span>${escapeHTML(source.path)}</span></div><details class="apt-source-details"><summary>查看完整配置</summary><pre>${escapeHTML(view.content)}</pre></details><div class="apt-source-actions"><button class="secondary-button compact" data-source-toggle="${escapeHTML(source.path)}" data-enabled="${source.enabled}">${source.enabled?'停用':'启用'}</button>${deletable?`<button class="danger-button compact" data-source-delete="${escapeHTML(source.path)}">删除</button>`:''}</div></article>`
}
const v09UpdatesPage=updatesPage
updatesPage=function(){let html=v09UpdatesPage();const section=`<section class="surface feature-panel apt-sources-panel"><div class="section-heading"><div><h2>软件源管理</h2><p>修改前自动创建快照；系统主软件源不能删除</p></div><button id="add-apt-source" class="primary-button compact">添加软件源</button></div><div class="apt-source-list">${(state.aptSources?.sources||[]).map(aptSourceCard).join('')||'<div class="empty-list">没有读取到软件源</div>'}</div></section>`;return v09InsertBeforePageEnd(html,section)}

const v09LoadHost=loadHostSettings
loadHostSettings=async function(){await v09LoadHost();try{state.ntp=await api('/api/v1/system/host/ntp')}catch{}if(location.pathname==='/host')render()}
const v09HostPage=hostPage
hostPage=function(){let html=v09HostPage();const n=state.ntp||{};const section=`<section class="surface settings-card ntp-card"><div><h2>时间同步</h2><p>${n.synchronized?'系统时间已同步':'系统时间尚未同步'} · 服务 ${escapeHTML(n.service||'未知')}</p></div><button id="toggle-ntp" data-enabled="${!!n.enabled}" class="${n.enabled?'danger-button':'primary-button'}">${n.enabled?'关闭 NTP':'开启 NTP'}</button></section>`;return v09InsertBeforePageEnd(html,section)}

loadAudit=async function(){state.loading.audit=true;state.errors.audit='';try{const q=state.auditQuery,params=new URLSearchParams();Object.entries(q).forEach(([key,value])=>{if(value!==''&&value!==null&&value!==undefined)params.set(key,String(value))});const logParams=new URLSearchParams({lines:'600'});if(state.logSource)logParams.set('unit',state.logSource);const [audit,logs]=await Promise.all([api('/api/v1/audit?'+params.toString()),api('/api/v1/logs/system?'+logParams.toString())]);state.audit=audit;state.systemLogs=logs}catch(e){state.errors.audit=e.message}finally{state.loading.audit=false;render()}}
auditPage=function(){if(!state.audit&&!state.errors.audit){queueMicrotask(loadAudit);return `<div class="page-wrap">${pageHeader('日志审计','读取日志')}${surfaceLoading()}</div>`}const events=state.audit?.events||[],auditText=events.map(auditEventText).join('\n'),systemText=state.systemLogs?.logs||'',q=state.auditQuery,total=state.audit?.total||events.length;return `<div class="page-wrap">${pageHeader('日志审计',`SQLite 索引：${state.audit?.indexed?'已启用':'兼容模式'} · 共 ${total} 条`,`<button id="copy-current-log" class="secondary-button compact">${icon('copy',16)}复制当前</button><button id="export-audit" class="secondary-button compact">${icon('download',16)}导出</button><button id="refresh-audit" class="secondary-button compact">${icon('refresh',17)}刷新</button>`)}${errorBox(state.errors.audit)}<div class="tab-bar surface"><button class="${state.logTab==='audit'?'active':''}" data-log-tab="audit">操作审计</button><button class="${state.logTab==='system'?'active':''}" data-log-tab="system">系统日志</button></div>${state.logTab==='audit'?`<form id="audit-filter-form" class="surface audit-filter-grid"><label>关键词<input name="q" value="${escapeHTML(q.q)}" placeholder="操作、目标或详情"></label><label>用户<input name="user" value="${escapeHTML(q.user)}"></label><label>IP<input name="ip" value="${escapeHTML(q.ip)}"></label><label>模块/操作<input name="action" value="${escapeHTML(q.action)}" placeholder="例如 docker"></label><label>结果<select name="result"><option value="">全部</option><option value="success" ${q.result==='success'?'selected':''}>成功</option><option value="failed" ${q.result==='failed'?'selected':''}>失败</option></select></label><label>开始日期<input name="from" type="date" value="${escapeHTML(q.from)}"></label><label>结束日期<input name="to" type="date" value="${escapeHTML(q.to)}"></label><button class="primary-button" type="submit">筛选</button></form><section class="audit-list">${events.map((item,index)=>`<article class="surface audit-card"><div><time>${formatDate(item.time)}</time><strong>${escapeHTML(item.action)}</strong>${statusBadge(item.result)}</div><p>${escapeHTML(item.target||'-')}</p><small>${escapeHTML(item.user||'-')} · ${escapeHTML(item.ip||'-')} · ${escapeHTML(item.detail||'')}</small><button class="secondary-button compact" data-copy-audit="${index}">${icon('copy',15)}复制</button></article>`).join('')||'<div class="empty-list surface">没有符合条件的审计记录</div>'}</section><div class="pagination surface"><button id="audit-prev" class="secondary-button" ${q.offset<=0?'disabled':''}>上一页</button><span>${q.offset+1}-${Math.min(q.offset+q.limit,total)} / ${total}</span><button id="audit-next" class="secondary-button" ${q.offset+q.limit>=total?'disabled':''}>下一页</button></div>`:`<div class="tab-bar surface log-source-tabs">${[['','系统'],['lukepanel.service','面板'],['lukepanel-agent.service','Agent'],['docker.service','Docker'],['ssh.service','SSH'],['sshd.service','sshd'],['apt-daily.service','APT']].map(([value,label])=>`<button data-log-source="${value}" class="${state.logSource===value?'active':''}">${label}</button>`).join('')}</div><section class="surface log-view"><pre>${escapeHTML(systemText||'暂无系统日志')}</pre></section>`}</div>`}

const v09LoadGitHub=loadGitHub
loadGitHub=async function(owner,repo){await v09LoadGitHub(owner,repo);state.githubJobs=null;state.githubAssets=null}
const v09GithubPage=githubPage
githubPage=function(){let html=v09GithubPage();if(!githubHelperEnabled()||!state.githubAuth?.connected||!state.github)return html;const data=state.github;const section=`<section class="surface feature-panel"><div class="section-heading"><div><h2>Actions 运行详情</h2><p>点击一次运行查看 Job，再读取失败日志</p></div></div><div class="compact-list">${(data.workflow_runs||[]).slice(0,8).map(run=>`<button class="github-run-row" data-github-run="${run.id}"><span><strong>${escapeHTML(run.name)}</strong><small>${escapeHTML(run.head_branch||'')} · ${formatDate(run.created_at)}</small></span>${statusBadge(run.conclusion||run.status)}</button>`).join('')||'<div class="empty-list">暂无 Actions 运行</div>'}</div>${state.githubJobs?`<div class="github-jobs"><h3>Jobs</h3>${(state.githubJobs.jobs||[]).map(job=>`<article><div><strong>${escapeHTML(job.name)}</strong>${statusBadge(job.conclusion||job.status)}</div><button class="secondary-button compact" data-github-job="${job.id}">查看日志</button></article>`).join('')}</div>`:''}</section><section class="surface feature-panel"><div class="section-heading"><div><h2>Release 附件</h2><p>选择标签后查看或上传二进制、ZIP 和校验文件</p></div></div><form id="github-assets-form" class="inline-form"><input name="tag" placeholder="例如 v0.9.10-beta" required><button class="secondary-button" type="submit">查看附件</button><input name="file" type="file"><button class="primary-button" type="button" id="github-asset-upload">上传附件</button></form>${state.githubAssets?`<div class="compact-list">${(state.githubAssets.assets||[]).map(asset=>`<a href="${escapeHTML(asset.browser_download_url)}" target="_blank" rel="noopener"><strong>${escapeHTML(asset.name)}</strong><span>${formatBytes(asset.size)} · 下载 ${asset.download_count||0}</span></a>`).join('')||'<div class="empty-list">这个 Release 暂无附件</div>'}</div>`:''}</section>`;return v09InsertBeforePageEnd(html,section)}

loadSecurity=async function(){if(state.loading.security)return;state.loading.security=true;state.errors.security='';try{const [settings,sessions,totp,report,passkeys,devices,allowlist,notifications,firewall,fail2ban]=await Promise.all([api('/api/v1/settings'),api('/api/v1/auth/sessions'),api('/api/v1/auth/totp/status'),api('/api/v1/security/status'),api('/api/v1/auth/passkeys'),api('/api/v1/auth/trusted-devices'),api('/api/v1/security/ip-allowlist'),api('/api/v1/security/login-notifications'),api('/api/v1/security/firewall'),api('/api/v1/security/fail2ban')]);Object.assign(state,{settings,sessions,totpStatus:totp,securityReport:report,passkeys,trustedDevices:devices,ipAllowlist:allowlist,loginNotifications:notifications,firewall,fail2ban});state.username=settings.admin_user||state.username}catch(e){state.errors.security=e.message}finally{state.loading.security=false;render()}}
const v09SecurityPage=securityPage
securityPage=function(){let html=v09SecurityPage();const passkeys=state.passkeys?.passkeys||[],devices=state.trustedDevices?.devices||[],allow=state.ipAllowlist||{},notify=state.loginNotifications||{},fw=state.firewall||{};const section=`<section class="security-grid"><article class="surface security-feature"><div class="section-heading"><div><h2>Passkey</h2><p>使用 Face ID、Touch ID 或安全密钥登录</p></div>${passkeyAvailable()?'<button id="register-passkey" class="primary-button compact">添加 Passkey</button>':'<span class="status-badge muted">浏览器不支持</span>'}</div><div class="compact-list">${passkeys.map(item=>`<div><span><strong>${escapeHTML(item.name||'Passkey')}</strong><small>最近使用 ${item.last_used?formatDate(item.last_used):'从未'}</small></span><button class="danger-button compact" data-passkey-delete="${escapeHTML(item.id)}">移除</button></div>`).join('')||'<div class="empty-list">尚未添加 Passkey</div>'}</div></article><article class="surface security-feature"><div class="section-heading"><div><h2>可信设备</h2><p>TOTP 开启时可让常用设备 30 天免验证码</p></div>${devices.length?'<button id="revoke-all-trusted" class="secondary-button compact">全部撤销</button>':''}</div><div class="compact-list">${devices.map(item=>`<div><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.ip)} · ${formatDate(item.last_used)}</small></span><button class="danger-button compact" data-trusted-delete="${escapeHTML(item.id)}">撤销</button></div>`).join('')||'<div class="empty-list">暂无可信设备</div>'}</div></article></section><section class="security-grid"><form id="ip-allowlist-form" class="surface security-feature"><h2>面板 IP 允许列表</h2><p>启用时自动保留当前 IP，并生成 15 分钟恢复链接，避免把自己关在外面。</p><label class="checkbox-row"><input name="enabled" type="checkbox" ${allow.enabled?'checked':''}><span>只允许下面的 IP / CIDR</span></label><label>允许地址（每行一个）<textarea name="entries" rows="5" placeholder="203.0.113.5\n192.168.0.0/16">${escapeHTML((allow.entries||[]).join('\n'))}</textarea></label><small>当前 IP：${escapeHTML(allow.current_ip||'未知')}</small><button class="primary-button" type="submit">保存并生成恢复入口</button></form><form id="login-notify-form" class="surface security-feature"><h2>登录通知</h2><p>登录成功后通过 Telegram 通知。Token 不显示在页面和审计中。</p><label class="checkbox-row"><input name="enabled" type="checkbox" ${notify.enabled?'checked':''}><span>启用 Telegram 登录通知</span></label><label>Bot Token<input name="bot_token" type="password" ${passwordInputAttributes()} placeholder="留空则保留现有 Token"></label><label>Chat ID<input name="chat_id" value="${escapeHTML(notify.chat_id||'')}"></label><label class="checkbox-row"><input name="test" type="checkbox"><span>保存后发送测试消息</span></label><button class="primary-button" type="submit">保存通知设置</button></form></section><section class="surface security-feature"><div class="section-heading"><div><h2>UFW 防火墙</h2><p>${fw.installed?(fw.enabled?'已启用':'已安装但未启用'):'尚未安装'}。首次启用有 5 分钟自动恢复保护。</p></div><div class="resource-actions">${!fw.installed?'<button id="install-ufw" class="primary-button compact">安装 UFW</button>':fw.enabled?'<button id="disable-ufw" class="danger-button compact">关闭防火墙</button>':'<button id="enable-ufw" class="primary-button compact">安全启用</button>'}${fw.recovery_pending?'<button id="confirm-ufw" class="primary-button compact">确认连接正常</button>':''}</div></div>${fw.installed?`<form id="ufw-rule-form" class="inline-form"><select name="action"><option value="allow">允许</option><option value="deny">拒绝</option><option value="limit">限速</option></select><select name="protocol"><option value="tcp">TCP</option><option value="udp">UDP</option><option value="any">全部协议</option></select><input name="port" placeholder="端口，例如 443" required><input name="source" placeholder="来源 IP/CIDR，留空=任意"><input name="comment" placeholder="备注"><button class="primary-button" type="submit">添加规则</button></form><div class="source-list">${(fw.rules||[]).map(rule=>`<article><div><strong>#${rule.number} ${escapeHTML(rule.action)} → ${escapeHTML(rule.to)}</strong><p>来源 ${escapeHTML(rule.from)}</p></div><button class="danger-button compact" data-ufw-delete="${rule.number}">删除</button></article>`).join('')||'<div class="empty-list">暂无自定义规则</div>'}</div>`:''}</section>`;return v09InsertBeforePageEnd(html,section)}

async function registerPasskey(){if(!passkeyAvailable()){await showError('当前浏览器不支持 Passkey');return}const name=await askText('给这个 Passkey 起一个容易识别的名称',{title:'添加 Passkey',value:navigator.platform||'我的设备',placeholder:'例如 iPhone 16 Pro Max'});if(!name)return;try{const begin=await secureApi('/api/v1/auth/passkey/register/begin',{method:'POST',body:jsonBody({name})});const credential=await navigator.credentials.create({publicKey:{challenge:b64urlToBytes(begin.challenge),rp:{name:begin.rp.name,id:begin.rp.id},user:{id:b64urlToBytes(begin.user.id),name:begin.user.name,displayName:begin.user.display_name},pubKeyCredParams:begin.pub_key_cred_params,timeout:begin.timeout,attestation:begin.attestation,authenticatorSelection:{residentKey:begin.authenticator_selection?.resident_key,userVerification:begin.authenticator_selection?.user_verification},excludeCredentials:(begin.exclude_credentials||[]).map(item=>({...item,id:b64urlToBytes(item.id)}))}});await secureApi('/api/v1/auth/passkey/register/finish',{method:'POST',body:jsonBody({flow_id:begin.flow_id,name,credential:serializeCreation(credential)})});showToast('Passkey 已添加');await loadSecurity()}catch(error){await showError(error.name==='NotAllowedError'?'Passkey 操作已取消或超时':error.message)}}

// v0.9 delegated interactions keep dynamically rendered pages easy to maintain.
document.addEventListener('submit',async event=>{
  const form=event.target
  if(form.id==='docker-hub-search-form'){event.preventDefault();const query=String(new FormData(form).get('query')||'').trim();state.dockerHubQuery=query;try{state.dockerHubResults=await api(`/api/v1/docker/hub/search?q=${encodeURIComponent(query)}`);render()}catch(e){await showError(e.message)}}
  if(form.id==='compose-wizard-form'){event.preventDefault();const f=new FormData(form);try{await secureApi('/api/v1/docker/compose/create',{method:'POST',body:jsonBody({project:f.get('project'),directory:f.get('directory'),start:f.get('start')==='on',services:[{name:f.get('service_name'),image:f.get('image'),container_name:f.get('container_name'),restart:f.get('restart'),ports:lines(f.get('ports')),environment:lines(f.get('environment')),volumes:lines(f.get('volumes'))}]})});showToast('Compose 项目已创建');await loadDocker()}catch(e){await showError(e.message)}}
  if(form.id==='audit-filter-form'){event.preventDefault();const f=new FormData(form);for(const key of ['q','user','ip','action','result','from','to'])state.auditQuery[key]=String(f.get(key)||'');state.auditQuery.offset=0;await loadAudit()}
  if(form.id==='github-assets-form'){event.preventDefault();const f=new FormData(form),data=state.github;try{state.githubAssets=await api(`/api/v1/github/release/assets?owner=${encodeURIComponent(data.owner)}&repo=${encodeURIComponent(data.name)}&tag=${encodeURIComponent(f.get('tag'))}`);render()}catch(e){await showError(e.message)}}
  if(form.id==='ip-allowlist-form'){event.preventDefault();const f=new FormData(form);try{const out=await secureApi('/api/v1/security/ip-allowlist',{method:'POST',body:jsonBody({enabled:f.get('enabled')==='on',entries:lines(f.get('entries'))})});if(out.recovery_url){state.modal={title:'紧急恢复链接',kind:'logs',content:`请立即保存。15 分钟内访问可关闭允许列表：\n${location.origin}${out.recovery_url}`};render()}else{showToast('IP 允许列表已保存');await loadSecurity()}}catch(e){await showError(e.message)}}
  if(form.id==='login-notify-form'){event.preventDefault();const f=new FormData(form);try{await secureApi('/api/v1/security/login-notifications',{method:'POST',body:jsonBody({enabled:f.get('enabled')==='on',bot_token:f.get('bot_token'),chat_id:f.get('chat_id'),test:f.get('test')==='on'})});showToast('登录通知已保存');await loadSecurity()}catch(e){await showError(e.message)}}
  if(form.id==='ufw-rule-form'){event.preventDefault();const f=new FormData(form);try{await secureApi('/api/v1/security/firewall/rule',{method:'POST',body:jsonBody({action:'add',direction:'in',protocol:f.get('protocol'),port:f.get('port'),source:f.get('source'),comment:f.get('comment')})});showToast('防火墙规则已添加');await loadSecurity()}catch(e){await showError(e.message)}}
})
document.addEventListener('click',async event=>{const button=event.target.closest('button,[data-file-shortcut]');if(!button)return
  if(button.dataset.hubPull){const image=button.dataset.hubPull;const tag=await askText('填写镜像标签',{title:'拉取 Docker 镜像',value:image+':latest'});if(tag){try{await secureApi('/api/v1/docker/images/pull',{method:'POST',body:jsonBody({image:tag})});showToast('镜像已拉取');await loadDocker()}catch(e){await showError(e.message)}}}
  if(button.id==='refresh-volume-usage'){try{state.dockerVolumeUsage=await api('/api/v1/docker/volumes/usage');render()}catch(e){await showError(e.message)}}
  if(button.dataset.fileShortcut){const path=button.dataset.fileShortcut;if(button.dataset.dir==='true')loadFiles(path);else openFile(path)}
  if(button.id==='toggle-current-favorite'){try{state.filePreferences=await api('/api/v1/files/preferences',{method:'POST',body:jsonBody({action:button.dataset.enabled==='true'?'unfavorite':'favorite',path:state.files?.path||'/',is_dir:true})});render();showToast(button.dataset.enabled==='true'?'已取消收藏':'已收藏目录')}catch(e){await showError(e.message)}}
  if(button.id==='add-apt-source'){const name=await askText('文件名会保存在 /etc/apt/sources.list.d/ 下',{title:'添加软件源',placeholder:'例如 custom.list'});if(!name)return;const content=await askText('输入完整 deb 行或 deb822 内容',{title:'软件源内容',placeholder:'deb https://example.com/debian stable main'});if(!content)return;try{await secureApi('/api/v1/system/apt/sources',{method:'POST',body:jsonBody({action:'add',name,content})});showToast('软件源已添加');await loadUpdates()}catch(e){await showError(e.message)}}
  if(button.dataset.sourceToggle){try{await secureApi('/api/v1/system/apt/sources',{method:'POST',body:jsonBody({action:button.dataset.enabled==='true'?'disable':'enable',path:button.dataset.sourceToggle})});showToast('软件源状态已更新');await loadUpdates()}catch(e){await showError(e.message)}}
  if(button.dataset.sourceDelete){if(await askConfirm('删除前会自动创建快照。',{title:'删除软件源',confirmText:'删除',danger:true}))try{await secureApi('/api/v1/system/apt/sources',{method:'POST',body:jsonBody({action:'delete',path:button.dataset.sourceDelete})});showToast('软件源已删除');await loadUpdates()}catch(e){await showError(e.message)}}
  if(button.id==='toggle-ntp'){try{await secureApi('/api/v1/system/host/ntp',{method:'POST',body:jsonBody({enabled:button.dataset.enabled!=='true'})});showToast('时间同步设置已更新');await loadHostSettings()}catch(e){await showError(e.message)}}
  if(button.id==='audit-prev'){state.auditQuery.offset=Math.max(0,state.auditQuery.offset-state.auditQuery.limit);await loadAudit()}
  if(button.id==='audit-next'){state.auditQuery.offset+=state.auditQuery.limit;await loadAudit()}
  if(button.hasAttribute('data-copy-audit')){const item=(state.audit?.events||[])[Number(button.dataset.copyAudit)];if(item)await copyText(auditEventText(item),'审计记录已复制')}
  if(button.dataset.githubRun){const data=state.github;try{state.githubJobs=await api(`/api/v1/github/actions/jobs?owner=${encodeURIComponent(data.owner)}&repo=${encodeURIComponent(data.name)}&run_id=${button.dataset.githubRun}`);render()}catch(e){await showError(e.message)}}
  if(button.dataset.githubJob){const data=state.github;try{const out=await api(`/api/v1/github/actions/job-logs?owner=${encodeURIComponent(data.owner)}&repo=${encodeURIComponent(data.name)}&job_id=${button.dataset.githubJob}`);state.modal={title:'GitHub Actions Job 日志',kind:'logs',content:out.logs||'暂无日志'};render()}catch(e){await showError(e.message)}}
  if(button.id==='github-asset-upload'){const form=document.querySelector('#github-assets-form'),f=new FormData(form),file=form.querySelector('[name=file]').files?.[0],data=state.github;if(!file){await showError('请选择要上传的附件');return}const body=new FormData();body.append('owner',data.owner);body.append('repo',data.name);body.append('tag',f.get('tag'));body.append('file',file);try{await secureApi('/api/v1/github/release/assets/upload',{method:'POST',body});showToast('Release 附件已上传');state.githubAssets=await api(`/api/v1/github/release/assets?owner=${encodeURIComponent(data.owner)}&repo=${encodeURIComponent(data.name)}&tag=${encodeURIComponent(f.get('tag'))}`);render()}catch(e){await showError(e.message)}}
  if(button.id==='register-passkey')registerPasskey()
  if(button.dataset.passkeyDelete&&await askConfirm('删除后这把 Passkey 不能再登录。',{title:'移除 Passkey',confirmText:'移除',danger:true}))try{await secureApi('/api/v1/auth/passkeys',{method:'DELETE',body:jsonBody({id:button.dataset.passkeyDelete})});showToast('Passkey 已移除');await loadSecurity()}catch(e){await showError(e.message)}
  if(button.dataset.trustedDelete)try{await secureApi('/api/v1/auth/trusted-devices',{method:'DELETE',body:jsonBody({id:button.dataset.trustedDelete})});showToast('可信设备已撤销');await loadSecurity()}catch(e){await showError(e.message)}
  if(button.id==='revoke-all-trusted'&&await askConfirm('所有设备下次登录都需要验证码。',{title:'撤销全部可信设备',confirmText:'全部撤销',danger:true}))try{await secureApi('/api/v1/auth/trusted-devices',{method:'DELETE',body:jsonBody({all:true})});showToast('全部可信设备已撤销');await loadSecurity()}catch(e){await showError(e.message)}
  if(button.id==='install-ufw')try{await secureApi('/api/v1/security/firewall/install',{method:'POST',body:'{}'});showToast('UFW 已安装');await loadSecurity()}catch(e){await showError(e.message)}
  if(button.id==='enable-ufw'&&await askConfirm('面板会保留 SSH/current IP，并设置 5 分钟自动关闭保护。启用后请立即确认当前连接正常。',{title:'安全启用 UFW',confirmText:'启用'}))try{await secureApi('/api/v1/security/firewall/enable',{method:'POST',body:'{}'});showToast('UFW 已启用，请在 5 分钟内确认');await loadSecurity()}catch(e){await showError(e.message)}
  if(button.id==='confirm-ufw')try{await secureApi('/api/v1/security/firewall/confirm',{method:'POST',body:'{}'});showToast('连接已确认，自动恢复任务已取消');await loadSecurity()}catch(e){await showError(e.message)}
  if(button.id==='disable-ufw'&&await askConfirm('关闭后所有端口将不再由 UFW 过滤。',{title:'关闭 UFW',confirmText:'关闭',danger:true}))try{await secureApi('/api/v1/security/firewall/disable',{method:'POST',body:'{}'});showToast('UFW 已关闭');await loadSecurity()}catch(e){await showError(e.message)}
  if(button.dataset.ufwDelete&&await askConfirm(`删除防火墙规则 #${button.dataset.ufwDelete}？`,{title:'删除 UFW 规则',confirmText:'删除',danger:true}))try{await secureApi('/api/v1/security/firewall/rule',{method:'POST',body:jsonBody({action:'delete',number:Number(button.dataset.ufwDelete)})});showToast('规则已删除');await loadSecurity()}catch(e){await showError(e.message)}
})

const v09DockerPageWithFeatures=dockerPage
dockerPage=function(){let html=v09DockerPageWithFeatures();if(state.dockerTab==='containers'){html=html.replace(/<button class="secondary-button compact" data-docker-edit="([^"]+)" data-title="([^"]+)">编辑<\/button>/g,(match,id,title)=>match+`<button class="secondary-button compact" data-docker-diagnostic="${id}" data-title="${title}">诊断</button>`)}if(state.dockerTab==='volumes'){html=html.replace(/<button class="danger-button compact" data-volume-delete="([^"]+)">删除<\/button>/g,(match,name)=>`<button class="secondary-button compact" data-volume-backup="${name}">备份</button><button class="secondary-button compact" data-volume-restore="${name}">恢复</button>${match}`)}return html}
document.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return
  if(button.dataset.dockerDiagnostic){const options=[['identity','身份与权限'],['working-directory','当前工作目录'],['environment','环境变量'],['disk','容器磁盘'],['processes','进程列表'],['network','网络统计'],['os-release','系统版本'],['list-root','根目录列表']],choice=await chooseAction(`${button.dataset.title} · 安全诊断`,options.map(([,label])=>({label,description:'执行固定命令，不支持任意 Shell'})));if(choice===false||choice===null)return;try{const out=await secureApi('/api/v1/docker/exec',{method:'POST',body:jsonBody({id:button.dataset.dockerDiagnostic,command:options[choice][0]})});state.modal={title:`${button.dataset.title} · ${options[choice][1]}`,kind:'logs',content:out.output||'命令完成但没有输出'};render()}catch(e){await showError(e.message)}}
  if(button.dataset.volumeBackup){const path=await askText('备份会保存为 tar.gz，请填写完整的文件系统路径。',{title:`备份卷 ${button.dataset.volumeBackup}`,value:`/opt/${button.dataset.volumeBackup}-${new Date().toISOString().slice(0,10)}.tar.gz`});if(!path)return;try{const out=await secureApi('/api/v1/docker/volumes/archive',{method:'POST',body:jsonBody({action:'backup',name:button.dataset.volumeBackup,path})});showToast(`备份已保存：${out.path}`)}catch(e){await showError(e.message)}}
  if(button.dataset.volumeRestore){const path=await askText('恢复是覆盖/追加模式，不会删除备份中不存在的旧文件。建议先备份当前卷。',{title:`恢复卷 ${button.dataset.volumeRestore}`,placeholder:'/opt/volume-backup.tar.gz'});if(!path)return;if(!await askConfirm('恢复会覆盖卷内同名文件。容器运行中时可能产生不一致，建议先停止相关容器。',{title:'确认恢复存储卷',confirmText:'开始恢复',danger:true}))return;try{await secureApi('/api/v1/docker/volumes/archive',{method:'POST',body:jsonBody({action:'restore',name:button.dataset.volumeRestore,path})});showToast('存储卷已恢复')}catch(e){await showError(e.message)}}
})


function renderMarkdownSafe(source=''){
  let html=escapeHTML(source)
  html=html.replace(/^######\s+(.+)$/gm,'<h6>$1</h6>').replace(/^#####\s+(.+)$/gm,'<h5>$1</h5>').replace(/^####\s+(.+)$/gm,'<h4>$1</h4>').replace(/^###\s+(.+)$/gm,'<h3>$1</h3>').replace(/^##\s+(.+)$/gm,'<h2>$1</h2>').replace(/^#\s+(.+)$/gm,'<h1>$1</h1>')
  html=html.replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>')
  html=html.replace(/^>\s?(.+)$/gm,'<blockquote>$1</blockquote>').replace(/^[-*]\s+(.+)$/gm,'<li>$1</li>').replace(/(?:<li>.*<\/li>\n?)+/g,match=>`<ul>${match}</ul>`)
  html=html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
  return html.split(/\n{2,}/).map(block=>/^<(h\d|pre|ul|blockquote)/.test(block)?block:`<p>${block.replace(/\n/g,'<br>')}</p>`).join('')
}
document.addEventListener('click',event=>{const button=event.target.closest('#preview-markdown');if(!button)return;const content=document.querySelector('#file-editor')?.value||'';state.modal={title:`${state.modal?.title||'Markdown'} · 预览`,kind:'markdown-preview',content,path:state.modal?.path,originalTitle:state.modal?.title};render()})
const v09ModalHTML=modalHTML
modalHTML=function(){if(state.modal?.kind==='markdown-preview'){const m=state.modal;return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal-card markdown-modal"><header><h2>${escapeHTML(m.title)}</h2><button id="modal-close" aria-label="关闭">${icon('close',20)}</button></header><div class="modal-body markdown-preview">${renderMarkdownSafe(m.content)}</div><footer><button id="markdown-back-edit" class="secondary-button">返回编辑</button><button id="modal-done" class="primary-button">完成</button></footer></section></div>`}return v09ModalHTML()}
document.addEventListener('click',event=>{if(!event.target.closest('#markdown-back-edit'))return;const m=state.modal;state.modal={title:m.originalTitle||'Markdown',kind:'editor',content:m.content,path:m.path,dirty:false,preview_kind:'markdown'};render()})

const v09SSHPage=sshPage
sshPage=function(){let html=v09SSHPage();const users=state.sshUsers?.users||[];const section=`<section class="surface feature-panel linux-users-panel"><div class="section-heading"><div><h2>Linux 用户</h2><p>新用户默认锁定密码，只能先通过 SSH 公钥登录；系统服务用户不会显示。</p></div><button id="create-linux-user" class="primary-button compact">新建用户</button></div><div class="source-list">${users.map(user=>`<article><div><strong>${escapeHTML(user.name)} ${user.uid===0?'· root':''}</strong><p>UID ${user.uid} · ${escapeHTML(user.home)} · ${escapeHTML(user.shell)}</p><small>${user.key_count||0} 把公钥 · ${user.sudo?'拥有 sudo 权限':'普通用户'}</small></div><div class="resource-actions">${user.name!=='root'?`<button class="secondary-button compact" data-user-sudo="${escapeHTML(user.name)}" data-enabled="${!!user.sudo}">${user.sudo?'移除 sudo':'授予 sudo'}</button><button class="danger-button compact" data-user-delete="${escapeHTML(user.name)}">删除</button>`:''}</div></article>`).join('')||'<div class="empty-list">没有可管理的登录用户</div>'}</div></section>`;return v09InsertBeforePageEnd(html,section)}
document.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return
 if(button.id==='create-linux-user'){const name=await askText('新用户会创建 Home 目录，并锁定密码。创建后请为它生成或添加 SSH 公钥。',{title:'新建 Linux 用户',placeholder:'例如 deploy'});if(!name)return;const sudo=await askConfirm('是否同时授予 sudo 管理权限？',{title:'用户权限',confirmText:'授予 sudo',cancelText:'普通用户'});try{await secureApi('/api/v1/ssh/users/manage',{method:'POST',body:jsonBody({action:'create',name,sudo:!!sudo})});showToast('Linux 用户已创建');await loadSSH(name)}catch(e){await showError(e.message)}}
 if(button.dataset.userSudo){const enabled=button.dataset.enabled!=='true';if(!await askConfirm(enabled?'授予后这个用户可以通过 sudo 获得 root 权限。':'移除后该用户将不能再使用 sudo。',{title:enabled?'授予 sudo':'移除 sudo',confirmText:'确认'}))return;try{await secureApi('/api/v1/ssh/users/manage',{method:'POST',body:jsonBody({action:'sudo',name:button.dataset.userSudo,sudo:enabled})});showToast('用户权限已更新');await loadSSH(state.sshUser)}catch(e){await showError(e.message)}}
 if(button.dataset.userDelete){if(!await askConfirm('系统会拒绝删除 root、服务用户和仍有运行进程的用户。是否同时删除 Home 目录？',{title:`删除用户 ${button.dataset.userDelete}`,confirmText:'删除用户和 Home',danger:true}))return;try{await secureApi('/api/v1/ssh/users/manage',{method:'POST',body:jsonBody({action:'delete',name:button.dataset.userDelete,remove_home:true})});showToast('Linux 用户已删除');state.sshUser='';await loadSSH()}catch(e){await showError(e.message)}}
})

document.addEventListener('click',async event=>{const button=event.target.closest('[data-log-source]');if(!button)return;state.logSource=button.dataset.logSource||'';await loadAudit()})

const v09UpdatesPageWithJobs=updatesPage
updatesPage=function(){return v09InsertBeforePageEnd(v09UpdatesPageWithJobs(),backgroundJobPanel('apt.'))}
const v09DockerPageWithJobs=dockerPage
dockerPage=function(){return v09InsertBeforePageEnd(v09DockerPageWithJobs(),backgroundJobPanel('docker.'))}
const v09ModalWithJobs=modalHTML
modalHTML=function(){
  if(state.modal?.kind==='job-progress'){
    const job=state.modal.job||{},output=jobResultOutput(job)
    return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal-card wide"><header><div><strong>${escapeHTML(state.modal.title)}</strong><small>任务 ${escapeHTML(job.id||'正在创建')}</small></div><button id="modal-close">${icon('close',20)}</button></header><div class="modal-body"><div class="job-progress-card"><div class="spinner"></div><div><h3>${job.status==='queued'?'等待执行':job.status==='running'?'正在后台执行':'正在读取状态'}</h3><p>可以关闭弹窗或切换页面，任务不会停止。</p></div></div>${output?`<pre class="modal-log live-job-log">${escapeHTML(output)}</pre>`:''}</div><footer><button id="modal-done" class="secondary-button">后台继续</button></footer></section></div>`
  }
  return v09ModalWithJobs()
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button')
  if(!button)return
  if(button.id==='refresh-background-jobs')await loadBackgroundJobs()
  if(button.dataset.backgroundJob){
    try{const out=await api(`/api/v1/jobs?id=${encodeURIComponent(button.dataset.backgroundJob)}`),job=out.job;state.modal=job.status==='running'||job.status==='queued'?{title:job.kind,kind:'job-progress',job}:{title:job.kind,kind:'logs',content:jobResultOutput(job)||job.error||'任务没有输出'};render()}catch(error){await showError(error.message)}
  }
})

document.addEventListener('click',event=>{const button=event.target.closest('[data-github-pr-merge]');if(button)mergeGitHubPullRequest(button)})





const v09SnapshotsPageWithScheduled=snapshotsPage
snapshotsPage=function(){
  let html=v09SnapshotsPageWithScheduled()
  const scheduled=state.scheduledBackups||{backups:[],retention:7}
  const panel=`<section class="surface scheduled-backup-card"><div class="section-heading"><div><h2>定时完整备份</h2><p>通过安全计划任务生成，默认保留最近 ${scheduled.retention||7} 份。备份含账号和安全配置，请当作敏感文件保存。</p></div><button id="create-scheduled-backup-now" class="primary-button compact">立即生成</button></div><div class="compact-list">${(scheduled.backups||[]).map(item=>`<div><span><strong>${escapeHTML(item.name)}</strong><small>${formatDate(item.modified_at)} · ${formatBytes(item.size)}</small></span><div class="resource-actions"><button class="secondary-button compact" data-scheduled-backup-download="${escapeHTML(item.name)}">下载</button><button class="danger-button compact" data-scheduled-backup-delete="${escapeHTML(item.name)}">删除</button></div></div>`).join('')||'<div class="empty-list">尚无定时备份。可以立即生成，或在计划任务中创建“完整面板备份”。</div>'}</div></section>`
  return v09InsertBeforePageEnd(html,panel)
}

async function downloadScheduledBackup(name){
  let response=await fetch(`/api/v1/backup/scheduled?download=${encodeURIComponent(name)}`,{credentials:'same-origin'})
  if(response.status===403){await requestElevation();response=await fetch(`/api/v1/backup/scheduled?download=${encodeURIComponent(name)}`,{credentials:'same-origin'})}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||`下载失败（${response.status}）`)}
  const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a')
  link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button')
  if(!button)return
  if(button.id==='create-scheduled-backup-now'){
    try{const out=await secureApi('/api/v1/backup/scheduled',{method:'POST',body:jsonBody({action:'create'})});state.scheduledBackups=out;showToast('完整备份已生成');render()}catch(e){await showError(e.message)}
  }
  if(button.dataset.scheduledBackupDownload){try{await downloadScheduledBackup(button.dataset.scheduledBackupDownload)}catch(e){await showError(e.message)}}
  if(button.dataset.scheduledBackupDelete){
    if(!await askConfirm('删除后无法恢复。',{title:'删除定时备份',confirmText:'删除',danger:true}))return
    try{const out=await secureApi('/api/v1/backup/scheduled',{method:'POST',body:jsonBody({action:'delete',name:button.dataset.scheduledBackupDelete})});state.scheduledBackups=out;showToast('定时备份已删除');render()}catch(e){await showError(e.message)}
  }
})

function stopSystemLogPolling(){if(state.systemLogTimer){clearInterval(state.systemLogTimer);state.systemLogTimer=null}}
function syncSystemLogPolling(){
  const should=state.authenticated&&!document.hidden&&location.pathname==='/audit'&&state.logTab==='system'
  if(!should){stopSystemLogPolling();return}
  if(state.systemLogTimer)return
  refreshSystemLogsOnly()
  state.systemLogTimer=setInterval(refreshSystemLogsOnly,3000)
}
async function refreshSystemLogsOnly(){
  if(document.hidden||location.pathname!=='/audit'||state.logTab!=='system'){stopSystemLogPolling();return}
  const params=new URLSearchParams({lines:'600'});if(state.logSource)params.set('unit',state.logSource)
  try{
    state.systemLogs=await api('/api/v1/logs/system?'+params.toString())
    const pre=document.querySelector('.log-view pre'),nearBottom=pre?pre.scrollHeight-pre.scrollTop-pre.clientHeight<80:true
    if(pre){pre.textContent=state.systemLogs?.logs||'暂无系统日志';if(nearBottom)pre.scrollTop=pre.scrollHeight}
  }catch{}
}
document.addEventListener('visibilitychange',syncSystemLogPolling)

function stopDockerLogPolling(){if(state.dockerLogTimer){clearInterval(state.dockerLogTimer);state.dockerLogTimer=null}}
async function refreshDockerLogs(id){
  if(!state.modal||state.modal.dockerLogID!==id){stopDockerLogPolling();return}
  if(state.dockerLogPaused||document.hidden)return
  try{
    const data=await api(`/api/v1/docker/logs?id=${encodeURIComponent(id)}&tail=500`)
    if(!state.modal||state.modal.dockerLogID!==id)return
    state.modal.content=data.logs||'暂无日志'
    const pre=document.querySelector('.modal-log'),nearBottom=pre?pre.scrollHeight-pre.scrollTop-pre.clientHeight<80:true
    if(pre){pre.textContent=state.modal.content;if(nearBottom)pre.scrollTop=pre.scrollHeight}else render()
  }catch(e){if(state.modal?.dockerLogID===id){state.modal.content=`日志读取失败：${e.message}`;const pre=document.querySelector('.modal-log');if(pre)pre.textContent=state.modal.content}}
}
const v09ModalWithLiveDockerLogs=modalHTML
modalHTML=function(){
  let html=v09ModalWithLiveDockerLogs()
  if(state.modal?.dockerLogID){
    html=html.replace('<button class="secondary-button compact" id="copy-modal-log">',`<span class="live-log-status"><i></i>${state.dockerLogPaused?'已暂停':'每 2 秒更新'}</span><button class="secondary-button compact" id="toggle-docker-log">${state.dockerLogPaused?'继续':'暂停'}</button><button class="secondary-button compact" id="copy-modal-log">`)
  }
  return html
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button')
  if(!button)return
  if(button.id==='toggle-docker-log'){
    state.dockerLogPaused=!state.dockerLogPaused
    if(!state.dockerLogPaused&&state.modal?.dockerLogID)refreshDockerLogs(state.modal.dockerLogID)
    render()
  }
  if((button.id==='modal-close'||button.id==='modal-done')&&state.modal?.dockerLogID)stopDockerLogPolling()
})
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!state.dockerLogPaused&&state.modal?.dockerLogID)refreshDockerLogs(state.modal.dockerLogID)})

const v09SecurityPageWithFail2Ban=securityPage
securityPage=function(){
  let html=v09SecurityPageWithFail2Ban()
  const f2b=state.fail2ban||{}
  const panel=`<section class="surface security-feature"><div class="section-heading"><div><h2>Fail2ban SSH 防护</h2><p>${!f2b.installed?'尚未安装':f2b.active?'正在保护 SSH 登录':'已安装但服务未运行'}。白名单修改会校验配置并自动回滚。</p></div>${!f2b.installed?'<button id="install-fail2ban-v09" class="primary-button compact">安全安装</button>':statusBadge(f2b.active?'active':'inactive')}</div>${f2b.installed?`<div class="metric-grid compact-metrics"><article><span>当前失败</span><strong>${f2b.currently_failed||0}</strong></article><article><span>累计失败</span><strong>${f2b.total_failed||0}</strong></article><article><span>当前封禁</span><strong>${f2b.currently_banned||0}</strong></article><article><span>累计封禁</span><strong>${f2b.total_banned||0}</strong></article></div>${f2b.error?`<div class="notice warning">${escapeHTML(f2b.error)}</div>`:''}<div class="security-grid"><article><h3>当前封禁</h3><div class="compact-list">${(f2b.banned_ips||[]).map(ip=>`<div><code>${escapeHTML(ip)}</code><button class="secondary-button compact" data-fail2ban-unban="${escapeHTML(ip)}">解封</button></div>`).join('')||'<div class="empty-list">暂无被封禁地址</div>'}</div></article><article><h3>SSH 白名单</h3><form id="fail2ban-ignore-form" class="inline-form"><input name="entry" placeholder="IP 或 CIDR，例如 203.0.113.5" required><button class="primary-button" type="submit">添加</button></form><div class="compact-list">${(f2b.ignore_ips||[]).map(ip=>`<div><code>${escapeHTML(ip)}</code><button class="danger-button compact" data-fail2ban-ignore-remove="${escapeHTML(ip)}">移除</button></div>`).join('')||'<div class="empty-list">暂无白名单</div>'}</div></article></div>`:''}</section>`
  return v09InsertBeforePageEnd(html,panel)
}

document.addEventListener('submit',async event=>{
  const form=event.target
  if(form.id!=='fail2ban-ignore-form')return
  event.preventDefault()
  const entry=new FormData(form).get('entry')
  try{await secureApi('/api/v1/security/fail2ban/ignore',{method:'POST',body:jsonBody({entry,action:'add'})});form.reset();showToast('Fail2ban 白名单已更新');await loadSecurity()}catch(e){await showError(e.message)}
})

document.addEventListener('click',async event=>{
  const button=event.target.closest('button')
  if(!button)return
  if(button.id==='install-fail2ban-v09'){
    if(!await askConfirm('会安装 Fail2ban、保护 SSH，并自动加入当前 IP、内网和现有 SSH 会话来源地址。',{title:'安全安装 Fail2ban',confirmText:'安装'}))return
    try{await secureApi('/api/v1/security/fail2ban/install',{method:'POST',body:'{}'});showToast('Fail2ban 已安装并启用');await loadSecurity()}catch(e){await showError(e.message)}
  }
  if(button.dataset.fail2banUnban){
    if(!await askConfirm(`解除 ${button.dataset.fail2banUnban} 的 SSH 封禁？`,{title:'解除封禁',confirmText:'解封'}))return
    try{await secureApi('/api/v1/security/fail2ban/unban',{method:'POST',body:jsonBody({ip:button.dataset.fail2banUnban})});showToast('地址已解封');await loadSecurity()}catch(e){await showError(e.message)}
  }
  if(button.dataset.fail2banIgnoreRemove){
    if(!await askConfirm(`从 SSH 白名单移除 ${button.dataset.fail2banIgnoreRemove}？当前访问 IP 不允许移除。`,{title:'移除白名单',confirmText:'移除',danger:true}))return
    try{await secureApi('/api/v1/security/fail2ban/ignore',{method:'POST',body:jsonBody({entry:button.dataset.fail2banIgnoreRemove,action:'remove'})});showToast('白名单已更新');await loadSecurity()}catch(e){await showError(e.message)}
  }
})

/* v0.9.7 zero-setup GitHub Device Flow and mobile overlay fixes */
async function downloadManagedFile(path){
  const endpoint=`/api/v1/files/download?path=${encodeURIComponent(path)}`
  const request=()=>fetch(endpoint,{credentials:'same-origin'})
  let response=await request()
  if(response.status===403){
    const body=await response.clone().json().catch(()=>({}))
    if(String(body.error||'').includes('二次验证')){await requestElevation();response=await request()}
  }
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||`下载失败（${response.status}）`)}
  const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a')
  const disposition=response.headers.get('Content-Disposition')||''
  const encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const plain=disposition.match(/filename="?([^";]+)"?/i)?.[1]
  link.href=url;link.download=encoded?decodeURIComponent(encoded):plain||String(path).split('/').pop()||'download'
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);showToast('已开始下载')
}

requestElevation=function(){
  document.querySelector('[data-elevation-dialog]')?.remove()
  if(pendingElevation){pendingElevation.reject(new Error('二次验证已被新的请求替代'));pendingElevation=null}
  return new Promise((resolve,reject)=>{
    const root=document.createElement('div')
    root.className='elevation-dialog-backdrop';root.dataset.elevationDialog='true'
    root.innerHTML=`<section class="elevation-dialog-card" role="dialog" aria-modal="true" aria-labelledby="elevation-title"><form id="elevation-direct-form"><header><div class="elevation-icon">${icon('shield',24)}</div><div><strong id="elevation-title">二次验证</strong><small>请输入当前登录密码</small></div></header><label><span>当前密码</span><input id="elevation-direct-password" name="password" type="password" autocomplete="current-password" inputmode="text" enterkeyhint="done" autocapitalize="none" autocorrect="off" spellcheck="false" required></label><div class="form-error" hidden></div><footer><button type="button" class="secondary-button" data-elevation-cancel>取消</button><button type="submit" class="primary-button">验证</button></footer></form></section>`
    const finish=(ok,value)=>{if(root.isConnected)root.remove();document.body.classList.remove('elevation-open');syncOverlayState();pendingElevation=null;ok?resolve(value):reject(value instanceof Error?value:new Error('操作已取消'))}
    pendingElevation={resolve:value=>finish(true,value),reject:error=>finish(false,error)}
    const form=root.querySelector('#elevation-direct-form'),input=root.querySelector('#elevation-direct-password'),error=root.querySelector('.form-error'),submit=form.querySelector('button[type=submit]')
    const focusInput=()=>{try{input.focus({preventScroll:true})}catch{input.focus()}}
    root.querySelector('[data-elevation-cancel]').onclick=()=>finish(false,new Error('操作已取消'))
    root.onclick=event=>{if(event.target===root)finish(false,new Error('操作已取消'))}
    form.onsubmit=async event=>{event.preventDefault();const password=input.value;if(!password){focusInput();return}submit.disabled=true;submit.textContent='正在验证…';error.hidden=true;try{await api('/api/v1/auth/elevate',{method:'POST',body:jsonBody({password})});finish(true,true)}catch(err){error.textContent=err.message;error.hidden=false;submit.disabled=false;submit.textContent='验证';focusInput()}}
    document.body.appendChild(root);document.body.classList.add('elevation-open');syncOverlayState();syncVisualViewport();requestAnimationFrame(()=>{root.classList.add('show');focusInput()})
  })
}

function v096FinishLogin(result,username){
  localStorage.setItem('lukepanel-login-user',String(username||''));state.authenticated=true;state.username=result.username;state.csrf=result.csrf_token;state.loginChallenge=null
  return api('/api/v1/settings').then(settings=>{state.settings=settings;navigate(rememberedRoute('/'),{replace:true})})
}
function v096RenderOTPLogin(challenge){
  stopOverviewUpdates();state.loginChallenge=challenge
  app.innerHTML=`<main class="login-page"><section class="login-card surface"><div class="login-brand">${brandIcon('login-logo')}<div><strong>LukePanel</strong><span>服务器管理面板</span></div></div><h1>验证身份</h1><form id="otp-login-form"><label>验证码或恢复码<input name="otp" autocomplete="one-time-code" inputmode="text" enterkeyhint="done" lang="en" autocapitalize="characters" autocorrect="off" spellcheck="false" required autofocus></label><label class="checkbox-row"><input name="trust_device" type="checkbox"><span>信任这台设备 30 天</span></label><label class="trusted-device-name" hidden>设备名称<input name="device_name" maxlength="64" value="${escapeHTML(navigator.platform||'当前设备')}"></label><div class="form-error" hidden></div><button class="primary-button" type="submit">确认</button><button class="secondary-button" id="otp-login-back" type="button">返回</button></form></section></main>`
  const form=document.querySelector('#otp-login-form'),otp=form.querySelector('[name=otp]'),trust=form.querySelector('[name=trust_device]'),name=form.querySelector('.trusted-device-name'),error=form.querySelector('.form-error'),button=form.querySelector('button[type=submit]')
  trust.onchange=()=>name.hidden=!trust.checked;document.querySelector('#otp-login-back').onclick=()=>{state.loginChallenge=null;renderLogin()}
  form.onsubmit=async event=>{event.preventDefault();button.disabled=true;button.textContent='正在验证…';error.hidden=true;const f=new FormData(form);try{const result=await api('/api/v1/auth/login',{method:'POST',body:jsonBody({username:challenge.username,password:challenge.password,otp:f.get('otp'),trust_device:f.get('trust_device')==='on',device_name:f.get('device_name')})});await v096FinishLogin(result,challenge.username)}catch(err){error.textContent=err.message;error.hidden=false;button.disabled=false;button.textContent='确认';otp.focus()}}
  requestAnimationFrame(()=>otp.focus())
}
renderLogin=function(){
  stopOverviewUpdates();state.loginChallenge=null;const rememberedUser=localStorage.getItem('lukepanel-login-user')||'admin'
  app.innerHTML=`<main class="login-page"><section class="login-card surface"><div class="login-brand">${brandIcon('login-logo')}<div><strong>LukePanel</strong><span>服务器管理面板</span></div></div><h1>欢迎回来</h1><form id="login-form"><label>用户名<input name="username" value="${escapeHTML(rememberedUser)}" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"></label><label>密码<div class="password-field"><input name="password" type="password" autocomplete="current-password" inputmode="text" enterkeyhint="go" autocapitalize="none" autocorrect="off" spellcheck="false" autofocus required><button type="button" id="show-password">显示</button></div></label><div id="login-error" class="form-error" hidden></div><button class="primary-button" type="submit">登录</button></form>${passkeyAvailable()?`<div class="login-divider"><span>或</span></div><button id="passkey-login" class="secondary-button wide-button">${icon('key',18)}使用 Passkey 登录</button>`:''}</section></main>`
  const form=document.querySelector('#login-form'),error=document.querySelector('#login-error')
  document.querySelector('#show-password').onclick=event=>{const input=form.querySelector('[name=password]');input.type=input.type==='password'?'text':'password';event.currentTarget.textContent=input.type==='password'?'显示':'隐藏';input.focus()}
  document.querySelector('#passkey-login')?.addEventListener('click',async()=>{const button=document.querySelector('#passkey-login'),username=String(form.querySelector('[name=username]')?.value||'').trim();error.hidden=true;button.disabled=true;button.textContent='正在调用 Passkey…';try{const begin=await api('/api/v1/auth/passkey/login/begin',{method:'POST',body:jsonBody({username})});const credential=await navigator.credentials.get({publicKey:{challenge:b64urlToBytes(begin.challenge),rpId:begin.rp_id,timeout:begin.timeout,userVerification:begin.user_verification,allowCredentials:(begin.allow_credentials||[]).map(item=>({...item,id:b64urlToBytes(item.id)}))}});const result=await api('/api/v1/auth/passkey/login/finish',{method:'POST',body:jsonBody({flow_id:begin.flow_id,credential:serializeAssertion(credential)})});await v096FinishLogin(result,username)}catch(err){error.textContent=err.name==='NotAllowedError'?'Passkey 操作已取消或超时':err.message;error.hidden=false}finally{button.disabled=false;button.innerHTML=`${icon('key',18)}使用 Passkey 登录`}})
  form.onsubmit=async event=>{event.preventDefault();const f=new FormData(form),username=String(f.get('username')||'').trim(),password=String(f.get('password')||''),button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='正在登录…';error.hidden=true;try{const result=await api('/api/v1/auth/login',{method:'POST',body:jsonBody({username,password})});await v096FinishLogin(result,username)}catch(err){if(err.code==='totp_required'){v096RenderOTPLogin({username,password});return}error.textContent=err.message;error.hidden=false}finally{if(button.isConnected){button.disabled=false;button.textContent='登录'}}}
}

async function v096CancelGitHubDevice(){
  if(state.githubFlowTimer){clearTimeout(state.githubFlowTimer);state.githubFlowTimer=null}
  const flowID=state.githubFlow?.flow_id||'';state.githubFlow=null
  try{await api('/api/v1/github/auth/device/cancel',{method:'POST',body:jsonBody({flow_id:flowID})})}catch{}
  render()
}
async function v096TokenLogin(form){
  const token=String(new FormData(form).get('token')||'').trim(),button=form.querySelector('button');button.disabled=true;button.textContent='正在连接…'
  try{const result=await api('/api/v1/github/auth/token',{method:'POST',body:jsonBody({token})});state.githubAuth={connected:true,...result};form.reset();showToast(`已连接 GitHub @${result.login}`);render()}catch(error){await showError(error.message)}finally{if(button.isConnected){button.disabled=false;button.textContent='连接'}}
}
document.addEventListener('submit',event=>{if(event.target.id==='github-token-form'){event.preventDefault();v096TokenLogin(event.target)}})
document.addEventListener('click',event=>{if(event.target.closest('#cancel-github-device'))v096CancelGitHubDevice()})

const v096UpdatePasswordStrength=updatePasswordStrength
updatePasswordStrength=function(){
  const input=document.querySelector('#new-password'),strength=document.querySelector('#password-strength'),checks=document.querySelector('#password-checks')
  if(strength)strength.hidden=!input?.value
  if(checks)checks.hidden=!input?.value
  v096UpdatePasswordStrength()
}


let visualViewportBaseline=Math.max(window.visualViewport?.height||0,window.innerHeight||0)
function syncVisualViewport(){
  const viewport=window.visualViewport
  const height=Math.max(280,viewport?.height||window.innerHeight||document.documentElement.clientHeight||0)
  const offsetTop=Math.max(0,viewport?.offsetTop||0)
  const focused=document.activeElement
  const editable=Boolean(focused&&['INPUT','TEXTAREA','SELECT'].includes(focused.tagName)&&focused.type!=='checkbox'&&focused.type!=='radio'&&focused.type!=='file')
  if(!editable)visualViewportBaseline=Math.max(visualViewportBaseline,height)
  const keyboardOpen=Boolean(editable&&visualViewportBaseline-height>90)
  const keyboardGap=Math.max(0,visualViewportBaseline-height)
  document.documentElement.style.setProperty('--visual-viewport-height',`${Math.round(height)}px`)
  document.documentElement.style.setProperty('--visual-viewport-top',`${Math.round(offsetTop)}px`)
  document.documentElement.style.setProperty('--keyboard-height',`${Math.round(keyboardOpen?keyboardGap:0)}px`)
  document.body?.classList.toggle('keyboard-open',keyboardOpen)
}

let overlayScrollY=0
function syncOverlayState(){
  const body=document.body
  if(!body)return
  const open=Boolean(document.querySelector('.modal-backdrop,.app-dialog-backdrop,.elevation-dialog-backdrop'))
  const locked=body.classList.contains('overlay-locked')
  body.classList.toggle('overlay-open',open)
  if(open&&!locked){
    overlayScrollY=window.scrollY||document.documentElement.scrollTop||0
    body.style.top=`-${overlayScrollY}px`
    body.classList.add('overlay-locked')
  }else if(!open&&locked){
    body.classList.remove('overlay-locked','keyboard-open')
    body.style.top=''
    window.scrollTo(0,overlayScrollY)
  }
}
syncVisualViewport()
window.visualViewport?.addEventListener('resize',syncVisualViewport,{passive:true})
window.visualViewport?.addEventListener('scroll',syncVisualViewport,{passive:true})
window.addEventListener('resize',syncVisualViewport,{passive:true})
document.addEventListener('focusin',syncVisualViewport,{passive:true})
document.addEventListener('focusout',()=>setTimeout(syncVisualViewport,80),{passive:true})
new MutationObserver(()=>{syncOverlayState();syncVisualViewport()}).observe(document.body,{childList:true,subtree:true})

/* v0.9.10 product UI: one coherent layout, real status, mobile-first interaction. */
function v0910Percent(value,total){return total?clamp(Number(value||0)/Number(total)*100):0}
function v0910StatCard(id,label,value,detail,iconName,tone='blue'){
  return `<article class="v10-stat-card surface tone-${tone}" data-kpi="${id}"><div class="v10-stat-icon">${icon(iconName,20)}</div><div><span>${escapeHTML(label)}</span><strong data-kpi-value>${escapeHTML(value)}</strong><small data-kpi-detail>${escapeHTML(detail||'')}</small></div></article>`
}
function v0910ResourceRow(id,label,value,detail,percent,tone='blue'){
  return `<div class="v10-resource-row" data-resource="${id}"><div><span>${escapeHTML(label)}</span><strong data-resource-value>${escapeHTML(value)}</strong></div><div class="v10-resource-track"><i class="tone-${tone}" data-resource-progress style="width:${clamp(percent)}%"></i></div><small data-resource-detail>${escapeHTML(detail||'')}</small></div>`
}
function v0910InfoRow(label,value){return `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value||'-')}</dd></div>`}
function v0910NavItems(){
  const items=[['概览','/','home'],['系统','/system','server'],['Docker','/docker','container'],['文件管理','/files','folder'],['常用工具','/tools','wrench']]
  if(githubHelperEnabled())items.push(['GitHub 助手','/github','github'])
  items.push(['软件管理','/updates','package'],['日志审计','/audit','scroll'],['安全中心','/security','shield'])
  return items
}
navItems=v0910NavItems
shell=function(content){
  const nav=v0910NavItems(),mobileRoutes=new Set(['/','/system','/docker','/tools','/security']),showMobileNav=mobileRoutes.has(location.pathname)
  const mobileLabels={'/':'概览','/system':'系统','/docker':'Docker','/tools':'工具','/security':'我的'}
  const mobileNav=showMobileNav?`<nav class="mobile-nav" aria-label="主要导航">${nav.filter(([,href])=>mobileRoutes.has(href)).map(([,href,i])=>`<a data-nav href="${href}" class="${isActive(href)?'active':''}">${icon(href==='/security'?'user':i,21)}<span>${mobileLabels[href]}</span></a>`).join('')}</nav>`:''
  return `<div class="app-shell v10-shell ${showMobileNav?'has-mobile-nav':'no-mobile-nav'}"><aside class="sidebar v10-sidebar"><div class="brand">${brandIcon()}<div><strong>LukePanel</strong><span>${escapeHTML(state.settings?.version||'服务器管理面板')}</span></div></div><nav class="sidebar-nav">${nav.map(([label,href,i])=>`<a data-nav href="${href}" class="${isActive(href)?'active':''}">${icon(i,18)}<span>${escapeHTML(label)}</span></a>`).join('')}</nav><div class="sidebar-footer"><div class="v10-sidebar-user"><span class="v10-user-avatar">${escapeHTML((state.username||'L').slice(0,1).toUpperCase())}</span><div><strong>${escapeHTML(state.username||'管理员')}</strong><small>本机管理员</small></div></div><button id="theme-toggle" class="icon-text-button">${icon(theme()==='dark'?'sun':'moon',18)}<span>${theme()==='dark'?'浅色模式':'深色模式'}</span></button><button data-logout class="icon-text-button danger-text">${icon('logout',18)}<span>退出登录</span></button></div></aside><main class="main-content">${content}</main>${mobileNav}${modalHTML()}</div>`
}
pageHeader=function(title,description='',actions=''){
  const parent=routeParents[location.pathname]
  return `<header class="page-header v10-page-header"><div class="page-header__main">${parent?`<button class="page-back" data-back="${parent}" aria-label="返回">${icon('back',20)}</button>`:''}<div class="page-header__copy"><h1>${escapeHTML(title)}</h1>${description?`<p>${escapeHTML(description)}</p>`:''}</div></div>${actions?`<div class="page-header__actions">${actions}</div>`:''}</header>`
}

dashboardDockerHTML=function(){
  const data=state.dashboardDocker
  if(!data)return `<div class="v10-docker-loading"><div class="spinner"></div><span>正在读取 Docker</span></div>`
  if(!data.available)return `<div class="v10-docker-empty"><strong>Docker 不可用</strong><span>${escapeHTML(data.error||'无法连接 Docker Engine')}</span><a data-nav href="/docker">查看详情 ${icon('chevron',14)}</a></div>`
  const containers=data.containers||[],running=containers.filter(c=>c.state==='running').length,stopped=containers.length-running
  return `<div class="v10-docker-summary"><div><strong>${running}</strong><span>运行中</span></div><div><strong>${stopped}</strong><span>已停止</span></div><div><strong>${containers.length}</strong><span>总容器</span></div></div><div class="v10-docker-list">${containers.slice(0,4).map(c=>`<div><span class="v10-dot ${c.state==='running'?'success':'muted'}"></span><strong>${escapeHTML(containerName(c))}</strong><small>${escapeHTML(c.state==='running'?'运行中':c.status||'已停止')}</small></div>`).join('')||'<span class="muted-text">暂无容器</span>'}</div><div class="v10-card-footer"><span>Docker ${escapeHTML(data.version||'')}</span><a data-nav href="/docker">管理 Docker ${icon('chevron',14)}</a></div>`
}

dashboard=function(){
  const d=state.overview
  if(!d){if(state.errors.overview)return `<div class="page-wrap">${pageHeader('概览','系统状态读取失败',`<button id="refresh-overview" class="secondary-button compact">${icon('refresh',17)}重试</button>`)}${errorBox(state.errors.overview)}</div>`;queueMicrotask(()=>loadOverview());return `<div class="page-wrap">${pageHeader('概览','正在读取服务器状态')}${surfaceLoading('正在采集系统信息')}</div>`}
  if(!state.dashboardDocker&&!state.loading.dashboardDocker)queueMicrotask(()=>loadDashboardDocker())
  const memoryPct=v0910Percent(d.memory.Used,d.memory.Total),diskPct=v0910Percent(d.disk.Used,d.disk.Total),swap=swapDisplay(d.memory)
  return `<div class="page-wrap v10-dashboard" data-dashboard>${pageHeader('概览',`${d.hostname} · 服务器运行正常`,`<button id="refresh-overview" class="secondary-button compact">${icon('refresh',17,state.loading.overview?'spin':'')}<span>刷新</span></button>`)}${errorBox(state.errors.overview)}<section class="v10-live-strip"><div><span class="status-dot"></span><strong>实时监控</strong><span data-stream-state>实时推送 · 2 秒</span></div><time data-collected>${formatDate(d.collected_at)}</time></section><section class="v10-kpi-grid">${v0910StatCard('uptime','运行时间',formatUptime(d.uptime_seconds),'持续在线','clock','blue')}${v0910StatCard('load','系统负载',d.load_1.toFixed(2),`5 分钟 ${d.load_5.toFixed(2)} · 15 分钟 ${d.load_15.toFixed(2)}`,'activity','green')}${v0910StatCard('cpu','CPU 使用率',`${d.cpu_percent.toFixed(1)}%`,`${d.cpu_cores} 核心`,'server','purple')}${v0910StatCard('memory','内存使用率',`${memoryPct.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`,'drive','orange')}</section><section class="v10-dashboard-grid"><article class="surface v10-panel v10-resource-panel"><div class="v10-panel-heading"><div><h2>资源使用</h2><p>服务器当前资源占用</p></div><a data-nav href="/processes">查看进程 ${icon('chevron',14)}</a></div>${v0910ResourceRow('cpu','CPU',`${d.cpu_percent.toFixed(1)}%`,`${d.cpu_cores} 核 · 负载 ${d.load_1.toFixed(2)}`,d.cpu_percent,'blue')}${v0910ResourceRow('memory','内存',`${memoryPct.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`,memoryPct,'green')}${v0910ResourceRow('disk','系统盘',`${diskPct.toFixed(1)}%`,`${formatBytes(d.disk.Used)} / ${formatBytes(d.disk.Total)}`,diskPct,'orange')}${v0910ResourceRow('swap','Swap',swap.value,swap.detail,swap.percent,'purple')}</article><article class="surface v10-panel v10-system-panel"><div class="v10-panel-heading"><div><h2>系统状态</h2><p>基础运行环境</p></div>${icon('server',20)}</div><dl class="v10-info-list">${v0910InfoRow('操作系统',d.os)}${v0910InfoRow('内核版本',d.kernel)}${v0910InfoRow('架构',d.architecture)}${v0910InfoRow('实时下载',formatRate(d.network.download_bps))}${v0910InfoRow('实时上传',formatRate(d.network.upload_bps))}</dl></article></section><section class="v10-dashboard-lower"><article class="surface v10-panel v10-docker-panel"><div class="v10-panel-heading"><div><h2>Docker 概览</h2><p>每 10 秒同步容器状态</p></div><span class="live-dot"></span></div><div id="dashboard-docker-content">${dashboardDockerHTML()}</div></article><article class="surface v10-panel v10-quick-panel"><div class="v10-panel-heading"><div><h2>快捷操作</h2><p>常用管理入口</p></div></div><div class="v10-quick-list"><a data-nav href="/files">${icon('folder',18)}<span><strong>文件管理</strong><small>浏览、编辑与传输文件</small></span>${icon('chevron',16)}</a><a data-nav href="/updates">${icon('package',18)}<span><strong>软件管理</strong><small>检查并安装系统更新</small></span>${icon('chevron',16)}</a><a data-nav href="/audit">${icon('scroll',18)}<span><strong>日志审计</strong><small>查看操作记录与系统日志</small></span>${icon('chevron',16)}</a><a data-nav href="/tools">${icon('terminal',18)}<span><strong>诊断工具</strong><small>执行固定安全诊断</small></span>${icon('chevron',16)}</a></div></article></section></div>`
}
updateDashboard=function(d){
  const memoryPct=v0910Percent(d.memory.Used,d.memory.Total),diskPct=v0910Percent(d.disk.Used,d.disk.Total),swap=swapDisplay(d.memory)
  const setKPI=(id,value,detail)=>{const root=document.querySelector(`[data-kpi="${id}"]`);if(root){root.querySelector('[data-kpi-value]').textContent=value;root.querySelector('[data-kpi-detail]').textContent=detail}}
  const setResource=(id,value,detail,percent)=>{const root=document.querySelector(`[data-resource="${id}"]`);if(root){root.querySelector('[data-resource-value]').textContent=value;root.querySelector('[data-resource-detail]').textContent=detail;root.querySelector('[data-resource-progress]').style.width=`${clamp(percent)}%`}}
  setKPI('uptime',formatUptime(d.uptime_seconds),'持续在线');setKPI('load',d.load_1.toFixed(2),`5 分钟 ${d.load_5.toFixed(2)} · 15 分钟 ${d.load_15.toFixed(2)}`);setKPI('cpu',`${d.cpu_percent.toFixed(1)}%`,`${d.cpu_cores} 核心`);setKPI('memory',`${memoryPct.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`)
  setResource('cpu',`${d.cpu_percent.toFixed(1)}%`,`${d.cpu_cores} 核 · 负载 ${d.load_1.toFixed(2)}`,d.cpu_percent);setResource('memory',`${memoryPct.toFixed(1)}%`,`${formatBytes(d.memory.Used)} / ${formatBytes(d.memory.Total)}`,memoryPct);setResource('disk',`${diskPct.toFixed(1)}%`,`${formatBytes(d.disk.Used)} / ${formatBytes(d.disk.Total)}`,diskPct);setResource('swap',swap.value,swap.detail,swap.percent)
  const collected=document.querySelector('[data-collected]');if(collected)collected.textContent=formatDate(d.collected_at)
}

function v0910PresetButton(id,label,description,current,danger=false){return `<button type="button" data-sysctl-preset="${id}" class="v10-preset-option ${current===id?'active':''} ${danger?'danger':''}"><span>${current===id?icon('check',17):icon(id==='network'?'network':id==='low-memory'?'drive':'activity',17)}</span><div><strong>${escapeHTML(label)}</strong><small>${escapeHTML(description)}</small></div>${current===id?'<em>当前</em>':''}</button>`}
hostPage=function(){
  const x=state.hostSettings,n=state.ntp||{},sys=x?.sysctl||{preset:'default',label:'系统默认',bbr:x?.bbr}
  if(!x&&!state.errors.host){queueMicrotask(loadHostSettings);return `<div class="page-wrap">${pageHeader('主机设置','正在读取系统配置')}${surfaceLoading()}</div>`}
  const ntpState=!n.available?'不可用':n.synchronized?'已同步':n.enabled?'等待同步':'未启用'
  const ntpTone=n.synchronized?'success':n.enabled?'warning':'muted'
  return `<div class="page-wrap v10-host-page">${pageHeader('主机设置','所有修改都经过校验，并在关键操作前创建快照',`<button id="refresh-host" class="secondary-button compact">${icon('refresh',17)}刷新</button>`)}${errorBox(state.errors.host)}<section class="v10-settings-grid"><form id="host-basic-form" class="surface v10-settings-card"><div class="v10-panel-heading"><div><h2>基础信息</h2><p>主机名与系统时区</p></div>${icon('server',20)}</div><label>主机名<input name="hostname" value="${escapeHTML(x?.hostname||'')}" required></label><label>时区<input name="timezone" value="${escapeHTML(x?.timezone||'UTC')}" placeholder="Asia/Shanghai" required></label><button class="primary-button" type="submit">保存基础设置</button></form><form id="host-dns-form" class="surface v10-settings-card"><div class="v10-panel-heading"><div><h2>系统 DNS</h2><p>${x?.systemd_resolved?'由 systemd-resolved 管理':'未检测到 systemd-resolved'}</p></div>${icon('network',20)}</div><label>DNS 服务器<textarea name="dns" rows="4" placeholder="每行一个，例如 1.1.1.1">${escapeHTML((x?.dns||[]).join('\n'))}</textarea></label><button class="primary-button" type="submit" ${x?.systemd_resolved?'':'disabled'}>测试并保存</button></form><article class="surface v10-settings-card"><div class="v10-panel-heading"><div><h2>Swap</h2><p>${x?.swap?.managed?'由 LukePanel 管理':'系统交换空间'}</p></div><span class="v10-state-pill ${x?.swap?.enabled?'success':'muted'}">${x?.swap?.enabled?'已启用':'未启用'}</span></div><div class="v10-setting-value"><strong>${formatBytes(x?.swap?.used||0)}</strong><span>/ ${formatBytes(x?.swap?.total||0)}</span></div>${x?.swap?.managed?`<button id="host-swap-delete" class="danger-button">删除 LukePanel 管理的 Swap</button>`:`<form id="host-swap-form" class="v10-inline-form"><label>大小（MB）<input name="size_mb" type="number" min="256" max="32768" value="2048"></label><button class="primary-button" type="submit">创建 Swap</button></form>`}</article><article class="surface v10-settings-card v10-ntp-card"><div class="v10-panel-heading"><div><h2>时间同步</h2><p>系统时钟与 TOTP 的基础</p></div><span class="v10-state-pill ${ntpTone}">${ntpState}</span></div><dl class="v10-info-list compact">${v0910InfoRow('服务',n.service||'未检测到时间同步服务')}${v0910InfoRow('服务状态',n.service_active?'运行中':n.service_unit?'未运行':'由系统环境提供')}${v0910InfoRow('时区',n.timezone||x?.timezone||'-')}${v0910InfoRow('时间服务器',n.server_name||n.server_address||'由服务自动选择')}${v0910InfoRow('上次同步',n.last_sync||'暂无记录')}</dl><button id="toggle-ntp" data-enabled="${!!n.enabled}" class="${n.enabled?'secondary-button':'primary-button'}" ${n.available?'':'disabled'}>${n.enabled?'关闭时间同步':'开启时间同步'}</button></article></section><section class="surface v10-kernel-card"><div class="v10-panel-heading"><div><h2>内核优化</h2><p>只应用固定、可审计的 sysctl 模板</p></div><span class="v10-current-profile">当前：${escapeHTML(sys.label||'系统默认')}</span></div><div class="v10-kernel-meta"><span>拥塞控制 <strong>${escapeHTML(sys.congestion_control||'未读取')}</strong></span><span>队列算法 <strong>${escapeHTML(sys.default_qdisc||'未读取')}</strong></span><span>Swappiness <strong>${Number(sys.swappiness||0)}</strong></span><span>BBR <strong>${sys.bbr?'已启用':'未启用'}</strong></span></div><div class="v10-preset-grid">${v0910PresetButton('balanced','均衡','适合大多数通用服务器',sys.preset)}${v0910PresetButton('network','网络吞吐','启用 BBR 与 fq，偏向网络服务',sys.preset)}${v0910PresetButton('low-memory','小内存 VPS','降低脏页比例，减少内存压力',sys.preset)}${v0910PresetButton('reset','恢复系统默认','删除 LukePanel 管理的 sysctl 文件',sys.preset,true)}</div>${sys.managed?`<small class="v10-managed-note">配置文件：${escapeHTML(sys.config_path||'/etc/sysctl.d/99-lukepanel.conf')}</small>`:'<small class="v10-managed-note">当前没有 LukePanel 管理的内核优化配置。</small>'}</section></div>`
}

filesPage=function(){
  const l=state.files
  if(state.fileView==='recycle'){
    if(!state.recycle&&!state.errors.recycle){queueMicrotask(loadRecycle);return `<div class="page-wrap">${pageHeader('文件管理','正在读取回收站')}${surfaceLoading()}</div>`}
    const entries=state.recycle?.entries||[]
    return `<div class="page-wrap v10-files-page">${pageHeader('文件管理','已删除内容可以恢复或永久清理')}<div class="tab-bar surface file-tabs"><button data-file-view="files">文件</button><button class="active" data-file-view="recycle">回收站 <span>${entries.length}</span></button></div>${errorBox(state.errors.recycle)}<section class="v10-list surface">${entries.map(item=>`<article class="v10-list-row"><div class="v10-list-icon">${icon(item.is_dir?'folder':'file',20)}</div><div class="v10-list-main"><strong>${escapeHTML(item.name)}</strong><span title="${escapeHTML(item.original_path)}">${escapeHTML(item.original_path)}</span><small>${formatDate(item.deleted_at)}${item.is_dir?' · 文件夹':` · ${formatBytes(item.size)}`}</small></div><div class="v10-row-actions"><button class="secondary-button compact" data-recycle-action="restore" data-recycle-id="${escapeHTML(item.id)}">恢复</button><button class="danger-button compact" data-recycle-action="purge" data-recycle-id="${escapeHTML(item.id)}">永久删除</button></div></article>`).join('')||'<div class="empty-list">回收站是空的</div>'}</section></div>`
  }
  if(!l&&!state.errors.files){queueMicrotask(()=>loadFiles('/'));return `<div class="page-wrap">${pageHeader('文件管理','正在读取文件系统')}${surfaceLoading()}</div>`}
  const entries=filteredFileEntries(),prefs=state.filePreferences||{favorites:[],recent:[]},current=l?.path||'/',favorite=(prefs.favorites||[]).some(item=>item.path===current)
  return `<div class="page-wrap v10-files-page">${pageHeader('文件管理','浏览、编辑、上传、下载与安全回收',`<button id="global-file-search" class="secondary-button compact">${icon('search',17)}<span>搜索</span></button><button id="new-file" class="secondary-button compact">${icon('plus',17)}<span>新建</span></button><button id="upload-file" class="primary-button compact">${icon('upload',17)}<span>上传</span></button><input id="upload-input" type="file" multiple hidden><input id="upload-folder-input" type="file" webkitdirectory directory multiple hidden><input id="upload-zip-input" type="file" accept=".zip,application/zip" hidden>`)}<div class="tab-bar surface file-tabs"><button class="active" data-file-view="files">文件</button><button data-file-view="recycle">回收站</button></div>${errorBox(state.errors.files)}${l?`<div class="file-toolbar surface"><button id="file-back" ${l.parent?'':'disabled'} aria-label="返回上级">${icon('back',19)}</button><button id="file-home" aria-label="根目录">${icon('home',18)}</button><div class="path-pill file-breadcrumb" title="${escapeHTML(l.path)}">${fileBreadcrumb(l.path)}</div><button id="copy-current-path" data-copy-text="${escapeHTML(l.path)}" aria-label="复制当前路径">${icon('copy',18)}</button><button id="refresh-files" aria-label="刷新">${icon('refresh',18)}</button></div><div class="search-bar surface file-search">${icon('search',18)}<input id="file-search" value="${escapeHTML(state.fileFilter)}" placeholder="筛选当前目录"><span>${entries.length} / ${l.entries.length}</span></div><section class="v10-file-list surface">${entries.map(item=>`<div class="file-row v10-file-row"><button class="file-open" data-file-path="${escapeHTML(item.path)}" data-directory="${item.is_dir}"><div class="file-icon">${icon(item.is_dir?'folder':'file',21)}</div><div class="file-main"><strong title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</strong><span>${item.is_dir?'文件夹':formatBytes(item.size)} · ${formatDate(item.modified_at)}</span></div><code>${escapeHTML(item.mode||'')}</code>${icon('chevron',17)}</button><button class="file-more" data-file-menu="${escapeHTML(item.path)}" aria-label="更多操作">${icon('more',19)}</button></div>`).join('')||'<div class="empty-list">这个目录是空的</div>'}</section><section class="surface v10-shortcut-panel"><div class="v10-panel-heading"><div><h2>快捷访问</h2><p>收藏和最近访问保存在本机面板</p></div><button class="secondary-button compact" id="toggle-current-favorite" data-enabled="${favorite}">${favorite?'取消收藏':'收藏当前目录'}</button></div><div class="v10-shortcut-grid"><div><h3>收藏</h3>${(prefs.favorites||[]).slice(0,6).map(item=>`<button class="shortcut-item" data-file-shortcut="${escapeHTML(item.path)}" data-dir="${item.is_dir}">${icon(item.is_dir?'folder':'file',17)}<span>${escapeHTML(item.name||item.path)}</span></button>`).join('')||'<p class="muted-text">暂无收藏</p>'}</div><div><h3>最近访问</h3>${(prefs.recent||[]).slice(0,6).map(item=>`<button class="shortcut-item" data-file-shortcut="${escapeHTML(item.path)}" data-dir="${item.is_dir}">${icon(item.is_dir?'folder':'file',17)}<span>${escapeHTML(item.name||item.path)}</span><small>${formatDate(item.last_access)}</small></button>`).join('')||'<p class="muted-text">暂无记录</p>'}</div></div></section>`:''}</div>`
}

function v0910AuditBadge(result){const success=result==='success',failed=['failed','error'].includes(result);return `<span class="v10-audit-badge ${success?'success':failed?'danger':'muted'}"><i></i>${success?'成功':failed?'失败':escapeHTML(result||'未知')}</span>`}
auditPage=function(){
  if(!state.audit&&!state.errors.audit){queueMicrotask(loadAudit);return `<div class="page-wrap">${pageHeader('日志审计','正在读取操作记录')}${surfaceLoading()}</div>`}
  const events=state.audit?.events||[],systemText=state.systemLogs?.logs||'',q=state.auditQuery,total=state.audit?.total||events.length
  return `<div class="page-wrap v10-audit-page">${pageHeader('日志审计',`${state.audit?.indexed?'SQLite 索引已启用':'文件兼容模式'} · 共 ${total} 条`,`<button id="copy-current-log" class="secondary-button compact">${icon('copy',16)}复制</button><button id="export-audit" class="secondary-button compact">${icon('download',16)}导出</button><button id="refresh-audit" class="secondary-button compact">${icon('refresh',17)}刷新</button>`)}${errorBox(state.errors.audit)}<div class="tab-bar surface"><button class="${state.logTab==='audit'?'active':''}" data-log-tab="audit">操作审计</button><button class="${state.logTab==='system'?'active':''}" data-log-tab="system">系统日志</button></div>${state.logTab==='audit'?`<details class="surface v10-audit-filter"><summary>${icon('search',17)}<span>筛选审计记录</span><small>${[q.q,q.user,q.ip,q.action,q.result,q.from,q.to].filter(Boolean).length?'已应用筛选':'未筛选'}</small>${icon('chevron',16)}</summary><form id="audit-filter-form" class="audit-filter-grid"><label>关键词<input name="q" value="${escapeHTML(q.q)}" placeholder="操作、目标或详情"></label><label>模块/操作<input name="action" value="${escapeHTML(q.action)}" placeholder="例如 docker"></label><label>用户<input name="user" value="${escapeHTML(q.user)}"></label><label>IP<input name="ip" value="${escapeHTML(q.ip)}"></label><label>结果<select name="result"><option value="">全部</option><option value="success" ${q.result==='success'?'selected':''}>成功</option><option value="failed" ${q.result==='failed'?'selected':''}>失败</option></select></label><label>开始日期<input name="from" type="date" value="${escapeHTML(q.from)}"></label><label>结束日期<input name="to" type="date" value="${escapeHTML(q.to)}"></label><button class="primary-button" type="submit">应用筛选</button></form></details><section class="v10-audit-list">${events.map((item,index)=>`<article class="surface v10-audit-card"><div class="v10-audit-head"><div><strong>${escapeHTML(item.action)}</strong>${v0910AuditBadge(item.result)}</div><time>${formatDate(item.time)}</time></div><p>${escapeHTML(item.target||'无目标')}</p><div class="v10-audit-meta"><span>${escapeHTML(item.user||'-')}</span><span>${escapeHTML(item.ip||'-')}</span>${item.detail?`<span>${escapeHTML(item.detail)}</span>`:''}</div><button class="secondary-button compact" data-copy-audit="${index}" aria-label="复制审计记录">${icon('copy',15)}复制</button></article>`).join('')||'<div class="empty-list surface">没有符合条件的审计记录</div>'}</section><div class="pagination surface"><button id="audit-prev" class="secondary-button" ${q.offset<=0?'disabled':''}>上一页</button><span>${total?`${q.offset+1}-${Math.min(q.offset+q.limit,total)} / ${total}`:'0 / 0'}</span><button id="audit-next" class="secondary-button" ${q.offset+q.limit>=total?'disabled':''}>下一页</button></div>`:`<div class="tab-bar surface log-source-tabs">${[['','系统'],['lukepanel.service','面板'],['lukepanel-agent.service','Agent'],['docker.service','Docker'],['ssh.service','SSH'],['sshd.service','sshd'],['apt-daily.service','APT']].map(([value,label])=>`<button data-log-source="${value}" class="${state.logSource===value?'active':''}">${label}</button>`).join('')}</div><section class="surface log-view"><pre>${escapeHTML(systemText||'暂无系统日志')}</pre></section>`}</div>`
}

const v0910BaseModalHTML=modalHTML
modalHTML=function(){
  const html=v0910BaseModalHTML()
  if(!html)return html
  return html.replace('class="modal-card ',`class="modal-card v10-modal-card `).replace('class="modal-card"',`class="modal-card v10-modal-card"`)
}

const v0910BaseGithubPage=githubPage
githubPage=function(){return v0910BaseGithubPage().replace(/^<div class="page-wrap github-page">/,'<div class="page-wrap github-page v10-github-page">')}
const v0910BaseSSHPage=sshPage
sshPage=function(){
  if(!state.ssh&&!state.errors.ssh){queueMicrotask(()=>loadSSH());return `<div class="page-wrap">${pageHeader('SSH 管理','正在读取 SSH 状态')}${surfaceLoading()}</div>`}
  const users=state.sshUsers?.users||[],keys=state.sshKeys?.keys||[],status=state.ssh||{},totalKeys=users.reduce((sum,user)=>sum+Number(user.key_count||0),0)
  const passwordEnabled=String(status.password_authentication||'').toLowerCase()!=='no',boolValue=value=>String(value||'').toLowerCase()!=='no'
  const pending=status.pending_new_port?`<div class="alert warning ssh-port-pending">${icon('alert',18)}<div><strong>SSH 端口等待确认</strong><p>新端口 ${escapeHTML(status.pending_new_port)} 与旧端口 ${escapeHTML(status.pending_old_port)} 同时监听。请先用新端口登录，再确认关闭旧端口。</p><div class="v10-inline-actions"><button id="ssh-port-keep-new" class="primary-button compact">新端口已验证</button><button id="ssh-port-revert" class="danger-button compact">恢复旧端口</button></div></div></div>`:''
  const serviceLabel=status.available?(status.running===false?'已停止':'运行中'):'不可用'
  return `<div class="page-wrap ssh-page v10-ssh-page">${pageHeader('SSH 管理','安全管理端口、登录方式、公钥和 Linux 用户',`<button id="refresh-ssh" class="secondary-button compact">${icon('refresh',17)}<span>刷新</span></button>`)}${errorBox(state.errors.ssh)}${pending}<section class="v10-ssh-grid"><article class="surface v10-panel v10-ssh-status"><div class="v10-panel-heading"><div><h2>OpenSSH</h2><p>当前服务与登录策略</p></div><span class="v10-state-pill ${status.available&&status.running!==false?'success':'warning'}">${escapeHTML(serviceLabel)}</span></div><div class="v10-ssh-metrics"><div><span>端口</span><strong>${escapeHTML(status.port||'-')}</strong></div><div><span>Root 登录</span><strong>${escapeHTML(status.permit_root_login||'-')}</strong></div><div><span>密码登录</span><strong>${passwordEnabled?'已启用':'已关闭'}</strong></div><div><span>授权公钥</span><strong>${totalKeys} 把</strong></div></div><div class="v10-ssh-password-action">${passwordEnabled?`<button id="ssh-disable-password" class="danger-button" ${totalKeys<1?'disabled':''}>${icon('shield',17)}关闭密码登录</button>`:`<button id="ssh-enable-password" class="secondary-button">恢复密码登录</button>`}<small>${passwordEnabled?(totalKeys?'关闭前请先在另一个终端测试公钥登录。':'没有检测到公钥，暂不允许关闭密码登录。'):'当前仅允许密钥等非密码方式登录。'}</small></div></article><form id="ssh-settings-form" class="surface v10-panel v10-ssh-settings"><div class="v10-panel-heading"><div><h2>连接设置</h2><p>修改端口时采用双端口过渡</p></div>${icon('wrench',19)}</div><div class="v10-form-grid"><label>SSH 端口<input name="port" type="number" min="1" max="65535" value="${escapeHTML(String(status.port||'22').split(' ')[0])}" required></label><label>Root 登录<select name="permit_root_login"><option value="prohibit-password" ${status.permit_root_login==='prohibit-password'?'selected':''}>只允许密钥（推荐）</option><option value="no" ${status.permit_root_login==='no'?'selected':''}>完全禁止</option><option value="yes" ${status.permit_root_login==='yes'?'selected':''}>允许</option><option value="forced-commands-only" ${status.permit_root_login==='forced-commands-only'?'selected':''}>仅强制命令</option></select></label></div><div class="v10-toggle-list"><label class="toggle-field"><input name="allow_tcp_forwarding" type="checkbox" ${boolValue(status.allow_tcp_forwarding)?'checked':''}><span><strong>TCP 转发</strong><small>代理、隧道与 Remote 开发可能需要</small></span></label><label class="toggle-field"><input name="allow_agent_forwarding" type="checkbox" ${boolValue(status.allow_agent_forwarding)?'checked':''}><span><strong>Agent 转发</strong><small>不使用跳板机时建议关闭</small></span></label><label class="toggle-field"><input name="x11_forwarding" type="checkbox" ${boolValue(status.x11_forwarding)?'checked':''}><span><strong>X11 转发</strong><small>无图形程序时建议关闭</small></span></label></div><button class="primary-button" type="submit">校验并应用</button></form></section><section class="surface v10-panel v10-ssh-keys"><div class="v10-panel-heading"><div><h2>授权公钥</h2><p>管理所选用户的 ~/.ssh/authorized_keys</p></div><div class="v10-key-toolbar"><select id="ssh-user">${users.map(user=>`<option value="${escapeHTML(user.name)}" ${user.name===state.sshUser?'selected':''}>${escapeHTML(user.name)} · ${user.key_count} 把</option>`).join('')}</select><button id="ssh-generate-key" class="primary-button compact">${icon('key',17)}生成密钥</button></div></div><div class="v10-key-list">${keys.map(key=>`<article class="v10-key-row"><div class="v10-key-type">${escapeHTML(key.type.replace('ssh-',''))}</div><div><strong>${escapeHTML(key.comment||'未命名公钥')}</strong><p>${escapeHTML(key.fingerprint)}</p><small>${escapeHTML(key.preview)}</small></div><button class="danger-button compact" data-ssh-key-delete="${escapeHTML(key.id)}">删除</button></article>`).join('')||'<div class="empty-list">这个用户还没有公钥</div>'}</div><details class="v10-add-key"><summary>${icon('plus',16)}添加已有公钥</summary><form id="ssh-key-form" class="ssh-key-form"><label>OpenSSH 公钥<textarea name="key" rows="4" placeholder="ssh-ed25519 AAAA... iPhone" required></textarea></label><button class="secondary-button" type="submit">验证并添加</button></form></details></section><section class="surface v10-panel linux-users-panel v10-linux-users"><div class="v10-panel-heading"><div><h2>Linux 用户</h2><p>仅显示可登录用户；新用户默认锁定密码</p></div><button id="create-linux-user" class="primary-button compact">${icon('plus',16)}新建用户</button></div><div class="v10-user-list">${users.map(user=>`<article><div class="v10-user-avatar">${escapeHTML(user.name.slice(0,1).toUpperCase())}</div><div><strong>${escapeHTML(user.name)}${user.uid===0?' · root':''}</strong><p>UID ${user.uid} · ${escapeHTML(user.home)} · ${escapeHTML(user.shell)}</p><small>${user.key_count||0} 把公钥 · ${user.sudo?'拥有 sudo 权限':'普通用户'}</small></div>${user.name!=='root'?`<div class="v10-row-actions"><button class="secondary-button compact" data-user-sudo="${escapeHTML(user.name)}" data-enabled="${!!user.sudo}">${user.sudo?'移除 sudo':'授予 sudo'}</button><button class="danger-button compact" data-user-delete="${escapeHTML(user.name)}">删除</button></div>`:'<span class="v10-state-pill">系统管理员</span>'}</article>`).join('')||'<div class="empty-list">没有可管理的登录用户</div>'}</div></section></div>`
}


restore()
