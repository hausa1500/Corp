importScripts("broker-protocol.js");

const HAPPY_LICENSE_API_URL ="https://happy-little101.lovable.app/api/public/v1/licenses";
const HAPPY_LICENSE_PRODUCT ="browser-extension-core";
const UC_LICENSE_AUX_API_URL ="https://hfxigagycrchhhzytgli.supabase.co/functions/v1/uc-license-api";
const UC_RUNTIME_LEASE_KEY ="unstoppableRuntimeLeaseV2100";
const UC_DEVICE_DB ="unstoppableDeviceSecurityV2100";
const UC_DEVICE_STORE ="keys";
const UC_DEVICE_KEY_ID ="primary";

function ucOpenDeviceDb(){
return new Promise((resolve,reject)=>{
const request=indexedDB.open(UC_DEVICE_DB,1);
request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(UC_DEVICE_STORE))db.createObjectStore(UC_DEVICE_STORE);};
request.onsuccess=()=>resolve(request.result);
request.onerror=()=>reject(request.error||new Error("DEVICE_DB_OPEN_FAILED"));
});
}
async function ucDeviceDbGet(key){const db=await ucOpenDeviceDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(UC_DEVICE_STORE,"readonly");const req=tx.objectStore(UC_DEVICE_STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();});}
async function ucDeviceDbPut(key,value){const db=await ucOpenDeviceDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(UC_DEVICE_STORE,"readwrite");tx.objectStore(UC_DEVICE_STORE).put(value,key);tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};});}
function ucBytesToBase64Url(bytes){let binary="";for(const b of new Uint8Array(bytes))binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
async function ucGetDeviceIdentity(){
let saved=await ucDeviceDbGet(UC_DEVICE_KEY_ID).catch(()=>null);
if(saved?.privateKey&&saved?.publicJwk)return saved;
const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
const publicJwk=await crypto.subtle.exportKey("jwk",pair.publicKey);
const privatePkcs8=await crypto.subtle.exportKey("pkcs8",pair.privateKey);
const privateKey=await crypto.subtle.importKey("pkcs8",privatePkcs8,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
saved={privateKey,publicJwk,createdAt:Date.now()};
await ucDeviceDbPut(UC_DEVICE_KEY_ID,saved);
return saved;
}
async function ucDeviceProof(action,installId,version){
const identity=await ucGetDeviceIdentity();
const timestamp=Date.now();
const nonce=crypto.randomUUID();
const payload=`UC-PROOF|${action}|${installId}|${version}|${timestamp}|${nonce}`;
const signature=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},identity.privateKey,new TextEncoder().encode(payload));
return {device_public_key:identity.publicJwk,device_proof:{timestamp,nonce,signature:ucBytesToBase64Url(signature)}};
}

const DEFAULTS = {
repo: null,
branch:"main",
previewUrl: null,
lovableEditorUrl:"https://lovable.dev/",
lovableProjectId: null,
supabaseProjectId: null,
supabaseUrl: null,
supabaseDashboardUrl:"https://supabase.com/dashboard/projects",
supabasePublishableKey: null,
executorUrl: null,
provider:"auto",
soundsEnabled: true,
notificationsEnabled: true,
lovableChatLock: true,
requireLovableGitSync: true,
projectBindings: {},
githubOAuthClientId: null,
githubOAuthAppName:"Unstoppable Corp.",
githubOAuthHomepageUrl:"https://unscorp.lovable.app",
githubOAuthCallbackUrl:"https://unscorp.lovable.app/auth"
};

chrome.runtime.onInstalled.addListener(async () => {
const current = await chrome.storage.sync.get(Object.keys(DEFAULTS));
const missing = {};
for (const [key,value] of Object.entries(DEFAULTS)) {
if (typeof current[key] ==="undefined") missing[key] = value;
}
if (Object.keys(missing).length) await chrome.storage.sync.set(missing);
});

const getConfig = async () => ({...(await chrome.storage.sync.get(DEFAULTS)),licenseApiUrl:HAPPY_LICENSE_API_URL});
const normalize = url => String(url ||"").replace(/\/+$/,"");

const GITHUB_AUTH_KEY ="unstoppableGithubAuthV190";
const GITHUB_DEVICE_KEY ="unstoppableGithubDeviceV190";
const SUPABASE_MANAGEMENT_KEY ="unstoppableSupabaseManagementV210";

async function getGithubAuth() {
const local = await chrome.storage.local.get(GITHUB_AUTH_KEY);
const session = await chrome.storage.session.get(GITHUB_AUTH_KEY);
const fromSession=!!session[GITHUB_AUTH_KEY];
let auth = session[GITHUB_AUTH_KEY] || local[GITHUB_AUTH_KEY] || null;
if(!auth?.token) return auth;

const expiresAt=Number(auth.expiresAt || 0);
if(auth.method==="oauth-device" && expiresAt && Date.now() > expiresAt-120000 && auth.refreshToken && auth.clientId){
try{
const response=await fetch("https://github.com/login/oauth/access_token",{
method:"POST",
headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},
body:new URLSearchParams({client_id:String(auth.clientId),grant_type:"refresh_token",refresh_token:String(auth.refreshToken)})
});
const data=await response.json().catch(()=>({}));
if(response.ok && data.access_token){
auth={...auth,token:data.access_token,refreshToken:data.refresh_token || auth.refreshToken,expiresAt:data.expires_in?Date.now()+Number(data.expires_in)*1000:null,refreshTokenExpiresAt:data.refresh_token_expires_in?Date.now()+Number(data.refresh_token_expires_in)*1000:auth.refreshTokenExpiresAt || null,scope:data.scope || auth.scope || null,refreshedAt:Date.now()};
await setGithubAuth(auth,{remember:!fromSession});
} else if(data.error==="bad_refresh_token"){
await setGithubAuth(null);
return null;
}
}catch{}
}
return auth;
}

async function setGithubAuth(auth,{remember=true}={}) {
await chrome.storage.session.remove(GITHUB_AUTH_KEY);
if (!auth) {
await chrome.storage.local.remove(GITHUB_AUTH_KEY);
return;
}
const target = remember ? chrome.storage.local : chrome.storage.session;
if (remember) await chrome.storage.local.set({[GITHUB_AUTH_KEY]:auth});
else {
await chrome.storage.local.remove(GITHUB_AUTH_KEY);
await target.set({[GITHUB_AUTH_KEY]:auth});
}
}

async function githubRequest(path,{method="GET",body=null,token=null,headers={}}={}) {
const auth = token ? {token} : await getGithubAuth();
const accessToken = String(auth?.token ||"").trim();
if (!accessToken) return {ok:false,error:"GITHUB_AUTH_REQUIRED",status:401};
try {
const response = await fetch(`https://api.github.com${path}`,{
method,
headers:{
Accept:"application/vnd.github+json",
Authorization:`Bearer ${accessToken}`,
"X-GitHub-Api-Version":"2022-11-28",
...(body ? {"Content-Type":"application/json"} : {}),
...headers
},
body:body ? JSON.stringify(body) : undefined
});
const data = await response.json().catch(()=>null);
if (!response.ok) {
return {ok:false,status:response.status,error:data?.message ||`GITHUB_HTTP_${response.status}`,data};
}
return {ok:true,status:response.status,data};
} catch (error) {
return {ok:false,error:"GITHUB_NETWORK_ERROR",detail:String(error)};
}
}

async function githubConnectToken(token,{remember=true}={}) {
const clean = String(token ||"").trim();
if (!clean) return {ok:false,error:"GITHUB_TOKEN_REQUIRED"};
const probe = await githubRequest("/user",{token:clean});
if (!probe.ok) return probe;
const user = probe.data || {};
await setGithubAuth({token:clean,login:user.login || null,userId:user.id || null,avatarUrl:user.avatar_url || null,method:"token",connectedAt:Date.now()},{remember});
return {ok:true,connected:true,user:{login:user.login || null,id:user.id || null,avatarUrl:user.avatar_url || null}};
}

async function githubStatus() {
const auth = await getGithubAuth();
if (!auth?.token) return {ok:true,connected:false,state:"auth_required"};
const probe = await githubRequest("/user");
if (!probe.ok) {
if (probe.status === 401) await setGithubAuth(null);
return {ok:false,connected:false,state:"invalid",error:probe.error};
}
return {ok:true,connected:true,state:"ready",method:auth.method ||"token",user:{login:probe.data?.login || auth.login || null,id:probe.data?.id || auth.userId || null,avatarUrl:probe.data?.avatar_url || auth.avatarUrl || null}};
}

async function githubListRepos() {
const all = [];
for (let page=1; page<=5; page++) {
const result = await githubRequest(`/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`);
if (!result.ok) return result;
const rows = Array.isArray(result.data) ? result.data : [];
all.push(...rows);
if (rows.length < 100) break;
}
return {ok:true,repos:all.map(repo => ({
full_name:repo.full_name,
name:repo.name,
private:!!repo.private,
default_branch:repo.default_branch ||"main",
permissions:repo.permissions || {},
updated_at:repo.updated_at || null
}))};
}

async function githubListBranches(repo) {
const clean = String(repo ||"").trim();
if (!/^[^/]+\/[^/]+$/.test(clean)) return {ok:false,error:"INVALID_REPOSITORY"};
const encoded = clean.split("/").map(encodeURIComponent).join("/");
const all=[];
for (let page=1; page<=5; page++) {
const result = await githubRequest(`/repos/${encoded}/branches?per_page=100&page=${page}`);
if (!result.ok) return result;
const rows=Array.isArray(result.data)?result.data:[];
all.push(...rows);
if(rows.length<100) break;
}
return {ok:true,branches:all.map(item=>({name:item.name,protected:!!item.protected,sha:item.commit?.sha || null}))};
}

function decodeGithubContent(data) {
try {
const raw = atob(String(data ||"").replace(/\n/g,""));
const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
return new TextDecoder().decode(bytes);
} catch { return""; }
}

async function githubReadFile(repo,path,branch) {
const encodedRepo = String(repo ||"").split("/").map(encodeURIComponent).join("/");
const encodedPath = String(path ||"").split("/").map(encodeURIComponent).join("/");
const result = await githubRequest(`/repos/${encodedRepo}/contents/${encodedPath}?ref=${encodeURIComponent(branch ||"main")}`);
if (!result.ok) return result.status === 404 ? {ok:false,missing:true,status:404} : result;
if (Array.isArray(result.data) || result.data?.type !=="file") return {ok:false,error:"NOT_A_FILE"};
return {ok:true,text:decodeGithubContent(result.data.content),sha:result.data.sha || null};
}

function ucPairHint(value=""){
return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}

function ucRepoPairScore(repo,hints=[]){
const name=ucPairHint(repo?.name||"");
const compactName=name.replace(/-/g,"");
let score=0;
for(const raw of hints){
const hint=ucPairHint(raw);
const compactHint=hint.replace(/-/g,"");
if(!hint||!name) continue;
if(name===hint || compactName===compactHint) score=Math.max(score,120);
else if(name.includes(hint)||hint.includes(name)||compactName.includes(compactHint)||compactHint.includes(compactName)) score=Math.max(score,80);
}
if(repo?.private) score+=2;
return score;
}

async function githubFindLovableProject(projectId,hints=[]){
const cleanProjectId=String(projectId||"").trim();
if(!cleanProjectId) return {ok:false,error:"LOVABLE_PROJECT_ID_REQUIRED"};
const listed=await githubListRepos();
if(!listed.ok) return listed;
const repos=[...(listed.repos||[])].map(repo=>({...repo,_pairScore:ucRepoPairScore(repo,hints)}))
.sort((a,b)=>b._pairScore-a._pairScore || String(b.updated_at||"").localeCompare(String(a.updated_at||"")))
.slice(0,Math.min(36,(listed.repos||[]).length));
const discovered=[];
for(let i=0;i<repos.length;i+=5){
const batch=repos.slice(i,i+5);
const rows=await Promise.all(batch.map(async repo=>{
const branch=repo.default_branch||"main";
const file=await githubReadFile(repo.full_name,".lovable/project.json",branch);
if(!file?.ok) return null;
let parsed=null;
try{ parsed=JSON.parse(file.text); }catch{}
const values=[
parsed?.id, parsed?.project_id, parsed?.projectId, parsed?.lovable_project_id, parsed?.lovableProjectId,
parsed?.project?.id, parsed?.project?.project_id, parsed?.project?.projectId
].filter(Boolean).map(String);
const exact=values.includes(cleanProjectId) || String(file.text||"").includes(cleanProjectId);
return {repo:repo.full_name,branch,exact,score:repo._pairScore,projectValues:values.slice(0,5)};
}));
for(const row of rows.filter(Boolean)){
if(row.exact) return {ok:true,confirmed:true,repo:row.repo,branch:row.branch,source:"lovable-project-json",confidence:"exact"};
discovered.push(row);
}
}

const strong=discovered.filter(row=>row.score>=80);
if(strong.length===1) return {ok:true,confirmed:true,repo:strong[0].repo,branch:strong[0].branch,source:"lovable-project-json-name",confidence:"high"};
return {ok:false,error:"LOVABLE_PROJECT_REPO_NOT_FOUND",candidates:discovered.slice(0,8)};
}

const UC_IMAGE_MIME={".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif",".svg":"image/svg+xml"};
async function githubReadImageAsset(repo,path,branch) {
const ext=ucPathExtension(path);
const mimeType=UC_IMAGE_MIME[ext];
if(!mimeType) return {ok:false,error:"UNSUPPORTED_IMAGE_ASSET"};
const encodedRepo=String(repo||"").split("/").map(encodeURIComponent).join("/");
const encodedPath=String(path||"").split("/").map(encodeURIComponent).join("/");
const result=await githubRequest(`/repos/${encodedRepo}/contents/${encodedPath}?ref=${encodeURIComponent(branch ||"main")}`);
if(!result.ok) return result;
if(Array.isArray(result.data) || result.data?.type!=="file") return {ok:false,error:"NOT_A_FILE"};
const size=Number(result.data?.size||0);
if(size>1_800_000) return {ok:false,error:"IMAGE_TOO_LARGE",size};
const content=String(result.data?.content||"").replace(/\n/g,"");
if(!content) return {ok:false,error:"IMAGE_CONTENT_UNAVAILABLE"};
return {ok:true,name:String(path).split("/").pop()||"asset",mimeType,dataUrl:`data:${mimeType};base64,${content}`,path,size};
}

