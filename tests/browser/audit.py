#!/usr/bin/env python3
from __future__ import annotations
import asyncio, base64, json, mimetypes, os, sys, time
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[2]
WEB=ROOT/'web'
REPORTS=ROOT/'reports'
SHOTS=REPORTS/'screenshots'
FIXTURES=json.loads((ROOT/'tests/browser/mock_api.json').read_text())
BACKEND_SOURCE='\n'.join(p.read_text(errors='ignore') for p in (ROOT/'internal').rglob('*.go'))
ROUTES=['/','/system','/system/services','/system/processes','/system/network','/system/storage','/system/tasks','/system/updates','/system/host','/system/snapshots','/docker','/files','/tools','/tools/github','/ssh','/audit','/security','/settings']
NESTED={p for p in ROUTES if p.startswith('/system/') or p=='/tools/github'}
TITLES={'/':'概览','/system':'系统','/system/services':'服务管理','/system/processes':'进程管理','/system/network':'网络状态','/system/storage':'存储空间','/system/tasks':'计划任务','/system/updates':'软件管理','/system/host':'主机设置','/system/snapshots':'备份与快照','/docker':'Docker','/files':'文件管理','/tools':'常用工具','/tools/github':'GitHub 助手','/ssh':'SSH 管理','/audit':'日志中心','/security':'安全中心','/settings':'我的'}
DEVICES=[('phone-320',320,900),('phone-360',360,800),('iphone-se',375,667),('iphone-390',390,844),('iphone-max',430,932),('phone-landscape',844,390),('tablet-768',768,1024),('tablet-landscape',1024,768),('desktop-1280',1280,800),('desktop-1440',1440,900),('desktop-1920',1920,1080)]
SCRIPTS=['vendor-runtime.js','react-18.2.0.js','react-dom-18.2.0.js','react-bootstrap.js','app.js']
INTERACTION_COUNT=51
INTERACTION_CHUNK_SIZE=5
REPRESENTATIVE={('phone-320','/security'):'security-phone-320.png',('iphone-390','/'):'dashboard-iphone-390.png',('phone-320','/files'):'files-phone-320.png',('phone-landscape','/settings'):'settings-landscape.png',('desktop-1440','/security'):'security-desktop-1440.png',('desktop-1440','/'):'dashboard-desktop-1440.png',('desktop-1920','/docker'):'docker-desktop-1920.png',('phone-390-login','/login'):'login-phone-390.png'}

