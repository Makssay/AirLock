import {createHmac} from 'node:crypto';
const origins=new Set(['https://airlock.credvote.xyz','https://airlock-v3-by-makssay-and-kuznets.vercel.app','https://airlock-by-makssay-and-kuznets.vercel.app','https://airlock-portaldot.vercel.app','https://makssay.github.io','http://127.0.0.1:5181','http://localhost:5181']);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
 const origin=req.headers.origin;
 if(origin&&!origins.has(origin))return res.status(403).json({error:'Open the Airlock playground on its public website'});
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Demo-Session, X-Request-Id');}
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({error:'Use POST for the demo API'});
 if(!req.headers['content-type']?.startsWith('application/json'))return res.status(415).json({error:'Use JSON for demo actions'});
 const service=process.env.AIRLOCK_SANDBOX_SERVICE_TOKEN,endpoint=process.env.AIRLOCK_SANDBOX_ORIGIN;
 if(!service||!endpoint)return res.status(503).json({error:'The interactive demo service is not configured yet'});
 let body=req.body;
 if(typeof body==='string'){try{body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid JSON'});}}
 if(!body||typeof body!=='object'||JSON.stringify(body).length>4096)return res.status(400).json({error:'Invalid demo request'});
 // Never forward arbitrary caller fields or notification destinations.
 const input={action:body.action};if(body.action==='redeem')input.handoff=body.handoff;if(body.action==='request')input.scenario=body.scenario;if(['execute','cancel'].includes(body.action))input.messageId=body.messageId;
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const client=createHmac('sha256',service).update(ip).digest('hex');
 try{
  const response=await fetch(new URL('/api/session',endpoint),{method:'POST',headers:{'Content-Type':'application/json','X-Airlock-Service':service,'OAI-Sites-Authorization':'Bearer '+(process.env.AIRLOCK_SANDBOX_SITE_TOKEN||''),'X-Client-Key':client,'X-Demo-Session':String(req.headers['x-demo-session']||''),'X-Request-Id':String(req.headers['x-request-id']||'')},body:JSON.stringify(input),signal:AbortSignal.timeout(12000)});
  const result=await response.json();return res.status(response.status).json(result);
 }catch{return res.status(503).json({error:'The demo service is temporarily unavailable. Your saved treasury can be reopened when it reconnects.'});}
}
