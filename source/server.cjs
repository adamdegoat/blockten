const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname, TH=path.join(__dirname,'node_modules','three');
const M={'.html':'text/html','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.gltf':'model/gltf+json','.bin':'application/octet-stream'};
http.createServer((q,r)=>{
  if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{
    if(q.url==='/shot'){const j=JSON.parse(b);fs.writeFileSync(path.join(ROOT,j.name+'.png'),Buffer.from(j.data.split(',')[1],'base64'));console.log('  shot '+j.name);}
    else if(q.url==='/done'){fs.writeFileSync(path.join(ROOT,'done.json'),b);console.log('DONE '+b.slice(0,300));}
    else console.log('  '+b);
    r.writeHead(200);r.end('ok');});return;}
  let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/index.html';
  const f=u.startsWith('/three/')?path.join(TH,u.slice(7)):path.join(ROOT,u);
  const rp=path.resolve(f);
  if(!rp.startsWith(path.resolve(ROOT))&&!rp.startsWith(path.resolve(TH))){r.writeHead(403);return r.end();}
  fs.readFile(rp,(e,d)=>{if(e){r.writeHead(404);return r.end('nf: '+u);}
    r.writeHead(200,{'Content-Type':M[path.extname(rp)]||'application/octet-stream'});r.end(d);});
}).listen(8930,()=>console.log('style server 8930'));
