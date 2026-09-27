(() => {
if (window.__UNSTOPPABLE_CORP_V2100__) return;
window.__UNSTOPPABLE_CORP_V2100__ = true;

document.querySelectorAll("#unstoppable-corp,#uc-lovable-lock-overlay,.uc-lovable-lock,#uc-lovable-sync-activity").forEach(node => node.remove());
document.querySelectorAll(".uc-lovable-native-branded").forEach(node => node.classList.remove("uc-lovable-native-branded"));

const PROVIDERS = {
auto: { nome:"Automático", sub:"ChatGPT → fallback", brand:"auto", vision:true },
chatgpt: { nome:"ChatGPT", sub:"Sessão conectada", brand:"chatgpt", vision:true },
gemini: { nome:"Gemini", sub:"Sessão web", brand:"gemini", vision:false },
claude: { nome:"Claude", sub:"Sessão web", brand:"claude", vision:false },
deepseek: { nome:"DeepSeek", sub:"Sessão web", brand:"deepseek", vision:false },
"deepseek-local": { nome:"DeepSeek Local", sub:"Terminal / Codex", brand:"deepseek", vision:false },
custom: { nome:"Outra IA", sub:"OpenAI compatível", brand:"custom", vision:false }
};

const FEATURED_SKILLS = new Set([
"interface-premium","react-typescript","performance-web","acessibilidade-responsiva",
"supabase-seguro","git-entrega","anti-ia-generica","microinteracoes","testes-regressao"
]);

const SHORTCUT_PROMPTS = {
optimize:{title:"Otimização completa",text:`Faça uma auditoria técnica completa deste projeto e otimize somente o que for necessário. Priorize performance real, redução de JavaScript desnecessário, carregamento de imagens, divisão de código, consultas, renderizações, acessibilidade e estabilidade. Preserve funcionalidades, identidade visual e integrações existentes. Meça ou valide antes e depois, corrija gargalos encontrados e documente os arquivos alterados.`},
buttons:{title:"Botões premium",text:`Revise todos os botões, CTAs e controles interativos do projeto. Deixe-os modernos, premium e profissionais, com hierarquia visual clara, ícones coerentes, estados hover/focus/active/disabled/loading, contraste acessível, áreas de toque adequadas e microinterações discretas. Preserve a identidade visual e não altere regras de negócio.`},
icons:{title:"Ícones profissionais",text:`Localize ícones genéricos, inconsistentes ou com aparência de interface criada por IA. Substitua-os por um conjunto profissional, minimalista e coerente com o design system existente. Padronize tamanho, stroke, alinhamento, espaçamento, acessibilidade e estados interativos. Não use emojis como ícones de interface.`},
security:{title:"Segurança do projeto",text:`Execute uma auditoria de segurança no projeto. Verifique autenticação, autorização, RLS, validação de entrada, exposição de secrets, chamadas ao Supabase, armazenamento local, uploads, rotas protegidas, dependências e mensagens de erro. Corrija vulnerabilidades reais sem quebrar fluxos existentes e informe riscos, arquivos alterados e validações realizadas.`},
fluidity:{title:"Fluidez e desempenho",text:`Melhore a fluidez percebida e real do site. Elimine travamentos, layout shifts, renderizações repetidas, animações pesadas, listeners duplicados e carregamentos bloqueantes. Ajuste skeletons, feedbacks, transições e estados assíncronos para uma experiência rápida e estável, mantendo o comportamento atual.`},
ui:{title:"UI premium",text:`Faça uma revisão completa de UI/UX e eleve o visual para um padrão premium, moderno e profissional. Corrija alinhamentos, espaçamentos, tipografia, hierarquia, contraste, consistência de componentes, estados vazios, loading, erro e sucesso. Preserve a marca e evite mudanças arbitrárias ou aparência genérica de IA.`},
mobile:{title:"Mobile completo",text:`Otimize todo o projeto para mobile e tablet. Revise breakpoints, navegação, modais, tabelas, formulários, áreas de toque, teclado virtual, safe areas, orientação, overflow e performance em telas menores. Garanta responsividade real sem prejudicar desktop e valide os principais fluxos em diferentes larguras.`},
accessibility:{title:"Acessibilidade",text:`Audite e corrija a acessibilidade do projeto seguindo boas práticas WCAG. Revise semântica, navegação por teclado, foco visível, labels, aria, contraste, leitura por screen reader, mensagens de erro e redução de movimento. Preserve o design e documente as validações.`}
};

const WATERMARK_PROMPT =`Analise o código deste repositório e remova somente elementos de marca, textos, links, badges, componentes ou assets da Lovable que estejam implementados dentro do próprio projeto e sejam controlados pelo código-fonte. Substitua referências visuais necessárias pela identidade Unstoppable Corp ou por elementos neutros e profissionais. Não tente contornar controles da plataforma, limitações de plano, mecanismos protegidos, licenciamento ou qualquer marca inserida fora do repositório. Preserve SEO, acessibilidade, responsividade, funcionamento e publicação. Ao finalizar, informe exatamente quais arquivos e referências foram removidos ou alterados.`;

const state = {
config:null,
binding:null,
detected:null,
provider:"auto",
skills:[],
selected:new Set(["interface-premium","git-entrega","testes-regressao"]),
attachments:[],
expanded:false,
panel:"chat",
drag:null,
windowDrag:null,
lockOverlay:null,
lockTarget:null,
poll:null,
currentRequestId:null,
lastSoundStage:null,
lastRenderedStage:null,
skillFilter:"Todas",
skillSearch:"",
executionStartedAt:0,
providerConnection:null,
providerConnectionStatus:null,
providerConnectionTimer:null,
pendingSend:false,
pendingProvider:null,
supabaseSession:null,
activityRequestId:null,
activitySignatures:new Set(),
lastResponseDigest:"",
brandedComposer:null,
brandedComposerContainer:null,
originalComposerPlaceholder:null,
executing:false,
githubRepos:[],
githubBranches:[],
githubDeviceTimer:null,
githubOAuthSetupTimer:null,
githubStatus:null,
aiConnectionStatuses:{},
autoConnectRunning:false,
autoConnectPending:false,
pendingCommandAfterSetup:false,
lovableGitSetupActive:false,
lovableRepoSnapshot:[],
lovableGitSync:null,
allowLovableSetup:false,
allowLovableSetupUntil:0,
lovableSetupUnlockTimer:null,
lockTargets:[],
lockComposer:null,
pipelineNotice:null
};

const icon = name => {
const paths = {
menu:'<path d="M5 7h14M5 12h14M5 17h14"/>',
chat:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 9h8M8 13h5"/>',
skill:'<path d="m12 3 2.1 4.4L19 9.5l-3.5 3.4.8 4.9-4.3-2.3-4.3 2.3.8-4.9L5 9.5l4.9-2.1L12 3Z"/>',
folder:'<path d="M3 6h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>',
shield:'<path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z"/>',
lock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
unlock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2.6"/>',
download:'<path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 20h14"/>',
github:'<path d="M15 22v-3.9c0-1 .1-1.5-.5-2 3-.3 6.1-1.5 6.1-6.6A5.1 5.1 0 0 0 19.2 6a4.7 4.7 0 0 0-.1-3.5s-1.1-.4-3.6 1.3a12.4 12.4 0 0 0-6.6 0C6.4 2.1 5.3 2.5 5.3 2.5A4.7 4.7 0 0 0 5.2 6a5.1 5.1 0 0 0-1.4 3.5c0 5.1 3.1 6.2 6.1 6.6-.4.4-.7.9-.8 1.5-.7.3-2.6.9-3.7-1.1"/>',
db:'<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
publish:'<path d="M12 16V4m0 0-5 5m5-5 5 5"/><path d="M5 20h14"/>',
sound:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6"/>',
bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
paperclip:'<path d="m20.5 11.5-8.8 8.8a6 6 0 0 1-8.5-8.5l9.4-9.4a4 4 0 0 1 5.7 5.7L8.9 17.5a2 2 0 1 1-2.8-2.8l8.8-8.8"/>',
wand:'<path d="m15 4 5 5L9 20l-5-5L15 4Z"/><path d="M6 4v3M4.5 5.5h3M18 15v4M16 17h4M18 2v2M17 3h2"/>',
send:'<path d="m21 3-6.5 18-3.8-7.7L3 9.5 21 3Z"/><path d="m20 4-9.3 9.3"/>',
x:'<path d="m6 6 12 12M18 6 6 18"/>',
drag:'<path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01"/>',
refresh:'<path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/>',
check:'<path d="m5 12 4 4L19 6"/>',
link:'<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/>',
eraser:'<path d="m7 21-4-4 11-11 4 4L7 21Z"/><path d="m14 6 4-4 4 4-4 4M7 21h14"/>',
heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
terminal:'<path d="m4 17 6-5-6-5"/><path d="M12 19h8"/>',
copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
star:'<path d="m12 2 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.2-6 3.2 1.2-6.7-4.9-4.7 6.7-1L12 2Z"/>',
activity:'<path d="M3 12h4l2-7 4 14 2-7h6"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
};
return`<svg class="uc-icon uc-icon-${name}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths[name] || paths.chat}</svg>`;
};

const brand = name => {
const files = {
chatgpt:"openai.png",
gemini:"gemini.png",
claude:"claude.png",
deepseek:"deepseek.png"
};
if (files[name]) {
return`<img class="uc-brand-image uc-brand-${name}" src="${chrome.runtime.getURL(`assets/providers/${files[name]}`)}" alt="${name}">`;
}
if (name ==="auto") {
return`<span class="uc-brand-auto" title="Seleção automática"><i></i><i></i><i></i></span>`;
}
return`<span class="uc-brand-custom">IA</span>`;
};

const root = document.createElement("div");
root.id ="unstoppable-corp";
root.classList.add("uc-license-pending");
root.innerHTML =`
    <aside class="uc-dock">
      <button class="uc-drag" data-drag title="Arraste para mover">${icon("drag")}</button>
      <div class="uc-logo"><img src="${chrome.runtime.getURL("assets/unstoppable-128.png")}"><span></span></div>
      <button class="uc-dock-btn" data-action="expand">${icon("menu")}<em>Menu</em></button>
      <div class="uc-sep"></div>
      <button class="uc-dock-btn active" data-section="chat">${icon("chat")}<em>Comando</em></button>
      <button class="uc-dock-btn" data-section="skills">${icon("skill")}<em>Skills</em></button>
      <button class="uc-dock-btn" data-section="shortcuts">${icon("heart")}<em>Atalhos</em></button>
      <button class="uc-dock-btn" data-section="connections">${icon("link")}<em>Conexões</em></button>
      <button class="uc-dock-btn" data-action="watermark" title="Preparar prompt seguro para remover referências Lovable do código">${icon("eraser")}<em>Remover marca d'água</em></button>
      <button class="uc-dock-btn" data-section="project">${icon("download")}<em>Baixar Projeto</em></button>
      <button class="uc-dock-btn uc-protection-dock" data-section="tools">${icon("lock")}<em>Proteção</em></button>
      <button class="uc-dock-btn" data-section="account">${icon("user")}<em>Minha conta</em></button>
      <div class="uc-sep"></div>
      <button class="uc-dock-btn uc-whatsapp" data-action="whatsapp" title="Falar no WhatsApp"><img src="${chrome.runtime.getURL("assets/providers/whatsapp.png")}" alt="WhatsApp"><em>WhatsApp</em></button>
      <small class="uc-version">v2.10.0</small>
    </aside>

    <section class="uc-window">
      <header class="uc-window-drag" title="Arraste para mover o painel">
        <div class="uc-title">
          <img src="${chrome.runtime.getURL("assets/unstoppable-48.png")}">
          <div><b>Unstoppable Corp</b><small>Agentes autenticados · GitHub via extensão</small></div>
        </div>
        <button data-action="close" aria-label="Fechar">${icon("x")}</button>
      </header>

      <div class="uc-section active" data-panel="chat">
        <div class="uc-project-status" aria-live="polite">
          <span></span>
          <div><b id="uc-repo">Verificando conexão...</b><small id="uc-branch">GitHub via extensão</small></div>
        </div>

        <div class="uc-provider-row">
          <label>Modelo</label>
          <div class="uc-providers" id="uc-providers"></div>
        </div>

        <div class="uc-compose" id="uc-drop">
          <textarea id="uc-prompt" rows="4" placeholder="Descreva o que deseja alterar no projeto..."></textarea>
          <div class="uc-attachments" id="uc-attachments"></div>
          <div class="uc-compose-bottom">
            <button class="uc-attach" data-action="attach" title="Anexar imagens, ZIPs, planilhas, PDFs, documentos ou arquivos de código">${icon("paperclip")}<span>Anexar</span></button>
            <button class="uc-improve" data-action="improve" title="Transformar seu texto em um prompt mais claro e completo">${icon("wand")}<span>Aprimorar</span></button>
            <button class="uc-skill-count" data-section="skills">Skills <b id="uc-skill-count">0</b></button>
            <button class="uc-send" data-action="send" title="Enviar comando">${icon("send")}</button>
          </div>
          <input type="file" id="uc-files" multiple hidden>
        </div>

        <div class="uc-exec" id="uc-exec" data-stage="idle">
          <span class="uc-exec-dot"></span>
          <div class="uc-exec-main">
            <div class="uc-exec-copy">
              <b id="uc-exec-title">Pronto</b>
              <small id="uc-exec-text">Nenhum comando em execução.</small>
            </div>
            <div class="uc-live-state"><span>${icon("activity")} Tempo real</span><em id="uc-live-state">Aguardando</em></div>
          </div>
        </div>
        <pre class="uc-response" id="uc-response"></pre>
      </div>

      <div class="uc-section" data-panel="skills">
        <div class="uc-section-head">
          <div><b>Skills por nicho</b><small>Biblioteca Core + Skills Exclusivas organizadas pelas pastas importadas</small></div>
          <span id="uc-skills-selected">0 ativas</span>
        </div>
        <div class="uc-skill-toolbar">
          <input id="uc-skill-search" type="search" placeholder="Buscar skill, objetivo ou nicho...">
          <button data-action="clear-skills" title="Desativar todas as Skills">Limpar</button>
        </div>
        <div class="uc-skill-filters" id="uc-skill-filters"></div>
        <div class="uc-skill-list" id="uc-skill-list"></div>
      </div>

      <div class="uc-section" data-panel="shortcuts">
        <div class="uc-section-head">
          <div><b>Atalhos inteligentes</b><small>Prompts prontos, detalhados e seguros para o projeto atual</small></div>
          <span>${icon("heart")}</span>
        </div>
        <div class="uc-shortcut-list">
          ${Object.entries(SHORTCUT_PROMPTS).map(([id,item]) =>`<button data-shortcut="${id}"><span>${icon(id ==="security" ?"shield" : id ==="icons" ?"star" : id ==="mobile" ?"folder" :"wand")}</span><div><b>${item.title}</b><small>${item.text.slice(0,105)}…</small></div></button>`).join("")}
        </div>
      </div>

      <div class="uc-section" data-panel="connections">
        <div class="uc-section-head">
          <div><b>Conectar projeto</b><small>GitHub, Lovable, Supabase e ChatGPT em um fluxo guiado e automático.</small></div>
          <span>${icon("link")}</span>
        </div>

        <div class="uc-connect-auto uc-connect-auto-simple" id="uc-connect-auto" data-state="idle">
          <div><span>${icon("link")}</span><div><b>Conectar e começar</b><small id="uc-connect-auto-status">Autorize o GitHub uma vez. Depois a extensão encontra o repositório/branch da Lovable, detecta Supabase e reutiliza a IA selecionada; uma nova guia só é aberta quando realmente necessário.</small></div></div>
          <button data-action="auto-connect-all">${icon("github")}Conectar GitHub + ChatGPT</button>
          <div class="uc-simple-device-code" id="uc-github-device-simple" hidden>
            <small>Código temporário do GitHub</small>
            <div class="uc-simple-device-code-row">
              <input id="uc-github-device-code-input" data-uc-copy-allowed="true" type="text" readonly value="" aria-label="Código temporário de autorização GitHub">
              <button type="button" data-action="github-device-copy" title="Copiar código GitHub">${icon("copy")}Copiar</button>
            </div>
            <span id="uc-github-device-copy-hint">Use Ctrl+C ou o botão Copiar e cole na guia oficial do GitHub.</span>
          </div>
          <div class="uc-simple-status">
            <div id="uc-simple-github" data-state="idle"><i></i><b>GitHub</b><small>aguardando</small></div>
            <div id="uc-simple-project" data-state="idle"><i></i><b>Projeto Lovable</b><small>aguardando</small></div>
            <div id="uc-simple-chatgpt" data-state="idle"><i></i><b>ChatGPT</b><small>aguardando</small></div>
          </div>
          <div class="uc-connect-auto-track"><i id="uc-connect-auto-progress"></i></div>
        </div>

        <details class="uc-connect-manual">
          <summary>Configuração avançada e diagnóstico</summary>
          <div class="uc-connect-manual-body">
        <div class="uc-connect-overview">
          <div data-connection-state="github"><span>${icon("github")}</span><div><small>GITHUB</small><b id="uc-connect-github-summary">Não conectado</b></div><i></i></div>
          <div data-connection-state="lovable"><span>${icon("link")}</span><div><small>LOVABLE SYNC</small><b id="uc-connect-lovable-summary">Não confirmado</b></div><i></i></div>
          <div data-connection-state="project"><span>${icon("folder")}</span><div><small>REPO + BRANCH</small><b id="uc-connect-project-summary">Aguardando</b></div><i></i></div>
          <div data-connection-state="supabase"><span>${icon("db")}</span><div><small>SUPABASE</small><b id="uc-connect-supabase-summary">Aguardando</b></div><i></i></div>
          <div data-connection-state="ai"><span>${icon("wand")}</span><div><small>IA</small><b id="uc-connect-ai-summary">Verificando</b></div><i></i></div>
        </div>

        <div class="uc-connect-card">
          <div class="uc-connect-card-head"><span>${icon("github")}</span><div><b>1. GitHub</b><small>Use sua própria conta. A extensão nunca utiliza credenciais do desenvolvedor.</small></div></div>
          <div class="uc-connect-actions-row">
            <button class="primary" data-action="github-oauth-start">${icon("github")}Login GitHub</button>
            <button data-action="github-refresh">${icon("refresh")}Atualizar</button>
            <button data-action="github-disconnect">Desconectar</button>
          </div>
          <details class="uc-connect-advanced">
            <summary>Configuração avançada / administrador</summary>
            <div class="uc-oauth-autosetup">
              <div><b>OAuth oficial da Unstoppable Corp</b><small>A configuração guiada preenche automaticamente o cadastro do GitHub com os dados oficiais e captura o Client ID. O GitHub pode exigir login, 2FA ou uma confirmação final por segurança.</small></div>
              <div class="uc-oauth-spec"><span>App</span><b>Unstoppable Corp.</b><span>Homepage</span><b>https://unscorp.lovable.app</b><span>Callback</span><b>https://unscorp.lovable.app/auth</b><span>Device Flow</span><b>Ativado automaticamente quando a página permitir</b></div>
              <button class="primary uc-oauth-setup-button" data-action="github-oauth-auto-setup">Configurar OAuth automaticamente</button>
            </div>
            <label>GitHub OAuth Client ID <small>Preenchido automaticamente após a configuração oficial. Também pode ser informado manualmente como fallback.</small></label>
            <input id="uc-github-client-id" autocomplete="off" spellcheck="false" placeholder="Será preenchido automaticamente">
            <label>Fine-grained Personal Access Token <small>Alternativa de contingência. Use apenas um token da própria conta do cliente.</small></label>
            <div class="uc-connect-inline"><input id="uc-github-token" type="password" autocomplete="off" placeholder="github_pat_..."><button data-action="github-token-connect">Conectar token</button></div>
            <label class="uc-connect-check"><input id="uc-github-remember" type="checkbox" checked> Manter conexão neste navegador</label>
          </details>
          <div class="uc-connect-device" id="uc-github-device" hidden><small>Código de autorização</small><b id="uc-github-device-code">—</b><span>Autorize na página do GitHub que foi aberta. A extensão concluirá automaticamente.</span></div>
          <small class="uc-connect-status" id="uc-github-status-detail">Verificando autenticação...</small>
        </div>

        <div class="uc-connect-card uc-lovable-sync-card" id="uc-lovable-sync-card">
          <div class="uc-connect-card-head"><span>${icon("link")}</span><div><b>2. Lovable ↔ GitHub Sync</b><small>Obrigatório para que commits feitos pela extensão apareçam no editor e preview da Lovable.</small></div></div>
          <div class="uc-lovable-sync-callout">
            <b>Não basta selecionar qualquer repositório.</b>
            <span>O projeto precisa estar conectado pelo Git sync oficial da Lovable. A extensão detecta também vínculos já existentes e usa exatamente o repositório e a branch exibidos como Connected nas configurações do projeto.</span>
          </div>
          <div class="uc-connect-actions-row">
            <button class="primary" data-action="lovable-git-start">${icon("github")}Conectar pela Lovable</button>
            <button data-action="lovable-git-detect">${icon("refresh")}Detectar vínculo</button>
          </div>
          <div class="uc-lovable-steps" id="uc-lovable-sync-steps" hidden>
            <span><i>1</i>Na Lovable, abra <b>Project settings → Git → GitHub</b> (ou + no chat → GitHub).</span>
            <span><i>2</i>Instale/autorize o <b>Lovable GitHub App</b> na sua própria conta.</span>
            <span><i>3</i>Confirme que a área <b>Repository connection</b> mostra o repositório, a branch correta e o status <b>Connected</b>. Se ainda não existir vínculo, use Connect/Sync my Code.</span>
            <span><i>4</i>Volte aqui e clique em <b>Detectar vínculo</b>. A extensão lerá o repositório e a branch já conectados pela própria tela da Lovable.</span>
          </div>
          <small class="uc-connect-status" id="uc-lovable-sync-status">Verificando se este projeto Lovable possui Git sync nativo.</small>
          <small class="uc-connect-hint"><b>O que vale:</b> Project settings → Git → <b>Repository connection</b> com Repository, Branch e <b>Connected</b>. A tela Connectors → GitHub API é separada; “Projects 0” nela não significa que o Git sync do projeto esteja desconectado.</small>
        </div>

        <div class="uc-connect-card">
          <div class="uc-connect-card-head"><span>${icon("folder")}</span><div><b>3. Repositório e branch</b><small>Use exatamente o repositório criado/vinculado pela Lovable para este projeto.</small></div></div>
          <label>Repositório</label>
          <select id="uc-github-repo"><option value="">Conecte o GitHub primeiro</option></select>
          <label>Branch</label>
          <div class="uc-connect-inline"><select id="uc-github-branch"><option value="">Selecione o repositório</option></select><button data-action="github-load-branches">${icon("refresh")}Branches</button></div>
          <div class="uc-connect-actions-row"><button data-action="github-test-access">${icon("check")}Testar leitura e escrita</button></div>
          <small class="uc-connect-status" id="uc-repo-status-detail">Nenhum repositório vinculado a este projeto Lovable.</small>
          <small class="uc-connect-hint">A IA não precisa ter o GitHub conectado dentro do ChatGPT. A própria extensão lê o contexto e grava o commit usando a conexão acima.</small>
        </div>

        <div class="uc-connect-card">
          <div class="uc-connect-card-head"><span>${icon("db")}</span><div><b>4. Supabase</b><small>Detecte automaticamente a configuração pública do repositório ou informe seu próprio projeto.</small></div></div>
          <div class="uc-connect-actions-row"><button class="primary" data-action="detect-supabase">${icon("wand")}Detectar no repositório</button><button data-action="test-supabase">${icon("check")}Testar</button></div>
          <label>Project Ref</label><input id="uc-supabase-ref" autocomplete="off" placeholder="abcdefghijklmnopqrst">
          <label>Project URL</label><input id="uc-supabase-url" autocomplete="off" placeholder="https://SEU-PROJETO.supabase.co">
          <label>Publishable / anon key <small>Somente chave pública do próprio cliente. Nunca use service_role.</small></label><input id="uc-supabase-key" type="password" autocomplete="off" placeholder="sb_publishable_... ou anon key">
          <details class="uc-connect-advanced uc-supabase-management">
            <summary>Backend avançado · migrations automáticas</summary>
            <div class="uc-lovable-sync-callout"><b>Opcional para alterações administrativas no Supabase</b><span>Use um Personal Access Token da própria conta do cliente. Ele fica somente no armazenamento da extensão e nunca é enviado para a IA ou salvo no repositório.</span></div>
            <label>Supabase Personal Access Token</label>
            <div class="uc-connect-inline"><input id="uc-supabase-pat" type="password" autocomplete="off" placeholder="sbp_..."><button data-action="supabase-management-connect">Conectar</button></div>
            <label class="uc-connect-check"><input id="uc-supabase-pat-remember" type="checkbox"> Manter neste navegador</label>
            <div class="uc-connect-actions-row"><button data-action="supabase-management-status">Testar acesso admin</button><button data-action="supabase-management-disconnect">Desconectar admin</button></div>
            <small class="uc-connect-status" id="uc-supabase-management-status">Não conectado. Migrations permanecerão apenas versionadas no GitHub até este acesso ser autorizado.</small>
          </details>
          <small class="uc-connect-status" id="uc-supabase-status-detail">Aguardando configuração.</small>
        </div>

        <div class="uc-connect-card">
          <div class="uc-connect-card-head"><span>${icon("wand")}</span><div><b>5. Modelos de IA</b><small>Faça login diretamente nos sites oficiais usando sua própria conta.</small></div></div>
          <div class="uc-ai-connect-grid">
            <button data-connect-ai="chatgpt"><span>${brand("chatgpt")}</span><div><b>ChatGPT</b><small id="uc-ai-status-chatgpt">Verificar</small></div></button>
            <button data-connect-ai="gemini"><span>${brand("gemini")}</span><div><b>Gemini</b><small id="uc-ai-status-gemini">Verificar</small></div></button>
            <button data-connect-ai="claude"><span>${brand("claude")}</span><div><b>Claude</b><small id="uc-ai-status-claude">Verificar</small></div></button>
            <button data-connect-ai="deepseek"><span>${brand("deepseek")}</span><div><b>DeepSeek</b><small id="uc-ai-status-deepseek">Verificar</small></div></button>
          </div>
        </div>

        <button class="uc-connect-save" data-action="save-connections">${icon("check")}Salvar e vincular ao projeto atual</button>
        <p class="uc-connect-footnote">Credenciais privadas de GitHub ficam somente no armazenamento da extensão neste navegador. O Git sync da Lovable é uma autorização separada, feita pelo GitHub App oficial da Lovable. A extensão nunca usa credenciais do desenvolvedor da Unstoppable Corp.</p>
          </div>
        </details>
      </div>

      <div class="uc-section" data-panel="project">
        <div class="uc-section-head">
          <div><b>Baixar Projeto</b><small>Baixe uma cópia da branch conectada sem expor o nome do repositório nesta tela</small></div>
        </div>
        <div class="uc-info-grid">
          <div><span>Lovable</span><b id="uc-project-id">—</b></div>
          <div><span>GitHub</span><b id="uc-project-repo">—</b></div>
          <div><span>Branch</span><b id="uc-project-branch">—</b></div>
          <div><span>Supabase</span><b id="uc-project-supa">—</b></div>
        </div>
        <div class="uc-action-grid">
          <button data-section="connections">${icon("link")}Conectar projeto</button>
          <button data-action="github">${icon("github")}Abrir GitHub</button>
          <button data-action="download">${icon("download")}Baixar projeto</button>
          <button data-action="supabase">${icon("db")}Supabase</button>
          <button data-action="publish">${icon("publish")}Publicar</button>
          <button data-action="project-guide">${icon("terminal")}Tutorial IA + GitHub</button>
        </div>
      </div>

      <div class="uc-section" data-panel="tools">
        <div class="uc-section-head">
          <div><b>Proteção e conexões</b><small>Controle de sessão e bloqueio do Lovable</small></div>
        </div>

        <div class="uc-protection-fixed">
          <span class="uc-lock-icon">${icon("lock")}</span>
          <div><b>Proteção automática do Lovable</b><small id="uc-lock-text">Ativa somente dentro de projetos</small></div>
          <i></i>
        </div>

        <div class="uc-connection-list">
          <button data-section="connections">
            <span>${icon("link")}</span>
            <div><b>Central de Conexões</b><small>GitHub · branch · Supabase · Multi-IA</small></div>
          </button>
          <button data-action="connect-chat">
            <span>${brand("chatgpt")}</span>
            <div><b>ChatGPT</b><small id="uc-chat-status">Verificando...</small></div>
          </button>
          <button data-action="toggle-login">
            <span>${icon("db")}</span>
            <div><b>Supabase Auth avançado</b><small id="uc-supa-status">Opcional para executor por API</small></div>
          </button>
          <button data-action="sound">
            <span>${icon("sound")}</span>
            <div><b>Sons</b><small id="uc-sound-status">Ativados</small></div>
          </button>
          <button data-action="notifications">
            <span>${icon("bell")}</span>
            <div><b>Notificações</b><small id="uc-notification-status">Ativadas</small></div>
          </button>
        </div>

        <div class="uc-login" id="uc-login">
          <input id="uc-email" type="email" placeholder="E-mail do Supabase Auth">
          <input id="uc-password" type="password" placeholder="Senha">
          <button data-action="supa-submit">Entrar</button>
        </div>

        <p class="uc-protect-note">
          A proteção é ativada automaticamente apenas ao abrir uma página de projeto no Lovable. O controle de desativação foi removido para evitar falhas e uso acidental do chat nativo.
        </p>
      </div>

      <div class="uc-section" data-panel="account">
        <div class="uc-section-head">
          <div><b>Minha conta</b><small>Licença e economia estimada de uso</small></div>
          <span>${icon("user")}</span>
        </div>
        <div class="uc-account-hero">
          <span>${icon("user")}</span><div><small>ACESSO</small><b id="uc-account-access">Validando...</b><em id="uc-account-version">Versão atual</em></div>
        </div>
        <div class="uc-saving-card">
          <div class="uc-saving-row"><span>Economia de referência</span><b id="uc-account-savings">R$ 0,00</b></div>
          <div class="uc-saving-track"><i id="uc-saving-bar"></i></div>
          <small id="uc-saving-method">Estimativa baseada nos exemplos oficiais de consumo da Lovable e no valor de referência do plano Pro. O valor real varia por plano, modo e complexidade.</small>
        </div>
        <div class="uc-account-grid uc-account-grid-4">
          <div><span>Execuções concluídas</span><b id="uc-account-commands">0</b></div>
          <div><span>Créditos Lovable evitados</span><b id="uc-account-credits">0</b></div>
          <div><span>Média por execução</span><b id="uc-account-average">0,00</b></div>
          <div><span>Referência / crédito</span><b id="uc-account-rate">R$ 0,00</b></div>
        </div>
        <div class="uc-account-history"><b>Histórico recente</b><div id="uc-account-history"><small>Nenhum comando registrado.</small></div></div>
        <button class="uc-account-refresh" data-action="refresh-account">${icon("refresh")}Atualizar dados</button>
      </div>
    </section>

    <div class="uc-provider-connect" id="uc-provider-connect" aria-hidden="true">
      <button class="uc-provider-backdrop" data-action="close-provider" aria-label="Fechar conexão"></button>
      <section class="uc-provider-card" role="dialog" aria-modal="true" aria-labelledby="uc-provider-name">
        <header>
          <div class="uc-provider-identity">
            <span id="uc-provider-logo"></span>
            <div><small>CONEXÃO DO MODELO</small><b id="uc-provider-name">Modelo</b><em id="uc-provider-sub">Verificando...</em></div>
          </div>
          <button data-action="close-provider" aria-label="Fechar">${icon("x")}</button>
        </header>

        <div class="uc-provider-health" id="uc-provider-health" data-state="checking">
          <span></span>
          <div><b id="uc-provider-health-title">Verificando conexão</b><small id="uc-provider-health-text">Aguarde...</small></div>
        </div>

        <div class="uc-provider-explain" id="uc-provider-explain"></div>

        <div class="uc-provider-account" id="uc-provider-account">
          <span>${icon("lock")}</span><div><b>Conta obrigatória</b><small id="uc-provider-account-text">Valide sua sessão para selecionar este agente.</small></div>
        </div>

        <details class="uc-provider-guide" open>
          <summary>${icon("terminal")} Como conectar esta IA ao GitHub</summary>
          <div id="uc-provider-guide-content"></div>
          <pre id="uc-provider-terminal"></pre>
          <div class="uc-provider-guide-actions">
            <button data-action="download-provider-guide">${icon("download")}Baixar instrução</button>
            <button data-action="open-provider-github">${icon("github")}Abrir GitHub</button>
          </div>
        </details>

        <div class="uc-provider-login" id="uc-provider-login">
          <input id="uc-provider-email" type="email" placeholder="E-mail do Supabase Auth">
          <input id="uc-provider-password" type="password" placeholder="Senha">
          <button data-action="provider-supa-login">Entrar e validar</button>
        </div>

        <div class="uc-provider-actions">
          <button class="primary" data-action="connect-provider">${icon("link")}<span id="uc-provider-connect-label">Conectar modelo</span></button>
          <button data-action="test-provider">${icon("check")}Testar</button>
          <button data-action="repair-provider" id="uc-provider-repair">${icon("refresh")}Reparar</button>
          <button data-action="provider-supabase" id="uc-provider-supabase">${icon("db")}Supabase</button>
        </div>

        <p class="uc-provider-note" id="uc-provider-note"></p>
      </section>
    </div>

    <div class="uc-toast" role="status"></div>
  `;
document.documentElement.appendChild(root);

const $ = selector => root.querySelector(selector);
const $$ = selector => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ??"")
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");

const featureForSection = section => ({skills:"skills",shortcuts:"shortcuts",project:"download_project",tools:"protection"})[section] || null;
const featureForAction = action => ({download:"download_project","clear-skills":"skills"})[action] || null;
const canUseFeature = feature => !feature || state.licenseCapabilities?.[feature] !== false;
function applyLicenseAccess(result){
if(!result?.active) return;
root.classList.remove("uc-license-pending");
state.licenseRole=String(result.role||"customer");
state.licenseCapabilities=result.capabilities||{command:true,connections:true,watermark:true,account:true,whatsapp:true,skills:true,shortcuts:state.licenseRole!=="limited",download_project:state.licenseRole!=="limited",protection:state.licenseRole!=="limited"};
if(state.licenseRole==="limited") state.licenseCapabilities={...state.licenseCapabilities,skills:true};
const restricted=[["shortcuts","shortcuts"],["project","download_project"],["tools","protection"]];
for(const [section,feature] of restricted){
const btn=root.querySelector(`.uc-dock-btn[data-section="${section}"]`);
if(!btn) continue;
const blocked=!canUseFeature(feature);
btn.classList.toggle("uc-license-restricted",blocked);
btn.setAttribute("aria-disabled",blocked?"true":"false");
btn.title=blocked?"Não disponível no Acesso Limitado - UNST Corp.":"";
}
const watermarkId=String(result.watermark_id||result.install_watermark||"").trim();
if(watermarkId){
root.dataset.licenseMark=watermarkId;
root.querySelectorAll(".uc-window,.uc-dock").forEach(el=>el.dataset.licenseMark=`UNST CORP · ${watermarkId}`);
const win=root.querySelector(".uc-window");
if(win){
let layer=win.querySelector(":scope > .uc-forensic-layer");
if(!layer){ layer=document.createElement("div"); layer.className="uc-forensic-layer"; win.appendChild(layer); }
layer.innerHTML=Array.from({length:7},(_,i)=>`<span data-i="${i}">UNST CORP · ${escapeHtml(watermarkId)}</span>`).join("");
}
}
if(state.licenseRole==="limited"){
if(["shortcuts","project","tools"].includes(state.panel)) switchPanel("chat");
}
}

let licenseGate = null;
function ensureLicenseGate() {
if (licenseGate?.isConnected) return licenseGate;
licenseGate = document.createElement("div");
licenseGate.id ="uc-license-gate";
licenseGate.innerHTML =`<div class="uc-license-card"><div class="uc-license-success-burst" aria-hidden="true"><span>${icon("check")}</span></div><div class="uc-license-brand"><img src="${chrome.runtime.getURL("assets/unstoppable-128.png")}"><div><small>UNSTOPPABLE CORP</small><b>Ative seu acesso vitalício</b></div></div><p>Insira a key recebida após a compra. Enquanto a licença não for validada, o Lovable permanece protegido e indisponível para interação.</p><label>KEY DE ACESSO</label><div class="uc-license-input"><input id="uc-license-key" autocomplete="off" spellcheck="false" inputmode="text" placeholder="UC-XXXX-XXXX-XXXX" aria-describedby="uc-license-message"><button id="uc-license-submit">${icon("unlock")}<span>Ativar</span></button></div><small id="uc-license-message"><i>${icon("lock")}</i><span>Validação segura pelo servidor.</span></small><button class="uc-license-whatsapp" id="uc-license-whatsapp" type="button"><img src="${chrome.runtime.getURL("assets/providers/whatsapp.png")}" alt=""><span><b>Adquirir licença vitalícia</b><small>Fale comigo pelo WhatsApp</small></span>${icon("link")}</button></div>`;
document.documentElement.appendChild(licenseGate);
licenseGate.querySelector("#uc-license-submit").addEventListener("click",activateEnteredLicense);
licenseGate.querySelector("#uc-license-whatsapp")?.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"OPEN_SUPPORT",source:"activation"});tone("message");});
const licenseInput=licenseGate.querySelector("#uc-license-key");
licenseInput.addEventListener("keydown",e=>{if(e.key==="Enter") activateEnteredLicense();});
licenseInput.addEventListener("input",()=>{
licenseGate.classList.remove("invalid");
licenseInput.removeAttribute("aria-invalid");
const msg=licenseGate.querySelector("#uc-license-message");
if(msg) msg.innerHTML=`<i>${icon("lock")}</i><span>Validação segura pelo servidor.</span>`;
});
return licenseGate;
}
async function activateEnteredLicense() {
const gate=ensureLicenseGate();
const input=gate.querySelector("#uc-license-key");
const msg=gate.querySelector("#uc-license-message");
const submit=gate.querySelector("#uc-license-submit");
const key=String(input.value||"").trim();
const setMessage=(kind,text)=>{
const glyph=kind==="success"?"check":kind==="error"?"x":"lock";
msg.innerHTML=`<i>${icon(glyph)}</i><span>${escapeHtml(text)}</span>`;
};
gate.classList.remove("invalid","success");
if(!key){
gate.classList.add("invalid"); input.setAttribute("aria-invalid","true"); setMessage("error","Informe sua key de acesso."); input.focus(); return;
}
gate.classList.add("loading"); submit.disabled=true; setMessage("info","Validando sua licença com segurança...");
let result=null;
try { result=await chrome.runtime.sendMessage({type:"ACTIVATE_LICENSE",licenseKey:key}); }
catch(error){ result={ok:false,error:"LICENSE_NETWORK_ERROR",detail:String(error)}; }
gate.classList.remove("loading"); submit.disabled=false;
if(result?.ok&&result?.active){
applyLicenseAccess(result);
input.removeAttribute("aria-invalid"); gate.classList.add("success");
setMessage("success","Key autenticada com sucesso. Acesso liberado!");
tone("success");
await refreshAccount(true).catch(()=>null);
setTimeout(()=>{gate.classList.add("leaving");setTimeout(()=>{gate.remove();licenseGate=null;},430);},1050);
return;
}
gate.classList.add("invalid"); input.setAttribute("aria-invalid","true"); tone("error");
const copy=result?.error==="ACTIVATION_LIMIT_REACHED"?"Esta key atingiu o limite de ativações.":result?.error==="TOO_MANY_ATTEMPTS"?"Muitas tentativas. Aguarde alguns minutos.":result?.error==="LICENSE_NETWORK_ERROR"?"Não foi possível acessar o servidor de licenças. Verifique sua conexão.":"Key inválida, expirada ou indisponível.";
setMessage("error",copy);
input.focus(); input.select();
}
async function enforceLicense() {
const result=await chrome.runtime.sendMessage({type:"GET_LICENSE_STATUS",force:true});
if(result?.ok&&result?.active){applyLicenseAccess(result);licenseGate?.remove();licenseGate=null;return true;}
const gate=ensureLicenseGate();
if(result?.error==="INCOGNITO_LICENSE_REQUIRED"){
const title=gate.querySelector(".uc-license-brand b");
const paragraph=gate.querySelector(".uc-license-card>p");
const msg=gate.querySelector("#uc-license-message");
if(title) title.textContent="Valide sua key no modo anônimo";
if(paragraph) paragraph.textContent="Por segurança, sessões anônimas não reutilizam a licença da navegação normal. Digite sua key novamente para liberar esta guia.";
if(msg) msg.innerHTML=`<i>${icon("lock")}</i><span>Modo anônimo detectado. A validação vale somente para esta guia.</span>`;
}
if(result?.error==="EXTENSION_INTEGRITY_LOCKED" || result?.error==="EXTENSION_INTEGRITY_MISMATCH" || result?.error==="EXTENSION_INTEGRITY_INCOMPLETE"){
gate.classList.add("invalid");
const msg=gate.querySelector("#uc-license-message");
if(msg) msg.innerHTML=`<i>${icon("lock")}</i><span>Integridade da extensão alterada. As funções foram bloqueadas. Reinstale uma cópia oficial.</span>`;
const submit=gate.querySelector("#uc-license-submit"); if(submit) submit.disabled=true;
const input=gate.querySelector("#uc-license-key"); if(input) input.disabled=true;
}
return false;
}
async function refreshAccount(force=false) {
const result=await chrome.runtime.sendMessage({type:"GET_ACCOUNT_STATS",force});
if(!result?.ok||!result?.active) return;
applyLicenseAccess(result);
const a=result.account||{};
const access=$("#uc-account-access"), ver=$("#uc-account-version"), savings=$("#uc-account-savings"), commands=$("#uc-account-commands"), credits=$("#uc-account-credits"), average=$("#uc-account-average"), rate=$("#uc-account-rate"), bar=$("#uc-saving-bar"), hist=$("#uc-account-history");
const totalCommands=Number(a.commands||0);
const totalCredits=Number(a.estimated_credits||0);
const brlPerCredit=Number(a.estimated_brl_per_credit||0);
if(access) access.textContent=result.role==="limited"?"Acesso Limitado - UNST Corp.":(result.lifetime?"Vitalício · ativo":"Ativo");
if(ver) ver.textContent=`Acesso à versão ${result.entitlement_version||"atual"}`;
if(savings) savings.textContent=Number(a.estimated_savings_brl||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
if(commands) commands.textContent=String(totalCommands);
if(credits) credits.textContent=totalCredits.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
if(average) average.textContent=(totalCommands?totalCredits/totalCommands:0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
if(rate) rate.textContent=brlPerCredit.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
if(bar) bar.style.width=`${Math.min(100,Math.max(totalCommands?8:0,totalCredits*7))}%`;
if(hist){
const rows=Array.isArray(a.history)?a.history.slice(0,8):[];
hist.innerHTML=rows.length?rows.map(r=>{
const c=Number(r.estimated_credits||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const v=Number(r.estimated_savings_brl||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
return`<div><span>${escapeHtml(r.provider||"IA")} · ${c} cr · ${v}</span><small>${new Date(r.created_at).toLocaleString("pt-BR")}</small></div>`;
}).join(""):"<small>Nenhuma execução concluída registrada.</small>";
}
}

function tone(kind="click") {
if (!state.config?.soundsEnabled) return;
chrome.runtime.sendMessage({type:"PLAY_SOUND",kind}).catch?.(()=>null);
}

function toast(text,kind="tap") {
tone(kind);
const el = $(".uc-toast");
el.textContent = text;
el.classList.add("show");
clearTimeout(toast.timer);
toast.timer = setTimeout(() => el.classList.remove("show"),2300);
}

root.addEventListener("contextmenu",event=>{
const target=event.target instanceof Element?event.target:null;
if(target?.closest("input,textarea,[contenteditable='true']")) return;
event.preventDefault();
toast("Interface protegida por direitos autorais UNST Corp.","tap");
});
root.addEventListener("copy",event=>{
const target=event.target instanceof Element?event.target:null;

if(target?.closest("[data-uc-copy-allowed='true'],input:not([readonly]),textarea,[contenteditable='true']")) return;
const selection=String(window.getSelection?.()||"");
if(selection){ event.preventDefault(); toast("Cópia direta da interface bloqueada.","tap"); }
});
window.addEventListener("keyup",event=>{
if(event.key!=="PrintScreen") return;
root.classList.add("uc-capture-notice");
toast("Conteúdo licenciado · marca d'água da instalação ativa.","tap");
setTimeout(()=>root.classList.remove("uc-capture-notice"),1800);
},true);

async function loadSkills() {
if(!canUseFeature("skills")){
state.skills=[]; state.selected.clear();
const list=$("#uc-skill-list"); if(list) list.innerHTML='<div class="uc-limited-note">Skills indisponíveis no Acesso Limitado - UNST Corp.</div>';
const count=$("#uc-skill-count"); if(count) count.textContent="0";
const selected=$("#uc-skills-selected"); if(selected) selected.textContent="Recurso bloqueado nesta licença";
return;
}
const index = await fetch(chrome.runtime.getURL("skills/index.json")).then(r => r.json());
state.skills = await Promise.all(index.map(async item => {
const content = await fetch(chrome.runtime.getURL(item.arquivo)).then(r => r.text());
const description = item.description
|| content.match(/^description:\s*(.+)$/m)?.[1]?.trim()
||"Skill especializada para melhorar a qualidade da implementação.";
return {
...item,
nicho:item.nicho || item.categoria ||"Outras",
content,
description,
featured:FEATURED_SKILLS.has(item.id)
};
}));

const saved = (await chrome.storage.local.get("unstoppableSelectedSkills")).unstoppableSelectedSkills;
if (Array.isArray(saved)) {
state.selected = new Set(saved.filter(id => state.skills.some(skill => skill.id === id)));
}

renderSkills();
}

function renderSkills(filter=state.skillFilter) {
state.skillFilter = filter ||"Todas";
const search = state.skillSearch.trim().toLowerCase();
const niches = [...new Set(state.skills.map(skill => skill.nicho || skill.categoria ||"Outras"))];

const filterItems = [
{label:"Recomendadas",value:"Recomendadas",count:state.skills.filter(skill => skill.featured).length},
{label:"Todas",value:"Todas",count:state.skills.length},
{label:"Ativas",value:"Ativas",count:state.selected.size},
...niches.map(nicho => ({
label:nicho,
value:nicho,
count:state.skills.filter(skill => (skill.nicho || skill.categoria) === nicho).length
}))
];

$("#uc-skill-filters").innerHTML = filterItems.map(item =>`
      <button data-filter="${escapeHtml(item.value)}" class="${item.value===state.skillFilter ?"active" :""}">
        ${item.value ==="Recomendadas" ? icon("star") :""}${escapeHtml(item.label)} <b>${item.count}</b>
      </button>
    `).join("");

const list = state.skills.filter(skill => {
if (state.skillFilter ==="Ativas" && !state.selected.has(skill.id)) return false;
if (state.skillFilter ==="Recomendadas" && !skill.featured) return false;
if (!["Todas","Ativas","Recomendadas"].includes(state.skillFilter) && (skill.nicho || skill.categoria) !== state.skillFilter) return false;
if (!search) return true;
const haystack = [skill.nome,skill.description,skill.nicho,skill.categoria,...(skill.tags || [])].join(" ").toLowerCase();
return haystack.includes(search);
}).sort((a,b) => Number(b.featured)-Number(a.featured) || a.nome.localeCompare(b.nome,"pt-BR"));

const grouped = new Map();
list.forEach(skill => {
const group = skill.featured && ["Todas","Recomendadas","Ativas"].includes(state.skillFilter)
?"Melhores para Lovable"
: (skill.nicho || skill.categoria ||"Outras");
if (!grouped.has(group)) grouped.set(group,[]);
grouped.get(group).push(skill);
});

if (!list.length) {
$("#uc-skill-list").innerHTML =`<div class="uc-skill-empty"><b>Nenhuma Skill encontrada</b><small>Ajuste o nicho ou a busca.</small></div>`;
} else {
$("#uc-skill-list").innerHTML = [...grouped.entries()].map(([nicho,skills]) =>`
        <section class="uc-skill-group ${nicho ==="Melhores para Lovable" ?"featured" :""}">
          <header><b>${nicho ==="Melhores para Lovable" ? icon("star") :""}${escapeHtml(nicho)}</b><span>${skills.length}</span></header>
          <div>
            ${skills.map(skill =>`
              <button class="uc-skill ${skill.featured ?"recommended" :""} ${state.selected.has(skill.id) ?"active" :""}" data-skill="${escapeHtml(skill.id)}">
                <i>${skill.featured ? icon("star") :""}</i>
                <div><b>${escapeHtml(skill.nome)}</b><small>${escapeHtml(skill.origem || skill.categoria ||"Skill")}</small><p>${escapeHtml(skill.description)}</p></div>
                <span>${state.selected.has(skill.id) ?"Ativa" :"Ativar"}</span>
              </button>
            `).join("")}
          </div>
        </section>
      `).join("");
}

$("#uc-skill-count").textContent = state.selected.size;
$("#uc-skills-selected").textContent =`${state.selected.size} ativas · ${state.skills.length} disponíveis`;
}

function renderProviders() {
$("#uc-providers").innerHTML = Object.entries(PROVIDERS).map(([id,provider]) =>`
      <button class="${state.provider===id ?"active" :""}" data-provider="${id}" title="${provider.nome} — ${provider.sub}">
        ${brand(provider.brand)}
        <i class="uc-provider-dot" data-provider-dot="${id}"></i>
      </button>
    `).join("");
updateProviderDots();
}

function providerExplanation(provider) {
if (provider ==="chatgpt") {
return"Usa uma única aba autenticada do ChatGPT como ponte. A aba pode ficar em segundo plano; os próximos comandos não abrem novas guias. A conexão precisa estar autenticada e com o campo de mensagem disponível.";
}
if (provider ==="auto") {
return"Escolhe automaticamente uma sessão pronta. Prioriza ChatGPT e depois Gemini, Claude e DeepSeek conectados no navegador; o executor Supabase e o bridge local ficam como rotas avançadas de fallback.";
}
if (provider ==="deepseek-local") {
return"Usa o bridge local em 127.0.0.1:8765 e o agente configurado no seu terminal. O bridge precisa estar iniciado antes do envio.";
}
if (["gemini","claude","deepseek"].includes(provider)) {
return"Usa a sessão web da sua própria conta no site oficial do modelo. A extensão abre ou reutiliza uma aba autenticada e só libera o envio quando encontra o campo de mensagem pronto. Não é necessário inserir API key da IA na extensão.";
}
if (provider ==="custom") {
return"Modo avançado para um executor do seu próprio Supabase. Exige backend configurado e autenticação do seu projeto; não é necessário para ChatGPT, Gemini, Claude ou DeepSeek em modo de sessão web.";
}
return"Conexão do modelo selecionado.";
}

function providerGuide(provider) {

const genericRepo ="SEU_USUARIO/SEU_REPOSITORIO";
const genericBranch ="SUA_BRANCH";
const repoUrl ="https://github.com/";
const model = PROVIDERS[provider]?.nome ||"IA";
const cli = provider ==="claude" ?"claude" : provider ==="gemini" ?"gemini" :"codex";
const accountStep = provider ==="chatgpt"
?"Faça login uma única vez na guia oficial do ChatGPT quando solicitado. Depois disso, a extensão mantém a guia em segundo plano e envia os próximos comandos sem exigir que você a abra."
: provider ==="deepseek-local"
?"Abra o terminal, autentique o agente de IA escolhido e execute `gh auth login` para autorizar o GitHub CLI. A extensão não precisa exibir nem armazenar o nome do seu repositório para ensinar o procedimento."
: provider ==="auto"
?"Autentique pelo menos uma rota disponível: ChatGPT, Gemini, Claude ou DeepSeek no navegador; opcionalmente mantenha um executor Supabase ou agente local como fallback. O modo Automático escolherá somente uma rota pronta."
: provider ==="custom"
?`Entre no Supabase Auth do seu próprio projeto e configure o executor avançado. Nunca cole tokens ou chaves no campo de comando.`
:`Abra o site oficial do ${model}, faça login na sua própria conta e deixe o campo de mensagem disponível. A extensão detectará a sessão automaticamente.`;
const steps = [
accountStep,
"No GitHub, conceda acesso somente ao repositório que você realmente deseja editar. Para preservar sua privacidade, a extensão mostra neste tutorial apenas o exemplo genérico SEU_USUARIO/SEU_REPOSITORIO.",
"Confirme qual branch será alterada. Use uma branch de trabalho quando possível e evite conceder acesso a outros repositórios da sua conta.",
"Se o modelo tiver conector GitHub com permissão de escrita, conecte o repositório por esse conector. Se não tiver, use o fluxo por terminal mostrado abaixo.",
"Abra o projeto no Lovable apenas para visualizar e validar o resultado. As alterações de código devem ser feitas no GitHub pela IA/agente escolhido.",
"Antes de finalizar, peça ao agente para executar build/testes, revisar os arquivos modificados, confirmar o commit e o push e informar que a execução terminou com sucesso."
];
const terminal =`# Exemplo genérico - substitua somente no seu terminal
# 1) autentique o GitHub
gh auth login

# 2) clone o repositório desejado
git clone https://github.com/${genericRepo}.git
cd SEU_REPOSITORIO

# 3) atualize e entre na branch correta
git fetch origin
git checkout ${genericBranch}
git pull --ff-only origin ${genericBranch}

# 4) inicie o agente na pasta do projeto
${cli}

# 5) peça as alterações e valide antes do envio
npm install
npm run build
git status
git diff

# 6) quando estiver correto, crie o commit e envie
git add -A
git commit -m "Unstoppable Corp: melhoria do projeto"
git push origin ${genericBranch}`;
const text =`${model} + GitHub - instrução genérica e privada

${steps.join("\n")}

Terminal:
${terminal}`;
return {model,steps,terminal,text,repoUrl};
}

function renderProviderGuide(provider) {
const guide = providerGuide(provider);
$("#uc-provider-guide-content").innerHTML =`<ol>${guide.steps.map(step =>`<li>${escapeHtml(step)}</li>`).join("")}</ol>`;
$("#uc-provider-terminal").textContent = guide.terminal;
const account = provider ==="chatgpt"
?"Sessão ChatGPT obrigatória"
: provider ==="deepseek-local"
?"Login do agente e GitHub no terminal"
: provider ==="auto"
?"Ao menos uma rota autenticada"
: provider ==="custom" ?`Executor ${guide.model} via Supabase Auth` :`Sessão web ${guide.model}`;
$("#uc-provider-account-text").textContent = state.providerConnectionStatus?.ready
?`${account} · validação concluída`
:`${account} · seleção bloqueada até validar`;
}

async function commitProviderSelection(provider) {
if (!provider) return;
state.provider = provider;
state.pendingProvider = null;
await chrome.runtime.sendMessage({type:"SAVE_CONFIG",config:{provider}});
renderProviders();
}

function providerStatusCopy(provider,status) {
if (!status) return {state:"checking",title:"Verificando conexão",text:"Aguarde enquanto a Unstoppable Corp valida o modelo."};
if (status?.ready) {
const route = status.route ?` Rota ativa: ${PROVIDERS[status.route]?.nome || status.route}.` :"";
return {state:"ready",title:"Conexão pronta",text:`O modelo está pronto para receber comandos.${route}`};
}
const error = status?.error ||"";
if (error ==="CHATGPT_LOGIN_REQUIRED" || error ==="AI_LOGIN_REQUIRED" || status?.state ==="login_required") {
const name = PROVIDERS[provider]?.nome ||"modelo";
return {state:"warning",title:"Login necessário",text:`A aba do ${name} foi localizada. Faça login com sua própria conta; a extensão validará automaticamente quando o campo de mensagem ficar disponível.`};
}
if (error ==="CHATGPT_BUSY" || error ==="AI_BUSY" || status?.state ==="busy") {
const name = PROVIDERS[provider]?.nome ||"IA";
return {
state:"connected",
title:`${name} conectado · aguardando`,
text:"A sessão está conectada e existe uma resposta em andamento. A extensão não recarrega a aba nem interrompe a geração atual."
};
}
if (error ==="SUPABASE_AUTH_REQUIRED" || status?.state ==="auth_required") {
return {state:"warning",title:"Autenticação necessária",text:"Entre no Supabase Auth abaixo para liberar este provedor."};
}
if (error ==="PROVIDER_NOT_CONFIGURED" || status?.state ==="not_configured") {
return {state:"error",title:"API não configurada",text:"A conexão Supabase está ativa, mas a API key deste provedor não foi configurada como Secret no backend."};
}
if (error ==="LOCAL_BRIDGE_OFFLINE" || status?.state ==="offline") {
return {state:"error",title:"Bridge local offline",text:"Inicie o INICIAR-BRIDGE.bat e depois clique em Testar."};
}
if (error ==="AI_TAB_NOT_FOUND" || status?.state ==="missing") {
return {state:"warning",title:"Sessão não encontrada",text:"Clique em Conectar para abrir o site oficial do modelo e faça login com sua própria conta."};
}
if (error ==="CHATGPT_BRIDGE_INJECTION_FAILED") {
return {state:"error",title:"Bridge do ChatGPT bloqueado",text:"A extensão não conseguiu ativar o bridge nesta aba. Atualize o ChatGPT, confirme que a extensão está habilitada para chatgpt.com e use Reparar."};
}
if (error ==="CHATGPT_BRIDGE_NOT_READY" || error ==="CHATGPT_NOT_READY" || error ==="AI_COMPOSER_NOT_FOUND" || error ==="AI_BRIDGE_NOT_READY" || status?.state ==="bridge_loading" || status?.state ==="not_ready") {
return {state:"warning",title:"Sessão carregando",text:"A conta foi aberta, mas o campo de mensagem ainda não está pronto. Aguarde alguns segundos; a extensão continuará verificando e pode reparar a aba sem apagar sua sessão."};
}
if (error ==="NO_PROVIDER_READY" || status?.state ==="no_route") {
return {state:"warning",title:"Nenhuma rota pronta",text:"Conecte pelo menos uma conta de IA: ChatGPT, Gemini, Claude ou DeepSeek."};
}
return {state:"error",title:"Conexão pendente",text:"A conexão ainda não está pronta. Use Conectar ou Reparar e teste novamente."};
}

function updateProviderDots() {
const current = state.providerConnectionStatus;
$$('[data-provider-dot]').forEach(dot => {
const id = dot.dataset.providerDot;
dot.dataset.state = id === state.provider && current?.ready
?"ready"
: id === state.provider && current?.state ==="busy"
?"connected"
: id === state.provider && current
?"warning"
:"idle";
});
}

function renderProviderConnection(status=null) {
const provider = state.providerConnection || state.provider;
const meta = PROVIDERS[provider] || PROVIDERS.auto;
state.providerConnectionStatus = status || state.providerConnectionStatus;

$("#uc-provider-logo").innerHTML = brand(meta.brand);
$("#uc-provider-name").textContent = meta.nome;
$("#uc-provider-sub").textContent = meta.sub;
$("#uc-provider-explain").textContent = providerExplanation(provider);
renderProviderGuide(provider);

const copy = providerStatusCopy(provider,state.providerConnectionStatus);
$("#uc-provider-health").dataset.state = copy.state;
$("#uc-provider-health-title").textContent = copy.title;
$("#uc-provider-health-text").textContent = copy.text;
const connectionState = state.providerConnectionStatus?.state;
$("#uc-provider-connect-label").textContent = state.providerConnectionStatus?.ready
?"Conectado"
: connectionState ==="busy"
?"Aguardar automaticamente"
: connectionState ==="login_required"
?"Abrir sessão"
:"Conectar modelo";

const needsAuth = provider ==="custom" && (state.providerConnectionStatus?.error ==="SUPABASE_AUTH_REQUIRED" || state.providerConnectionStatus?.state ==="auth_required");
$("#uc-provider-login").classList.toggle("show",needsAuth);
$("#uc-provider-account").dataset.state = state.providerConnectionStatus?.ready ?"ready" :"locked";
renderProviderGuide(provider);

const repairButton = $("#uc-provider-repair");
repairButton.style.display = ["chatgpt","gemini","claude","deepseek"].includes(provider) ?"inline-flex" :"none";
repairButton.disabled = ["chatgpt","gemini","claude","deepseek"].includes(provider) && connectionState ==="busy";
repairButton.title = connectionState ==="busy"
?"A recuperação fica desativada enquanto há uma resposta em andamento para não interromper a conversa."
:"Recarregar e recuperar a ponte do ChatGPT";
$("#uc-provider-supabase").style.display = provider ==="custom" ?"inline-flex" :"none";

$("#uc-provider-note").textContent = provider ==="chatgpt"
?"Mantenha uma aba do ChatGPT autenticada. A extensão reutiliza a mesma sessão sem pedir sua senha."
: provider ==="auto"
?"O modo Automático escolhe apenas entre sessões que passaram na validação de conexão. Nenhuma senha de IA é armazenada."
: ["gemini","claude","deepseek"].includes(provider)
?`A extensão usa somente a sessão web já autenticada no ${PROVIDERS[provider].nome}. Sua senha não é lida nem armazenada.`
: provider ==="deepseek-local"
?"O bridge local executa pelo terminal e pode trabalhar com Git/GitHub sem depender do Lovable."
:"O modo personalizado usa apenas o backend Supabase configurado pelo próprio cliente.";
updateProviderDots();
}

async function checkProviderConnection(provider=state.providerConnection || state.provider) {
const status = await chrome.runtime.sendMessage({type:"PROVIDER_STATUS",provider});
state.providerConnectionStatus = status;
renderProviderConnection(status);
if (status?.ready && state.pendingProvider === provider) await commitProviderSelection(provider);
return status;
}

function resumePendingSendIfReady(status) {
if (!status?.ready) return false;
if (state.pendingProvider) commitProviderSelection(state.pendingProvider).catch(()=>null);
if (!state.pendingSend || state.executing) return false;
state.pendingSend = false;
closeProviderConnection({preserveSelection:true});
setTimeout(() => executeCommand({connectionAlreadyChecked:true}).catch(()=>null),250);
return true;
}

async function connectCurrentProvider({repair=false}={}) {
const provider = state.providerConnection || state.provider;
$("#uc-provider-health").dataset.state ="checking";
$("#uc-provider-health-title").textContent = repair ?"Reparando conexão" :"Estabelecendo conexão";
$("#uc-provider-health-text").textContent = provider ==="chatgpt"
?"Localizando a sessão, ativando o bridge e validando o campo de mensagem..."
:"Validando autenticação e disponibilidade do provedor...";

const status = await chrome.runtime.sendMessage({type:"CONNECT_PROVIDER",provider,repair,fresh:!repair && (provider==="chatgpt" || provider==="auto")});
state.providerConnectionStatus = status;
renderProviderConnection(status);

if (status?.ready) {
if (state.pendingProvider === provider) await commitProviderSelection(provider);
toast(`${PROVIDERS[provider].nome} conectado, autenticado e pronto.`,"ok");
clearInterval(state.providerConnectionTimer);
state.providerConnectionTimer = null;
return status;
}

if (
["auto","chatgpt","gemini","claude","deepseek"].includes(provider)
&& ["login_required","not_ready","busy","bridge_loading","missing"].includes(status?.state)
) {
clearInterval(state.providerConnectionTimer);

state.providerConnectionTimer = setInterval(async () => {
const latest = await checkProviderConnection(provider);

if (latest?.ready || state.providerConnection !== provider) {
clearInterval(state.providerConnectionTimer);
state.providerConnectionTimer = null;

if (latest?.ready) {
toast(`${PROVIDERS[provider]?.nome ||"IA"} conectado e livre. Enviando o comando pendente automaticamente.`,"ok");
resumePendingSendIfReady(latest);
}
}
},1500);
}

return status;
}

async function openProviderConnection(provider,{autoConnect=true}={}) {
state.pendingProvider = provider;
state.providerConnection = provider;
state.providerConnectionStatus = null;
root.classList.add("provider-connect-open");
$("#uc-provider-connect").setAttribute("aria-hidden","false");
$("#uc-provider-health").dataset.state ="checking";
$("#uc-provider-health-title").textContent ="Verificando conexão";
$("#uc-provider-health-text").textContent ="Aguarde enquanto a Unstoppable Corp valida o modelo.";
renderProviderConnection(null);

if (autoConnect) await connectCurrentProvider({repair:false});
else await checkProviderConnection(provider);
}

function closeProviderConnection({preserveSelection=false}={}) {
if (!preserveSelection && state.pendingProvider) state.pendingProvider = null;
state.providerConnection = null;
clearInterval(state.providerConnectionTimer);
state.providerConnectionTimer = null;
root.classList.remove("provider-connect-open");
$("#uc-provider-connect").setAttribute("aria-hidden","true");
renderProviders();
}

function parseGithub(url) {
try {
const u = new URL(url);
if (u.hostname !=="github.com") return null;
const parts = u.pathname.split("/").filter(Boolean);
if (parts.length < 2) return null;
const treeIndex = parts.indexOf("tree");
return {
repo:`${parts[0]}/${parts[1].replace(/\.git$/,"")}`,
branch:treeIndex >= 0 ? parts[treeIndex+1] || null : null
};
} catch {
return null;
}
}

function inspectPage() {
const u = new URL(location.href);
const projectId = u.pathname.match(/\/projects\/([0-9a-f-]{20,})/i)?.[1] || null;
const isPreview =/\.lovable\.app$/i.test(u.hostname);
const slug = isPreview ? u.hostname.replace(/\.lovable\.app$/i,"") : null;

let github = null;
for (const link of document.querySelectorAll("a[href*='github.com/']")) {
github = parseGithub(link.href);
if (github) break;
}
let publishedUrl = null;
for (const link of document.querySelectorAll("a[href*='.lovable.app']")) {
try {
const target=new URL(link.href);
if(/\.lovable\.app$/i.test(target.hostname) && !/^id-preview--/i.test(target.hostname)){publishedUrl=target.origin;break;}
} catch {}
}

return {
projectId,
slug,

previewUrl:isPreview ? u.origin : (projectId ?`https://id-preview--${projectId}.lovable.app` : null),
publishedUrl,
editorUrl:projectId ?`https://lovable.dev/projects/${projectId}` : null,
repo:github?.repo || null,
branch:github?.branch || null
};
}

function resolveBinding(detected) {
const bindings = state.config.projectBindings || {};
if (detected.projectId && bindings[detected.projectId]) {

return {
...Object.fromEntries(Object.entries(detected).filter(([,value]) => value)),
...bindings[detected.projectId],
projectId:detected.projectId
};
}

if (detected.slug) {
const known = Object.values(bindings).find(binding =>
binding.slug === detected.slug || binding.previewUrl === detected.previewUrl
);
if (known) {
return {
...Object.fromEntries(Object.entries(detected).filter(([,value]) => value)),
...known,
slug:detected.slug || known.slug,
previewUrl:detected.previewUrl || known.previewUrl
};
}
}

if (detected.repo) {
return {
...detected,
branch:detected.branch || state.config.branch,
supabaseProjectId:state.config.supabaseProjectId,
supabaseUrl:state.config.supabaseUrl,
supabaseDashboardUrl:state.config.supabaseDashboardUrl
};
}

return null;
}

async function detectProject() {
state.detected = inspectPage();
state.binding = resolveBinding(state.detected);
renderBinding();
return state.binding;
}

function renderBinding() {
const binding = state.binding;
$("#uc-repo").textContent = binding?.repo ?"Repositório conectado" :"Repositório não conectado";
$("#uc-branch").textContent = binding?.repo
?"GitHub via extensão confirmado · acesso validado"
:"Conecte o projeto para liberar o envio";

$("#uc-project-id").textContent = binding?.projectId ?"Projeto detectado" :"Não detectado";
$("#uc-project-repo").textContent = binding?.repo ?"Conectado · identidade protegida" :"Não conectado";
$("#uc-project-branch").textContent = binding?.branch ?"Branch confirmada · protegida" :"Não confirmada";
$("#uc-project-supa").textContent = (binding?.supabaseProjectId || state.config?.supabaseProjectId) ?"Backend conectado" :"Não conectado";
$(".uc-project-status").dataset.state = binding?.repo ?"ok" :"error";
}

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
"png","jpg","jpeg","webp","gif","pdf","zip","xlsx","xls","csv","doc","docx","ppt","pptx",
"txt","md","json","js","mjs","cjs","ts","tsx","jsx","html","css","scss","sql","xml","yaml","yml"
]);
const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS_TOTAL_BYTES = 40 * 1024 * 1024;

function attachmentExtension(name="") {
const clean = String(name).toLowerCase().split("?")[0];
return clean.includes(".") ? clean.split(".").pop() :"";
}

function attachmentMime(file) {
if (file.type) return file.type;
const ext = attachmentExtension(file.name);
const map = {
zip:"application/zip",pdf:"application/pdf",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
xls:"application/vnd.ms-excel",csv:"text/csv",doc:"application/msword",
docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",ppt:"application/vnd.ms-powerpoint",
pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",txt:"text/plain",md:"text/markdown",
json:"application/json",js:"text/javascript",mjs:"text/javascript",cjs:"text/javascript",ts:"text/plain",tsx:"text/plain",
jsx:"text/plain",html:"text/html",css:"text/css",scss:"text/plain",sql:"text/plain",xml:"application/xml",
yaml:"text/yaml",yml:"text/yaml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif"
};
return map[ext] ||"application/octet-stream";
}

function formatBytes(bytes=0) {
const value = Number(bytes || 0);
if (value < 1024) return`${value} B`;
if (value < 1024*1024) return`${(value/1024).toFixed(value < 10*1024 ? 1 : 0)} KB`;
return`${(value/(1024*1024)).toFixed(value < 10*1024*1024 ? 1 : 0)} MB`;
}

function fileToData(file) {
return new Promise((resolve,reject) => {
const ext = attachmentExtension(file.name);
if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
reject(new Error(`Formato .${ext ||"desconhecido"} não suportado.`));
return;
}
if (file.size > MAX_ATTACHMENT_BYTES) {
reject(new Error(`${file.name} excede 20 MB.`));
return;
}
const reader = new FileReader();
reader.onload = () => {
const mimeType = attachmentMime(file);
resolve({name:file.name,mimeType,dataUrl:reader.result,size:file.size,kind:mimeType.startsWith("image/") ?"image" :"file"});
};
reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}.`));
reader.readAsDataURL(file);
});
}

async function addAttachments(files) {
const selected = [...(files || [])];
if (!selected.length) return;
const remaining = MAX_ATTACHMENTS - state.attachments.length;
if (remaining <= 0) {
toast(`Limite de ${MAX_ATTACHMENTS} anexos por solicitação.`,"error");
return;
}

let totalBytes = state.attachments.reduce((sum,item) => sum + Number(item.size || 0),0);
for (const file of selected.slice(0,remaining)) {
if (totalBytes + Number(file.size || 0) > MAX_ATTACHMENTS_TOTAL_BYTES) {
toast("Os anexos excedem o limite total de 40 MB.","error");
break;
}
try {
const item = await fileToData(file);
state.attachments.push(item);
totalBytes += Number(item.size || 0);
} catch (error) {
toast(error.message ||"Falha ao anexar arquivo.","error");
}
}
renderAttachments();
}

function renderAttachments() {
const container = $("#uc-attachments");
if (!container) return;
container.innerHTML = state.attachments.map((item,index) => {
const ext = (attachmentExtension(item.name) ||"ARQ").slice(0,5).toUpperCase();
const name = escapeHtml(item.name ||`Anexo ${index+1}`);
const meta = escapeHtml(formatBytes(item.size || 0));
if (item.kind ==="image" && item.dataUrl) {
return`<figure class="uc-attachment-image"><img class="uc-attachment-preview" src="${item.dataUrl}" alt="${name}"><figcaption><b>${name}</b><small>${meta}</small></figcaption><button data-remove="${index}" aria-label="Remover ${name}">${icon("x")}</button></figure>`;
}
return`<article class="uc-attachment-file"><span>${escapeHtml(ext)}</span><div><b title="${name}">${name}</b><small>${meta}</small></div><button data-remove="${index}" aria-label="Remover ${name}">${icon("x")}</button></article>`;
}).join("");
container.classList.toggle("show",state.attachments.length > 0);
}

function selectedSkillObjects() {
return state.skills.filter(skill => state.selected.has(skill.id));
}

function extractSkillDirective(skill) {
const content = String(skill.content ||"");
const promptBlock = content.match(/##\s+O Prompt[\s\S]*?```[^\n]*\n([\s\S]*?)```/i)?.[1]?.trim();
let directive = promptBlock || content
.replace(/^---[\s\S]*?---\s*/,"")
.replace(/^#\s+.+$/m,"")
.trim();

if (directive.length > 1400) directive =`${directive.slice(0,1400).trim()}…`;
return directive;
}

function buildSmartObjective(raw) {
const clean = String(raw ||"").trim();
if (!clean) return"";
if (clean.startsWith("[PROMPT_UNSTOPPABLE_ENRIQUECIDO]")) return clean;

const active = selectedSkillObjects();
const detailed = active.slice(0,8);
const remaining = active.slice(8);
const imageCount = state.attachments.filter(item => item.kind ==="image").length;
const fileCount = state.attachments.length - imageCount;
const visual = state.attachments.length
?`\n- Existem ${state.attachments.length} anexo(s) nesta solicitação${imageCount ?` (${imageCount} imagem(ns)` :""}${fileCount ?`${imageCount ?", " :" ("}${fileCount} arquivo(s)` :""}${imageCount || fileCount ?")" :""}. Analise apenas o conteúdo pertinente ao objetivo. Imagens são referências visuais; documentos, planilhas, ZIPs e arquivos de código devem ser inspecionados quando o agente conectado suportar anexos.`
:"";

const skillBlocks = detailed.length
? detailed.map((skill,index) => {
const directive = extractSkillDirective(skill);
return`### ${index+1}. ${skill.nome}\nNicho: ${skill.nicho || skill.categoria ||"Skill"}\nAplicação: ${skill.description ||"Aplicar metodologia especializada à solicitação."}\nDiretrizes:\n${directive ||"- Aplique a metodologia da Skill ao objetivo original."}`;
}).join("\n\n")
:"Nenhuma Skill especializada está ativa.";

const remainingText = remaining.length
?`\n\nSkills adicionais: ${remaining.map(skill => skill.nome).join(", ")}. Use apenas princípios pertinentes ao objetivo.`
:"";

return`[PROMPT_UNSTOPPABLE_ENRIQUECIDO]
OBJETIVO ORIGINAL DO USUÁRIO:
${clean}

INTERPRETAÇÃO CONTROLADA:
- Preserve integralmente a intenção, o escopo e as restrições do texto original.
- Detalhe a execução sem inventar páginas, funcionalidades, integrações, dados ou mudanças não solicitadas.
- Quando houver ambiguidade menor, escolha a alternativa mais conservadora e compatível com a implementação existente.
- Não substitua o objetivo por uma redesignação ampla do projeto.

CONTEXTO DE EXECUÇÃO:
- Analise primeiro a implementação existente, arquitetura, componentes e padrões antes de editar.
- Aplique somente alterações diretamente relacionadas ao objetivo original.
- Preserve funcionalidades, regras de negócio, identidade visual, responsividade, acessibilidade e integrações não relacionadas.${visual}
- Reutilize componentes, tokens, estilos e utilitários já existentes sempre que isso reduzir duplicação.
- Valide estados de loading, erro, vazio, sucesso, foco, hover, disabled e mobile apenas quando forem afetados.
- Não crie mocks, placeholders, elementos temporários, TODOs ou dados fictícios como solução final.
- Mantenha código limpo, tipado, reutilizável e consistente com o repositório.
- Leia AGENTS.md, README e regras locais relevantes antes de alterar arquivos.
- As Skills são metodologias de apoio; nenhuma delas pode ampliar arbitrariamente o escopo.

SKILLS ATIVAS:
${active.length ? active.map(skill =>`- ${skill.nome} · ${skill.nicho || skill.categoria ||"Skill"}`).join("\n") :"- Nenhuma"}

APLICAÇÃO DAS SKILLS:
${skillBlocks}${remainingText}

CRITÉRIOS DE ACEITE:
1. O objetivo original deve estar implementado de ponta a ponta.
2. Funcionalidades não relacionadas devem permanecer intactas.
3. A interface afetada deve funcionar em desktop e mobile.
4. Estados interativos e assíncronos afetados devem estar consistentes.
5. Build, lint e testes disponíveis devem ser executados; falhas preexistentes devem ser separadas das introduzidas.
6. Não exponha secrets, tokens, chaves ou dados sensíveis.
7. Não faça alterações no Lovable; use o GitHub como fonte de verdade.

ENTREGA FINAL:
Informe objetivamente: diagnóstico, alterações realizadas, arquivos afetados, validações executadas, commit/branch e qualquer limitação real. Não declare sucesso sem evidência.
[/PROMPT_UNSTOPPABLE_ENRIQUECIDO]`;
}

