// docs/app.js — landing i18n (pt-BR/en-US/es-ES), theme, terminal loop. Zero deps.
// O APK ainda não existe: androidBtn fica em "em breve" (link pro repo).
// Quando `personalize-my-cv.apk` subir na raiz: androidBtn.href = APK_URL.
const APK_URL = "https://github.com/filipeleonelbatista/personalize-my-cv/raw/master/personalize-my-cv.apk";
const REPO_URL = "https://github.com/filipeleonelbatista/personalize-my-cv";

const STRINGS = {
  "pt-BR": {
    "navFeatures": "Recursos", "navApp": "App", "navCli": "CLI", "navCollab": "Colaborar", "navDonors": "Doadores",
    "badge": "100% estático · sem backend · sua chave Gemini",
    "h1": "Currículos sob medida com IA",
    "sub": "Cadastre seu CV base em PDF e gere versões otimizadas por vaga — afinidade, email e mensagem. Grátis, sem conta: seus dados ficam no seu navegador.",
    "ctaWeb": "Usar o app web", "ctaGh": "Ver no GitHub",
    "featTitle": "Tudo que o app faz",
    "f1-t": "CV base via IA", "f1-d": "Envie o PDF e a IA cataloga seus dados em JSON.",
    "f2-t": "Match por vaga", "f2-d": "Índice de afinidade com pontos fortes e fracos.",
    "f3-t": "Email + mensagem", "f3-d": "Email de apresentação e mensagem prontos pra copiar.",
    "f4-t": "Relatórios semanais", "f4-d": "Histórico e gráficos das candidaturas.",
    "f5-t": "Backup export/import", "f5-d": "Leve seus dados pra qualquer navegador.",
    "f6-t": "Offline + PWA", "f6-d": "Instalável, com fallback offline.",
    "f7-t": "3 idiomas", "f7-d": "UI completa em PT, EN e ES.",
    "f8-t": "Tema claro/escuro", "f8-d": "Segue seu sistema.",
    "appTitle": "Leve no bolso", "appSub": "App nativo com as mesmas funções. Android primeiro.",
    "androidBtn": "Baixar para Android", "androidSoon": "Em breve: APK na raiz do repo",
    "iosBadge": "iOS em breve", "apkNote": "Builds preview via EAS; a listagem Play vem depois.",
    "cliTitle": "Automatize no terminal",
    "cliSub": "`personalize-cv`: onboarding uma vez, gere por vaga, acompanhe metas — scripteável e agent-friendly.",
    "agentsNote": "Agent-friendly: automatize com Claude Code, OpenCode, Codex e outros.",
    "collabTitle": "Colabore", "collabSub": "Projeto colaborativo, gratuito para sempre (AGPL-3.0).",
    "cIssues-t": "Issues", "cIssues-d": "Reporte bugs ou sugira funções.",
    "cPRs-t": "Pull requests", "cPRs-d": "Código, testes e correções bem-vindos.",
    "cI18n-t": "Traduções", "cI18n-d": "Ajude com PT, EN e ES.",
    "cDocs-t": "Docs", "cDocs-d": "Guias e exemplos.",
    "repoBtn": "Abrir o repositório", "licNote": "AGPL-3.0-only: derivados ficam livres e abertos.",
    "donorsTitle": "Doadores VIP", "donorsEmpty": "Ninguém ainda — seja a primeira pessoa.",
    "donorsCta": "Apoiar", "donorsDoc": "Ver DONORS.md",
    "footRights": "Grátis para sempre sob AGPL-3.0.", "footBy": "Feito por filipeleonelbatista"
  },
  "en-US": {
    "navFeatures": "Features", "navApp": "App", "navCli": "CLI", "navCollab": "Contribute", "navDonors": "Donors",
    "badge": "100% static · no backend · your Gemini key",
    "h1": "Tailored resumes with AI",
    "sub": "Register your base CV as PDF and generate optimized versions per job — match score, email and message. Free, no account: your data stays in your browser.",
    "ctaWeb": "Open the web app", "ctaGh": "View on GitHub",
    "featTitle": "Everything the app does",
    "f1-t": "AI base CV", "f1-d": "Upload the PDF and AI catalogs your data as JSON.",
    "f2-t": "Per-job match", "f2-d": "Affinity score with strengths and weaknesses.",
    "f3-t": "Email + message", "f3-d": "Cover email and instant message, ready to copy.",
    "f4-t": "Weekly reports", "f4-d": "History and charts of your applications.",
    "f5-t": "Backup export/import", "f5-d": "Take your data to any browser.",
    "f6-t": "Offline + PWA", "f6-d": "Installable shell with offline fallback.",
    "f7-t": "3 languages", "f7-d": "Full UI in PT, EN and ES.",
    "f8-t": "Light/dark theme", "f8-d": "Follows your system.",
    "appTitle": "Take it with you", "appSub": "Native app with the same features. Android first.",
    "androidBtn": "Download for Android", "androidSoon": "Coming soon: APK at the repo root",
    "iosBadge": "iOS soon", "apkNote": "Preview builds via EAS; the Play listing comes later.",
    "cliTitle": "Automate in the terminal",
    "cliSub": "`personalize-cv`: onboard once, generate per job, track goals — scriptable and agent-friendly.",
    "agentsNote": "Agent-friendly: automate it with Claude Code, OpenCode, Codex and others.",
    "collabTitle": "Contribute", "collabSub": "Collaborative project, free forever (AGPL-3.0).",
    "cIssues-t": "Issues", "cIssues-d": "Report bugs or suggest features.",
    "cPRs-t": "Pull requests", "cPRs-d": "Code, tests and fixes welcome.",
    "cI18n-t": "Translations", "cI18n-d": "Help with PT, EN and ES.",
    "cDocs-t": "Docs", "cDocs-d": "Guides and examples.",
    "repoBtn": "Open the repository", "licNote": "AGPL-3.0-only: derivatives stay free and open.",
    "donorsTitle": "VIP donors", "donorsEmpty": "Nobody yet — be the first.",
    "donorsCta": "Support", "donorsDoc": "See DONORS.md",
    "footRights": "Free forever under AGPL-3.0.", "footBy": "Built by filipeleonelbatista"
  },
  "es-ES": {
    "navFeatures": "Recursos", "navApp": "App", "navCli": "CLI", "navCollab": "Colaborar", "navDonors": "Donantes",
    "badge": "100% estático · sin backend · tu clave de Gemini",
    "h1": "Currículos a medida con IA",
    "sub": "Registra tu CV base en PDF y genera versiones optimizadas por vacante — afinidad, correo y mensaje. Gratis, sin cuenta: tus datos quedan en tu navegador.",
    "ctaWeb": "Usar la app web", "ctaGh": "Ver en GitHub",
    "featTitle": "Todo lo que hace la app",
    "f1-t": "CV base con IA", "f1-d": "Sube el PDF y la IA cataloga tus datos en JSON.",
    "f2-t": "Afinidad por vacante", "f2-d": "Puntaje con fortalezas y debilidades.",
    "f3-t": "Correo + mensaje", "f3-d": "Correo de presentación y mensaje, listos para copiar.",
    "f4-t": "Informes semanales", "f4-d": "Historial y gráficos de tus candidaturas.",
    "f5-t": "Respaldo export/import", "f5-d": "Lleva tus datos a cualquier navegador.",
    "f6-t": "Offline + PWA", "f6-d": "Instalable, con fallback sin conexión.",
    "f7-t": "3 idiomas", "f7-d": "UI completa en PT, EN y ES.",
    "f8-t": "Tema claro/oscuro", "f8-d": "Sigue tu sistema.",
    "appTitle": "Llévalo contigo", "appSub": "App nativa con las mismas funciones. Android primero.",
    "androidBtn": "Descargar para Android", "androidSoon": "Próximamente: APK en la raíz del repo",
    "iosBadge": "iOS pronto", "apkNote": "Builds preview vía EAS; el listado Play viene después.",
    "cliTitle": "Automatiza en la terminal",
    "cliSub": "`personalize-cv`: onboarding una vez, genera por vacante, sigue metas — scripteable y agent-friendly.",
    "agentsNote": "Agent-friendly: automatízalo con Claude Code, OpenCode, Codex y otros.",
    "collabTitle": "Colabora", "collabSub": "Proyecto colaborativo, gratis para siempre (AGPL-3.0).",
    "cIssues-t": "Issues", "cIssues-d": "Reporta bugs o sugiere funciones.",
    "cPRs-t": "Pull requests", "cPRs-d": "Código, tests y fixes bienvenidos.",
    "cI18n-t": "Traducciones", "cI18n-d": "Ayuda con PT, EN y ES.",
    "cDocs-t": "Docs", "cDocs-d": "Guías y ejemplos.",
    "repoBtn": "Abrir el repositorio", "licNote": "AGPL-3.0-only: los derivados siguen libres y abiertos.",
    "donorsTitle": "Donantes VIP", "donorsEmpty": "Nadie aún — sé la primera persona.",
    "donorsCta": "Apoyar", "donorsDoc": "Ver DONORS.md",
    "footRights": "Gratis para siempre bajo AGPL-3.0.", "footBy": "Hecho por filipeleonelbatista"
  }
};

