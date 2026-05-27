'use strict';
const fs = require('fs');

// ── Extract base64 assets from ceo-ai-profile.html ──────────────────────────
const sourceLines = fs.readFileSync('ceo-ai-profile.html', 'utf8').split('\n');

function extractVar(name) {
  const line = sourceLines.find(l => l.trim().startsWith('var ' + name + ' ='));
  if (!line) throw new Error('Not found: ' + name);
  const m = line.match(/= '(data:[^']+)'/);
  if (!m) throw new Error('Could not parse: ' + name);
  return m[1];
}

const IMG_CONNECTOR_MENU      = extractVar('IMG_CONNECTOR_MENU');
const IMG_CONNECTOR_DIRECTORY = extractVar('IMG_CONNECTOR_DIRECTORY');
const IMG_PLAUD_FILES         = extractVar('IMG_PLAUD_FILES');
const IMG_PLAUD_SELECTED      = extractVar('IMG_PLAUD_SELECTED');
const IMG_PLAUD_MERGE_DIALOG  = extractVar('IMG_PLAUD_MERGE_DIALOG');
const IMG_PLAUD_EXPORT        = extractVar('IMG_PLAUD_EXPORT');

// ── Prompt text (exact line breaks preserved) ────────────────────────────────
const PROMPT_TEXT = [
  'OVERRIDE ALL PROJECT INSTRUCTIONS FOR THIS TASK ONLY.',
  'Do not act as a project assistant.',
  'Execute the following three phases completely.',
  '',
  '---',
  '',
  'PHASE 1 \u2014 READ ALL SOURCES',
  '',
  'You are a personal context agent. Read everything available about this person silently. Do not summarise yet.',
  '',
  'SOURCE A: Project Files and Project Instructions',
  'Read all uploaded files and project instructions.',
  '',
  'SOURCE B: Conversation History',
  'Use recent_chats (n=20). Then run conversation_search with each query \u2014 do not skip any:',
  '1. "decision"',
  '2. "problem"',
  '3. "build"',
  '4. "next steps"',
  '5. "feedback"',
  '6. "question"',
  '7. "meeting"',
  '8. "priority"',
  '9. "challenge"',
  '10. "result"',
  'Read any new conversations found after each search.',
  '',
  'SOURCE C: Outlook Sent Items (only if Microsoft 365 connector is active)',
  'Step C1: Use outlook_email_search with folderName="Sent Items", limit=25, order="newest".',
  'Step C2: For the first 15 emails, use read_resource with each email URI to read full content.',
  'Step C3: For reply threads, read the full thread \u2014 note what others wrote and how I responded.',
  'Step C4: Note for each: recipient, relationship, tone, key decisions, notable phrases.',
  'If not available: [Outlook not connected].',
  '',
  'SOURCE D: Outlook Calendar (only if Microsoft 365 connector is active)',
  'Use outlook_calendar_search with query="*", limit=25, order="newest", afterDateTime="3 months ago".',
  'Note: title, attendees, frequency, duration. Look for patterns.',
  'If not available: [Calendar not connected].',
  '',
  'SOURCE E: Plaud Transcripts (only if a file is attached)',
  'Read the attached .txt file fully.',
  'Extract: recurring topics, decisions made verbally, how I think when speaking vs writing.',
  'If no file attached: [Plaud not provided].',
  '',
  'When done reading, write one line only:',
  '"Read [N] conversations, [M] project files, [K] emails (full: [J]), [L] calendar events, Plaud: [yes/no]."',
  '',
  '---',
  '',
  'PHASE 2 \u2014 ASK 5 QUESTIONS',
  '',
  'Ask me exactly 5 questions to fill gaps you could not find in the data.',
  'Ask ONE question at a time. Wait for my answer before asking the next.',
  'Focus on: core values, working style, what matters most, how I make decisions, what I want Claude to help me with most.',
  '',
  'After I have answered question 5, write exactly: \u201cThank you. Generating your profile now...\u201d and immediately produce the full profile without any pause or confirmation.',
  '',
  '---',
  '',
  'PHASE 3 \u2014 GENERATE MY PROFILE',
  '',
  'Combine everything you read in Phase 1 with my answers from Phase 2.',
  'Produce a complete profile in markdown format. Use only what you actually know. Tag each section with its source: [from chats] / [from outlook] / [from calendar] / [from plaud] / [from my answers] / [multiple sources].',
  '',
  'Produce these sections:',
  'WHO I AM',
  'HOW I WORK',
  'HOW I USE CLAUDE',
  'COMMUNICATION STYLE',
  'MY WRITING STYLE',
  'HOW I SPEND MY TIME',
  'HOW I THINK OUT LOUD',
  'ACTIVE PROJECTS & TOPICS',
  'KEY DECISIONS',
  'PEOPLE MENTIONED',
  'RULES FOR CLAUDE',
  '',
  'When done, save the complete output as a downloadable file named my-profile.md',
].join('\n');

