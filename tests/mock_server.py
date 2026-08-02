#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json, os, sys, urllib.parse
ROOT=Path(__file__).resolve().parents[1]/'web'
class H(SimpleHTTPRequestHandler):
    def translate_path(self,path):
        path=urllib.parse.urlparse(path).path
        target=(ROOT/path.lstrip('/')).resolve()
        if path.startswith('/api/'): return str(ROOT/'__api__')
        if target.is_file(): return str(target)
        return str(ROOT/'index.html')
    def log_message(self,*a): pass
    def send_json(self,status,payload):
        data=json.dumps(payload,ensure_ascii=False).encode(); self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        if self.path.startswith('/api/v1/auth/me'): return self.send_json(401,{'error':'unauthorized'})
        return super().do_GET()
    def do_POST(self):
        if self.path.startswith('/api/v1/auth/login'): return self.send_json(200,{'username':'Lukeadmin','csrf_token':'test','session_id':'session-test'})
        return self.send_json(404,{'error':'mock endpoint missing'})
if __name__=='__main__':
    port=int(sys.argv[1] if len(sys.argv)>1 else 18765)
    os.chdir(ROOT)
    ThreadingHTTPServer(('127.0.0.1',port),H).serve_forever()
