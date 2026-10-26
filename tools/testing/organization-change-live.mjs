// Root orchestrator changes only the fake EPS fixture between stdin phases.
// This process retains the same P01 bearer session throughout the test.
import fs from 'node:fs';
import {session,fixtures} from './uat-client.mjs';
const s=await session('P01'),f=fixtures(),events=[];
const wait=()=>new Promise(resolve=>{process.stdin.resume();process.stdin.once('data',()=>{process.stdin.pause();resolve();});});
async function snapshot(phase){
 const me=await s.rpc('get_my_qrcode_account');
 const a1=await s.rpc('get_material',{p_id:f.materials['UAT-M-A1']});
 const b1=await s.rpc('get_material',{p_id:f.materials['UAT-M-B1']});
 const perms=await s.rpc('get_effective_permissions');
 events.push({phase,account:{status:me.status,data:me.data},a1:{status:a1.status,ok:a1.ok},b1:{status:b1.status,ok:b1.ok},effectivePermissions:{status:perms.status,count:Array.isArray(perms.data)?perms.data.length:null}});
 console.log(JSON.stringify(events.at(-1)));
 fs.writeFileSync('docs/testing/results/2026-10-22/organization-change-live.json',JSON.stringify({runAt:new Date().toISOString(),sameSession:true,events},null,2));
}
await snapshot('baseline DA/A1');
console.log('READY move fixture E001 to DB/B1 then send newline');await wait();
await snapshot('moved DB/B1');
console.log('READY set fixture E001 inactive then send newline');await wait();
await snapshot('inactive employee');
console.log('READY restore fixture E001 active DA/A1 then send newline');await wait();
await snapshot('restored active DA/A1');
