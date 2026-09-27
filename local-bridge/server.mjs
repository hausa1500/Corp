import http from"node:http";
import { spawn } from"node:child_process";
import { readFile, mkdir, writeFile, rm } from"node:fs/promises";
import path from"node:path";

const HOST ="127.0.0.1";
const PORT = Number(process.env.UNSTOPPABLE_BRIDGE_PORT || 8765);
const config = JSON.parse(await readFile(new URL("./config.json", import.meta.url),"utf8"));

function run(command,args,options = {}) {
return new Promise((resolve,reject) => {
const child = spawn(command,args,{
cwd:options.cwd,
env:process.env,
shell:false,
windowsHide:true,
});
let stdout ="", stderr ="";
child.stdout.on("data",d => {
const text = String(d);
stdout += text;
options.onStdout?.(text);
});
child.stderr.on("data",d => {
const text = String(d);
stderr += text;
options.onStderr?.(text);
});
if (options.stdin) {
child.stdin.write(options.stdin);
child.stdin.end();
}
child.on("error",reject);
child.on("close",code => code === 0
? resolve({stdout,stderr})
: reject(new Error(`${command} saiu com código ${code}: ${stderr.slice(-1800)}`)));
});
}

function cors(origin) {
const allowed = String(origin ||"").startsWith("chrome-extension://") ? origin :"null";
return {
"Access-Control-Allow-Origin":allowed,
"Access-Control-Allow-Headers":"content-type, accept",
"Access-Control-Allow-Methods":"GET,POST,OPTIONS",
};
}

function respond(res,status,body,origin) {
res.writeHead(status,{...cors(origin),"Content-Type":"application/json; charset=utf-8"});
res.end(JSON.stringify(body));
}

function streamHeaders(res,origin) {
res.writeHead(200,{
...cors(origin),
"Content-Type":"application/x-ndjson; charset=utf-8",
"Cache-Control":"no-cache, no-transform",
"Connection":"keep-alive",
"X-Accel-Buffering":"no",
});
}

function streamEvent(res,event) {
res.write(`${JSON.stringify(event)}\n`);
}

async function git(repoPath,...args) {
return run("git",args,{cwd:repoPath});
}

function safeActivityText(raw, fallback) {
const lines = String(raw ||"").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const value = lines.at(-1) || fallback;
return String(value)
.replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/ig,"$1=[REDACTED]")
.slice(0,320);
}

function safeAttachmentName(name,index) {
const base = path.basename(String(name ||`anexo-${index+1}`))
.replace(/[^a-zA-Z0-9._()\- ]+/g,"_")
.replace(/^\.+/,"")
.slice(0,120);
return`${String(index+1).padStart(2,"0")}-${base ||`anexo-${index+1}`}`;
}

async function materializeAttachments(repoPath,requestId,attachments = []) {
if (!Array.isArray(attachments) || !attachments.length) return {dir:null,files:[]};
const safeId = String(requestId || Date.now()).replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80) || String(Date.now());
const dir = path.join(repoPath,".git","unstoppable-attachments",safeId);
await mkdir(dir,{recursive:true});

const files = [];
let total = 0;
for (const [index,item] of attachments.slice(0,6).entries()) {
const raw = String(item?.dataUrl ||"");
const encoded = raw.includes(",") ? raw.split(",",2)[1] :"";
if (!encoded) continue;
const bytes = Buffer.from(encoded,"base64");
if (bytes.length > 20*1024*1024) throw new Error(`Anexo ${item?.name || index+1} excede 20 MB.`);
total += bytes.length;
if (total > 40*1024*1024) throw new Error("Os anexos excedem o limite total de 40 MB.");
const filePath = path.join(dir,safeAttachmentName(item?.name,index));
await writeFile(filePath,bytes);
files.push({name:path.basename(filePath),path:filePath,mimeType:String(item?.mimeType ||"application/octet-stream")});
}
return {dir,files};
}

async function cleanupAttachments(dir) {
if (!dir) return;
try { await rm(dir,{recursive:true,force:true}); } catch {}
}