function parseSupabaseConfig(texts=[]) {
let projectRef=null, url=null, publishableKey=null;
for (const text of texts.filter(Boolean)) {
if (!projectRef) projectRef = text.match(/project_id\s*=\s*["']([a-z0-9-]{8,40})["']/i)?.[1] || null;
if (!url) url = text.match(/https:\/\/([a-z0-9-]{8,40})\.supabase\.co/ig)?.[0] || null;
if (!projectRef && url) projectRef = url.match(/https:\/\/([a-z0-9-]{8,40})\.supabase\.co/i)?.[1] || null;
if (!publishableKey) {
publishableKey = text.match(/(?:VITE_SUPABASE_PUBLISHABLE_KEY|VITE_SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY)\s*=\s*["']?([^\s"'`]+)/i)?.[1] || null;
}
}
if (!url && projectRef) url =`https://${projectRef}.supabase.co`;
return {
projectRef,
supabaseProjectId:projectRef,
supabaseUrl:url,
supabasePublishableKey:publishableKey,
supabaseDashboardUrl:projectRef ?`https://supabase.com/dashboard/project/${projectRef}` : null,
executorUrl:projectRef ?`https://${projectRef}.supabase.co/functions/v1/unstoppable-ai-executor` : null
};
}

async function detectSupabaseFromGithub(repo,branch) {
const candidates=[
"supabase/config.toml",
".env",
".env.local",
".env.production",
"src/integrations/supabase/client.ts",
"src/integrations/supabase/client.js",
"src/lib/supabase.ts",
"src/lib/supabase.js"
];
const texts=[];
const found=[];
for (const path of candidates) {
const result=await githubReadFile(repo,path,branch);
if (result.ok && result.text) { texts.push(result.text); found.push(path); }
}
const parsed=parseSupabaseConfig(texts);
if (!parsed.projectRef && !parsed.supabaseUrl) return {ok:false,error:"SUPABASE_NOT_DETECTED",filesChecked:candidates,filesFound:found};
return {ok:true,...parsed,filesFound:found};
}

function githubRepoPath(repo) {
const clean=String(repo||"").trim();
if(!/^[^/]+\/[^/]+$/.test(clean)) return null;
return clean.split("/").map(encodeURIComponent).join("/");
}

async function githubProbeRepository(repo,branch="main") {
const encoded=githubRepoPath(repo);
if(!encoded) return {ok:false,error:"INVALID_REPOSITORY"};
const meta=await githubRequest(`/repos/${encoded}`);
if(!meta.ok) {
return {
ok:false,
error:meta.status===404?"GITHUB_EXTENSION_REPO_NOT_AUTHORIZED":meta.error ||"GITHUB_REPO_UNAVAILABLE",
status:meta.status || null,
repo:String(repo||""),
branch:String(branch||"main")
};
}
const branchName=String(branch || meta.data?.default_branch ||"main").trim();
const branchResult=await githubRequest(`/repos/${encoded}/branches/${encodeURIComponent(branchName)}`);
if(!branchResult.ok) return {ok:false,error:branchResult.status===404?"GITHUB_BRANCH_NOT_FOUND":branchResult.error,status:branchResult.status || null,repo,branch:branchName};
const permissions=meta.data?.permissions || {};
return {
ok:true,
repo:String(meta.data?.full_name || repo),
private:!!meta.data?.private,
defaultBranch:String(meta.data?.default_branch ||"main"),
branch:branchName,
headSha:String(branchResult.data?.commit?.sha ||""),
canRead:permissions.pull !== false,
canPush:typeof permissions.push ==="boolean" ? permissions.push : null,
permissions
};
}

async function githubVerifyWriteCapability(repo) {
const encoded=githubRepoPath(repo);
if(!encoded) return {ok:false,error:"INVALID_REPOSITORY"};
const probe=await githubRequest(`/repos/${encoded}/git/blobs`,{method:"POST",body:{content:`uc-write-probe:${Date.now()}`,encoding:"utf-8"}});
if(!probe.ok) return {ok:false,error:probe.status===403?"GITHUB_WRITE_PERMISSION_REQUIRED":(probe.error||"GITHUB_WRITE_PROBE_FAILED"),status:probe.status||null,detail:probe.error||null};
return {ok:true,writeVerified:true,blobSha:String(probe.data?.sha||"")};
}

async function githubGetTree(repo,branch) {
const probe=await githubProbeRepository(repo,branch);
if(!probe.ok) return probe;
const encoded=githubRepoPath(repo);
const commit=await githubRequest(`/repos/${encoded}/git/commits/${encodeURIComponent(probe.headSha)}`);
if(!commit.ok) return commit;
const treeSha=String(commit.data?.tree?.sha ||"");
if(!treeSha) return {ok:false,error:"GITHUB_TREE_NOT_FOUND"};
const tree=await githubRequest(`/repos/${encoded}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
if(!tree.ok) return tree;
return {
ok:true,
probe,
headSha:probe.headSha,
baseTreeSha:treeSha,
truncated:!!tree.data?.truncated,
tree:Array.isArray(tree.data?.tree)?tree.data.tree:[]
};
}

const UC_TEXT_EXTENSIONS=new Set([".ts",".tsx",".js",".jsx",".mjs",".cjs",".json",".md",".mdx",".css",".scss",".sass",".less",".html",".htm",".toml",".sql",".yml",".yaml",".txt",".vue",".svelte",".astro",".py",".prisma",".graphql",".gql",".svg",".xml"]);
const UC_CONTEXT_ALWAYS=[
"AGENTS.md","README.md","package.json","components.json","vite.config.ts","vite.config.js","tsconfig.json","tsconfig.app.json","tailwind.config.ts","tailwind.config.js","postcss.config.js","postcss.config.cjs",
"src/main.tsx","src/main.ts","src/App.tsx","src/App.ts","src/index.css","src/styles.css","src/router.tsx","src/router.ts","src/routes/index.tsx","src/routes/index.ts","src/routes/__root.tsx","src/routes/__root.ts",
"src/integrations/supabase/client.ts","src/integrations/supabase/client.tsx","src/integrations/supabase/types.ts","src/lib/supabase.ts","src/lib/utils.ts","supabase/config.toml"
];
const UC_CONTEXT_MAX_ROUNDS=7;
const UC_CONTEXT_MAX_FILES_INITIAL=20;
const UC_CONTEXT_MAX_FILES_REQUESTED=36;

function ucPathExtension(path) {
const name=String(path||"").toLowerCase();
const index=name.lastIndexOf(".");
return index>=0?name.slice(index):"";
}

function ucNormalizeRepoPath(path) {
return String(path||"").trim().replace(/\\/g,"/").replace(/^\/+/,"").replace(/\/{2,}/g,"/").replace(/\/$/,"");
}

function ucPromptTerms(prompt) {
const stop=new Set(["para","como","com","que","uma","por","dos","das","the","and","this","that","from","github","branch","prompt","objetivo","regras","obrigatorias","obrigatórias","skills","ativa","ativas","main"]);
return [...new Set(String(prompt||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-z0-9_-]{4,}/g)||[])]
.filter(x=>!stop.has(x)).slice(0,60);
}

function ucScorePath(path,terms=[]) {
const lower=String(path||"").toLowerCase();
let score=0;
if(UC_CONTEXT_ALWAYS.some(x=>x.toLowerCase()===lower)) score+=1500;
if(lower==="agents.md") score+=3500;
if(lower==="package.json") score+=2200;
if(/(^|\/)(index|home|landing|app|router|__root)\.(tsx?|jsx?)$/.test(lower)) score+=900;
if(/(^|\/)(index|styles?|globals?|app)\.(css|scss|sass|less)$/.test(lower)) score+=720;
if(/^src\/routes\//.test(lower)) score+=680;
if(/^src\/(pages|views)\//.test(lower)) score+=620;
if(/^src\/integrations\/supabase\//.test(lower)) score+=700;
if(/^supabase\/migrations\//.test(lower)) score+=650;
if(/^supabase\/functions\//.test(lower)) score+=650;
if(/^src\//.test(lower)) score+=150;
if(/^supabase\//.test(lower)) score+=180;
if(/(^|\/)(components|hooks|lib|services|integrations|routes|pages|styles|assets)(\/|$)/.test(lower)) score+=90;
if(/auth|checkout|payment|pix|admin|license|key|landing|home|hero|pricing|supabase/.test(lower)) score+=110;
for(const term of terms){ if(lower.includes(term)) score+=125; }
if(/test|spec|e2e/.test(lower)) score+=20;
return score;
}

function ucRequestMatcher(raw,treePaths=[]) {
let path=ucNormalizeRepoPath(raw);
if(!path) return {raw:String(raw||""),path:"",kind:"invalid",matches:[]};
const exact=treePaths.includes(path);
if(exact) return {raw:String(raw||""),path,kind:"file",matches:[path]};

const prefix=path+"/";
const descendants=treePaths.filter(p=>p.startsWith(prefix));
if(descendants.length) return {raw:String(raw||""),path,kind:"directory",matches:descendants};

if(path.includes("*")){
const escaped=path.replace(/[.+?^${}()|[\]\\]/g,"\\$&").replace(/\*\*/g,".*").replace(/\*/g,"[^/]*");
try{
const rx=new RegExp(`^${escaped}$`,"i");
const matches=treePaths.filter(p=>rx.test(p));
if(matches.length) return {raw:String(raw||""),path,kind:"glob",matches};
}catch{}
}

const base=path.split("/").pop()?.toLowerCase() ||"";
const fuzzy=base?treePaths.filter(p=>p.split("/").pop()?.toLowerCase()===base):[];
return {raw:String(raw||""),path,kind:fuzzy.length?"fuzzy":"missing",matches:fuzzy.slice(0,12)};
}

function ucBuildProjectMap(tree) {
const paths=(tree||[]).filter(item=>item?.path && !/(^|\/)(node_modules|dist|build|\.git|coverage|\.next)(\/|$)/.test(item.path));
const files=paths.filter(item=>item.type==="blob");
const buckets={routes:[],supabase:[],styles:[],assets:[],config:[],source:[]};
for(const item of files){
const p=String(item.path||"");
const lower=p.toLowerCase();
if(/^src\/(routes|pages|views)\//.test(lower)) buckets.routes.push(p);
if(/^supabase\//.test(lower) ||/supabase/.test(lower)) buckets.supabase.push(p);
if(/\.(css|scss|sass|less)$/.test(lower)) buckets.styles.push(p);
if(/(^|\/)(public|assets)\//.test(lower) ||/\.(png|jpe?g|webp|svg|gif|ico)$/.test(lower)) buckets.assets.push(p);
if(/(^|\/)(package\.json|vite\.config|tsconfig|tailwind\.config|components\.json|eslint|prettier|vercel|netlify)/.test(lower)) buckets.config.push(p);
if(/^src\//.test(lower)) buckets.source.push(p);
}
const take=(a,n)=>a.slice(0,n);
return {
totalFiles:files.length,
routes:take(buckets.routes,80),
supabase:take(buckets.supabase,120),
styles:take(buckets.styles,60),
assets:take(buckets.assets,100),
config:take(buckets.config,60),
sourceSample:take(buckets.source,120)
};
}

function ucArchitectureBoost(path) {
const lower=String(path||"").toLowerCase();
let score=0;
if(/(^|\/)(index|home|landing|app|router|__root)\.(tsx?|jsx?)$/.test(lower)) score+=1300;
if(/^src\/(routes|pages|views)\//.test(lower) &&/index|home|root|layout/.test(lower)) score+=1000;
if(/(^|\/)(styles?|globals?|index|app)\.(css|scss|sass|less)$/.test(lower)) score+=900;
if(/^src\/integrations\/supabase\//.test(lower) ||/^src\/lib\/supabase/.test(lower)) score+=1000;
if(/^supabase\/migrations\//.test(lower)) score+=800;
if(/^supabase\/functions\/[^/]+\/(index|main)\.(ts|js)$/.test(lower)) score+=850;
if(/^public\//.test(lower) ||/^src\/assets\//.test(lower)) score+=80;
return score;
}

async function githubBuildRepositoryContext(repo,branch,prompt,{requestedPaths=[],excludePaths=[],round=0}={}) {
const snapshot=await githubGetTree(repo,branch);
if(!snapshot.ok) return snapshot;
const terms=ucPromptTerms(prompt);
const allBlobs=snapshot.tree.filter(item=>item?.type==="blob" && item.path);
const entries=allBlobs.filter(item=>Number(item.size||0)<=220000 && UC_TEXT_EXTENSIONS.has(ucPathExtension(item.path)));
const allBlobPaths=allBlobs.map(x=>x.path);
const textPathSet=new Set(entries.map(x=>x.path));
const requestSpecs=(requestedPaths||[]).map(x=>ucRequestMatcher(x,allBlobPaths)).filter(x=>x.path);
const excludeSet=new Set((excludePaths||[]).map(ucNormalizeRepoPath).filter(Boolean));
const exactRequestedSet=new Set(requestSpecs.filter(x=>x.kind==="file").flatMap(x=>x.matches||[]));
const requestedMatches=new Set(requestSpecs.flatMap(x=>x.matches||[]).filter(path=>!excludeSet.has(path) || exactRequestedSet.has(path)));

const chosen=entries
.filter(item=>!excludeSet.has(item.path) || requestedMatches.has(item.path))
.map(item=>({item,score:(requestedMatches.has(item.path)?20000:0)+ucScorePath(item.path,terms)+ucArchitectureBoost(item.path)}))
.filter(row=>row.score>0 || requestedMatches.has(row.item.path))
.sort((a,b)=>b.score-a.score || Number(a.item.size||0)-Number(b.item.size||0));

const seen=new Set(chosen.map(x=>x.item.path));
const architectureCandidates=entries
.map(item=>({item,score:ucArchitectureBoost(item.path)+ucScorePath(item.path,terms)}))
.filter(x=>x.score>100)
.sort((a,b)=>b.score-a.score || Number(a.item.size||0)-Number(b.item.size||0));
for(const row of architectureCandidates){
if(!seen.has(row.item.path)){ chosen.push(row); seen.add(row.item.path); }
if(chosen.length>=70) break;
}

if(chosen.length<14){
for(const item of entries.filter(x=>/^src\//.test(x.path)).slice(0,50)){
if(!seen.has(item.path)){ chosen.push({item,score:5}); seen.add(item.path); }
if(chosen.length>=20) break;
}
}

const files=[];
let chars=0;
const maxFiles=requestSpecs.length?UC_CONTEXT_MAX_FILES_REQUESTED:UC_CONTEXT_MAX_FILES_INITIAL;
const maxChars=requestSpecs.length?95000:52000;
for(const row of chosen){
if(files.length>=maxFiles || chars>=maxChars) break;
const file=await githubReadFile(repo,row.item.path,branch);
if(!file.ok || typeof file.text!=="string") continue;
let text=String(file.text);
const perFileLimit=requestedMatches.has(row.item.path)?42000:26000;
if(text.length>perFileLimit) text=text.slice(0,perFileLimit)+"\n/* ...arquivo truncado pelo broker; solicite o caminho novamente se precisar do restante... */";
if(chars+text.length>maxChars && files.length>=8 && !requestedMatches.has(row.item.path)) continue;
files.push({path:row.item.path,sha:file.sha || row.item.sha || null,content:text,requested:requestedMatches.has(row.item.path)});
chars+=text.length;
}

const requestedAssetMetadata=[...requestedMatches]
.filter(path=>!textPathSet.has(path))
.map(path=>{const item=allBlobs.find(x=>x.path===path);return {path,size:Number(item?.size||0),sha:item?.sha||null,type:"binary-or-unsupported"};})
.slice(0,160);

const visualIntent=/(landing|site|website|design|ui|ux|visual|imagem|image|logo|hero|screenshot|mockup|premium|apple|interface|layout|css|estilo)/i.test(String(prompt||""));
const imagePool=(requestSpecs.length
? requestedAssetMetadata.map(x=>x.path)
: visualIntent
? allBlobs.filter(item=>UC_IMAGE_MIME[ucPathExtension(item.path)] &&/(logo|screen|screenshot|preview|hero|extension|mockup|cover)/i.test(item.path) && Number(item.size||0)<=1_800_000).map(x=>x.path)
: []
);
const imageAttachments=[];
for(const path of [...new Set(imagePool)].slice(0,requestSpecs.length?5:3)){
const asset=await githubReadImageAsset(repo,path,branch);
if(asset.ok) imageAttachments.push({name:asset.name,mimeType:asset.mimeType,dataUrl:asset.dataUrl,repoPath:asset.path});
}
const projectMap=ucBuildProjectMap(snapshot.tree);
const treeList=snapshot.tree
.filter(item=>item?.path && !/(^|\/)(node_modules|dist|build|\.git|coverage|\.next)(\/|$)/.test(item.path))
.map(item=>`${item.type==="tree"?"[DIR] ":""}${item.path}`)
.slice(0,requestSpecs.length?1400:900);

return {
ok:true,
probe:snapshot.probe,
repo,
branch,
headSha:snapshot.headSha,
baseTreeSha:snapshot.baseTreeSha,
treeTruncated:snapshot.truncated,
treeList,
projectMap,
files,
charCount:chars,
requestSpecs:requestSpecs.map(x=>({path:x.path,kind:x.kind,matchCount:(x.matches||[]).length,freshMatchCount:(x.matches||[]).filter(p=>requestedMatches.has(p)).length,matches:(x.matches||[]).slice(0,80)})),
requestedAssetMetadata,
imageAttachments,
round:Number(round||0)
};
}

function githubContextPrompt(context,{continuation=false}={}) {
const files=(context.files||[]).map(file=>`\n--- FILE: ${file.path}${file.requested?" [REQUESTED]":""} ---\n${file.content}\n--- END FILE: ${file.path} ---`).join("\n");
const tree=(context.treeList||[]).join("\n");
const map=JSON.stringify(context.projectMap||{},null,2);
const resolutions=(context.requestSpecs||[]).length?`\nRequested-path resolution:\n${JSON.stringify(context.requestSpecs,null,2)}\n`:"";
const assetMeta=(context.requestedAssetMetadata||[]).length?`\nRequested binary/unsupported asset metadata (reference these existing paths; bytes are intentionally not injected into the prompt):\n${JSON.stringify(context.requestedAssetMetadata,null,2)}\n`:"";
return`${continuation?"[UC_REPOSITORY_CONTEXT_CONTINUATION_V2]":"[UC_REPOSITORY_CONTEXT_V2]"}\n`+
`GITHUB_ACCESS_BY_EXTENSION: VERIFIED\nREPOSITORY: ${context.repo}\nBRANCH: ${context.branch}\nHEAD_SHA: ${context.headSha}\nWRITE_PERMISSION: ${context.probe?.canPush===true?"YES":context.probe?.canPush===false?"NO":"VERIFIED_SEPARATELY_BY_EXTENSION"}\n`+
`IMPORTANT: Do NOT use the ChatGPT conversation's own GitHub connector. It is a different authentication channel and may return 404. The Unstoppable Corp extension is the authoritative GitHub broker and has already read the repository through the user's authorization.\n`+
`IMPORTANT: You are expected to IMPLEMENT the user's request, not stop after diagnosis. Inspect the supplied architecture, create missing files when appropriate, preserve existing behavior, and use needs_files only for repository content that is genuinely required and not already supplied. Directory paths are allowed in needs_files; the broker expands them automatically. Never request .env or secrets.\n`+
`Project architecture map:\n${map}\n${resolutions}${assetMeta}\nRepository tree (files/directories, partial only if extremely large):\n${tree}\n\nRepository files supplied by the extension:${files}\n`+
`${continuation?"[/UC_REPOSITORY_CONTEXT_CONTINUATION_V2]":"[/UC_REPOSITORY_CONTEXT_V2]"}`;
}

function ucUtf8Base64(value) {
const bytes=new TextEncoder().encode(String(value||""));
let binary="";
const chunk=0x8000;
for(let i=0;i<bytes.length;i+=chunk) binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
return btoa(binary);
}

function ucTextAttachment(name,text,mimeType="text/markdown") {
return {
name:String(name||"unstoppable-context.md"),
mimeType,
dataUrl:`data:${mimeType};base64,${ucUtf8Base64(text)}`,
kind:"file",
source:"github-broker"
};
}

function ucPrepareChatPayload(prompt,attachments=[],label="request") {
const full=String(prompt||"");
const extras=Array.isArray(attachments)?attachments.filter(Boolean):[];

return {
prompt:full,
attachments:extras.slice(0,6),
externalized:false,
inlineTransport:true,
fullLength:full.length,
label:String(label||"request")
};
}

function extractUcChangeset(text) {
const parsed=globalThis.UCBrokerProtocol?.extractChangeset?.(text);
return parsed?.ok ? parsed.changeset : null;
}

function extractUcChangesetDetailed(text) {
return globalThis.UCBrokerProtocol?.extractChangeset?.(text) || {ok:false,error:"BROKER_PROTOCOL_UNAVAILABLE"};
}

function ucValidateChangeset(changeset) {
return globalThis.UCBrokerProtocol?.validateChangeset?.(changeset) || {ok:false,error:"BROKER_PROTOCOL_UNAVAILABLE"};
}

async function githubVerifyAppliedCommit(repo,branch,commitSha,treeSha,expectedEntries=[]) {
const encoded=githubRepoPath(repo);
if(!encoded || !commitSha || !treeSha) return {ok:false,error:"GITHUB_COMMIT_VERIFICATION_INPUT_INVALID"};
const branchName=String(branch||"main").trim();

let observedHead="";
let branchResult=null;
let headAdvanced=false;
let compareStatus=null;
const waits=[0,180,420,850,1400,2200];
for(let attempt=0;attempt<waits.length;attempt++){
if(waits[attempt]) await new Promise(resolve=>setTimeout(resolve,waits[attempt]));
branchResult=await githubRequest(`/repos/${encoded}/branches/${encodeURIComponent(branchName)}`,{headers:{"Cache-Control":"no-cache"}});
if(!branchResult.ok){
if(attempt===waits.length-1) return {ok:false,error:"GITHUB_COMMIT_VERIFY_BRANCH_FAILED",detail:branchResult.error,status:branchResult.status||null};
continue;
}
observedHead=String(branchResult.data?.commit?.sha||"");
if(observedHead===String(commitSha)) break;
if(observedHead){
const compare=await githubRequest(`/repos/${encoded}/compare/${encodeURIComponent(String(commitSha))}...${encodeURIComponent(observedHead)}`,{headers:{"Cache-Control":"no-cache"}});
if(compare.ok){
compareStatus=String(compare.data?.status||"");
if(compareStatus==="ahead" || compareStatus==="identical"){
headAdvanced=observedHead!==String(commitSha);
break;
}
}
}
}

if(observedHead!==String(commitSha) && !headAdvanced){
return {ok:false,error:"GITHUB_COMMIT_VERIFY_HEAD_MISMATCH",expected:String(commitSha),observed:observedHead,compareStatus};
}

const treeResult=await githubRequest(`/repos/${encoded}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`,{headers:{"Cache-Control":"no-cache"}});
if(!treeResult.ok) return {ok:false,error:"GITHUB_COMMIT_VERIFY_TREE_FAILED",detail:treeResult.error,status:treeResult.status||null};
const rows=Array.isArray(treeResult.data?.tree)?treeResult.data.tree:[];
const truncated=!!treeResult.data?.truncated;
if(!truncated){
const byPath=new Map(rows.filter(x=>x?.path).map(x=>[x.path,x]));
for(const entry of expectedEntries){
const actual=byPath.get(entry.path);
if(entry.action==="delete"){
if(actual) return {ok:false,error:"GITHUB_COMMIT_VERIFY_DELETE_FAILED",path:entry.path,observedSha:actual.sha||null};
}else{
if(!actual) return {ok:false,error:"GITHUB_COMMIT_VERIFY_FILE_MISSING",path:entry.path};
if(entry.sha && String(actual.sha||"")!==String(entry.sha)) return {ok:false,error:"GITHUB_COMMIT_VERIFY_BLOB_MISMATCH",path:entry.path,expectedSha:entry.sha,observedSha:actual.sha||null};
}
}
return {ok:true,verified:true,headSha:observedHead,commitSha:String(commitSha),treeSha,truncated:false,verifiedFiles:expectedEntries.length,headAdvanced,compareStatus};
}

for(const entry of expectedEntries){
const encodedPath=String(entry.path||"").split("/").map(encodeURIComponent).join("/");
const result=await githubRequest(`/repos/${encoded}/contents/${encodedPath}?ref=${encodeURIComponent(commitSha)}`,{headers:{"Cache-Control":"no-cache"}});
if(entry.action==="delete"){
if(result.ok) return {ok:false,error:"GITHUB_COMMIT_VERIFY_DELETE_FAILED",path:entry.path};
if(result.status!==404) return {ok:false,error:"GITHUB_COMMIT_VERIFY_PATH_FAILED",path:entry.path,detail:result.error,status:result.status||null};
}else{
if(!result.ok) return {ok:false,error:"GITHUB_COMMIT_VERIFY_FILE_MISSING",path:entry.path,detail:result.error,status:result.status||null};
if(entry.sha && String(result.data?.sha||"")!==String(entry.sha)) return {ok:false,error:"GITHUB_COMMIT_VERIFY_BLOB_MISMATCH",path:entry.path,expectedSha:entry.sha,observedSha:result.data?.sha||null};
}
}
return {ok:true,verified:true,headSha:observedHead,commitSha:String(commitSha),treeSha,truncated:true,verifiedFiles:expectedEntries.length,headAdvanced,compareStatus};
}

async function githubApplyChangeset(repo,branch,changeset,{expectedHeadSha=null}={}) {
const valid=ucValidateChangeset(changeset);
if(!valid.ok) return valid;
if(!valid.files.length) return {ok:true,noChanges:true,commitApplied:false,commitSha:null,files:[],verified:true};

const snapshot=await githubGetTree(repo,branch);
if(!snapshot.ok) return snapshot;
if(expectedHeadSha && String(snapshot.headSha||"") !== String(expectedHeadSha||"")) {
return {ok:false,error:"GITHUB_HEAD_CHANGED",expectedHeadSha:String(expectedHeadSha||""),currentHeadSha:String(snapshot.headSha||""),repo,branch};
}

if(snapshot.probe?.canPush === false) return {ok:false,error:"GITHUB_WRITE_PERMISSION_REQUIRED",repo,branch};

const encoded=githubRepoPath(repo);
const existing=new Map(snapshot.tree.filter(x=>x?.path).map(x=>[x.path,x]));
const tree=[];
const expectedEntries=[];

for(const file of valid.files){
if(file.action==="delete"){
if(existing.has(file.path)) {
tree.push({path:file.path,mode:existing.get(file.path)?.mode ||"100644",type:"blob",sha:null});
expectedEntries.push({path:file.path,action:"delete",sha:null});
}
continue;
}
const blob=await githubRequest(`/repos/${encoded}/git/blobs`,{method:"POST",body:{content:file.content,encoding:"utf-8"}});
if(!blob.ok) return {ok:false,error:blob.status===403?"GITHUB_WRITE_PERMISSION_REQUIRED":"GITHUB_BLOB_CREATE_FAILED",path:file.path,detail:blob.error,status:blob.status||null};
const sha=String(blob.data?.sha||"");
if(!sha) return {ok:false,error:"GITHUB_BLOB_SHA_MISSING",path:file.path};
tree.push({path:file.path,mode:existing.get(file.path)?.mode ||"100644",type:"blob",sha});
expectedEntries.push({path:file.path,action:"upsert",sha});
}

if(!tree.length) return {ok:true,noChanges:true,commitApplied:false,commitSha:null,files:[],verified:true};
const newTree=await githubRequest(`/repos/${encoded}/git/trees`,{method:"POST",body:{base_tree:snapshot.baseTreeSha,tree}});
if(!newTree.ok) return {ok:false,error:newTree.status===403?"GITHUB_WRITE_PERMISSION_REQUIRED":"GITHUB_TREE_CREATE_FAILED",detail:newTree.error,status:newTree.status||null};
const newTreeSha=String(newTree.data?.sha||"");
if(!newTreeSha) return {ok:false,error:"GITHUB_TREE_SHA_MISSING"};

const commit=await githubRequest(`/repos/${encoded}/git/commits`,{method:"POST",body:{message:changeset.commit_message ||"Unstoppable Corp: aplicar alterações",tree:newTreeSha,parents:[snapshot.headSha]}});
if(!commit.ok) return {ok:false,error:commit.status===403?"GITHUB_WRITE_PERMISSION_REQUIRED":"GITHUB_COMMIT_CREATE_FAILED",detail:commit.error,status:commit.status||null};
const commitSha=String(commit.data?.sha||"");
if(!commitSha) return {ok:false,error:"GITHUB_COMMIT_SHA_MISSING"};

const refPath=String(branch||"main").split("/").map(encodeURIComponent).join("/");
const updated=await githubRequest(`/repos/${encoded}/git/refs/heads/${refPath}`,{method:"PATCH",body:{sha:commitSha,force:false}});
if(!updated.ok) {
const protectedBranch=updated.status===403 ||/protected|ruleset|branch/i.test(String(updated.error||""));
return {ok:false,error:protectedBranch?"GITHUB_BRANCH_PROTECTED_OR_WRITE_DENIED":"GITHUB_REF_UPDATE_FAILED",detail:updated.error,status:updated.status||null,commitShaUnreferenced:commitSha};
}

const verification=await githubVerifyAppliedCommit(repo,branch,commitSha,newTreeSha,expectedEntries);
if(!verification.ok) return {...verification,commitSha,refUpdated:true};
return {
ok:true,
commitApplied:true,
commitSha,
branch:String(branch||"main"),
verified:true,
verification,
files:valid.files.map(x=>({path:x.path,action:x.action})),
summary:changeset.summary ||"",
protocol:changeset.protocol ||"unknown"
};
}

function ucChangesetProtocol() {
return globalThis.UCBrokerProtocol?.protocolText?.() ||"[UC_OUTPUT_PROTOCOL_V3] BROKER_PROTOCOL_UNAVAILABLE [/UC_OUTPUT_PROTOCOL_V3]";
}

function ucPromptLikelyRequiresMutation(prompt) {
return/\b(criar|construir|implementar|desenvolver|alterar|corrigir|melhorar|refazer|adicionar|remover|build|create|implement|develop|fix|change|update|add|remove)\b/i.test(String(prompt||""));
}

async function ucRefreshLovableTabsAfterCommit({projectId=null,previewUrl=null,publishedUrl=null,repo=null,branch=null,commitSha=null,files=[]}={}) {
const inferredPreview=previewUrl || (projectId ?`https://id-preview--${projectId}.lovable.app` : null);
const notice={
projectId:projectId || null,
previewUrl:inferredPreview || null,
publishedUrl:publishedUrl || null,
repo:repo || null,
branch:branch || null,
commitSha:commitSha || null,
files:Array.isArray(files)?files.slice(0,80):[],
state:"waiting_sync",
createdAt:Date.now(),
refreshAttempts:0
};
await chrome.storage.local.set({unstoppableLovableSyncNotice:notice}).catch(()=>null);
try {
const editorTabs=await chrome.tabs.query({url:["https://lovable.dev/*"]});
for(const tab of editorTabs){
if(!tab?.id) continue;
if(projectId && tab.url?.includes("lovable.dev/projects/") && !tab.url.includes(String(projectId))) continue;
try { await chrome.tabs.sendMessage(tab.id,{type:"UNSTOPPABLE_GITHUB_COMMIT_APPLIED",notice}); } catch {}
}

const reloadMatchingTabs=async({previewOnly=false}={})=>{
let count=0;
const patterns=previewOnly?["https://*.lovable.app/*"]:["https://lovable.dev/*","https://*.lovable.app/*"];
const tabs=await chrome.tabs.query({url:patterns});
for(const tab of tabs){
if(!tab?.id) continue;
if(projectId && tab.url?.includes("lovable.dev/projects/") && !tab.url.includes(String(projectId))) continue;
if(tab.url?.includes(".lovable.app")){
const normalized=String(tab.url||"").replace(/\/+$/,"");
const previewMatch=inferredPreview && normalized.startsWith(String(inferredPreview).replace(/\/+$/,""));
const publishedMatch=publishedUrl && normalized.startsWith(String(publishedUrl).replace(/\/+$/,""));
if((inferredPreview || publishedUrl) && !previewMatch && !publishedMatch) continue;
}
try { await chrome.tabs.reload(tab.id); count++; } catch {}
}
return count;
};

await new Promise(resolve=>setTimeout(resolve,8500));
const firstReload=await reloadMatchingTabs({previewOnly:false});
let merged={...notice,state:"refresh_requested",refreshedAt:Date.now(),reloaded:firstReload,refreshAttempts:1};
await chrome.storage.local.set({unstoppableLovableSyncNotice:merged}).catch(()=>null);

await new Promise(resolve=>setTimeout(resolve,9000));
const secondReload=await reloadMatchingTabs({previewOnly:true});
merged={...merged,state:"preview_refresh_requested",secondRefreshedAt:Date.now(),reloaded:firstReload+secondReload,refreshAttempts:2};
await chrome.storage.local.set({unstoppableLovableSyncNotice:merged}).catch(()=>null);
return {ok:true,reloaded:firstReload+secondReload,attempts:2,notice:merged};
} catch(error) {
const failed={...notice,state:"refresh_failed",error:String(error),refreshedAt:Date.now()};
await chrome.storage.local.set({unstoppableLovableSyncNotice:failed}).catch(()=>null);
return {ok:false,reloaded:0,error:String(error),notice:failed};
}
}

async function githubStartDeviceFlow(clientId) {
const clean=String(clientId||"").trim();
if (!clean) return {ok:false,error:"GITHUB_OAUTH_CLIENT_ID_REQUIRED"};
try {
const response=await fetch("https://github.com/login/device/code",{
method:"POST",
headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},
body:new URLSearchParams({client_id:clean,scope:"repo read:user user:email"})
});
const data=await response.json().catch(()=>({}));
if(!response.ok || !data.device_code) return {ok:false,error:data.error_description || data.error ||`GITHUB_DEVICE_HTTP_${response.status}`};
const device={clientId:clean,deviceCode:data.device_code,userCode:data.user_code,verificationUri:data.verification_uri,expiresAt:Date.now()+Number(data.expires_in||900)*1000,interval:Math.max(5,Number(data.interval||5))};
await chrome.storage.session.set({[GITHUB_DEVICE_KEY]:device});
return {ok:true,userCode:device.userCode,verificationUri:device.verificationUri,expiresIn:Number(data.expires_in||900),interval:device.interval};
} catch(error){ return {ok:false,error:"GITHUB_DEVICE_NETWORK_ERROR",detail:String(error)}; }
}

async function githubPollDeviceFlow({remember=true}={}) {
const data=await chrome.storage.session.get(GITHUB_DEVICE_KEY);
const device=data[GITHUB_DEVICE_KEY];
if(!device?.deviceCode || !device?.clientId) return {ok:false,error:"GITHUB_DEVICE_FLOW_NOT_STARTED"};
if(Date.now()>device.expiresAt) { await chrome.storage.session.remove(GITHUB_DEVICE_KEY); return {ok:false,error:"GITHUB_DEVICE_CODE_EXPIRED"}; }
try {
const response=await fetch("https://github.com/login/oauth/access_token",{
method:"POST",
headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},
body:new URLSearchParams({client_id:device.clientId,device_code:device.deviceCode,grant_type:"urn:ietf:params:oauth:grant-type:device_code"})
});
const result=await response.json().catch(()=>({}));
if(result.error ==="authorization_pending" || result.error ==="slow_down") {
if(result.error ==="slow_down") {
device.interval=Math.max(5,Number(device.interval||5)+5);
await chrome.storage.session.set({[GITHUB_DEVICE_KEY]:device});
}
return {ok:false,pending:true,error:result.error,interval:device.interval};
}
if(!response.ok || !result.access_token) return {ok:false,error:result.error_description || result.error ||`GITHUB_OAUTH_HTTP_${response.status}`};
await chrome.storage.session.remove(GITHUB_DEVICE_KEY);
const connected=await githubConnectToken(result.access_token,{remember});
if(connected.ok){
const auth=await getGithubAuth();
if(auth) await setGithubAuth({...auth,method:"oauth-device",clientId:device.clientId,scope:result.scope || null,refreshToken:result.refresh_token || null,expiresAt:result.expires_in?Date.now()+Number(result.expires_in)*1000:null,refreshTokenExpiresAt:result.refresh_token_expires_in?Date.now()+Number(result.refresh_token_expires_in)*1000:null},{remember});
}
return connected;
} catch(error){ return {ok:false,error:"GITHUB_OAUTH_NETWORK_ERROR",detail:String(error)}; }
}

const GITHUB_OAUTH_SETUP_KEY ="unstoppableGithubOAuthSetupV193";
const GITHUB_OAUTH_SETUP_DEFAULTS = {
applicationName:"Unstoppable Corp.",
homepageUrl:"https://unscorp.lovable.app",
callbackUrl:"https://unscorp.lovable.app/auth"
};

async function syncGithubOAuthClientIdFromLicense(result) {
const clientId=String(result?.public_config?.github_oauth_client_id ||"").trim();
if (/^[A-Za-z0-9._-]{10,120}$/.test(clientId)) {
const config=await getConfig();
if (config.githubOAuthClientId !== clientId) await chrome.storage.sync.set({githubOAuthClientId:clientId});
return clientId;
}
return"";
}

async function startGithubOAuthOwnerSetup() {
const setup={...GITHUB_OAUTH_SETUP_DEFAULTS,startedAt:Date.now(),stage:"opening",autoSubmit:true};
await chrome.storage.session.set({[GITHUB_OAUTH_SETUP_KEY]:setup});
const tab=await chrome.tabs.create({url:"https://github.com/settings/applications/new",active:true});
return {ok:true,tabId:tab.id,...setup};
}

async function githubOAuthSetupStatus() {
const data=await chrome.storage.session.get(GITHUB_OAUTH_SETUP_KEY);
const config=await getConfig();
return {ok:true,setup:data[GITHUB_OAUTH_SETUP_KEY] || null,clientId:config.githubOAuthClientId || null};
}

async function completeGithubOAuthOwnerSetup(clientId,meta={}) {
const clean=String(clientId ||"").trim();
if (!/^[A-Za-z0-9._-]{10,120}$/.test(clean)) return {ok:false,error:"INVALID_GITHUB_OAUTH_CLIENT_ID"};
await chrome.storage.sync.set({githubOAuthClientId:clean});
const current=(await chrome.storage.session.get(GITHUB_OAUTH_SETUP_KEY))[GITHUB_OAUTH_SETUP_KEY] || {};
await chrome.storage.session.set({[GITHUB_OAUTH_SETUP_KEY]:{...current,stage:"complete",clientId:clean,deviceFlowEnabled:!!meta.deviceFlowEnabled,completedAt:Date.now()}});
const config=await getConfig();
const publish=await legacyLicenseAuxRequest(config,"set_public_config",{github_oauth_client_id:clean}).catch(()=>null);
return {ok:true,clientId:clean,published:!!publish?.ok,publicConfigError:publish?.ok?null:(publish?.error || null)};
}

const LICENSE_STORAGE_KEY ="unstoppableLicenseKeyV180";
const INSTALL_ID_KEY ="unstoppableInstallIdV180";
const LICENSE_CACHE_KEY ="unstoppableLicenseCacheV180";
const INCOGNITO_LICENSE_PREFIX ="unstoppableIncognitoLicenseV281:";
const INCOGNITO_LICENSE_CACHE_PREFIX ="unstoppableIncognitoLicenseCacheV281:";
const INCOGNITO_RUNTIME_LEASE_PREFIX ="unstoppableIncognitoRuntimeLeaseV2100:";

function licenseContextFromSender(sender){
const tab=sender?.tab || null;
return {incognito:!!tab?.incognito,tabId:Number.isInteger(tab?.id)?tab.id:null};
}
function incognitoLicenseKeyName(tabId){return`${INCOGNITO_LICENSE_PREFIX}${tabId}`;}
function incognitoLicenseCacheName(tabId){return`${INCOGNITO_LICENSE_CACHE_PREFIX}${tabId}`;}
function incognitoRuntimeLeaseName(tabId){return`${INCOGNITO_RUNTIME_LEASE_PREFIX}${tabId}`;}
async function readLicenseStorage(context={}){
if(context.incognito && Number.isInteger(context.tabId)){
const keyName=incognitoLicenseKeyName(context.tabId), cacheName=incognitoLicenseCacheName(context.tabId);
const data=await chrome.storage.session.get([keyName,cacheName]);
return {key:String(data[keyName]||""),cache:data[cacheName]||null,keyName,cacheName,area:chrome.storage.session};
}
const data=await chrome.storage.local.get([LICENSE_STORAGE_KEY,LICENSE_CACHE_KEY]);
return {key:String(data[LICENSE_STORAGE_KEY]||""),cache:data[LICENSE_CACHE_KEY]||null,keyName:LICENSE_STORAGE_KEY,cacheName:LICENSE_CACHE_KEY,area:chrome.storage.local};
}
async function persistLicenseStorage(context,key,result){
const store=await readLicenseStorage(context);
await store.area.set({[store.keyName]:key,[store.cacheName]:{active:true,checkedAt:Date.now(),result}});
}
async function persistLicenseCache(context,result){
const store=await readLicenseStorage(context);
await store.area.set({[store.cacheName]:{active:true,checkedAt:Date.now(),result}});
}
async function clearLicenseCache(context){
const store=await readLicenseStorage(context);
await store.area.remove(store.cacheName);
}
chrome.tabs.onRemoved.addListener(tabId=>{
chrome.storage.session.remove([incognitoLicenseKeyName(tabId),incognitoLicenseCacheName(tabId),incognitoRuntimeLeaseName(tabId)]).catch(()=>null);
});

const SECURITY_LOCK_KEY ="unstoppableSecurityLockV281";
const INTEGRITY_CACHE_TTL_MS = 5*60*1000;
const CRITICAL_INTEGRITY_FILES = [
"manifest.json","background.js","broker-protocol.js","content.js","content.css",
"chatgpt-bridge.js","ai-web-bridge.js","popup.js","popup.html",
"github-oauth-helper.js","offscreen.js","offscreen.html","local-bridge/server.mjs","skills/index.json"
];
let packageIntegrityCache=null;

async function sha256Hex(buffer){
const digest=await crypto.subtle.digest("SHA-256",buffer);
return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function packageIntegritySnapshot({force=false}={}){
const version=chrome.runtime.getManifest().version;
if(!force && packageIntegrityCache?.version===version && Date.now()-Number(packageIntegrityCache.checkedAt||0)<INTEGRITY_CACHE_TTL_MS) return packageIntegrityCache;
const hashes={};
const failures=[];
for(const path of CRITICAL_INTEGRITY_FILES){
try{
const response=await fetch(chrome.runtime.getURL(path),{cache:"no-store"});
if(!response.ok){failures.push({path,error:`HTTP_${response.status}`});continue;}
hashes[path]=await sha256Hex(await response.arrayBuffer());
}catch(error){failures.push({path,error:String(error)});}
}
const canonical=Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b)).map(([path,hash])=>`${path}:${hash}`).join("\n");
const digest=await sha256Hex(new TextEncoder().encode(canonical));
packageIntegrityCache={version,hashes,digest,failures,checkedAt:Date.now()};
return packageIntegrityCache;
}

async function setSecurityLock(detail={}){
const lock={locked:true,version:chrome.runtime.getManifest().version,at:Date.now(),reason:detail.reason||detail.error||"EXTENSION_INTEGRITY_MISMATCH",detail};
await chrome.storage.local.set({[SECURITY_LOCK_KEY]:lock});

await chrome.storage.local.remove([GITHUB_AUTH_KEY,SUPABASE_MANAGEMENT_KEY]);
await chrome.storage.session.remove([GITHUB_AUTH_KEY,SUPABASE_MANAGEMENT_KEY,"unstoppableSupaSession"]);
return lock;
}
async function clearSecurityLock(){await chrome.storage.local.remove(SECURITY_LOCK_KEY);}
async function getSecurityLock(){return (await chrome.storage.local.get(SECURITY_LOCK_KEY))[SECURITY_LOCK_KEY]||null;}

function licenseCapabilities(role){
const limited=String(role||"").toLowerCase()==="limited";
return {
command:true,connections:true,watermark:true,account:true,whatsapp:true,
skills:true,shortcuts:!limited,download_project:!limited,protection:!limited
};
}

async function getInstallId() {
const data = await chrome.storage.local.get(INSTALL_ID_KEY);
if (data[INSTALL_ID_KEY]) return data[INSTALL_ID_KEY];
const id = crypto.randomUUID();
await chrome.storage.local.set({[INSTALL_ID_KEY]:id});
return id;
}

function normalizeHappyLicenseResult(data,httpStatus) {
const payload=data && typeof data==="object" && !Array.isArray(data)?data:{};
const status=String(payload.status||"invalid_response");
const active=httpStatus>=200 && httpStatus<300 && payload.valid===true && status==="active";
const errors={
invalid:"INVALID_LICENSE",
device_mismatch:"DEVICE_MISMATCH",
expired:"LICENSE_EXPIRED",
revoked:"LICENSE_REVOKED",
rate_limited:"TOO_MANY_ATTEMPTS",
invalid_request:"INVALID_LICENSE_REQUEST",
device_limit_reached:"ACTIVATION_LIMIT_REACHED",
deactivated:"LICENSE_DEACTIVATED",
unavailable:"LICENSE_PROVIDER_UNAVAILABLE"
};
const result={...payload,ok:active,active,status,httpStatus,provider:"happy-little101"};
if(active){
result.role="customer";
result.capabilities=licenseCapabilities(result.role);
result.lifetime=!payload.expiresAt;
result.entitlement_version=chrome.runtime.getManifest().version;
}else{
result.error=errors[status]||(!httpStatus?"LICENSE_NETWORK_ERROR":`LICENSE_PROVIDER_${status.toUpperCase()}`);
}
return result;
}

async function happyLicenseRequest(operation,licenseKey,context={}) {
const stored=await readLicenseStorage(context);
const clean=String(licenseKey??stored.key??"").trim();
if(!clean) return {ok:false,active:false,status:"invalid_request",error:"LICENSE_REQUIRED"};
try{
const deviceIdentifier=await getInstallId();
const response=await fetch(HAPPY_LICENSE_API_URL,{
method:"POST",
headers:{"Content-Type":"application/json","Accept":"application/json"},
cache:"no-store",
body:JSON.stringify({operation,licenseKey:clean,productIdentifier:HAPPY_LICENSE_PRODUCT,deviceIdentifier})
});
const data=await response.json().catch(()=>null);
return normalizeHappyLicenseResult(data,response.status);
}catch(error){
return {ok:false,active:false,status:"network_error",error:"LICENSE_NETWORK_ERROR",detail:String(error)};
}
}

async function legacyLicenseAuxRequest(config,action,extra={},context={}) {
if(!["usage","set_public_config"].includes(action)) return {ok:false,error:"LEGACY_LICENSE_ACTION_DISABLED"};
const installId=await getInstallId();
const stored=await readLicenseStorage(context);
const licenseKey=String(extra.license_key??stored.key??"").trim();
const integrity=await packageIntegritySnapshot().catch(error=>({version:chrome.runtime.getManifest().version,hashes:{},digest:null,failures:[{error:String(error)}]}));
const version=chrome.runtime.getManifest().version;
let proofBundle={};
try{proofBundle=await ucDeviceProof(action,installId,version);}catch(error){return {ok:false,error:"DEVICE_PROOF_UNAVAILABLE",detail:String(error)};}
try{
const response=await fetch(UC_LICENSE_AUX_API_URL,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({action,install_id:installId,extension_version:version,license_key:licenseKey,integrity_hashes:integrity.hashes,integrity_digest:integrity.digest,integrity_failures:integrity.failures,...proofBundle,...extra})
});
const data=await response.json().catch(()=>({}));
return {httpStatus:response.status,...data};
}catch(error){
return {ok:false,error:"LICENSE_NETWORK_ERROR",detail:String(error)};
}
}

async function runtimeLeaseStorage(context={}){
if(context.incognito && Number.isInteger(context.tabId)){
const name=incognitoRuntimeLeaseName(context.tabId);
const data=await chrome.storage.session.get(name);
return {name,area:chrome.storage.session,value:data[name]||null};
}
const data=await chrome.storage.session.get(UC_RUNTIME_LEASE_KEY);
return {name:UC_RUNTIME_LEASE_KEY,area:chrome.storage.session,value:data[UC_RUNTIME_LEASE_KEY]||null};
}
async function clearRuntimeLease(context={}){
const store=await runtimeLeaseStorage(context);
await store.area.remove(store.name);
}
async function ensureRuntimeLease(config,context={},serverValidate=false){
const status=await getLicenseStatus(config,{force:serverValidate,context});
if(!status?.ok||!status?.active) return {ok:false,error:status?.error||"LICENSE_REQUIRED"};
return {ok:true,license:status};
}

async function activateLicense(config, key, context={}) {
const clean = String(key ||"").trim();
let result=await happyLicenseRequest("check",clean,context);
if(!result?.ok && result?.status==="device_mismatch"){
const activated=await happyLicenseRequest("activate",clean,context);
if(!activated?.ok||!activated?.active) return activated;
result=await happyLicenseRequest("check",clean,context);
if(!result?.ok||!result?.active) return result;
}
if(result?.ok && result?.active){
await clearSecurityLock();
result.capabilities=result.capabilities||licenseCapabilities(result.role);
await persistLicenseStorage(context,clean,result);
await clearRuntimeLease(context);
}
return result;
}

async function getLicenseStatus(config,{force=false,context={}}={}) {
const stored = await readLicenseStorage(context);
const key = String(stored.key ||"").trim();
if (!key) return {ok:false,active:false,error:context.incognito?"INCOGNITO_LICENSE_REQUIRED":"LICENSE_REQUIRED",incognito:!!context.incognito};
const cache = stored.cache;
const securityLock=await getSecurityLock();
if (!force && !securityLock?.locked && cache?.active && cache.result?.provider==="happy-little101" && Date.now()-Number(cache.checkedAt||0) < 30*1000) return {...cache.result,incognito:!!context.incognito};
const result = await happyLicenseRequest("check",key,context);
if (result?.ok && result?.active) {
await clearSecurityLock();
result.capabilities=result.capabilities||licenseCapabilities(result.role);
await persistLicenseCache(context,result);
await clearRuntimeLease(context);
} else {
await clearLicenseCache(context);
await clearRuntimeLease(context).catch(()=>null);
}
return {...result,incognito:!!context.incognito};
}

function estimateLovableBuildCredits(prompt,{files=[],attachments=0}={}) {
const text=String(prompt||"").toLowerCase();
const fileCount=Array.isArray(files)?files.length:0;

let credits=1.00, label="implementação";
if(/landing page|página de destino|site completo|website|criar um site|construir um site/.test(text)){credits=1.70;label="landing/site";}
else if(/autentica|authentication|login|sign[ -]?up|cadastro/.test(text)){credits=1.20;label="autenticação";}
else if(/remover|remove|excluir|delete/.test(text) &&/footer|rodapé|componente|component/.test(text)){credits=0.90;label="remoção";}
else if(/cor|color|botão|button|estilo|style|fonte|font|espaçamento|spacing/.test(text) && fileCount<=2){credits=0.50;label="ajuste visual";}
else if(fileCount>=8 || attachments>0){credits=1.70;label="implementação ampla";}
else if(fileCount>=4){credits=1.20;label="feature";}
else if(fileCount>=2){credits=0.90;label="alteração média";}
return {credits:Number(credits.toFixed(2)),label};
}

async function recordLicensedUsage(config, provider, estimatedCredits=1, context={}) {
const status = await getLicenseStatus(config,{force:false,context});
if (!status?.ok || !status?.active) return status;
const credits=Math.max(0.01,Math.min(1000,Number(estimatedCredits||1)));
return legacyLicenseAuxRequest(config,"usage",{provider:String(provider||"unknown").slice(0,40),estimated_credits:credits},context);
}

const BROKER_JOB_PREFIX="unstoppableBrokerJobV281:";
async function persistBrokerJob(requestId,patch={}) {
if(!requestId) return null;
const key=`${BROKER_JOB_PREFIX}${requestId}`;
const current=(await chrome.storage.local.get(key))[key] || {};
const next={...current,...patch,requestId,updatedAt:Date.now()};
await chrome.storage.local.set({[key]:next});
return next;
}

async function getSupabaseSession(config=null) {
const data = await chrome.storage.session.get("unstoppableSupaSession");
const session = data.unstoppableSupaSession;
if (!session?.accessToken) return null;
const now=Math.floor(Date.now()/1000);
if (!session.expiresAt || now < Number(session.expiresAt)-30) return session;

if (session.refreshToken && config?.supabaseUrl && config?.supabasePublishableKey) {
try {
const response=await fetch(`${normalize(config.supabaseUrl)}/auth/v1/token?grant_type=refresh_token`,{
method:"POST",
headers:{apikey:config.supabasePublishableKey,"Content-Type":"application/json"},
body:JSON.stringify({refresh_token:session.refreshToken})
});
const refreshed=await response.json().catch(()=>({}));
if(response.ok && refreshed.access_token){
const next={
accessToken:refreshed.access_token,
refreshToken:refreshed.refresh_token || session.refreshToken,
expiresAt:refreshed.expires_at || (now+Number(refreshed.expires_in||3600)),
user:refreshed.user ? {id:refreshed.user.id,email:refreshed.user.email} : session.user || null
};
await chrome.storage.session.set({unstoppableSupaSession:next});
return next;
}
} catch {}
}

await chrome.storage.session.remove("unstoppableSupaSession");
return null;
}

async function supabaseLogin(config,email,password) {
if (!config.supabaseUrl || !config.supabasePublishableKey) return {ok:false,error:"SUPABASE_CUSTOMER_CONFIG_REQUIRED"};
const response = await fetch(`${normalize(config.supabaseUrl)}/auth/v1/token?grant_type=password`, {
method:"POST",
headers:{ apikey:config.supabasePublishableKey,"Content-Type":"application/json" },
body:JSON.stringify({email,password})
});
const data = await response.json().catch(() => ({}));
if (!response.ok || !data.access_token) {
return {ok:false,status:response.status,error:data.msg || data.error_description || data.error ||"LOGIN_FAILED"};
}
await chrome.storage.session.set({
unstoppableSupaSession:{
accessToken:data.access_token,
refreshToken:data.refresh_token || null,
expiresAt:data.expires_at || null,
user:data.user ? {id:data.user.id,email:data.user.email} : null
}
});
return {ok:true,user:data.user ? {id:data.user.id,email:data.user.email} : null};
}

async function supabaseStatus(config) {
if (!config.supabaseUrl || !config.supabasePublishableKey) return {ok:false,error:"SUPABASE_CUSTOMER_CONFIG_REQUIRED"};
try {
const response = await fetch(`${normalize(config.supabaseUrl)}/auth/v1/settings`, {
headers:{apikey:config.supabasePublishableKey}
});
return {ok:response.ok,status:response.status};
} catch (error) {
return {ok:false,error:String(error)};
}
}

async function getSupabaseManagementAuth() {
const local=await chrome.storage.local.get(SUPABASE_MANAGEMENT_KEY);
const session=await chrome.storage.session.get(SUPABASE_MANAGEMENT_KEY);
return session[SUPABASE_MANAGEMENT_KEY] || local[SUPABASE_MANAGEMENT_KEY] || null;
}

async function setSupabaseManagementAuth(auth,{remember=false}={}) {
await chrome.storage.session.remove(SUPABASE_MANAGEMENT_KEY);
if(!auth){ await chrome.storage.local.remove(SUPABASE_MANAGEMENT_KEY); return; }
if(remember){ await chrome.storage.local.set({[SUPABASE_MANAGEMENT_KEY]:auth}); }
else { await chrome.storage.local.remove(SUPABASE_MANAGEMENT_KEY); await chrome.storage.session.set({[SUPABASE_MANAGEMENT_KEY]:auth}); }
}

async function supabaseManagementRequest(path,{method="GET",body=null,token=null}={}) {
const auth=token ? {token} : await getSupabaseManagementAuth();
const accessToken=String(auth?.token ||"").trim();
if(!accessToken) return {ok:false,error:"SUPABASE_MANAGEMENT_AUTH_REQUIRED",status:401};
try{
const response=await fetch(`https://api.supabase.com${path}`,{
method,
headers:{Authorization:`Bearer ${accessToken}`,Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},
body:body?JSON.stringify(body):undefined
});
const data=await response.json().catch(async()=>({message:(await response.text().catch(()=>""))||null}));
if(!response.ok) return {ok:false,status:response.status,error:data?.message || data?.error ||`SUPABASE_MANAGEMENT_HTTP_${response.status}`,data};
return {ok:true,status:response.status,data};
}catch(error){ return {ok:false,error:"SUPABASE_MANAGEMENT_NETWORK_ERROR",detail:String(error)}; }
}

async function supabaseManagementConnect(projectRef,token,{remember=false}={}) {
const ref=String(projectRef||"").trim();
const clean=String(token||"").trim();
if(!ref || !clean) return {ok:false,error:"SUPABASE_MANAGEMENT_CONFIG_REQUIRED"};
const probe=await supabaseManagementRequest(`/v1/projects/${encodeURIComponent(ref)}`,{token:clean});
if(!probe.ok) return probe;
await setSupabaseManagementAuth({token:clean,projectRef:ref,connectedAt:Date.now()},{remember});
return {ok:true,connected:true,projectRef:ref,projectName:probe.data?.name || null,region:probe.data?.region || null};
}

async function supabaseManagementStatus(projectRef=null) {
const auth=await getSupabaseManagementAuth();
const ref=String(projectRef || auth?.projectRef ||"").trim();
if(!auth?.token || !ref) return {ok:true,connected:false,state:"auth_required"};
const probe=await supabaseManagementRequest(`/v1/projects/${encodeURIComponent(ref)}`);
if(!probe.ok){ if(probe.status===401) await setSupabaseManagementAuth(null); return {ok:false,connected:false,error:probe.error,status:probe.status||null}; }
return {ok:true,connected:true,projectRef:ref,projectName:probe.data?.name || null,region:probe.data?.region || null};
}

async function supabaseApplyMigrationSql(projectRef,sql) {
const ref=String(projectRef||"").trim();
const query=String(sql||"");
if(!ref || !query.trim()) return {ok:false,error:"SUPABASE_MIGRATION_INPUT_INVALID"};
return await supabaseManagementRequest(`/v1/projects/${encodeURIComponent(ref)}/database/query`,{method:"POST",body:{query}});
}

async function supabaseApplyCommittedMigrations({repo,commitSha,files,projectRef}) {
const migrations=(Array.isArray(files)?files:[]).filter(file=>file?.action!=="delete" &&/^supabase\/migrations\/[^/]+\.sql$/i.test(String(file?.path||"")));
if(!migrations.length) return {ok:true,applied:[],skipped:true};
const status=await supabaseManagementStatus(projectRef);
if(!status?.connected) return {ok:false,error:"SUPABASE_MANAGEMENT_AUTH_REQUIRED",pending:migrations.map(x=>x.path)};
const storage=await chrome.storage.local.get("unstoppableSupabaseAppliedMigrationsV210");
const marks=storage.unstoppableSupabaseAppliedMigrationsV210 || {};
const applied=[];
for(const migration of migrations){
const mark=`${commitSha}:${migration.path}`;
if(marks[mark]){ applied.push({path:migration.path,status:"already-applied"}); continue; }
const file=await githubReadFile(repo,migration.path,commitSha);
if(!file.ok) return {ok:false,error:"SUPABASE_MIGRATION_READ_FAILED",path:migration.path,detail:file.error};
const result=await supabaseApplyMigrationSql(projectRef,file.content);
if(!result.ok) return {ok:false,error:"SUPABASE_MIGRATION_APPLY_FAILED",path:migration.path,detail:result.error,status:result.status||null,applied};
marks[mark]={appliedAt:Date.now(),projectRef};
applied.push({path:migration.path,status:"applied"});
await chrome.storage.local.set({unstoppableSupabaseAppliedMigrationsV210:marks});
}
return {ok:true,applied,projectRef};
}

async function parseProgressResponse(response,onProgress) {
const contentType = String(response.headers.get("content-type") ||"").toLowerCase();
const streaming = contentType.includes("text/event-stream") || contentType.includes("application/x-ndjson") || contentType.includes("application/ndjson");
if (!streaming || !response.body) {
return await response.json().catch(() => ({ok:false,error:`HTTP_${response.status}`}));
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer ="";
let finalResult = null;

const processLine = async rawLine => {
let line = String(rawLine ||"").trim();
if (!line || line.startsWith(":")) return;
if (line.startsWith("data:")) line = line.slice(5).trim();
if (!line || line ==="[DONE]") return;
let event;
try { event = JSON.parse(line); } catch { return; }

if (event.type ==="result" || event.done === true || typeof event.ok ==="boolean") {
finalResult = event.result && typeof event.result ==="object"
? {...event.result, provider:event.result.provider || event.provider}
: event;
}

if (typeof event.progress ==="number" || event.stage || event.text || event.message) {
try { await onProgress?.(event); } catch {}
}
};

while (true) {
const {value,done} = await reader.read();
if (done) break;
buffer += decoder.decode(value,{stream:true});
const lines = buffer.split(/\r?\n/);
buffer = lines.pop() ||"";
for (const line of lines) await processLine(line);
}
buffer += decoder.decode();
if (buffer.trim()) await processLine(buffer);

return finalResult || {ok:response.ok,error:response.ok ? null :`HTTP_${response.status}`};
}

async function callExecutor(config,payload,onProgress=null) {
if (!config.executorUrl || !config.supabasePublishableKey) return {ok:false,error:"CUSTOMER_EXECUTOR_NOT_CONFIGURED"};
const session = await getSupabaseSession(config);
if (!session?.accessToken) return {ok:false,error:"SUPABASE_AUTH_REQUIRED"};

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort("EXECUTOR_TIMEOUT"), 60 * 60 * 1000);
try {
const response = await fetch(config.executorUrl, {
method:"POST",
headers:{
Authorization:`Bearer ${session.accessToken}`,
apikey:config.supabasePublishableKey,
"Content-Type":"application/json",
"Accept":"application/json, text/event-stream, application/x-ndjson"
},
body:JSON.stringify({...payload,progressEvents:true,streamProgress:true}),
signal:controller.signal
});
return await parseProgressResponse(response,onProgress);
} catch (error) {
if (controller.signal.aborted) return {ok:false,error:"EXECUTOR_TIMEOUT"};
return {ok:false,error:String(error)};
} finally {
clearTimeout(timeout);
}
}

const CHAT_BRIDGE_VERSION ="2.10.0";
const CHAT_PING_MESSAGE ="UNSTOPPABLE_PING_V2100";
const CHAT_EXECUTE_MESSAGE ="UNSTOPPABLE_EXECUTE_V2100";

async function getChatTabs() {
const tabs = await chrome.tabs.query({url:["https://chatgpt.com/*","https://chat.openai.com/*"]});
const remembered = (await chrome.storage.local.get("unstoppableChatTab")).unstoppableChatTab;

return tabs.sort((a,b) => {
if (a.id === remembered) return -1;
if (b.id === remembered) return 1;
return Number(Boolean(b.active)) - Number(Boolean(a.active));
});
}

async function waitTabComplete(tabId, timeout = 20000) {
const start = Date.now();
while (Date.now() - start < timeout) {
try {
const tab = await chrome.tabs.get(tabId);
if (tab.status ==="complete") return true;
} catch {
return false;
}
await new Promise(resolve => setTimeout(resolve,250));
}
return false;
}

async function injectChatBridge(tabId) {
try {
await chrome.scripting.executeScript({target:{tabId},files:["chatgpt-bridge.js"]});
await new Promise(resolve => setTimeout(resolve,420));
return {ok:true};
} catch (error) {
return {ok:false,error:"CHATGPT_BRIDGE_INJECTION_FAILED",detail:String(error)};
}
}

async function pingChat(tabId) {
const sendPing = async () => {
try {
return await chrome.tabs.sendMessage(tabId,{type:CHAT_PING_MESSAGE});
} catch {
return null;
}
};

let result = await sendPing();
if (result?.ok && result?.bridgeVersion === CHAT_BRIDGE_VERSION) return result;

const injected = await injectChatBridge(tabId);
if (!injected?.ok) return injected;
result = await sendPing();
if (result?.ok && result?.bridgeVersion === CHAT_BRIDGE_VERSION) return result;

return {ok:false,error:"CHATGPT_BRIDGE_NOT_READY",detail:result?.error || null};
}

function classifyChatPing(tab, ping) {
if (!ping?.ok) {
return {
ok:false, connected:true, ready:false, state:"bridge_loading",
tabId:tab.id, error:ping?.error ||"CHATGPT_BRIDGE_NOT_READY"
};
}

if (ping.loginRequired) {
return {
ok:true, connected:true, ready:false, state:"login_required",
tabId:tab.id, bridgeVersion:ping.bridgeVersion, error:"CHATGPT_LOGIN_REQUIRED"
};
}

if (ping.composerFound && !ping.busy && !ping.streaming) {
return {
ok:true, connected:true, ready:true, state:"ready",
tabId:tab.id, bridgeVersion:ping.bridgeVersion,
sendButtonFound:!!ping.sendButtonFound
};
}

if (ping.composerFound && (ping.busy || ping.streaming)) {
return {
ok:true, connected:true, ready:false, state:"busy", waitable:true,
tabId:tab.id, bridgeVersion:ping.bridgeVersion,
busyEvidence:ping.busyEvidence ||"",
error:"CHATGPT_BUSY"
};
}

return {
ok:true, connected:true, ready:false, state:"not_ready",
tabId:tab.id, bridgeVersion:ping.bridgeVersion, error:"CHATGPT_NOT_READY"
};
}

async function inspectExistingChatTabs() {
const tabs = await getChatTabs();
if (!tabs.length) return {tabs:[],best:null};

const states = [];
for (const tab of tabs.slice(0,6)) {
if (!tab?.id) continue;
if (tab.status !=="complete") await waitTabComplete(tab.id,2500).catch(()=>false);
const ping = await pingChat(tab.id);
states.push({tab,state:classifyChatPing(tab,ping)});
}

const rank = {ready:100,busy:80,login_required:50,not_ready:30,bridge_loading:20};
states.sort((a,b) => (rank[b.state.state] || 0) - (rank[a.state.state] || 0));
return {tabs,states,best:states[0] || null};
}

async function focusChatTab(tabId) {
try {
const tab = await chrome.tabs.get(tabId);
await chrome.tabs.update(tabId,{active:true});
if (tab.windowId != null) await chrome.windows.update(tab.windowId,{focused:true});
} catch {}
}

async function prepareBackgroundAiTab(tabId){
try{await chrome.tabs.update(tabId,{autoDiscardable:false});}catch{}
try{await chrome.scripting.executeScript({target:{tabId},func:()=>{try{Object.defineProperty(document,"__unstoppableBackgroundAgent",{value:true,configurable:true});}catch{}}});}catch{}
}

async function ensureChatReady({interactive=false,repair=false,timeout=12000,waitForLogin=false,freshTab=false,backgroundCreate=false} = {}) {
let inspection = freshTab ? {tabs:[],states:[],best:null} : await inspectExistingChatTabs();
let candidate = inspection.best;

if (freshTab && interactive) {
const tab = await chrome.tabs.create({url:"https://chatgpt.com/",active:true,pinned:false});
await chrome.storage.local.set({unstoppableChatTab:tab.id,unstoppableDedicatedChatTab:tab.id});
await waitTabComplete(tab.id,30000);
await new Promise(resolve => setTimeout(resolve,520));
candidate = {tab,state:classifyChatPing(tab,await pingChat(tab.id))};
} else {
const readyCandidate = inspection.states?.find(item => item.state.ready);
if (readyCandidate) {
await chrome.storage.local.set({unstoppableChatTab:readyCandidate.tab.id});
await prepareBackgroundAiTab(readyCandidate.tab.id);
return readyCandidate.state;
}
}

if (!candidate && interactive) {
const tab = await chrome.tabs.create({url:"https://chatgpt.com/",active:true,pinned:false});
await chrome.storage.local.set({unstoppableChatTab:tab.id,unstoppableDedicatedChatTab:tab.id});
await prepareBackgroundAiTab(tab.id);
await waitTabComplete(tab.id,30000);
await new Promise(resolve => setTimeout(resolve,420));
candidate = {tab,state:classifyChatPing(tab,await pingChat(tab.id))};
}

if (!candidate && backgroundCreate) {
const tab=await chrome.tabs.create({url:"https://chatgpt.com/",active:false,pinned:false});
await chrome.storage.local.set({unstoppableChatTab:tab.id,unstoppableDedicatedChatTab:tab.id});
await prepareBackgroundAiTab(tab.id);
await waitTabComplete(tab.id,30000).catch(()=>false);
await new Promise(resolve=>setTimeout(resolve,350));
candidate={tab,state:classifyChatPing(tab,await pingChat(tab.id))};
}

if (!candidate) {
return {ok:false,connected:false,ready:false,state:"missing",error:"CHATGPT_TAB_NOT_FOUND"};
}

if (candidate.state.state ==="busy") {
await chrome.storage.local.set({unstoppableChatTab:candidate.tab.id});
if (interactive) await focusChatTab(candidate.tab.id);
return candidate.state;
}

if (candidate.state.state ==="login_required") {
if (interactive) await focusChatTab(candidate.tab.id);
if (interactive && waitForLogin) {
const loginStarted = Date.now();
let lastLoginState = candidate.state;
while (Date.now() - loginStarted < Math.max(timeout,90000)) {
await new Promise(resolve => setTimeout(resolve,900));
try {
const tab = await chrome.tabs.get(candidate.tab.id);
if (!tab?.id) break;
if (tab.status !=="complete") continue;
const ping = await pingChat(candidate.tab.id);
lastLoginState = classifyChatPing(tab,ping);
if (lastLoginState.ready || lastLoginState.state ==="busy") {
await chrome.storage.local.set({unstoppableChatTab:candidate.tab.id});
return lastLoginState;
}
} catch { break; }
}
return lastLoginState;
}
return candidate.state;
}

if (repair) {
try {
await chrome.tabs.reload(candidate.tab.id);
await waitTabComplete(candidate.tab.id,30000);
await new Promise(resolve => setTimeout(resolve,800));
} catch {}
}

const started = Date.now();
let last = candidate.state;

while (Date.now() - started < timeout) {
const ping = await pingChat(candidate.tab.id);
last = classifyChatPing(candidate.tab,ping);

if (last.ready) {
await chrome.storage.local.set({unstoppableChatTab:candidate.tab.id});
await prepareBackgroundAiTab(candidate.tab.id);
return last;
}

if (last.state ==="busy" || last.state ==="login_required") {
await chrome.storage.local.set({unstoppableChatTab:candidate.tab.id});
if (interactive && last.state ==="login_required") await focusChatTab(candidate.tab.id);
return last;
}

await new Promise(resolve => setTimeout(resolve,550));
}

if (interactive && last.state !=="busy" && last.state !=="login_required") {
try {
const tab = await chrome.tabs.get(candidate.tab.id);
const url = String(tab.url ||"");
if (!/^https:\/\/chatgpt\.com\/(?:$|\?|c\/|g\/)/.test(url)) {
await chrome.tabs.update(candidate.tab.id,{url:"https://chatgpt.com/",active:true});
await waitTabComplete(candidate.tab.id,25000);
await new Promise(resolve => setTimeout(resolve,700));
}

const recovered = classifyChatPing(candidate.tab,await pingChat(candidate.tab.id));
if (recovered.ready || recovered.state ==="busy" || recovered.state ==="login_required") {
await chrome.storage.local.set({unstoppableChatTab:candidate.tab.id});
if (interactive) await focusChatTab(candidate.tab.id);
return recovered;
}
last = recovered;
} catch {}
}

if (interactive) await focusChatTab(candidate.tab.id);
return last;
}

async function chatStatus() {
const status = await ensureChatReady({interactive:false,repair:false,timeout:1200});
return {
ok:true,
connected:!!status.connected || !!status.tabId,
ready:!!status.ready,
busy:status.state ==="busy",
waitable:!!status.waitable,
loginRequired:status.state ==="login_required",
state:status.state,
tabId:status.tabId || null,
error:status.error || null,
detail:status.detail || null
};
}

const WEB_AI_BRIDGE_VERSION ="2.10.0";
const WEB_AI_PING_MESSAGE ="UNSTOPPABLE_AI_PING_V2100";
const WEB_AI_EXECUTE_MESSAGE ="UNSTOPPABLE_AI_EXECUTE_V2100";
const WEB_AI_URLS = {
gemini:"https://gemini.google.com/app",
claude:"https://claude.ai/new",
deepseek:"https://chat.deepseek.com/"
};
const WEB_AI_MATCHES = {
gemini:["https://gemini.google.com/*"],
claude:["https://claude.ai/*"],
deepseek:["https://chat.deepseek.com/*"]
};

async function getWebAiTabs(provider) {
const matches=WEB_AI_MATCHES[provider];
if(!matches) return [];
const tabs=await chrome.tabs.query({url:matches});
const remembered=(await chrome.storage.local.get(`unstoppableAiTab:${provider}`))[`unstoppableAiTab:${provider}`];
return tabs.sort((a,b)=>a.id===remembered?-1:b.id===remembered?1:Number(Boolean(b.active))-Number(Boolean(a.active)));
}

async function injectWebAiBridge(tabId) {
try {
await chrome.scripting.executeScript({target:{tabId},files:["ai-web-bridge.js"]});
await new Promise(resolve=>setTimeout(resolve,260));
return true;
} catch { return false; }
}

async function pingWebAi(tabId) {
const send=async()=>{ try{return await chrome.tabs.sendMessage(tabId,{type:WEB_AI_PING_MESSAGE});}catch{return null;} };
let result=await send();
if(result?.ok && result?.bridgeVersion===WEB_AI_BRIDGE_VERSION) return result;
await injectWebAiBridge(tabId);
result=await send();
return result?.ok ? result : {ok:false,error:"AI_BRIDGE_NOT_READY"};
}

function classifyWebAi(provider,tab,ping) {
if(!ping?.ok) return {ok:false,connected:true,ready:false,state:"bridge_loading",provider,tabId:tab.id,error:ping?.error||"AI_BRIDGE_NOT_READY"};
if(ping.loginRequired) return {ok:true,connected:true,ready:false,state:"login_required",provider,tabId:tab.id,error:"AI_LOGIN_REQUIRED"};
if(ping.composerFound && ping.busy) return {ok:true,connected:true,ready:false,state:"busy",waitable:true,provider,tabId:tab.id,error:"AI_BUSY"};
if(ping.composerFound) return {ok:true,connected:true,ready:true,state:"ready",provider,tabId:tab.id,bridgeVersion:ping.bridgeVersion};
return {ok:true,connected:true,ready:false,state:"not_ready",provider,tabId:tab.id,error:"AI_COMPOSER_NOT_FOUND"};
}

async function ensureWebAiReady(provider,{interactive=false,repair=false,timeout=9000,freshTab=false,waitForLogin=false,backgroundCreate=false}={}) {
let tabs=freshTab ? [] : await getWebAiTabs(provider);
let tab=tabs[0] || null;
if((!tab && interactive) || (freshTab && interactive)) {
tab=await chrome.tabs.create({url:WEB_AI_URLS[provider],active:true,pinned:false});
await prepareBackgroundAiTab(tab.id);
await waitTabComplete(tab.id,30000).catch(()=>false);
await new Promise(resolve=>setTimeout(resolve,450));
} else if(!tab && backgroundCreate) {
tab=await chrome.tabs.create({url:WEB_AI_URLS[provider],active:false,pinned:false});
await prepareBackgroundAiTab(tab.id);
await waitTabComplete(tab.id,30000).catch(()=>false);
await new Promise(resolve=>setTimeout(resolve,350));
}
if(!tab?.id) return {ok:false,connected:false,ready:false,state:"missing",provider,error:"AI_TAB_NOT_FOUND"};
if(repair) {
try{await chrome.tabs.reload(tab.id);await waitTabComplete(tab.id,30000);await new Promise(resolve=>setTimeout(resolve,600));}catch{}
}
const started=Date.now(); let last=null;
while(Date.now()-started<timeout) {
last=classifyWebAi(provider,tab,await pingWebAi(tab.id));
if(last.ready || last.state==="busy") {
await chrome.storage.local.set({[`unstoppableAiTab:${provider}`]:tab.id});
if(interactive && last.state!=="ready") await focusChatTab(tab.id);
return last;
}
if(last.state==="login_required") {
await chrome.storage.local.set({[`unstoppableAiTab:${provider}`]:tab.id});
if(interactive) await focusChatTab(tab.id);
if(!waitForLogin) return last;

await new Promise(resolve=>setTimeout(resolve,700));
continue;
}
await new Promise(resolve=>setTimeout(resolve,500));
}
if(interactive) await focusChatTab(tab.id);
return last || {ok:false,connected:true,ready:false,state:"not_ready",provider,tabId:tab.id,error:"AI_NOT_READY"};
}

async function executeWebAi(provider,{requestId,prompt}) {
const ready=await ensureWebAiReady(provider,{interactive:false,repair:false,timeout:2500});
if(!ready?.ready || !ready?.tabId) return {ok:false,error:ready?.error ||"AI_NOT_CONNECTED",state:ready?.state,provider};
try {
const result=await chrome.tabs.sendMessage(ready.tabId,{type:WEB_AI_EXECUTE_MESSAGE,requestId,prompt});
return result?.ok ? {...result,background:true} : {ok:false,error:result?.error ||"AI_EXECUTE_FAILED",provider};
} catch(error){ return {ok:false,error:"AI_BRIDGE_SEND_FAILED",detail:String(error),provider}; }
}

async function providerStatus(provider, config) {
if (provider ==="chatgpt") return ensureChatReady({interactive:false,repair:false,timeout:1800});

if (["gemini","claude","deepseek"].includes(provider)) {
const web = await ensureWebAiReady(provider,{interactive:false,repair:false,timeout:1600});
if (web?.ready || web?.state ==="busy" || web?.state ==="login_required" || web?.connected) return web;

if (config.executorUrl && config.supabasePublishableKey) {
const session = await getSupabaseSession(config);
if (session?.accessToken) {
const status = await callExecutor(config,{action:"providers"});
if (status?.ok && status.providers?.[provider]) return {ok:true,ready:true,state:"ready",provider,route:"supabase-api"};
}
}
return web || {ok:false,ready:false,state:"missing",provider,error:"AI_TAB_NOT_FOUND"};
}

if (provider ==="deepseek-local") {
const status = await localBridgeStatus();
return status.ok
? {ok:true,ready:true,state:"ready",provider}
: {ok:false,ready:false,state:"offline",provider,error:status.error ||"LOCAL_BRIDGE_OFFLINE"};
}

if (provider ==="custom") {
const session = await getSupabaseSession(config);
if (!session?.accessToken) return {ok:false,ready:false,state:"auth_required",provider,error:"SUPABASE_AUTH_REQUIRED"};
const status = await callExecutor(config,{action:"providers"});
if (!status?.ok) return {ok:false,ready:false,state:"backend_error",provider,error:status?.error ||"PROVIDER_STATUS_FAILED"};
if (!status.providers?.custom) return {ok:false,ready:false,state:"not_configured",provider,error:"PROVIDER_NOT_CONFIGURED"};
return {ok:true,ready:true,state:"ready",provider,route:"supabase-api"};
}

if (provider ==="auto") {
const chat = await ensureChatReady({interactive:false,repair:false,timeout:800});
if (chat.ready) return {ok:true,ready:true,state:"ready",provider:"auto",route:"chatgpt"};

for (const route of ["gemini","claude","deepseek"]) {
const web = await ensureWebAiReady(route,{interactive:false,repair:false,timeout:500});
if (web?.ready) return {ok:true,ready:true,state:"ready",provider:"auto",route};
}

if (config.executorUrl && config.supabasePublishableKey) {
const session = await getSupabaseSession(config);
if (session?.accessToken) {
const status = await callExecutor(config,{action:"providers"});
const first = ["gemini","claude","deepseek","custom"].find(key => status?.providers?.[key]);
if (first) return {ok:true,ready:true,state:"ready",provider:"auto",route:first,via:"supabase-api"};
}
}

const local = await localBridgeStatus();
if (local?.ok) return {ok:true,ready:true,state:"ready",provider:"auto",route:"deepseek-local"};

if (chat.state ==="busy") return {ok:true,connected:true,ready:false,state:"busy",waitable:true,provider:"auto",route:"chatgpt",tabId:chat.tabId,error:"CHATGPT_BUSY"};
return {ok:false,ready:false,state:"no_route",provider:"auto",error:"NO_PROVIDER_READY"};
}

return {ok:false,ready:false,state:"unsupported",provider,error:"UNSUPPORTED_PROVIDER"};
}

async function connectProvider(provider, config, {repair=false,fresh=false} = {}) {
if (provider ==="chatgpt") return ensureChatReady({interactive:true,repair,timeout:repair ? 25000 : 15000,waitForLogin:true,freshTab:!!fresh});
if (["gemini","claude","deepseek"].includes(provider)) return ensureWebAiReady(provider,{interactive:true,repair,timeout:repair ? 25000 : 15000,waitForLogin:true});

if (provider ==="auto") {
let current = await providerStatus("auto",config);
if (current.ready) return current;
const chat = await ensureChatReady({interactive:true,repair:false,timeout:12000,waitForLogin:true,freshTab:!!fresh});
if (chat.ready) return {ok:true,ready:true,state:"ready",provider:"auto",route:"chatgpt"};
if (["login_required","busy","bridge_loading","not_ready"].includes(chat?.state)) {
return {...chat,provider:"auto",route:"chatgpt"};
}
return providerStatus("auto",config);
}

return providerStatus(provider,config);
}

async function localBridgeStatus() {
try {
const response = await fetch("http://127.0.0.1:8765/status", { cache:"no-store" });
const data = await response.json().catch(() => ({}));
return {ok:response.ok && data?.ok !== false, ...data};
} catch (error) {
return {ok:false,error:"LOCAL_BRIDGE_OFFLINE",detail:String(error)};
}
}

async function localBridge(payload,onProgress=null) {
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort("LOCAL_BRIDGE_TIMEOUT"), 60 * 60 * 1000);
try {
const response = await fetch("http://127.0.0.1:8765/run?stream=1", {
method:"POST",
headers:{
"Content-Type":"application/json",
"Accept":"application/x-ndjson, application/json"
},
body:JSON.stringify(payload),
signal:controller.signal
});
return await parseProgressResponse(response,onProgress);
} catch (error) {
if (controller.signal.aborted) return {ok:false,error:"LOCAL_BRIDGE_TIMEOUT"};
return {ok:false,error:"LOCAL_BRIDGE_OFFLINE",detail:String(error)};
} finally {
clearTimeout(timeout);
}
}

