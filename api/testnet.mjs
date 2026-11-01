import {readDestination,verifyOutbox,inspectSourceStatus,validHash} from '../lib/testnet-lane.mjs';
const origins=new Set(['https://airlock.credvote.xyz','https://airlock-v3-by-makssay-and-kuznets.vercel.app','https://airlock-by-makssay-and-kuznets.vercel.app','https://airlock-portaldot.vercel.app','https://makssay.github.io']);
for(const port of [5173,5174,5176,5181])for(const host of ['127.0.0.1','localhost'])origins.add(`http://${host}:${port}`);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
 if(req.headers.origin&&!origins.has(req.headers.origin))return res.status(403).json({error:'Use the Airlock website'});
 if(req.headers.origin)res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Read-only testnet observation'});}
 const hash=req.query?.hash;
 if(hash!==undefined&&!validHash(hash))return res.status(400).json({error:'Invalid source transaction hash'});
 const fromBlock=req.query?.from===undefined?undefined:Number(req.query.from);
 if(fromBlock!==undefined&&(!Number.isSafeInteger(fromBlock)||fromBlock<146537))return res.status(400).json({error:'Invalid destination starting block'});
 try{
  const [destination,source]=await Promise.all([readDestination(),verifyOutbox()]);
  const request=hash?await inspectSourceStatus(hash,{destination,fromBlock}):null;
  return res.status(200).json({destination,source,request});
 }catch{return res.status(503).json({error:'The current testnet state could not be verified. Keep any saved transaction hash and refresh.'});}
}
