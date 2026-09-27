(() => {
const MAX_FILES = 120;
const MAX_NEEDS = 60;
const MAX_TOTAL_CONTENT = 4_000_000;
const BLOCKED_PATH =/(^|\/)(\.env(?:\.|$)|\.git\/|node_modules\/)|(^|\/)(id_rsa|id_ed25519|credentials|secrets?)(\.|$)/i;

const cleanText = value => String(value ||"")
.replace(/^\uFEFF/,"")
.replace(/[\u200B-\u200D\u2060]/g,"")
.replace(/\r\n/g,"\n");

const normalizePath = value => String(value ||"")
.trim()
.replace(/\\/g,"/")
.replace(/^\/+/,"")
.replace(/\/{2,}/g,"/")
.replace(/\/$/,"");

function stripOuterFence(value) {
const text = cleanText(value).trim();
const match = text.match(/^```[^\n]*\n([\s\S]*?)\n```\s*$/);
return match ? match[1] : text;
}

function safeJsonParse(value) {
const text = cleanText(value).trim()
.replace(/^```(?:json)?\s*/i,"")
.replace(/```\s*$/i,"")
.trim();
try { return {ok:true, value:JSON.parse(text)}; }
catch (error) { return {ok:false, error:String(error?.message || error)}; }
}

function findBalancedJsonObjects(raw) {
const text = cleanText(raw);
const out = [];
for (let start = 0; start < text.length; start++) {
if (text[start] !=="{") continue;
let depth = 0, inString = false, escaped = false;
for (let i = start; i < text.length; i++) {
const ch = text[i];
if (inString) {
if (escaped) escaped = false;
else if (ch ==="\\") escaped = true;
else if (ch ==='"') inString = false;
continue;
}
if (ch ==='"') { inString = true; continue; }
if (ch ==="{") depth++;
else if (ch ==="}") {
depth--;
if (depth === 0) {
const candidate = text.slice(start, i + 1);
if (/"(?:uc_changeset_version|task_complete|needs_files|commit_message|files)"\s*:/.test(candidate)) out.push(candidate);
start = i;
break;
}
}
}
if (out.length >= 12) break;
}
return out;
}

function normalizeLegacy(parsed) {
if (!parsed || typeof parsed !=="object" || Array.isArray(parsed)) return null;
const files = Array.isArray(parsed.files) ? parsed.files : [];
const needs = Array.isArray(parsed.needs_files) ? parsed.needs_files : [];
const remaining = Array.isArray(parsed.remaining_work)
? parsed.remaining_work
: parsed.remaining_work ? [String(parsed.remaining_work)] : [];
const hasTaskFlag = typeof parsed.task_complete ==="boolean";
return {
version:Number(parsed.uc_changeset_version || parsed.version || 2),
protocol:"legacy-json",
summary:String(parsed.summary ||"").slice(0,4000),
commit_message:String(parsed.commit_message ||"Unstoppable Corp: aplicar alterações geradas pela IA").slice(0,180),
needs_files:needs.map(normalizePath).filter(Boolean).slice(0,MAX_NEEDS),
task_complete:hasTaskFlag ? !!parsed.task_complete : needs.length === 0,
remaining_work:remaining.map(x=>String(x ||"").trim()).filter(Boolean).slice(0,40),
files:files.slice(0,MAX_FILES).map(item => ({
path:normalizePath(item?.path ||""),
action:String(item?.action ||"upsert").toLowerCase() ==="delete" ?"delete" :"upsert",
content:typeof item?.content ==="string" ? item.content :"",
content_present:typeof item?.content ==="string"
}))
};
}

function parseV3(raw) {
const text = cleanText(raw);
const begin ="UC_CHANGESET_V3_BEGIN";
const end ="UC_CHANGESET_V3_END";
const start = text.indexOf(begin);
if (start < 0) return {ok:false,error:"V3_MARKER_NOT_FOUND"};
const finish = text.indexOf(end, start + begin.length);
if (finish < 0) return {ok:false,error:"V3_END_MARKER_NOT_FOUND"};
const body = text.slice(start + begin.length, finish).replace(/^\s*\n?/,"");

const metaStart = body.indexOf("UC_META_BEGIN");
const metaEnd = body.indexOf("UC_META_END", metaStart + 1);
if (metaStart < 0 || metaEnd < 0) return {ok:false,error:"V3_META_MARKERS_INVALID"};
const metaRaw = body.slice(metaStart +"UC_META_BEGIN".length, metaEnd).trim();
const metaParsed = safeJsonParse(metaRaw);
if (!metaParsed.ok || !metaParsed.value || typeof metaParsed.value !=="object") {
return {ok:false,error:"V3_META_JSON_INVALID",detail:metaParsed.error || null};
}
const meta = metaParsed.value;
const files = [];
const lines = body.slice(metaEnd +"UC_META_END".length).split("\n");
let i = 0;
while (i < lines.length) {
const line = lines[i].trim();
const header = line.match(/^UC_FILE_BEGIN\|(upsert|delete)\|(.+)$/i);
if (!header) { i++; continue; }
const action = header[1].toLowerCase();
const path = normalizePath(header[2]);
i++;
const contentLines = [];
let closed = false;
while (i < lines.length) {
if (lines[i].trim() ==="UC_FILE_END") { closed = true; i++; break; }
contentLines.push(lines[i]);
i++;
}
if (!closed) return {ok:false,error:"V3_FILE_END_MISSING",path};
files.push({path,action,content:action ==="delete" ?"" : stripOuterFence(contentLines.join("\n"))});
if (files.length > MAX_FILES) return {ok:false,error:"V3_TOO_MANY_FILES"};
}

const needs = Array.isArray(meta.needs_files) ? meta.needs_files : [];
const remaining = Array.isArray(meta.remaining_work)
? meta.remaining_work
: meta.remaining_work ? [String(meta.remaining_work)] : [];
return {
ok:true,
changeset:{
version:3,
protocol:"uc-v3-blocks",
summary:String(meta.summary ||"").slice(0,4000),
commit_message:String(meta.commit_message ||"Unstoppable Corp: aplicar alterações geradas pela IA").slice(0,180),
needs_files:needs.map(normalizePath).filter(Boolean).slice(0,MAX_NEEDS),
task_complete:typeof meta.task_complete ==="boolean" ? !!meta.task_complete : needs.length === 0,
remaining_work:remaining.map(x=>String(x ||"").trim()).filter(Boolean).slice(0,40),
files
}
};
}

function parseMarkupV3(raw) {
const text = cleanText(raw);
const manifestMatch = text.match(/<UC_CHANGESET_V3>\s*([\s\S]*?)<\/UC_CHANGESET_V3>/i)
|| text.match(/\[UC_CHANGESET_V3\]\s*([\s\S]*?)\[\/UC_CHANGESET_V3\]/i);
if (!manifestMatch) return {ok:false,error:"V3_MARKUP_MANIFEST_NOT_FOUND"};
const parsed = safeJsonParse(manifestMatch[1]);
if (!parsed.ok || !parsed.value || typeof parsed.value !=="object") {
return {ok:false,error:"V3_MARKUP_META_JSON_INVALID",detail:parsed.error || null};
}
const meta = parsed.value;
const filesByPath = new Map();
const blockRegex =/<UC_FILE\b([^>]*)>([\s\S]*?)<\/UC_FILE>/gi;
let block;
while ((block = blockRegex.exec(text))) {
const attrs = {};
for (const m of block[1].matchAll(/\b(path|action)\s*=\s*["']([^"']+)["']/gi)) attrs[m[1].toLowerCase()] = m[2];
const path = normalizePath(attrs.path ||"");
if (!path) continue;
const action = String(attrs.action ||"upsert").toLowerCase() ==="delete" ?"delete" :"upsert";
filesByPath.set(path,{path,action,content:action ==="delete" ?"" : stripOuterFence(block[2])});
if (filesByPath.size > MAX_FILES) return {ok:false,error:"V3_TOO_MANY_FILES"};
}

const declared = Array.isArray(meta.files) ? meta.files : [];
const files = [];
const seen = new Set();
for (const item of declared.slice(0,MAX_FILES)) {
const path = normalizePath(item?.path ||"");
if (!path || seen.has(path)) continue;
seen.add(path);
const action = String(item?.action ||"upsert").toLowerCase() ==="delete" ?"delete" :"upsert";
if (action ==="delete") files.push({path,action,content:""});
else if (filesByPath.has(path)) files.push(filesByPath.get(path));
else return {ok:false,error:"V3_MARKUP_FILE_BLOCK_MISSING",path};
}
for (const [path,item] of filesByPath) {
if (!seen.has(path)) files.push(item);
}

const needs = Array.isArray(meta.needs_files) ? meta.needs_files : [];
const remaining = Array.isArray(meta.remaining_work)
? meta.remaining_work
: meta.remaining_work ? [String(meta.remaining_work)] : [];
return {
ok:true,
changeset:{
version:3,
protocol:"uc-v3-markup-compat",
summary:String(meta.summary ||"").slice(0,4000),
commit_message:String(meta.commit_message ||"Unstoppable Corp: aplicar alterações geradas pela IA").slice(0,180),
needs_files:needs.map(normalizePath).filter(Boolean).slice(0,MAX_NEEDS),
task_complete:typeof meta.task_complete ==="boolean" ? !!meta.task_complete : needs.length === 0,
remaining_work:remaining.map(x=>String(x ||"").trim()).filter(Boolean).slice(0,40),
files
}
};
}

function parseLegacy(raw) {
const text = cleanText(raw);
const candidateBodies = [];
for (const [open,close] of [
["<UC_CHANGESET_V2>","</UC_CHANGESET_V2>"], ["[UC_CHANGESET_V2]","[/UC_CHANGESET_V2]"],
["<UC_CHANGESET_V1>","</UC_CHANGESET_V1>"], ["[UC_CHANGESET_V1]","[/UC_CHANGESET_V1]"]
]) {
const start = text.indexOf(open), end = text.indexOf(close, start + open.length);
if (start >= 0 && end > start) candidateBodies.push(text.slice(start + open.length, end).trim());
}
for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
if (/"(?:uc_changeset_version|files|needs_files|task_complete)"\s*:/.test(match[1])) candidateBodies.push(match[1].trim());
}
candidateBodies.push(...findBalancedJsonObjects(text));

const errors = [];
for (const body of candidateBodies) {
const parsed = safeJsonParse(body);
if (!parsed.ok) { errors.push(parsed.error); continue; }
const normalized = normalizeLegacy(parsed.value);
if (normalized) {
const missingContent=(normalized.files||[]).find(item=>item.action==="upsert" && item.content_present===false);
if(missingContent){ errors.push(`LEGACY_UPSERT_CONTENT_MISSING:${missingContent.path}`); continue; }
normalized.files=(normalized.files||[]).map(({content_present,...item})=>item);
return {ok:true,changeset:normalized};
}
}
return {ok:false,error:"LEGACY_CHANGESET_NOT_PARSEABLE",detail:errors.slice(0,4)};
}

function extractChangeset(raw) {
const text = cleanText(raw);
const v3 = parseV3(text);
if (v3.ok) return {...v3, parserVersion:"3.1"};
const markup = parseMarkupV3(text);
if (markup.ok) return {...markup, parserVersion:"3.1",markupFallback:true,v3Error:v3.error};
const legacy = parseLegacy(text);
if (legacy.ok) return {...legacy, parserVersion:"3.1",legacyFallback:true,v3Error:v3.error,markupError:markup.error};
return {ok:false,error:"AI_CHANGESET_NOT_FOUND",parserVersion:"3.1",v3Error:v3.error,markupError:markup.error,legacyError:legacy.error,legacyDetail:legacy.detail || null};
}

const CODE_LIKE_PATH =/\.(?:[cm]?[jt]sx?|css|scss|sass|less|json|jsonc|toml|ya?ml|sql|html|vue|svelte)$/i;

function sanitizeGeneratedSource(path, value) {
let text = cleanText(value);
if (!CODE_LIKE_PATH.test(String(path ||""))) return {content:text,changes:[]};
const changes = [];

text = text.replace(/(["'`])\[(https?:\/\/[^\]\n]+)\]\((https?:\/\/[^)\n]+)\)\1/g,(full,quote,label,target)=>{
if (label !== target) return full;
changes.push("markdown-url-normalized");
return`${quote}${label}${quote}`;
});
return {content:text,changes};
}

function validateGeneratedSource(path, content) {
if (!CODE_LIKE_PATH.test(String(path ||""))) return {ok:true};
const text = cleanText(content);
const fenceLine =/(^|\n)\s*```(?:[A-Za-z0-9_-]+)?\s*(?=\n|$)/;
if (fenceLine.test(text)) return {ok:false,error:"AI_CHANGESET_MARKDOWN_FENCE_IN_SOURCE",path};
if (/\bUC_(?:FILE|META|CHANGESET)_/.test(text)) return {ok:false,error:"AI_CHANGESET_PROTOCOL_MARKER_IN_SOURCE",path};
return {ok:true};
}

function validateChangeset(changeset) {
if (!changeset) return {ok:false,error:"AI_CHANGESET_NOT_FOUND"};
let total = 0;
const files = [];
const seen = new Set();
for (const item of changeset.files || []) {
const path = normalizePath(item.path);
if (!path || path.includes("..") || path.startsWith("/") ||/[\x00-\x1f]/.test(path)) return {ok:false,error:"AI_CHANGESET_INVALID_PATH",path};
if (BLOCKED_PATH.test(path)) return {ok:false,error:"AI_CHANGESET_BLOCKED_SENSITIVE_PATH",path};
if (seen.has(path)) return {ok:false,error:"AI_CHANGESET_DUPLICATE_PATH",path};
seen.add(path);
const action = String(item.action ||"upsert").toLowerCase() ==="delete" ?"delete" :"upsert";
const sanitized = action ==="delete" ? {content:"",changes:[]} : sanitizeGeneratedSource(path,String(item.content ??""));
const content = sanitized.content;
const sourceCheck = validateGeneratedSource(path,content);
if (!sourceCheck.ok) return sourceCheck;
total += content.length;
if (total > MAX_TOTAL_CONTENT) return {ok:false,error:"AI_CHANGESET_TOO_LARGE",total};
files.push({path,action,content,sanitized_changes:sanitized.changes});
}
return {ok:true,files,totalChars:total};
}

function protocolText() {
return`[UC_OUTPUT_PROTOCOL_V3]\n`+
`The Unstoppable Corp extension is the only GitHub writer. Do NOT use the ChatGPT GitHub connector and do NOT claim that a commit exists. Implement against the repository context supplied by the extension.\n`+
`Return one machine-readable changeset. The extension validates the payload, writes Git objects, advances the branch with force=false, re-reads the HEAD, and only then reports success.\n\n`+
`UC_CHANGESET_V3_BEGIN\n`+
`UC_META_BEGIN\n`+
`{"summary":"what this round accomplishes","commit_message":"short conventional commit message","task_complete":true,"remaining_work":[],"needs_files":[]}\n`+
`UC_META_END\n`+
`UC_FILE_BEGIN|upsert|src/example.ts\n`+
"```typescript\n"+
`FULL FINAL FILE CONTENT HERE. Keep URLs, regular expressions, backslashes and quotes literal.\n`+
"```\n"+
`UC_FILE_END\n`+
`UC_CHANGESET_V3_END\n\n`+
`Rules:\n`+
`1) IMPLEMENT, do not narrate. If context is sufficient, return real files.\n`+
`2) Every upsert must contain the complete final file. Wrap EACH code/config file body in exactly one Markdown code fence. The extension removes only that outer fence before writing GitHub. Do not insert extra fences inside the file.\n`+
`3) Preserve literal source syntax. Never convert URLs into Markdown links. Never rewrite regular expressions, escapes or backslashes for prose rendering.\n`+
`4) If repository content is genuinely missing, use needs_files with exact paths/directories/simple globs. Do not ask the user to paste files already in GitHub.\n`+
`5) Large tasks may use safe batches with task_complete=false and remaining_work; the extension commits and reloads the new HEAD before the next round.\n`+
`6) Never emit .env values, passwords, cookies, tokens, private keys, service_role keys or other secrets. Use environment-variable references only.\n`+
`7) Create missing files when required. Preserve existing architecture and unrelated features.\n`+
`8) Do not edit through Lovable. Lovable is only the synced preview/hosting surface after a verified GitHub commit.\n`+
`9) Do not append unrelated offers or prose outside the single changeset.\n`+
`[/UC_OUTPUT_PROTOCOL_V3]`;
}

globalThis.UCBrokerProtocol = {
extractChangeset,
validateChangeset,
protocolText,
normalizePath,
parseV3,
parseMarkupV3,
parseLegacy,
findBalancedJsonObjects,
sanitizeGeneratedSource,
validateGeneratedSource
};
})();