class MockState:
    REGISTERED_MUTATIONS = {
        ('POST','/api/v1/auth/elevate'), ('POST','/api/v1/auth/logout'),
        ('PATCH','/api/v1/auth/account'), ('POST','/api/v1/auth/password'),
        ('DELETE','/api/v1/auth/sessions'), ('DELETE','/api/v1/auth/passkeys'),
        ('POST','/api/v1/auth/totp/setup'),
        ('POST','/api/v1/auth/totp/confirm'), ('POST','/api/v1/auth/totp/disable'),
        ('POST','/api/v1/auth/totp/recovery'), ('POST','/api/v1/auth/passkey/register/begin'),
        ('POST','/api/v1/auth/passkey/register/finish'), ('PATCH','/api/v1/settings'),
        ('POST','/api/v1/system/services/action'), ('POST','/api/v1/system/processes/action'),
        ('POST','/api/v1/system/tasks/create'), ('POST','/api/v1/system/tasks/action'),
        ('POST','/api/v1/system/apt/download'), ('POST','/api/v1/system/apt/upgrade'),
        ('POST','/api/v1/system/apt/package'), ('POST','/api/v1/system/apt/sources'),
        ('POST','/api/v1/system/host/hostname'), ('POST','/api/v1/system/host/timezone'),
        ('POST','/api/v1/system/host/dns'), ('POST','/api/v1/system/host/ntp'),
        ('POST','/api/v1/system/host/swap'), ('DELETE','/api/v1/system/host/swap'),
        ('POST','/api/v1/system/host/sysctl'), ('POST','/api/v1/system/snapshots'),
        ('POST','/api/v1/backup/scheduled'), ('POST','/api/v1/backup/import'),
        ('POST','/api/v1/docker/install'), ('POST','/api/v1/docker/action'),
        ('POST','/api/v1/docker/recreate'), ('POST','/api/v1/docker/compose/action'),
        ('POST','/api/v1/docker/compose/create'), ('PUT','/api/v1/docker/compose/config'),
        ('POST','/api/v1/docker/images/pull'), ('POST','/api/v1/docker/images/build'),
        ('POST','/api/v1/docker/images/delete'), ('POST','/api/v1/docker/networks/create'),
        ('POST','/api/v1/docker/networks/delete'), ('POST','/api/v1/docker/volumes/create'),
        ('POST','/api/v1/docker/volumes/delete'), ('POST','/api/v1/docker/volumes/archive'),
        ('POST','/api/v1/docker/cleanup'), ('POST','/api/v1/docker/exec'),
        ('POST','/api/v1/files/create'), ('POST','/api/v1/files/mkdir'),
        ('POST','/api/v1/files/rename'), ('POST','/api/v1/files/copy'),
        ('POST','/api/v1/files/move'), ('POST','/api/v1/files/chmod'),
        ('POST','/api/v1/files/chown'), ('POST','/api/v1/files/archive/create'),
        ('POST','/api/v1/files/delete'), ('PUT','/api/v1/files/content'),
        ('POST','/api/v1/files/backups/restore'), ('POST','/api/v1/files/preferences'),
        ('POST','/api/v1/files/recycle'), ('POST','/api/v1/files/archive/extract'),
        ('POST','/api/v1/files/upload'), ('POST','/api/v1/tools/run'),
        ('POST','/api/v1/github/auth/token'), ('POST','/api/v1/github/auth/device/start'),
        ('POST','/api/v1/github/auth/device/poll'), ('POST','/api/v1/github/auth/device/cancel'),
        ('POST','/api/v1/github/auth/disconnect'), ('POST','/api/v1/github/branch'),
        ('POST','/api/v1/github/tag'), ('POST','/api/v1/github/pull'),
        ('POST','/api/v1/github/pull/merge'), ('POST','/api/v1/github/rerun'),
        ('POST','/api/v1/github/release'), ('POST','/api/v1/github/import/preview'),
        ('POST','/api/v1/github/import/commit'), ('POST','/api/v1/github/release/assets/upload'),
        ('POST','/api/v1/ssh/settings'), ('POST','/api/v1/ssh/password'),
        ('POST','/api/v1/ssh/port/confirm'), ('POST','/api/v1/ssh/keys/add'),
        ('POST','/api/v1/ssh/keys/delete'), ('POST','/api/v1/ssh/keys/generate'),
        ('POST','/api/v1/ssh/users/manage'), ('POST','/api/v1/security/firewall/install'),
        ('POST','/api/v1/security/firewall/enable'), ('POST','/api/v1/security/firewall/confirm'),
        ('POST','/api/v1/security/firewall/disable'), ('POST','/api/v1/security/auto-updates/enable'),
        ('POST','/api/v1/security/fail2ban/install'), ('POST','/api/v1/security/fail2ban/unban'),
        ('POST','/api/v1/security/fail2ban/ignore'), ('POST','/api/v1/security/ip-allowlist'),
        ('POST','/api/v1/security/login-notifications'),
    }
    def __init__(self, authenticated=True):
        self.authenticated=authenticated
        self.firewall=json.loads(json.dumps(FIXTURES['/api/v1/security/firewall']['payload']))
        self.requests=[]
        self.unknown_requests=[]
        self.github_connected=False
        self.file_content='server {\n  listen 80;\n}\n'
        self.preferences=json.loads(json.dumps(FIXTURES['/api/v1/files/preferences']['payload']))
        self.force_failures={}
        self.force_sequences={}
    def response(self,status=200,payload=None):
        return {'status':status,'payload':payload if payload is not None else {'ok':True}}
    async def request(self, req):
        method=str(req.get('method','GET')).upper(); raw=str(req.get('url',''))
        parsed=urlparse(raw); path=parsed.path or raw.split('?')[0]
        body=req.get('body')
        if isinstance(body,str):
            try: body=json.loads(body)
            except Exception: pass
        self.requests.append({'method':method,'path':path,'body':body,'query':parsed.query})
        sequence=self.force_sequences.get((method,path))
        if sequence:
            forced=sequence.pop(0)
            if not sequence: self.force_sequences.pop((method,path),None)
            return forced
        forced=self.force_failures.get((method,path))
        if forced: return forced
        if path=='/api/v1/auth/me' and not self.authenticated:
            return self.response(401,{'error':'未登录','code':'session_required'})
        if path=='/api/v1/auth/login' and method=='POST':
            self.authenticated=True
            return self.response(200,{'username':'admin','csrf_token':'audit-csrf','session_id':'audit-session'})
        if path=='/api/v1/auth/passkey/login/begin' and method=='POST':
            return self.response(200,{'flow_id':'passkey-flow','public_key':{'challenge':'AQID','rp_id':'lukepanel.test','allow_credentials':[]}})
        if path=='/api/v1/auth/passkey/login/finish' and method=='POST':
            self.authenticated=True
            return self.response(200,{'username':'admin','csrf_token':'audit-csrf','session_id':'audit-session'})
        if path=='/api/v1/auth/elevate' and method=='POST':
            return self.response(200,{'ok':True})
        if path=='/api/v1/security/firewall' and method=='GET':
            return self.response(200,self.firewall)
        if path=='/api/v1/security/firewall/rule' and method=='POST':
            operation=(body or {}).get('operation') if isinstance(body,dict) else None
            if operation=='add':
                rule=(body or {}).get('rule') or {}
                if str(rule.get('port'))=='9999':
                    return self.response(400,{'error':'添加规则失败','command':'ufw allow in proto tcp from any to any port 9999','output':'ERROR: Bad port'})
                n=max([int(r.get('number',0)) for r in self.firewall['rules']]+[0])+1
                self.firewall['rules'].append({'number':n,'to':f"{rule.get('port','')}/{rule.get('protocol','tcp')}",'action':f"{str(rule.get('action','allow')).upper()} {str(rule.get('direction','in')).upper()}",'from':rule.get('source') or 'Anywhere'})
                return self.response()
            if operation=='delete':
                number=int((body or {}).get('number',0)); self.firewall['rules']=[r for r in self.firewall['rules'] if int(r.get('number',0))!=number]
                return self.response()
        if path=='/api/v1/github/auth/status' and method=='GET':
            return self.response(200,{'connected':self.github_connected,'login':'luke-audit' if self.github_connected else '', 'name':'Luke Audit','device_login_available':True})
        if path=='/api/v1/github/auth/token' and method=='POST':
            self.github_connected=True
            return self.response(200,{'connected':True,'login':'luke-audit','name':'Luke Audit','scope':'repo'})
        if path=='/api/v1/github/repositories' and method=='GET':
            return self.response(200,{'repositories':[{'id':1,'name':'LukePanel','full_name':'Luke-Lab666/LukePanel','private':False,'default_branch':'main','updated_at':'2026-08-02T00:00:00Z','owner':{'login':'Luke-Lab666'},'permissions':{'admin':True,'push':True,'pull':True}}]})
        if path=='/api/v1/github/auth/disconnect' and method=='POST':
            self.github_connected=False
            return self.response()
        if path=='/api/v1/github/auth/device/start' and method=='POST':
            return self.response(200,{'flow_id':'device-flow','device_code':'secret','user_code':'ABCD-EFGH','verification_uri':'https://github.com/login/device','interval':5})
        if path=='/api/v1/github/auth/device/poll' and method=='POST':
            self.github_connected=True
            return self.response(200,{'status':'authorized','login':'luke-audit'})
        if path=='/api/v1/github/summary' and method=='GET':
            return self.response(200,{
                'owner':'Luke-Lab666','name':'LukePanel','full_name':'Luke-Lab666/LukePanel','description':'Audit repository','visibility':'public',
                'default_branch':'main','main_sha':'0123456789abcdef0123456789abcdef01234567',
                'branches':[{'name':'main'},{'name':'feature/audit'}], 'tags':[{'name':'v1.1.2'}],
                'latest_release':{'tag_name':'v1.1.2','name':'LukePanel v1.1.2','published_at':'2026-08-01T00:00:00Z'},
                'workflow_runs':[{'id':77,'name':'CI','status':'completed','conclusion':'failure','head_branch':'main','created_at':'2026-08-02T00:00:00Z'}],
                'pull_requests':[{'number':12,'title':'Audit PR','head':'feature/audit','base':'main','head_sha':'abcdef','state':'open','draft':False,'html_url':'https://github.com/example/pr/12'}]
            })
        if path=='/api/v1/github/actions/jobs' and method=='GET':
            return self.response(200,{'jobs':[{'id':88,'name':'test','status':'completed','conclusion':'failure','started_at':'2026-08-02T00:00:00Z'}]})
        if path=='/api/v1/github/actions/job-logs' and method=='GET':
            return self.response(200,{'logs':'go test ./...\nFAIL audit'})
        if path=='/api/v1/github/release/assets' and method=='GET':
            return self.response(200,{'assets':[{'id':1,'name':'lukepanel.tar.gz','size':1024,'download_count':2,'created_at':'2026-08-01T00:00:00Z','browser_download_url':'https://example.invalid/file'}]})
        if path=='/api/v1/github/branch' and method=='POST': return self.response(200,{'name':(body or {}).get('name'),'sha':'abc'})
        if path=='/api/v1/github/pull' and method=='POST': return self.response(200,{'number':13,'html_url':'https://example.invalid/pr/13'})
        if path=='/api/v1/github/release' and method=='POST': return self.response(200,{'tag_name':(body or {}).get('tag'),'html_url':'https://example.invalid/release'})
        if path=='/api/v1/github/import/commit' and method=='POST': return self.response(200,{'sha':'abc','branch':'main','html_url':'https://example.invalid/commit'})
        if path=='/api/v1/system/services/logs' and method=='GET': return self.response(200,{'logs':'service log line'})
        if path=='/api/v1/system/apt/search' and method=='GET': return self.response(200,{'packages':[{'name':'curl','description':'command line transfer tool','candidate':'8.0','installed':True}]})
        if path=='/api/v1/docker/logs' and method=='GET': return self.response(200,{'logs':'container log'})
        if path=='/api/v1/docker/inspect' and method=='GET':
            return self.response(200,{'id':'abcdef0123456789','name':'adguardhome','image':'adguard/adguardhome:latest','env':['TZ=Asia/Shanghai'],'cmd':[],'entrypoint':[],'working_dir':'/opt','user':'','hostname':'adguard','restart_policy':'unless-stopped','restart_maximum_retry_count':0,'network_mode':'bridge','privileged':False,'running':True,'ports':[{'host_ip':'0.0.0.0','host_port':'3000','container_port':'3000','protocol':'tcp'}],'mounts':[{'type':'bind','source':'/opt/adguard','target':'/opt/adguardhome/work','read_only':False}]})
        if path=='/api/v1/docker/compose/config' and method=='GET':
            return self.response(200,{'files':[{'path':'/opt/dns-stack/compose.yaml','content':'services:\n  adguard:\n    image: adguard/adguardhome:latest\n'},{'path':'/opt/dns-stack/.env','content':'TZ=Asia/Shanghai\n'}]})
        if path=='/api/v1/docker/cleanup/preview' and method=='GET': return self.response(200,{'images':1,'build_cache':'120MB','volumes':1})
        if path=='/api/v1/docker/exec' and method=='POST': return self.response(200,{'output':'uid=0(root)'})
        if path=='/api/v1/files/preferences' and method=='GET': return self.response(200,self.preferences)
        if path=='/api/v1/files/preferences' and method=='POST':
            return self.response(200,self.preferences)
        if path=='/api/v1/files/content' and method=='GET': return self.response(200,{'content':self.file_content})
        if path=='/api/v1/files/content' and method=='PUT':
            if isinstance(body,dict): self.file_content=str(body.get('content',''))
            return self.response()
        if path=='/api/v1/files/preview' and method=='GET': return self.response(200,{'kind':'text','content':self.file_content})
        if path=='/api/v1/files/archive/list' and method=='GET': return self.response(200,{'entries':[{'name':'file.txt','size':10}]})
        if path=='/api/v1/files/backups' and method=='GET': return self.response(200,{'versions':[{'id':'version-1','path':'/etc/nginx.conf','created_at':'2026-08-01T00:00:00Z','size':12}]})
        if path=='/api/v1/files/backups/diff' and method=='GET': return self.response(200,{'diff':'- old\n+ new'})
        if path=='/api/v1/files/search' and method=='GET': return self.response(200,{'entries':[{'name':'nginx.conf','path':'/etc/nginx.conf','is_dir':False,'size':40}]})
        if path=='/api/v1/tools/run' and method=='POST': return self.response(200,{'success':True,'output':'diagnostic ok','duration_ms':10})
        if path=='/api/v1/ssh/keys/generate' and method=='POST': return self.response(200,{'filename':'id_ed25519','private_key':'-----BEGIN OPENSSH PRIVATE KEY-----\nAUDIT\n-----END OPENSSH PRIVATE KEY-----','public_key':'ssh-ed25519 AAAA audit','fingerprint':'SHA256:audit'})
        if path=='/api/v1/security/ip-allowlist' and method=='POST': return self.response(200,{'ok':True,'recovery_path':'/api/v1/security/ip-allowlist/recover?token=audit'})
        if path=='/api/v1/auth/totp/setup' and method=='POST': return self.response(200,{'secret':'AUDITSECRET','otpauth_uri':'otpauth://totp/LukePanel:admin','recovery_codes':['AAAA-BBBB']})
        if path=='/api/v1/auth/passkey/register/begin' and method=='POST': return self.response(200,{'flow_id':'register-flow','public_key':{'challenge':'AQID','rp':{'name':'LukePanel'},'user':{'id':'AQID','name':'admin','display_name':'admin'},'pub_key_cred_params':[{'type':'public-key','alg':-7}]}})
        if (method,path) in self.REGISTERED_MUTATIONS:
            if path=='/api/v1/auth/sessions' and method=='DELETE': return self.response(200,{'revoked':1})
            return self.response()
        if method=='GET':
            fixture=FIXTURES.get(path)
            if fixture: return fixture
        unknown={'method':method,'path':path,'body':body}
        self.unknown_requests.append(unknown)
        return self.response(501,{'error':f'严格模拟后端未登记接口: {method} {path}','code':'unregistered_mock_endpoint'})