function applyPromptTemplate(text,label="Prompt") {
const input = $("#uc-prompt");
input.value = String(text ||"").trim();
input.dispatchEvent(new Event("input",{bubbles:true}));
input.focus();
switchPanel("chat");
tone("magic");
toast(`${label} aplicado. Revise e envie quando estiver pronto.`,"ok");
}

function selectedSkills() {
return selectedSkillObjects()
.map(skill => ({
id:skill.id,
name:skill.nome,
niche:skill.nicho || skill.categoria ||"Skill",
content:skill.content
}));
}

function buildCommand(objective) {
const b = state.binding || {};
const activeNames = selectedSkillObjects().map(skill => skill.nome).join(", ") ||"nenhuma";
const preview = b.previewUrl || state.detected?.previewUrl ||"";
return`[UC_BUILD_REQUEST_V4]
MODE: IMPLEMENTATION
GITHUB_WRITER: UNSTOPPABLE_EXTENSION_ONLY
REPOSITORY: ${b.repo ||""}
BRANCH: ${b.branch ||""}
LOVABLE_PROJECT_ID: ${b.projectId ||""}
LOVABLE_PREVIEW_URL: ${preview}
SUPABASE_PROJECT_ID: ${b.supabaseProjectId || state.config.supabaseProjectId ||""}
SKILLS: ${activeNames}

USER_OBJECTIVE:
${objective}

EXECUTION_CONTRACT:
- Implemente o objetivo no código real fornecido pela extensão; não responda apenas com diagnóstico.
- NÃO use o conector GitHub nativo desta conversa. A extensão é a única escritora do GitHub e confirmará o commit.
- Leia AGENTS.md/README e preserve arquitetura, funcionalidades e regras existentes.
- Se faltar conteúdo real, retorne needs_files com caminhos exatos; a extensão buscará e continuará automaticamente.
- Para tarefas grandes, entregue lotes coerentes com task_complete=false até finalizar tudo.
- Crie arquivos ausentes quando forem necessários. Nunca invente secrets, tokens ou .env.
- Não edite pelo Lovable. O Lovable é usado como Git Sync, preview e hospedagem do projeto já vinculado.
- Retorne somente a implementação no protocolo UC_CHANGESET_V3 fornecido pela extensão. Não declare commit/push como concluído.
[/UC_BUILD_REQUEST_V4]`;
}

