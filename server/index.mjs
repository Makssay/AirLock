import express from 'express';
import { createServer as createViteServer } from 'vite';
import { resolve } from 'node:path';
import { Session } from './session.mjs';
const app=express();const session=new Session();const port=Number(process.env.PORT||5173);
app.use(express.json({limit:'8kb'}));
app.use('/api',(req,res,next)=>{
 if(req.method!=='GET' && req.headers.origin && req.headers.origin!==`http://127.0.0.1:${port}` && req.headers.origin!==`http://localhost:${port}`)return res.status(403).json({error:'Only the local Airlock interface may change lab state'});
 res.set('Cache-Control','no-store');next();
});
app.get('/api/state',(_req,res)=>res.json(session.snapshot()));
app.post('/api/action',(req,res)=>{try{const result=session.action(req.body);res.json({result,snapshot:session.snapshot()});}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/evidence',(_req,res)=>res.attachment('airlock-wasm-lab-evidence.json').json({disclaimer:'Isolated WASM host execution. These receipts are not blockchain transactions or bridge proofs.',...session.snapshot()}));
if(process.argv.includes('--production')){app.use(express.static(resolve('dist')));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));}
else{const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.listen(port,'127.0.0.1',()=>console.log(`Airlock WASM lab: http://127.0.0.1:${port}`));
