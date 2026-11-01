import {env} from 'cloudflare:workers';
import {change} from '../../../lib/playground-runtime';
import {timingSafeEqual} from 'node:crypto';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const config=env as any,a=request.headers.get('x-airlock-service'),b=config.AIRLOCK_SANDBOX_SERVICE_TOKEN;
 if(!a||!b||Buffer.byteLength(a)!==Buffer.byteLength(b)||!timingSafeEqual(Buffer.from(a),Buffer.from(b)))return new Response('Forbidden',{status:403});
 try{const text=await request.text();if(text.length>16000)throw Error();const update=JSON.parse(text);if(!Number.isSafeInteger(update.update_id))throw Error();await change(config,store=>store.connect(update));return Response.json({ok:true});}catch{return Response.json({error:'Retry webhook delivery'},{status:503});}
}
