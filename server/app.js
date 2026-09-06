import express from 'express';
import {fileURLToPath} from 'node:url';
import {today} from './model.js';
export function createApp(store,{origin='http://127.0.0.1:5191'}={}) {
  const app=express(),host=new URL(origin).host; app.disable('x-powered-by'); app.set('trust proxy',false);
  app.use((req,res,next)=>{
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});
    const remote=req.socket.remoteAddress;
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote) || req.headers.host!==host) return res.status(403).json({error:'Local access only. Use the configured 127.0.0.1 address.'});
    if(req.headers['sec-fetch-site']==='cross-site') return res.status(403).json({error:'Cross-site access denied'});
    if(!['GET','HEAD'].includes(req.method) && (req.headers.origin!==origin || req.headers['x-research-request']!=='1' || !req.is('application/json'))) return res.status(403).json({error:'Same-origin JSON request required'});
    next();
  });
  app.use(express.json({limit:'5mb',strict:true}));
  app.get('/api/workspace',(req,res)=>res.json({...store.read(),today:today(),access:'This Mac only · loopback',version:'1.0.0'}));
  app.get('/api/health',(req,res)=>res.json({ok:true,schemaVersion:1}));
  app.get('/api/export',(req,res)=>res.attachment(`investment-research-${today()}.json`).json(store.export()));
  app.get('/api/backups',(req,res)=>res.json({backups:store.backupStatus()}));
  app.post('/api/actions',(req,res,next)=>{try{res.json(store.update(req.headers['if-match'],req.body.action,req.body.payload));}catch(e){next(e);}});
  app.post('/api/restore/preview',(req,res,next)=>{try{const {workspace,...preview}=store.preview(req.body); res.json({...preview,revision:store.read().revision});}catch(e){next(e);}});
  app.post('/api/restore',(req,res,next)=>{try{res.json(store.restore(req.headers['if-match'],req.body.export,req.body.digest,req.body.confirmation));}catch(e){next(e);}});
  app.post('/api/backup',async(req,res,next)=>{try{res.json({backup:await store.backup()});}catch(e){next(e);}});
  app.use(express.static(fileURLToPath(new URL('../public',import.meta.url)),{dotfiles:'deny',index:'index.html',etag:false}));
  app.use((req,res)=>res.status(404).json({error:'Not found'}));
  app.use((error,req,res,next)=>{
    const status=error.type==='entity.too.large'?413:error instanceof SyntaxError?400:error.status||500;
    res.status(status).json({error:status===500?'Save unavailable. Your draft is preserved; retry shortly.':status===413?'Import exceeds the 5 MB limit.':error.message});
    if(status===500) console.error('Request failed:',error.code||error.name); // no notes, payloads or credentials
  });
  return app;
}
