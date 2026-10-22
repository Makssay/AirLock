import {AbsoluteFill,Audio,Img,Sequence,interpolate,staticFile,useCurrentFrame,useVideoConfig} from "remotion";
import scenes from "../public/scenes.json";
const ink="#182e4a",blue="#315adc",muted="#536981";
function Scene({index}:{index:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig(),s=scenes[index];
 const captions=["For teams with a treasury on Portaldot", "Architecture explanation; no baseline loss experiment", "Earlier confirmed run; six canonical source confirmations", "Controlled request to the guardian wallet", "Funding recovery delayed response beyond 120 seconds", "0 tPOT paid during this scenario; 4 tPOT cancelled", "Trusted RPC relay; not an Ethereum consensus proof", "Testnet prototype; independent review still needed"];
 return <AbsoluteFill style={{background:"#f1f5fa",fontFamily:"Arial, sans-serif",color:ink,padding:80,opacity:interpolate(frame,[0,fps*.35],[0,1],{extrapolateRight:"clamp"})}}>
  <Audio src={staticFile(`voice-${index}.wav`)}/>
  <div style={{display:"flex",justifyContent:"space-between",fontSize:28,color:muted}}><strong style={{color:ink,fontSize:36}}>airlock.</strong><span>Portaldot Hacker House 2026 | Week 2</span></div>
  {index===1?<><h1 style={{fontSize:64,margin:"45px 0 0",letterSpacing:-2}}>{s.title}</h1><Img src={staticFile(s.image)} style={{position:"absolute",top:260,left:150,width:1620,height:710,objectFit:"contain"}}/></>:s.image?<>
   <div style={{position:"absolute",left:80,top:215,width:530}}><div style={{fontSize:28,color:blue,marginBottom:30}}>{s.chapter}</div><h1 style={{fontSize:78,lineHeight:1.05,letterSpacing:-3,margin:0}}>{s.title}</h1><p style={{fontSize:32,lineHeight:1.45,color:muted,marginTop:45}}>{captions[index]}</p><div style={{borderTop:"3px solid #d3deeb",marginTop:40,paddingTop:25,fontSize:27,lineHeight:1.5}}>Real application screens<br/>Saved finalized V3 evidence<br/>No new signing in this video</div></div>
   <Img src={staticFile(s.image)} style={{position:"absolute",left:670,top:155,width:1170,height:820,objectFit:"contain",border:"1px solid #d3deeb",borderRadius:12,background:"#f1f5fa"}}/>
  </>:<div style={{position:"absolute",left:100,top:245,right:100}}><div style={{fontSize:32,color:blue,marginBottom:35}}>{s.chapter}</div><h1 style={{fontSize:100,lineHeight:1.08,letterSpacing:-4,margin:0,maxWidth:1500}}>{s.title}</h1><p style={{fontSize:42,lineHeight:1.5,color:muted,maxWidth:1570,marginTop:50}}>{index===0?"A valid relay signature can still carry a bad payout instruction.":index===6?"Quarantine, guardian pause and cancellation are verified. Small malicious payouts within the cap are still possible.":"Guardian alerts. Response readiness. Adversarial integration tests."}</p>{index===6&&<div style={{fontSize:28,lineHeight:1.7,marginTop:30}}>V3 contract: 0x3bbb62bf86d40f26a87e70fe56ee073e69198713<br/>Full receipts: artifacts/v3-attack-demo.json</div>}{index===7&&<div style={{display:"flex",gap:75,marginTop:60,fontSize:35}}><span><strong style={{fontSize:70}}>0</strong><br/>tPOT paid in scenario</span><span><strong style={{fontSize:70}}>4</strong><br/>tPOT cancelled</span><span><strong style={{fontSize:70}}>48.75</strong><br/>tPOT vault after response</span></div>}</div>}
  <div style={{position:"absolute",left:80,right:80,bottom:35,display:"flex",justifyContent:"space-between",fontSize:23,color:muted}}><span>{captions[index]}</span><span>{index+1} / 8</span></div>
 </AbsoluteFill>;
}
export const MyComponent=()=>{
 const {fps}=useVideoConfig();
 return <AbsoluteFill>
  <Sequence name="Problem" from={scenes[0].start} durationInFrames={scenes[0].frames} premountFor={fps}><Scene index={0}/></Sequence>
  <Sequence name="Architecture" from={scenes[1].start} durationInFrames={scenes[1].frames} premountFor={fps}><Scene index={1}/></Sequence>
  <Sequence name="Normal payout" from={scenes[2].start} durationInFrames={scenes[2].frames} premountFor={fps}><Scene index={2}/></Sequence>
  <Sequence name="Quarantine" from={scenes[3].start} durationInFrames={scenes[3].frames} premountFor={fps}><Scene index={3}/></Sequence>
  <Sequence name="Pause" from={scenes[4].start} durationInFrames={scenes[4].frames} premountFor={fps}><Scene index={4}/></Sequence>
  <Sequence name="Cancel" from={scenes[5].start} durationInFrames={scenes[5].frames} premountFor={fps}><Scene index={5}/></Sequence>
  <Sequence name="Trust limits" from={scenes[6].start} durationInFrames={scenes[6].frames} premountFor={fps}><Scene index={6}/></Sequence>
  <Sequence name="Next milestone" from={scenes[7].start} durationInFrames={scenes[7].frames} premountFor={fps}><Scene index={7}/></Sequence>
 </AbsoluteFill>;
};
