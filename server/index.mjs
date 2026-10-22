import express from 'express';
import { createServer as createViteServer } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { prepareV3 } from '../scripts/v3-prepare.mjs';
import { verifyV3Receipt } from './v3-receipt.mjs';
import { LiveV3 } from './live-v3.mjs';
import {randomBytes} from 'node:crypto';
const app=express();const port=Number(process.env.PORT||5173);
const live=new LiveV3(),controlToken=randomBytes(32).toString('hex');
app.use(express.json({limit:'8kb'}));
app.use('/api',(req,res,next)=>{
 if(req.method!=='GET' && req.headers.origin && req.headers.origin!==`http://127.0.0.1:${port}` && req.headers.origin!==`http://localhost:${port}`)return res.status(403).json({error:'Only the local Airlock interface may change lab state'});
 res.set('Cache-Control','no-store');next();
});
app.get('/api/state',async(_req,res)=>{try{res.json(await live.snapshot());}catch(e){res.status(503).json({error:e.message});}});
app.use('/api/live',(req,res,next)=>{
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return res.status(403).json({error:'Use the local Airlock address'});
 if(req.method!=='GET'&&(![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin)||req.headers['x-airlock-control']!==controlToken))return res.status(403).json({error:'Use the local Airlock controls to request a testnet transaction'});
 next();
});
app.get('/api/live/state',async(req,res)=>{try{res.json({...await live.snapshot(req.query.refresh==='1'),controlToken});}catch(e){res.status(503).json({error:e.message});}});
app.get('/api/live/jobs',(_req,res)=>res.json({jobs:live.store.jobs.toReversed(),busy:live.busy}));
app.get('/api/live/demo-quote',async(_req,res)=>{try{res.json(await live.demoQuote());}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/live/demo',(_req,res)=>{try{res.json(JSON.parse(readFileSync('artifacts/v3-attack-demo.json','utf8')));}catch{res.json(null);}});
app.get('/api/live/evidence',async(_req,res)=>{try{res.attachment('airlock-v3-live-state.json').json({disclaimer:'Finalized Portaldot V3 state and local submission journal. No external-chain proof.',...await live.snapshot(true)});}catch(e){res.status(503).json({error:e.message});}});
app.post('/api/live/action',(req,res)=>{try{res.status(202).json(live.start(req.body,req.headers['x-request-id']));}catch(e){res.status(400).json({error:e.message});}});
let preparingV3=false;
app.get('/api/v3/preparation',(_req,res)=>{try{res.json(JSON.parse(readFileSync('deployments/v3-preparation.local.json','utf8')));}catch{res.status(404).json({error:'Prepare the V3 deployment first.'});}});
app.post('/api/v3/prepare',async(_req,res)=>{
 if(preparingV3)return res.status(409).json({error:'Preparation is already running.'});
 preparingV3=true;
 try{res.json(await prepareV3());}catch(e){res.status(400).json({error:e.message});}finally{preparingV3=false;}
});
app.get('/api/v3/receipt',(_req,res)=>{try{res.json(JSON.parse(readFileSync('deployments/airlock-v3.local.json','utf8')));}catch{try{res.json(JSON.parse(readFileSync('artifacts/v3-live-evidence.json','utf8')).deployment);}catch{res.status(404).json({error:'No verified V3 deployment yet.'});}}});
app.get('/api/v3/evidence',(_req,res)=>{try{res.json(JSON.parse(readFileSync('artifacts/v3-live-evidence.json','utf8')));}catch{res.status(404).json({error:'V3 smoke test has not completed yet.'});}});
app.post('/api/v3/receipt',async(req,res)=>{try{res.json(await verifyV3Receipt(req.body));}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/evm-evidence',(_req,res)=>{try{res.json(JSON.parse(readFileSync('artifacts/evm/local-chain-evidence.json','utf8')));}catch{res.status(404).json({error:'No local EVM deployment recorded. Run npm run evm:node and npm run evm:demo.'});}});
app.post('/api/action',(_req,res)=>res.status(410).json({error:'Sandbox actions are retired. Use the V3 testnet controls.'}));
app.get('/api/evidence',async(_req,res)=>{try{res.attachment('airlock-v3-state.json').json(await live.snapshot(true));}catch(e){res.status(503).json({error:e.message});}});
if(process.argv.includes('--production')){app.use(express.static(resolve('dist')));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));}
else{const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.listen(port,'127.0.0.1',()=>console.log(`Airlock V3 testnet console: http://127.0.0.1:${port}`));