async function ensureOffscreen() {
if (!chrome.offscreen?.createDocument) return false;
const offscreenUrl = chrome.runtime.getURL("offscreen.html");

try {
if (chrome.runtime.getContexts) {
const contexts = await chrome.runtime.getContexts({
contextTypes:["OFFSCREEN_DOCUMENT"],
documentUrls:[offscreenUrl]
});
if (contexts.length) return true;
}

await chrome.offscreen.createDocument({
url:"offscreen.html",
reasons:[chrome.offscreen.Reason?.AUDIO_PLAYBACK ||"AUDIO_PLAYBACK"],
justification:"Reproduzir sons da interface, processamento, conclusão e erro da Unstoppable Corp."
});
return true;
} catch (error) {
if (String(error).toLowerCase().includes("single offscreen")) return true;
return false;
}
}

async function playUiSound(kind) {
if (!(await ensureOffscreen())) return;
try {
await chrome.runtime.sendMessage({type:"OFFSCREEN_PLAY",kind});
} catch {}
}

async function announceExecution(execution) {
const config = await getConfig();
const kind = execution.error ?"error" :"success";

if (config.soundsEnabled) {
await playUiSound(kind);
}

if (!config.notificationsEnabled || !chrome.notifications) return;

const title = execution.error
?"Unstoppable Corp · solicitação interrompida"
:"Unstoppable Corp · solicitação concluída";
const provider = execution.provider ?` pela ${execution.provider}` :"";
const message = execution.error
? (execution.text || execution.error ||"A execução terminou com erro.")
:`Finalizado com sucesso${provider}. O acompanhamento foi encerrado junto com o chat.`;

try {
await chrome.notifications.create(`unstoppable:${execution.requestId}`,{
type:"basic",
iconUrl:chrome.runtime.getURL("assets/icon128.png"),
title,
message,
priority:2
});
} catch {}

try {
await chrome.action.setBadgeBackgroundColor({color:execution.error ?"#D97706" :"#159669"});
await chrome.action.setBadgeText({text:execution.error ?"!" :"✓"});
setTimeout(() => chrome.action.setBadgeText({text:""}).catch(()=>null), 9000);
} catch {}
}