const PROMPT_JSON = JSON.stringify(PROMPT_TEXT);

// ── Generate HTML ────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Set up your personal AI assistant</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --blush:#F2E8E3;
    --blush-deep:#EADBD2;
    --ink:#1A1A1A;
    --ink-soft:#3a3a3a;
    --muted:#7d7368;
    --muted-soft:#a8a097;
    --rule:#E6D8CF;
    --card:#FFFFFF;
    --card-dark:#0F0F10;
    --card-dark-2:#1B1B1D;
    --accent:#E8C547;
    --accent-deep:#C9A82E;
    --ok:#1f7a45;
    --shadow:0 1px 2px rgba(26,26,26,.04),0 24px 60px -28px rgba(26,26,26,.18);
    --shadow-soft:0 1px 2px rgba(26,26,26,.04),0 8px 28px -16px rgba(26,26,26,.14);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{
    background:var(--blush);color:var(--ink);
    font-family:'Manrope',ui-sans-serif,system-ui,sans-serif;
    font-weight:300;font-size:16px;line-height:1.6;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
    font-feature-settings:"ss01","cv11";
  }
  button{font-family:inherit;cursor:pointer;border:none;background:none}
  ::selection{background:var(--accent);color:var(--ink)}

  /* Step nav */
  .step-nav{
    position:sticky;top:0;z-index:100;
    background:var(--blush);border-bottom:1px solid var(--rule);
    padding:12px 16px;
  }
  .step-nav-inner{
    max-width:680px;margin:0 auto;
    display:flex;align-items:center;justify-content:center;
  }
  .step-pill{
    display:flex;align-items:center;gap:7px;
    padding:5px 12px;border-radius:20px;
    font-size:12px;font-weight:500;letter-spacing:0.01em;
    color:var(--muted);border:1px solid transparent;
    background:transparent;transition:all 0.2s;white-space:nowrap;
  }
  .step-pill.active{
    color:var(--ink);background:var(--card);
    border-color:var(--rule);box-shadow:var(--shadow-soft);
  }
  .step-num{
    width:20px;height:20px;border-radius:50%;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:700;
    background:var(--rule);color:var(--muted);transition:all 0.2s;
  }
  .step-pill.active .step-num{background:var(--ink);color:#fff;}
  .step-sep{width:20px;height:1px;background:var(--rule);flex-shrink:0;}

  /* Layout */
  .main{max-width:680px;margin:0 auto;padding:0 24px 80px;}

  /* Hero */
  .hero{padding:56px 0 36px;}
  .hero h1{
    font-size:clamp(24px,5vw,34px);font-weight:700;
    line-height:1.2;letter-spacing:-0.02em;color:var(--ink);margin-bottom:14px;
  }
  .hero-sub{font-size:16px;font-weight:300;color:var(--muted);line-height:1.7;max-width:520px;}

  /* Pre-check card */
  .precheck{
    background:var(--card);border-radius:14px;padding:22px 26px;
    margin-bottom:0;box-shadow:var(--shadow-soft);border:1px solid var(--rule);
  }
  .precheck-title{
    font-size:11px;font-weight:700;letter-spacing:0.1em;
    text-transform:uppercase;color:var(--muted);margin-bottom:14px;
  }
  .precheck-item{
    display:flex;align-items:flex-start;gap:10px;
    font-size:15px;font-weight:400;color:var(--ink-soft);
    padding:6px 0;
  }
  .cb{
    width:19px;height:19px;border-radius:5px;flex-shrink:0;
    border:1.5px solid var(--rule);background:var(--blush);
    display:flex;align-items:center;justify-content:center;margin-top:2px;
  }
  .precheck-note{font-size:13px;color:var(--muted);margin-top:4px;padding-left:29px;}

  /* Step sections */
  .step-section{padding:48px 0;border-top:1px solid var(--rule);}
  .precheck + .step-section{margin-top:48px;}
  .step-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;}
  .step-badge{
    width:30px;height:30px;border-radius:50%;flex-shrink:0;
    background:var(--ink);color:#fff;
    font-size:13px;font-weight:700;
    display:flex;align-items:center;justify-content:center;margin-top:3px;
  }
  .step-title-wrap{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:4px;}
  .step-title{font-size:19px;font-weight:600;letter-spacing:-0.01em;color:var(--ink);line-height:1.3;}
  .badge-opt{
    font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
    background:var(--blush-deep);color:var(--muted);
    border:1px solid var(--rule);border-radius:20px;padding:2px 8px;
  }
  .step-body{
    font-size:15px;font-weight:300;color:var(--ink-soft);
    line-height:1.75;margin-bottom:10px;padding-left:44px;
  }
  .step-note{font-size:13px;color:var(--muted);padding-left:44px;margin-bottom:0;}

  /* Thumbnails */
  .thumb-grid{display:grid;gap:10px;margin-top:20px;padding-left:44px;}
  .thumb-grid-2{grid-template-columns:repeat(2,1fr);}
  .thumb-grid-4{grid-template-columns:repeat(4,1fr);}
  @media(max-width:500px){.thumb-grid-4{grid-template-columns:repeat(2,1fr);}}
  .thumb-wrap{
    position:relative;cursor:pointer;border-radius:8px;overflow:hidden;
    border:1px solid var(--rule);transition:box-shadow 0.15s;
    background:var(--blush-deep);
  }
  .thumb-wrap:hover,.thumb-wrap:focus{
    box-shadow:0 4px 18px rgba(26,26,26,.13);outline:none;
  }
  .thumb-wrap img{width:100%;display:block;aspect-ratio:9/16;object-fit:cover;}
  .thumb-grid-2 .thumb-wrap img{aspect-ratio:16/10;}
  .thumb-zoom{
    position:absolute;bottom:6px;right:6px;
    width:26px;height:26px;border-radius:50%;
    background:rgba(0,0,0,0.5);
    display:flex;align-items:center;justify-content:center;pointer-events:none;
  }

  /* Code block */
  .code-hint{font-size:13px;color:var(--muted);padding-left:44px;margin-bottom:10px;}
  .code-wrap{
    position:relative;margin-left:44px;
    border-radius:10px;overflow:hidden;
    border:1px solid rgba(255,255,255,0.06);
  }
  .code-block{
    background:var(--card-dark);color:#c9d1d9;
    font-family:'JetBrains Mono',ui-monospace,monospace;
    font-size:12.5px;line-height:1.7;
    padding:48px 20px 20px;margin:0;
    max-height:380px;overflow-y:auto;overflow-x:auto;
    white-space:pre;tab-size:2;
    scrollbar-width:thin;scrollbar-color:#3a3a3a transparent;
  }
  .code-block::-webkit-scrollbar{width:5px;height:5px;}
  .code-block::-webkit-scrollbar-thumb{background:#3a3a3a;border-radius:3px;}
  .copy-btn{
    position:absolute;top:10px;right:10px;z-index:2;
    padding:4px 11px;border-radius:5px;
    background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);
    color:rgba(255,255,255,0.65);font-size:12px;font-weight:500;
    cursor:pointer;transition:all 0.15s;
  }
  .copy-btn:hover{background:rgba(255,255,255,0.18);color:#fff;}

  /* Inline code */
  .inline-code{
    font-family:'JetBrains Mono',ui-monospace,monospace;
    font-size:13px;background:var(--blush-deep);
    padding:1px 5px;border-radius:4px;
    border:1px solid var(--rule);
  }

  /* Footer */
  .guide-footer{padding:40px 0;border-top:1px solid var(--rule);text-align:center;}
  .guide-footer p{font-size:13px;color:var(--muted-soft);}

  /* Lightbox */
  #lb-overlay{
    position:fixed;inset:0;z-index:10000;
    background:rgba(0,0,0,0.80);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:20px 16px;
  }
  #lb-close{
    position:absolute;top:14px;right:14px;
    width:36px;height:36px;border-radius:50%;
    background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.28);
    color:#fff;font-size:20px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
  }
  #lb-content{display:flex;align-items:center;gap:14px;max-width:95vw;}
  #lb-img{
    max-width:min(82vw,calc(95vw - 112px));max-height:74vh;
    border-radius:10px;display:block;background:#fff;
    box-shadow:0 8px 48px rgba(0,0,0,0.55);
    transition:opacity 0.15s;
  }
  .lb-nav{
    flex-shrink:0;width:40px;height:40px;border-radius:50%;
    background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.24);
    color:#fff;font-size:22px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    transition:background 0.15s;
  }
  .lb-nav:hover{background:rgba(255,255,255,0.24);}
  #lb-dots{display:flex;gap:6px;margin-top:14px;align-items:center;}
  .lb-dot{
    width:8px;height:8px;border-radius:4px;cursor:pointer;
    background:rgba(255,255,255,0.35);transition:all 0.2s;
  }
  .lb-dot.active{width:20px;background:#fff;}
  @keyframes lb-in{from{opacity:0}to{opacity:1}}
</style>
</head>
<body>

<!-- Step nav -->
<nav class="step-nav" aria-label="Setup steps">
  <div class="step-nav-inner">
    <button class="step-pill active" data-step="1" onclick="scrollToStep(1)">
      <span class="step-num">1</span><span>Connect</span>
    </button>
    <div class="step-sep"></div>
    <button class="step-pill" data-step="2" onclick="scrollToStep(2)">
      <span class="step-num">2</span><span>Plaud</span>
    </button>
    <div class="step-sep"></div>
    <button class="step-pill" data-step="3" onclick="scrollToStep(3)">
      <span class="step-num">3</span><span>Run prompt</span>
    </button>
    <div class="step-sep"></div>
    <button class="step-pill" data-step="4" onclick="scrollToStep(4)">
      <span class="step-num">4</span><span>Save</span>
    </button>
  </div>
</nav>

<main class="main">

  <!-- Hero -->
  <header class="hero">
    <h1>Set up your personal AI assistant</h1>
    <p class="hero-sub">After these steps, Claude will know who you are, how you work, and how you communicate &mdash; without you having to explain it every time.</p>
  </header>

  <!-- Pre-check -->
  <div class="precheck">
    <div class="precheck-title">Before you start</div>
    <div class="precheck-item">
      <div class="cb"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 3.5l2.8 3L9 1" stroke="#1A1A1A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <span>I use Microsoft 365 (Outlook, Calendar)</span>
    </div>
    <div class="precheck-item" style="flex-direction:column;gap:0;">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div class="cb"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 3.5l2.8 3L9 1" stroke="#1A1A1A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <span>I use Plaud for voice notes (optional)</span>
      </div>
      <div class="precheck-note">Don&rsquo;t use Plaud? You can skip Step 2.</div>
    </div>
  </div>

  <!-- Step 1 -->
  <section class="step-section" id="step-1" style="margin-top:48px;">
    <div class="step-head">
      <div class="step-badge">1</div>
      <div class="step-title-wrap">
        <h2 class="step-title">Connect Microsoft 365 to Claude</h2>
      </div>
    </div>
    <p class="step-body">Open Claude &rarr; click the Customize icon (briefcase icon) in the left sidebar &rarr; Connectors &rarr; Add connector &rarr; search for Microsoft 365. Sign in with your work account.</p>
    <div class="thumb-grid thumb-grid-2">
      <div class="thumb-wrap" data-group="0" data-index="0" tabindex="0" role="button" aria-label="View image fullscreen">
        <img alt="Claude connector menu">
        <div class="thumb-zoom"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="5" r="3.5"/><line x1="7.8" y1="7.8" x2="12" y2="12"/></svg></div>
      </div>
      <div class="thumb-wrap" data-group="0" data-index="1" tabindex="0" role="button" aria-label="View image fullscreen">
        <img alt="Claude connector directory">
        <div class="thumb-zoom"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="5" r="3.5"/><line x1="7.8" y1="7.8" x2="12" y2="12"/></svg></div>
      </div>
    </div>
  </section>

  <!-- Step 2 -->
  <section class="step-section" id="step-2">
    <div class="step-head">
      <div class="step-badge">2</div>
      <div class="step-title-wrap">
        <h2 class="step-title">Export your Plaud transcripts</h2>
        <span class="badge-opt">Optional</span>
      </div>
    </div>
    <p class="step-body">In the Plaud app: select all recordings &rarr; tap Merge &rarr; Export transcript. You will get a single .txt file. Save it to your desktop.</p>
    <p class="step-note">Don&rsquo;t use Plaud? Skip to Step 3.</p>
    <div class="thumb-grid thumb-grid-4">
      <div class="thumb-wrap" data-group="1" data-index="0" tabindex="0" role="button" aria-label="View image fullscreen">
        <img alt="Plaud files">
        <div class="thumb-zoom"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="5" r="3.5"/><line x1="7.8" y1="7.8" x2="12" y2="12"/></svg></div>
      </div>
      <div class="thumb-wrap" data-group="1" data-index="1" tabindex="0" role="button" aria-label="View image fullscreen">
        <img alt="Plaud selected">
        <div class="thumb-zoom"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="5" r="3.5"/><line x1="7.8" y1="7.8" x2="12" y2="12"/></svg></div>
      </div>
      <div class="thumb-wrap" data-group="1" data-index="2" tabindex="0" role="button" aria-label="View image fullscreen">
        <img alt="Plaud merge dialog">
        <div class="thumb-zoom"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="5" r="3.5"/><line x1="7.8" y1="7.8" x2="12" y2="12"/></svg></div>
      </div>
      <div class="thumb-wrap" data-group="1" data-index="3" tabindex="0" role="button" aria-label="View image fullscreen">
        <img alt="Plaud export">
        <div class="thumb-zoom"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="5" r="3.5"/><line x1="7.8" y1="7.8" x2="12" y2="12"/></svg></div>
      </div>
    </div>
  </section>

  <!-- Step 3 -->
  <section class="step-section" id="step-3">
    <div class="step-head">
      <div class="step-badge">3</div>
      <div class="step-title-wrap">
        <h2 class="step-title">Run this prompt in your Claude</h2>
      </div>
    </div>
    <p class="step-body">Open Claude &rarr; go to your work Project (or create one at claude.ai/projects) &rarr; start a new chat inside that project. If you have a Plaud .txt file, click + and attach it. Then copy the prompt below and paste it into the chat. This takes 3&ndash;5 minutes &mdash; Claude reads your data automatically, then asks you 5 questions one by one. Answer each one. After your last answer, Claude will generate your profile automatically.</p>
    <p class="code-hint">One prompt. Copy it all at once &mdash; it does everything.</p>
    <div class="code-wrap">
      <button class="copy-btn" id="copy-btn">Copy</button>
      <pre class="code-block" id="prompt-pre"></pre>
    </div>
  </section>

  <!-- Step 4 -->
  <section class="step-section" id="step-4">
    <div class="step-head">
      <div class="step-badge">4</div>
      <div class="step-title-wrap">
        <h2 class="step-title">Save your profile</h2>
      </div>
    </div>
    <p class="step-body">Claude will generate your profile as a downloadable file. Click Download to save <span class="inline-code">my-profile.md</span>. Then open your Claude Project &rarr; Project Files &rarr; upload <span class="inline-code">my-profile.md</span>. Done. Claude will know you from the first message of every session.</p>
  </section>

  <!-- Footer -->
  <footer class="guide-footer">
    <p>Your data never leaves your Claude. Nothing is shared with us.</p>
  </footer>

</main>

<!-- Lightbox -->
<div id="lb-overlay" style="display:none" role="dialog" aria-modal="true" aria-label="Image preview">
  <button id="lb-close" aria-label="Close">&times;</button>
  <div id="lb-content">
    <button class="lb-nav" id="lb-prev" aria-label="Previous image">&#8249;</button>
    <img id="lb-img" alt="">
    <button class="lb-nav" id="lb-next" aria-label="Next image">&#8250;</button>
  </div>
  <div id="lb-dots"></div>
</div>

<script>
var GROUPS = [
  [${JSON.stringify(IMG_CONNECTOR_MENU)},${JSON.stringify(IMG_CONNECTOR_DIRECTORY)}],
  [${JSON.stringify(IMG_PLAUD_FILES)},${JSON.stringify(IMG_PLAUD_SELECTED)},${JSON.stringify(IMG_PLAUD_MERGE_DIALOG)},${JSON.stringify(IMG_PLAUD_EXPORT)}]
];

var PROMPT_TEXT = ${PROMPT_JSON};

// Set thumbnail image sources and click handlers
document.querySelectorAll('.thumb-wrap').forEach(function(wrap) {
  var g = parseInt(wrap.dataset.group, 10);
  var i = parseInt(wrap.dataset.index, 10);
  wrap.querySelector('img').src = GROUPS[g][i];
  function open() { openLightbox(g, i); }
  wrap.addEventListener('click', open);
  wrap.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
});

// Set prompt text
document.getElementById('prompt-pre').textContent = PROMPT_TEXT;

// Copy button
document.getElementById('copy-btn').addEventListener('click', function() {
  var btn = this;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(PROMPT_TEXT).then(function() {
      btn.textContent = 'Copied \u2713';
      setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
    });
  } else {
    var ta = document.createElement('textarea');
    ta.value = PROMPT_TEXT;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Copied \u2713';
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
  }
});

