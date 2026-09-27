(() => {
if (window.__UNSTOPPABLE_CHAT_BRIDGE_V2100__) return;
window.__UNSTOPPABLE_CHAT_BRIDGE_V2100__ = true;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalize = value => String(value ||"").replace(/\s+/g," ").trim();

function findComposer() {
const selectors = [
"#prompt-textarea",
"[data-testid='prompt-textarea']",
"textarea[name='prompt-textarea']",
"textarea[data-testid='prompt-textarea']",
"textarea#prompt-textarea",
"div#prompt-textarea[contenteditable='true']",
"[contenteditable='true'][data-lexical-editor='true']",
"main form [contenteditable='true'][role='textbox']",
"form [contenteditable='true'][aria-label*='Chat with ChatGPT' i]",
"form [contenteditable='true'][aria-label*='Message' i]",
"div[contenteditable='true'][data-virtualkeyboard='true']",
"div[contenteditable='true'][role='textbox']",
".ProseMirror[contenteditable='true']",
"div[contenteditable='true'][data-placeholder]"
];
const usable = el => {
if (!el || !el.isConnected || el.getClientRects().length === 0) return false;
const style = getComputedStyle(el);
if (style.display ==="none" || style.visibility ==="hidden" || style.opacity ==="0") return false;
if (el.matches?.("[disabled],[aria-disabled='true']")) return false;
return true;
};
for (const selector of selectors) {
const nodes = [...document.querySelectorAll(selector)];
const visible = nodes.find(usable);
if (visible) return visible;
}
return null;
}

async function waitComposer(timeout = 20000) {
const existing=findComposer();
if(existing) return existing;
return await new Promise(resolve=>{
let done=false;
const finish=value=>{if(done)return;done=true;try{observer.disconnect();}catch{}clearTimeout(timer);resolve(value||null);};
const observer=new MutationObserver(()=>{const el=findComposer();if(el)finish(el);});
try{observer.observe(document.documentElement||document,{childList:true,subtree:true,attributes:true,attributeFilter:["contenteditable","data-testid","aria-label"]});}
catch{return finish(null);}
const timer=setTimeout(()=>finish(findComposer()),timeout);
});
}

function composerText(el) {
if (!el) return"";
if (el.tagName ==="TEXTAREA" || el.tagName ==="INPUT") return normalize(el.value);
return normalize(el.innerText || el.textContent);
}

function dispatchInput(el, data = null, inputType ="insertText") {
try {
el.dispatchEvent(new InputEvent("input", { bubbles:true, inputType, data }));
} catch {
el.dispatchEvent(new Event("input", { bubbles:true }));
}
el.dispatchEvent(new Event("change", { bubbles:true }));
}

async function nextPaint() {

await new Promise(resolve => setTimeout(resolve, document.visibilityState ==="visible" ? 12 : 24));
}

function verifyComposerValue(el,value) {
const expected=normalize(value);
if (!expected) return true;
const current=normalize(composerText(el));
const head=expected.slice(0,Math.min(72,expected.length));
const tail=expected.slice(Math.max(0,expected.length-72));
return current.includes(head.slice(0,Math.min(36,head.length)))
&& (!tail || current.includes(tail.slice(Math.max(0,tail.length-30))));
}

function replaceEditableContentFast(el,value) {

const fragment=document.createDocumentFragment();
const lines=String(value).split(/\r?\n/);
if (lines.length <= 180) {
for (const line of lines) {
const p=document.createElement("p");
if (line) p.textContent=line; else p.appendChild(document.createElement("br"));
fragment.appendChild(p);
}
} else {
const p=document.createElement("p");
p.textContent=String(value);
fragment.appendChild(p);
}
el.replaceChildren(fragment);
dispatchInput(el,null,"insertText");
}

function selectEditableContents(el) {
const selection = window.getSelection();
const range = document.createRange();
range.selectNodeContents(el);
selection?.removeAllRanges();
selection?.addRange(range);
}

async function insertEditableStateful(el,value) {

const text=String(value ||"");
if(!el?.isConnected || !el.isContentEditable) return false;
el.focus();
selectEditableContents(el);

const chunkSize = text.length > 90000 ? 12000 : text.length > 30000 ? 14000 : 16000;
const chunks=[];
for(let i=0;i<text.length;i+=chunkSize) chunks.push(text.slice(i,i+chunkSize));
if(!chunks.length) chunks.push("");

for(let i=0;i<chunks.length;i++) {
let inserted=false;
try { inserted=!!document.execCommand?.("insertText", false, chunks[i]); } catch {}
if(!inserted) return false;
if(i===0 || i===chunks.length-1 || i%4===3) {
dispatchInput(el,null,"insertText");
await new Promise(resolve => setTimeout(resolve,0));
}
}
dispatchInput(el,null,"insertText");
await nextPaint();
return verifyComposerValue(el,text);
}

async function fillComposer(el, text) {
const value = String(text ||"");
if(!el?.isConnected) return false;
el.focus();

if (el.tagName ==="TEXTAREA" || el.tagName ==="INPUT") {
const proto = el.tagName ==="TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
const setter = Object.getOwnPropertyDescriptor(proto,"value")?.set;
if (setter) setter.call(el, value);
else el.value = value;
dispatchInput(el, null);
await nextPaint();
return verifyComposerValue(el,value);
}

if (el.isContentEditable) {

if(document.visibilityState !=="visible") {
try {
try { el.dispatchEvent(new InputEvent("beforeinput", {bubbles:true,cancelable:true,inputType:"insertText",data:value})); } catch {}
replaceEditableContentFast(el,value);
await nextPaint();
if(verifyComposerValue(el,value)) return true;
} catch {}
}
try {
if(await insertEditableStateful(el,value)) return true;
} catch {}
try {
try { el.dispatchEvent(new InputEvent("beforeinput", {bubbles:true,cancelable:true,inputType:"insertText",data:value})); } catch {}
replaceEditableContentFast(el,value);
await nextPaint();
return verifyComposerValue(el,value);
} catch {}
}

return false;
}

function toFile(item) {
const [header,encoded] = String(item.dataUrl ||"").split(",");
const mime = header?.match(/data:([^;]+)/)?.[1] || item.mimeType ||"application/octet-stream";
const binary = atob(encoded ||"");
const bytes = new Uint8Array(binary.length);
for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
return new File([bytes], item.name ||`anexo-${Date.now()}`, {type:mime});
}

function textFromAttachment(item) {
try {
const [header,encoded] = String(item?.dataUrl ||"").split(",");
const mime = header?.match(/data:([^;]+)/)?.[1] || item?.mimeType ||"";
if(!/^text\/|json|markdown/i.test(mime) && !/\.(md|txt|json)$/i.test(String(item?.name||""))) return"";
const binary=atob(encoded ||"");
const bytes=new Uint8Array(binary.length);
for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
return new TextDecoder().decode(bytes);
} catch { return""; }
}

async function findFileInput(timeout = 2500) {
let input = [...document.querySelectorAll("input[type='file']")].find(el => el.isConnected);
if (input) return input;

const buttons = [...document.querySelectorAll("button")];
const attach = buttons.find(button => {
const text = normalize(`${button.getAttribute("aria-label") ||""} ${button.getAttribute("title") ||""} ${button.dataset?.testid ||""}`).toLowerCase();
return/attach|anex|upload|composer-plus|attachment/.test(text);
});
attach?.click();

const start = Date.now();
while (Date.now() - start < timeout) {
input = [...document.querySelectorAll("input[type='file']")].find(el => el.isConnected);
if (input) return input;
await sleep(200);
}
return null;
}

async function attachFiles(attachments) {
if (!attachments?.length) return true;
const input = await findFileInput();
if (!input) return false;
const transfer = new DataTransfer();
for (const item of attachments.slice(0,6)) transfer.items.add(toFile(item));
input.files = transfer.files;
input.dispatchEvent(new Event("change", {bubbles:true}));
input.dispatchEvent(new Event("input", {bubbles:true}));
await sleep(Math.min(2600, 450 + attachments.length * 350));
return true;
}

function roleMessages(role) {
const direct = [...document.querySelectorAll(`[data-message-author-role='${role}']`)];
if (direct.length) return direct;

return [...document.querySelectorAll("article[data-testid^='conversation-turn-'], article")]
.filter(article => article.querySelector(`[data-message-author-role='${role}']`));
}

const assistantMessages = () => roleMessages("assistant");
const userMessages = () => roleMessages("user");

function isVisibleControl(el) {
if (!el || !el.isConnected) return false;
const rect = el.getBoundingClientRect();
if (!rect.width || !rect.height) return false;
const style = getComputedStyle(el);
return style.display !=="none" && style.visibility !=="hidden" && style.opacity !=="0";
}

function controlText(el) {
return normalize(
`${el?.getAttribute?.("aria-label") ||""} ${el?.getAttribute?.("title") ||""} ${el?.dataset?.testid ||""} ${el?.innerText ||""}`
).toLowerCase();
}

function composerScope(composerEl = findComposer()) {
if (!composerEl) return null;
return composerEl.closest("form")
|| composerEl.closest("[data-testid*='composer']")
|| composerEl.parentElement?.parentElement?.parentElement
|| composerEl.parentElement
|| null;
}

function nearComposer(button, composerEl) {
if (!button || !composerEl) return false;
const b = button.getBoundingClientRect();
const c = composerEl.getBoundingClientRect();
const horizontal = b.right >= c.left - 180 && b.left <= c.right + 180;
const vertical = b.bottom >= c.top - 260 && b.top <= c.bottom + 180;
return horizontal && vertical;
}

function findStopControl() {
const composerEl = findComposer();
const scope = composerScope(composerEl);
const exactSelectors = [
"button[data-testid='stop-button']",
"button[data-testid='composer-stop-button']",
"button[aria-label='Stop generating']",
"button[aria-label='Stop response']",
"button[aria-label='Stop streaming']",
"button[aria-label='Parar geração']",
"button[aria-label='Parar resposta']",
"button[aria-label='Interromper geração']"
];

for (const selector of exactSelectors) {
const local = scope?.querySelector?.(selector);
if (isVisibleControl(local)) return local;
}

const labels = new Set([
"stop",
"stop generating",
"stop response",
"stop streaming",
"parar",
"parar geração",
"parar resposta",
"interromper",
"interromper geração"
]);

const localButtons = scope ? [...scope.querySelectorAll("button")] : [];
const local = localButtons
.filter(isVisibleControl)
.find(button => labels.has(controlText(button)));
if (local) return local;

return [...document.querySelectorAll("button")]
.filter(isVisibleControl)
.find(button => labels.has(controlText(button)) && nearComposer(button, composerEl))
|| null;
}

function hasBusyMarker() {

const lastTurn = [...document.querySelectorAll("article[data-testid^='conversation-turn-'], article")].reverse()
.find(article => article.querySelector("[data-message-author-role='assistant']"));
if (!lastTurn) return false;
const selectors = [
"[data-state='streaming']",
"[data-state='generating']",
"[data-is-streaming='true']",
"[aria-busy='true'][data-testid*='message']"
];
return selectors.some(selector => !!lastTurn.querySelector(selector));
}

function isStreaming() {
return !!findStopControl() || hasBusyMarker();
}

function composerReadyForNextMessage() {
if (findStopControl() || hasBusyMarker()) return false;

return !!findComposer();
}

function findSendButton() {
const composerEl = findComposer();
const scope = composerScope(composerEl) || document;
const directSelectors = [
"#composer-submit-button",
"button[data-testid='send-button']",
"button[data-testid='composer-submit-button']",
"button[aria-label='Send prompt']",
"button[aria-label='Send message']",
"button[aria-label='Enviar prompt']",
"button[aria-label='Enviar mensagem']"
];

for (const selector of directSelectors) {
const direct = scope.querySelector(selector) || document.querySelector(selector);
if (isVisibleControl(direct)) return direct;
}

const accepted = [
/^send$/,
/^send prompt$/,
/^send message$/,
/^enviar$/,
/^enviar prompt$/,
/^enviar mensagem$/
];

return [...scope.querySelectorAll("button")]
.filter(isVisibleControl)
.find(button => accepted.some(pattern => pattern.test(controlText(button))))
|| null;
}

async function waitSendButton(timeout = 9000) {
const current=findSendButton();
if(current && !current.disabled && current.getAttribute("aria-disabled")!=="true") return current;
return await new Promise(resolve=>{
let done=false;
const finish=value=>{if(done)return;done=true;try{observer.disconnect();}catch{}clearTimeout(timer);resolve(value||null);};
const check=()=>{const button=findSendButton();if(button&&!button.disabled&&button.getAttribute("aria-disabled")!=="true")finish(button);};
const observer=new MutationObserver(check);
try{observer.observe(document.documentElement||document,{childList:true,subtree:true,attributes:true,attributeFilter:["disabled","aria-disabled","data-testid"]});}
catch{return finish(null);}
const timer=setTimeout(()=>{check();if(!done)finish(null);},timeout);
});
}

async function sentEvidence(beforeUsers, composerEl, timeout = 5200) {
const start = Date.now();
const originalText = composerText(composerEl);
while (Date.now() - start < timeout) {
if (userMessages().length > beforeUsers) return true;
if (isStreaming()) return true;
const current = findComposer();
if (originalText && current && !composerText(current)) return true;
await sleep(100);
}
return false;
}

async function submitPrompt(composerEl, beforeUsers) {

let send=findSendButton();
if (send && !send.disabled && send.getAttribute("aria-disabled") !=="true") {
send.click();
if (await sentEvidence(beforeUsers, composerEl, 2600)) return {ok:true, method:"button"};
}

send=await waitSendButton(3500);
if (send) {
send.click();
if (await sentEvidence(beforeUsers, composerEl, 4200)) return {ok:true, method:"button"};
}

const form = composerEl.closest("form");
if (form?.requestSubmit) {
try {
const currentSend=findSendButton();
if (currentSend && !currentSend.disabled) form.requestSubmit(currentSend);
else form.requestSubmit();
if (await sentEvidence(beforeUsers, composerEl, 2800)) return {ok:true, method:"form"};
} catch {}
}

try {
composerEl.focus();
composerEl.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", code:"Enter", keyCode:13, which:13, bubbles:true, cancelable:true}));
composerEl.dispatchEvent(new KeyboardEvent("keyup", {key:"Enter", code:"Enter", keyCode:13, which:13, bubbles:true, cancelable:true}));
if (await sentEvidence(beforeUsers, composerEl, 3000)) return {ok:true, method:"enter"};
} catch {}

return {ok:false, error:"SEND_NOT_CONFIRMED"};
}

async function report(requestId, stage, text, options = {}) {
try {
await chrome.runtime.sendMessage({
type:"CHAT_BRIDGE_STATUS",
requestId,
stage,
text,
progress:options.progress,
responseText:options.responseText ||"",
source:options.source ||"chatgpt-dom",
activity:options.activity || null,
activityRevision:Number(options.activityRevision || 0),
done:!!options.done,
error:options.error || null
});
} catch {}
}

function isAssistantUiChrome(el) {
if (!(el instanceof Element)) return false;
const tag=el.tagName;
if (["BUTTON","SVG","PATH","STYLE","SCRIPT","NOSCRIPT"].includes(tag)) return true;
const testid=String(el.getAttribute("data-testid")||"").toLowerCase();
const aria=String(el.getAttribute("aria-label")||"").toLowerCase();
const cls=String(el.className||"").toLowerCase();
if (/copy|feedback|reaction|share|regenerate|retry|message-actions|turn-action/.test(testid)) return true;
if (/copy|copiar|good response|bad response|share|compartilhar|regenerate|regenerar/.test(aria)) return true;
if (/sr-only|visually-hidden/.test(cls) && !el.closest("pre")) return true;
return false;
}

function structuredAssistantText(node) {
if (!node) return"";
const out=[];
const blockTags=new Set(["P","DIV","SECTION","ARTICLE","LI","UL","OL","H1","H2","H3","H4","H5","H6","BLOCKQUOTE","TABLE","TR"]);
const pushBreak=()=>{ if(out.length && out[out.length-1]!=="\n") out.push("\n"); };
const walk=current=>{
if(!current) return;
if(current.nodeType===Node.TEXT_NODE){ out.push(String(current.nodeValue||"")); return; }
if(current.nodeType!==Node.ELEMENT_NODE) return;
const el=current;
if(isAssistantUiChrome(el)) return;
const tag=el.tagName;
if(tag==="BR"){ out.push("\n"); return; }
if(tag==="PRE"){
pushBreak();
const code=el.querySelector("code");
out.push(String(code?.textContent ?? el.textContent ??"").replace(/\r\n/g,"\n"));
pushBreak();
return;
}
const block=blockTags.has(tag);
if(block) pushBreak();
for(const child of el.childNodes) walk(child);
if(block) pushBreak();
};
walk(node);
return out.join("")
.replace(/\r\n/g,"\n")
.replace(/[ \t]+\n/g,"\n")
.replace(/\n{4,}/g,"\n\n\n")
.trim();
}

function rawAssistantNodeText(node) {
if (!node) return"";

const structured=structuredAssistantText(node);
return structured || String(node.textContent ||"").replace(/\r\n/g,"\n").trim();
}

window.__UC_DEBUG_EXTRACT_ASSISTANT_V2100__ = structuredAssistantText;

function newestAssistantText(beforeCount) {
const list = assistantMessages();
if (list.length <= beforeCount) return"";
const node = list[list.length - 1];
return rawAssistantNodeText(node);
}

function detectVisibleError() {
const candidates = [...document.querySelectorAll("[role='alert'], [data-testid*='error'], .text-red-500, .text-error")];
const text = candidates.map(el => normalize(el.innerText || el.textContent)).filter(Boolean).join(" ");
if (/something went wrong|erro|failed|falha|try again|tente novamente/i.test(text)) return text.slice(0,500);
return"";
}

function newestAssistantNode(beforeCount) {
const list = assistantMessages();
if (list.length <= beforeCount) return null;
return list[list.length - 1] || null;
}

function activitySnapshot(beforeCount) {
const node = newestAssistantNode(beforeCount);
const text = rawAssistantNodeText(node);
const normalizedText = normalize(text);
const liveBits = node
? [...node.querySelectorAll("[aria-label],[data-testid],[data-state],button")]
.filter(isVisibleControl)
.slice(-18)
.map(el => normalize(`${el.getAttribute?.("aria-label") ||""} ${el.dataset?.testid ||""} ${el.getAttribute?.("data-state") ||""} ${el.innerText ||""}`))
.filter(Boolean)
.join(" | ")
:"";
const signature =`${text.length}:${normalizedText.slice(-180)}:${liveBits.slice(-420)}:${isStreaming() ?"stream" :"idle"}`;
return {text,normalizedText,liveBits,signature};
}

function activityLabel(snapshot) {
const haystack = normalize(`${snapshot.liveBits} ${snapshot.text.slice(-260)}`).toLowerCase();
if (/search|pesquis|web|browser|naveg/.test(haystack)) return"Pesquisando e coletando contexto";
if (/read|lendo|arquivo|file|repository|reposit/.test(haystack)) return"Analisando arquivos e contexto";
if (/edit|escrev|write|patch|alter|modific|commit|github/.test(haystack)) return"Executando alterações e validações";
if (/think|thinking|analis|reason|raciocin/.test(haystack)) return"Analisando a solicitação";
return snapshot.text ?"Gerando e executando a resposta" :"Agente em atividade";
}

function hasFinalAssistantActions(beforeCount) {
const node = newestAssistantNode(beforeCount);
if (!node) return false;
const labels =/copy|copiar|regenerate|regenerar|retry|tentar novamente|good response|bad response|boa resposta|resposta ruim|share|compartilhar/i;
return [...node.querySelectorAll("button")].some(button => {
if (!isVisibleControl(button)) return false;
return labels.test(controlText(button));
});
}

function looksLikeTransientActivity(text) {
const value = normalize(text).toLowerCase();
if (!value || value.length > 700) return false;
return/^(localizando|procurando|pesquisando|analisando|lendo|modificando|alterando|editando|executando|validando|checking|searching|locating|reading|editing|modifying|updating|running|working|thinking)\b/.test(value)
||/arquivos? de rotas?|tool|ferramenta|working on|em andamento/.test(value);
}

async function watch(requestId, beforeAssistants, beforeUsers) {
const start = Date.now();
const STALLED_NOTICE = 2 * 60 * 1000;
let lastIdleNoticeAt = 0;
let last ="";
let stableSince = 0;
let idleSince = 0;
let lastActivityAt = Date.now();
let lastReportAt = 0;
let lastHeartbeatAt = Date.now();
let lastProgress = 30;
let lastSignature ="";
let activityRevision = 0;

await report(requestId,"processando","ChatGPT recebeu o comando. Sincronizando o progresso pela atividade real detectada...",{
progress:30,activity:"Comando recebido",activityRevision,source:"chatgpt-dom"
});

while (true) {
const snapshot = activitySnapshot(beforeAssistants);
const text = snapshot.text || newestAssistantText(beforeAssistants);
const streaming = isStreaming();
const composerReady = composerReadyForNextMessage();
const visibleError = detectVisibleError();
const finalActions = hasFinalAssistantActions(beforeAssistants);

if (visibleError && !streaming && !text) {
await report(requestId,"erro",`O ChatGPT retornou um erro: ${visibleError}`,{
progress:lastProgress,done:true,error:"CHATGPT_VISIBLE_ERROR",activityRevision,source:"chatgpt-dom"
});
return;
}

const activityChanged = snapshot.signature && snapshot.signature !== lastSignature;
if (activityChanged) {
lastSignature = snapshot.signature;
activityRevision += 1;
lastActivityAt = Date.now();
}

if (streaming) {
idleSince = 0;
} else if (!idleSince) {
idleSince = Date.now();
}

if (text) {
if (text !== last || activityChanged) {
if (text !== last) {
last = text;
stableSince = Date.now();
lastActivityAt = Date.now();
}

const lengthProgress = 48 + Math.min(40,Math.floor(Math.log2(Math.max(2,text.length + 1)) * 4));
const activityProgress = 42 + Math.min(46,activityRevision * 2);
lastProgress = Math.min(93,Math.max(lastProgress,lengthProgress,activityProgress));

if (Date.now() - lastReportAt > 650) lastReportAt = Date.now();
await report(
requestId,
"respondendo",
streaming ?`${activityLabel(snapshot)}...` :"Resposta recebida. Confirmando conclusão do agente...",
{
progress:lastProgress,
responseText:text.slice(0,12000),
activity:activityLabel(snapshot),
activityRevision,
source:"chatgpt-dom"
}
);
}

const stableFor = stableSince ? Date.now() - stableSince : 0;
const idleFor = idleSince ? Date.now() - idleSince : 0;
const transient = looksLikeTransientActivity(text);

const requiredStable = finalActions ? 1400 : transient ? 16000 : composerReady ? 2600 : 5200;

if (!streaming && composerReady && stableSince && idleFor > 900 && stableFor > requiredStable) {
if (transient && !finalActions) {
await report(requestId,"validando","A atividade do agente parou. Verificando se existe resposta final detectável...",{
progress:96,responseText:text,activity:"Verificando encerramento",activityRevision,source:"chatgpt-dom"
});
await sleep(1000);
const refreshed = activitySnapshot(beforeAssistants);
const refreshedStreaming = isStreaming();
const refreshedReady = composerReadyForNextMessage();
const refreshedActions = hasFinalAssistantActions(beforeAssistants);
const refreshedText = refreshed.text || newestAssistantText(beforeAssistants);
if (refreshedStreaming || !refreshedReady || refreshed.signature !== snapshot.signature) {
lastActivityAt = Date.now();
await sleep(350);
continue;
}
if (!refreshedActions && looksLikeTransientActivity(refreshedText)) {

lastActivityAt = Date.now();
await report(requestId,"processando","Acompanhamento ativo. Aguardando a resposta final do agente...",{
progress:96,responseText:refreshedText,activity:"Aguardando conclusão real",activityRevision,source:"chatgpt-dom"
});
await sleep(1000);
continue;
}
}

await report(requestId,"validando","Resposta final estável detectada. Confirmando encerramento do agente...",{
progress:97,responseText:text,activity:"Validando conclusão",activityRevision,source:"chatgpt-dom"
});
await sleep(450);
await report(requestId,"concluido","Finalizado com sucesso. O ChatGPT encerrou a resposta e o acompanhamento terminou junto com o chat.",{
progress:100,responseText:text,done:true,activity:"Finalizado com sucesso",activityRevision:activityRevision+1,source:"chatgpt-dom"
});
return;
}
} else if (activityChanged && streaming) {
lastProgress = Math.max(lastProgress,Math.min(48,32 + activityRevision * 2));
if (Date.now() - lastReportAt > 900) {
lastReportAt = Date.now();
await report(requestId,"processando",`${activityLabel(snapshot)}...`,{
progress:lastProgress,activity:activityLabel(snapshot),activityRevision,source:"chatgpt-dom"
});
}
} else if (userMessages().length > beforeUsers && Date.now() - lastReportAt > 7000) {
lastReportAt = Date.now();
await report(requestId,"processando","Solicitação confirmada no ChatGPT; aguardando nova atividade observável do agente...",{
progress:lastProgress,activity:"Aguardando atividade do agente",activityRevision,source:"chatgpt-dom"
});
}

if (userMessages().length > beforeUsers && Date.now() - lastHeartbeatAt > 4000) {
lastHeartbeatAt = Date.now();
await report(requestId, text ?"respondendo" :"processando",
text ? (streaming ?`${activityLabel(snapshot)}...` :"Resposta recebida. Confirmando término do turno...") :"ChatGPT em atividade; aguardando nova evidência do agente...",
{progress:lastProgress,responseText:last.slice(0,12000),activity:text ? activityLabel(snapshot) :"Acompanhamento ativo",activityRevision,source:"chatgpt-dom"}
);
}

if (!streaming && userMessages().length > beforeUsers && Date.now() - lastActivityAt > STALLED_NOTICE
&& Date.now() - lastIdleNoticeAt > 30_000) {
lastIdleNoticeAt = Date.now();
await report(requestId,"processando","Acompanhamento ativo. O agente ainda não apresentou uma resposta final detectável...",{
progress:Math.min(96,lastProgress),responseText:last,activity:"Aguardando conclusão real",activityRevision,source:"chatgpt-dom"
});
}

await sleep(500);
}

}

function loginRequired() {
if (findComposer()) return false;
const text = normalize(document.body?.innerText ||"").toLowerCase();
const buttons = [...document.querySelectorAll("button,a")].map(el => normalize(el.innerText || el.textContent).toLowerCase());
return buttons.some(value =>/log in|login|entrar|sign in/.test(value))
|| (/log in|entrar|sign in/.test(text) &&/sign up|criar conta|cadastre/.test(text));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
(async () => {
if (message?.type ==="UNSTOPPABLE_PING_V2100") {
const composerEl = findComposer();
const stopControl = findStopControl();
const streaming = isStreaming();
const sendButton = findSendButton();
sendResponse({
ok:true,
bridgeVersion:"2.10.0",
composerFound:!!composerEl,
streaming,
busy:streaming,
sendButtonFound:!!sendButton,
stopControlFound:!!stopControl,
busyEvidence:stopControl ? controlText(stopControl).slice(0,120) :"",
loginRequired:loginRequired(),
href:location.href,
readyState:document.readyState,
composerTag:composerEl?.tagName || null,
composerId:composerEl?.id || null,
composerTestId:composerEl?.getAttribute?.("data-testid") || null
});
return;
}

if (message?.type !=="UNSTOPPABLE_EXECUTE_V2100") return;

await report(message.requestId,"conectando","Localizando o campo de comando do ChatGPT...",{progress:10});
let composerEl = await waitComposer();
if (!composerEl) {
await report(message.requestId,"erro","Campo de comando do ChatGPT não encontrado. Atualize a aba e tente novamente.",{progress:10,done:true,error:"COMPOSER_NOT_FOUND"});
sendResponse({ok:false,error:"COMPOSER_NOT_FOUND"});
return;
}

const beforeAssistants = assistantMessages().length;
const beforeUsers = userMessages().length;

let promptText = String(message.prompt ||"");
const attachments = message.attachments || message.images || [];
if (attachments.length) {
const imageCount = attachments.filter(item => String(item.mimeType ||"").startsWith("image/")).length;
const fileCount = attachments.length - imageCount;
const detail = [imageCount ?`${imageCount} imagem(ns)` :"", fileCount ?`${fileCount} arquivo(s)` :""].filter(Boolean).join(" · ");
await report(message.requestId,"preparando",`Enviando ${detail ||"anexos"} ao ChatGPT...`,{progress:14});
}
if (!(await attachFiles(attachments))) {
const brokerContext=attachments.find(item=>item?.source==="github-broker" ||/^unstoppable-.*-context\.md$/i.test(String(item?.name||"")));
const inlineFallback=textFromAttachment(brokerContext);
if(inlineFallback) {
promptText=inlineFallback;
await report(message.requestId,"preparando","O upload de contexto não ficou disponível. Alternando automaticamente para envio inline em blocos, sem perder o comando.",{progress:15});
} else {
await report(message.requestId,"erro","Não foi possível anexar os arquivos ao ChatGPT.",{progress:14,done:true,error:"ATTACHMENT_FAILED"});
sendResponse({ok:false,error:"ATTACHMENT_FAILED"});
return;
}
}

composerEl = await waitComposer(6000);
if (!composerEl || !composerEl.isConnected) {
await report(message.requestId,"erro","O campo do ChatGPT foi recriado durante o upload e não ficou pronto a tempo.",{progress:16,done:true,error:"COMPOSER_REPLACED_NOT_READY"});
sendResponse({ok:false,error:"COMPOSER_REPLACED_NOT_READY"});
return;
}

const filled = await fillComposer(composerEl, promptText);
if (!filled) {
await report(message.requestId,"erro","Não foi possível preencher o campo do ChatGPT de forma confiável.",{progress:17,done:true,error:"COMPOSER_FILL_FAILED"});
sendResponse({ok:false,error:"COMPOSER_FILL_FAILED"});
return;
}

const promptLength=promptText.length;
await report(message.requestId,"preparando",promptLength>2200?"Prompt grande carregado pelo modo otimizado. Enviando ao ChatGPT...":"Prompt e Skills carregados. Confirmando envio...",{progress:19});
let submitted = await submitPrompt(composerEl, beforeUsers);
if (!submitted.ok) {

if (userMessages().length > beforeUsers || isStreaming()) {
submitted={ok:true,method:"evidence"};
} else {
const freshComposer=await waitComposer(3500);
if(freshComposer?.isConnected) {
const expected=promptText;
if(!verifyComposerValue(freshComposer,expected)) await fillComposer(freshComposer,expected);
submitted=await submitPrompt(freshComposer,beforeUsers);
composerEl=freshComposer;
}
}
}
if (!submitted.ok) {
await report(message.requestId,"erro","O prompt foi preparado, mas o ChatGPT não habilitou o envio. A extensão já tentou recuperar o composer automaticamente.",{progress:20,done:true,error:submitted.error});
sendResponse({ok:false,error:submitted.error});
return;
}

await report(message.requestId,"enviado",`Comando enviado ao ChatGPT (${submitted.method}).`,{progress:24});
watch(message.requestId, beforeAssistants, beforeUsers).catch(async error => {
await report(message.requestId,"erro",`Falha ao acompanhar o ChatGPT: ${String(error)}`,{progress:35,done:true,error:"WATCH_FAILED"});
});

sendResponse({ok:true,requestId:message.requestId,method:submitted.method});
})();
return true;
});
})();