async function saveExecution(payload) {
const data = await chrome.storage.local.get("unstoppableLastExecution");
const previous = data.unstoppableLastExecution;
const sameRequest = previous?.requestId && previous.requestId === payload.requestId;

if (sameRequest && previous?.done && !payload?.done) return previous;

const now = Date.now();
const merged = {
...(sameRequest ? previous : {}),
...payload,
updatedAt:now
};

const timeline = sameRequest && Array.isArray(previous?.timeline) ? [...previous.timeline] : [];
const event = {
at:now,
stage:String(payload.stage || merged.stage ||"processando"),
text:String(payload.text ||""),
activity:payload.activity ? String(payload.activity) : null,
source:payload.source || merged.source || null,
done:!!payload.done,
error:payload.error || null
};
const eventSignature =`${event.stage}|${event.text}|${event.activity ||""}|${event.done}|${event.error ||""}`;
const lastEvent = timeline[timeline.length-1];
const lastSignature = lastEvent
?`${lastEvent.stage}|${lastEvent.text}|${lastEvent.activity ||""}|${!!lastEvent.done}|${lastEvent.error ||""}`
:"";
if ((event.text || event.activity || event.done || event.error) && eventSignature !== lastSignature) {
timeline.push(event);
}
merged.timeline = timeline.slice(-80);

const previousProgress = sameRequest ? Number(previous?.progress || 0) : 0;
const incomingProgress = Number(payload.progress ?? previousProgress);
merged.progress = Math.max(previousProgress, Math.min(100, Number.isFinite(incomingProgress) ? incomingProgress : 0));

if (merged.done && !merged.error) merged.progress = 100;

await chrome.storage.local.set({unstoppableLastExecution:merged});

if (merged.done && !(sameRequest && previous?.done)) {
await announceExecution(merged);
}

return merged;
}

