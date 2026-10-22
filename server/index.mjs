import express from 'express';
import { createServer as createViteServer } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { Session } from './session.mjs';
import { prepareV3 } from '../scripts/v3-prepare.mjs';
import { verifyV3Receipt } from './v3-receipt.mjs';
const app=express();const session=new Session();const port=Number(process.env.PORT||5173);
app.use(express.json({limit:'8kb'}));
app.use('/api',(req,res,next)=>{
 if(req.method!=='GET' && req.headers.origin && req.headers.origin!==`http://127.0.0.1:${port}` && req.headers.origin!==`http://localhost:${port}`)return res.status(403).json({error:'Only the local Airlock interface may change lab state'});
 res.set('Cache-Control','no-store');next();
});
app.get('/api/state',(_req,res)=>res.json(session.snapshot()));
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
app.post('/api/action',(req,res)=>{try{const result=session.action(req.body);res.json({result,snapshot:session.snapshot()});}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/evidence',(_req,res)=>res.attachment('airlock-wasm-lab-evidence.json').json({disclaimer:'Isolated WASM host execution. These receipts are not blockchain transactions or bridge proofs.',...session.snapshot()}));
if(process.argv.includes('--production')){app.use(express.static(resolve('dist')));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));}
else{const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.listen(port,'127.0.0.1',()=>console.log(`Airlock WASM lab: http://127.0.0.1:${port}`));