const STAGE_LABELS = {
idle:"Aguardando",aguardando:"Na fila",iniciando:"Iniciando",conectando:"Conectando",
preparando:"Preparando",enviado:"Enviado",executando:"Executando",processando:"Processando",
respondendo:"Respondendo",validando:"Validando",concluido:"Concluído",erro:"Erro"
};

function resetActivityFeed(requestId=null) {
state.activityRequestId = requestId;
state.activitySignatures = new Set();
state.lastResponseDigest ="";
const list = $("#uc-activity-list");
if (list) list.innerHTML ='<li class="empty">Nenhuma atividade registrada.</li>';
const response = $("#uc-response");
if (response) { response.textContent =""; response.classList.remove("show"); }
}

function formatActivityTime(value) {
try { return new Date(value || Date.now()).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
catch { return"agora"; }
}

function appendActivityEvent(event) {
if (!event) return;
const stage = String(event.stage ||"processando");
const text = String(event.text || event.activity ||"Atividade detectada.").trim();
const signature =`${stage}|${text}|${event.activity ||""}|${!!event.done}|${event.error ||""}`;
if (!text || state.activitySignatures.has(signature)) return;
state.activitySignatures.add(signature);

const list = $("#uc-activity-list");
if (!list) return;
list.querySelector(".empty")?.remove();
const item = document.createElement("li");
item.dataset.stage = stage;
item.innerHTML =`<i></i><div><span><b>${escapeHtml(STAGE_LABELS[stage] || stage)}</b><time>${formatActivityTime(event.at)}</time></span><p>${escapeHtml(text)}</p>${event.activity && event.activity !== text ?`<small>${escapeHtml(event.activity)}</small>` :""}</div>`;
list.appendChild(item);
while (list.children.length > 60) list.firstElementChild?.remove();
list.scrollTop = list.scrollHeight;
}

function renderExecutionTimeline(execution) {
if (!execution) return;
if (state.activityRequestId !== execution.requestId) resetActivityFeed(execution.requestId);
const timeline = Array.isArray(execution.timeline) ? execution.timeline : [];
timeline.forEach(appendActivityEvent);
appendActivityEvent({
at:execution.updatedAt,
stage:execution.stage,
text:execution.text,
activity:execution.activity,
done:execution.done,
error:execution.error
});
}

function setExecution(stage,title,text,response="") {
$("#uc-exec").dataset.stage = stage;
$("#uc-exec-title").textContent = title;
$("#uc-exec-text").textContent = text ||"";
const live = $("#uc-live-state");
if (live) live.textContent = stage ==="concluido" ?"Finalizado com sucesso" : stage ==="erro" ?"Interrompido" : (STAGE_LABELS[stage] ||"Em atividade");
appendActivityEvent({stage,text,activity:stage==="concluido" ?"Finalizado com sucesso" : null,at:Date.now(),done:stage==="concluido",error:stage==="erro" ? text : null});

const responseBox = $("#uc-response");
if (responseBox && response) {
const normalized = String(response).trim();
responseBox.textContent = normalized;
responseBox.classList.toggle("show",!!normalized);
responseBox.scrollTop = responseBox.scrollHeight;
}
}

function applyExecutionSnapshot(execution) {
if (!execution || execution.requestId !== state.currentRequestId) return;

let responseText = execution.responseText ||"";
if (execution.response && typeof execution.response ==="object") responseText = JSON.stringify(execution.response,null,2);

renderExecutionTimeline(execution);
setExecution(
execution.stage,
execution.done ? (execution.error ?"Falha" :"Finalizado com sucesso") :"Agente em tempo real",
execution.text || execution.activity || (execution.done && !execution.error
?"Finalizado com sucesso."
:"Aguardando nova atividade do agente..."),
responseText
);

if (execution.stage !== state.lastRenderedStage) {
const previous = state.lastRenderedStage;
state.lastRenderedStage = execution.stage;
if (["executando","processando"].includes(execution.stage) && !["executando","processando"].includes(previous)) tone("processing");
if (execution.stage ==="respondendo") tone("message");
if (execution.stage ==="erro") tone("error");
}

if (execution.done) {
clearInterval(state.poll);
state.poll = null;
if (!execution.error) setExecution("concluido","Finalizado com sucesso",execution.text ||"Finalizado com sucesso.",responseText);
}
}

function startPolling(requestId) {
clearInterval(state.poll);
state.poll = null;
state.currentRequestId = requestId;
state.executionStartedAt = Date.now();
state.lastRenderedStage = null;
resetActivityFeed(requestId);

const poll = async () => {
const result = await chrome.runtime.sendMessage({type:"GET_EXECUTION"});
applyExecutionSnapshot(result?.execution);

};

poll().catch(()=>null);
state.poll = setInterval(() => poll().catch(()=>null),1600);
}

chrome.storage.onChanged.addListener((changes,areaName) => {
if (areaName !=="local" || !changes.unstoppableLastExecution?.newValue) return;
applyExecutionSnapshot(changes.unstoppableLastExecution.newValue);
});

chrome.runtime.onMessage.addListener((message,sender,sendResponse) => {
if (message?.type ==="UNSTOPPABLE_OPEN_PROVIDER_GUIDE") {
root.classList.add("open");
openProviderConnection(state.provider,{autoConnect:false}).finally(() => sendResponse?.({ok:true}));
return true;
}
if (message?.type ==="UNSTOPPABLE_OPEN_CONNECTIONS") {
root.classList.add("open");
switchPanel("connections");
refreshConnectionCenter({forceRepos:false}).finally(() => sendResponse?.({ok:true}));
return true;
}
if (message?.type ==="UNSTOPPABLE_AUTO_CONNECT_ALL") {
root.classList.add("open");
switchPanel("connections");
refreshConnectionCenter({forceRepos:false}).then(()=>autoConfigureConnections()).finally(() => sendResponse?.({ok:true}));
return true;
}
if (message?.type ==="UNSTOPPABLE_GITHUB_COMMIT_APPLIED") {
state.pipelineNotice=message.notice || null;
showLovableSyncActivity(message.notice);
sendResponse?.({ok:true});
return;
}
});

async function validateSelectedProvider() {
const status = await chrome.runtime.sendMessage({type:"PROVIDER_STATUS",provider:state.provider});
state.providerConnectionStatus = status;
updateProviderDots();
if (status?.ready) return {ok:true,status};
return {ok:false,status,error:providerStatusCopy(state.provider,status).text};
}

async function resumePendingCommandAfterSetup(){
if(!state.pendingCommandAfterSetup || state.executing) return false;
state.pendingCommandAfterSetup=false;
switchPanel("chat");
await new Promise(r=>setTimeout(r,180));
executeCommand().catch(()=>null);
return true;
}

async function executeCommand({connectionAlreadyChecked=false} = {}) {
if (state.executing) { toast("Já existe uma solicitação sendo preparada.","tap"); return; }
const rawObjective = $("#uc-prompt").value.trim();
if (!rawObjective) {
toast("Digite o comando.","error");
return;
}

await detectProject();
if (!state.binding?.repo || !state.binding?.branch || (isLovableProjectPage() && !state.binding?.lovableGitSyncConfirmed)) {
state.pendingCommandAfterSetup=true;
root.classList.add("open");
switchPanel("connections");
setExecution("conectando","Conectando projeto automaticamente...","A extensão está pareando Lovable, GitHub, branch, Supabase e sua IA. Você só precisa concluir login/2FA se o serviço oficial solicitar.","",3);
const connected=await autoConfigureConnections().catch(()=>false);
if(!connected){
toast("A configuração automática continuará assim que a autorização necessária for concluída.","tap");
}
return;
}

if (!connectionAlreadyChecked) {
setExecution("conectando","Validando conexão...",`Verificando ${PROVIDERS[state.provider].nome} antes do envio.`,"",4);
let providerCheck = await validateSelectedProvider();
if (!providerCheck.ok) {
state.pendingSend = true;
const simpleProvider=state.provider ==="auto" ?"chatgpt" : state.provider;
setExecution("conectando","Abrindo IA em nova guia",`A extensão está preparando ${PROVIDERS[simpleProvider]?.nome ||"a IA"} automaticamente.`,"",4);
const connected=await chrome.runtime.sendMessage({type:"CONNECT_PROVIDER",provider:simpleProvider,repair:false,fresh:true}).catch(()=>null);
if(connected?.ready){
if(state.provider ==="auto") await commitProviderSelection("chatgpt");
providerCheck={ok:true,status:connected};
state.pendingSend=false;
} else {
await openProviderConnection(simpleProvider,{autoConnect:false});
state.providerConnectionStatus=connected;
renderProviderConnection(connected);
toast(connected?.state==="login_required"?"Faça login na nova guia. O envio continuará quando a sessão estiver pronta.":"A conexão da IA ainda está sendo preparada.","tap");
return;
}
}
}

const attachedImages = state.attachments.filter(item => item.kind ==="image");
if (attachedImages.length && !PROVIDERS[state.provider]?.vision && state.provider !=="auto") {
toast("Este agente pode não interpretar imagens; os demais anexos continuarão disponíveis quando suportados.","tap");
}

const objective = buildSmartObjective(rawObjective);
const requestId = crypto.randomUUID();
state.pendingSend = false;
state.executing = true;

state.lastSoundStage = null;
state.executionStartedAt = Date.now();
setExecution("iniciando","Preparando execução...",`Modelo: ${PROVIDERS[state.provider].nome}`,"", 3);
startPolling(requestId);
tone("send");

const result = await chrome.runtime.sendMessage({
type:"EXECUTE",
requestId,
provider:state.provider,
repo:state.binding.repo,
branch:state.binding.branch,
prompt:buildCommand(objective),
skills:selectedSkills(),
attachments:state.attachments.filter(item => item.kind !=="image"),
images:state.attachments.filter(item => item.kind ==="image"),
lovableProjectId:state.binding?.projectId || state.detected?.projectId || null,
previewUrl:state.binding?.previewUrl || state.detected?.previewUrl || null,
publishedUrl:state.binding?.publishedUrl || state.detected?.publishedUrl || null,
lovableGitSyncConfirmed:!!state.binding?.lovableGitSyncConfirmed,
lovableGitRepo:state.binding?.lovableGitRepo || state.lovableGitSync?.repo || null,
lovableGitBranch:state.binding?.lovableGitBranch || state.lovableGitSync?.branch || null,
requireLovableGitSync:true
});
state.executing = false;

if (!result?.ok) {
if (result?.error ==="CHATGPT_BUSY") {
clearInterval(state.poll);
state.poll = null;
state.executing = false;
state.pendingSend = true;
setExecution(
"aguardando",
"ChatGPT conectado · comando na fila",
"Existe uma resposta em andamento. A extensão enviará automaticamente sua solicitação assim que a sessão ficar livre.",
""
);
await openProviderConnection("chatgpt",{autoConnect:true});
return;
}

if (result?.error ==="CHATGPT_LOGIN_REQUIRED") {
clearInterval(state.poll);
state.poll = null;
state.executing = false;
state.pendingSend = true;
setExecution(
"conectando",
"Login necessário",
"Login do ChatGPT necessário uma única vez. Depois da autenticação, os comandos seguem automaticamente em segundo plano.",
""
);
await openProviderConnection("chatgpt",{autoConnect:true});
return;
}

if (["GITHUB_EXTENSION_REPO_NOT_AUTHORIZED","GITHUB_BRANCH_NOT_FOUND","GITHUB_WRITE_PERMISSION_REQUIRED","GITHUB_BRANCH_PROTECTED_OR_WRITE_DENIED","GITHUB_REPO_UNAVAILABLE","GITHUB_CONTEXT_FAILED","GITHUB_COMMIT_VERIFY_HEAD_MISMATCH","GITHUB_COMMIT_VERIFY_BLOB_MISMATCH","GITHUB_COMMIT_VERIFY_FILE_MISSING"].includes(result?.error)) {
switchPanel("connections");
await refreshConnectionCenter({forceRepos:true}).catch(()=>null);
const copy = result.error ==="GITHUB_EXTENSION_REPO_NOT_AUTHORIZED"
?"O GitHub da extensão não está autorizado para este repositório. Reconecte sua conta e selecione o projeto novamente."
: result.error ==="GITHUB_WRITE_PERMISSION_REQUIRED"
?"O GitHub está conectado apenas para leitura. Autorize escrita no repositório para a extensão poder criar commits."
: result.error ==="GITHUB_BRANCH_NOT_FOUND"
?"A branch selecionada não está disponível. Atualize a lista de branches."
: result.error ==="GITHUB_BRANCH_PROTECTED_OR_WRITE_DENIED"
?"O GitHub bloqueou o push direto nesta branch. Revise permissões/rulesets ou use uma branch que aceite escrita."
: result.error?.startsWith("GITHUB_COMMIT_VERIFY")
?"O commit não passou na verificação final do GitHub. A extensão não considerou a execução concluída."
:"A extensão não conseguiu preparar ou aplicar o repositório. Revise a Central de Conexões.";
toast(copy,"error");
} else if (result?.error ==="LOVABLE_GIT_SYNC_REQUIRED") {
root.classList.add("open");
switchPanel("connections");
const steps=$("#uc-lovable-sync-steps"); if(steps) steps.hidden=false;
setConnectionOverview("lovable",false,"Configuração necessária");
setAutoConnectProgress("O Git sync nativo da Lovable ainda não está confirmado. Conecte Project settings → Git → GitHub e depois clique Detectar vínculo.",25,"attention");
toast("Sem Git sync da Lovable, o preview não consegue acompanhar os commits da extensão.","error");
} else if (result?.error ==="SUPABASE_AUTH_REQUIRED") {
switchPanel("tools");
$("#uc-login").classList.add("show");
toast("O modo de executor personalizado precisa do Supabase Auth do seu próprio projeto.","error");
} else if (["CHATGPT_NOT_CONNECTED","AI_LOGIN_REQUIRED","AI_NOT_CONNECTED","AI_TAB_NOT_FOUND","AI_COMPOSER_NOT_FOUND","AI_BRIDGE_SEND_FAILED"].includes(result?.error)) {
state.pendingSend = true;
await openProviderConnection(state.provider ==="auto" ?"chatgpt" : state.provider,{autoConnect:true});
toast("Finalize o login no modelo selecionado. A extensão validará a sessão automaticamente.","error");
} else {
toast(result?.error ||"Falha ao executar.","error");
}

const last = (await chrome.runtime.sendMessage({type:"GET_EXECUTION"}))?.execution;
if (last?.requestId === requestId) applyExecutionSnapshot(last);
setExecution("erro","Falha",result?.error ||"Erro desconhecido","");
return;
}

refreshAccount(true).catch(()=>null);
state.attachments = [];
renderAttachments();
}

function switchPanel(name) {
state.panel = name;
root.classList.add("open");
$$(".uc-section").forEach(section => section.classList.toggle("active",section.dataset.panel === name));
$$("[data-section]").forEach(button => button.classList.toggle("active",button.dataset.section === name));
if(name ==="connections") setTimeout(()=>refreshConnectionCenter().catch(()=>null),0);
}

function toggleExpanded() {
state.expanded = !state.expanded;
root.classList.toggle("expanded",state.expanded);
tone("open");
}

function isLovableProjectPage() {
return location.hostname ==="lovable.dev" &&/\/projects\/[^/?#]+/i.test(location.pathname);
}

function restoreLovableComposerBrand() {
const input = state.brandedComposer;
if (input?.isConnected && state.originalComposerPlaceholder !== null &&"placeholder" in input) {
input.setAttribute("placeholder",state.originalComposerPlaceholder ||"");
}
state.brandedComposerContainer?.classList?.remove("uc-lovable-native-branded");

document.querySelectorAll(".uc-lovable-native-branded").forEach(node => node.classList.remove("uc-lovable-native-branded"));
state.brandedComposer = null;
state.brandedComposerContainer = null;
state.originalComposerPlaceholder = null;
}

function isVisibleLovableElement(el) {
if (!el || root.contains(el) || !el.isConnected) return false;
const style = getComputedStyle(el);
if (style.display ==="none" || style.visibility ==="hidden" || Number(style.opacity || 1) === 0) return false;
const rect = el.getBoundingClientRect();
return rect.width > 18 && rect.height > 18 && rect.bottom > 0 && rect.top < innerHeight;
}

function lovableComposerCandidates() {
if (!isLovableProjectPage()) return [];
const selector = [
"textarea",
"[contenteditable='true']",
"[role='textbox']",
"[data-lexical-editor='true']",
"[data-placeholder]"
].join(",");
return [...document.querySelectorAll(selector)]
.filter(isVisibleLovableElement)
.map(el => {
const rect = el.getBoundingClientRect();
const metadata =`${el.getAttribute("placeholder") ||""} ${el.getAttribute("aria-label") ||""} ${el.getAttribute("data-placeholder") ||""} ${el.getAttribute("role") ||""}`.toLowerCase();
const form = el.closest("form");
const nearBottom = Math.max(0, Math.min(1, rect.bottom / Math.max(innerHeight,1)));
let score = nearBottom * 5;
if (/message|ask|prompt|mensagem|chat|describe|what do you want|type/i.test(metadata)) score += 8;
if (el.isContentEditable || el.getAttribute("role") ==="textbox") score += 3;
if (form) score += 2;
const context = (form || el.parentElement?.parentElement || el.parentElement)?.innerText?.toLowerCase() ||"";
if (/send|enviar|attach|anexar|chat|lovable/.test(context.slice(0,1800))) score += 2;
return {el,score,rect,form};
})
.filter(item => item.rect.top > innerHeight * .25)
.sort((a,b) => b.score - a.score || b.rect.top - a.rect.top);
}

function findLovableComposer() {
return lovableComposerCandidates()[0]?.el || null;
}

function clearLovableSetupBypass() {
clearTimeout(state.lovableSetupUnlockTimer);
state.lovableSetupUnlockTimer = null;
state.allowLovableSetup = false;
state.allowLovableSetupUntil = 0;
updateLovableLock();
}

function allowLovableSetupTemporarily(ms=45000) {
clearTimeout(state.lovableSetupUnlockTimer);
state.allowLovableSetup = true;
state.allowLovableSetupUntil = Date.now() + Math.max(5000,ms);
state.lovableSetupUnlockTimer = setTimeout(clearLovableSetupBypass, Math.max(5000,ms));
updateLovableLock();
}

function removeLovableLock() {
state.lockOverlay?.remove();
document.querySelectorAll("#uc-lovable-lock-overlay,.uc-lovable-lock").forEach(node => node.remove());
state.lockOverlay = null;
state.lockTarget = null;
state.lockTargets = [];
state.lockComposer = null;
restoreLovableComposerBrand();
}

function lovableLockBypassActive() {
if (!state.allowLovableSetup) return false;
if (Date.now() >= Number(state.allowLovableSetupUntil || 0)) {
state.allowLovableSetup = false;
state.allowLovableSetupUntil = 0;
return false;
}
return true;
}

function resolveLovableLockContainer(input) {

return input && isVisibleLovableElement(input) ? input : null;
}

function lovableComposerIsUncovered(input) {
if (!input || !input.isConnected) return false;
const rect=input.getBoundingClientRect?.();
if(!rect || rect.width<80 || rect.height<26) return false;
const points=[
[rect.left+rect.width*.5,rect.top+Math.min(rect.height*.5,28)],
[rect.left+Math.min(rect.width*.22,120),rect.top+Math.min(rect.height*.65,34)]
];
let visibleHits=0;
for(const [x,y] of points){
if(x<0||y<0||x>=innerWidth||y>=innerHeight) continue;
const stack=document.elementsFromPoint?.(x,y) || [];
const top=stack.find(el=>el!==state.lockOverlay && !root.contains(el)) || null;
if(top && (top===input || input.contains(top) || top.contains?.(input))) visibleHits++;
}
return visibleHits>0;
}

function updateLovableLock() {
if (!state.config) return;
const enabled = isLovableProjectPage();
state.config.lovableChatLock = enabled;
root.dataset.lock = enabled ?"on" :"off";
$("#uc-lock-text").textContent = enabled ?"Ativa somente neste projeto" :"Em espera fora de projetos";
$(".uc-lock-icon").innerHTML = icon("lock");

if (!enabled || lovableLockBypassActive()) {
removeLovableLock();
return;
}

const candidates = lovableComposerCandidates();
const input = candidates[0]?.el || null;
if (!input) {
state.lockTarget = null;
state.lockTargets = [];
state.lockComposer = null;
if (state.lockOverlay) state.lockOverlay.style.display ="none";
return;
}

const container = resolveLovableLockContainer(input);
if (!container) return;
if(!lovableComposerIsUncovered(input)){
state.lockTarget = null;
state.lockTargets = [];
state.lockComposer = input;
if(state.lockOverlay) state.lockOverlay.style.display="none";
return;
}
state.lockComposer = input;
state.lockTarget = container;
state.lockTargets = [input,container].filter(Boolean);
restoreLovableComposerBrand();

document.querySelectorAll("#uc-lovable-lock-overlay,.uc-lovable-lock").forEach(node => {
if (node !== state.lockOverlay) node.remove();
});

if (!state.lockOverlay || !state.lockOverlay.isConnected) {
const overlay = document.createElement("div");
overlay.id ="uc-lovable-lock-overlay";
overlay.className ="uc-lovable-lock";
overlay.setAttribute("role","status");
overlay.setAttribute("aria-label","Chat Lovable bloqueado pela Unstoppable Corp");
overlay.innerHTML =`<span class="uc-lock-shield">${icon("lock")}</span><div><b>Campo de comando Lovable bloqueado</b><small>Use o campo de texto da Unstoppable Corp para enviar suas solicitações.</small></div>`;
overlay.addEventListener("pointerdown",event=>{ event.preventDefault(); event.stopPropagation(); toast("Chat Lovable bloqueado. Use o campo da extensão.","error"); },true);
document.body.appendChild(overlay);
state.lockOverlay = overlay;
}

const rect = container.getBoundingClientRect();
const left=Math.max(0,Math.min(innerWidth,rect.left));
const top=Math.max(0,Math.min(innerHeight,rect.top));
const right=Math.max(0,Math.min(innerWidth,rect.right));
const bottom=Math.max(0,Math.min(innerHeight,rect.bottom));
const width=Math.max(0,right-left), height=Math.max(0,bottom-top);
Object.assign(state.lockOverlay.style,{
left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`,
display:width>80 && height>34 ?"grid" :"none"
});
}

function eventTargetsLovableComposer(event) {
if (!isLovableProjectPage() || lovableLockBypassActive()) return false;
const composer=state.lockComposer;
if (!composer || !composer.isConnected) return false;
const path=event.composedPath?.() || [];
if (path.includes(composer)) return true;
const target=event.target instanceof Element ? event.target : null;
if (!target || root.contains(target)) return false;

const interactionRoot=composer.closest("form") || composer.parentElement?.parentElement || composer.parentElement;
if (!interactionRoot || !interactionRoot.contains(target)) return false;
const editor=target.closest("textarea,[contenteditable='true'],[role='textbox'],[data-lexical-editor='true']");
if (editor && (editor===composer || composer.contains(editor) || editor.contains(composer))) return true;
const button=target.closest("button,[role='button']");
if (button) {
const label=`${button.innerText||""} ${button.getAttribute("aria-label")||""} ${button.getAttribute("title")||""}`.toLowerCase();
return/send|enviar|submit|attach|anexar/.test(label);
}
return false;
}
function interceptLovable(event) {
if (!eventTargetsLovableComposer(event)) return;
event.preventDefault();
event.stopImmediatePropagation();
toast("Chat Lovable bloqueado. Para sua segurança, utilize somente o campo de texto da extensão.","error");
updateLovableLock();
}

["keydown","keypress","beforeinput","input","click","pointerdown","paste","drop","submit"].forEach(type =>
document.addEventListener(type,interceptLovable,true)
);

let lovableLockFrame=0;
function scheduleLovableLockUpdate(){
if(lovableLockFrame) return;
lovableLockFrame=requestAnimationFrame(()=>{lovableLockFrame=0;updateLovableLock();});
}
window.addEventListener("resize",scheduleLovableLockUpdate,{passive:true});
window.addEventListener("scroll",scheduleLovableLockUpdate,{capture:true,passive:true});

const observer = new MutationObserver(() => {
clearTimeout(updateLovableLock.timer);
updateLovableLock.timer = setTimeout(updateLovableLock,180);
});
observer.observe(document.documentElement,{subtree:true,childList:true});

function setupDrag() {
const handle = $(".uc-drag");
const dock = $(".uc-dock");

handle.addEventListener("pointerdown",event => {
handle.setPointerCapture(event.pointerId);
const rect = dock.getBoundingClientRect();
state.drag = {
id:event.pointerId,
dx:event.clientX-rect.left,
dy:event.clientY-rect.top
};
root.classList.add("dragging");
});

handle.addEventListener("pointermove",event => {
if (!state.drag || state.drag.id !== event.pointerId) return;
const rect = dock.getBoundingClientRect();
const x = Math.max(6,Math.min(innerWidth-rect.width-6,event.clientX-state.drag.dx));
const y = Math.max(6,Math.min(innerHeight-rect.height-6,event.clientY-state.drag.dy));
dock.style.left =`${x}px`;
dock.style.top =`${y}px`;
});

const finishDockDrag = async event => {
if (!state.drag) return;
if(event?.pointerId != null && state.drag.id !== event.pointerId) return;
state.drag = null;
root.classList.remove("dragging");
try { if(event?.pointerId != null && handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId); } catch {}
const rect = dock.getBoundingClientRect();
await chrome.storage.local.set({unstoppableDock:{x:rect.left,y:rect.top}}).catch(()=>null);
};
handle.addEventListener("pointerup",finishDockDrag);
handle.addEventListener("pointercancel",finishDockDrag);
handle.addEventListener("lostpointercapture",finishDockDrag);
window.addEventListener("blur",()=>finishDockDrag({pointerId:state.drag?.id}),{passive:true});
}

function setupWindowDrag() {
const handle = $(".uc-window-drag");
const panel = $(".uc-window");

handle.addEventListener("pointerdown",event => {
if (event.target.closest("button")) return;
handle.setPointerCapture(event.pointerId);
const rect = panel.getBoundingClientRect();
state.windowDrag = {id:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};
root.classList.add("window-dragging");
event.preventDefault();
});

handle.addEventListener("pointermove",event => {
if (!state.windowDrag || state.windowDrag.id !== event.pointerId) return;
const rect = panel.getBoundingClientRect();
const x = Math.max(8,Math.min(innerWidth-rect.width-8,event.clientX-state.windowDrag.dx));
const y = Math.max(8,Math.min(innerHeight-rect.height-8,event.clientY-state.windowDrag.dy));
panel.style.left =`${x}px`;
panel.style.right ="auto";
panel.style.top =`${y}px`;
panel.style.bottom ="auto";
});

const finish = async event => {
if (!state.windowDrag || state.windowDrag.id !== event.pointerId) return;
state.windowDrag = null;
root.classList.remove("window-dragging");
const rect = panel.getBoundingClientRect();
await chrome.storage.local.set({unstoppableWindow:{x:rect.left,y:rect.top}});
};

handle.addEventListener("pointerup",finish);
handle.addEventListener("pointercancel",finish);
handle.addEventListener("lostpointercapture",finish);
window.addEventListener("blur",()=>{
if(!state.windowDrag) return;
const pointerId=state.windowDrag.id;
finish({pointerId}).catch(()=>null);
},{passive:true});
}

async function refreshConnections() {
const [chat,supabase,session] = await Promise.all([
chrome.runtime.sendMessage({type:"CHAT_STATUS"}),
chrome.runtime.sendMessage({type:"SUPA_STATUS"}),
chrome.runtime.sendMessage({type:"SUPA_SESSION"})
]);

$("#uc-chat-status").textContent = chat?.ready
?"Sessão pronta"
: chat?.busy
?"Conectado · resposta em andamento"
: chat?.loginRequired
?"Conectado · login necessário"
: chat?.connected
?"Conectado · preparando ponte"
:"Não conectado";

state.supabaseSession = session;
$("#uc-supa-status").textContent = session?.authenticated
?`Executor autenticado: ${session.user?.email ||"usuário"}`
: supabase?.ok
?"Projeto online · Auth avançado opcional"
:"Não configurado · use a Central de Conexões";
}

function setConnectionOverview(kind,ready,text) {
const card = root.querySelector(`[data-connection-state="${kind}"]`);
if (card) card.dataset.state = ready ?"ready" :"pending";
const ids={github:"#uc-connect-github-summary",lovable:"#uc-connect-lovable-summary",project:"#uc-connect-project-summary",supabase:"#uc-connect-supabase-summary",ai:"#uc-connect-ai-summary"};
const target=$(ids[kind]); if(target) target.textContent=text;
}

function parseGithubRepoFromHref(href="") {
try {
const url=new URL(href,location.href);
if(!/(^|\.)github\.com$/i.test(url.hostname)) return null;
const parts=url.pathname.split("/").filter(Boolean);
if(parts.length<2) return null;
if(["settings","login","apps","marketplace","organizations","features"].includes(parts[0].toLowerCase())) return null;
const owner=parts[0], repo=String(parts[1]||"").replace(/\.git$/i,"");
if(!owner || !repo) return null;
return`${owner}/${repo}`;
} catch { return null; }
}

function parseGithubRepoFromText(value="") {
const raw=String(value||"").trim();
if(!raw) return null;
const urlMatch=raw.match(/https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?=$|[\/\s?#])/i);
if(urlMatch) return`${urlMatch[1]}/${urlMatch[2].replace(/\.git$/i,"")}`;
const exact=raw.match(/(?:^|[\s:>"'`])([A-Za-z0-9_.-]{1,80})\/([A-Za-z0-9_.-]{1,120})(?=$|[\s<"'`])/);
if(!exact) return null;
const owner=exact[1],repo=exact[2].replace(/\.git$/i,"");
if(["http","https","src","assets","settings","connectors"].includes(owner.toLowerCase())) return null;
return`${owner}/${repo}`;
}

function extractLovableBranchFromContext(container,repo=null) {
if(!container) return null;
const controls=[...container.querySelectorAll("select,option:checked,button,[role='combobox'],[data-state]")].filter(el=>el.offsetParent!==null);
const reject=/^(connected|conectado|repository|repositório|branch|git|https|ssh|github cli|copy|copiar|sync my code)$/i;
for(const el of controls){
const value=String(el.value || el.innerText || el.getAttribute("aria-label") ||"").trim();
if(!value || value.length>140 || reject.test(value) || value.includes("github.com") || (repo && value.includes(repo))) continue;
if(/^[A-Za-z0-9._/-]+$/.test(value) &&/[A-Za-z]/.test(value)) return value;
}
const raw=String(container.innerText||"");
const match=raw.match(/\bBranch\b[^A-Za-z0-9._/-]{0,20}([A-Za-z0-9._/-]{1,120})/i);
return match?.[1] && !reject.test(match[1]) ? match[1] : null;
}

function inspectLovableGitSyncDom() {
if(!isLovableProjectPage()) return {confirmed:false,repo:null,branch:null,source:"not-lovable"};
const visible=el=>el && !root.contains(el) && el.offsetParent!==null;
const bodyText=String(document.body?.innerText||"");
const lower=bodyText.toLowerCase();
const hasGitSettingsEvidence=/repository connection|clone repository|sync my code|git\s*sync/.test(lower) &&/connected|conectado/.test(lower);

const candidates=[...document.querySelectorAll('a[href*="github.com/"],input,textarea,code,pre')].filter(visible);
for(const el of candidates){
const payload=[el.getAttribute?.("href"),el.value,el.textContent].filter(Boolean).join(" ");
const repo=parseGithubRepoFromHref(el.href ||"") || parseGithubRepoFromText(payload);
if(!repo) continue;
let context=el;
for(let i=0;i<7 && context?.parentElement;i++){
const text=String(context.innerText||"").toLowerCase();
if(/repository connection|clone repository|connected|conectado|branch|git/.test(text)) break;
context=context.parentElement;
}
const nearby=String(context?.innerText||payload).toLowerCase().slice(0,5000);
const highConfidence=/repository connection|clone repository/.test(nearby) &&/connected|conectado/.test(nearby);
const mediumConfidence=/branch/.test(nearby) &&/connected|conectado/.test(nearby) &&/github/.test(`${payload} ${nearby}`);
if(highConfidence || mediumConfidence || hasGitSettingsEvidence){
return {confirmed:true,repo,branch:extractLovableBranchFromContext(context,repo),source:"lovable-project-git-settings"};
}
}

if(hasGitSettingsEvidence){
const repo=parseGithubRepoFromText(bodyText);
if(repo){
const branchMatch=bodyText.match(/\bBranch\b[^A-Za-z0-9._/-]{0,30}([A-Za-z0-9._/-]{1,120})/i);
return {confirmed:true,repo,branch:branchMatch?.[1] || null,source:"lovable-project-git-text"};
}
}

return {confirmed:false,repo:null,branch:null,source:/github|repository connection|git/.test(lower)?"lovable-git-ui-visible-no-repo":"not-visible"};
}

async function tryOpenLovableGitSettingsUi() {
const clickMatching=(terms)=>{
const elements=[...document.querySelectorAll('button,a,[role="button"]')]
.filter(el=>!root.contains(el) && el.offsetParent!==null);
const el=elements.find(node=>{
const label=`${node.innerText||""} ${node.getAttribute("aria-label")||""} ${node.getAttribute("title")||""}`.toLowerCase();
return terms.some(term=>label.includes(term));
});
if(el){ el.click(); return true; }
return false;
};
let opened=clickMatching(["project settings","configurações do projeto","settings"]);
if(opened) await new Promise(r=>setTimeout(r,700));
const gitOpened=clickMatching(["github","git"]);
if(gitOpened) await new Promise(r=>setTimeout(r,850));
if(!opened && !gitOpened){
allowLovableSetupTemporarily(45000);
setAutoConnectProgress("Abra Project settings → Git → GitHub. A liberação manual do chat dura no máximo 45 segundos e a trava volta automaticamente.",30,"attention");
toast("Não consegui abrir as configurações automaticamente. A trava do chat foi liberada por 45 segundos apenas para você acessar o menu + → GitHub.","tap");
}
return opened || gitOpened;
}

async function startLovableGitSyncSetup() {
await detectProject();
const github=await chrome.runtime.sendMessage({type:"GITHUB_STATUS"}).catch(()=>null);
if(!github?.connected){
toast("Conecte sua conta GitHub na extensão antes de verificar o vínculo da Lovable.","error");
return false;
}
await loadGithubRepositories({force:true});
state.lovableRepoSnapshot=state.githubRepos.map(repo=>repo.full_name);
state.lovableGitSetupActive=true;
const steps=$("#uc-lovable-sync-steps"); if(steps) steps.hidden=false;
$("#uc-lovable-sync-status").textContent="Abra Repository connection na Lovable. Vínculos já existentes também são detectados; não é necessário criar outro repositório.";
setConnectionOverview("lovable",false,"Verificando vínculo");
setAutoConnectProgress("2/6 · Abrindo as configurações Git do projeto Lovable para detectar o repositório e a branch já conectados...",28,"attention");
await tryOpenLovableGitSettingsUi();

let attempts=0;
const autoDetect=async()=>{
if(!state.lovableGitSetupActive) return;
attempts++;
const found=inspectLovableGitSyncDom();
if(found.confirmed){
const ok=await detectLovableGitSync({silent:true,autoOpen:false}).catch(()=>false);
if(ok && state.autoConnectPending){
state.autoConnectPending=false;
setTimeout(()=>autoConfigureConnections({resumeAfterGithub:true}).catch(()=>null),450);
}
return;
}
if(attempts<20) setTimeout(autoDetect,900);
};
setTimeout(autoDetect,700);
return true;
}

async function detectLovableGitSync({silent=false,autoOpen=!silent}={}) {
await detectProject();
let dom=inspectLovableGitSyncDom();
if(!dom.confirmed && autoOpen){
await tryOpenLovableGitSettingsUi();
await new Promise(r=>setTimeout(r,950));
dom=inspectLovableGitSyncDom();
}
await loadGithubRepositories({force:true});
const currentNames=state.githubRepos.map(repo=>repo.full_name);
let repo=dom.repo;
let branchHint=dom.branch || null;
let source=dom.source;

if(!repo && state.lovableRepoSnapshot.length){
const previous=new Set(state.lovableRepoSnapshot);
const added=currentNames.filter(name=>!previous.has(name));
if(added.length===1){ repo=added[0]; source="new-repository-detected"; }
}
if(!repo && state.binding?.lovableGitSyncConfirmed && state.binding?.lovableGitRepo && currentNames.includes(state.binding.lovableGitRepo)){
repo=state.binding.lovableGitRepo; branchHint=state.binding.lovableGitBranch || state.binding.branch || branchHint; source="saved-binding";
}

if(repo && !currentNames.includes(repo)){
state.lovableGitSync=null;
$("#uc-lovable-sync-status").textContent=`A Lovable mostra ${repo} como Connected, mas a conta GitHub usada pela extensão ainda não consegue listar esse repositório. Autorize esse repo na conexão GitHub da extensão e tente novamente.`;
setConnectionOverview("lovable",false,"Repo sem acesso na extensão");
clearLovableSetupBypass();
if(!silent) toast("Git sync detectado na Lovable, porém o GitHub da extensão não tem acesso ao mesmo repositório.","error");
return false;
}

if(!repo){
state.lovableGitSync=null;
$("#uc-lovable-sync-status").textContent="Não foi possível ler Repository connection nesta tela. Abra Project settings → Git → GitHub e confirme Repository + Branch + Connected; depois clique Detectar vínculo.";
setConnectionOverview("lovable",false,"Não confirmado");
clearLovableSetupBypass();
if(!silent) toast("Não encontrei evidência do Git sync do projeto. O conector GitHub API do workspace é separado e não substitui Repository connection.","error");
return false;
}

const repoSelect=$("#uc-github-repo");
if(repoSelect) repoSelect.value=repo;
await loadGithubBranches(repo,{preferred:branchHint || state.binding?.lovableGitBranch || state.binding?.branch || null});
const branch=$("#uc-github-branch")?.value || branchHint || state.githubRepos.find(r=>r.full_name===repo)?.default_branch ||"main";
if(branchHint && state.githubBranches.some(item=>item.name===branchHint) && $("#uc-github-branch")) $("#uc-github-branch").value=branchHint;
const finalBranch=$("#uc-github-branch")?.value || branch;
state.lovableGitSync={confirmed:true,repo,branch:finalBranch,source,confirmedAt:new Date().toISOString()};
state.lovableGitSetupActive=false;
clearLovableSetupBypass();
$("#uc-lovable-sync-status").textContent=`Git sync confirmado pela tela da Lovable: ${repo} · ${finalBranch} · Connected.`;
setConnectionOverview("lovable",true,`${repo.split("/").pop()} · ${finalBranch}`);
const saved=await saveConnectionBinding({silent:true,requireLovable:true});
if(!silent) toast(saved?"Lovable ↔ GitHub confirmado e salvo para este projeto.":"Vínculo detectado, mas não foi possível salvar a configuração.",saved?"ok":"error");
return !!saved;
}

function showLovableSyncActivity(notice) {
if(!isLovableProjectPage() || !notice?.commitSha) return;
let card=document.getElementById("uc-lovable-sync-activity");
if(!card){
card=document.createElement("div");
card.id="uc-lovable-sync-activity";
card.setAttribute("role","status");
document.body.appendChild(card);
}
const files=Array.isArray(notice.files)?notice.files:[];
const stateName=notice.state ||"waiting_sync";
const stateText=stateName==="refresh_failed"?"Falha ao atualizar preview":stateName==="preview_refresh_requested"?"Preview atualizado novamente após o Git Sync":stateName==="refresh_requested"?"Primeiro refresh solicitado à Lovable":"Aguardando sincronização da Lovable";
card.dataset.state=stateName;
card.innerHTML=`
      <div class="uc-sync-brand"><span>${icon("check")}</span><div><b>Unstoppable Corp</b><small>GitHub → Lovable</small></div><button data-sync-action="close" aria-label="Fechar">×</button></div>
      <strong>Commit aplicado no GitHub</strong>
      <span>${escapeHtml(notice.repo ||"repositório")} · ${escapeHtml(notice.branch ||"branch")}</span>
      <code>${escapeHtml(String(notice.commitSha).slice(0,12))}</code>
      <div class="uc-sync-state"><i></i>${escapeHtml(stateText)}</div>
      <small>${files.length ?`${files.length} arquivo${files.length===1?"":"s"} alterado${files.length===1?"":"s"}.` :"Alterações confirmadas no GitHub."} O histórico nativo do chat da Lovable é separado; esta notificação é da extensão.</small>
      <div class="uc-sync-actions"><button data-sync-action="refresh">Atualizar Lovable</button><button data-sync-action="preview">Abrir preview</button>${notice.publishedUrl?'<button data-sync-action="published">Abrir site</button>':''}</div>`;
card.querySelector('[data-sync-action="close"]')?.addEventListener("click",()=>{
card.remove();
chrome.runtime.sendMessage({type:"CLEAR_LOVABLE_SYNC_NOTICE"}).catch?.(()=>null);
},{once:true});
card.querySelector('[data-sync-action="refresh"]')?.addEventListener("click",()=>location.reload());
card.querySelector('[data-sync-action="preview"]')?.addEventListener("click",()=>{
const projectId=notice.projectId || state.detected?.projectId || state.binding?.projectId || null;
const url=notice.previewUrl || state.binding?.previewUrl || state.detected?.previewUrl || (projectId ?`https://id-preview--${projectId}.lovable.app` : null);
if(url) window.open(url,"_blank","noopener,noreferrer"); else toast("Preview ainda não identificado para este projeto.","error");
});
card.querySelector('[data-sync-action="published"]')?.addEventListener("click",()=>{
const url=notice.publishedUrl || state.binding?.publishedUrl || state.detected?.publishedUrl || null;
if(url) window.open(url,"_blank","noopener,noreferrer"); else toast("URL publicada ainda não identificada.","error");
});
}

async function hydrateLovableSyncActivity() {
if(!isLovableProjectPage()) return;
const result=await chrome.runtime.sendMessage({type:"GET_LOVABLE_SYNC_NOTICE"}).catch(()=>null);
const notice=result?.notice;
if(!notice?.commitSha) return;
if(notice.projectId && state.detected?.projectId && String(notice.projectId)!==String(state.detected.projectId)) return;
if(Date.now()-Number(notice.createdAt||0) > 30*60*1000) return;
state.pipelineNotice=notice;
showLovableSyncActivity(notice);
}

async function loadGithubRepositories({force=false}={}) {
const select=$("#uc-github-repo");
if(!select) return;
if(!force && state.githubRepos.length) {
renderGithubRepositories();
return;
}
select.innerHTML='<option value="">Carregando repositórios...</option>';
const result=await chrome.runtime.sendMessage({type:"GITHUB_REPOS"});
if(!result?.ok) {
state.githubRepos=[];
select.innerHTML='<option value="">Falha ao carregar repositórios</option>';
$("#uc-repo-status-detail").textContent=result?.error ||"Não foi possível consultar o GitHub.";
return;
}
state.githubRepos=Array.isArray(result.repos)?result.repos:[];
renderGithubRepositories();
}

function renderGithubRepositories() {
const select=$("#uc-github-repo"); if(!select) return;
const preferred=state.binding?.repo || state.config?.repo || select.value ||"";
select.innerHTML='<option value="">Selecione um repositório</option>'+state.githubRepos.map(repo=>`<option value="${escapeHtml(repo.full_name)}">${escapeHtml(repo.full_name)}${repo.private?" · privado":""}</option>`).join("");
if(preferred && state.githubRepos.some(repo=>repo.full_name===preferred)) select.value=preferred;
else if(state.githubRepos.length===1) select.value=state.githubRepos[0].full_name;
if(select.value) loadGithubBranches(select.value,{preferred:state.binding?.branch || state.config?.branch}).catch(()=>null);
}

async function loadGithubBranches(repo,{preferred=null}={}) {
const select=$("#uc-github-branch"); if(!select) return;
if(!repo){select.innerHTML='<option value="">Selecione o repositório</option>';return;}
select.innerHTML='<option value="">Carregando branches...</option>';
const result=await chrome.runtime.sendMessage({type:"GITHUB_BRANCHES",repo});
if(!result?.ok){select.innerHTML='<option value="">Falha ao carregar branches</option>';$("#uc-repo-status-detail").textContent=result?.error||"Falha ao consultar branches.";return;}
state.githubBranches=Array.isArray(result.branches)?result.branches:[];
const repoMeta=state.githubRepos.find(item=>item.full_name===repo);
const selected=preferred || state.binding?.branch || repoMeta?.default_branch ||"main";
select.innerHTML='<option value="">Selecione a branch</option>'+state.githubBranches.map(branch=>`<option value="${escapeHtml(branch.name)}">${escapeHtml(branch.name)}${branch.protected?" · protegida":""}</option>`).join("");
if(state.githubBranches.some(branch=>branch.name===selected)) select.value=selected;
else if(state.githubBranches.length) select.value=state.githubBranches[0].name;
$("#uc-repo-status-detail").textContent=select.value?`Pronto para vincular ${repo} · ${select.value}.`:"Selecione uma branch.";
setConnectionOverview("project",!!select.value,select.value?"Repositório + branch":"Aguardando branch");
if(select.value) detectSupabaseForSelection({silent:true}).catch(()=>null);
}

async function refreshAiConnectionStatuses() {
const providers=["chatgpt","gemini","claude","deepseek"];
const results=await Promise.all(providers.map(provider=>chrome.runtime.sendMessage({type:"PROVIDER_STATUS",provider}).catch(()=>null)));
let readyCount=0;
providers.forEach((provider,index)=>{
const status=results[index]; state.aiConnectionStatuses[provider]=status;
const el=$(`#uc-ai-status-${provider}`); if(!el) return;
const copy=providerStatusCopy(provider,status);
el.textContent=status?.ready?"Conectado":status?.state==="busy"?"Ocupado":status?.state==="login_required"?"Login necessário":status?.connected?"Preparando":"Não conectado";
el.dataset.state=status?.ready?"ready":status?.connected?"pending":"idle";
if(status?.ready) readyCount++;
el.title=copy.text;
});
setConnectionOverview("ai",readyCount>0,readyCount?`${readyCount} modelo${readyCount>1?"s":""} pronto${readyCount>1?"s":""}`:"Nenhum conectado");
}

async function refreshConnectionCenter({forceRepos=false}={}) {
if(!$("#uc-connect-github-summary")) return;
const github=await chrome.runtime.sendMessage({type:"GITHUB_STATUS"});
state.githubStatus=github;
const connected=!!github?.connected;
setSimpleConnectionState("github",connected?"ready":"idle",connected?`@${github.user?.login ||"conectado"}`:"aguardando");
$("#uc-github-status-detail").textContent=connected?`Conectado como ${github.user?.login ||"usuário GitHub"}.`:(github?.error ||"Conecte sua conta GitHub para listar repositórios privados e públicos.");
setConnectionOverview("github",connected,connected?`@${github.user?.login ||"conectado"}`:"Não conectado");
if($("#uc-github-client-id") && !$("#uc-github-client-id").value) $("#uc-github-client-id").value=state.config?.githubOAuthClientId ||"";
if(connected) await loadGithubRepositories({force:forceRepos});
else { $("#uc-github-repo").innerHTML='<option value="">Conecte o GitHub primeiro</option>'; $("#uc-github-branch").innerHTML='<option value="">Selecione o repositório</option>'; }

const supaReady=!!(state.binding?.supabaseUrl || state.config?.supabaseUrl);
const supaRef=state.binding?.supabaseProjectId || state.config?.supabaseProjectId ||"";
if($("#uc-supabase-ref")) $("#uc-supabase-ref").value=supaRef;
if($("#uc-supabase-url")) $("#uc-supabase-url").value=state.binding?.supabaseUrl || state.config?.supabaseUrl ||"";
if($("#uc-supabase-key") && !$("#uc-supabase-key").value) $("#uc-supabase-key").value=state.binding?.supabasePublishableKey || state.config?.supabasePublishableKey ||"";
$("#uc-supabase-status-detail").textContent=supaReady?`Projeto ${supaRef ||"Supabase"} detectado/configurado.`:"Use Detectar no repositório ou informe seu próprio projeto.";
setConnectionOverview("supabase",supaReady,supaReady?(supaRef?`Projeto ${supaRef.slice(0,6)}…`:"Configurado"):"Opcional / não detectado");
const adminStatus=await chrome.runtime.sendMessage({type:"SUPABASE_MANAGEMENT_STATUS",projectRef:supaRef}).catch(()=>null);
const adminEl=$("#uc-supabase-management-status");
if(adminEl) adminEl.textContent=adminStatus?.connected
?`Acesso administrativo conectado ao projeto ${adminStatus.projectRef}. Migrations SQL criadas pela extensão serão aplicadas após commits verificados.`
:"Não conectado. Migrations permanecerão versionadas no GitHub até um PAT próprio ser autorizado.";

let syncConfirmed=!!(state.binding?.lovableGitSyncConfirmed && state.binding?.lovableGitRepo && state.binding?.lovableGitRepo===state.binding?.repo);
if(!syncConfirmed && connected && isLovableProjectPage()){
const visibleSync=inspectLovableGitSyncDom();
if(visibleSync.confirmed){
await detectLovableGitSync({silent:true,autoOpen:false}).catch(()=>false);
syncConfirmed=!!(state.binding?.lovableGitSyncConfirmed && state.binding?.lovableGitRepo===state.binding?.repo);
}
}
if(syncConfirmed){
state.lovableGitSync={confirmed:true,repo:state.binding.lovableGitRepo,branch:state.binding.lovableGitBranch || state.binding.branch,source:state.binding.lovableSyncSource ||"saved-binding"};
$("#uc-lovable-sync-status").textContent=`Git sync confirmado: ${state.binding.lovableGitRepo} · ${state.binding.lovableGitBranch || state.binding.branch}.`;
setConnectionOverview("lovable",true,`${state.binding.lovableGitRepo.split("/").pop()} · ${state.binding.lovableGitBranch || state.binding.branch}`);
} else {
state.lovableGitSync=null;
$("#uc-lovable-sync-status").textContent="Este projeto ainda não possui um vínculo Lovable ↔ GitHub confirmado pela extensão.";
setConnectionOverview("lovable",false,"Não confirmado");
}
const projectReady=!!(state.binding?.repo && state.binding?.branch);
setConnectionOverview("project",projectReady,projectReady?"Vinculado":"Aguardando vínculo");
await refreshAiConnectionStatuses();
}

async function startGithubOAuthOwnerSetup() {
clearTimeout(state.githubOAuthSetupTimer);
const license=await chrome.runtime.sendMessage({type:"GET_LICENSE_STATUS",force:false}).catch(()=>null);
if(license?.role !=="admin"){
toast("A criação do OAuth oficial é uma configuração do administrador da distribuição.","error");
$("#uc-github-status-detail").textContent="Clientes não precisam criar um OAuth App. Use Login GitHub quando o Client ID oficial estiver publicado; enquanto isso, use um Fine-grained Token próprio.";
return false;
}
const started=await chrome.runtime.sendMessage({type:"GITHUB_OAUTH_SETUP_START"}).catch(()=>null);
if(!started?.ok){toast(started?.error ||"Não foi possível abrir a configuração OAuth.","error");return false;}
$("#uc-github-status-detail").textContent="Configuração OAuth iniciada. O GitHub será preenchido automaticamente; conclua apenas login, 2FA ou confirmações de segurança que forem solicitadas.";
toast("OAuth GitHub aberto. A extensão está preenchendo os dados oficiais automaticamente.","tap");
const poll=async()=>{
const status=await chrome.runtime.sendMessage({type:"GITHUB_OAUTH_SETUP_STATUS"}).catch(()=>null);
const clientId=String(status?.clientId || status?.setup?.clientId ||"").trim();
if(clientId){
state.config.githubOAuthClientId=clientId;
if($("#uc-github-client-id")) $("#uc-github-client-id").value=clientId;
$("#uc-github-status-detail").textContent=`OAuth oficial configurado. Client ID ${clientId.slice(0,6)}… salvo e publicado para a distribuição.`;
toast("Client ID capturado automaticamente. Iniciando login GitHub.","ok");
await startGithubDeviceLogin();
return;
}
state.githubOAuthSetupTimer=setTimeout(poll,1400);
};
state.githubOAuthSetupTimer=setTimeout(poll,1100);
return true;
}

async function copyGithubDeviceCode({silent=false}={}) {
const field=$("#uc-github-device-code-input");
const code=String(field?.value || $("#uc-github-device-code")?.textContent ||"").trim();
if(!code || code==="—") { if(!silent) toast("Nenhum código GitHub ativo.","tap"); return false; }
try {
await navigator.clipboard.writeText(code);
if(field){ field.focus({preventScroll:true}); field.select(); }
const hint=$("#uc-github-device-copy-hint"); if(hint) hint.textContent="Código copiado. Cole na guia oficial do GitHub com Ctrl+V.";
if(!silent) toast("Código GitHub copiado.","ok");
return true;
} catch {
if(field){ field.focus({preventScroll:true}); field.select(); }
const hint=$("#uc-github-device-copy-hint"); if(hint) hint.textContent="Código selecionado. Pressione Ctrl+C e cole no GitHub.";
if(!silent) toast("Código selecionado. Pressione Ctrl+C.","tap");
return false;
}
}

async function startGithubDeviceLogin() {
const clientId=$("#uc-github-client-id")?.value.trim() || state.config?.githubOAuthClientId ||"";
if(!clientId){
const remote=await chrome.runtime.sendMessage({type:"GET_LICENSE_STATUS",force:true}).catch(()=>null);
const published=String(remote?.public_config?.github_oauth_client_id ||"").trim();
if(published){
state.config.githubOAuthClientId=published;
if($("#uc-github-client-id")) $("#uc-github-client-id").value=published;
return startGithubDeviceLogin();
}
$("#uc-github-status-detail").textContent=remote?.role==="admin"?"OAuth oficial ainda não configurado. Use “Configurar OAuth automaticamente” uma única vez; depois os clientes receberão o Client ID automaticamente.":"O Client ID oficial ainda não foi publicado. Use temporariamente um Fine-grained Token próprio.";
const field=$("#uc-github-client-id");
field?.closest("details")?.setAttribute("open","");
root.querySelector(".uc-connect-manual")?.setAttribute("open","");
if(remote?.role==="admin") toast("Configure o OAuth oficial uma única vez; o Client ID será distribuído automaticamente.","tap");
else toast("OAuth oficial ainda não publicado. Use um Fine-grained Token como contingência.","error");
return;
}
const remember=$("#uc-github-remember")?.checked !== false;
const result=await chrome.runtime.sendMessage({type:"GITHUB_DEVICE_START",clientId,remember});
if(!result?.ok){toast(result?.error ||"Falha ao iniciar login GitHub.","error");return;}
state.config.githubOAuthClientId=clientId;
const code=String(result.userCode ||"").trim();
const device=$("#uc-github-device"); if(device) device.hidden=false;
const legacyCode=$("#uc-github-device-code"); if(legacyCode) legacyCode.textContent=code ||"—";
const simpleBox=$("#uc-github-device-simple"); if(simpleBox) simpleBox.hidden=false;
const simpleField=$("#uc-github-device-code-input");
if(simpleField){ simpleField.value=code; simpleField.focus({preventScroll:true}); simpleField.select(); }
const simpleHint=$("#uc-github-device-copy-hint"); if(simpleHint) simpleHint.textContent="Use Ctrl+C ou Copiar. Depois cole na guia oficial do GitHub que acabou de abrir.";
$("#uc-github-status-detail").textContent="Código exibido em Conectar e começar. Cole-o na página oficial do GitHub; a validação termina automaticamente.";

await copyGithubDeviceCode({silent:true}).catch(()=>false);

await new Promise(resolve=>setTimeout(resolve,180));
await chrome.runtime.sendMessage({type:"GITHUB_DEVICE_OPEN_AUTH",url:result.verificationUri}).catch(()=>null);
clearTimeout(state.githubDeviceTimer);
const pollDevice=async(delayMs)=>{
state.githubDeviceTimer=setTimeout(async()=>{
const poll=await chrome.runtime.sendMessage({type:"GITHUB_DEVICE_POLL",remember});
if(poll?.pending){
const nextDelay=Math.max(5,Number(poll.interval || result.interval || 5))*1000;
pollDevice(nextDelay);
return;
}
state.githubDeviceTimer=null;
if(poll?.ok){
if(device) device.hidden=true;
const simpleBox=$("#uc-github-device-simple"); if(simpleBox) simpleBox.hidden=true;
const simpleField=$("#uc-github-device-code-input"); if(simpleField) simpleField.value="";
toast("GitHub conectado com sucesso.","ok");await refreshConnectionCenter({forceRepos:true});
if(state.autoConnectPending) setTimeout(()=>autoConfigureConnections({resumeAfterGithub:true}).catch(()=>null),350);
}
else {$("#uc-github-status-detail").textContent=poll?.error ||"Autorização GitHub não concluída.";toast("Não foi possível concluir o login GitHub.","error");}
},delayMs);
};
pollDevice(Math.max(5,Number(result.interval||5))*1000);
}

async function connectGithubToken() {
const token=$("#uc-github-token")?.value.trim();
if(!token){toast("Cole um Fine-grained Token do seu próprio GitHub.","error");return;}
const remember=$("#uc-github-remember")?.checked !== false;
const result=await chrome.runtime.sendMessage({type:"GITHUB_CONNECT_TOKEN",token,remember});
$("#uc-github-token").value="";
if(!result?.ok){toast(result?.error ||"Token GitHub inválido.","error");return;}
toast("GitHub conectado com sucesso.","ok");
await refreshConnectionCenter({forceRepos:true});
if(state.autoConnectPending) setTimeout(()=>autoConfigureConnections({resumeAfterGithub:true}).catch(()=>null),350);
}

async function detectSupabaseForSelection({silent=false}={}) {
const repo=$("#uc-github-repo")?.value || state.binding?.repo;
const branch=$("#uc-github-branch")?.value || state.binding?.branch;
if(!repo || !branch){if(!silent) toast("Selecione repositório e branch antes de detectar o Supabase.","error");return false;}
$("#uc-supabase-status-detail").textContent="Procurando configuração Supabase no repositório...";
const result=await chrome.runtime.sendMessage({type:"GITHUB_DETECT_SUPABASE",repo,branch});
if(!result?.ok){$("#uc-supabase-status-detail").textContent="Supabase não foi detectado automaticamente. Você pode preencher os campos manualmente.";if(!silent) toast("Supabase não detectado no repositório.","tap");return false;}
$("#uc-supabase-ref").value=result.supabaseProjectId || result.projectRef ||"";
$("#uc-supabase-url").value=result.supabaseUrl ||"";
$("#uc-supabase-key").value=result.supabasePublishableKey ||"";
$("#uc-supabase-status-detail").textContent=`Detectado automaticamente${result.filesFound?.length?` em ${result.filesFound.join(", ")}`:""}.`;
setConnectionOverview("supabase",true,"Detectado");
if(!silent) toast("Supabase detectado no repositório.","ok");
return true;
}

async function testSupabaseSelection() {
let ref=$("#uc-supabase-ref")?.value.trim() ||"";
let url=$("#uc-supabase-url")?.value.trim() ||"";
const key=$("#uc-supabase-key")?.value.trim() ||"";
if(!url && ref) url=`https://${ref}.supabase.co`;
if(!url || !key){toast("Informe Project URL e Publishable/anon key para testar.","error");return false;}
$("#uc-supabase-status-detail").textContent="Testando conexão Supabase...";
const result=await chrome.runtime.sendMessage({type:"SUPA_TEST_CONFIG",url,key});
if(result?.ok){$("#uc-supabase-status-detail").textContent="Supabase respondeu corretamente com a chave pública informada.";setConnectionOverview("supabase",true,"Conectado");toast("Supabase conectado.","ok");return true;}
$("#uc-supabase-status-detail").textContent=result?.error ||`Falha HTTP ${result?.status ||""}`;
toast("Falha ao validar Supabase.","error");return false;
}

async function saveConnectionBinding({silent=false,requireLovable=false}={}) {
const repo=$("#uc-github-repo")?.value ||"";
const branch=$("#uc-github-branch")?.value ||"";
if(!repo || !branch){if(!silent) toast("Selecione repositório e branch.","error");return false;}
const ref=$("#uc-supabase-ref")?.value.trim() ||"";
let url=$("#uc-supabase-url")?.value.trim() ||"";
if(!url && ref) url=`https://${ref}.supabase.co`;
const key=$("#uc-supabase-key")?.value.trim() ||"";
const projectKey=state.detected?.projectId || state.detected?.slug || location.hostname+location.pathname;
const binding={
projectId:state.detected?.projectId || null,
slug:state.detected?.slug || null,
previewUrl:state.detected?.previewUrl || null,
repo,branch,
lovableGitSyncConfirmed:!!(state.lovableGitSync?.confirmed && state.lovableGitSync?.repo===repo),
lovableGitRepo:state.lovableGitSync?.confirmed ? state.lovableGitSync.repo : null,
lovableGitBranch:state.lovableGitSync?.confirmed ? (state.lovableGitSync.branch || branch) : null,
lovableSyncSource:state.lovableGitSync?.source || null,
requireLovableGitSync:true,
supabaseProjectId:ref || (url.match(/https:\/\/([a-z0-9-]{8,40})\.supabase\.co/i)?.[1] || null),
supabaseUrl:url || null,
supabasePublishableKey:key || null,
supabaseDashboardUrl:ref?`https://supabase.com/dashboard/project/${ref}`:(state.config?.supabaseDashboardUrl ||"https://supabase.com/dashboard/projects"),
executorUrl:url?`${url.replace(/\/+$/,'')}/functions/v1/unstoppable-ai-executor`:null
};
const result=await chrome.runtime.sendMessage({type:"BIND_PROJECT",projectKey,binding});
if(!result?.ok){if(!silent) toast(result?.error ||"Falha ao salvar vínculo.","error");return false;}
state.config={...state.config,repo,branch,supabaseProjectId:binding.supabaseProjectId,supabaseUrl:binding.supabaseUrl,supabasePublishableKey:binding.supabasePublishableKey,supabaseDashboardUrl:binding.supabaseDashboardUrl,executorUrl:binding.executorUrl,projectBindings:{...(state.config.projectBindings||{}),[projectKey]:result.binding}};
state.binding=result.binding;
renderBinding();
setConnectionOverview("project",true,"Vinculado");
if(binding.lovableGitSyncConfirmed) setConnectionOverview("lovable",true,`${repo.split("/").pop()} · ${binding.lovableGitBranch || branch}`);
else setConnectionOverview("lovable",false,"Não confirmado");
if(requireLovable && !binding.lovableGitSyncConfirmed){if(!silent) toast("Confirme primeiro o Git sync nativo da Lovable.","error");return false;}
if(!silent) toast("Projeto, repositório e branch vinculados com sucesso.","ok");
return true;
}

function setAutoConnectProgress(text,progress=0,stateName="running") {
const box=$("#uc-connect-auto");
const label=$("#uc-connect-auto-status");
const bar=$("#uc-connect-auto-progress");
if(box) box.dataset.state=stateName;
if(label) label.textContent=text;
if(bar) bar.style.width=`${Math.max(0,Math.min(100,Number(progress||0)))}%`;
}

function setSimpleConnectionState(kind,stateName,text){
const row=$("#uc-simple-"+kind);
if(!row) return;
row.dataset.state=stateName ||"idle";
const label=row.querySelector("small");
if(label) label.textContent=text || (stateName==="ready"?"conectado":"aguardando");
}

function normalizedHint(value="") {
return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}

function chooseRepositoryAutomatically() {
const select=$("#uc-github-repo");
if(!select || !state.githubRepos.length) return {ok:false,error:"NO_REPOSITORIES"};
const current=select.value;
if(current && state.githubRepos.some(repo=>repo.full_name===current)) return {ok:true,repo:current,reason:"selected"};
const exact=[state.binding?.repo,state.detected?.repo,state.config?.repo].filter(Boolean);
for(const repo of exact){ if(state.githubRepos.some(item=>item.full_name===repo)){ select.value=repo; return {ok:true,repo,reason:"exact"}; } }
if(state.githubRepos.length===1){ select.value=state.githubRepos[0].full_name; return {ok:true,repo:select.value,reason:"single"}; }
const hints=[
state.detected?.slug,
state.detected?.projectId,
location.pathname.split("/").filter(Boolean).pop(),
document.title?.replace(/\s*[|·-].*$/,"")
].map(normalizedHint).filter(Boolean);
const scored=state.githubRepos.map(repo=>{
const name=normalizedHint(repo.name);
let score=0;
for(const hint of hints){
if(name===hint) score=Math.max(score,100);
else if(name && hint && (name.includes(hint)||hint.includes(name))) score=Math.max(score,70);
}
return {repo,score};
}).sort((a,b)=>b.score-a.score || String(b.repo.updated_at||"").localeCompare(String(a.repo.updated_at||"")));
if(scored[0]?.score>=70 && (!scored[1] || scored[0].score>scored[1].score)){
select.value=scored[0].repo.full_name;
return {ok:true,repo:select.value,reason:"project-match"};
}
return {ok:false,error:"REPOSITORY_SELECTION_REQUIRED"};
}

async function autoConfigureConnections({resumeAfterGithub=false}={}) {
if(state.autoConnectRunning) return false;
state.autoConnectRunning=true;
const button=root.querySelector('[data-action="auto-connect-all"]');
if(button) button.disabled=true;
try {
await detectProject();
setAutoConnectProgress("Conectando sua conta GitHub...",10);
setSimpleConnectionState("github","attention","autorizando");
let github=await chrome.runtime.sendMessage({type:"GITHUB_STATUS"});
if(!github?.connected){
let clientId=$("#uc-github-client-id")?.value.trim() || state.config?.githubOAuthClientId ||"";
if(!clientId){
const lic=await chrome.runtime.sendMessage({type:"GET_LICENSE_STATUS",force:true}).catch(()=>null);
const published=String(lic?.public_config?.github_oauth_client_id ||"").trim();
if(published){
state.config.githubOAuthClientId=published;
if($("#uc-github-client-id")) $("#uc-github-client-id").value=published;
} else if(lic?.role==="admin") {
setAutoConnectProgress("Preparando o OAuth oficial. O GitHub pode solicitar login ou 2FA.",10,"attention");
state.autoConnectPending=true;
await startGithubOAuthOwnerSetup();
return false;
} else {
setAutoConnectProgress("O OAuth oficial ainda não foi publicado. Use temporariamente um Fine-grained Token da sua própria conta.",8,"attention");
$("#uc-github-client-id")?.closest("details")?.setAttribute("open","");
root.querySelector(".uc-connect-manual")?.setAttribute("open","");
state.autoConnectPending=true;
return false;
}
}
state.autoConnectPending=true;
setAutoConnectProgress("Autorize o GitHub na página oficial. Depois a configuração continua automaticamente.",12,"attention");
await startGithubDeviceLogin();
return false;
}

state.autoConnectPending=false;
await loadGithubRepositories({force:true});
setSimpleConnectionState("github","ready",`@${github.user?.login ||"conectado"}`);
setAutoConnectProgress("GitHub conectado. Localizando automaticamente o projeto da Lovable...",32);

let syncOk=!!(state.binding?.lovableGitSyncConfirmed && state.binding?.lovableGitRepo && state.githubRepos.some(r=>r.full_name===state.binding.lovableGitRepo));
if(syncOk){
state.lovableGitSync={confirmed:true,repo:state.binding.lovableGitRepo,branch:state.binding.lovableGitBranch || state.binding.branch ||"main",source:state.binding.lovableSyncSource ||"saved-binding"};
} else {
const dom=inspectLovableGitSyncDom();
if(dom.repo && state.githubRepos.some(r=>r.full_name===dom.repo)){
const select=$("#uc-github-repo"); if(select) select.value=dom.repo;
await loadGithubBranches(dom.repo,{preferred:dom.branch || state.binding?.branch || null});
state.lovableGitSync={confirmed:true,repo:dom.repo,branch:$("#uc-github-branch")?.value || dom.branch ||"main",source:dom.source,confirmedAt:new Date().toISOString()};
syncOk=await saveConnectionBinding({silent:true,requireLovable:true});
}
}

if(!syncOk){
const currentProjectId=state.detected?.projectId || state.binding?.projectId || state.config?.lovableProjectId ||"";
if(currentProjectId){
setAutoConnectProgress("Localizando automaticamente o repositório deste projeto Lovable...",38);
const paired=await chrome.runtime.sendMessage({
type:"GITHUB_FIND_LOVABLE_PROJECT",
projectId:currentProjectId,
hints:[state.detected?.slug,document.title,location.pathname.split("/").filter(Boolean).pop()].filter(Boolean)
}).catch(()=>null);
if(paired?.ok && paired?.repo){
const select=$("#uc-github-repo"); if(select) select.value=paired.repo;
await loadGithubBranches(paired.repo,{preferred:paired.branch || null});
const autoBranch=$("#uc-github-branch")?.value || paired.branch ||"main";
state.lovableGitSync={confirmed:true,repo:paired.repo,branch:autoBranch,source:paired.source||"lovable-project-json",confirmedAt:new Date().toISOString()};
syncOk=await saveConnectionBinding({silent:true,requireLovable:true});
if(syncOk){
$("#uc-lovable-sync-status").textContent=`Pareamento automático confirmado: ${paired.repo} · ${autoBranch}.`;
setConnectionOverview("lovable",true,`${paired.repo.split("/").pop()} · ${autoBranch}`);
}
}
}
}

if(!syncOk){
state.autoConnectPending=true;
setSimpleConnectionState("project","attention","autorize na Lovable");
setAutoConnectProgress("Confirme uma vez o Git Sync da Lovable. A página correta será aberta automaticamente.",42,"attention");
await startLovableGitSyncSetup();
return false;
}

const linkedRepo=state.lovableGitSync.repo;
const repoSelect=$("#uc-github-repo");
if(repoSelect) repoSelect.value=linkedRepo;
setConnectionOverview("lovable",true,`${linkedRepo.split("/").pop()} · ${state.lovableGitSync.branch}`);
setSimpleConnectionState("project","ready",`${linkedRepo.split("/").pop()} · ${state.lovableGitSync.branch}`);
setAutoConnectProgress(`Projeto encontrado: ${linkedRepo}. Validando branch e escrita...`,52);
await loadGithubBranches(linkedRepo,{preferred:state.lovableGitSync.branch || state.binding?.branch || null});
const branch=$("#uc-github-branch")?.value ||"";
if(!branch){
setAutoConnectProgress("Não foi possível confirmar a branch ativa. Selecione a branch sincronizada pela Lovable.",46,"attention");
return false;
}
state.lovableGitSync.branch=branch;

setAutoConnectProgress(`Validando permissão de escrita em ${linkedRepo} · ${branch}...`,62);
const probe=await chrome.runtime.sendMessage({type:"GITHUB_PROBE",repo:linkedRepo,branch,verifyWrite:true});
if(!probe?.ok || probe?.canPush===false){
setAutoConnectProgress(probe?.ok?"GitHub conectado somente para leitura. Autorize Contents: Read and write para permitir commits.":`Falha no acesso ao repositório Lovable: ${probe?.error ||"não autorizado"}.`,56,"error");
return false;
}

setAutoConnectProgress("Detectando Supabase e salvando o vínculo...",74);
const supa=await detectSupabaseForSelection({silent:true});
if(supa) await testSupabaseSelection().catch(()=>false);
const saved=await saveConnectionBinding({silent:true,requireLovable:true});
if(!saved){ setAutoConnectProgress("Falha ao salvar o vínculo do projeto.",72,"error"); return false; }

const requestedAi=(state.provider && state.provider!=="auto") ? state.provider :"chatgpt";
setSimpleConnectionState("chatgpt","attention","abrindo nova guia");
setAutoConnectProgress("Preparando o ChatGPT em segundo plano...",86);
const ai=await chrome.runtime.sendMessage({type:"CONNECT_PROVIDER",provider:requestedAi,repair:false,fresh:true});
const aiLabel=ai?.route?PROVIDERS[ai.route]?.nome || ai.route:PROVIDERS[requestedAi]?.nome ||"IA";
if(ai?.ready){
setSimpleConnectionState("chatgpt","ready",`${aiLabel} pronto`);
setAutoConnectProgress(`Tudo pronto. ${aiLabel}, GitHub e projeto Lovable conectados.`,100,"ready");
setConnectionOverview("ai",true,`${aiLabel} pronto`);
toast("Configuração concluída. A extensão está pronta para trabalhar.","ok");
await refreshAiConnectionStatuses().catch(()=>null);
await resumePendingCommandAfterSetup();
return true;
} else if(ai?.state==="busy") {
setSimpleConnectionState("chatgpt","attention",`${aiLabel} ocupado`);
setAutoConnectProgress(`Projeto pronto. ${aiLabel} está ocupado; a extensão aguardará a sessão ficar livre.`,96,"ready");
setConnectionOverview("ai",true,`${aiLabel} ocupado`);
await refreshAiConnectionStatuses().catch(()=>null);
await resumePendingCommandAfterSetup();
return true;
} else if(ai?.state==="login_required") {
setSimpleConnectionState("chatgpt","attention","faça login na nova guia");
setAutoConnectProgress(`Faça login em ${aiLabel} na nova guia. A configuração continua automaticamente.`,91,"attention");
state.providerConnection=requestedAi;
state.providerConnectionStatus=ai;
clearInterval(state.providerConnectionTimer);
state.providerConnectionTimer=setInterval(async()=>{
const latest=await chrome.runtime.sendMessage({type:"PROVIDER_STATUS",provider:requestedAi}).catch(()=>null);
if(latest?.ready){
clearInterval(state.providerConnectionTimer); state.providerConnectionTimer=null;
const latestLabel=latest?.route?PROVIDERS[latest.route]?.nome || latest.route:aiLabel;
setAutoConnectProgress(`Tudo pronto: projeto pareado e ${latestLabel} conectado.`,100,"ready");
setConnectionOverview("ai",true,`${latestLabel} pronto`);
toast(`${latestLabel} conectado automaticamente após o login.`,"ok");
await resumePendingCommandAfterSetup();
}
},1500);
await refreshAiConnectionStatuses().catch(()=>null);
return false;
} else {
setAutoConnectProgress("Projeto e GitHub estão prontos. Abra ou faça login em ChatGPT, Gemini, Claude ou DeepSeek e tente novamente.",90,"attention");
await refreshAiConnectionStatuses().catch(()=>null);
return false;
}
} catch(error){
setAutoConnectProgress(`Falha na configuração automática: ${String(error?.message || error)}`,0,"error");
toast("A configuração automática encontrou um erro. Veja o diagnóstico exibido.","error");
return false;
} finally {
state.autoConnectRunning=false;
if(button) button.disabled=false;
}
}

root.addEventListener("click",async event => {
const sectionTarget=event.target.closest("[data-section]");
const actionTarget=event.target.closest("button[data-action]");
const restrictedFeature=featureForSection(sectionTarget?.dataset.section)||featureForAction(actionTarget?.dataset.action);
if(restrictedFeature && !canUseFeature(restrictedFeature)){
event.preventDefault(); event.stopPropagation();
toast("Recurso indisponível no Acesso Limitado - UNST Corp.","tap");
tone("warning");
return;
}
const remove = event.target.closest("[data-remove]");
if (remove) {
state.attachments.splice(Number(remove.dataset.remove),1);
renderAttachments();
return;
}

const filter = event.target.closest("[data-filter]");
if (filter) {
renderSkills(filter.dataset.filter);
return;
}

const skill = event.target.closest("[data-skill]");
if (skill) {
if(!canUseFeature("skills")){toast("Skills indisponíveis no Acesso Limitado - UNST Corp.","tap");return;}
state.selected.has(skill.dataset.skill)
? state.selected.delete(skill.dataset.skill)
: state.selected.add(skill.dataset.skill);
await chrome.storage.local.set({unstoppableSelectedSkills:[...state.selected]});
renderSkills();
tone("tap");
return;
}

const shortcut = event.target.closest("[data-shortcut]");
if (shortcut) {
if(!canUseFeature("shortcuts")){toast("Atalhos indisponíveis no Acesso Limitado - UNST Corp.","tap");return;}
const item = SHORTCUT_PROMPTS[shortcut.dataset.shortcut];
if (item) applyPromptTemplate(item.text,item.title);
return;
}

const provider = event.target.closest("[data-provider]");
if (provider) {
const requestedProvider = provider.dataset.provider;
tone("tap");
await openProviderConnection(requestedProvider,{autoConnect:true});
return;
}

const aiConnect = event.target.closest("[data-connect-ai]");
if (aiConnect) {
const requestedProvider=aiConnect.dataset.connectAi;
tone("tap");
const status=await openProviderConnection(requestedProvider,{autoConnect:true});
setTimeout(()=>refreshAiConnectionStatuses().catch(()=>null),900);
return;
}

const section = event.target.closest("[data-section]");
if (section) {
switchPanel(section.dataset.section);
tone("tap");
return;
}

const button = event.target.closest("button[data-action]");
if (!button) return;

switch (button.dataset.action) {
case"close-provider":
closeProviderConnection();
break;

case"auto-connect-all":
await autoConfigureConnections();
break;

case"github-oauth-auto-setup":
await startGithubOAuthOwnerSetup();
break;

case"lovable-git-start":
await startLovableGitSyncSetup();
break;

case"lovable-git-detect":
await detectLovableGitSync();
break;

case"github-oauth-start":
await startGithubDeviceLogin();
break;

case"github-device-copy":
await copyGithubDeviceCode();
break;

case"github-token-connect":
await connectGithubToken();
break;

case"github-refresh":
await refreshConnectionCenter({forceRepos:true});
toast("Conexões atualizadas.","ok");
break;

case"github-disconnect":
await chrome.runtime.sendMessage({type:"GITHUB_DISCONNECT"});
state.githubRepos=[]; state.githubBranches=[];
await refreshConnectionCenter({forceRepos:true});
toast("GitHub desconectado deste navegador.","tap");
break;

case"github-load-branches":
await loadGithubBranches($("#uc-github-repo")?.value ||"");
break;

case"github-test-access": {
const repo=$("#uc-github-repo")?.value || state.binding?.repo ||"";
const branch=$("#uc-github-branch")?.value || state.binding?.branch ||"main";
if(!repo){toast("Selecione um repositório primeiro.","error");break;}
const probe=await chrome.runtime.sendMessage({type:"GITHUB_PROBE",repo,branch,verifyWrite:true});
const detail=$("#uc-repo-status-detail");
if(probe?.ok){
const write=probe.writeVerified?"leitura e escrita verificadas por API":"leitura liberada · escrita não autorizada";
if(detail) detail.textContent=`${repo} · ${branch} · ${write}.`;
toast(probe.writeVerified?"GitHub validado: leitura e escrita verificadas pela API.":"GitHub validado somente para leitura. Autorize Contents: Read and write para commits.",probe.writeVerified?"ok":"warning");
}else{
const copy=probe?.error==="GITHUB_EXTENSION_REPO_NOT_AUTHORIZED"?"A conexão GitHub da extensão não tem acesso a este repositório.":probe?.error==="GITHUB_BRANCH_NOT_FOUND"?"A branch não foi encontrada.":(probe?.error||"Falha ao validar o repositório.");
if(detail) detail.textContent=copy;
toast(copy,"error");
}
break;
}

case"detect-supabase":
await detectSupabaseForSelection();
break;

case"test-supabase":
await testSupabaseSelection();
break;

case"supabase-management-connect": {
const projectRef=$("#uc-supabase-ref")?.value.trim() || state.binding?.supabaseProjectId ||"";
const token=$("#uc-supabase-pat")?.value.trim() ||"";
const remember=!!$("#uc-supabase-pat-remember")?.checked;
if(!projectRef || !token){toast("Informe o Project Ref e um PAT Supabase da própria conta.","error");break;}
const result=await chrome.runtime.sendMessage({type:"SUPABASE_MANAGEMENT_CONNECT",projectRef,token,remember});
if($("#uc-supabase-pat")) $("#uc-supabase-pat").value="";
const status=$("#uc-supabase-management-status");
if(result?.ok){if(status) status.textContent=`Acesso administrativo conectado ao projeto ${projectRef}. Migrations poderão ser aplicadas automaticamente após commits.`;toast("Supabase administrativo conectado.","ok");}
else {if(status) status.textContent=result?.error ||"Falha ao validar PAT Supabase.";toast("Não foi possível validar o acesso administrativo Supabase.","error");}
break;
}

case"supabase-management-status": {
const projectRef=$("#uc-supabase-ref")?.value.trim() || state.binding?.supabaseProjectId ||"";
const result=await chrome.runtime.sendMessage({type:"SUPABASE_MANAGEMENT_STATUS",projectRef});
const status=$("#uc-supabase-management-status");
if(result?.connected){if(status) status.textContent=`Acesso administrativo válido em ${result.projectRef}.`;toast("Supabase administrativo validado.","ok");}
else {if(status) status.textContent=result?.error ||"Acesso administrativo não conectado.";toast("Supabase administrativo não conectado.","tap");}
break;
}

case"supabase-management-disconnect":
await chrome.runtime.sendMessage({type:"SUPABASE_MANAGEMENT_DISCONNECT"});
if($("#uc-supabase-management-status")) $("#uc-supabase-management-status").textContent="Acesso administrativo desconectado.";
toast("Acesso administrativo Supabase removido deste navegador.","tap");
break;

case"save-connections":
await saveConnectionBinding();
break;

case"connect-provider": {
const status = await connectCurrentProvider({repair:false});
resumePendingSendIfReady(status);
break;
}

case"test-provider": {
const status = await checkProviderConnection();
const copy = providerStatusCopy(state.providerConnection || state.provider,status);
toast(
status?.ready ?"Conexão validada com sucesso." : copy.text,
status?.ready ?"connect" : status?.state ==="busy" ?"warning" :"error"
);
if (status?.ready) resumePendingSendIfReady(status);
break;
}

case"repair-provider": {
if (state.providerConnectionStatus?.state ==="busy") {
toast("A sessão está conectada e processando. Para não interromper a resposta atual, a recuperação foi bloqueada até ela ficar livre.","tap");
break;
}
const status = await connectCurrentProvider({repair:true});
toast(
status?.ready
?"Conexão reparada com sucesso."
: providerStatusCopy(state.providerConnection || state.provider,status).text,
status?.ready ?"connect" : status?.state ==="busy" ?"warning" :"error"
);
break;
}

case"provider-supabase":
chrome.runtime.sendMessage({type:"OPEN_URL",url:state.config.supabaseDashboardUrl});
break;

case"provider-supa-login": {
const email = $("#uc-provider-email").value.trim();
const password = $("#uc-provider-password").value;
if (!email || !password) { toast("Informe e-mail e senha do Supabase Auth.","error"); break; }
const result = await chrome.runtime.sendMessage({type:"SUPA_LOGIN",email,password});
$("#uc-provider-password").value ="";
if (!result?.ok) { toast(result?.error ||"Falha no login Supabase.","error"); break; }
toast("Supabase Auth conectado. Validando o modelo...","ok");
const status = await connectCurrentProvider({repair:false});
resumePendingSendIfReady(status);
refreshConnections();
break;
}

case"download-provider-guide": {
tone("click");
const result = await chrome.runtime.sendMessage({type:"DOWNLOAD_PROVIDER_GUIDE"});
if (result?.ok) toast("Guia premium de conexão baixado.","ok");
else toast("Não foi possível baixar as instruções.","error");
break;
}

case"open-provider-github": {
chrome.runtime.sendMessage({type:"OPEN_URL",url:"https://github.com/"});
break;
}

case"watermark":
applyPromptTemplate(WATERMARK_PROMPT,"Prompt de limpeza de marca");
break;

case"project-guide":
await openProviderConnection(state.provider,{autoConnect:false});
break;

case"expand":
toggleExpanded();
break;

case"close":
root.classList.remove("open");
break;

case"attach":
tone("attach");
$("#uc-files").click();
break;

case"improve":
improvePromptLocally();
break;

case"clear-skills":
state.selected.clear();
await chrome.storage.local.set({unstoppableSelectedSkills:[]});
renderSkills();
toast("Todas as Skills foram desativadas.","tap");
break;

case"send":
await executeCommand();
break;

case"github":
tone("open");
if (state.binding?.repo) {
chrome.runtime.sendMessage({
type:"OPEN_URL",
url:`https://github.com/${state.binding.repo}/tree/${state.binding.branch.split("/").map(encodeURIComponent).join("/")}`
});
} else {
switchPanel("connections");
toast("Conecte seu GitHub e selecione o repositório.","tap");
}
break;

case"download":
tone("click");
if (state.binding?.repo) {
const dl=await chrome.runtime.sendMessage({
type:"DOWNLOAD_REPO",
repo:state.binding.repo,
branch:state.binding.branch
});
toast(dl?.ok?"Download do projeto iniciado.":(dl?.error ||"Falha ao baixar projeto."),dl?.ok?"ok":"error");
} else {
switchPanel("connections");
toast("Selecione repositório e branch antes de baixar.","error");
}
break;

case"supabase":
tone("open");
if(state.binding?.supabaseDashboardUrl || state.config.supabaseDashboardUrl !=="https://supabase.com/dashboard/projects") {
chrome.runtime.sendMessage({type:"OPEN_URL",url:state.binding?.supabaseDashboardUrl || state.config.supabaseDashboardUrl});
} else {
switchPanel("connections");
toast("Detecte ou configure seu projeto Supabase.","tap");
}
break;

case"publish": {
tone("click");
if (!state.binding?.projectId || !state.binding?.repo) {
switchPanel("connections");
toast("Conecte o projeto, repositório e branch antes de publicar.","error");
return;
}
if (!confirm("Publicar somente o estado já sincronizado do GitHub no Lovable?")) return;

const deployPrompt =`[UNSTOPPABLE_DEPLOY_ONLY]
Projeto Lovable: ${state.binding.projectId}
Repositório: ${state.binding.repo}
Branch: ${state.binding.branch}

Use o Lovable APENAS para deploy.
Não edite código.
Não use Visual Edit.
Não faça correções.
Publique somente a versão já sincronizada do GitHub e retorne a URL pública.
[/UNSTOPPABLE_DEPLOY_ONLY]`;

const result = await chrome.runtime.sendMessage({
type:"EXECUTE",
provider:"chatgpt",
repo:state.binding.repo,
branch:state.binding.branch,
prompt:deployPrompt,
skills:[],
images:[]
});

if (result?.ok) startPolling(result.requestId);
else toast("Conecte o ChatGPT para publicar.","error");
break;
}

case"connect-chat":
await openProviderConnection("chatgpt",{autoConnect:true});
setTimeout(refreshConnections,1000);
break;

case"toggle-login":
tone("open");
$("#uc-login").classList.toggle("show");
break;

case"supa-submit": {
const email = $("#uc-email").value.trim();
const password = $("#uc-password").value;
if (!email || !password) {
toast("Informe e-mail e senha.","error");
return;
}

const result = await chrome.runtime.sendMessage({
type:"SUPA_LOGIN",email,password
});
$("#uc-password").value ="";

if (result?.ok) toast("Supabase conectado.","ok");
else toast(result?.error ||"Falha no login.","error");

refreshConnections();
break;
}

case"whatsapp":
chrome.runtime.sendMessage({type:"OPEN_SUPPORT",source:"menu"});
tone("message");
break;

case"refresh-account":
await refreshAccount(true);
toast("Dados da conta atualizados.","ok");
break;

case"sound":
state.config.soundsEnabled = !state.config.soundsEnabled;
await chrome.runtime.sendMessage({
type:"SAVE_CONFIG",
config:{soundsEnabled:state.config.soundsEnabled}
});
$("#uc-sound-status").textContent = state.config.soundsEnabled ?"Ativados" :"Desativados";
if (state.config.soundsEnabled) tone("ok");
break;

case"notifications":
state.config.notificationsEnabled = !state.config.notificationsEnabled;
await chrome.runtime.sendMessage({
type:"SAVE_CONFIG",
config:{notificationsEnabled:state.config.notificationsEnabled}
});
$("#uc-notification-status").textContent = state.config.notificationsEnabled ?"Ativadas" :"Desativadas";
toast(
state.config.notificationsEnabled ?"Notificações de conclusão ativadas." :"Notificações de conclusão desativadas.",
"tap"
);
break;
}
});

root.addEventListener("change",event=>{
const target=event.target;
if(target?.id ==="uc-github-repo") {
if(state.lovableGitSync?.confirmed && target.value && target.value!==state.lovableGitSync.repo){
state.lovableGitSync=null;
if(state.binding){ state.binding.lovableGitSyncConfirmed=false; state.binding.lovableGitRepo=null; state.binding.lovableGitBranch=null; }
setConnectionOverview("lovable",false,"Repo alterado");
const syncStatus=$("#uc-lovable-sync-status"); if(syncStatus) syncStatus.textContent="O repositório selecionado não é mais o vínculo confirmado da Lovable. Detecte novamente antes de executar.";
}
loadGithubBranches(target.value,{preferred:null}).catch(()=>null);
}
if(target?.id ==="uc-github-branch") {
const ready=!!target.value;
setConnectionOverview("project",ready,ready?"Pronto para vincular":"Aguardando branch");
if(ready) detectSupabaseForSelection({silent:true}).catch(()=>null);
}
});

async function init() {
state.config = (await chrome.runtime.sendMessage({type:"GET_CONFIG"})).config;
await enforceLicense();
state.provider = state.config.provider ||"auto";
state.config.lovableChatLock = true;
await chrome.runtime.sendMessage({type:"SAVE_CONFIG",config:{lovableChatLock:true}});
chrome.runtime.sendMessage({type:"PLAY_STARTUP_SOUND"}).catch?.(()=>null);

renderProviders();
await loadSkills();
await detectProject();
await hydrateLovableSyncActivity().catch(()=>null);
setupDrag();
setupWindowDrag();

const saved = (await chrome.storage.local.get("unstoppableDock")).unstoppableDock;
if (saved) {
$(".uc-dock").style.left =`${saved.x}px`;
$(".uc-dock").style.top =`${saved.y}px`;
}

const savedWindow = (await chrome.storage.local.get("unstoppableWindow")).unstoppableWindow;
if (savedWindow) {
const panel = $(".uc-window");
panel.style.left =`${Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,savedWindow.x))}px`;
panel.style.right ="auto";
panel.style.top =`${Math.max(8,Math.min(innerHeight-panel.offsetHeight-8,savedWindow.y))}px`;
}

$("#uc-sound-status").textContent = state.config.soundsEnabled ?"Ativados" :"Desativados";
$("#uc-notification-status").textContent = state.config.notificationsEnabled ?"Ativadas" :"Desativadas";

$("#uc-skill-search").addEventListener("input",event => {
state.skillSearch = event.target.value ||"";
renderSkills();
});

$("#uc-files").addEventListener("change",async event => {
await addAttachments(event.target.files);
event.target.value ="";
});

$("#uc-drop").addEventListener("dragover",event => {
event.preventDefault();
$("#uc-drop").classList.add("drag");
});

$("#uc-drop").addEventListener("dragleave",() => $("#uc-drop").classList.remove("drag"));

$("#uc-drop").addEventListener("drop",event => {
event.preventDefault();
$("#uc-drop").classList.remove("drag");
addAttachments(event.dataTransfer.files);
});

$("#uc-prompt").addEventListener("paste",event => {
const files = [...(event.clipboardData?.items || [])]
.filter(item => item.kind ==="file")
.map(item => item.getAsFile())
.filter(Boolean);
if (files.length) addAttachments(files);
});

const githubCodeField=$("#uc-github-device-code-input");
githubCodeField?.addEventListener("focus",()=>githubCodeField.select());
githubCodeField?.addEventListener("click",()=>githubCodeField.select());

updateLovableLock();
await refreshConnections();
await refreshAccount(false);

const lastExecution = (await chrome.runtime.sendMessage({type:"GET_EXECUTION"}))?.execution;
if (lastExecution?.requestId && !lastExecution.done) {
startPolling(lastExecution.requestId);
applyExecutionSnapshot(lastExecution);
}

let lastUrl = location.href;
setInterval(async () => {
if (location.href !== lastUrl) {
lastUrl = location.href;
await detectProject();
updateLovableLock();
}
},1200);
}

init().catch(console.error);
})();