async function handleRun(body,emit = () => {}) {
const repo = String(body.repo ||"");
const prompt = String(body.prompt ||"").trim();
if (!repo || !prompt) throw new Error("repo e prompt são obrigatórios.");

emit({stage:"preparando",progress:8,text:"Validando repositório local...",step:"repo"});
const binding = config.repos?.[repo];
if (!binding?.path) throw new Error(`Repositório local não configurado: ${repo}`);
const repoPath = path.resolve(binding.path);
const branch = binding.branch || body.branch ||"main";

emit({stage:"preparando",progress:16,text:"Sincronizando a branch com o GitHub...",step:"fetch"});
await git(repoPath,"fetch","origin",branch);
emit({stage:"preparando",progress:22,text:"Confirmando branch de trabalho...",step:"checkout"});
await git(repoPath,"checkout",branch);
emit({stage:"preparando",progress:28,text:"Atualizando arquivos locais por fast-forward...",step:"pull"});
await git(repoPath,"pull","--ff-only","origin",branch);

let attachmentBundle = {dir:null,files:[]};
try {
attachmentBundle = await materializeAttachments(repoPath,body.requestId,body.attachments || []);
if (attachmentBundle.files.length) {
emit({stage:"preparando",progress:32,text:`${attachmentBundle.files.length} anexo(s) disponibilizado(s) ao agente local.`,step:"attachments"});
}

const command = config.agent?.command ||"codex";
const args = (config.agent?.args || ["exec","--skip-git-repo-check","-C","{repo}","-"])
.map(x => String(x).replaceAll("{repo}",repoPath).replaceAll("{branch}",branch));

const attachmentInstructions = attachmentBundle.files.length
?`\n\nANEXOS DA SOLICITAÇÃO:\n${attachmentBundle.files.map(file =>`- ${file.name}: ${file.path}`).join("\n")}\n- Leia somente os anexos necessários ao objetivo. ZIPs podem ser inspecionados/extrair seu conteúdo em área temporária, sem adicionar os anexos ao commit.`
:"";

const agentPrompt =`${prompt}${attachmentInstructions}\n\nREGRAS OBRIGATÓRIAS:\n- Trabalhe somente neste repositório local.\n- Leia AGENTS.md antes de editar.\n- Não use Lovable para alterações.\n- Preserve funcionalidades não relacionadas.\n- Não exponha secrets.\n- Ao terminar, deixe as alterações no working tree; o bridge fará commit/push.`;

let activity = 0;
emit({stage:"executando",progress:36,text:"Agente local iniciado. Analisando o projeto...",step:"agent-start"});
const result = await run(command,args,{
cwd:repoPath,
stdin:agentPrompt,
onStdout:text => {
if (!text.trim()) return;
activity += 1;
emit({
stage:"executando",
progress:Math.min(84,38 + activity * 2),
text:safeActivityText(text,"Agente local analisando, editando ou validando arquivos..."),
step:"agent-output",
activity,
});
},
onStderr:text => {
if (!text.trim()) return;
activity += 1;
emit({
stage:"executando",
progress:Math.min(84,38 + activity * 2),
text:safeActivityText(text,"Agente local processando ferramentas e validações..."),
step:"agent-tool",
activity,
});
},
});

emit({stage:"validando",progress:87,text:"Agente finalizou. Verificando alterações no Git...",step:"git-status"});
const status = await git(repoPath,"status","--porcelain");
if (String(status.stdout).trim()) {
emit({stage:"validando",progress:91,text:"Preparando commit das alterações...",step:"commit"});
await git(repoPath,"add","-A");
await git(repoPath,"commit","-m","Unstoppable Corp: DeepSeek Local");
}

emit({stage:"validando",progress:96,text:"Enviando commit para o GitHub...",step:"push"});
await git(repoPath,"push","origin",branch);
const sha = (await git(repoPath,"rev-parse","HEAD")).stdout.trim();

emit({stage:"concluido",progress:100,text:"Alterações enviadas ao GitHub com sucesso.",step:"done",done:true});
return {
ok:true,
provider:"deepseek-local",
commitSha:sha,
output:String(result.stdout ||"").slice(-12000),
};
} finally {
await cleanupAttachments(attachmentBundle.dir);
}
}

const server = http.createServer(async (req,res) => {
const origin = req.headers.origin ||"";
if (req.method ==="OPTIONS") {
res.writeHead(204,cors(origin)); res.end(); return;
}
if (req.url ==="/status" && req.method ==="GET") {
respond(res,200,{ok:true,name:"Unstoppable Local Bridge",version:"2.8.0",progressStream:true},origin); return;
}

const parsed = new URL(req.url ||"/",`http://${HOST}:${PORT}`);
if (parsed.pathname !=="/run" || req.method !=="POST") {
respond(res,404,{ok:false,error:"NOT_FOUND"},origin); return;
}

let raw ="";
try {
for await (const chunk of req) raw += chunk;
const body = JSON.parse(raw ||"{}");

if (parsed.searchParams.get("stream") ==="1") {
streamHeaders(res,origin);
try {
const result = await handleRun(body,event => streamEvent(res,event));
streamEvent(res,{type:"result",done:true,progress:100,result});
} catch (e) {
streamEvent(res,{
type:"result",
done:true,
ok:false,
progress:Math.min(99,Number(e?.progress || 80)),
error:e instanceof Error ? e.message : String(e),
});
} finally {
res.end();
}
return;
}

respond(res,200,await handleRun(body),origin);
} catch (e) {
if (!res.headersSent) {
respond(res,500,{ok:false,error:e instanceof Error ? e.message : String(e)},origin);
} else {
res.end();
}
}
});

server.listen(PORT,HOST,()=>console.log(`Unstoppable Local Bridge v2.8.0: http://${HOST}:${PORT}`));
