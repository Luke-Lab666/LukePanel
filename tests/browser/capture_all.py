#!/usr/bin/env python3
from __future__ import annotations
import asyncio, importlib.util, re
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('audit_core',HERE/'audit.py')
a=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(a)

def slug(path:str)->str:
    if path=='/': return 'dashboard'
    return path.strip('/').replace('/','-')

async def capture(name:str,w:int,h:int):
    target=a.SHOTS/'all'/name; target.mkdir(parents=True,exist_ok=True)
    async with a.async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
        context,page,state,errors=await a.setup_page(browser,w,h,'/',True)
        try:
            for path in a.ROUTES:
                await a.navigate_to(page,path)
                await page.screenshot(path=str(target/f'{slug(path)}.png'),full_page=True)
                if errors: raise RuntimeError(f'{name} {path}: {errors}')
        finally:
            await context.close(); await browser.close()

async def main():
    await capture('phone-390',390,844)
    await capture('desktop-1440',1440,900)
    print('captured 36 route screenshots')
if __name__=='__main__': asyncio.run(main())
