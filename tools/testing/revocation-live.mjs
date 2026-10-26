import fs from 'node:fs';
import { session, fixtures } from './uat-client.mjs';
const f=fixtures(),admin=await session('P00'),s=await session('P04');
const events=[];
const accountArgs={p_user_id:f.accounts.P04.id,p_account_type:'eps',p_eps_employee_id:'EPS-MOCK-E004',p_external_organization_id:null,p_status:'active',p_display_name:'Phạm Dũng',p_role_ids:[f.roles.UAT_TEAM_OPERATOR,f.roles.UAT_WAREHOUSE_OPERATOR],p_warehouse_ids:[f.parties.K1]};
async function rec(name,promise){const r=await promise;events.push({name,...r});return r;}
await rec('P04 K1 before revocation',s.rpc('get_material',{p_id:f.materials['UAT-M-K1']}));
let revoked=false;
try{
 const r=await rec('P00 revoke P04 K1 via save_account_access',admin.rpc('save_account_access',{...accountArgs,p_warehouse_ids:[]}));
 if(!r.ok)throw new Error('revoke failed');revoked=true;
 await rec('P04 same session K1 after revocation',s.rpc('get_material',{p_id:f.materials['UAT-M-K1']}));
 await rec('P04 same session receipt K1 after revocation',s.rpc('get_material_receipt',{p_id:f.receipts['UAT-R-K1']}));
 await rec('P04 same session B1 retained',s.rpc('get_material',{p_id:f.materials['UAT-M-B1']}));
 await rec('P04 same session K1 mutation denied',s.rpc('set_material_availability',{p_id:f.materials['UAT-M-K1-MUTATE'],p_is_active:false}));
 const fresh=await session('P04');
 await rec('P04 fresh session K1 after revocation',fresh.rpc('get_material',{p_id:f.materials['UAT-M-K1']}));
} finally {
 if(revoked)await rec('P00 restore P04 K1',admin.rpc('save_account_access',accountArgs));
 await rec('P04 same session K1 after restore',s.rpc('get_material',{p_id:f.materials['UAT-M-K1']}));
 fs.writeFileSync('docs/testing/results/2026-10-22/revocation-live.json',JSON.stringify({runAt:new Date().toISOString(),events},null,2));
}
console.log(JSON.stringify(events.map(r=>({name:r.name,status:r.status,ok:r.ok,error:r.ok?undefined:r.data}))));
