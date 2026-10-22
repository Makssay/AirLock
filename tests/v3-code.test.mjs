import test from 'node:test';
import assert from 'node:assert/strict';
import {hexToU8a,compactAddLength} from '@polkadot/util';
import {matchesV3Code} from '../lib/v3-code.mjs';

test('V3 code verification accepts raw bytes and exactly one valid SCALE byte wrapper',()=>{
 const expected='0x608080604052';const raw=hexToU8a(expected);
 assert.equal(matchesV3Code(raw,expected),true);
 assert.equal(matchesV3Code(compactAddLength(raw),expected),true);
 assert.equal(matchesV3Code(compactAddLength(compactAddLength(raw)),expected),false);
 const altered=Uint8Array.from(raw);altered[3]^=1;
 assert.equal(matchesV3Code(compactAddLength(altered),expected),false);
 const truncated=compactAddLength(raw).subarray(0,raw.length);
 assert.equal(matchesV3Code(truncated,expected),false);
 const wrongLength=compactAddLength(raw);wrongLength[0]+=4;
 assert.equal(matchesV3Code(wrongLength,expected),false);
});