async def setup_page(browser,w,h,path,authenticated=True,context=None):
    context=context or await browser.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, locale='zh-CN')
    page=await context.new_page(); state=MockState(authenticated)
    errors=[]
    page.on('pageerror',lambda err: errors.append(f'pageerror: {err}'))
    page.on('console',lambda msg: errors.append(f'console {msg.type}: {msg.text}') if msg.type in ('error','warning') and 'favicon' not in msg.text else None)
    async def serve(route):
        url=urlparse(route.request.url); rel=url.path.lstrip('/')
        file=WEB/rel
        if file.is_file(): await route.fulfill(path=str(file),content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
        else: await route.fulfill(status=404,body='not found')
    await page.route('http://lukepanel.test/**',serve)
    await page.expose_function('__mockRequest',state.request)
    await page.set_content('<!doctype html><html lang="zh-CN"><head><base href="http://lukepanel.test/"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="app"></div></body></html>')
    await page.add_style_tag(path=str(WEB/'assets/app.css'))
    await page.evaluate("""({path})=>{ const store={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{for(const k of Object.keys(store))delete store[k]}}}); window.__LUKEPANEL_VERSION__='v2.0.6'; window.__LUKEPANEL_TEST_PATH__=path; window.fetch=async (input,init={})=>{const url=typeof input==='string'?input:(input&&input.url)||''; const result=await window.__mockRequest({url,method:init.method||'GET',body:init.body||null,headers:{}}); return new Response(JSON.stringify(result.payload),{status:result.status,headers:{'content-type':'application/json'}})}; }""",{'path':path})
    if not authenticated:
      await page.evaluate("""()=>{
        window.PublicKeyCredential=function PublicKeyCredential(){};
        Object.defineProperty(navigator,'credentials',{configurable:true,value:{get:async()=>null}});
      }""")
    for name in SCRIPTS: await page.add_script_tag(path=str(WEB/'assets'/name))
    target='.app-shell' if authenticated else '.login-layout'
    await page.wait_for_selector(target,timeout=8000)
    await page.wait_for_timeout(180)
    return context,page,state,errors

async def inspect_page(page,w,path):
    return await page.evaluate(r"""({mobile,nested})=>{
      const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(); return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
      const controls=[...document.querySelectorAll('button,input,select,textarea,a.button')].filter(e=>visible(e)&&!(mobile&&e.closest('.sidebar')&&!e.closest('.sidebar').classList.contains('is-open'))).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,type:e.getAttribute('type')||'',inScroll:!!e.closest('.tab-bar,[data-horizontal-scroll]'),w:r.width,h:r.height,font:parseFloat(s.fontSize)||0,text:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,60),left:r.left,right:r.right}});
      const body=document.documentElement;
      const unresolved=(document.body.innerText.match(/undefined|\[object Object\]|\{\{/g)||[]);
      const sidebar=document.querySelector('.sidebar'), bottom=document.querySelector('.mobile-bottom-nav'), top=document.querySelector('.mobile-topbar');
      return {overflow:body.scrollWidth-body.clientWidth,unresolved,controls,hasBack:!!document.querySelector('.back-button'),h1:(document.querySelector('h1')?.textContent||'').trim(),fatal:!!document.querySelector('.fatal-card'),sidebarTransform:sidebar?getComputedStyle(sidebar).transform:'missing',bottomDisplay:bottom?getComputedStyle(bottom).display:'missing',topDisplay:top?getComputedStyle(top).display:'missing',mobile,nested};
    }""",{'mobile':w<=900,'nested':path in NESTED})

async def navigate_to(page,path):
    title=TITLES[path]
    if path in NESTED:
      parent='/tools' if path=='/tools/github' else '/system'
      ptitle=TITLES[parent]
      await page.evaluate("t=>{const e=[...document.querySelectorAll('.sidebar-nav button')].find(x=>x.textContent.trim()===t); if(e)e.click()}",ptitle)
      await page.wait_for_function("t=>document.querySelector('h1')?.textContent.trim()===t", arg=ptitle, timeout=4000)
      await page.evaluate("t=>{const e=[...document.querySelectorAll('.module-card')].find(x=>x.textContent.includes(t)); if(e)e.click()}",title)
    else:
      await page.evaluate("t=>{const e=[...document.querySelectorAll('.sidebar-nav button')].find(x=>x.textContent.trim()===t); if(e)e.click()}",title)
    await page.wait_for_function("t=>document.querySelector('h1')?.textContent.trim()===t", arg=title, timeout=5000)
    await page.wait_for_timeout(120)

async def run_matrix():
    SHOTS.mkdir(parents=True,exist_ok=True)
    results=[]; failures=[]
    async with async_playwright() as pw:
      for name,w,h in DEVICES:
        browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
        context=page=None
        try:
          context,page,state,errors=await setup_page(browser,w,h,'/',True)
          for path in ROUTES:
            try:
              await navigate_to(page,path)
              metrics=await inspect_page(page,w,path)
              local=[]
              if errors: local.extend(errors); errors.clear()
              if metrics['overflow']>1: local.append(f"horizontal overflow {metrics['overflow']}px")
              if metrics['unresolved']: local.append(f"unresolved text {metrics['unresolved']}")
              if metrics['fatal']: local.append('fatal error card rendered')
              if not metrics['h1']: local.append('missing page h1')
              if metrics['hasBack'] != (path in NESTED): local.append(f"back button mismatch: {metrics['hasBack']}")
              if w<=900:
                if metrics['bottomDisplay']=='none' and not (w>h and h<=450): local.append('mobile bottom nav hidden')
                if metrics['topDisplay']=='none': local.append('mobile topbar hidden')
                small=[c for c in metrics['controls'] if c['tag'] in ('BUTTON','A') and (c['w']<32 or c['h']<32)]
                if small: local.append('undersized touch targets: '+str(small[:3]))
                zoom=[c for c in metrics['controls'] if c['tag'] in ('INPUT','SELECT','TEXTAREA') and c.get('type','') not in ('checkbox','radio','file','hidden') and c['font']<16]
                if zoom: local.append('form font below 16px: '+str(zoom[:3]))
                outside=[c for c in metrics['controls'] if not c.get('inScroll') and (c['left']<-1 or c['right']>w+1)]
                if outside: local.append('controls outside viewport: '+str(outside[:3]))
              else:
                if metrics['bottomDisplay']!='none' or metrics['topDisplay']!='none': local.append('mobile navigation visible on desktop')
                if metrics['sidebarTransform'] not in ('none','matrix(1, 0, 0, 1, 0, 0)'): local.append('desktop sidebar transformed off-canvas')
              shot=REPRESENTATIVE.get((name,path))
              if shot: await page.screenshot(path=str(SHOTS/shot),full_page=True)
              results.append({'device':name,'width':w,'height':h,'route':path,'passed':not local,'issues':local,'metrics':{k:v for k,v in metrics.items() if k!='controls'}})
              if local: failures.append({'device':name,'route':path,'issues':local})
            except Exception as e:
              failures.append({'device':name,'route':path,'issues':[repr(e)]}); results.append({'device':name,'route':path,'passed':False,'issues':[repr(e)]})
        finally:
          if context: await context.close()
          await browser.close()
    return results,failures

async def interaction_tests():
  tests=[]
  selected_start=int(os.environ.get('INTERACTION_START','0')); selected_end=int(os.environ.get('INTERACTION_END','9999')); case_sequence=0
  def reqs(state,path,method=None):
    return [r for r in state.requests if r['path']==path and (method is None or r['method']==method)]
  def add(name, ok, issues=None):
    tests.append({'name':name,'passed':bool(ok),'issues':[] if ok else (issues or ['assertion failed'])})
  async with async_playwright() as pw:
    browser=None; browser_cases=0
    async def case(name,path,callback,w=390,h=844,authenticated=True):
      nonlocal browser, browser_cases, case_sequence
      current_index=case_sequence; case_sequence += 1
      if current_index < selected_start or current_index >= selected_end: return
      ctx=page=state=None; errors=[]
      try:
        if browser is None or browser_cases >= 5:
          if browser is not None: await browser.close()
          browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
          browser_cases=0
        browser_cases += 1
        print(f'[interaction] {name}', flush=True)
        ctx,page,state,errors=await setup_page(browser,w,h,path,authenticated)
        page.set_default_timeout(5000)
        result=await asyncio.wait_for(callback(page,state), timeout=18)
        issues=[] if result is True else (result if isinstance(result,list) else [result] if result else ['assertion failed'])
        if errors: issues.extend(errors)
        if state.unknown_requests: issues.append('unregistered API calls: '+str(state.unknown_requests[:5]))
        add(name,not issues,issues)
      except Exception as exc:
        add(name,False,[repr(exc)])
      finally:
        if ctx: await ctx.close()
    try:
      async def login(p,s):
        passkey=p.get_by_role('button',name='Passkey 登录',exact=True)
        await passkey.click(); await p.wait_for_timeout(80)
        begin=reqs(s,'/api/v1/auth/passkey/login/begin','POST')
        await p.locator('input[name="username"]').fill('admin'); await p.locator('input[name="password"]').fill('StrongPass!123'); await p.locator('button[type="submit"]').click(); await p.wait_for_selector('.app-shell',timeout=5000)
        r=reqs(s,'/api/v1/auth/login','POST'); return True if begin and begin[-1]['body']=={} and r and r[-1]['body']=={'username':'admin','password':'StrongPass!123','otp':''} else [{'passkey_begin':begin[-1:]},{'login':r[-1:]}]
      await case('登录请求契约与成功跳转','/',login,authenticated=False)

      async def dashboard(p,s):
        await p.locator('.shortcut').filter(has_text='日志中心').click(); await p.wait_for_function("()=>document.querySelector('h1')?.textContent.trim()==='日志中心'")
        return True if await p.locator('.back-button').count()==0 else ['日志中心错误显示返回按钮']
      await case('概览快捷入口与一级日志路由', '/', dashboard)

      async def services(p,s):
        await p.get_by_role('button',name='重启',exact=True).first.click(); await p.wait_for_timeout(160)
        await p.get_by_role('button',name='日志',exact=True).first.click(); await p.wait_for_selector('.terminal')
        a=reqs(s,'/api/v1/system/services/action','POST'); l=reqs(s,'/api/v1/system/services/logs','GET')
        return True if a and a[-1]['body']=={'name':'lukepanel.service','action':'restart'} and l else [{'action':a[-1:]},{'logs':l[-1:]}]
      await case('服务重启与日志契约','/system/services',services)

      async def processes(p,s):
        await p.get_by_role('button',name='结束',exact=True).first.click(); await p.wait_for_selector('.confirm-dialog'); await p.get_by_role('button',name='发送 SIGTERM',exact=True).click(); await p.wait_for_timeout(160)
        r=reqs(s,'/api/v1/system/processes/action','POST'); return True if r and r[-1]['body']=={'pid':1001,'signal':'term'} else [r[-1:]]
      await case('进程 SIGTERM 请求契约','/system/processes',processes)

      async def network(p,s):
        before=len(reqs(s,'/api/v1/system/network','GET')); await p.get_by_role('button',name='刷新',exact=True).click(); await p.wait_for_timeout(120); after=len(reqs(s,'/api/v1/system/network','GET'))
        return True if after>before else [f'GET count {before}->{after}']
      await case('网络状态真实刷新','/system/network',network)

      async def storage(p,s):
        before=await p.locator('.storage-card').count(); await p.get_by_text('显示虚拟挂载', exact=True).click(); await p.wait_for_timeout(80); after=await p.locator('.storage-card').count()
        return True if (before,after)==(2,3) else [f'card count {before}->{after}']
      await case('存储虚拟挂载开关','/system/storage',storage)

      async def tasks(p,s):
        await p.get_by_role('button',name='新建任务',exact=True).click(); m=p.locator('.modal'); await m.locator('input[name="name"]').fill('每日重启服务'); await m.locator('input[name="target"]').fill('nginx.service'); await m.locator('input[name="hour"]').fill('4'); await m.locator('input[name="minute"]').fill('15'); await m.get_by_role('button',name='创建并启用',exact=True).click(); await p.wait_for_timeout(180)
        await p.get_by_role('button',name='运行',exact=True).first.click(); await p.wait_for_timeout(100)
        c=reqs(s,'/api/v1/system/tasks/create','POST'); a=reqs(s,'/api/v1/system/tasks/action','POST'); expected={'name':'每日重启服务','type':'service-restart','target':'nginx.service','frequency':'daily','hour':4,'minute':15,'weekday':0}
        return True if c and c[-1]['body']==expected and a and a[-1]['body']=={'id':'backup-daily','action':'run'} else [{'create':c[-1:]},{'action':a[-1:]}]
      await case('计划任务创建与运行契约','/system/tasks',tasks)

      async def apt(p,s):
        q=p.get_by_placeholder('例如 nginx、curl'); await q.fill('curl'); await p.get_by_role('button',name='搜索',exact=True).click(); await p.wait_for_selector('.package-row'); await p.get_by_role('button',name='卸载',exact=True).click(); await p.wait_for_selector('.confirm-dialog'); await p.get_by_role('button',name='确认',exact=True).click(); await p.wait_for_timeout(180)
        r=reqs(s,'/api/v1/system/apt/package','POST'); return True if r and r[-1]['body']=={'action':'remove','packages':['curl']} else [r[-1:]]
      await case('APT 搜索与卸载请求契约','/system/updates',apt)

      async def apt_source(p,s):
        await p.get_by_role('button',name='添加软件源',exact=True).click(); m=p.locator('.modal'); await m.locator('input[name="name"]').fill('custom.sources'); await m.locator('textarea[name="content"]').fill('deb https://example.invalid/debian trixie main'); await m.get_by_role('button',name='添加',exact=True).click(); await p.wait_for_timeout(140)
        r=reqs(s,'/api/v1/system/apt/sources','POST'); exp={'action':'add','content':'deb https://example.invalid/debian trixie main','name':'custom.sources'}; return True if r and r[-1]['body']==exp else [r[-1:]]
      await case('APT 软件源添加契约','/system/updates',apt_source)

      async def host(p,s):
        await p.get_by_role('button',name='关闭 NTP',exact=True).click(); await p.wait_for_timeout(100); await p.locator('select[name="preset"]').select_option('balanced'); await p.get_by_role('button',name='应用方案',exact=True).click(); await p.wait_for_timeout(100)
        n=reqs(s,'/api/v1/system/host/ntp','POST'); k=reqs(s,'/api/v1/system/host/sysctl','POST'); return True if n and n[-1]['body']=={'enabled':False} and k and k[-1]['body']=={'preset':'balanced'} else [{'ntp':n[-1:]},{'sysctl':k[-1:]}]
      await case('NTP 开关与内核预设契约','/system/host',host)

      async def host_swap(p,s):
        await p.get_by_role('button',name='删除',exact=True).click(); await p.wait_for_selector('.confirm-dialog'); await p.get_by_role('button',name='删除 Swap',exact=True).click(); await p.wait_for_timeout(120)
        r=reqs(s,'/api/v1/system/host/swap','DELETE'); return True if r else ['DELETE /host/swap 未发送']
      await case('Swap 删除使用 DELETE','/system/host',host_swap)

      async def snapshots(p,s):
        await p.get_by_role('button',name='恢复',exact=True).first.click(); await p.wait_for_selector('.confirm-dialog'); await p.locator('.confirm-dialog').get_by_role('button',name='恢复',exact=True).click(); await p.wait_for_timeout(100); await p.get_by_role('button',name='立即创建',exact=True).click(); await p.wait_for_timeout(100)
        a=reqs(s,'/api/v1/system/snapshots','POST'); b=reqs(s,'/api/v1/backup/scheduled','POST'); return True if a and a[-1]['body']=={'id':'snap-1','action':'restore'} and b and b[-1]['body']=={'action':'create'} else [{'snapshot':a[-1:]},{'backup':b[-1:]}]
      await case('快照恢复与立即备份契约','/system/snapshots',snapshots)

      async def docker_images(p,s):
        await p.locator('.tab-bar button').filter(has_text='镜像').click(); await p.get_by_role('button',name='拉取/构建镜像',exact=True).click(); m=p.locator('.modal'); await m.locator('input[name="reference"]').fill('nginx:1.27-alpine'); await m.get_by_role('button',name='拉取镜像',exact=True).click(); await p.wait_for_timeout(120)
        r=reqs(s,'/api/v1/docker/images/pull','POST'); return True if r and r[-1]['body']=={'reference':'nginx:1.27-alpine'} else [r[-1:]]
      await case('Docker 拉取镜像表单契约','/docker',docker_images)

      async def docker_build(p,s):
        await p.locator('.tab-bar button').filter(has_text='镜像').click(); await p.get_by_role('button',name='拉取/构建镜像',exact=True).click(); m=p.locator('.modal'); await m.locator('select[name="mode"]').select_option('build'); pull_count=await m.locator('input[name="reference"]').count(); await m.locator('input[name="context_dir"]').fill('/opt/app'); await m.locator('input[name="tag"]').fill('luke/app:test'); await m.locator('input[name="no_cache"]').check(); await m.get_by_role('button',name='开始构建',exact=True).click(); await p.wait_for_timeout(120)
        r=reqs(s,'/api/v1/docker/images/build','POST'); exp={'context_dir':'/opt/app','dockerfile':'Dockerfile','tag':'luke/app:test','no_cache':True,'pull':True}; return True if pull_count==0 and r and r[-1]['body']==exp else [{'pullField':pull_count},{'request':r[-1:]}]
      await case('Docker 构建模式字段隔离与契约','/docker',docker_build)

      async def compose(p,s):
        await p.locator('.tab-bar button').filter(has_text='Compose').click(); await p.get_by_role('button',name='YAML',exact=True).click(); m=p.locator('.modal'); await m.locator('textarea').fill('services:\n  adguard:\n    image: adguard/adguardhome:v2\n'); await m.get_by_role('button',name='校验并保存',exact=True).click(); await p.wait_for_timeout(150)
        r=reqs(s,'/api/v1/docker/compose/config','PUT'); body=r[-1]['body'] if r else {}; files=body.get('files',{}) if isinstance(body,dict) else {}
        return True if body.get('project')=='dns-stack' and len(files)==2 and any(str(path).endswith('.env') for path in files) else [r[-1:]]
      await case('Compose 保存提交全部配置文件','/docker',compose)

      async def recreate(p,s):
        await p.get_by_role('button',name='编辑',exact=True).first.click(); m=p.locator('.modal'); await m.get_by_role('button',name='安全重建',exact=True).click(); await p.wait_for_timeout(130)
        r=reqs(s,'/api/v1/docker/recreate','POST'); body=r[-1]['body'] if r else {}; return True if body.get('start') is True and body.get('restart_maximum_retry_count')==0 else [r[-1:]]
      await case('Docker 重建保留运行状态与重试字段','/docker',recreate)

      async def file_create(p,s):
        await p.get_by_role('button',name='新建',exact=True).click(); await p.get_by_role('button',name='新建文件',exact=True).click(); m=p.locator('.modal'); await m.locator('input[name="value"]').fill('notes.txt'); await m.get_by_role('button',name='确认',exact=True).click(); await p.wait_for_timeout(100)
        r=reqs(s,'/api/v1/files/create','POST'); return True if r and r[-1]['body']=={'path':'/notes.txt'} else [r[-1:]]
      await case('文件创建真实路径契约','/files',file_create)

      async def file_edit(p,s):
        await p.locator('.file-open').filter(has_text='README.txt').click(); await p.wait_for_selector('.code-editor'); editor=p.locator('.code-editor'); await editor.fill('updated content\n'); await p.get_by_role('button',name='保存',exact=True).click(); await p.wait_for_timeout(100)
        r=reqs(s,'/api/v1/files/content','PUT'); return True if r and r[-1]['body']=={'path':'/README.txt','content':'updated content\n'} else [r[-1:]]
      await case('文件编辑保存契约','/files',file_edit)

      async def tools(p,s):
        select=p.locator('.tools-grid select').first; await select.select_option('tcp'); inputs=p.locator('.tools-grid input'); await inputs.nth(0).fill('1.1.1.1'); await inputs.nth(1).fill('853'); await p.get_by_role('button',name='开始执行',exact=True).click(); await p.wait_for_timeout(100)
        r=reqs(s,'/api/v1/tools/run','POST'); return True if r and r[-1]['body']=={'tool':'tcp','target':'1.1.1.1','port':853} else [r[-1:]]
      await case('网络工具 TCP 请求契约','/tools',tools)

      async def github(p,s):
        await p.get_by_role('button',name='Token 登录',exact=True).click(); m=p.locator('.modal'); await m.locator('input[name="token"]').fill('github_pat_test'); await m.get_by_role('button',name='验证并连接',exact=True).click(); await p.wait_for_timeout(100); fields=p.locator('.page-stack > .card input'); await fields.nth(0).fill('Luke-Lab666'); await fields.nth(1).fill('LukePanel'); await p.get_by_role('button',name='读取仓库',exact=True).click(); await p.wait_for_timeout(130)
        a=reqs(s,'/api/v1/github/auth/token','POST'); b=reqs(s,'/api/v1/github/summary','GET'); return True if a and a[-1]['body']=={'token':'github_pat_test'} and b else [{'auth':a[-1:]},{'summary':b[-1:]}]
      await case('GitHub Token 与仓库读取契约','/tools/github',github,w=1440,h=900)

      async def ssh(p,s):
        form=p.locator('form').filter(has=p.locator('input[name="port"]')); await form.locator('input[name="port"]').fill('2222'); await form.locator('input[name="allow_agent_forwarding"]').check(); await form.get_by_role('button',name='应用 SSH 设置',exact=True).click(); await p.wait_for_timeout(100)
        r=reqs(s,'/api/v1/ssh/settings','POST'); exp={'port':2222,'permit_root_login':'prohibit-password','allow_tcp_forwarding':True,'allow_agent_forwarding':True,'x11_forwarding':False}; return True if r and r[-1]['body']==exp else [r[-1:]]
      await case('SSH 设置布尔字段与端口契约','/ssh',ssh)

      async def ssh_unavailable(p,s):
        s.force_failures[('GET','/api/v1/ssh/status')]=s.response(200,{'available':False,'error':'sshd not installed','password_authentication':None})
        before=len(reqs(s,'/api/v1/ssh/keys','GET')); await p.get_by_role('button',name='刷新',exact=True).click(); await p.wait_for_timeout(140); after=len(reqs(s,'/api/v1/ssh/keys','GET')); body=await p.locator('body').inner_text(); disabled=await p.get_by_role('button',name='恢复密码登录',exact=True).is_disabled()
        return True if after==before and 'OpenSSH Server 当前不可用' in body and 'sshd not installed' in body and disabled else [f'keys {before}->{after}',f'disabled={disabled}']
      await case('SSH 不可用不伪造状态且不读取密钥','/ssh',ssh_unavailable)

      async def audit(p,s):
        no_back=await p.locator('.back-button').count()==0; await p.locator('.tab-bar button').filter(has_text='系统日志').click(); await p.wait_for_selector('.terminal'); r=reqs(s,'/api/v1/logs/system','GET'); return True if no_back and r else ['route hierarchy or system log request failed']
      await case('日志中心一级路由与系统日志','/audit',audit)

      async def firewall(p,s):
        await p.locator('.tab-bar button').filter(has_text='防火墙').click(); form=p.locator('form.firewall-form-grid'); initial=len(s.firewall['rules']); await form.locator('input[name="port"]').fill('8080'); await form.get_by_role('button',name='添加规则',exact=True).click(); await p.wait_for_timeout(150); addreq=reqs(s,'/api/v1/security/firewall/rule','POST'); refresh=len(reqs(s,'/api/v1/security/firewall','GET')); cards=await p.locator('.firewall-rule-card').count(); await form.locator('input[name="port"]').fill('9999'); await form.get_by_role('button',name='添加规则',exact=True).click(); await p.wait_for_selector('.toast-error'); textbody=await p.locator('body').inner_text()
        ok=addreq and addreq[0]['body'].get('rule',{}).get('port')=='8080' and refresh>=2 and cards>=initial+1 and 'ufw allow in proto tcp' in textbody and 'ERROR: Bad port' in textbody
        return True if ok else [{'requests':addreq,'refresh':refresh,'cards':cards}]
      await case('UFW 添加即时刷新与真实错误输出','/security',firewall)

      async def fail2ban(p,s):
        await p.locator('.tab-bar button').filter(has_text='Fail2ban').click(); inp=p.get_by_placeholder('IP 或 CIDR'); await inp.fill('192.0.2.0/24'); await p.get_by_role('button',name='添加',exact=True).click(); await p.wait_for_timeout(100); r=reqs(s,'/api/v1/security/fail2ban/ignore','POST'); return True if r and r[-1]['body']=={'entry':'192.0.2.0/24','action':'add'} else [r[-1:]]
      await case('Fail2ban 忽略项契约','/security',fail2ban)

      async def access(p,s):
        await p.locator('.tab-bar button').filter(has_text='访问保护').click(); first=p.locator('.setting-card').first; await first.locator('.toggle-row').click(); await first.locator('textarea').fill('127.0.0.1\n10.0.0.0/8'); await first.get_by_role('button',name='保存访问限制',exact=True).click(); await p.wait_for_timeout(100); r=reqs(s,'/api/v1/security/ip-allowlist','POST'); body=r[-1]['body'] if r else {}; return True if body.get('enabled') is True and body.get('entries')==['127.0.0.1','10.0.0.0/8'] else [r[-1:]]
      await case('访问白名单保存契约','/security',access)

      async def security_error(p,s):
        s.force_failures[('GET','/api/v1/security/firewall')]=s.response(500,{'error':'ufw backend unavailable'}); await p.get_by_role('button',name='刷新',exact=True).click(); await p.wait_for_timeout(130); body=await p.locator('body').inner_text(); return True if '加载失败' in body and 'ufw backend unavailable' in body else ['子系统失败被伪装成正常状态']
      await case('安全子系统读取失败显示真实错误','/security',security_error)

      async def settings(p,s):
        inputs=p.locator('.settings-grid input'); await inputs.nth(0).fill('admin2'); await inputs.nth(1).fill('CurrentPass!123'); await inputs.nth(2).fill('123456'); await p.get_by_role('button',name='保存用户名',exact=True).click(); await p.wait_for_timeout(100); pref=p.locator('input[type="number"]'); await pref.fill('15'); await p.get_by_role('button',name='保存偏好',exact=True).click(); await p.wait_for_timeout(100)
        a=reqs(s,'/api/v1/auth/account','PATCH'); b=reqs(s,'/api/v1/settings','PATCH'); return True if a and a[-1]['body']=={'username':'admin2','current_password':'CurrentPass!123','otp':'123456'} and b and b[-1]['body']=={'auto_refresh_seconds':15} else [{'account':a[-1:]},{'settings':b[-1:]}]
      await case('账户与刷新偏好保存契约','/settings',settings,w=1440,h=900)

      async def drawer(p,s):
        await p.locator('.mobile-topbar button[aria-label="打开菜单"]').click(); await p.wait_for_timeout(80); return True if await p.locator('.sidebar.is-open').count()==1 else ['drawer did not open']
      await case('移动端抽屉交互','/audit',drawer)

      async def nested(p,s): return True if await p.locator('.back-button').count()==1 else ['back missing']
      await case('二级页面返回按钮','/system/services',nested)

      async def landscape(p,s):
        await p.locator('.tab-bar button').filter(has_text='防火墙').click(); await p.locator('.firewall-rule-card button').filter(has_text='删除').first.click(); await p.wait_for_selector('.modal'); box=await p.locator('.modal').bounding_box(); return True if box and box['y']>=-1 and box['y']+box['height']<=391 and box['x']>=-1 and box['x']+box['width']<=845 else [box]
      await case('手机横屏弹窗完整可见','/security',landscape,w=844,h=390)

      async def docker_cleanup(p,s):
        await p.get_by_role('button',name='清理',exact=True).click(); m=p.locator('.modal'); await m.locator('select[name="mode"]').select_option('deep'); await m.locator('input[name="volumes"]').check(); await m.get_by_role('button',name='执行清理',exact=True).click(); await p.wait_for_selector('.confirm-dialog'); await p.locator('.confirm-dialog').get_by_role('button',name='开始清理',exact=True).click(); await p.wait_for_timeout(120)
        r=reqs(s,'/api/v1/docker/cleanup','POST'); return True if r and r[-1]['body']=={'mode':'deep','include_volumes':True} else [r[-1:]]
      await case('Docker 深度清理字段契约','/docker',docker_cleanup)

      async def docker_unavailable(p,s):
        resource_paths=['/api/v1/docker/containers','/api/v1/docker/images','/api/v1/docker/networks','/api/v1/docker/volumes','/api/v1/docker/compose']
        before=sum(len(reqs(s,path,'GET')) for path in resource_paths); s.force_failures[('GET','/api/v1/docker/status')]=s.response(200,{'available':False,'error':'docker socket unavailable'}); await p.get_by_role('button',name='刷新',exact=True).click(); await p.wait_for_timeout(140); after=sum(len(reqs(s,path,'GET')) for path in resource_paths); body=await p.locator('body').inner_text()
        return True if before==after and 'docker socket unavailable' in body else [f'resource requests {before}->{after}',body[:300]]
      await case('Docker 不可用停止后续请求并显示原因','/docker',docker_unavailable)

      async def file_failure(p,s):
        s.force_failures[('POST','/api/v1/files/create')]=s.response(400,{'error':'permission denied','command':'open /notes.txt','output':'EACCES'}); await p.get_by_role('button',name='新建',exact=True).click(); await p.get_by_role('button',name='新建文件',exact=True).click(); m=p.locator('.modal'); await m.locator('input[name="value"]').fill('notes.txt'); await m.get_by_role('button',name='确认',exact=True).click(); await p.wait_for_selector('.toast-error'); visible=await p.locator('.modal').is_visible(); body=await p.locator('body').inner_text()
        return True if visible and 'permission denied' in body and 'EACCES' in body else ['失败后弹窗被关闭或真实错误未显示']
      await case('文件操作失败不伪装成功且保留输入','/files',file_failure)

      async def file_recycle(p,s):
        s.force_failures[('GET','/api/v1/files/recycle')]=s.response(200,{'entries':[{'id':'trash-1','name':'old.conf','original_path':'/etc/old.conf','is_dir':False,'deleted_at':'2026-08-02T00:00:00Z'}]}); await p.locator('.tab-bar button').filter(has_text='回收站').click(); await p.wait_for_selector('.file-row'); await p.get_by_role('button',name='恢复',exact=True).click(); await p.wait_for_timeout(100); r=reqs(s,'/api/v1/files/recycle','POST')
        return True if r and r[-1]['body']=={'id':'trash-1','action':'restore','destination':''} else [r[-1:]]
      await case('文件回收站恢复契约','/files',file_recycle)

      async def file_history_guard(p,s):
        await p.locator('.file-open').filter(has_text='README.txt').click(); await p.wait_for_selector('.code-editor'); await p.locator('.code-editor').fill('unsaved'); before=len(reqs(s,'/api/v1/files/backups','GET')); await p.get_by_role('button',name='历史版本',exact=True).click(); await p.wait_for_selector('.confirm-dialog'); guarded=len(reqs(s,'/api/v1/files/backups','GET'))==before; await p.locator('.confirm-dialog').get_by_role('button',name='继续打开',exact=True).click(); await p.wait_for_timeout(100); after=len(reqs(s,'/api/v1/files/backups','GET'))
        return True if guarded and after==before+1 else [f'history GET {before}->{after}, guarded={guarded}']
      await case('未保存文件打开历史前必须确认','/files',file_history_guard,w=1440,h=900)

      async def github_branch(p,s):
        await p.get_by_role('button',name='Token 登录',exact=True).click(); m=p.locator('.modal'); await m.locator('input[name="token"]').fill('x'); await m.get_by_role('button',name='验证并连接').click(); await p.wait_for_timeout(60); fields=p.locator('.page-stack > .card input'); await fields.nth(0).fill('Luke-Lab666'); await fields.nth(1).fill('LukePanel'); await p.get_by_role('button',name='读取仓库').click(); await p.wait_for_timeout(80); await p.get_by_role('button',name='创建分支',exact=True).click(); m=p.locator('.modal'); await m.locator('input[name="name"]').fill('feature/react-audit'); await m.get_by_role('button',name='确认',exact=True).click(); await p.wait_for_timeout(120); r=reqs(s,'/api/v1/github/branch','POST'); exp={'owner':'Luke-Lab666','repo':'LukePanel','name':'feature/react-audit','source':'main'}
        return True if r and r[-1]['body']==exp else [r[-1:]]
      await case('GitHub 创建分支契约','/tools/github',github_branch,w=1440,h=900)

      async def github_logs(p,s):
        await p.get_by_role('button',name='Token 登录',exact=True).click(); m=p.locator('.modal'); await m.locator('input[name="token"]').fill('x'); await m.get_by_role('button',name='验证并连接').click(); await p.wait_for_timeout(60); fields=p.locator('.page-stack > .card input'); await fields.nth(0).fill('Luke-Lab666'); await fields.nth(1).fill('LukePanel'); await p.get_by_role('button',name='读取仓库').click(); await p.wait_for_timeout(80); await p.get_by_role('button',name='详情',exact=True).click(); await p.wait_for_selector('.modal'); await p.get_by_role('button',name='查看日志',exact=True).click(); await p.wait_for_timeout(80); r=reqs(s,'/api/v1/github/actions/job-logs','GET'); body=await p.locator('body').inner_text()
        return True if r and 'go test ./...' in body else ['Actions 日志未真实读取']
      await case('GitHub Actions Job 日志链路','/tools/github',github_logs,w=1440,h=900)

      async def ssh_password(p,s):
        await p.get_by_role('button',name='恢复密码登录',exact=True).click(); await p.wait_for_selector('.confirm-dialog'); await p.locator('.confirm-dialog').get_by_role('button',name='恢复',exact=True).click(); await p.wait_for_timeout(100); r=reqs(s,'/api/v1/ssh/password','POST')
        return True if r and r[-1]['body']=={'enabled':True} else [r[-1:]]
      await case('SSH 密码登录开关契约','/ssh',ssh_password)

      async def notifications(p,s):
        await p.locator('.tab-bar button').filter(has_text='访问保护').click(); card=p.locator('.setting-card').nth(1); await card.locator('.toggle-row').click(); pw=card.locator('input[type="password"]'); chat=card.locator('input').nth(2); await pw.fill('123456:ABCDEF'); await chat.fill('998877'); await card.get_by_role('button',name='保存并测试',exact=True).click(); await p.wait_for_timeout(130); r=reqs(s,'/api/v1/security/login-notifications','POST'); cleared=await card.locator('input[type="password"]').input_value()==''
        exp={'enabled':True,'bot_token':'123456:ABCDEF','chat_id':'998877','test':True}; return True if r and r[-1]['body']==exp and cleared else [{'request':r[-1:]},f'tokenCleared={cleared}']
      await case('Telegram 通知保存测试且清除明文 Token','/security',notifications,w=1440,h=900)

      async def firewall_limit(p,s):
        await p.locator('.tab-bar button').filter(has_text='防火墙').click(); form=p.locator('form.firewall-form-grid'); await form.locator('select[name="action"]').select_option('limit'); await form.locator('select[name="protocol"]').select_option('udp'); await form.locator('input[name="port"]').fill('53'); before=len(reqs(s,'/api/v1/security/firewall/rule','POST')); await form.get_by_role('button',name='添加规则',exact=True).click(); await p.wait_for_selector('.toast-warning'); after=len(reqs(s,'/api/v1/security/firewall/rule','POST')); body=await p.locator('body').inner_text()
        return True if before==after and '只支持 TCP' in body else [f'requests {before}->{after}']
      await case('UFW limit+UDP 前端阻止无效请求','/security',firewall_limit)

      async def password_change(p,s):
        card=p.locator('.setting-card').nth(1); fields=card.locator('input[type="password"]'); await fields.nth(0).fill('OldPass!123'); await fields.nth(1).fill('NewPass!456'); await fields.nth(2).fill('NewPass!456'); await card.locator('input[autocomplete="one-time-code"]').fill('123456'); await card.get_by_role('button',name='修改密码',exact=True).click(); await p.wait_for_timeout(100); r=reqs(s,'/api/v1/auth/password','POST')
        return True if r and r[-1]['body']=={'current_password':'OldPass!123','new_password':'NewPass!456','otp':'123456'} else [r[-1:]]
      await case('管理员密码修改契约','/settings',password_change,w=1440,h=900)

      async def password_totp(p,s):
        s.force_sequences[('POST','/api/v1/auth/login')]=[
          s.response(401,{'error':'请输入身份验证器验证码或恢复码','code':'totp_required'}),
          s.response(200,{'username':'admin','csrf_token':'audit-csrf','session_id':'audit-session','totp_enabled':True})
        ]
        await p.locator('input[name="username"]').fill('admin'); await p.locator('input[name="password"]').fill('StrongPass!123'); await p.locator('button[type="submit"]').click(); await p.wait_for_selector('input[name="otp"]')
        await p.locator('input[name="otp"]').fill('123456'); await p.locator('button[type="submit"]').click(); await p.wait_for_selector('.app-shell',timeout=5000)
        r=reqs(s,'/api/v1/auth/login','POST')
        expected=[{'username':'admin','password':'StrongPass!123','otp':''},{'username':'admin','password':'StrongPass!123','otp':'123456'}]
        return True if [item['body'] for item in r[-2:]]==expected else [r[-2:]]
      await case('密码登录强制两步验证流程','/',password_totp,authenticated=False,w=390,h=844)

      async def host_basics(p,s):
        base=p.locator('form').filter(has=p.locator('input[name="hostname"]')); await base.locator('input[name="hostname"]').fill('luke-node'); await base.locator('input[name="timezone"]').fill('UTC'); await base.get_by_role('button',name='保存基础设置',exact=True).click(); await p.wait_for_timeout(120); dns=p.locator('form').filter(has=p.locator('textarea[name="servers"]')); await dns.locator('textarea[name="servers"]').fill('1.1.1.1\n9.9.9.9'); await dns.get_by_role('button',name='保存 DNS',exact=True).click(); await p.wait_for_timeout(100); h=reqs(s,'/api/v1/system/host/hostname','POST'); t=reqs(s,'/api/v1/system/host/timezone','POST'); d=reqs(s,'/api/v1/system/host/dns','POST')
        return True if h and h[-1]['body']=={'hostname':'luke-node'} and t and t[-1]['body']=={'timezone':'UTC'} and d and d[-1]['body']=={'servers':['1.1.1.1','9.9.9.9']} else [{'host':h[-1:]},{'timezone':t[-1:]},{'dns':d[-1:]}]
      await case('主机名时区与 DNS 保存契约','/system/host',host_basics,w=1440,h=900)

      async def apt_disable(p,s):
        await p.get_by_role('button',name='停用',exact=True).first.click(); await p.wait_for_timeout(100); r=reqs(s,'/api/v1/system/apt/sources','POST')
        return True if r and r[-1]['body']=={'action':'disable','path':'/etc/apt/sources.list'} else [r[-1:]]
      await case('APT 软件源停用契约','/system/updates',apt_disable)

      async def image_validation(p,s):
        await p.locator('.tab-bar button').filter(has_text='镜像').click(); await p.get_by_role('button',name='拉取/构建镜像',exact=True).click(); m=p.locator('.modal'); await m.locator('select[name="mode"]').select_option('build'); await m.locator('input[name="context_dir"]').fill('/opt/app'); before=len(reqs(s,'/api/v1/docker/images/build','POST')); await m.get_by_role('button',name='开始构建',exact=True).click(); await p.wait_for_timeout(80); after=len(reqs(s,'/api/v1/docker/images/build','POST')); visible=await m.is_visible(); invalid=await m.locator('input[name="tag"]').evaluate('(e)=>!e.checkValidity()')
        return True if before==after and visible and invalid else [f'requests {before}->{after}',f'modal={visible}',f'invalid={invalid}']
      await case('Docker 构建缺少标签不发送假请求','/docker',image_validation)

      async def docker_stats_failure(p,s):
        s.force_failures[('GET','/api/v1/docker/stats')]=s.response(503,{'error':'stats unavailable','message':'Docker stats temporarily unavailable'}); await p.get_by_role('button',name='刷新',exact=True).click(); await p.wait_for_timeout(160); body=await p.locator('body').inner_text(); stats=reqs(s,'/api/v1/docker/stats','GET')
        return True if stats and '容器实时统计读取失败' in body and 'stats unavailable' in body and 'CPU —' in body else [{'stats':stats[-1:]},body[-800:]]
      await case('Docker 统计失败明确降级而非伪装为 0','/docker',docker_stats_failure,w=1440,h=900)


      async def modal_focus(p,s):
        await p.locator('.tab-bar button').filter(has_text='镜像').click()
        trigger=p.get_by_role('button',name='拉取/构建镜像',exact=True)
        await trigger.focus(); await trigger.click(); modal=p.locator('.modal'); await modal.wait_for(); await p.wait_for_timeout(80)
        inside=await p.evaluate("()=>!!document.activeElement?.closest('.modal')")
        focusables=modal.locator('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])')
        count=await focusables.count()
        if count < 2: return [f'focusable count={count}']
        first=focusables.first; last=focusables.nth(count-1)
        await last.focus(); await p.keyboard.press('Tab'); wrapped_forward=await first.evaluate('(e)=>document.activeElement===e')
        await first.focus(); await p.keyboard.press('Shift+Tab'); wrapped_backward=await last.evaluate('(e)=>document.activeElement===e')
        await modal.get_by_role('button',name='关闭',exact=True).click(); await p.wait_for_timeout(80)
        restored=await trigger.evaluate('(e)=>document.activeElement===e')
        active=await p.evaluate("()=>({tag:document.activeElement?.tagName,text:(document.activeElement?.textContent||'').trim(),label:document.activeElement?.getAttribute?.('aria-label'),html:document.activeElement?.outerHTML?.slice(0,300)})")
        trigger_state=await trigger.evaluate("e=>({connected:e.isConnected,tag:e.tagName,text:e.textContent.trim(),html:e.outerHTML.slice(0,300)})")
        return True if inside and wrapped_forward and wrapped_backward and restored else [f'inside={inside}',f'forward={wrapped_forward}',f'backward={wrapped_backward}',f'restored={restored}',{'active':active,'trigger':trigger_state}]
      await case('弹窗焦点锁定与关闭后恢复','/docker',modal_focus,w=390,h=844)

      async def session_expiry(p,s):
        s.force_sequences[('GET','/api/v1/system/overview')]=[s.response(401,{'error':'会话已过期','code':'session_expired'})]
        await p.get_by_role('button',name='刷新',exact=True).click(); await p.wait_for_selector('.login-layout',timeout=3000)
        return True if await p.locator('.app-shell').count()==0 else ['401 后仍保留已登录应用壳']
      await case('401 会话过期立即返回登录页','/',session_expiry,w=390,h=844)

      async def elevation_retry(p,s):
        key=('POST','/api/v1/system/services/action')
        s.force_sequences[key]=[s.response(403,{'error':'需要二次验证','code':'elevation_required'})]
        s.force_sequences[('POST','/api/v1/auth/elevate')]=[
          s.response(401,{'error':'验证码或恢复码不正确','code':'totp_invalid'}),
          s.response(200,{'ok':True,'expires_in':300})
        ]
        await p.get_by_role('button',name='重启',exact=True).first.click(); modal=p.locator('.modal'); await modal.wait_for();
        await modal.locator('input[name="password"]').fill('StrongPass!123'); await modal.locator('input[name="otp"]').fill('000000'); await modal.get_by_role('button',name='验证并继续',exact=True).click(); await p.wait_for_timeout(120)
        stayed=await p.locator('.app-shell').count()==1 and await modal.count()==1
        await modal.locator('input[name="otp"]').fill('123456'); await modal.get_by_role('button',name='验证并继续',exact=True).click(); await p.wait_for_timeout(180)
        elevated=reqs(s,'/api/v1/auth/elevate','POST'); actions=reqs(s,'/api/v1/system/services/action','POST')
        expected={'name':'lukepanel.service','action':'restart'}
        return True if stayed and len(actions)==2 and actions[-1]['body']==expected and len(elevated)==2 and elevated[-1]['body']=={'password':'StrongPass!123','otp':'123456'} and await p.locator('.modal').count()==0 else [{'stayed':stayed},{'actions':actions},{'elevate':elevated}]
      await case('403 二次验证成功后只重试原请求一次','/system/services',elevation_retry,w=390,h=844)

      async def elevation_cancel(p,s):
        key=('POST','/api/v1/system/services/action')
        s.force_failures[key]=s.response(403,{'error':'需要二次验证','code':'elevation_required'})
        await p.get_by_role('button',name='重启',exact=True).first.click(); modal=p.locator('.modal'); await modal.wait_for(); await modal.get_by_role('button',name='取消',exact=True).click(); await p.wait_for_timeout(140)
        actions=reqs(s,'/api/v1/system/services/action','POST'); elevated=reqs(s,'/api/v1/auth/elevate','POST')
        return True if len(actions)==1 and not elevated and await p.locator('.modal').count()==0 else [{'actions':actions},{'elevate':elevated}]
      await case('取消二次验证不会重试或悬挂','/system/services',elevation_cancel,w=390,h=844)
    finally:
      if browser is not None: await browser.close()
  return tests

async def main():
  started=time.time(); results,failures=await run_matrix(); interactions=await interaction_tests(); failures.extend({'device':'interaction','route':t['name'],'issues':t['issues']} for t in interactions if not t['passed'])
  report={'version':'v2.0.6','framework':'React 18.2.0','render_checks':len(results),'render_passed':sum(1 for r in results if r['passed']),'interaction_checks':len(interactions),'interaction_passed':sum(1 for t in interactions if t['passed']),'failures':failures,'interactions':interactions,'results':results,'duration_seconds':round(time.time()-started,2)}
  REPORTS.mkdir(exist_ok=True); (REPORTS/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  print(json.dumps({k:report[k] for k in ['render_checks','render_passed','interaction_checks','interaction_passed','duration_seconds']},ensure_ascii=False))
  if failures:
    print(json.dumps(failures[:20],ensure_ascii=False,indent=2)); sys.exit(1)

def isolated_cli():
  import subprocess
  parts=REPORTS/'browser-parts'
  if parts.exists():
    import shutil; shutil.rmtree(parts)
  for name,_,_ in DEVICES:
    subprocess.run([sys.executable,str(Path(__file__).with_name('worker.py')),name],check=True)
  for start in range(0, INTERACTION_COUNT, INTERACTION_CHUNK_SIZE):
    end=min(start+INTERACTION_CHUNK_SIZE, INTERACTION_COUNT)
    subprocess.run([sys.executable,str(Path(__file__).with_name('worker.py')),f'interactions-{start}-{end}'],check=True)
  subprocess.run([sys.executable,str(Path(__file__).with_name('merge_reports.py'))],check=True)

if __name__=='__main__': isolated_cli()
