import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {ContractFactory,id,parseEther,formatEther} from 'ethers';
import {startAnvil} from '../lib/anvil.mjs';
import {guardianAlerts} from '../lib/guardian-watch.mjs';
import {verifyPauseTiming} from '../lib/demo-timing.mjs';

const artifact=JSON.parse(readFileSync('artifacts/evm/Airlock.json','utf8'));
const report={network:'Local Anvil',chainId:31337,scope:'Executable contract scenario. Not Portaldot testnet evidence. Local time is advanced explicitly.',checkedAt:new Date().toISOString(),checks:[],transactions:[]};
const rpc=await startAnvil();
const [relay,guardian,recipient,outsider]=await Promise.all([0,1,2,3].map(i=>rpc.provider.getSigner(i)));
const amount=parseEther,domain=id('airlock:local-final:v1');
async function receipt(label,promise){const r=await(await promise).wait();assert.equal(r.status,1);const b=await rpc.provider.getBlock(r.blockNumber);report.transactions.push({label,hash:r.hash,blockNumber:r.blockNumber,blockHash:r.blockHash,timestamp:b.timestamp});return b;}
async function advance(seconds){await rpc.request({method:'evm_increaseTime',params:[seconds]});await rpc.request({method:'evm_mine'});}
const balance=async c=>BigInt(await rpc.request({method:'eth_getBalance',params:[c.target,'latest']}));
try{
 const c=await new ContractFactory(artifact.abi,artifact.bytecode,relay).deploy(await relay.getAddress(),await guardian.getAddress(),domain,[amount('1'),amount('5'),120,amount('20')],600,300,amount('5'),{value:amount('50')});await c.waitForDeployment();report.contract=c.target;
 await receipt('Normal 0.25 payout',c.submit(domain,1,await recipient.getAddress(),amount('0.25')));
 assert.equal(await balance(c),amount('49.75'));report.checks.push('Normal payout changes vault by exactly 0.25');
 await receipt('Legitimate delayed 2 payout queued',c.submit(domain,2,await recipient.getAddress(),amount('2')));
 const legitimate=await c.messageId(domain,2);await assert.rejects(c.connect(outsider).execute.staticCall(legitimate));report.checks.push('Execution rejected before eligibility');
 await advance(121);await receipt('Legitimate delayed payout executed',c.connect(outsider).execute(legitimate));assert.equal(await balance(c),amount('47.75'));report.checks.push('Legitimate queued request executes after delay');
 const before=await balance(c);
 const queuedBlock=await receipt('Controlled 4 payout queued',c.submit(domain,3,await recipient.getAddress(),amount('4')));
 const key=await c.messageId(domain,3),message=await c.messages(key);
 const alerts=guardianAlerts({now:queuedBlock.timestamp*1000,paused:false,messages:[{key,amount:'4',recipient:message.recipient,status:'queued',eligibleAt:Number(message.eligibleAt)*1000}]});assert.equal(alerts.length,1);assert.equal(alerts[0].state,'quarantine');report.alert=alerts[0];
 await advance(10);
 const pauseBlock=await receipt('Guardian pause within quarantine',c.connect(guardian).pause());
 report.pauseTiming=verifyPauseTiming({eligibleAt:Number(message.eligibleAt)*1000,pauseBlockTimestamp:pauseBlock.timestamp});
 await advance(121);await assert.rejects(c.execute.staticCall(key));report.checks.push('Paused request cannot execute even after eligibility');
 await assert.rejects(c.connect(outsider).cancel.staticCall(key));report.checks.push('Unauthorized cancellation rejected');
 await receipt('Guardian cancellation',c.connect(guardian).cancel(key));const afterCancellation=await balance(c);assert.equal(afterCancellation,before);assert.equal(await c.reserved(),0n);report.checks.push('Cancellation returns reservations to zero; queued request pays zero');
 await receipt('Schedule resume',c.connect(guardian).schedulePolicy([amount('1'),amount('5'),120,amount('20')],true));await assert.rejects(c.activatePolicy.staticCall());report.checks.push('Resume rejected before policy timelock');
 await advance(301);await receipt('Activate resume after policy timelock',c.connect(outsider).activatePolicy());assert.equal(await c.paused(),false);
 await assert.rejects(c.submit.staticCall(domain,3,await outsider.getAddress(),amount('1')));report.checks.push('Cancelled nonce replay rejected after resume');
 // Place split requests near the beginning of one fixed window.
 const block=await rpc.provider.getBlock('latest');await rpc.request({method:'evm_setNextBlockTimestamp',params:[(Math.floor(block.timestamp/600)+1)*600+5]});await rpc.request({method:'evm_mine'});
 for(let n=10;n<15;n++)await receipt('Budgeted split payout '+n,c.submit(domain,n,await recipient.getAddress(),amount('1')));
 await receipt('Over-budget split request queues',c.submit(domain,15,await recipient.getAddress(),amount('1')));const split=await c.messageId(domain,15);await advance(121);await assert.rejects(c.execute.staticCall(split));report.checks.push('Split requests exhaust cap; delayed execution cannot bypass it');
 await receipt('Clean up over-budget request',c.connect(guardian).cancel(split));
 report.metrics={controlledRequest:'4',controlledVaultBefore:formatEther(before),controlledVaultAfter:formatEther(afterCancellation),paidDuringControlledRequest:formatEther(before-afterCancellation),legitimateDelayedPayout:'2',normalPayout:'0.25',finalVault:formatEther(await balance(c)),reserved:formatEther(await c.reserved())};
 assert.equal(report.metrics.paidDuringControlledRequest,'0.0');report.status='passed';
 writeFileSync('artifacts/local-final-scenario.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,pauseMarginSeconds:report.pauseTiming.marginSeconds,metrics:report.metrics}));
}finally{await rpc.close();}
