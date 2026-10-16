// Local, read-only server for the review artifact; never part of the product build.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../docs/comparacion-v2');
http.createServer(async(request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
    const extension=path.extname(file);response.setHeader('Content-Type',extension==='.html'?'text/html; charset=utf-8':extension==='.jpg'?'image/jpeg':extension==='.json'?'application/json':'text/plain');
    response.end(await fs.readFile(file));
  }catch{response.writeHead(404).end();}
}).listen(5175,'127.0.0.1',()=>console.log('Comparación local: http://127.0.0.1:5175'));
