import {compactFromU8a,u8aToHex} from '@polkadot/util';

export function matchesV3Code(raw,expected){
 if(u8aToHex(raw)===expected)return true;
 try{const [prefix,length]=compactFromU8a(raw);return length.toNumber()===raw.length-prefix&&u8aToHex(raw.subarray(prefix))===expected;}catch{return false;}
}

// Revive's runtime API can return one SCALE Bytes prefix. Browser code uses
// the same pinned digest as the EVM observer, without shipping the full runtime.
export async function matchesV3RuntimeHash(raw,expected){
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
 if(await digest(raw)===expected)return true;
 try{const [prefix,length]=compactFromU8a(raw);return length.toNumber()===raw.length-prefix&&await digest(raw.subarray(prefix))===expected;}catch{return false;}
}
