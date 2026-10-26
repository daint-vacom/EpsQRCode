import fs from 'node:fs';
import crypto from 'node:crypto';
import { session,fixtures } from './uat-client.mjs';
const f=fixtures(),s1=await session('P01'),s6=await session('P06');
const folder=crypto.randomUUID();
const paths={a1:`parties/${f.parties.A1}/objects/${folder}/uat-pixel.png`,x:`parties/${f.parties.X}/objects/${folder}/uat-pixel.png`};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
const cases=[];
for(const [name,s,path] of [['P01 upload own A1',s1,paths.a1],['P06 upload own X',s6,paths.x]]){
 const r=await s.raw('/storage/v1/object/material-images/'+path,png,'POST',{'Content-Type':'image/png'});cases.push({name,...r});
}
for(const [name,s,path,party] of [['P01 link uploaded image',s1,paths.a1,f.parties.A1],['P06 link uploaded image',s6,paths.x,f.parties.X]]){
 const r=await s.rpc('save_material',{p_id:null,p_expected_version:null,p_values:{code:'UAT-FILE-'+crypto.randomUUID().slice(0,8),modelId:f.modelId,ownerPartyId:party,condition:'good',note:'UAT storage scope test',images:[{storage_bucket:'material-images',storage_path:path,external_url:null,sort_order:0,is_cover:true}]}});
 cases.push({name,...r});
}
for(const [name,s,path] of [['P01 sign A1',s1,paths.a1],['P01 sign X outside scope',s1,paths.x],['P06 sign X',s6,paths.x],['P06 sign A1 outside scope',s6,paths.a1]]){
 const r=await s.request('/storage/v1/object/sign/material-images/'+path,{expiresIn:60});
 cases.push({name,status:r.status,ok:r.ok,data:r.ok?{signedURLIssued:Boolean(r.data.signedURL||r.data.signedUrl)}:r.data});
}
for(const [name,s,path]of [['P01 upload into X denied',s1,`parties/${f.parties.X}/objects/${crypto.randomUUID()}/outside.png`],['P06 upload into A1 denied',s6,`parties/${f.parties.A1}/objects/${crypto.randomUUID()}/outside.png`]]){
 const r=await s.raw('/storage/v1/object/material-images/'+path,png,'POST',{'Content-Type':'image/png'});cases.push({name,...r});
}
fs.writeFileSync('docs/testing/results/2026-10-22/storage-live.json',JSON.stringify({runAt:new Date().toISOString(),paths,cases},null,2));
console.log(JSON.stringify(cases));
