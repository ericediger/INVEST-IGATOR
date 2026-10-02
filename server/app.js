import express from 'express';
import {fileURLToPath} from 'node:url';
import {today} from './model.js';
import {accessPolicy} from './access.js';
export function createApp(store,options={}) {
  const policy=accessPolicy(options),app=express(); app.disable('x-powered-by'); app.set('trust proxy',false);
  app.use((req,res,next)=>{
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});
    const remote=req.socket.remoteAddress;
    if(!policy.allows(remote,req.headers.host)) return res.status(403).json({error:'Access is restricted to the configured server addresses and trusted network.'});
    if(req.headers['sec-fetch-site']==='cross-site') return res.status(403).json({error:'Cross-site access denied'});
    if(!['GET','HEAD'].includes(req.method) && (req.headers.origin!==policy.origins.get(req.headers.host) || req.headers['x-research-request']!=='1' || !req.is('application/json'))) return res.status(403).json({error:'Same-origin JSON request required'});
    next();
  });
  app.use(express.json({limit:'5mb',strict:true}));
  app.get('/api/workspace',(req,res)=>res.json({...store.read(),today:today(),access:policy.label,accessDescription:policy.description,version:'1.3.1'}));
  app.get('/api/health',(req,res)=>res.json({ok:true,schemaVersion:1}));
  app.get('/api/export',(req,res)=>res.attachment(`investment-research-${today()}.json`).json(store.export()));
  app.get('/api/backups',(req,res)=>res.json({backups:store.backupStatus()}));
  app.post('/api/actions',(req,res,next)=>{try{res.json(store.update(req.headers['if-match'],req.body.action,req.body.payload));}catch(e){next(e);}});
  app.post('/api/restore/preview',(req,res,next)=>{try{const {workspace,...preview}=store.preview(req.body); res.json({...preview,revision:store.read().revision});}catch(e){next(e);}});
  app.post('/api/restore',(req,res,next)=>{try{res.json(store.restore(req.headers['if-match'],req.body.export,req.body.digest,req.body.confirmation));}catch(e){next(e);}});
  app.post('/api/backup',async(req,res,next)=>{try{res.json({backup:await store.backup()});}catch(e){next(e);}});
  const research=options.research;
  if(research) {
    const route=fn=>(req,res,next)=>{try{fn(req,res);}catch(e){next(e);}};
    app.get('/api/research/status',route((req,res)=>res.json(research.status())));
    app.get('/api/research/runs',route((req,res)=>res.json({runs:research.list(typeof req.query.companyId==='string'?req.query.companyId:null)})));
    app.get('/api/research/runs/:id',route((req,res)=>res.json(research.read(req.params.id))));
    app.post('/api/research/runs',route((req,res)=>res.status(202).json(research.enqueue(req.body))));
    app.post('/api/research/runs/:id/cancel',route((req,res)=>res.json(research.cancel(req.params.id))));
    app.post('/api/research/runs/:id/accept',route((req,res)=>res.json(research.accept(req.params.id,req.headers['if-match'],req.body.acknowledgeChanged===true))));
    app.post('/api/research/settings',route((req,res)=>res.json(research.saveSettings(req.body,req.headers['if-match']))));
    app.get('/api/research/export',route((req,res)=>res.attachment(`investment-research-ai-${today()}.json`).json(research.export())));
    app.get('/api/research/analyses',route((req,res)=>res.json({analyses:research.listAnalyses()})));
    app.get('/api/research/analyses/:id',route((req,res)=>res.json(research.readAnalysis(req.params.id))));
    app.post('/api/research/analyses',route((req,res)=>res.status(202).json(research.createAnalysis(req.body))));
    app.post('/api/research/analyses/:id/cancel',route((req,res)=>res.json(research.cancelAnalysis(req.params.id))));
  }
  app.use(express.static(fileURLToPath(new URL('../public',import.meta.url)),{dotfiles:'deny',index:'index.html',etag:false}));
  app.use((req,res)=>res.status(404).json({error:'Not found'}));
  app.use((error,req,res,next)=>{
    const status=error.type==='entity.too.large'?413:error instanceof SyntaxError?400:error.status||500;
    res.status(status).json({error:status===500?'Save unavailable. Your draft is preserved; retry shortly.':error.type==='entity.too.large'?'Import exceeds the 5 MB limit.':error.message});
    if(status===500) console.error('Request failed:',error.code||error.name); // no notes, payloads or credentials
  });
  return app;
}