async function reconcileStaleExecution() {
const data = await chrome.storage.local.get("unstoppableLastExecution");
const execution = data.unstoppableLastExecution;

return execution || null;
}

chrome.notifications?.onClicked?.addListener(async notificationId => {
if (!notificationId.startsWith("unstoppable:")) return;
const data = await chrome.storage.local.get("unstoppableLastExecution");
const tabId = data.unstoppableLastExecution?.originTabId;
if (!tabId) return;
try {
const tab = await chrome.tabs.get(tabId);
await chrome.tabs.update(tabId,{active:true});
if (tab.windowId != null) await chrome.windows.update(tab.windowId,{focused:true});
} catch {}
});

chrome.runtime.onMessage.addListener((message,sender,sendResponse) => {
(async () => {
if (message?.type ==="OFFSCREEN_PLAY") {
sendResponse({ok:true});
return;
}

const config = await getConfig();
const securityLock=await getSecurityLock();
const securityAllowed=new Set(["OFFSCREEN_PLAY","PLAY_STARTUP_SOUND","PLAY_SOUND","GET_CONFIG","GET_LICENSE_STATUS","ACTIVATE_LICENSE","GET_ACCOUNT_STATS","OPEN_SUPPORT"]);
if(securityLock?.locked && !securityAllowed.has(String(message?.type||""))){
sendResponse({ok:false,error:"EXTENSION_INTEGRITY_LOCKED",security_lock:securityLock});
return;
}

const publicTypes=new Set(["OFFSCREEN_PLAY","PLAY_STARTUP_SOUND","PLAY_SOUND","GET_CONFIG","GET_LICENSE_STATUS","ACTIVATE_LICENSE","GET_ACCOUNT_STATS","OPEN_SUPPORT"]);
if(!publicTypes.has(String(message?.type||""))){
const authz=await ensureRuntimeLease(config,licenseContextFromSender(sender),message?.type==="EXECUTE" || message?.type==="SAVE_CONFIG");
if(!authz?.ok){sendResponse({ok:false,error:authz?.error||"LICENSE_REQUIRED_SERVER_GATE"});return;}
}

if (message?.type ==="PLAY_STARTUP_SOUND") {
const sessionKey ="unstoppableStartupSoundV170";
const played = (await chrome.storage.session.get(sessionKey))[sessionKey];
if (!played && config.soundsEnabled) {
await chrome.storage.session.set({[sessionKey]:true});
await playUiSound("startup");
}
sendResponse({ok:true,played:!played});
return;
}

if (message?.type ==="PLAY_SOUND") {
if (config.soundsEnabled) await playUiSound(String(message.kind ||"click"));
sendResponse({ok:true});
return;
}

if (message?.type ==="GET_CONFIG") {
sendResponse({ok:true,config:{...config,licenseApiUrl:undefined}});
return;
}

if (message?.type ==="SAVE_CONFIG") {
const incoming={...(message.config||{})};
delete incoming.licenseApiUrl;
delete incoming.runtimeLease;
delete incoming.integrity_hashes;
await chrome.storage.sync.set(incoming);
sendResponse({ok:true});
return;
}

if (message?.type ==="GITHUB_OAUTH_HELPER_GET_SETUP") {
const stored=await chrome.storage.session.get(GITHUB_OAUTH_SETUP_KEY);
sendResponse({ok:true,setup:stored[GITHUB_OAUTH_SETUP_KEY] || null});
return;
}

if (message?.type ==="GITHUB_OAUTH_SETUP_START") {
sendResponse(await startGithubOAuthOwnerSetup());
return;
}

if (message?.type ==="GITHUB_OAUTH_SETUP_STATUS") {
sendResponse(await githubOAuthSetupStatus());
return;
}

if (message?.type ==="GITHUB_OAUTH_DISCOVERED") {
sendResponse(await completeGithubOAuthOwnerSetup(message.clientId,{deviceFlowEnabled:message.deviceFlowEnabled}));
return;
}

if (message?.type ==="GITHUB_STATUS") {
sendResponse(await githubStatus());
return;
}

if (message?.type ==="GITHUB_CONNECT_TOKEN") {
sendResponse(await githubConnectToken(String(message.token||""),{remember:message.remember !== false}));
return;
}

if (message?.type ==="GITHUB_DISCONNECT") {
await setGithubAuth(null);
sendResponse({ok:true,connected:false});
return;
}

if (message?.type ==="GITHUB_DEVICE_START") {
const clientId=String(message.clientId || config.githubOAuthClientId ||"").trim();
if (clientId && clientId !== config.githubOAuthClientId) await chrome.storage.sync.set({githubOAuthClientId:clientId});

sendResponse(await githubStartDeviceFlow(clientId));
return;
}

if (message?.type ==="GITHUB_DEVICE_OPEN_AUTH") {
const url=String(message.url ||"https://github.com/login/device");
if(!/^https:\/\/github\.com\/login\/device(?:[/?#]|$)/i.test(url)){ sendResponse({ok:false,error:"INVALID_GITHUB_DEVICE_URL"}); return; }
const authTab=await chrome.tabs.create({url,active:true});
await chrome.storage.session.set({unstoppableGithubAuthTab:authTab?.id||null,unstoppableGithubOriginTab:sender?.tab?.id||null});
sendResponse({ok:true,tabId:authTab?.id||null});
return;
}

if (message?.type ==="GITHUB_DEVICE_POLL") {
const result=await githubPollDeviceFlow({remember:message.remember !== false});
if(result?.ok){
const session=await chrome.storage.session.get(["unstoppableGithubAuthTab","unstoppableGithubOriginTab"]);
if(session.unstoppableGithubAuthTab){try{await chrome.tabs.remove(session.unstoppableGithubAuthTab);}catch{}}
if(session.unstoppableGithubOriginTab){try{const origin=await chrome.tabs.get(session.unstoppableGithubOriginTab);await chrome.tabs.update(origin.id,{active:true});if(origin.windowId!=null)await chrome.windows.update(origin.windowId,{focused:true});}catch{}}
await chrome.storage.session.remove(["unstoppableGithubAuthTab","unstoppableGithubOriginTab"]);
}
sendResponse(result);
return;
}

if (message?.type ==="GITHUB_REPOS") {
sendResponse(await githubListRepos());
return;
}

if (message?.type ==="GITHUB_BRANCHES") {
sendResponse(await githubListBranches(String(message.repo||"")));
return;
}

if (message?.type ==="GITHUB_FIND_LOVABLE_PROJECT") {
sendResponse(await githubFindLovableProject(String(message.projectId||""),Array.isArray(message.hints)?message.hints:[]));
return;
}

if (message?.type ==="GITHUB_PROBE") {
const probe=await githubProbeRepository(String(message.repo||""),String(message.branch||"main"));
if(probe?.ok && message.verifyWrite===true){
const write=await githubVerifyWriteCapability(String(message.repo||""));
sendResponse(write.ok?{...probe,canPush:true,writeVerified:true,writeProbeSha:write.blobSha}:{...probe,canPush:false,writeVerified:false,writeError:write.error,status:write.status||null});
} else sendResponse(probe);
return;
}

if (message?.type ==="GITHUB_DETECT_SUPABASE") {
sendResponse(await detectSupabaseFromGithub(String(message.repo||""),String(message.branch||"main")));
return;
}

if (message?.type ==="BIND_PROJECT") {
const projectKey=String(message.projectKey||"").trim();
const binding=message.binding && typeof message.binding ==="object" ? message.binding : null;
if(!projectKey || !binding?.repo || !binding?.branch) { sendResponse({ok:false,error:"INVALID_PROJECT_BINDING"}); return; }
const latest=await getConfig();
const projectBindings={...(latest.projectBindings || {}),[projectKey]:{...binding,updatedAt:Date.now()}};
const shared={
repo:binding.repo,
branch:binding.branch,
supabaseProjectId:binding.supabaseProjectId || null,
supabaseUrl:binding.supabaseUrl || null,
supabaseDashboardUrl:binding.supabaseDashboardUrl ||"https://supabase.com/dashboard/projects",
supabasePublishableKey:binding.supabasePublishableKey || null,
executorUrl:binding.executorUrl || null,
projectBindings
};
await chrome.storage.sync.set(shared);
sendResponse({ok:true,binding:projectBindings[projectKey]});
return;
}

if (message?.type ==="GET_LOVABLE_SYNC_NOTICE") {
const data=await chrome.storage.local.get("unstoppableLovableSyncNotice");
sendResponse({ok:true,notice:data.unstoppableLovableSyncNotice || null});
return;
}

if (message?.type ==="CLEAR_LOVABLE_SYNC_NOTICE") {
await chrome.storage.local.remove("unstoppableLovableSyncNotice");
sendResponse({ok:true});
return;
}

if (message?.type ==="GET_LICENSE_STATUS") {
const context=licenseContextFromSender(sender);
sendResponse(await getLicenseStatus(config,{force:!!message.force,context}));
return;
}

if (message?.type ==="ACTIVATE_LICENSE") {
const context=licenseContextFromSender(sender);
sendResponse(await activateLicense(config,message.licenseKey,context));
return;
}

if (message?.type ==="GET_ACCOUNT_STATS") {
const context=licenseContextFromSender(sender);
const status = await getLicenseStatus(config,{force:!!message.force,context});
sendResponse(status);
return;
}

if (message?.type ==="OPEN_SUPPORT") {
const supportUrl="https://hfxigagycrchhhzytgli.supabase.co/functions/v1/uc-support";
const url=`${supportUrl}?source=${encodeURIComponent(String(message.source||"extension"))}`;
const tab=await chrome.tabs.create({url,active:true});
sendResponse({ok:true,tabId:tab?.id||null});
return;
}

if (message?.type ==="CHAT_STATUS") {
sendResponse(await chatStatus());
return;
}

if (message?.type ==="CONNECT_CHAT") {
const result = await connectProvider("chatgpt",config,{repair:!!message.repair});
sendResponse(result);
return;
}

if (message?.type ==="PROVIDER_STATUS") {
sendResponse(await providerStatus(String(message.provider || config.provider ||"auto"),config));
return;
}

if (message?.type ==="CONNECT_PROVIDER") {
sendResponse(await connectProvider(String(message.provider || config.provider ||"auto"),config,{repair:!!message.repair,fresh:!!message.fresh}));
return;
}

if (message?.type ==="SUPA_TEST_CONFIG") {
const url=normalize(String(message.url||""));
const key=String(message.key||"").trim();
if(!url || !key){sendResponse({ok:false,error:"SUPABASE_CONFIG_REQUIRED"});return;}
try{
const response=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key}});
const body=await response.text().catch(()=>"");
sendResponse(response.ok?{ok:true,status:response.status}:{ok:false,status:response.status,error:body.slice(0,240)||`HTTP_${response.status}`});
}catch(error){sendResponse({ok:false,error:"SUPABASE_NETWORK_ERROR",detail:String(error)});}
return;
}

if (message?.type ==="SUPA_STATUS") {
sendResponse(await supabaseStatus(config));
return;
}

if (message?.type ==="SUPABASE_MANAGEMENT_CONNECT") {
sendResponse(await supabaseManagementConnect(String(message.projectRef||""),String(message.token||""),{remember:message.remember===true}));
return;
}

if (message?.type ==="SUPABASE_MANAGEMENT_STATUS") {
sendResponse(await supabaseManagementStatus(String(message.projectRef||"") || null));
return;
}

if (message?.type ==="SUPABASE_MANAGEMENT_DISCONNECT") {
await setSupabaseManagementAuth(null);
sendResponse({ok:true,connected:false});
return;
}

if (message?.type ==="SUPA_LOGIN") {
sendResponse(await supabaseLogin(config,String(message.email||"").trim(),String(message.password||"")));
return;
}

if (message?.type ==="SUPA_LOGOUT") {
await chrome.storage.session.remove("unstoppableSupaSession");
sendResponse({ok:true});
return;
}

if (message?.type ==="SUPA_SESSION") {
const session = await getSupabaseSession(config);
sendResponse({ok:true,authenticated:!!session,user:session?.user || null});
return;
}

if (message?.type ==="PROVIDERS_STATUS") {
sendResponse(await callExecutor(config,{action:"providers"}));
return;
}

if (message?.type ==="LOCAL_BRIDGE_STATUS") {
sendResponse(await localBridgeStatus());
return;
}

if (message?.type ==="EXECUTE") {
const licensed = await getLicenseStatus(config,{force:true,context:licenseContextFromSender(sender)});
if (!licensed?.ok || !licensed?.active) { sendResponse({ok:false,error:"LICENSE_REQUIRED"}); return; }
const provider = String(message.provider || config.provider ||"chatgpt");
const requestId = message.requestId || crypto.randomUUID();
const requiresLovableSync=!!message.lovableProjectId && message.requireLovableGitSync !== false;
const syncRepo=String(message.lovableGitRepo||"").trim();
const syncBranch=String(message.lovableGitBranch||"").trim();
const syncMismatch=requiresLovableSync && message.lovableGitSyncConfirmed === true && (
syncRepo!==String(message.repo||"").trim() ||
(!!syncBranch && syncBranch!==String(message.branch||"").trim())
);
if(syncMismatch){
await saveExecution({requestId,provider,repo:message.repo,branch:message.branch,originTabId:sender.tab?.id||null,lovableProjectId:message.lovableProjectId||null,stage:"erro",text:`O vínculo Lovable não corresponde ao destino da execução. Lovable: ${syncRepo||"?"} · ${syncBranch||"?"}. Extensão: ${message.repo||"?"} · ${message.branch||"?"}. Redetecte o Git Sync antes de editar.`,progress:2,done:true,error:"LOVABLE_GIT_SYNC_MISMATCH"});
sendResponse({ok:false,requestId,error:"LOVABLE_GIT_SYNC_MISMATCH"}); return;
}
if(requiresLovableSync && message.lovableGitSyncConfirmed !== true){
await saveExecution({
requestId,provider,repo:message.repo,branch:message.branch,originTabId:sender.tab?.id || null,
lovableProjectId:message.lovableProjectId || null,previewUrl:message.previewUrl || null,
stage:"erro",text:"O projeto Lovable ainda não possui Git sync nativo confirmado com o mesmo repositório. Conecte o projeto em Project settings → Git → GitHub antes de executar alterações que precisam aparecer no preview.",
progress:2,done:true,error:"LOVABLE_GIT_SYNC_REQUIRED"
});
sendResponse({ok:false,requestId,error:"LOVABLE_GIT_SYNC_REQUIRED"});
return;
}

if(message.repo){
const writeProbe=await githubVerifyWriteCapability(String(message.repo||""));
if(!writeProbe.ok){
await saveExecution({requestId,provider,repo:message.repo,branch:message.branch,originTabId:sender.tab?.id||null,lovableProjectId:message.lovableProjectId||null,stage:"erro",text:"A extensão não possui permissão real de escrita GitHub para este repositório. Reconecte o GitHub com Contents: Read and write / repo antes de enviar o comando à IA.",progress:3,done:true,error:writeProbe.error||"GITHUB_WRITE_PERMISSION_REQUIRED",writeProbe});
sendResponse({ok:false,requestId,error:writeProbe.error||"GITHUB_WRITE_PERMISSION_REQUIRED"}); return;
}
await persistBrokerJob(requestId,{state:"write_preflight_verified",writeProbeSha:writeProbe.blobSha||null}).catch(()=>null);
}

await saveExecution({
requestId,
provider,
repo:message.repo,
branch:message.branch,
lovableProjectId:message.lovableProjectId || null,
previewUrl:message.previewUrl || null,
publishedUrl:message.publishedUrl || null,
lovableGitSyncConfirmed:message.lovableGitSyncConfirmed === true,
originTabId:sender.tab?.id || null,
originIncognito:!!sender.tab?.incognito,
originalPrompt:String(message.prompt ||""),
attachmentCount:(Array.isArray(message.attachments)?message.attachments.length:0)+(Array.isArray(message.images)?message.images.length:0),
stage:"iniciando",
text:"Preparando contexto, projeto e skills...",
progress:5,
done:false,
error:null
});
await persistBrokerJob(requestId,{state:"started",provider,repo:message.repo,branch:message.branch,lovableProjectId:message.lovableProjectId||null,previewUrl:message.previewUrl||null,publishedUrl:message.publishedUrl||null,originalPrompt:String(message.prompt||"")}).catch(()=>null);

if (provider ==="deepseek-local") {
await saveExecution({
requestId,
stage:"processando",
text:"DeepSeek Local está analisando e executando a solicitação...",
progress:30,
done:false
});

const result = await localBridge({
requestId,
repo:message.repo,
branch:message.branch,
prompt:message.prompt,
attachments:[...(message.images || []), ...(message.attachments || [])]
}, async event => {
const progress = Math.max(30,Math.min(98,Number(event.progress || 30)));
await saveExecution({
requestId,
provider:"deepseek-local",
stage:event.stage ||"executando",
text:event.text || event.message ||"DeepSeek Local em execução...",
progress,
source:"local-bridge",
activity:event.activity || event.step || null,
done:false,
error:null
});
});

await saveExecution({
requestId,
provider:"deepseek-local",
stage:result.ok ?"concluido" :"erro",
text:result.ok ?"DeepSeek Local concluiu e enviou ao GitHub." : result.error,
response:result,
progress:result.ok ? 100 : 72,
done:true,
error:result.ok ? null : result.error
});
sendResponse({...result,requestId});
return;
}

let brokeredPrompt = String(message.prompt ||"");
let repoContext = null;
let brokerAttachments = [];
if (["chatgpt","auto","gemini","claude","deepseek"].includes(provider)) {
await saveExecution({
requestId,
stage:"preparando",
text:"Validando o repositório pela conexão GitHub da própria extensão...",
progress:9,
done:false,
githubBroker:true
});
const repoProbe=await githubProbeRepository(message.repo,message.branch);
if(!repoProbe.ok){
const detail=repoProbe.error==="GITHUB_EXTENSION_REPO_NOT_AUTHORIZED"
?"A conexão GitHub da extensão não tem acesso a este repositório. Reconecte o GitHub pela Central de Conexões e autorize o repositório correto."
: repoProbe.error==="GITHUB_BRANCH_NOT_FOUND"
?"A branch configurada não existe ou não está acessível pela conexão GitHub da extensão."
: (repoProbe.error ||"Falha ao validar o repositório pela extensão.");
await saveExecution({requestId,provider,stage:"erro",text:detail,progress:10,done:true,error:repoProbe.error ||"GITHUB_REPO_UNAVAILABLE",githubBroker:true});
sendResponse({ok:false,requestId,error:repoProbe.error ||"GITHUB_REPO_UNAVAILABLE",githubBroker:true,status:repoProbe.status || null});
return;
}

if(repoProbe.canPush === false){
const detail="A conexão GitHub da extensão consegue ler o repositório, mas o GitHub declarou que ela não possui permissão de escrita. Autorize Contents: Read and write (Fine-grained Token) ou reconecte pelo OAuth da Unstoppable Corp antes de enviar o comando.";
await saveExecution({requestId,provider,stage:"erro",text:detail,progress:10,done:true,error:"GITHUB_WRITE_PERMISSION_REQUIRED",githubBroker:true});
sendResponse({ok:false,requestId,error:"GITHUB_WRITE_PERMISSION_REQUIRED",githubBroker:true});
return;
}
await saveExecution({
requestId,
stage:"preparando",
text:`GitHub validado pela extensão. Carregando contexto de ${message.repo}@${message.branch}...`,
progress:11,
done:false,
githubBroker:true,
githubCanPush:!!repoProbe.canPush
});
repoContext=await githubBuildRepositoryContext(message.repo,message.branch,message.prompt,{round:0});
if(!repoContext.ok){
await saveExecution({requestId,provider,stage:"erro",text:repoContext.error ||"Não foi possível montar o contexto do repositório.",progress:12,done:true,error:repoContext.error ||"GITHUB_CONTEXT_FAILED",githubBroker:true});
sendResponse({ok:false,requestId,error:repoContext.error ||"GITHUB_CONTEXT_FAILED",githubBroker:true});
return;
}
brokeredPrompt =`${String(message.prompt ||"")}\n\n${githubContextPrompt(repoContext)}\n\n${ucChangesetProtocol()}`;
brokerAttachments = Array.isArray(repoContext.imageAttachments) ? repoContext.imageAttachments : [];
await saveExecution({
requestId,
stage:"preparando",
text:`Contexto GitHub pronto pela extensão · ${repoContext.files.length} arquivo(s) · ${Math.round(repoContext.charCount/1024)} KB de código selecionado.`,
progress:13,
done:false,
githubBroker:true,
githubCanPush:!!repoContext.probe?.canPush,
githubHeadSha:repoContext.headSha,
brokerRound:0,
brokerCommits:[],
brokerChangedFiles:[],
brokerContextPaths:repoContext.files.map(x=>x.path)
});
}

if (provider ==="chatgpt" || provider ==="auto") {
await saveExecution({
requestId,
stage:"conectando",
text:"Conectando à sessão do ChatGPT...",
progress:14,
done:false
});

let ready = await ensureChatReady({interactive:false,repair:false,timeout:12000,waitForLogin:false,freshTab:false,backgroundCreate:true});
if(!ready?.ready && ready?.state!=="login_required" && ready?.state!=="busy") {
ready = await ensureChatReady({interactive:false,repair:true,timeout:10000,waitForLogin:false,freshTab:false,backgroundCreate:true});
}
if (ready?.ready && ready?.tabId) {
const combinedAttachments=[...(message.images || []), ...(message.attachments || []), ...brokerAttachments];
const prepared=ucPrepareChatPayload(brokeredPrompt,combinedAttachments,`round-${Number(repoContext?.round||0)}`);
const result = await chrome.tabs.sendMessage(ready.tabId,{
type:CHAT_EXECUTE_MESSAGE,
requestId,
prompt:prepared.prompt,
attachments:prepared.attachments,
images:prepared.attachments.filter(item=>String(item?.mimeType||"").startsWith("image/")),
autoSubmit:true,
largeContextExternalized:!!prepared.externalized
});
if (result?.ok) {
await saveExecution({
requestId,
provider:"ChatGPT",
stage:"enviado",
text:"Solicitação entregue ao ChatGPT. Aguardando processamento...",
progress:22,
done:false
});
sendResponse({ok:true,requestId,provider:"chatgpt",background:true});
return;
}
if (provider ==="chatgpt") {
await saveExecution({
requestId,
stage:"erro",
text:result?.error ||"Falha no ChatGPT",
progress:18,
done:true,
error:result?.error ||"CHATGPT_FAILED"
});
sendResponse({ok:false,requestId,error:result?.error ||"CHATGPT_FAILED"});
return;
}
}

if (provider ==="chatgpt") {
const retryError = ready?.state ==="busy" ?"CHATGPT_BUSY"
: ready?.state ==="login_required" ?"CHATGPT_LOGIN_REQUIRED"
:"CHATGPT_NOT_CONNECTED";

await saveExecution({
requestId,
provider:"ChatGPT",
stage:retryError ==="CHATGPT_BUSY" ?"aguardando" :"conectando",
text:retryError ==="CHATGPT_BUSY"
?"ChatGPT conectado. A resposta atual ainda está em andamento; aguardando a sessão ficar livre."
: retryError ==="CHATGPT_LOGIN_REQUIRED"
?"A sessão ChatGPT precisa de login antes do envio."
:"A sessão ChatGPT ainda não está pronta.",
progress:retryError ==="CHATGPT_BUSY" ? 8 : 6,
done:false,
error:null
});

sendResponse({
ok:false,
requestId,
error:retryError,
retryable:true,
waitable:retryError ==="CHATGPT_BUSY"
});
return;
}
}

let lastWebFailure = null;
if (["gemini","claude","deepseek"].includes(provider) || provider ==="auto") {
const webRoutes = provider ==="auto" ? ["gemini","claude","deepseek"] : [provider];
for (const route of webRoutes) {
let readyWeb = await ensureWebAiReady(route,{interactive:false,repair:false,timeout:8000,backgroundCreate:provider!=="auto"});
if(!readyWeb?.ready && provider !=="auto") {
const useFresh = !readyWeb?.tabId || ["busy","not_ready","bridge_loading","missing"].includes(String(readyWeb?.state||""));
readyWeb = await ensureWebAiReady(route,{interactive:true,repair:false,timeout:90000,freshTab:useFresh,waitForLogin:true});
}
if (!readyWeb?.ready) { lastWebFailure = readyWeb; continue; }
await saveExecution({
requestId,
provider:route,
stage:"conectando",
text:`Sessão ${route} conectada. Enviando o comando...`,
progress:18,
done:false
});
const webResult = await executeWebAi(route,{requestId,prompt:brokeredPrompt});
if (webResult?.ok) {
await saveExecution({
requestId,
provider:route,
stage:"enviado",
text:`Comando enviado ao ${route}. Acompanhando a resposta em tempo real...`,
progress:28,
done:false
});
sendResponse({ok:true,requestId,provider:route,background:true,route:"web-session"});
return;
}
lastWebFailure = webResult;
if (provider !=="auto") break;
}
}

if (["gemini","claude","deepseek"].includes(provider) && (!config.executorUrl || !config.supabasePublishableKey)) {
const error = lastWebFailure?.error ||"AI_NOT_CONNECTED";
await saveExecution({requestId,provider,stage:"erro",text:error,progress:20,done:true,error});
sendResponse({ok:false,requestId,provider,error,state:lastWebFailure?.state || null});
return;
}

const executorProvider = provider ==="auto" ?"auto" : provider;
await saveExecution({
requestId,
provider:executorProvider,
stage:"processando",
text:`${executorProvider ==="auto" ?"Executor Multi-IA" : executorProvider} recebeu a solicitação e está preparando o contexto...`,
progress:34,
done:false
});

await saveExecution({
requestId,
provider:executorProvider,
stage:"executando",
text:"Contexto validado. A IA está analisando arquivos e preparando as alterações...",
progress:46,
done:false
});

const result = await callExecutor(config,{
action:"execute",
provider:executorProvider,
repo:message.repo,
branch:message.branch,
prompt:message.prompt,
skills:message.skills || [],
attachments:message.attachments || [],
images:message.images || []
}, async event => {
const progress = Math.max(34,Math.min(98,Number(event.progress || 34)));
await saveExecution({
requestId,
provider:event.provider || executorProvider,
stage:event.stage ||"executando",
text:event.text || event.message ||"A IA está executando a solicitação...",
progress,
source:"executor-stream",
activity:event.activity || event.step || null,
done:false,
error:null
});
});

await saveExecution({
requestId,
provider:result.provider || executorProvider,
stage:result.ok ?"concluido" :"erro",
text:result.ok ?`Alteração concluída com ${result.provider || executorProvider}.` : result.error,
response:result,
progress:result.ok ? 100 : 76,
done:true,
error:result.ok ? null : result.error
});
sendResponse({...result,requestId});
return;
}

if (message?.type ==="CHAT_BRIDGE_STATUS") {
const current=(await chrome.storage.local.get("unstoppableLastExecution")).unstoppableLastExecution;
const same=current?.requestId===message.requestId;
const brokered=!!(same && current?.githubBroker);

if(!brokered || !message.done || message.error){
await saveExecution({
requestId:message.requestId,
provider:"ChatGPT",
stage:message.stage,
text:message.text,
progress:message.progress,
responseText:message.responseText ||"",
source:message.source ||"chatgpt-dom",
activity:message.activity || null,
activityRevision:Number(message.activityRevision || 0),
done:!!message.done,
error:message.error || null
});
sendResponse({ok:true});
return;
}

const responseText=String(message.responseText ||"");
await persistBrokerJob(message.requestId,{state:"response_received",responseText,receivedAt:Date.now(),repo:current?.repo||null,branch:current?.branch||null,githubHeadSha:current?.githubHeadSha||null}).catch(()=>null);
const parseResult=extractUcChangesetDetailed(responseText);
const changeset=parseResult?.ok ? parseResult.changeset : null;
const round=Number(current?.brokerRound || 0);
const originalPrompt=String(current?.originalPrompt ||"");
const cumulativeCommits=Array.isArray(current?.brokerCommits)?[...current.brokerCommits]:[];
const cumulativeFiles=Array.isArray(current?.brokerChangedFiles)?[...current.brokerChangedFiles]:[];

const sendContinuation=async(prompt,{stage="preparando",text="Continuando a implementação automaticamente...",activity="Continuando implementação",extraState={},attachments=[]}={})=>{
const ready=await ensureChatReady({interactive:false,repair:false,timeout:7000});
if(!ready?.ready || !ready?.tabId) return {ok:false,error:"CHATGPT_NOT_CONNECTED"};
await saveExecution({
requestId:message.requestId,
provider:"ChatGPT",
stage,
text,
progress:Math.min(96,84+Math.max(0,round)*2),
source:"github-broker",
done:false,
activity,
brokerRound:round+1,
...extraState
});
const prepared=ucPrepareChatPayload(prompt,attachments||[],`continuation-${round+1}`);
const sent=await chrome.tabs.sendMessage(ready.tabId,{type:CHAT_EXECUTE_MESSAGE,requestId:message.requestId,prompt:prepared.prompt,attachments:prepared.attachments,images:prepared.attachments.filter(x=>String(x?.mimeType||"").startsWith("image/")),autoSubmit:true,largeContextExternalized:!!prepared.externalized});
if(!sent?.ok) return {ok:false,error:sent?.error ||"CHATGPT_CONTINUATION_FAILED"};
return {ok:true};
};

await persistBrokerJob(message.requestId,{state:changeset?"parsed":"parse_failed",parser:parseResult?.parserVersion||null,protocol:changeset?.protocol||null,filesDeclared:changeset?.files?.length||0,needsFiles:changeset?.needs_files||[],parseError:changeset?null:(parseResult?.error||"AI_CHANGESET_NOT_FOUND")}).catch(()=>null);

if(changeset?.needs_files?.length){
if(round>=UC_CONTEXT_MAX_ROUNDS){
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:"A implementação atingiu o limite de ciclos automáticos de contexto. Nenhum novo commit foi feito nesta etapa.",progress:97,responseText:responseText.slice(0,80000),done:true,error:"BROKER_CONTEXT_ROUND_LIMIT",source:"github-broker",brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles});
sendResponse({ok:false,error:"BROKER_CONTEXT_ROUND_LIMIT"});
return;
}
await saveExecution({
requestId:message.requestId,
provider:"ChatGPT",
stage:"preparando",
text:`A IA pediu ${changeset.needs_files.length} caminho(s). A extensão está expandindo arquivos e diretórios no GitHub automaticamente...`,
progress:86,
responseText:responseText.slice(0,80000),
source:"github-broker",
done:false,
activity:"Resolvendo contexto adicional do repositório"
});
const extra=await githubBuildRepositoryContext(current.repo,current.branch,originalPrompt,{requestedPaths:changeset.needs_files,excludePaths:Array.isArray(current?.brokerContextPaths)?current.brokerContextPaths:[],round:round+1});
if(!extra.ok){
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:extra.error ||"Falha ao ler o contexto adicional do GitHub.",progress:95,done:true,error:extra.error ||"GITHUB_CONTEXT_FAILED",source:"github-broker",brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles});
sendResponse({ok:false,error:extra.error ||"GITHUB_CONTEXT_FAILED"});
return;
}
const unresolved=(extra.requestSpecs||[]).filter(x=>!x.matchCount);
const follow=`[UC_AUTONOMOUS_CONTINUATION]\nTAREFA ORIGINAL DO USUÁRIO:\n${originalPrompt}\n\nA extensão resolveu automaticamente o pedido de contexto abaixo:\n${JSON.stringify(changeset.needs_files)}\n${unresolved.length?`Alguns caminhos literais não existem no repositório. NÃO pare: use o mapa/árvore para identificar os caminhos reais equivalentes. Não repita os mesmos caminhos ausentes.\nCaminhos não resolvidos: ${JSON.stringify(unresolved)}\n`:""}\nContinue a implementação completa. Não faça apenas diagnóstico e não peça ao usuário arquivos que já estão no GitHub. Quando tiver contexto suficiente, produza alterações reais.\n\n${githubContextPrompt(extra,{continuation:true})}\n\n${ucChangesetProtocol()}\n[/UC_AUTONOMOUS_CONTINUATION]`;
const sent=await sendContinuation(follow,{
text:`Contexto adicional carregado · ${extra.files.length} arquivo(s) · ${Math.round(extra.charCount/1024)} KB. A IA continuará automaticamente.`,
activity:"Implementando com contexto expandido",
attachments:extra.imageAttachments || [],
extraState:{brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles,githubHeadSha:extra.headSha,brokerContextPaths:[...new Set([...(Array.isArray(current?.brokerContextPaths)?current.brokerContextPaths:[]),...extra.files.map(x=>x.path)])]}
});
if(!sent.ok){
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:"O ChatGPT deixou de estar disponível durante a continuação automática.",progress:95,done:true,error:sent.error,source:"github-broker",brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles});
sendResponse({ok:false,error:sent.error});
return;
}
sendResponse({ok:true,continued:true,requestedFiles:changeset.needs_files,resolved:extra.requestSpecs||[]});
return;
}

