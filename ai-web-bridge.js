(() => {
if (window.__UNSTOPPABLE_AI_WEB_BRIDGE_V2100__) return;
window.__UNSTOPPABLE_AI_WEB_BRIDGE_V2100__ = true;

const VERSION ="2.10.0";
const PING ="UNSTOPPABLE_AI_PING_V2100";
const EXECUTE ="UNSTOPPABLE_AI_EXECUTE_V2100";

const provider = (() => {
const host = location.hostname.toLowerCase();
if (host ==="gemini.google.com") return"gemini";
if (host ==="claude.ai") return"claude";
if (host ==="chat.deepseek.com") return"deepseek";
return"unknown";
})();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const visible = el => {
if (!el || !el.isConnected) return false;
const r = el.getBoundingClientRect();
const s = getComputedStyle(el);
return r.width > 2 && r.height > 2 && s.visibility !=="hidden" && s.display !=="none";
};

const providerSelectors = {
gemini: {
composer: [
"rich-textarea div[contenteditable='true']",
".ql-editor[contenteditable='true']",
"div[contenteditable='true'][role='textbox']",
"textarea"
],
send: [
"button[aria-label*='Send' i]",
"button[aria-label*='Enviar' i]",
"button[aria-label*='Submit' i]",
"button[type='submit']"
],
stop: [
"button[aria-label*='Stop' i]",
"button[aria-label*='Parar' i]"
],
assistant: [
"model-response",
".model-response-text",
"[data-test-id*='model-response']",
"[data-testid*='model-response']"
]
},
claude: {
composer: [
".ProseMirror[contenteditable='true']",
"div[contenteditable='true'][role='textbox']",
"fieldset div[contenteditable='true']",
"textarea"
],
send: [
"button[aria-label*='Send' i]",
"button[aria-label*='Enviar' i]",
"button[data-testid*='send' i]",
"button[type='submit']"
],
stop: [
"button[aria-label*='Stop' i]",
"button[aria-label*='Parar' i]",
"button[data-testid*='stop' i]"
],
assistant: [
"[data-testid*='assistant' i]",
"[data-is-streaming] .prose",
".font-claude-message",
".prose"
]
},
deepseek: {
composer: [
"textarea",
"div[contenteditable='true'][role='textbox']",
"div[contenteditable='true']"
],
send: [
"button[aria-label*='Send' i]",
"button[aria-label*='Enviar' i]",
"button[type='submit']",
"div[role='button'][aria-label*='Send' i]"
],
stop: [
"button[aria-label*='Stop' i]",
"button[aria-label*='Parar' i]",
"div[role='button'][aria-label*='Stop' i]"
],
assistant: [
".ds-markdown",
"[class*='markdown']",
"[class*='assistant']"
]
}
};

const cfg = providerSelectors[provider] || {composer:[], send:[], stop:[], assistant:[]};

function firstVisible(selectors) {
for (const selector of selectors) {
const nodes = [...document.querySelectorAll(selector)];
const hit = nodes.reverse().find(visible);
if (hit) return hit;
}
return null;
}

function findComposer() {
return firstVisible(cfg.composer);
}

function findSendButton() {
return firstVisible(cfg.send.filter(Boolean));
}

function findStopButton() {
return firstVisible(cfg.stop);
}

function getAssistantText() {
for (const selector of cfg.assistant) {
const nodes=[...document.querySelectorAll(selector)].filter(visible).reverse();
for (const node of nodes) {
const text=String(node.innerText || node.textContent ||"").trim();
if(text) return text.slice(-50000);
}
}
return"";
}

function pageLooksLoggedOut() {
const text = String(document.body?.innerText ||"").toLowerCase();
const loginHints = ["log in","sign in","entrar","login","continue with google","continuar com google"];
return !findComposer() && loginHints.some(hint => text.includes(hint));
}

function ping() {
const composer = findComposer();
const stop = findStopButton();
return {
ok: true,
provider,
bridgeVersion: VERSION,
composerFound: !!composer,
sendButtonFound: !!findSendButton(),
busy: !!stop,
loginRequired: pageLooksLoggedOut(),
href: location.href
};
}

function setComposerText(composer, text) {
composer.focus();
if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
const proto = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
const setter = Object.getOwnPropertyDescriptor(proto,"value")?.set;
if (setter) setter.call(composer, text);
else composer.value = text;
composer.dispatchEvent(new Event("input", {bubbles:true}));
composer.dispatchEvent(new Event("change", {bubbles:true}));
return;
}

if (composer.isContentEditable) {
const selection = getSelection();
const range = document.createRange();
range.selectNodeContents(composer);
selection?.removeAllRanges();
selection?.addRange(range);
const inserted=document.execCommand("insertText", false, text);
if(!inserted || !String(composer.innerText || composer.textContent ||"").includes(text.slice(0,Math.min(30,text.length)))) {
composer.textContent=text;
}
composer.dispatchEvent(new InputEvent("input", {bubbles:true,inputType:"insertText",data:text}));
return;
}

throw new Error("COMPOSER_UNSUPPORTED");
}

async function submitComposer(composer) {
await sleep(120);
const button = findSendButton();
if (button && !button.disabled && button.getAttribute("aria-disabled") !=="true") {
button.click();
return true;
}

composer.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter",code:"Enter",bubbles:true,cancelable:true}));
composer.dispatchEvent(new KeyboardEvent("keyup", {key:"Enter",code:"Enter",bubbles:true,cancelable:true}));
return true;
}

async function report(payload) {
try {
await chrome.runtime.sendMessage({type:"AI_BRIDGE_STATUS",provider,...payload});
} catch {}
}

async function monitorResponse(requestId, beforeText="") {
let lastText = beforeText;
let lastChangeAt = Date.now();
let seenBusy = false;
const startedAt = Date.now();

while (Date.now() - startedAt < 45 * 60 * 1000) {
const busy = !!findStopButton();
seenBusy ||= busy;
const current = getAssistantText();
if (current && current !== lastText) {
lastText = current;
lastChangeAt = Date.now();
await report({requestId,stage:"respondendo",text:`${provider} está respondendo...`,progress:70,responseText:current,done:false});
}

if (seenBusy && !busy && lastText && Date.now() - lastChangeAt > 2200) {
await report({requestId,stage:"concluido",text:`Resposta concluída no ${provider}.`,progress:100,responseText:lastText,done:true,error:null});
return;
}

if (!seenBusy && lastText && lastText !== beforeText && Date.now() - lastChangeAt > 4200) {
await report({requestId,stage:"concluido",text:`Resposta concluída no ${provider}.`,progress:100,responseText:lastText,done:true,error:null});
return;
}
await sleep(900);
}

await report({requestId,stage:"erro",text:`Tempo limite de acompanhamento do ${provider}.`,progress:80,done:true,error:"AI_RESPONSE_TIMEOUT"});
}

async function execute(message) {
const composer = findComposer();
if (!composer) {
return {ok:false,error:pageLooksLoggedOut()?"AI_LOGIN_REQUIRED":"AI_COMPOSER_NOT_FOUND",provider};
}
if (findStopButton()) return {ok:false,error:"AI_BUSY",provider,waitable:true};

const beforeText = getAssistantText();
setComposerText(composer, String(message.prompt ||""));
await submitComposer(composer);
await report({requestId:message.requestId,stage:"enviado",text:`Comando enviado ao ${provider}.`,progress:28,done:false});
monitorResponse(message.requestId,beforeText).catch(async error => {
await report({requestId:message.requestId,stage:"erro",text:String(error),progress:60,done:true,error:String(error)});
});
return {ok:true,provider,requestId:message.requestId};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
if (message?.type === PING) {
sendResponse(ping());
return;
}
if (message?.type === EXECUTE) {
execute(message).then(sendResponse).catch(error => sendResponse({ok:false,error:String(error),provider}));
return true;
}
});
})();