const TERMINAL = {
  "pt-BR": [
    "$ personalize-cv",
    "? Sua chave Gemini ********",
    "? PDF do CV ./meu-cv.pdf",
    "✓ Base criada: Ana — Dev (pt-BR)",
    "$ personalize-cv",
    "? Cole o texto da vaga…",
    "✓ Match 92% · PDF em ./cv-vaga-acme.pdf",
    "$ personalize-cv --report",
    "Semana: 3 candidaturas · média 87%"
  ],
  "en-US": [
    "$ personalize-cv",
    "? Your Gemini key ********",
    "? CV PDF ./my-cv.pdf",
    "✓ Base ready: Ana — Dev (en)",
    "$ personalize-cv",
    "? Paste the job posting…",
    "✓ Match 92% · PDF at ./cv-acme-job.pdf",
    "$ personalize-cv --report",
    "Week: 3 applications · avg 87%"
  ],
  "es-ES": [
    "$ personalize-cv",
    "? Tu clave de Gemini ********",
    "? PDF del CV ./mi-cv.pdf",
    "✓ Base lista: Ana — Dev (es)",
    "$ personalize-cv",
    "? Pega el texto de la vacante…",
    "✓ Afinidad 92% · PDF en ./cv-vacante-acme.pdf",
    "$ personalize-cv --report",
    "Semana: 3 candidaturas · media 87%"
  ]
};

