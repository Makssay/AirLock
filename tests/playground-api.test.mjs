import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/playground.mjs';
import webhook from '../api/playground-telegram.mjs';
const response=()=>({headers:{},code:200,setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},json(value){this.body=value;return this;},end(){return this;}});

test('playground proxy rejects unrelated origins and supports Pages preflight',async()=>{
 const denied=response();await handler({method:'POST',headers:{origin:'https://unrelated.example'}},denied);assert.equal(denied.code,403);
 const preflight=response();await handler({method:'OPTIONS',headers:{origin:'https://makssay.github.io'}},preflight);assert.equal(preflight.code,204);assert.equal(preflight.headers['Access-Control-Allow-Origin'],'https://makssay.github.io');
});
test('public API strips notification destinations and uses server-only service credentials',async()=>{
 const keys=['AIRLOCK_SANDBOX_ORIGIN','AIRLOCK_SANDBOX_SERVICE_TOKEN','AIRLOCK_SANDBOX_SITE_TOKEN'],saved=Object.fromEntries(keys.map(key=>[key,process.env[key]])),fetch=globalThis.fetch;
 process.env.AIRLOCK_SANDBOX_ORIGIN='https://private.example';process.env.AIRLOCK_SANDBOX_SERVICE_TOKEN='service-fixture';process.env.AIRLOCK_SANDBOX_SITE_TOKEN='site-fixture';
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://private.example/api/session');assert.deepEqual(JSON.parse(options.body),{action:'request',scenario:'suspicious'});assert.equal(options.headers['X-Airlock-Service'],'service-fixture');assert.equal(options.headers['OAI-Sites-Authorization'],'Bearer site-fixture');assert.match(options.headers['X-Client-Key'],/^[a-f0-9]{64}$/);return {status:200,json:async()=>({session:{id:'owned-session'}})};};
  const res=response();await handler({method:'POST',headers:{origin:'https://makssay.github.io','content-type':'application/json','x-demo-session':'own-token','x-request-id':'request-000000000000001','x-forwarded-for':'192.0.2.1'},body:{action:'request',scenario:'suspicious',chat_id:'victim',text:'arbitrary text',rpc:'evil'}},res);
  assert.equal(res.code,200);assert.deepEqual(res.body,{session:{id:'owned-session'}});assert.ok(!JSON.stringify(res.body).includes('fixture'));
 }finally{globalThis.fetch=fetch;for(const key of keys)if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
});
test('Telegram webhook rejects an incorrect secret before reaching the backend',async()=>{
 const old=process.env.AIRLOCK_PLAYGROUND_WEBHOOK_SECRET;process.env.AIRLOCK_PLAYGROUND_WEBHOOK_SECRET='webhook-fixture';
 try{const res=response();await webhook({method:'POST',headers:{'x-telegram-bot-api-secret-token':'wrong'},body:{update_id:1}},res);assert.equal(res.code,403);}finally{if(old===undefined)delete process.env.AIRLOCK_PLAYGROUND_WEBHOOK_SECRET;else process.env.AIRLOCK_PLAYGROUND_WEBHOOK_SECRET=old;}
});
test('playground initial screen labels virtual funds and does not ask for a wallet',async()=>{
 const {createServer}=await import('vite'),{createServer:createHttpServer}=await import('node:http'),React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
 const vite=await createServer({server:{middlewareMode:true,hmr:{server:createHttpServer()}},appType:'custom'});
 try{const {default:Playground}=await vite.ssrLoadModule('/src/Playground.jsx');const html=renderToStaticMarkup(React.createElement(Playground,{onBack:()=>{}}));assert.match(html,/Simulation · virtual funds/);assert.match(html,/Create demo treasury/);assert.match(html,/No wallet needed/);assert.doesNotMatch(html,/TELEGRAM_BOT_TOKEN|private key|seed phrase/);}finally{await vite.close();}
});
