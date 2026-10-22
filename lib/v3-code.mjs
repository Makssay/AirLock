import {compactFromU8a,u8aToHex} from '@polkadot/util';

export function matchesV3Code(raw,expected){
 if(u8aToHex(raw)===expected)return true;
 try{const [prefix,length]=compactFromU8a(raw);return length.toNumber()===raw.length-prefix&&u8aToHex(raw.subarray(prefix))===expected;}catch{return false;}
}