if(!changeset){
if(round<UC_CONTEXT_MAX_ROUNDS){
const correction=`[UC_PROTOCOL_REPAIR_V3]\nTAREFA ORIGINAL:\n${originalPrompt}\n\nA resposta anterior não pôde ser interpretada pelo parser V3 da extensão. Diagnóstico: ${JSON.stringify({error:parseResult?.error||"AI_CHANGESET_NOT_FOUND",v3Error:parseResult?.v3Error||null,legacyError:parseResult?.legacyError||null})}.\nNão use XML/HTML para os marcadores. Use exatamente as linhas UC_CHANGESET_V3_BEGIN, UC_META_BEGIN, UC_META_END, UC_FILE_BEGIN|upsert|caminho, UC_FILE_END e UC_CHANGESET_V3_END. Não use o conector GitHub nativo da conversa. Continue a tarefa e produza IMPLEMENTAÇÃO real.\n\n${ucChangesetProtocol()}\n[/UC_PROTOCOL_REPAIR_V3]`;
const sent=await sendContinuation(correction,{stage:"validando",text:"A resposta veio sem changeset. A extensão está corrigindo o protocolo automaticamente...",activity:"Solicitando implementação estruturada",extraState:{responseText:responseText.slice(0,80000),brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles}});
if(sent.ok){sendResponse({ok:true,continued:true,protocolRepair:true});return;}
}
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:`O parser V3 não encontrou um payload aplicável. Diagnóstico: ${parseResult?.v3Error||parseResult?.legacyError||parseResult?.error||"formato desconhecido"}. Nenhum commit foi criado nesta resposta.`,progress:97,responseText:responseText.slice(0,140000),done:true,error:"AI_CHANGESET_NOT_FOUND",source:"github-broker",brokerParser:parseResult,brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles});
sendResponse({ok:false,error:"AI_CHANGESET_NOT_FOUND"});
return;
}

