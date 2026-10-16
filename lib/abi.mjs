import { blake2AsU8a } from '@polkadot/util-crypto';
export const UNIT=100_000_000_000_000n;
export const address = byte => new Uint8Array(32).fill(byte);
export const ACTORS={relay:address(11),guardian:address(22),recipient:address(33),attacker:address(44),outsider:address(55)};
export const DOMAIN=blake2AsU8a('airlock:external-testnet:v1',256);
export const ERRORS={1:'Invalid payload',2:'Contract not initialized',3:'Only the guardian can perform this action',4:'Arithmetic invariant failed',5:'Invalid policy or recipient',6:'Window release limit reached',7:'Transfer failed',8:'Insufficient unreserved vault funds',9:'Only the authorized relay can submit messages',10:'Releases are paused',11:'Source domain is not allowed',12:'Message has already been submitted',13:'Quarantine capacity reached',14:'Message not found',15:'Message is no longer queued',16:'Timelock has not elapsed',17:'No pending policy change',18:'Amount exceeds the maximum release per window'};
export function bytes(...items) { return Buffer.concat(items.map(x=>Buffer.from(x))); }
export function uint(value,size) { let n=BigInt(value);if(n<0n || n>=(1n<<BigInt(size*8)))throw Error('Integer outside ABI range');const b=Buffer.alloc(size);for(let i=0;i<size;i++){b[i]=Number(n&255n);n>>=8n;}return b; }
export function integer(b,start,size) { let n=0n;for(let i=size-1;i>=0;i--)n=(n<<8n)|BigInt(b[start+i]);return n; }
export const hex=b=>'0x'+Buffer.from(b).toString('hex');
export function units(value) { const s=String(value);if(!/^\d+(\.\d{1,14})?$/.test(s))throw Error('Enter a positive amount with at most 14 decimals');const [a,b='']=s.split('.');return BigInt(a)*UNIT+BigInt(b.padEnd(14,'0')); }
export function human(n) { const v=BigInt(n);const f=(v%UNIT).toString().padStart(14,'0').replace(/0+$/,'');return (v/UNIT).toString()+(f?'.'+f:''); }
export function configuration(overrides={}) {
 const c={relay:ACTORS.relay,guardian:ACTORS.guardian,domain:DOMAIN,instant:25n*UNIT,cap:100n*UNIT,delay:120000n,window:600000n,policyDelay:300000n,reserveFloor:100n*UNIT,maxPending:400n*UNIT,...overrides};
 return bytes(c.relay,c.guardian,c.domain,uint(c.instant,16),uint(c.cap,16),uint(c.delay,8),uint(c.window,8),uint(c.policyDelay,8),uint(c.reserveFloor,16),uint(c.maxPending,16));
}
export function submission(nonce,recipient,amount,domain=DOMAIN) {return bytes([1],domain,uint(nonce,8),recipient,uint(amount,16));}
export const messageKey=(nonce,domain=DOMAIN)=>blake2AsU8a(bytes([77],domain,uint(nonce,8)),256);
export const messageCall=(op,key)=>bytes([op],key);
export function policyCall({instant,cap,delay,maxPending,resume=false}) {return bytes([5],uint(instant,16),uint(cap,16),uint(delay,8),uint(maxPending,16),[resume?1:0]);}
export function decodeState(b) {
 if(b.length!==315)throw Error(`Unexpected state length ${b.length}`);
 const val=(p,n)=>integer(b,p,n);
 return {relay:hex(b.subarray(0,32)),guardian:hex(b.subarray(32,64)),domain:hex(b.subarray(64,96)),instant:val(96,16),cap:val(112,16),delay:Number(val(128,8)),window:Number(val(136,8)),policyDelay:Number(val(144,8)),reserveFloor:val(152,16),maxPending:val(168,16),paused:!!b[184],reserved:val(185,16),spent:val(201,16),balance:val(217,16),now:Number(val(233,8)),plan:b[241]?{instant:val(242,16),cap:val(258,16),delay:Number(val(274,8)),maxPending:val(282,16),resume:!!b[298],eligibleAt:Number(val(299,8))}:null};
}
export function decodeMessage(b) {if(b.length!==65)throw Error('Invalid message record');return {status:['missing','queued','released','cancelled'][b[0]],recipient:hex(b.subarray(1,33)),amount:integer(b,33,16),eligibleAt:Number(integer(b,49,8)),createdAt:Number(integer(b,57,8))};}
