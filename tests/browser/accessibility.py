#!/usr/bin/env python3
from __future__ import annotations
import asyncio, importlib.util, json
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('audit_core',HERE/'audit.py')
a=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(a)

async def inspect_viewport(width:int,height:int):
    issues=[]
    async with a.async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
        context,page,state,errors=await a.setup_page(browser,width,height,'/',True)
        try:
            for path in a.ROUTES:
                await a.navigate_to(page,path)
                result=await page.evaluate(r'''()=>{
                  const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
                  const buttons=[...document.querySelectorAll('button,a')].filter(visible).filter(e=>!((e.textContent||'').trim()||e.getAttribute('aria-label')||e.getAttribute('title'))).map(e=>e.outerHTML.slice(0,220));
                  const fields=[...document.querySelectorAll('input,select,textarea')].filter(visible).filter(e=>!['hidden','file'].includes(e.type)).filter(e=>{const id=e.id;const byFor=id&&document.querySelector(`label[for="${CSS.escape(id)}"]`);return !(byFor||e.closest('label')||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.getAttribute('placeholder')||e.getAttribute('name'));}).map(e=>e.outerHTML.slice(0,220));
                  const images=[...document.querySelectorAll('img')].filter(visible).filter(e=>!e.hasAttribute('alt')).map(e=>e.outerHTML.slice(0,220));
                  const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);const duplicateIds=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
                  return {buttons,fields,images,duplicateIds};
                }''')
                if errors: result['runtimeErrors']=errors[:]; errors.clear()
                if any(result.values()): issues.append({'route':path,**result})
        finally:
            await context.close(); await browser.close()
    return issues

async def main():
    result={'mobile-390':await inspect_viewport(390,844),'desktop-1440':await inspect_viewport(1440,900)}
    out=a.REPORTS/'accessibility-audit.json'; out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    count=sum(len(v) for v in result.values())
    print(json.dumps({'viewports':2,'routes_per_viewport':len(a.ROUTES),'issues':count},ensure_ascii=False))
    if count: raise SystemExit(1)
if __name__=='__main__': asyncio.run(main())