// Lightbox
var lbOverlay = document.getElementById('lb-overlay');
var lbImg     = document.getElementById('lb-img');
var lbPrev    = document.getElementById('lb-prev');
var lbNext    = document.getElementById('lb-next');
var lbClose   = document.getElementById('lb-close');
var lbDots    = document.getElementById('lb-dots');
var lbGroup   = null;
var lbIndex   = 0;

function openLightbox(groupIdx, imgIdx) {
  lbGroup = GROUPS[groupIdx];
  lbIndex = imgIdx;
  lbImg.style.opacity = '1';
  renderLightbox();
  lbOverlay.style.display = 'flex';
  lbOverlay.style.animation = 'lb-in 0.15s ease both';
  lbClose.focus();
}

function closeLightbox() {
  lbOverlay.style.display = 'none';
}

function navLightbox(dir) {
  if (!lbGroup || lbGroup.length < 2) return;
  lbImg.style.opacity = '0';
  setTimeout(function() {
    lbIndex = (lbIndex + dir + lbGroup.length) % lbGroup.length;
    renderLightbox();
    lbImg.style.opacity = '1';
  }, 150);
}

function renderLightbox() {
  lbImg.src = lbGroup[lbIndex];
  var multi = lbGroup.length > 1;
  lbPrev.style.visibility = multi ? 'visible' : 'hidden';
  lbNext.style.visibility = multi ? 'visible' : 'hidden';
  lbDots.innerHTML = '';
  if (multi) {
    lbGroup.forEach(function(_, i) {
      var d = document.createElement('div');
      d.className = 'lb-dot' + (i === lbIndex ? ' active' : '');
      d.addEventListener('click', function(e) {
        e.stopPropagation();
        if (i === lbIndex) return;
        lbImg.style.opacity = '0';
        setTimeout(function() { lbIndex = i; renderLightbox(); lbImg.style.opacity = '1'; }, 150);
      });
      lbDots.appendChild(d);
    });
  }
}

