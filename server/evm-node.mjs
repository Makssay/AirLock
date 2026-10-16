import { startAnvil } from '../lib/anvil.mjs';
const server=await startAnvil({port:8545});
console.log('Airlock local EVM development chain: http://127.0.0.1:8545 (chain ID 31337)');
console.log('Public development accounts only. No Portaldot V3 compatibility is claimed.');
process.on('SIGINT',async()=>{await server.close();process.exit(0);});
process.on('SIGTERM',async()=>{await server.close();process.exit(0);});
process.stdin.resume();
