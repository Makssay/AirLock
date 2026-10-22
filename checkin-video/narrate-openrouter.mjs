import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
const out=fileURLToPath(new URL('./out/',import.meta.url));mkdirSync(out,{recursive:true});
if(!process.argv.includes('--generate'))throw Error('Use --generate to synthesize the approved narration');
const env=parseEnv(readFileSync(root+'.env','utf8'));
const key=(env.OPENROUTER_API_KEY||env.OPENROUTER||'').trim();
if(!key)throw Error('Local OpenRouter key unavailable');
const model='google/gemini-3.8-flash-tts',voice='Fenrir',fps=15;
const instructions='Speak conversational American English, as a founder explaining their own product to a colleague. Warm, confident and understated, with the same natural conversational delivery across every chapter. Unhurried but engaged. Natural phrasing, subtle changes of emphasis and short pauses between thoughts. No advertising or theatrical delivery. Pronounce Portaldot as Portal dot, V3 as V three, and tPOT as tee pot. Read only the supplied text.';
const scenes=JSON.parse(readFileSync(publicDir+'scenes.json','utf8'));
if(scenes.length!==8||scenes.reduce((sum,s)=>sum+s.narration.length,0)>6500)throw Error('Narration exceeds the reviewed eight-scene budget');
const journal=out+'fenrir-narration.json';
const report=existsSync(journal)?JSON.parse(readFileSync(journal,'utf8')):{model,voice,segments:[]};
const save=()=>writeFileSync(journal,JSON.stringify(report,null,2));
function wav(pcm){const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(pcm.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(24000,24);h.writeUInt32LE(48000,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm]);}
for(let start=0;start<scenes.length;start+=4){
 await Promise.all(scenes.slice(start,start+4).map(async(scene,offset)=>{
  const index=start+offset,hash=createHash('sha256').update(JSON.stringify({model,voice,instructions,text:scene.narration})).digest('hex');
  const old=report.segments.find(s=>s.index===index&&s.hash===hash);
  if(old&&existsSync(publicDir+old.audio)){scene.duration=old.seconds;return;}
  const r=await fetch('https://openrouter.ai/api/v1/audio/speech',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,voice,input:scene.narration,instructions,response_format:'pcm'}),signal:AbortSignal.timeout(120000)});
  if(!r.ok)throw Error('OpenRouter speech request rejected: HTTP '+r.status);
  const contentType=r.headers.get('content-type')||'';
  if(!contentType.includes('audio/pcm')||!contentType.includes('24000'))throw Error('Unexpected audio format');
  const pcm=Buffer.from(await r.arrayBuffer());if(pcm.length<48000)throw Error('Incomplete narration segment');
  const audio=`fenrir-${index}.wav`;writeFileSync(publicDir+audio,wav(pcm));scene.duration=pcm.length/48000;
  const segment={index,hash,audio,seconds:scene.duration,generationId:r.headers.get('x-generation-id')};
  report.segments=report.segments.filter(s=>s.index!==index);report.segments.push(segment);save();
  console.log(JSON.stringify({scene:index+1,voice,seconds:scene.duration}));
 }));
}
let cursor=0;for(const [index,scene]of scenes.entries()){scene.start=cursor;scene.frames=Math.ceil((scene.duration+0.8)*fps);scene.audio=`fenrir-${index}.wav`;cursor+=scene.frames;}
if(cursor/fps>=180)throw Error('Narration exceeds the three-minute submission limit');
writeFileSync(publicDir+'scenes.json',JSON.stringify(scenes,null,2));
for(const segment of report.segments){if(!segment.generationId)continue;const r=await fetch('https://openrouter.ai/api/v1/generation?id='+encodeURIComponent(segment.generationId),{headers:{Authorization:'Bearer '+key}});if(r.ok){const d=(await r.json()).data;segment.cost=d.total_cost;}}
report.seconds=cursor/fps;report.costsRecorded=report.segments.filter(s=>typeof s.cost==='number').length;report.totalCostUsd=report.costsRecorded===report.segments.length?report.segments.reduce((sum,s)=>sum+s.cost,0):null;save();
console.log(JSON.stringify({seconds:report.seconds,totalCostUsd:report.totalCostUsd,costsRecorded:report.costsRecorded}));
