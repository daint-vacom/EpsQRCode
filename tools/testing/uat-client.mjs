// Development live tests only. Secrets stay in ignored temp/ files.
import fs from 'node:fs';
import { loadEnv } from 'vite';
const env = loadEnv('development', process.cwd(), '');
export const baseUrl = env.VITE_SUPABASE_URL;
if (new URL(baseUrl).hostname !== 'uopmkpcorjhsppdowmab.supabase.co') throw new Error('Unexpected UAT project');
export const credentialsPath = 'temp/uat-credentials.local.json';
export const fixturePath = 'temp/uat-fixtures.local.json';
export function credentials() { return JSON.parse(fs.readFileSync(credentialsPath,'utf8')); }
export function fixtures() { return JSON.parse(fs.readFileSync(fixturePath,'utf8')); }
export async function session(profile) {
 const a=credentials().accounts[profile];
 if(!a) throw new Error('Unknown profile '+profile);
 const r=await fetch(baseUrl+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:a.email,password:a.password})});
 const data=await r.json();
 if(!r.ok) throw new Error(`Auth ${profile}: ${r.status} ${data.msg||data.error_description||data.message||'failed'}`);
 if(data.user.id!==a.id) throw new Error('Auth identity mismatch');
 return {profile,userId:a.id,async request(path,body,method='POST',extraHeaders={}) {
  const response=await fetch(baseUrl+path,{method,headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${data.access_token}`,'Content-Type':'application/json',...extraHeaders},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const raw=await response.text();let result;try{result=JSON.parse(raw)}catch{result=raw}
  return {status:response.status,ok:response.ok,data:result};
 },async raw(path,body,method='POST',extraHeaders={}) {
  const response=await fetch(baseUrl+path,{method,headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${data.access_token}`,...extraHeaders},...(body===undefined?{}:{body})});
  const text=await response.text();let result;try{result=JSON.parse(text)}catch{result=text.slice(0,180)}
  return {status:response.status,ok:response.ok,data:result};
 },async rpc(name,body={}) {return this.request('/rest/v1/rpc/'+name,body);}};
}
