import { readFileSync } from 'node:fs';
import { blake2AsU8a } from '@polkadot/util-crypto';
import { configuration, ACTORS, UNIT, hex, uint, integer, decodeState, decodeMessage, ERRORS, messageCall, messageKey } from './abi.mjs';

class ReturnSignal extends Error {constructor(flags,data){super('Contract returned');this.flags=flags;this.data=Buffer.from(data);}}
export class ContractError extends Error {constructor(code){super(ERRORS[code]||`Contract error ${code}`);this.code=code;}}

/** Executes the actual compiled contract with an isolated seal0 host.
 * Emulates atomic revert/storage/POT transfers. It is not a blockchain node.
 */
export class WasmLab {
 constructor({config=configuration(),balance=1000n*UNIT,now=1800000000000,wasm=readFileSync(new URL('../artifacts/airlock.wasm',import.meta.url))}={}) {
  this.storage=new Map();this.balances=new Map();this.events=[];this.balance=balance;this.now=now;this.input=Buffer.alloc(0);this.actor=ACTORS.guardian;this.failTransfers=false;
  this.memory=new WebAssembly.Memory({initial:16,maximum:16});
  const read=(p,n)=>Buffer.from(new Uint8Array(this.memory.buffer,p,n));
  const write=(p,b)=>new Uint8Array(this.memory.buffer,p,b.length).set(b);
  const output=(p,l,b)=>{const view=new DataView(this.memory.buffer);if(view.getUint32(l,true)<b.length)throw Error('Host output buffer too small');write(p,b);view.setUint32(l,b.length,true);};
  const seal0={
   seal_input:(p,l)=>output(p,l,this.input),seal_return:(f,p,n)=>{throw new ReturnSignal(f,read(p,n));},
   seal_caller:(p,l)=>output(p,l,this.actor),seal_now:(p,l)=>output(p,l,uint(this.now,8)),seal_balance:(p,l)=>output(p,l,uint(this.balance,16)),
   seal_set_storage:(k,p,n)=>this.storage.set(hex(read(k,32)),read(p,n)),
   seal_get_storage:(k,p,l)=>{const b=this.storage.get(hex(read(k,32)));if(!b)return 3;output(p,l,b);return 0;},
   seal_hash_blake2_256:(p,n,o)=>write(o,blake2AsU8a(read(p,n),256)),
   seal_transfer:(p,n,v,vl)=>{if(n!==32||vl!==16||this.failTransfers)return 5;const amount=integer(read(v,vl),0,16);if(amount>this.balance)return 5;const account=hex(read(p,n));this.balance-=amount;this.balances.set(account,(this.balances.get(account)||0n)+amount);return 0;},
   seal_deposit_event:(_t,_tl,p,n)=>this.events.push(read(p,n)),
  };
  this.module=new WebAssembly.Module(wasm);this.seal0=seal0;
  this.invoke('deploy',config,ACTORS.guardian);
 }
 invoke(entry,input,actor) {
  const before={storage:new Map([...this.storage].map(([k,v])=>[k,Buffer.from(v)])),balances:new Map(this.balances),balance:this.balance,events:[...this.events]};
  this.input=Buffer.from(input);this.actor=actor;
  // pallet-contracts provides fresh linear memory for each execution.
  this.memory=new WebAssembly.Memory({initial:16,maximum:16});
  this.instance=new WebAssembly.Instance(this.module,{env:{memory:this.memory},seal0:this.seal0});
  try {this.instance.exports[entry]();return Buffer.alloc(0);}
  catch(e) {
   if(e instanceof ReturnSignal && !(e.flags&1))return e.data;
   this.storage=before.storage;this.balances=before.balances;this.balance=before.balance;this.events=before.events;
   if(e instanceof ReturnSignal)throw new ContractError(e.data[0]);throw e;
  }
 }
 call(input,actor=ACTORS.outsider){return this.invoke('call',input,actor);}
 state(){return decodeState(this.call([0]));}
 message(key){return decodeMessage(this.call(messageCall(7,key)));}
 advance(ms){if(!Number.isSafeInteger(ms)||ms<0)throw Error('Invalid time delta');this.now+=ms;}
 key(nonce){return messageKey(nonce);}
}
