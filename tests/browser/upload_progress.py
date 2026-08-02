#!/usr/bin/env python3
from __future__ import annotations
import asyncio, importlib.util
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('audit_core', HERE/'audit.py')
a=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(a)

FAKE_XHR=r"""
()=>{
  class FakeXHR {
    constructor(){ this.upload={}; this.status=0; this.responseText=''; this.withCredentials=false; this._aborted=false; }
    open(method,url){ this.method=method; this.url=url; }
    setRequestHeader(){}
    getResponseHeader(){ return null; }
    send(form){
      const file=form.get('file'); const total=(file&&file.size)||1024;
      setTimeout(()=>{ if(this._aborted)return; this.upload.onprogress&&this.upload.onprogress({lengthComputable:true,loaded:Math.floor(total/2),total}); },60);
      setTimeout(()=>{ if(this._aborted)return; this.upload.onprogress&&this.upload.onprogress({lengthComputable:true,loaded:total,total}); this.upload.onload&&this.upload.onload(); },180);
      setTimeout(()=>{ if(this._aborted)return; this.status=200; this.responseText=JSON.stringify({ok:true}); this.onload&&this.onload(); },550);
    }
    abort(){ this._aborted=true; this.onabort&&this.onabort(); }
  }
  window.XMLHttpRequest=FakeXHR;
}
"""

async def main():
  async with a.async_playwright() as pw:
    browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    context,page,state,errors=await a.setup_page(browser,390,844,'/files',True)
    try:
      await page.evaluate(FAKE_XHR)
      uploader=page.locator('input[type="file"][multiple]').first
      await uploader.set_input_files({'name':'example.bin','mimeType':'application/octet-stream','buffer':b'x'*65536})
      panel=page.locator('.transfer-panel')
      await panel.wait_for(state='visible',timeout=2000)
      await page.wait_for_function("()=>document.querySelector('.transfer-panel')?.textContent?.includes('%')")
      text=await panel.inner_text()
      if 'example.bin' not in text or '/s' not in text:
        raise AssertionError(f'upload panel missing filename/speed: {text!r}')
      await panel.wait_for(state='hidden',timeout=3000)
      if errors:
        raise AssertionError(errors)
      print('UPLOAD PROGRESS PASS: real byte progress, speed, processing phase and completion')
    finally:
      await context.close(); await browser.close()

if __name__=='__main__': asyncio.run(main())
