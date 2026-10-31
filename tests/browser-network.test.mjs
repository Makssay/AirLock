import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readBrowserNetwork} from '../lib/browser-network.mjs';
const code=readFileSync('artifacts/v3-deployed-runtime.hex','utf8').trim();
function fixture(change={}){
 const calls=[];
 return {calls,fetchImpl:async(url,options)=>{const {method,params}=JSON.parse(options.body);calls.push({method,params});return {ok:true,json:async()=>({result:({eth_chainId:'0x190f1ca9',eth_blockNumber:'0x100',eth_getBalance:'0x2a4c18cca3f0cc000',eth_getCode:code,...change})[method]})};}};
}
test('static-host observer verifies code and pins balance/code reads to one block',async()=>{
 const f=fixture();const result=await readBrowserNetwork(f);assert.equal(result.codeVerified,true);assert.equal(result.block,256);assert.equal(result.blockTag,'latest');
 for(const call of f.calls.filter(c=>['eth_getBalance','eth_getCode'].includes(c.method)))assert.equal(call.params[1],'0x100');
 assert.ok(f.calls.every(c=>['eth_chainId','eth_blockNumber','eth_getBalance','eth_getCode'].includes(c.method)));
});
test('static observer rejects wrong chain, code and absent results',async()=>{
 for(const change of [{eth_chainId:'0x1'},{eth_getCode:'0x00'},{eth_getCode:'malformed'},{eth_getBalance:null}])await assert.rejects(()=>readBrowserNetwork(fixture(change)));
});
