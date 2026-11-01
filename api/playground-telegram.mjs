import {timingSafeEqual} from 'node:crypto';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST'});
 const a=req.headers['x-telegram-bot-api-secret-token'],b=process.env.AIRLOCK_PLAYGROUND_WEBHOOK_SECRET;
 if(typeof a!=='string'||!b||Buffer.byteLength(a)!==Buffer.byteLength(b)||!timingSafeEqual(Buffer.from(a),Buffer.from(b)))return res.status(403).json({error:'Forbidden'});
 const origin=process.env.AIRLOCK_SANDBOX_ORIGIN,service=process.env.AIRLOCK_SANDBOX_SERVICE_TOKEN,siteToken=process.env.AIRLOCK_SANDBOX_SITE_TOKEN;
 if(!origin||!service||!siteToken)return res.status(503).json({error:'Demo backend unavailable'});
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid update'});}
 if(!body||!Number.isSafeInteger(body.update_id)||JSON.stringify(body).length>16000)return res.status(400).json({error:'Invalid update'});
 try{const response=await fetch(new URL('/api/telegram',origin),{method:'POST',headers:{'Content-Type':'application/json','X-Airlock-Service':service,'OAI-Sites-Authorization':'Bearer '+siteToken},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});return res.status(response.ok?200:503).json({ok:response.ok});}catch{return res.status(503).json({error:'Retry delivery'});}
}