if(!(changeset.files||[]).length && changeset.task_complete && !cumulativeCommits.length && ucPromptLikelyRequiresMutation(originalPrompt) && !current?.brokerNoChangeReview){
const fresh=await githubBuildRepositoryContext(current.repo,current.branch,originalPrompt,{round:round+1});
if(fresh.ok){
const follow=`[UC_NO_CHANGE_REVIEW]\nTAREFA ORIGINAL:\n${originalPrompt}\n\nVocê marcou a tarefa como concluída sem gerar arquivos, mas o pedido do usuário exige mutação do projeto. Revise o HEAD real abaixo e implemente as alterações necessárias. Só retorne task_complete=true com files=[] se o repositório JÁ atender integralmente ao pedido; nesse caso explique isso objetivamente em summary.\n\n${githubContextPrompt(fresh,{continuation:true})}\n\n${ucChangesetProtocol()}\n[/UC_NO_CHANGE_REVIEW]`;
const sent=await sendContinuation(follow,{text:"A IA não gerou arquivos para um pedido de implementação. Revisando o projeto uma vez antes de encerrar...",activity:"Revisando alterações obrigatórias",extraState:{brokerNoChangeReview:true,githubHeadSha:fresh.headSha,brokerContextPaths:fresh.files.map(x=>x.path)}});
if(sent.ok){sendResponse({ok:true,continued:true,noChangeReview:true});return;}
}
}

if(!(changeset.files||[]).length && changeset.task_complete && !cumulativeCommits.length && ucPromptLikelyRequiresMutation(originalPrompt) && current?.brokerNoChangeReview){
await saveExecution({
requestId:message.requestId,provider:"ChatGPT",stage:"erro",
text:"O ChatGPT encerrou a tarefa sem produzir nenhum arquivo aplicável mesmo após a revisão automática. Nenhum commit foi criado. A extensão não vai declarar sucesso sem alteração real no GitHub.",
progress:97,responseText:responseText.slice(0,140000),done:true,error:"AI_RETURNED_NO_CHANGES_FOR_MUTATION",source:"github-broker",
brokerParser:parseResult,brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles
});
sendResponse({ok:false,error:"AI_RETURNED_NO_CHANGES_FOR_MUTATION"});
return;
}

