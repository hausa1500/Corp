(async()=>{
let config=(await chrome.runtime.sendMessage({type:"GET_CONFIG"})).config;
chrome.runtime.sendMessage({type:"PLAY_STARTUP_SOUND"}).catch?.(()=>null);

const setDot=(selector,state)=>{
const dot=document.querySelector(selector); if(!dot)return;
dot.className="dot"; if(state)dot.classList.add(state);
};

async function refresh(){
config=(await chrome.runtime.sendMessage({type:"GET_CONFIG"})).config;
const [chat,github,supa,session,license,...ais]=await Promise.all([
chrome.runtime.sendMessage({type:"CHAT_STATUS"}),
chrome.runtime.sendMessage({type:"GITHUB_STATUS"}),
chrome.runtime.sendMessage({type:"SUPA_STATUS"}),
chrome.runtime.sendMessage({type:"SUPA_SESSION"}),
chrome.runtime.sendMessage({type:"GET_LICENSE_STATUS",force:false}).catch(()=>null),
...["gemini","claude","deepseek"].map(provider=>chrome.runtime.sendMessage({type:"PROVIDER_STATUS",provider}).catch(()=>null))
]);
const mark=String(license?.watermark_id||"").trim();
if(mark) document.querySelector("main")?.setAttribute("data-license-mark",`UNST CORP · ${mark}`);
document.querySelector("#chat").textContent=chat?.ready?"Conta autenticada e pronta para comandos.":chat?.busy?"Conta conectada; resposta em andamento.":chat?.loginRequired?"Aba localizada. Faça login para concluir.":"Nenhuma sessão pronta.";
setDot("#chat-dot",chat?.ready?"ok":chat?.connected?"warn":"");

document.querySelector("#github").textContent=github?.connected?`Conectado como @${github.user?.login||"usuário"}.`:"Ainda não conectado.";
setDot("#github-dot",github?.connected?"ok":"");

const readyAi=[chat,...ais].filter(item=>item?.ready).length;
document.querySelector("#ai").textContent=readyAi?`${readyAi} modelo${readyAi>1?"s":""} pronto${readyAi>1?"s":""} para uso.`:"Nenhum modelo conectado.";
setDot("#ai-dot",readyAi?"ok":"warn");

document.querySelector("#supa").textContent=session?.authenticated?`Executor autenticado: ${session.user?.email||"usuário"}.`:supa?.ok?"Projeto Supabase online; Auth avançado opcional.":config.supabaseUrl?"Configuração presente, mas indisponível.":"Não configurado; opcional para sessões web.";
setDot("#supa-dot",session?.authenticated?"ok":supa?.ok?"warn":"");

document.querySelector("#project").textContent=config.repo&&config.branch?"Repositório e branch vinculados.":"Nenhum repositório/branch vinculado.";
setDot("#project-dot",config.repo&&config.branch?"ok":"warn");
}

await refresh();
document.querySelector("#autoconnect").onclick=async()=>{
const button=document.querySelector("#autoconnect");
button.textContent="Pareando projeto...";
await chrome.runtime.sendMessage({type:"AUTO_CONNECT_ALL"});
button.textContent="Configurar projeto automaticamente";
};
document.querySelector("#connections").onclick=()=>chrome.runtime.sendMessage({type:"OPEN_CONNECTION_CENTER"});
document.querySelector("#open").onclick=()=>chrome.tabs.create({url:config.lovableEditorUrl||config.previewUrl||"https://lovable.dev/"});
document.querySelector("#guide").onclick=()=>chrome.runtime.sendMessage({type:"OPEN_PROJECT_GUIDE"});
})();