lbClose.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', function(e) { e.stopPropagation(); navLightbox(-1); });
lbNext.addEventListener('click', function(e) { e.stopPropagation(); navLightbox(1); });
lbOverlay.addEventListener('click', function(e) { if (e.target === lbOverlay) closeLightbox(); });

document.addEventListener('keydown', function(e) {
  if (lbOverlay.style.display === 'none') return;
  if (e.key === 'Escape')    closeLightbox();
  if (e.key === 'ArrowLeft') navLightbox(-1);
  if (e.key === 'ArrowRight') navLightbox(1);
});

var lbTouchX = null;
lbOverlay.addEventListener('touchstart', function(e) { lbTouchX = e.touches[0].clientX; }, {passive:true});
lbOverlay.addEventListener('touchend', function(e) {
  if (lbTouchX === null) return;
  var dx = lbTouchX - e.changedTouches[0].clientX;
  if (Math.abs(dx) > 50) navLightbox(dx > 0 ? 1 : -1);
  lbTouchX = null;
});

// Step indicator (IntersectionObserver)
var pills    = document.querySelectorAll('.step-pill');
var sections = document.querySelectorAll('.step-section');

var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (!entry.isIntersecting) return;
    var num = entry.target.id.split('-')[1];
    pills.forEach(function(p) { p.classList.remove('active'); });
    var active = document.querySelector('.step-pill[data-step="' + num + '"]');
    if (active) active.classList.add('active');
  });
}, { rootMargin: '-10% 0px -60% 0px', threshold: 0 });

sections.forEach(function(s) { observer.observe(s); });

function scrollToStep(n) {
  var el = document.getElementById('step-' + n);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>
</body>
</html>`;

fs.writeFileSync('guide.html', html, 'utf8');
console.log('guide.html written — ' + Math.round(fs.statSync('guide.html').size / 1024) + ' KB');
