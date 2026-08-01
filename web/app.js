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
  systemLogs: null,
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

function renderLogin(){
  stopOverviewUpdates()
  const rememberedUser=localStorage.getItem('lukepanel-login-user')||'admin'
  app.innerHTML=`<main class="login-page"><section class="login-card surface"><div class="login-brand"><div class="login-logo">L</div><div><strong>LukePanel</strong><span>服务器管理面板</span></div></div><h1>欢迎回来</h1><p>登录后管理系统、Docker、文件与安全设置</p><form id="login-form"><label>用户名<input name="username" value="${escapeHTML(rememberedUser)}" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"></label><label>密码<div class="password-field"><input name="password" type="password" autocomplete="current-password" inputmode="latin" lang="en" autocapitalize="none" autocorrect="off" spellcheck="false" autofocus><button type="button" id="show-password">显示</button></div></label><div id="login-error" class="form-error" hidden></div><button class="primary-button" type="submit">登录</button></form><div class="security-note">${icon('shield',17)}验证码只会在已开启 TOTP 且密码验证通过后出现</div></section></main>`
  document.querySelector('#show-password').onclick=e=>{const input=document.querySelector('[name=password]');input.type=input.type==='password'?'text':'password';e.currentTarget.textContent=input.type==='password'?'显示':'隐藏'}
  document.querySelector('#login-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form),button=form.querySelector('button[type=submit]'),error=document.querySelector('#login-error');button.disabled=true;button.textContent='正在登录…';error.hidden=true;try{const r=await api('/api/v1/auth/login',{method:'POST',body:jsonBody({username:f.get('username'),password:f.get('password'),otp:f.get('otp')})});localStorage.setItem('lukepanel-login-user',String(f.get('username')||''));state.authenticated=true;state.username=r.username;state.csrf=r.csrf_token;state.settings=await api('/api/v1/settings');navigate(rememberedRoute('/'),{replace:true})}catch(err){if(err.code==='totp_required'&&!form.querySelector('[name=otp]')){const label=document.createElement('label');label.id='otp-field';label.innerHTML='身份验证器验证码或恢复码<input name="otp" autocomplete="one-time-code" inputmode="text" lang="en" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="6 位验证码或 XXXX-XXXX-XXXX" required>';form.insertBefore(label,error);label.querySelector('input').focus();error.textContent='密码已验证，请输入第二步验证码';error.hidden=false}else{error.textContent=err.message;error.hidden=false}}finally{button.disabled=false;button.textContent='登录'}}
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
function taskTypeLabel(type){return ({'service-restart':'重启 systemd 服务','docker-restart':'重启 Docker 容器','docker-cleanup-safe':'安全清理 Docker'})[type]||type}
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
  const detail=action==='upgrade'?'升级期间不要关闭页面或重启服务器。LukePanel 会先创建快照，并在 dpkg 出错时尝试修复。':`${labels[action]}：${packages.join(', ')||'全部可升级软件包'}`
  if(!await askConfirm(detail,{title:labels[action],confirmText:'确认执行',danger}))return
  setBusy(true)
  try{
    let result
    if(action==='download'||action==='upgrade')result=await secureApi(`/api/v1/system/apt/${action}`,{method:'POST',body:'{}'})
    else result=await secureApi('/api/v1/system/apt/package',{method:'POST',body:jsonBody({action,packages})})
    state.modal={title:`${labels[action]}结果`,kind:'logs',content:result.output||'操作完成'};await loadUpdates();state.modal={title:`${labels[action]}结果`,kind:'logs',content:result.output||'操作完成'};render()
  }catch(error){await showError(error.message)}finally{setBusy(false)}
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
async function loadSnapshots(){state.errors.snapshots='';try{const out=await api('/api/v1/system/snapshots');state.snapshots=out.snapshots||out||[]}catch(error){state.errors.snapshots=error.message}finally{render()}}
function snapshotsPage(){
  if(!state.snapshots&&!state.errors.snapshots){queueMicrotask(loadSnapshots);return `<div class="page-wrap">${pageHeader('配置快照','读取快照')}${surfaceLoading()}</div>`}
  return `<div class="page-wrap snapshots-page">${pageHeader('配置快照','APT、SSH、DNS、Compose 等关键修改会自动留下可恢复快照',`<button id="refresh-snapshots" class="secondary-button compact">${icon('refresh',17)}刷新</button>`)}${errorBox(state.errors.snapshots)}<section class="snapshot-list">${(state.snapshots||[]).map(item=>`<article class="surface snapshot-card"><div><span class="status-badge muted"><i></i>${escapeHTML(item.kind)}</span><h2>${escapeHTML(item.name)}</h2><p>${escapeHTML(item.note||'自动创建的配置快照')}</p><small>${formatDate(item.created_at)} · ${formatBytes(item.size)} · ${item.items?.length||0} 项</small></div><details><summary>查看包含内容</summary><div class="snapshot-paths">${(item.items||[]).map(x=>`<code>${escapeHTML(x.original)}${x.exists?'':'（当时不存在）'}</code>`).join('')}</div></details><div class="resource-actions"><button class="primary-button compact" data-snapshot-action="restore" data-snapshot-id="${escapeHTML(item.id)}">恢复</button><button class="danger-button compact" data-snapshot-action="delete" data-snapshot-id="${escapeHTML(item.id)}">删除</button></div></article>`).join('')||'<div class="empty-list surface">还没有配置快照。执行关键系统修改后会自动出现在这里。</div>'}</section></div>`
}
async function snapshotAction(id,action){
  if(!await askConfirm(action==='restore'?'恢复会覆盖当前配置，但恢复前还会再创建一个回滚点。':'确认永久删除这个快照？',{title:action==='restore'?'恢复配置快照':'删除配置快照',confirmText:action==='restore'?'确认恢复':'确认删除',danger:true}))return
  try{await secureApi('/api/v1/system/snapshots',{method:'POST',body:jsonBody({id,action})});showToast(action==='restore'?'快照已恢复':'快照已删除');await loadSnapshots()}catch(error){await showError(error.message)}
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
async function showDockerLogs(id,title){state.modal={title,kind:'logs',content:'正在读取日志…'};render();try{const data=await api(`/api/v1/docker/logs?id=${encodeURIComponent(id)}&tail=500`);state.modal={title:`${title} 日志`,kind:'logs',content:data.logs||'暂无日志'};render()}catch(e){state.modal={title,kind:'error',content:e.message};render()}}
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
  return `<div class="page-wrap files-page">${pageHeader('文件管理','支持上传、下载、编辑、复制、移动、权限和回收站',`<button id="global-file-search" class="secondary-button compact">${icon('search',17)}<span>搜索</span></button><button id="new-file" class="secondary-button compact">${icon('plus',17)}<span>新建</span></button><button id="upload-file" class="primary-button compact">${icon('upload',17)}<span>上传</span></button><input id="upload-input" type="file" multiple hidden><input id="upload-folder-input" type="file" webkitdirectory directory multiple hidden><input id="upload-zip-input" type="file" accept=".zip,application/zip" hidden>`)}<div class="tab-bar surface file-tabs"><button class="active" data-file-view="files">文件</button><button data-file-view="recycle">回收站</button></div>${errorBox(state.errors.files)}${l?`<div class="file-toolbar surface"><button id="file-back" ${l.parent?'':'disabled'} aria-label="返回">${icon('back',19)}</button><button id="file-home" aria-label="根目录">${icon('home',18)}</button><div class="path-pill file-breadcrumb" title="${escapeHTML(l.path==='/'?'允许访问的位置':l.path)}">${fileBreadcrumb(l.path)}</div><button id="copy-current-path" data-copy-text="${escapeHTML(l.path)}" aria-label="复制当前路径">${icon('copy',18)}</button><button id="refresh-files" aria-label="刷新">${icon('refresh',18)}</button></div><div class="search-bar surface file-search">${icon('search',18)}<input id="file-search" value="${escapeHTML(state.fileFilter)}" placeholder="筛选当前目录"><span>${entries.length} / ${l.entries.length}</span></div><section class="file-list surface">${entries.map(item=>`<div class="file-row"><button class="file-open" data-file-path="${escapeHTML(item.path)}" data-directory="${item.is_dir}"><div class="file-icon">${icon(item.is_dir?'folder':'file',22)}</div><div class="file-main"><strong title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</strong><span>${item.is_dir?'文件夹':formatBytes(item.size)} · ${formatDate(item.modified_at)}</span></div><code>${escapeHTML(item.mode)}</code>${icon('chevron',18)}</button>${l.path==='/'?'':`<button class="file-more" data-file-menu="${escapeHTML(item.path)}" aria-label="更多操作">${icon('more',19)}</button>`}</div>`).join('')||'<div class="empty-list">这个目录是空的</div>'}</section>`:''}</div>`
}
async function openFile(path){
  state.modal={title:'读取文件',kind:'loading',content:''};render()
  try{
    const preview=await api(`/api/v1/files/preview?path=${encodeURIComponent(path)}`)
    if(['text','markdown'].includes(preview.kind)){
      const data=await api(`/api/v1/files/content?path=${encodeURIComponent(path)}`);state.fileContent=data;state.modal={title:data.name,kind:'editor',content:data.content,path:data.path,dirty:false,preview_kind:preview.kind};render();return
    }
    if(['image','pdf'].includes(preview.kind)){state.modal={title:preview.name,kind:'file-preview',preview};render();return}
    if(preview.kind==='archive'){const list=await api(`/api/v1/files/archive/list?path=${encodeURIComponent(path)}`);state.modal={title:preview.name,kind:'archive-list',preview,list};render();return}
    location.href=`/api/v1/files/download?path=${encodeURIComponent(path)}`;state.modal=null;render();showToast('已开始下载')
  }catch(e){state.modal={title:'无法打开文件',kind:'error',content:e.message};render()}
}
function openFileMenu(path){const item=(state.files?.entries||[]).find(entry=>entry.path===path);if(!item)return;state.modal={title:item.name,kind:'file-actions',path:item.path,item};render()}
async function saveFile(){const editor=document.querySelector('#file-editor');if(!editor||!state.modal?.path)return;const button=document.querySelector('#save-file');button.disabled=true;button.textContent='保存中…';try{await secureApi('/api/v1/files/content',{method:'PUT',body:jsonBody({path:state.modal.path,content:editor.value})});state.modal.content=editor.value;state.modal.dirty=false;button.textContent='已保存';showToast('文件已保存，并创建历史版本');setTimeout(()=>{if(document.querySelector('#save-file'))document.querySelector('#save-file').textContent='保存'},1200)}catch(e){await showError(e.message);button.textContent='保存'}finally{button.disabled=false}}
async function createEntry(){
  if(!state.files||state.files.path==='/'){await showError('请先进入一个实际目录');return}
  const choice=await chooseAction('新建内容',[{label:'新建文件夹',description:'创建一个空目录'},{label:'新建文件',description:'创建一个空文本文件'}]);if(choice===false||choice===null)return
  const type=choice===0?'folder':'file',name=await askText('',{title:type==='folder'?'文件夹名称':'文件名称',placeholder:type==='folder'?'例如 config':'例如 config.yaml'});if(!name)return
  const base=state.files.path.replace(/\/$/,''),path=`${base}/${name}`
  try{await secureApi(type==='folder'?'/api/v1/files/mkdir':'/api/v1/files/create',{method:'POST',body:jsonBody({path})});await loadFiles(state.files.path);showToast(`${type==='folder'?'文件夹':'文件'}已创建`)}catch(e){await showError(e.message)}
}
async function uploadSelected(files,preservePaths=false){
  if(!state.files||state.files.path==='/'){await showError('请先进入目标目录');return}
  const list=Array.from(files||[]);if(!list.length)return
  setBusy(true);let completed=0
  try{for(const file of list){const form=new FormData();form.append('directory',state.files.path);form.append('relative_path',preservePaths?(file.webkitRelativePath||file.name):file.name);form.append('overwrite','false');form.append('file',file);await secureApi('/api/v1/files/upload',{method:'POST',body:form});completed++}await loadFiles(state.files.path);showToast(`已上传 ${completed} 个${preservePaths?'文件夹内文件':'文件'}`)}catch(e){await showError(`已上传 ${completed}/${list.length} 个文件。${e.message}`)}finally{setBusy(false)}
}
async function uploadAndExtractZIP(files){
  const file=Array.from(files||[])[0];if(!file||!state.files||state.files.path==='/')return
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
  const githubCard=`<article class="tool-card surface optional-tool-card"><div class="tool-icon">${icon('github',22)}</div><div class="optional-tool-heading"><h2>GitHub 助手</h2><span>${githubEnabled?'已启用':'可选功能'}</span></div><p>网页登录、上传 ZIP、预览改动、Commit、Push、分支、PR 与 Release。</p>${githubEnabled?`<div class="optional-tool-actions"><a data-nav href="/github" class="primary-button">打开助手</a><button id="github-helper-remove" class="secondary-button">停用</button></div>`:`<button id="github-helper-install" class="primary-button">启用 GitHub 助手</button>`}</article>`
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
  if(auth.connected)return `<section class="surface github-auth-card connected"><div class="github-user">${auth.avatar_url?`<img src="${escapeHTML(auth.avatar_url)}" alt="">`:icon('github',24)}<div><strong>已连接 @${escapeHTML(auth.login)}</strong><span>授权仅保存在当前 LukePanel 会话内，退出或重启后自动清除</span></div></div><button id="github-disconnect" class="secondary-button compact">断开连接</button></section>`
  const clientID=localStorage.getItem('github-client-id')||''
  return `<section class="surface github-auth-card"><div><h2>通过 GitHub 网页登录</h2><p>首次需要创建一个 OAuth App，并开启 Device Flow。只填写公开的 Client ID，不需要 Client Secret。</p></div><details class="token-guide"><summary>一次性设置步骤</summary><ol><li>GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。</li><li>Homepage URL 填你的 LukePanel HTTPS 地址。</li><li>创建后勾选 <strong>Enable Device Flow</strong>。</li><li>复制 Client ID 到下方。以后只需在 GitHub 网页确认登录。</li></ol><a class="secondary-button compact" href="https://github.com/settings/developers" target="_blank" rel="noopener">${icon('external',15)}打开 OAuth Apps</a></details><form id="github-connect-form" class="github-connect-form"><label>OAuth App Client ID<input name="client_id" value="${escapeHTML(clientID)}" placeholder="例如 Ov23li..." required></label><button class="primary-button" type="submit">连接 GitHub</button></form>${state.githubFlow?`<div class="device-flow-box"><span>在 GitHub 页面输入代码</span><strong>${escapeHTML(state.githubFlow.user_code)}</strong><div><button id="copy-github-code" class="secondary-button compact">复制代码</button><a class="primary-button compact" href="${escapeHTML(state.githubFlow.verification_uri)}" target="_blank" rel="noopener">打开 GitHub 授权页</a></div><small>授权后此页面会自动检测，无需刷新。</small></div>`:''}</section>`
}
function githubImportHTML(data){
  if(!state.githubAuth?.connected)return `<section class="surface github-import-panel muted-panel"><h2>ZIP 推送</h2><p>连接 GitHub 后，可以像 Working Copy 一样上传源码 ZIP，预览变更并 Commit + Push。</p></section>`
  const defaults=githubDefaults(),plan=state.githubImportPlan
  return `<section class="surface github-import-panel"><div><h2>上传 ZIP 并推送</h2><p>适合我给你的更新包：上传后先比较文件，再写入目标分支。默认只新增或覆盖，不会删除仓库里 ZIP 缺少的文件，也不会强制推送。</p></div><form id="github-import-form"><label>所有者<input name="owner" value="${escapeHTML(data?.owner||defaults.owner)}" required></label><label>仓库<input name="repo" value="${escapeHTML(data?.name||defaults.repo)}" required></label><label>分支<input name="branch" value="${escapeHTML(defaults.branch||data?.default_branch)}" required></label><label class="wide-field">源码 ZIP<input name="file" type="file" accept=".zip,application/zip" required></label><button class="primary-button" type="submit">上传并预览差异</button></form>${plan?`<div class="import-preview"><div class="import-counts"><span><b>${plan.added}</b>新增</span><span><b>${plan.modified}</b>修改</span><span><b>${plan.unchanged}</b>未变化</span><span><b>${plan.skipped}</b>已忽略</span></div><div class="import-file-list">${(plan.changes||[]).slice(0,120).map(c=>`<div><b class="change-${escapeHTML(c.status)}">${c.status==='added'?'新增':c.status==='modified'?'修改':'不变'}</b><code>${escapeHTML(c.path)}</code><span>${formatBytes(c.size)}</span></div>`).join('')}</div><form id="github-import-commit-form"><label>提交说明<input name="message" value="update LukePanel from uploaded ZIP" maxlength="200" required></label><button class="primary-button" type="submit">Commit 并 Push 到 ${escapeHTML(plan.branch)}</button></form><p class="release-warning">${icon('shield',17)}提交前会再次确认远端分支没有变化；若别人刚推送过，LukePanel 会拒绝覆盖。</p></div>`:''}</section>`
}
function githubBranchHTML(data){
  const branches=data.branches||[],defaults=githubDefaults()
  return `<section class="surface github-workflow-panel"><div><h2>分支与 Pull Request</h2><p>建议先从 main 新建分支，把 ZIP 推送到新分支，确认无误后再创建 PR 合并。这样出错更容易撤回。</p></div><div class="branch-chips">${branches.slice(0,20).map(branch=>`<span>${escapeHTML(branch.name)}${branch.protected?' · 受保护':''}</span>`).join('')||'<span>暂无分支数据</span>'}</div><div class="github-workflow-forms"><form id="github-branch-form"><h3>1. 新建分支</h3><label>新分支名称<input name="name" value="agent/update-${new Date().toISOString().slice(0,10)}" placeholder="agent/update-panel" required></label><label>基于分支<select name="source">${branches.map(branch=>`<option value="${escapeHTML(branch.name)}" ${branch.name===(data.default_branch||defaults.branch)?'selected':''}>${escapeHTML(branch.name)}</option>`).join('')}</select></label><button class="primary-button" type="submit" ${state.githubAuth?.connected?'':'disabled'}>创建分支</button></form><form id="github-pr-form"><h3>2. 创建 Pull Request</h3><label>提交分支<select name="head">${branches.filter(branch=>branch.name!==data.default_branch).map(branch=>`<option value="${escapeHTML(branch.name)}">${escapeHTML(branch.name)}</option>`).join('')}</select></label><label>目标分支<input name="base" value="${escapeHTML(data.default_branch)}" readonly></label><label>标题<input name="title" value="更新 LukePanel" maxlength="200" required></label><label>说明<textarea name="body" rows="4" placeholder="这次更新做了什么、为什么要更新"></textarea></label><button class="primary-button" type="submit" ${state.githubAuth?.connected&&branches.some(branch=>branch.name!==data.default_branch)?'':'disabled'}>创建 Pull Request</button></form></div></section>`
}
function githubPage(){
  if(!githubHelperEnabled())return `<div class="page-wrap github-page">${pageHeader('GitHub 助手','可选功能，不使用时不会发起任何 GitHub 请求')}<section class="surface optional-feature-empty"><div class="feature-illustration">${icon('github',34)}</div><h2>GitHub 助手尚未启用</h2><p>启用后可以网页登录、上传更新 ZIP、预览差异、Commit、Push、创建分支和 Pull Request。</p><button id="github-helper-install" class="primary-button">启用 GitHub 助手</button><a data-nav href="/tools" class="secondary-button">返回常用工具</a></section></div>`
  const defaults=githubDefaults(),data=state.github
  if(!state.githubAuth&&!state.loading.githubAuth){state.loading.githubAuth=true;queueMicrotask(async()=>{await loadGitHubAuth(true);state.loading.githubAuth=false;render()})}
  const latest=data?.latest_release,tagSuggestion=latest?.tag_name?nextVersionSuggestion(latest.tag_name):'v0.8.0-alpha'
  const actions=`<button id="github-helper-remove" class="secondary-button compact">停用助手</button>${data?`<a class="secondary-button compact" href="https://github.com/${escapeHTML(data.full_name)}/actions" target="_blank" rel="noopener">${icon('external',16)}<span>打开 Actions</span></a>`:''}`
  const repoEmpty=!data&&!state.loading.github&&!state.errors.github
  return `<div class="page-wrap github-page">${pageHeader('GitHub 助手','可选启用；仓库信息由你填写，不预设任何个人仓库',actions)}${githubAuthCard()}<form id="github-repo-form" class="surface github-repo-form"><div class="form-intro"><strong>选择要管理的仓库</strong><span>只会操作你明确填写并授权的仓库</span></div><label>所有者<input name="owner" value="${escapeHTML(data?.owner||defaults.owner)}" placeholder="例如 Luke-Lab666" autocomplete="off" required></label><label>仓库<input name="repo" value="${escapeHTML(data?.name||defaults.repo)}" placeholder="例如 LukePanel" autocomplete="off" required></label><button class="primary-button" type="submit">读取仓库</button></form>${errorBox(state.errors.github)}${state.loading.github?surfaceLoading('读取 GitHub 仓库'):repoEmpty?`<section class="surface github-repo-empty"><div>${icon('github',28)}</div><h2>还没有选择仓库</h2><p>填写所有者和仓库名后再读取。LukePanel 不会默认绑定开发者或你的任何仓库。</p></section>`:data?`<section class="github-summary-grid"><article class="surface status-card"><div class="card-heading">${icon('github',20)}<strong>${escapeHTML(data.full_name)}</strong></div><dl class="info-list"><div><dt>默认分支</dt><dd>${escapeHTML(data.default_branch)}</dd></div><div><dt>最新提交</dt><dd><code>${escapeHTML((data.main_sha||'').slice(0,12)||'-')}</code></dd></div><div><dt>分支</dt><dd>${data.branches?.length||0}</dd></div><div><dt>最新标签</dt><dd>${escapeHTML(data.tags?.[0]?.name||'暂无')}</dd></div><div><dt>最新 Release</dt><dd>${escapeHTML(latest?.tag_name||'暂无')}</dd></div></dl><div class="quick-copy-grid"><button class="secondary-button compact" data-copy-text="curl -fsSL https://raw.githubusercontent.com/${escapeHTML(data.full_name)}/main/install.sh | bash">复制安装命令</button><button class="secondary-button compact" data-copy-text="https://github.com/${escapeHTML(data.full_name)}">复制仓库地址</button></div></article><article class="surface status-card"><div class="card-heading">${icon('activity',20)}<strong>最近 Actions</strong></div><div class="workflow-list">${(data.workflow_runs||[]).slice(0,8).map(run=>`<div><span class="workflow-dot ${run.conclusion==='success'?'ok':run.status!=='completed'?'running':'bad'}"></span><div><strong>${escapeHTML(run.name)}</strong><small>${escapeHTML(run.head_branch||run.event)} · ${formatDate(run.created_at)}</small></div><div class="workflow-actions"><b>${workflowStatus(run)}</b><a href="${escapeHTML(run.html_url)}" target="_blank" rel="noopener">${icon('external',14)}</a>${['failure','cancelled','timed_out'].includes(run.conclusion)&&state.githubAuth?.connected?`<button data-github-rerun="${run.id}">重试</button>`:''}</div></div>`).join('')||'<div class="empty-list">暂无 Actions 记录</div>'}</div></article></section>${githubBranchHTML(data)}${githubImportHTML(data)}<section class="surface github-release-create"><div><h2>创建 GitHub Release</h2><p>适合已有 Tag 的版本，可生成发布说明；二进制附件仍建议由 Actions 自动上传。</p></div><form id="github-release-form" class="dialog-form"><label>Tag<input name="tag" value="${escapeHTML(data.tags?.[0]?.name||tagSuggestion)}" required></label><label>标题<input name="name" placeholder="留空则使用 Tag"></label><label>发布说明<textarea name="body" rows="5" placeholder="留空会让 GitHub 自动生成 Release Notes"></textarea></label><div class="option-row"><label class="checkbox-row"><input name="prerelease" type="checkbox" checked><span>预发布版本</span></label><label class="checkbox-row"><input name="draft" type="checkbox"><span>先保存为草稿</span></label></div><button class="primary-button" type="submit" ${state.githubAuth?.connected?'':'disabled'}>创建 Release</button></form></section><section class="surface release-helper"><div><h2>创建版本标签并触发 Release</h2><p>确认默认分支已经是要发布的版本后再创建 Tag。</p></div><form id="github-tag-form"><label>版本号<input name="tag" value="${escapeHTML(tagSuggestion)}" pattern="v[0-9][A-Za-z0-9._-]*" required></label><label>目标提交<input name="sha" value="${escapeHTML(data.main_sha||'')}" readonly></label><div class="release-warning">${icon('shield',17)}不会 Force Push，创建标签前需要二次验证。</div><button class="primary-button" type="submit" ${state.githubAuth?.connected?'':'disabled'}>${state.githubAuth?.connected?'创建 Tag 并触发发布':'请先连接 GitHub'}</button></form></section>`:''}</div>`
}
function nextVersionSuggestion(current){const match=String(current).match(/^v(\d+)\.(\d+)\.(\d+)(.*)$/);if(!match)return 'v0.8.0-alpha';return `v${match[1]}.${Number(match[2])+1}.0-alpha`}

async function startGitHubDeviceFlow(form){const f=new FormData(form),clientID=String(f.get('client_id')||'').trim(),button=form.querySelector('button');if(!/^[A-Za-z0-9]{12,80}$/.test(clientID)){await showError('Client ID 格式不正确，请从 GitHub OAuth App 页面完整复制');return}localStorage.setItem('github-client-id',clientID);button.disabled=true;button.textContent='正在创建登录…';try{state.githubFlow=await api('/api/v1/github/auth/device/start',{method:'POST',body:jsonBody({client_id:clientID})});render();window.open(state.githubFlow.verification_uri,'_blank','noopener');scheduleGitHubPoll()}catch(error){await showError(error.message)}finally{button.disabled=false;button.textContent='连接 GitHub'}}
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
async function buildDockerImage(form){const f=new FormData(form),button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='正在构建…';try{const out=await secureApi('/api/v1/docker/images/build',{method:'POST',body:jsonBody({context_dir:f.get('context_dir'),dockerfile:f.get('dockerfile'),tag:f.get('tag'),pull:f.get('pull')==='on',no_cache:f.get('no_cache')==='on'})});state.modal={title:`镜像 ${out.tag} 构建完成`,kind:'logs',content:out.output||'构建成功'};await loadDocker();state.modal={title:`镜像 ${out.tag} 构建完成`,kind:'logs',content:out.output||'构建成功'};render()}catch(error){await showError(error.message)}finally{button.disabled=false;button.textContent='开始构建'}}
async function confirmSSHPort(keepNew){if(!await askConfirm(keepNew?'确认你已经从另一个终端通过新端口成功登录？确认后旧端口将关闭。':'将删除新端口并恢复旧端口。',{title:keepNew?'确认新 SSH 端口':'恢复旧 SSH 端口',confirmText:'确认',danger:!keepNew}))return;try{await secureApi('/api/v1/ssh/port/confirm',{method:'POST',body:jsonBody({keep_new:keepNew})});showToast(keepNew?'已关闭旧端口':'已恢复旧端口');await loadSSH(state.sshUser)}catch(error){await showError(error.message)}}
async function createGitHubRelease(form){const f=new FormData(form),defaults=githubDefaults(),data=state.github;if(!data)return;try{const out=await secureApi('/api/v1/github/release',{method:'POST',body:jsonBody({owner:data.owner||defaults.owner,repo:data.name||defaults.repo,tag:f.get('tag'),name:f.get('name'),body:f.get('body'),draft:f.get('draft')==='on',prerelease:f.get('prerelease')==='on'})});showToast(`Release ${out.tag_name||f.get('tag')} 已创建`);await loadGitHub(data.owner,data.name)}catch(error){await showError(error.message)}}

function modalHTML(){
  if(!state.modal)return''
  const m=state.modal;let body='',footer=''
  if(m.kind==='loading')body='<div class="modal-loading"><div class="spinner"></div></div>'
  else if(m.kind==='logs'){body=`<pre class="modal-log">${escapeHTML(m.content)}</pre>`;footer=`<footer><button class="secondary-button compact" id="copy-modal-log">${icon('copy',16)}复制全部</button><button class="primary-button compact" id="modal-done">完成</button></footer>`}
  else if(m.kind==='error')body=`<div class="alert error modal-error">${icon('alert',18)}${escapeHTML(m.content)}</div>`
  else if(m.kind==='editor'){
    body=`<textarea id="file-editor" spellcheck="false">${escapeHTML(m.content)}</textarea>`
    footer=`<footer><div class="editor-secondary-actions"><button id="copy-file-path" class="secondary-button compact">${icon('copy',16)}路径</button><button id="copy-file-content" class="secondary-button compact">${icon('copy',16)}内容</button><button id="download-file" class="secondary-button compact">${icon('download',16)}下载</button><button id="file-history" class="secondary-button compact">${icon('restore',16)}历史</button><button id="rename-file" class="secondary-button compact">重命名</button><button id="delete-file" class="danger-button compact">${icon('trash',16)}删除</button></div><button id="save-file" class="primary-button compact">${icon('save',16)}保存</button></footer>`
  }else if(m.kind==='file-actions'){
    const item=m.item
    body=`<div class="action-sheet"><button data-file-action="copy-path">${icon('copy',19)}<span>复制完整路径</span></button>${item.is_dir?'':`<button data-file-action="download">${icon('download',19)}<span>下载文件</span></button><button data-file-action="history">${icon('restore',19)}<span>历史版本</span></button>`}<button data-file-action="rename">${icon('edit',19)}<span>重命名</span></button><button data-file-action="copy">${icon('copy',19)}<span>复制到…</span></button><button data-file-action="move">${icon('move',19)}<span>移动到…</span></button><button data-file-action="archive">${icon('package',19)}<span>压缩为…</span></button><button data-file-action="chmod">${icon('shield',19)}<span>修改权限</span><small>${escapeHTML(item.mode||'')}</small></button><button class="danger" data-file-action="delete">${icon('trash',19)}<span>移入回收站</span></button></div>`
  }else if(m.kind==='upload-menu'){
    body=`<div class="action-sheet"><button id="choose-files-upload">${icon('file',19)}<span>上传文件</span><small>可多选</small></button><button id="choose-folder-upload">${icon('folder',19)}<span>上传整个文件夹</span><small>保留目录结构</small></button><button id="choose-zip-extract">${icon('package',19)}<span>上传 ZIP 并解压</span><small>适合 iPhone 和大量文件</small></button></div>`
  }else if(m.kind==='docker-cleanup'){
    const x=m.preview||{}
    body=`<form id="docker-cleanup-form" class="dialog-form"><div class="cleanup-summary"><span><b>${x.stopped_containers||0}</b>停止容器</span><span><b>${(x.dangling_images||0)+(x.unused_images||0)}</b>未用镜像</span><span><b>${x.unused_networks||0}</b>未用网络</span><span><b>${x.unused_volumes||0}</b>未用卷</span><span><b>${formatBytes(x.reclaimable_bytes||0)}</b>预计可释放</span></div><label>清理模式<select name="mode"><option value="safe">安全清理（推荐）</option><option value="deep">深度清理未使用镜像</option></select></label><label class="checkbox-row"><input type="checkbox" name="volumes"><span>同时清理未使用的存储卷</span></label><div class="release-warning">${icon('shield',17)}正在运行或被引用的资源不会删除；存储卷可能包含重要数据，默认不勾选。</div><button class="danger-button" type="submit">检查后执行清理</button></form>`
  }else if(m.kind==='docker-network')body=`<form id="docker-network-form" class="dialog-form"><label>网络名称<input name="name" placeholder="例如 app-network" required></label><label>驱动<select name="driver"><option value="bridge">bridge（推荐）</option><option value="macvlan">macvlan</option><option value="ipvlan">ipvlan</option></select></label><label>子网（可选）<input name="subnet" placeholder="172.30.0.0/16"></label><label>网关（可选）<input name="gateway" placeholder="172.30.0.1"></label><label class="checkbox-row"><input type="checkbox" name="internal"><span>仅内部网络，不访问外网</span></label><button class="primary-button" type="submit">创建网络</button></form>`
  else if(m.kind==='docker-volume')body=`<form id="docker-volume-form" class="dialog-form"><label>存储卷名称<input name="name" placeholder="例如 app-data" required></label><label>驱动<input name="driver" value="local" required></label><button class="primary-button" type="submit">创建存储卷</button></form>`
  else if(m.kind==='task-create')body=`<form id="task-create-form" class="dialog-form"><label>任务名称<input name="name" placeholder="例如每天重启 mosdns" required></label><label>安全任务类型<select name="type" id="task-type"><option value="service-restart">重启 systemd 服务</option><option value="docker-restart">重启 Docker 容器</option><option value="docker-cleanup-safe">安全清理 Docker</option></select></label><label id="task-target-label">目标名称<input name="target" placeholder="例如 mosdns.service" required></label><label>执行频率<select name="frequency" id="task-frequency"><option value="daily">每天</option><option value="weekly">每周</option><option value="hourly">每小时</option></select></label><div class="time-fields"><label>小时<input name="hour" type="number" min="0" max="23" value="4"></label><label>分钟<input name="minute" type="number" min="0" max="59" value="0"></label><label id="task-weekday-label">星期<select name="weekday"><option value="1">周一</option><option value="2">周二</option><option value="3">周三</option><option value="4">周四</option><option value="5">周五</option><option value="6">周六</option><option value="0">周日</option></select></label></div><div class="release-warning">${icon('shield',17)}不支持自定义 Shell，避免计划任务变成远程 WebShell。</div><button class="primary-button" type="submit">创建计划任务</button></form>`
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
  document.querySelector('#github-helper-install')?.addEventListener('click',()=>{if(localStorage.getItem('github-helper-v07')!=='1'){localStorage.removeItem('github-owner');localStorage.removeItem('github-repo');localStorage.removeItem('github-branch');localStorage.setItem('github-helper-v07','1')}localStorage.setItem('github-helper-enabled','1');showToast('GitHub 助手已启用，请选择自己的仓库');render()})
  document.querySelector('#github-helper-remove')?.addEventListener('click',async()=>{if(!await askConfirm('停用只会隐藏入口，不会修改 GitHub 仓库。',{title:'停用 GitHub 助手',confirmText:'停用'}))return;localStorage.removeItem('github-helper-enabled');state.github=null;state.githubAuth=null;if(location.pathname==='/github')navigate('/tools');else render()})

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
  const taskForm=document.querySelector('#task-create-form');if(taskForm){taskForm.onsubmit=event=>{event.preventDefault();createTask(taskForm)};const type=taskForm.querySelector('#task-type'),frequency=taskForm.querySelector('#task-frequency'),syncTaskForm=()=>{const target=taskForm.querySelector('#task-target-label'),weekday=taskForm.querySelector('#task-weekday-label'),hour=taskForm.querySelector('[name=hour]');target.hidden=type.value==='docker-cleanup-safe';target.querySelector('input').required=!target.hidden;weekday.hidden=frequency.value!=='weekly';hour.closest('label').hidden=frequency.value==='hourly'};type.onchange=syncTaskForm;frequency.onchange=syncTaskForm;syncTaskForm()}
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
  document.querySelectorAll('[data-file-action]').forEach(button=>button.onclick=()=>{
    const action=button.dataset.fileAction,item=state.modal?.item;if(!item)return
    if(action==='copy-path'){copyText(item.path,'路径已复制');return}
    if(action==='download'){location.href=`/api/v1/files/download?path=${encodeURIComponent(item.path)}`;return}
    if(action==='history'){loadFileBackups(item.path);return}
    if(action==='archive'){createArchive(item);return}
    fileMutation(action,item)
  })
  document.querySelector('#file-editor')?.addEventListener('input',()=>{if(state.modal)state.modal.dirty=true})
  document.querySelector('#save-file')?.addEventListener('click',saveFile)
  document.querySelector('#copy-file-path')?.addEventListener('click',()=>copyText(state.modal?.path||'','路径已复制'))
  document.querySelector('#copy-file-content')?.addEventListener('click',()=>copyText(document.querySelector('#file-editor')?.value||'','内容已复制'))
  document.querySelector('#download-file')?.addEventListener('click',()=>{location.href=`/api/v1/files/download?path=${encodeURIComponent(state.modal.path)}`})
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
  app.innerHTML=shell((routes[location.pathname]||routes['/'])());bindShell();syncOverviewUpdates();syncDockerStats()
}

restore()
