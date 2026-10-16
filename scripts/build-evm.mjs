import solc from 'solc';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const source=readFileSync('contracts/evm/Airlock.sol','utf8');
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'Airlock.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}})));
for(const e of output.errors||[])console.log(e.formattedMessage);
if(output.errors?.some(e=>e.severity==='error'))process.exit(1);
mkdirSync('artifacts/evm',{recursive:true});
for(const [name,contract] of Object.entries(output.contracts['Airlock.sol'])){
 writeFileSync(`artifacts/evm/${name}.json`,JSON.stringify({contractName:name,compiler:solc.version(),target:'EVM (Paris); NOT verified Portaldot V3/PVM bytecode',abi:contract.abi,bytecode:'0x'+contract.evm.bytecode.object,deployedBytecode:'0x'+contract.evm.deployedBytecode.object},null,2));
 console.log(`${name}: ${contract.evm.bytecode.object.length/2} bytes`);
}