let currentLocale = "pt-BR";
let termTimer = null;

function playTerminal(locale) {
  const body = document.getElementById("termBody");
  if (!body) return;
  clearTimeout(termTimer);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    body.textContent = TERMINAL[locale].join("\n");
    return;
  }
  const lines = TERMINAL[locale];
  let li = 0, ci = 0;
  body.textContent = "";
  (function tick() {
    if (li >= lines.length) { termTimer = setTimeout(() => playTerminal(locale), 3500); return; }
    const line = lines[li];
    body.textContent += line[ci] || "";
    ci++;
    if (ci > line.length) {
      body.textContent += "\n"; li++; ci = 0;
      termTimer = setTimeout(tick, line.startsWith("$") ? 500 : 260);
    } else {
      termTimer = setTimeout(tick, line.startsWith("$") ? 60 : 14);
    }
  })();
}

function setLocale(l) {
  const d = STRINGS[l] || STRINGS["pt-BR"];
  currentLocale = STRINGS[l] ? l : "pt-BR";
  document.documentElement.lang = currentLocale;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (d[k] !== undefined) el.textContent = d[k];
    else console.warn("[docs] missing key:", currentLocale, k);
  });
  try { localStorage.setItem("docs:locale", l); } catch (e) { /* privado */ }
  playTerminal(currentLocale);
}

function detectLocale() {
  try {
    const saved = localStorage.getItem("docs:locale");
    if (STRINGS[saved]) return saved;
  } catch (e) { /* privado */ }
  const nav = (navigator.language || "pt-BR").toLowerCase();
  if (nav.startsWith("es")) return "es-ES";
  if (nav.startsWith("en")) return "en-US";
  return "pt-BR";
}

function setTheme(mode) {
  document.documentElement.dataset.theme = mode;
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = mode === "dark" ? "☀" : "☾";
  try { localStorage.setItem("docs:theme", mode); } catch (e) { /* privado */ }
}

function detectTheme() {
  try {
    const saved = localStorage.getItem("docs:theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch (e) { /* privado */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("langSelect");
  const initial = detectLocale();
  if (sel) {
    sel.value = initial;
    sel.addEventListener("change", (e) => setLocale(e.target.value));
  }
  setLocale(initial);
  setTheme(detectTheme());
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
  }
  const btn = document.getElementById("androidBtn");
  if (btn) {
    btn.href = REPO_URL; // em breve: APK_URL (ver topo do arquivo)
    btn.dataset.soon = "1";
  }
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); } });
  });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
});
