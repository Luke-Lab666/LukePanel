#!/usr/bin/env python3
from __future__ import annotations
import asyncio, importlib.util, json, sys, time
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('audit_core', HERE/'audit.py')
a=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(a)

async def run_device(name: str):
    match=[d for d in a.DEVICES if d[0]==name]
    if not match: raise SystemExit(f'unknown device: {name}')
    name,w,h=match[0]
    results=[]; failures=[]; started=time.time()
    async with a.async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
        context=page=None
        try:
            context,page,state,errors=await a.setup_page(browser,w,h,'/',True)
            for path in a.ROUTES:
                local=[]
                try:
                    unknown_start=len(state.unknown_requests)
                    await a.navigate_to(page,path)
                    metrics=await a.inspect_page(page,w,path)
                    if errors: local.extend(errors); errors.clear()
                    unknown=state.unknown_requests[unknown_start:]
                    if unknown: local.append('unregistered API calls: '+str(unknown[:5]))
                    if metrics['overflow']>1: local.append(f"horizontal overflow {metrics['overflow']}px")
                    if metrics['unresolved']: local.append(f"unresolved text {metrics['unresolved']}")
                    if metrics['fatal']: local.append('fatal error card rendered')
                    if not metrics['h1']: local.append('missing page h1')
                    if metrics['hasBack'] != (path in a.NESTED): local.append(f"back button mismatch: {metrics['hasBack']}")
                    if w<=900:
                        if metrics['bottomDisplay']=='none' and not (w>h and h<=450): local.append('mobile bottom nav hidden')
                        if not (w>h and h<=450):
                            await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)')
                            await page.wait_for_timeout(40)
                            clearance=await page.evaluate("()=>{const nav=document.querySelector('.mobile-bottom-nav'), stack=document.querySelector('.content > .page-stack'); if(!nav||!stack)return null; return Math.round(nav.getBoundingClientRect().top-stack.getBoundingClientRect().bottom)}")
                            if clearance is not None and clearance < -1: local.append(f'last content obscured by bottom navigation: {clearance}px')
                            await page.evaluate('window.scrollTo(0,0)')
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
                    shot=a.REPRESENTATIVE.get((name,path))
                    if shot: await page.screenshot(path=str(a.SHOTS/shot),full_page=True)
                    compact={k:v for k,v in metrics.items() if k!='controls'}
                except Exception as exc:
                    local=[repr(exc)]; compact={}
                row={'device':name,'width':w,'height':h,'route':path,'passed':not local,'issues':local,'metrics':compact}
                results.append(row)
                if local: failures.append({'device':name,'route':path,'issues':local})
        finally:
            if context: await context.close()
            await browser.close()
    return {'device':name,'width':w,'height':h,'checks':len(results),'passed':sum(1 for r in results if r['passed']),'failures':failures,'results':results,'duration_seconds':round(time.time()-started,2)}

async def main():
    if len(sys.argv)!=2: raise SystemExit('usage: worker.py DEVICE|interactions-START-END')
    a.REPORTS.mkdir(exist_ok=True); a.SHOTS.mkdir(parents=True,exist_ok=True)
    parts=a.REPORTS/'browser-parts'; parts.mkdir(parents=True,exist_ok=True)
    argument=sys.argv[1]
    if argument.startswith('interactions'):
        parts_arg=argument.split('-')
        if len(parts_arg)==3:
            import os; os.environ['INTERACTION_START']=parts_arg[1]; os.environ['INTERACTION_END']=parts_arg[2]
        started=time.time(); tests=await a.interaction_tests(); data={'checks':len(tests),'passed':sum(1 for t in tests if t['passed']),'tests':tests,'duration_seconds':round(time.time()-started,2)}
    else:
        data=await run_device(sys.argv[1])
    parts.mkdir(parents=True,exist_ok=True)
    (parts/f'{argument}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:data[k] for k in data if k in ('device','checks','passed','duration_seconds')},ensure_ascii=False))
    if data.get('failures') or data.get('passed')!=data.get('checks'): raise SystemExit(1)

if __name__=='__main__': asyncio.run(main())
