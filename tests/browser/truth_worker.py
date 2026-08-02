#!/usr/bin/env python3
from __future__ import annotations
import asyncio, importlib.util, json, re, sys, time
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('audit_core', ROOT/'tests/browser/audit.py')
a=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(a)
FORM_LABELS={'搜索','确认','添加','创建','保存','执行','验证并继续','修改密码','保存用户名','保存偏好','发送测试','校验并保存','开始导入','开始执行','读取仓库','上传资产','登录'}

async def content_buttons(page):
    return await page.locator('.content button:visible').evaluate_all("""els=>els.map((e,i)=>({i,text:(e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,100),type:e.getAttribute('type')||'button',disabled:e.disabled,active:e.classList.contains('active')||e.getAttribute('aria-selected')==='true',cls:e.className}))""")

async def snapshot(page,state):
    return {
      'requests':len(state.requests),
      'modal':await page.locator('.modal').count(),
      'toast':await page.locator('.toast').count(),
      'h1':(await page.locator('h1').first.inner_text()) if await page.locator('h1').count() else '',
      'path':await page.evaluate('location.pathname'),
      'body':(await page.locator('body').inner_text())[-1400:],
      'active':await page.locator('.tab-bar button.active').all_inner_texts(),
      'drawer':await page.locator('.sidebar.is-open').count(),
      'expanded':await page.locator('[aria-expanded="true"]').count(),
    }

async def run(path: str):
    if path not in a.ROUTES: raise SystemExit(f'unknown route: {path}')
    rows=[]; failures=[]; started=time.time()
    async with async_playwright() as pw:
      browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
      context=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,locale='zh-CN')
      try:
        _,page,state,errors=await a.setup_page(browser,390,844,path,True,context=context)
        buttons=await content_buttons(page)
        await page.close()
        for meta in buttons:
          if meta['disabled']:
            rows.append({'route':path,'control':meta['text'],'status':'disabled-valid'}); continue
          if 'active' in str(meta.get('cls','')).split():
            rows.append({'route':path,'control':meta['text'],'status':'active-current'}); continue
          if meta.get('active'):
            rows.append({'route':path,'control':meta['text'],'status':'already-active'}); continue
          if meta['type']=='submit' and meta['text'] in FORM_LABELS:
            rows.append({'route':path,'control':meta['text'],'status':'form-covered-separately'}); continue
          page=None
          try:
            _,page,state,errors=await a.setup_page(browser,390,844,path,True,context=context)
            locator=page.locator('.content button:visible').nth(meta['i'])
            if await locator.count()==0:
              failures.append({'route':path,'control':meta['text'],'issue':'control missing in clean render'}); continue
            before=await snapshot(page,state); file_seen=[]
            page.on('filechooser',lambda chooser:file_seen.append(True))
            try:
              await locator.click(timeout=2500,no_wait_after=True)
            except PlaywrightTimeoutError as exc:
              failures.append({'route':path,'control':meta['text'],'issue':f'click timeout: {exc}'}); continue
            await page.wait_for_timeout(180)
            after=await snapshot(page,state)
            effect=(after['requests']>before['requests'] or after['modal']!=before['modal'] or after['toast']>before['toast'] or after['h1']!=before['h1'] or after['path']!=before['path'] or after['active']!=before['active'] or after['drawer']!=before['drawer'] or after['expanded']!=before['expanded'] or bool(file_seen) or after['body']!=before['body'])
            rows.append({'route':path,'control':meta['text'],'status':'passed' if effect else 'no-effect','before_requests':before['requests'],'after_requests':after['requests'],'filechooser':bool(file_seen)})
            if not effect: failures.append({'route':path,'control':meta['text'],'issue':'click produced no request, navigation, modal, toast, state or file chooser'})
            if errors: failures.append({'route':path,'control':meta['text'],'issue':'browser error','errors':errors})
          except Exception as exc:
            failures.append({'route':path,'control':meta['text'],'issue':repr(exc)})
          finally:
            if page: await page.close()
      finally:
        await context.close(); await browser.close()
    report={'route':path,'checks':len(rows),'passed':sum(r['status']!='no-effect' for r in rows),'failures':failures,'rows':rows,'duration_seconds':round(time.time()-started,2)}
    out=ROOT/'reports/truth-parts'; out.mkdir(parents=True,exist_ok=True)
    slug='root' if path=='/' else re.sub(r'[^a-z0-9]+','-',path.strip('/').lower())
    (out/f'{slug}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ('route','checks','passed','duration_seconds')},ensure_ascii=False))
    if failures:
      print(json.dumps(failures[:50],ensure_ascii=False,indent=2)); raise SystemExit(1)

if __name__=='__main__':
    if len(sys.argv)!=2: raise SystemExit('usage: truth_worker.py ROUTE')
    asyncio.run(run(sys.argv[1]))
