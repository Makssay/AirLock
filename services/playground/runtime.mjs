import {CloudPlayground,emptyCloudState} from '../../lib/playground-cloud.mjs';
import {sendTelegram} from '../../lib/telegram-watch.mjs';
export async function change(env,fn){
 if(!env.DB)throw Error('Demo database unavailable');
 await env.DB.prepare("INSERT OR IGNORE INTO playground_state(id,revision,value) VALUES('root',0,?)").bind(JSON.stringify(emptyCloudState())).run();
 for(let attempt=0;attempt<8;attempt++){
  const row=await env.DB.prepare("SELECT revision,value FROM playground_state WHERE id='root'").first();
  const store=new CloudPlayground(JSON.parse(row.value));const result=fn(store);const value=JSON.stringify(store.data);
  if(value.length>1500000)throw Error('The demo is busy. Please try again later');
  if(value===row.value)return result;
  const write=await env.DB.prepare("UPDATE playground_state SET value=?,revision=revision+1 WHERE id='root' AND revision=?").bind(value,row.revision).run();
  if(write.meta.changes===1)return result;
 }
 throw Error('The demo is busy. Retry the same action');
}
export async function deliverPlayground(env){
 for(let i=0;i<3;i++){
  let notification;
  try{notification=await change(env,store=>store.claim());}catch{return;}
  if(!notification)return;
  try{
   await sendTelegram({token:env.TELEGRAM_BOT_TOKEN,chatId:notification.chat,text:notification.text,reviewUrl:notification.reviewUrl,prefix:'Airlock Playground · SIMULATION'});
   await change(env,store=>store.finish(notification.id,true));
  }catch(error){await change(env,store=>store.finish(notification.id,false,error.retryAfter||10));}
 }
}