if(!(changeset.files||[]).length && !changeset.task_complete){
if(round>=UC_CONTEXT_MAX_ROUNDS){
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:"A IA manteve trabalho pendente sem gerar alterações até atingir o limite de ciclos automáticos.",progress:97,done:true,error:"BROKER_IMPLEMENTATION_ROUND_LIMIT",source:"github-broker",brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles});
sendResponse({ok:false,error:"BROKER_IMPLEMENTATION_ROUND_LIMIT"});
return;
}
const fresh=await githubBuildRepositoryContext(current.repo,current.branch,`${originalPrompt}\n${(changeset.remaining_work||[]).join("\n")}`,{round:round+1});
if(!fresh.ok){sendResponse({ok:false,error:fresh.error||"GITHUB_CONTEXT_FAILED"});return;}
const follow=`[UC_AUTONOMOUS_IMPLEMENTATION_NEXT_ROUND]\nTAREFA ORIGINAL:\n${originalPrompt}\n\nTRABALHO AINDA PENDENTE INFORMADO POR VOCÊ:\n${JSON.stringify(changeset.remaining_work||[])}\n\nVocê ainda não gerou arquivos neste ciclo. Prossiga agora com uma implementação concreta. Crie os arquivos necessários; não pare apenas para explicar.\n\n${githubContextPrompt(fresh,{continuation:true})}\n\n${ucChangesetProtocol()}\n[/UC_AUTONOMOUS_IMPLEMENTATION_NEXT_ROUND]`;
const sent=await sendContinuation(follow,{text:"A IA indicou trabalho pendente. Recarregando o projeto e avançando para a próxima etapa automaticamente...",activity:"Gerando próximo lote de implementação",extraState:{brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles,githubHeadSha:fresh.headSha,brokerContextPaths:[...new Set([...(Array.isArray(current?.brokerContextPaths)?current.brokerContextPaths:[]),...fresh.files.map(x=>x.path)])]}});
if(sent.ok){sendResponse({ok:true,continued:true,nextRound:true});return;}
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:"Não foi possível continuar a implementação no ChatGPT.",progress:96,done:true,error:sent.error,source:"github-broker",brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles});
sendResponse({ok:false,error:sent.error});
return;
}

await saveExecution({
requestId:message.requestId,
provider:"ChatGPT",
stage:"validando",
text:`Payload ${changeset.protocol||"V3"} validado. Aplicando ${(changeset.files||[]).length} arquivo(s) diretamente no GitHub e verificando o commit...`,
progress:92,
responseText:responseText.slice(0,140000),
source:"github-broker",
activity:"Criando commit GitHub",
done:false
});
await persistBrokerJob(message.requestId,{state:"applying",applyStartedAt:Date.now(),baseHeadSha:current?.githubHeadSha||null,files:(changeset.files||[]).map(f=>({path:f.path,action:f.action}))}).catch(()=>null);
const applied=await githubApplyChangeset(current.repo,current.branch,changeset,{expectedHeadSha:current?.githubHeadSha || null});
if(!applied.ok){
await persistBrokerJob(message.requestId,{state:"apply_failed",error:applied.error||"GITHUB_COMMIT_FAILED",detail:applied.detail||null,status:applied.status||null,commitShaUnreferenced:applied.commitShaUnreferenced||null}).catch(()=>null);
if(/^AI_CHANGESET_(?:MARKDOWN_FENCE_IN_SOURCE|PROTOCOL_MARKER_IN_SOURCE)/.test(String(applied.error||"")) && round<UC_CONTEXT_MAX_ROUNDS){
const correction=`[UC_SOURCE_REPAIR]
TAREFA ORIGINAL:
${originalPrompt}

O lote anterior foi REJEITADO antes de tocar no GitHub porque o conteúdo de ${applied.path||"um arquivo"} continha artefatos de renderização (${applied.error}). Regenere o mesmo lote a partir do contexto já fornecido. Envolva cada arquivo em UM ÚNICO code fence externo conforme o protocolo; não coloque fences dentro do código; preserve URLs, regex, barras invertidas e aspas literalmente.

${ucChangesetProtocol()}
[/UC_SOURCE_REPAIR]`;
const sent=await sendContinuation(correction,{stage:"validando",text:"O código retornado continha artefatos de renderização. Solicitando uma versão limpa antes de escrever no GitHub...",activity:"Reparando integridade do código",extraState:{brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles}});
if(sent.ok){sendResponse({ok:true,continued:true,sourceRepair:true,error:applied.error,path:applied.path||null});return;}
}
if(applied.error==="GITHUB_HEAD_CHANGED" && round<UC_CONTEXT_MAX_ROUNDS){
const fresh=await githubBuildRepositoryContext(current.repo,current.branch,originalPrompt,{round:round+1});
if(fresh.ok){
const follow=`[UC_REBASE_REQUIRED]\nTAREFA ORIGINAL:\n${originalPrompt}\n\nO repositório mudou enquanto você analisava. Nenhum arquivo do changeset anterior foi aplicado. Regenere o lote contra o HEAD atual ${fresh.headSha}; preserve as mudanças que já chegaram ao repositório.\n\n${githubContextPrompt(fresh,{continuation:true})}\n\n${ucChangesetProtocol()}\n[/UC_REBASE_REQUIRED]`;
const sent=await sendContinuation(follow,{stage:"preparando",text:"O GitHub recebeu alterações durante a análise. Recarregando o HEAD e refazendo o lote automaticamente...",activity:"Rebase automático de contexto",extraState:{githubHeadSha:fresh.headSha,brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles,brokerContextPaths:fresh.files.map(x=>x.path)}});
if(sent.ok){sendResponse({ok:true,continued:true,rebase:true,currentHeadSha:fresh.headSha});return;}
}
}
const copy=applied.error==="GITHUB_WRITE_PERMISSION_REQUIRED"
?"O GitHub da extensão consegue ler o repositório, mas não possui permissão de escrita. Reconecte com acesso Contents: Read and write / repo."
: applied.error==="GITHUB_HEAD_CHANGED"
?"O repositório mudou enquanto a IA analisava e não foi possível refazer o lote automaticamente. Nenhum arquivo desta resposta foi aplicado."
: applied.error ||"Falha ao aplicar o changeset no GitHub.";
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:copy,progress:98,responseText:responseText.slice(0,140000),done:true,error:applied.error ||"GITHUB_COMMIT_FAILED",source:"github-broker",commitResult:applied,brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles});
sendResponse({ok:false,error:applied.error ||"GITHUB_COMMIT_FAILED"});
return;
}

await persistBrokerJob(message.requestId,{state:"commit_verified",commitSha:applied.commitSha||null,verified:!!applied.verified,verification:applied.verification||null,appliedAt:Date.now()}).catch(()=>null);
if(applied.commitSha) cumulativeCommits.push(applied.commitSha);
for(const file of applied.files||[]){
if(!cumulativeFiles.some(x=>x.path===file.path && x.action===file.action)) cumulativeFiles.push(file);
}

let supabaseMigrationResult={ok:true,skipped:true,applied:[]};
if(applied.commitSha){
supabaseMigrationResult=await supabaseApplyCommittedMigrations({
repo:current.repo,
commitSha:applied.commitSha,
files:applied.files||[],
projectRef:config.supabaseProjectId || current?.supabaseProjectId || null
}).catch(error=>({ok:false,error:"SUPABASE_MIGRATION_APPLY_FAILED",detail:String(error)}));
if(!supabaseMigrationResult.ok && supabaseMigrationResult.error!=="SUPABASE_MANAGEMENT_AUTH_REQUIRED"){
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:`O commit ${String(applied.commitSha).slice(0,8)} foi criado e verificado no GitHub, mas a migration Supabase não pôde ser aplicada: ${supabaseMigrationResult.detail || supabaseMigrationResult.error}.`,progress:98,done:true,error:supabaseMigrationResult.error,source:"github-broker",brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles,commitSha:applied.commitSha,supabaseMigrationResult});
sendResponse({ok:false,error:supabaseMigrationResult.error,partial:true,commitSha:applied.commitSha,commits:cumulativeCommits,files:cumulativeFiles,supabaseMigrationResult});
return;
}
}

if(!changeset.task_complete){
if(round>=UC_CONTEXT_MAX_ROUNDS){
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:`Foram aplicados ${cumulativeCommits.length} commit(s), mas a tarefa ainda foi marcada como incompleta ao atingir o limite de ciclos automáticos.`,progress:98,done:true,error:"BROKER_IMPLEMENTATION_ROUND_LIMIT",source:"github-broker",brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles,commitSha:applied.commitSha||null});
sendResponse({ok:false,error:"BROKER_IMPLEMENTATION_ROUND_LIMIT",commits:cumulativeCommits,files:cumulativeFiles});
return;
}
const fresh=await githubBuildRepositoryContext(current.repo,current.branch,`${originalPrompt}\n${(changeset.remaining_work||[]).join("\n")}`,{requestedPaths:(applied.files||[]).map(x=>x.path),round:round+1});
if(!fresh.ok){
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:fresh.error ||"O commit foi criado, mas não foi possível recarregar o repositório para continuar.",progress:98,done:true,error:fresh.error ||"GITHUB_CONTEXT_FAILED",source:"github-broker",brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles});
sendResponse({ok:false,error:fresh.error ||"GITHUB_CONTEXT_FAILED",commits:cumulativeCommits});
return;
}
const follow=`[UC_AUTONOMOUS_POST_COMMIT_CONTINUATION]\nTAREFA ORIGINAL:\n${originalPrompt}\n\nA extensão aplicou com sucesso o lote anterior no GitHub. Commit: ${applied.commitSha||"n/a"}.\nArquivos deste lote: ${JSON.stringify(applied.files||[])}\nTrabalho ainda pendente: ${JSON.stringify(changeset.remaining_work||[])}\n\nContinue até concluir TODA a solicitação. O contexto abaixo foi lido novamente do HEAD atualizado. Faça o próximo lote real e use task_complete=true somente quando todo o pedido estiver implementado.\n\n${githubContextPrompt(fresh,{continuation:true})}\n\n${ucChangesetProtocol()}\n[/UC_AUTONOMOUS_POST_COMMIT_CONTINUATION]`;
const sent=await sendContinuation(follow,{text:`Lote aplicado no GitHub · commit ${String(applied.commitSha||"").slice(0,8)}. Continuando automaticamente o restante da tarefa...`,activity:"Continuando após commit",extraState:{brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles,commitSha:applied.commitSha||null,changedFiles:cumulativeFiles,githubHeadSha:fresh.headSha,brokerContextPaths:[...new Set([...(Array.isArray(current?.brokerContextPaths)?current.brokerContextPaths:[]),...fresh.files.map(x=>x.path)])]}});
if(!sent.ok){
await saveExecution({requestId:message.requestId,provider:"ChatGPT",stage:"erro",text:"O lote foi salvo no GitHub, mas o ChatGPT não ficou disponível para continuar a próxima etapa.",progress:98,done:true,error:sent.error,source:"github-broker",brokerCommits:cumulativeCommits,brokerChangedFiles:cumulativeFiles,commitSha:applied.commitSha||null});
sendResponse({ok:false,error:sent.error,partial:true,commits:cumulativeCommits,files:cumulativeFiles});
return;
}
sendResponse({ok:true,continued:true,committed:!!applied.commitSha,commitSha:applied.commitSha||null,files:applied.files||[],remainingWork:changeset.remaining_work||[]});
return;
}

const supabaseNote=!supabaseMigrationResult?.ok && supabaseMigrationResult?.error==="SUPABASE_MANAGEMENT_AUTH_REQUIRED"
?" Migration Supabase versionada no GitHub, mas a execução administrativa aguarda um PAT próprio do usuário na Central de Conexões."
: (supabaseMigrationResult?.applied?.length ?` ${supabaseMigrationResult.applied.length} migration(s) Supabase aplicada(s) diretamente.` :"");
const finalText=cumulativeCommits.length
?`COMMIT_APPLIED: true · BRANCH: ${current.branch} · COMMIT_SHA: ${cumulativeCommits[cumulativeCommits.length-1]} · ${cumulativeCommits.length} commit(s) · ${cumulativeFiles.length} arquivo(s) alterado(s). GitHub verificado; aguardando o Git sync da Lovable.${supabaseNote}`
:"COMMIT_APPLIED: false · A IA concluiu sem alterações de arquivo. Nenhum commit foi criado.";
let usageEstimate=null;
if(cumulativeCommits.length){
usageEstimate=estimateLovableBuildCredits(originalPrompt,{files:cumulativeFiles,attachments:Number(current?.attachmentCount||0)});
await recordLicensedUsage(config,`${String(current?.provider||"ChatGPT")} · ${usageEstimate.label}`,usageEstimate.credits,current?.originIncognito?{incognito:true,tabId:current?.originTabId||null}:{}).catch(()=>null);
await persistBrokerJob(message.requestId,{state:"usage_recorded",usageEstimate}).catch(()=>null);
}
const lovableRefresh=cumulativeCommits.length ? await ucRefreshLovableTabsAfterCommit({
projectId:current?.lovableProjectId || null,
previewUrl:current?.previewUrl || null,
publishedUrl:current?.publishedUrl || null,
repo:current?.repo || null,
branch:current?.branch || null,
commitSha:cumulativeCommits[cumulativeCommits.length-1] || null,
files:cumulativeFiles
}) : {ok:true,reloaded:0};
await saveExecution({
requestId:message.requestId,
provider:"ChatGPT",
stage:"concluido",
text:lovableRefresh.reloaded ?`${finalText} Preview Lovable recarregado em ${lovableRefresh.reloaded} aba(s).` : finalText,
progress:100,
responseText:responseText.slice(0,140000),
done:true,
error:null,
source:"github-broker",
commitSha:cumulativeCommits[cumulativeCommits.length-1] || null,
brokerCommits:cumulativeCommits,
changedFiles:cumulativeFiles,
brokerChangedFiles:cumulativeFiles,
commitSummary:applied.summary || changeset.summary ||"",
usageEstimate,
lovableRefresh
});
await persistBrokerJob(message.requestId,{state:"done",doneAt:Date.now(),commits:cumulativeCommits,files:cumulativeFiles,lovableRefresh,usageEstimate}).catch(()=>null);
sendResponse({ok:true,committed:cumulativeCommits.length>0,commitSha:cumulativeCommits[cumulativeCommits.length-1] || null,commits:cumulativeCommits,files:cumulativeFiles,usageEstimate});
return;
}

if (message?.type ==="AI_BRIDGE_STATUS") {
await saveExecution({
requestId:message.requestId,
provider:String(message.provider ||"IA"),
stage:message.stage ||"processando",
text:message.text ||"",
progress:Number(message.progress || 0),
responseText:message.responseText ||"",
source:`${String(message.provider ||"ai")}-web`,
done:!!message.done,
error:message.error || null
});
sendResponse({ok:true});
return;
}

if (message?.type ==="GET_EXECUTION") {
const execution = await reconcileStaleExecution();
sendResponse({ok:true,execution});
return;
}

if (message?.type ==="DOWNLOAD_PROVIDER_GUIDE") {
const id = await chrome.downloads.download({
url:chrome.runtime.getURL("docs/GUIA-PREMIUM-IA-GITHUB-Unstoppable-Corp.pdf"),
filename:"UnstoppableCorp/GUIA-PREMIUM-IA-GITHUB-Unstoppable-Corp.pdf",
saveAs:true
});
sendResponse({ok:true,downloadId:id});
return;
}

if (message?.type ==="DOWNLOAD_REPO") {
const license=await getLicenseStatus(config,{force:true,context:licenseContextFromSender(sender)});
if(!license?.ok || !license?.active){sendResponse({ok:false,error:"LICENSE_REQUIRED"});return;}
const caps=license.capabilities||licenseCapabilities(license.role);
if(caps.download_project===false){sendResponse({ok:false,error:"FEATURE_NOT_AVAILABLE_FOR_LICENSE",feature:"download_project"});return;}
const url =`https://github.com/${message.repo}/archive/refs/heads/${encodeURIComponent(message.branch)}.zip`;
const id = await chrome.downloads.download({
url,
filename:`UnstoppableCorp/${message.repo.split("/").pop()}-${message.branch}.zip`,
saveAs:true
});
sendResponse({ok:true,downloadId:id});
return;
}

if (message?.type ==="OPEN_CONNECTION_CENTER") {
const targetUrl = config.lovableEditorUrl || config.previewUrl ||"https://lovable.dev/";
const projectId = config.lovableProjectId ||"";
const tabs = await chrome.tabs.query({url:["https://lovable.dev/*"]});
let tab = tabs.find(item => projectId && item.url?.includes(projectId)) || tabs[0];
if (tab?.id) {
await chrome.tabs.update(tab.id,{active:true});
if (tab.windowId != null) await chrome.windows.update(tab.windowId,{focused:true});
} else {
tab = await chrome.tabs.create({url:targetUrl,active:true});
if(tab?.id) await waitTabComplete(tab.id,20000).catch(()=>false);
}
if (tab?.id) {
try { await chrome.tabs.sendMessage(tab.id,{type:"UNSTOPPABLE_OPEN_CONNECTIONS"}); }
catch { try { await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]}); await new Promise(r=>setTimeout(r,350)); await chrome.tabs.sendMessage(tab.id,{type:"UNSTOPPABLE_OPEN_CONNECTIONS"}); } catch {} }
}
sendResponse({ok:true,tabId:tab?.id || null});
return;
}

if (message?.type ==="AUTO_CONNECT_ALL") {
const targetUrl = config.lovableEditorUrl || config.previewUrl ||"https://lovable.dev/";
const tabs = await chrome.tabs.query({url:["https://lovable.dev/*","https://*.lovable.app/*"]});
let tab = tabs.find(item => sender?.tab?.id && item.id === sender.tab.id) || tabs[0];
if (!tab?.id) {
tab = await chrome.tabs.create({url:targetUrl,active:true});
if (tab?.id) await waitTabComplete(tab.id,20000).catch(()=>false);
} else {
await chrome.tabs.update(tab.id,{active:true});
if (tab.windowId != null) await chrome.windows.update(tab.windowId,{focused:true});
}
if (tab?.id) {
try { await chrome.tabs.sendMessage(tab.id,{type:"UNSTOPPABLE_AUTO_CONNECT_ALL"}); }
catch {
try {
await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});
await new Promise(r=>setTimeout(r,450));
await chrome.tabs.sendMessage(tab.id,{type:"UNSTOPPABLE_AUTO_CONNECT_ALL"});
} catch {}
}
}
sendResponse({ok:true,tabId:tab?.id || null});
return;
}

if (message?.type ==="OPEN_PROJECT_GUIDE") {
const targetUrl = config.lovableEditorUrl || config.previewUrl ||"https://lovable.dev/";
const projectId = config.lovableProjectId ||"";
const tabs = await chrome.tabs.query({url:["https://lovable.dev/*"]});
let tab = tabs.find(item => item.url?.includes(projectId)) || tabs[0];
if (tab?.id) {
await chrome.tabs.update(tab.id,{active:true,url:targetUrl});
if (tab.windowId != null) await chrome.windows.update(tab.windowId,{focused:true});
} else {
tab = await chrome.tabs.create({url:targetUrl,active:true});
}
if (tab?.id) {
await waitTabComplete(tab.id,20000).catch(()=>false);
try { await chrome.tabs.sendMessage(tab.id,{type:"UNSTOPPABLE_OPEN_PROVIDER_GUIDE"}); } catch {}
}
sendResponse({ok:true,tabId:tab?.id || null});
return;
}

if (message?.type ==="OPEN_URL") {
await chrome.tabs.create({url:message.url});
sendResponse({ok:true});
return;
}

sendResponse({ok:false,error:"UNKNOWN_MESSAGE"});
})().catch(error => sendResponse({ok:false,error:String(error)}));

return true;
});
