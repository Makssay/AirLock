import {env} from 'cloudflare:workers';
import {change} from '../../../lib/playground-runtime';
import {timingSafeEqual} from 'node:crypto';
export const dynamic='force-dynamic';
const equal=(a:string|null,b:string|undefined)=>!!a&&!!b&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export async function POST(request:Request){
 const config=env as any;
 if(!equal(request.headers.get('x-airlock-service'),config.AIRLOCK_SANDBOX_SERVICE_TOKEN))return Response.json({error:'Use the Airlock public playground'},{status:403});
 try{
  const text=await request.text();if(text.length>4096)throw Error('Demo request too large');
  const input=JSON.parse(text),client=request.headers.get('x-client-key');if(!client||!/^[a-f0-9]{64}$/.test(client))throw Error('Client identity unavailable');
  const result=await change(config,store=>store.perform({token:request.headers.get('x-demo-session'),client,requestId:request.headers.get('x-request-id'),input,botUsername:config.TELEGRAM_BOT_USERNAME}));
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error:any){const message=error.message||'Demo service unavailable';return Response.json({error:message},{status:message.includes('session expired')?401:message.includes('rate limit')?429:message.includes('busy')?503:400,headers:{'Cache-Control':'no-store'}});}
}
