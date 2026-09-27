(() => {
if (window.__UNSTOPPABLE_GITHUB_OAUTH_HELPER_V193__) return;
window.__UNSTOPPABLE_GITHUB_OAUTH_HELPER_V193__ = true;

const SETUP_KEY ="unstoppableGithubOAuthSetupV193";
const DEFAULTS = {
applicationName:"Unstoppable Corp.",
homepageUrl:"https://unscorp.lovable.app",
callbackUrl:"https://unscorp.lovable.app/auth"
};
const sleep = ms => new Promise(r => setTimeout(r,ms));
const norm = v => String(v ||"").replace(/\s+/g," ").trim();
const textLower = el => norm(el?.innerText || el?.textContent).toLowerCase();

async function getSetup() {

try {
const response = await chrome.runtime.sendMessage({type:"GITHUB_OAUTH_HELPER_GET_SETUP"});
return response?.ok ? (response.setup || null) : null;
} catch { return null; }
}

function setNativeValue(input,value) {
const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
const setter = Object.getOwnPropertyDescriptor(proto,"value")?.set;
if (setter) setter.call(input,value); else input.value=value;
input.dispatchEvent(new Event("input",{bubbles:true}));
input.dispatchEvent(new Event("change",{bubbles:true}));
}

function inputForLabel(words) {
const labels=[...document.querySelectorAll("label")];
for (const label of labels) {
const t=textLower(label);
if (!words.some(w => t.includes(w))) continue;
const forId=label.getAttribute("for");
const byFor=forId ? document.getElementById(forId) : null;
const nested=label.querySelector("input,textarea");
const sibling=label.parentElement?.querySelector("input,textarea");
const hit=byFor || nested || sibling;
if (hit) return hit;
}
return null;
}

function findField(kind) {
const maps={
name:{labels:["application name","nome do aplicativo","nome da aplicação"],selectors:["input[name*='name']","input[id*='name']"]},
homepage:{labels:["homepage url","url da página inicial","homepage"],selectors:["input[name*='url']","input[id*='url']"]},
callback:{labels:["authorization callback url","callback url","redirect uri","uri de redirecionamento"],selectors:["input[name*='callback']","input[id*='callback']"]}
};
const cfg=maps[kind];
const byLabel=inputForLabel(cfg.labels);
if (byLabel) return byLabel;
for (const selector of cfg.selectors) {
const hits=[...document.querySelectorAll(selector)].filter(el=>el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement);
if (kind ==="name") {
const h=hits.find(el=>/oauth|application|app/i.test(`${el.name} ${el.id} ${el.getAttribute("aria-label")||""}`));
if (h) return h;
} else if (kind ==="callback") {
const h=hits.find(el=>/callback|redirect/i.test(`${el.name} ${el.id} ${el.getAttribute("aria-label")||""}`));
if (h) return h;
} else if (kind ==="homepage") {
const h=hits.find(el=>/homepage|url/i.test(`${el.name} ${el.id} ${el.getAttribute("aria-label")||""}`) && !/callback|redirect/i.test(`${el.name} ${el.id}`));
if (h) return h;
}
}
return null;
}

function findButton(patterns) {
return [...document.querySelectorAll("button,input[type='submit']")].find(el => {
const t=norm(el.value || el.innerText || el.textContent).toLowerCase();
return patterns.some(p => t.includes(p));
}) || null;
}

function overlay(message,state="working") {
let el=document.getElementById("uc-github-oauth-helper-status");
if (!el) {
el=document.createElement("div");
el.id="uc-github-oauth-helper-status";
Object.assign(el.style,{
position:"fixed",right:"20px",bottom:"20px",zIndex:"2147483647",maxWidth:"360px",padding:"14px 16px",
borderRadius:"14px",border:"1px solid rgba(255,74,96,.3)",background:"rgba(9,10,14,.94)",color:"#fff",
boxShadow:"0 18px 50px rgba(0,0,0,.45),0 0 25px rgba(255,45,70,.10)",backdropFilter:"blur(14px)",
font:"600 12px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"
});
document.documentElement.appendChild(el);
}
const accent=state==="ok"?"#56e6a5":state==="error"?"#ff506a":"#ff536d";
el.style.borderColor=state==="ok"?"rgba(86,230,165,.32)":state==="error"?"rgba(255,80,106,.38)":"rgba(255,74,96,.3)";
el.innerHTML=`<div style="display:flex;gap:9px;align-items:flex-start"><span style="width:9px;height:9px;border-radius:50%;background:${accent};box-shadow:0 0 14px ${accent};margin-top:4px;flex:0 0 auto"></span><div><b style="display:block;margin-bottom:3px">Unstoppable Corp · OAuth GitHub</b><span style="color:#aeb0b8">${message}</span></div></div>`;
}

async function autoFillRegistration(setup) {
const name=findField("name"), homepage=findField("homepage"), callback=findField("callback");
if (!name || !homepage || !callback) {
const body=textLower(document.body);
if (/sign in|log in|entrar|two-factor|2fa|verify|confirme|verification/.test(body)) {
overlay("Conclua o login, 2FA ou confirmação solicitada pelo GitHub. O preenchimento será retomado automaticamente.");
} else {
overlay("A página do GitHub ainda está carregando. Aguardando o formulário de OAuth...");
}
return false;
}
setNativeValue(name,setup.applicationName || DEFAULTS.applicationName);
setNativeValue(homepage,setup.homepageUrl || DEFAULTS.homepageUrl);
setNativeValue(callback,setup.callbackUrl || DEFAULTS.callbackUrl);
const deviceFlow=findDeviceFlowCheckbox();
if(deviceFlow && !deviceFlow.checked){
deviceFlow.click();
deviceFlow.dispatchEvent(new Event("change",{bubbles:true}));
}
overlay("Dados preenchidos automaticamente. Registrando o OAuth App e preparando o Device Flow...");
await sleep(500);
if (setup.autoSubmit !== false) {
const submit=findButton(["register application","registrar aplicativo","create application","criar aplicativo"]);
if (submit && !submit.disabled) { submit.click(); return true; }
}
return true;
}

function extractClientId() {
const candidates=[...document.querySelectorAll("input,code,pre,dd,span,strong")];
const patterns=[/\bOv[A-Za-z0-9]{12,}\b/,/\bIv1\.[A-Za-z0-9]{12,}\b/,/\b[A-Za-z0-9._-]{18,40}\b/];

for (const label of [...document.querySelectorAll("label,dt,h1,h2,h3,h4,p,span")]) {
if (!/client id/i.test(norm(label.innerText || label.textContent))) continue;
const scope=label.parentElement || label;
const texts=[...scope.querySelectorAll("input,code,pre,dd,span,strong")].map(el=>norm(el.value || el.innerText || el.textContent));
for (const t of texts) for (const re of patterns.slice(0,2)) { const m=t.match(re); if(m) return m[0]; }
}
for (const el of candidates) {
const t=norm(el.value || el.innerText || el.textContent);
for (const re of patterns.slice(0,2)) { const m=t.match(re); if(m) return m[0]; }
}
return"";
}

function findDeviceFlowCheckbox() {
const labels=[...document.querySelectorAll("label")];
for (const label of labels) {
if (!/enable device flow|device flow|habilitar device flow|fluxo de dispositivo/i.test(norm(label.innerText || label.textContent))) continue;
const id=label.getAttribute("for");
const input=(id&&document.getElementById(id)) || label.querySelector("input[type='checkbox']") || label.parentElement?.querySelector("input[type='checkbox']");
if (input) return input;
}
return [...document.querySelectorAll("input[type='checkbox']")].find(el=>/device/i.test(`${el.name} ${el.id} ${el.getAttribute("aria-label")||""}`)) || null;
}

async function configureExistingApp() {
const clientId=extractClientId();
if (!clientId) return false;
let checkbox=findDeviceFlowCheckbox();
let enabled=false;
if (checkbox) {
enabled=!!checkbox.checked;
if (!enabled) {
checkbox.click();
checkbox.dispatchEvent(new Event("change",{bubbles:true}));
await sleep(350);
enabled=!!checkbox.checked;
const save=findButton(["update application","save changes","salvar alterações","atualizar aplicativo"]);
if (save && !save.disabled) save.click();
}
}
overlay(enabled?"OAuth App criado. Device Flow habilitado e Client ID capturado automaticamente.":"OAuth App criado e Client ID capturado. Verifique a opção Device Flow se o GitHub solicitar confirmação.","ok");
try {
await chrome.runtime.sendMessage({type:"GITHUB_OAUTH_DISCOVERED",clientId,deviceFlowEnabled:enabled});
} catch {}
return true;
}

async function run() {
const setup=await getSetup();
if (!setup || setup.stage ==="complete") return;
const path=location.pathname;
if (path ==="/settings/applications/new" || path.startsWith("/settings/applications/new")) {
for (let i=0;i<30;i++) {
if (await autoFillRegistration(setup)) return;
await sleep(500);
}
overlay("Não consegui localizar o formulário automaticamente. Recarregue a página ou conclua manualmente; depois a extensão capturará o Client ID.","error");
return;
}
if (path.startsWith("/settings/applications/")) {
for (let i=0;i<30;i++) {
if (await configureExistingApp()) return;
await sleep(500);
}
overlay("OAuth App criado, mas o Client ID ainda não apareceu. Aguarde a página terminar de carregar.");
}
}

run().catch(()=>{});
})();
