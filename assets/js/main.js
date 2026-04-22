(function () {

  // ── DOM ──────────────────────────────────────────────────────────────────
  const input  = document.getElementById('answer');
  const btn    = document.getElementById('answerBtn');
  if (!input || !btn) return;

  // ── State ─────────────────────────────────────────────────────────────────
  const DEFAULTS = { color: '#ffe066', bg: '#0d0d0d' };
  const PALETTES = {
    amber: { color: '#ffe066', bg: '#0d0d0d' },
    green: { color: '#aaffaa', bg: '#0a120a' },
    blue:  { color: '#80cbc4', bg: '#070d0d' },
    white: { color: '#d4d0c8', bg: '#111111' },
    purple: { color: '#d100f5', bg: '#130014' },
  };

  // Persist colors across pages
  let currentColor = localStorage.getItem('term-color') || DEFAULTS.color;
  let currentBg    = localStorage.getItem('term-bg')    || DEFAULTS.bg;
  applyColors(currentColor, currentBg);

  // Unlock sequence: ls → ls → help
  const SEQUENCE   = ['ls', 'ls', 'help'];
  let   seqPointer = 0;
  let   unlocked   = localStorage.getItem('term-unlocked') === '1';

  // Output element (created once, inserted after prompt row)
  const out = document.createElement('div');
  out.id = 'term-out';
  out.style.cssText = 'margin-top:6px; font-family:\'VT323\',monospace; font-size:18px; line-height:1.6;';
  input.closest('.prompt-row').insertAdjacentElement('afterend', out);

  // ── Color helpers ─────────────────────────────────────────────────────────
  function applyColors(color, bg) {
    document.body.style.background = bg;
    document.querySelectorAll(
      'input, button, .terminal, .dim, #term-out, .prompt-row, .page-link, pre, .ascii, a'
    ).forEach(el => el.style.color = color);
    document.querySelectorAll('input, button').forEach(el => {
      el.style.borderColor = color;
      el.style.color = color;
    });
    // caret + per-rule overrides for selectors hard-coded in the SCSS
    const style = document.getElementById('term-caret-style') || document.createElement('style');
    style.id = 'term-caret-style';
    style.textContent = `input { caret-color: ${color} !important; color: ${color} !important; }
      button { border-color: ${color} !important; color: ${color} !important; }
      .dim { color: ${color}66 !important; }
      pre, .ascii { color: ${color} !important; }
      a, a:visited { color: ${color} !important; border-bottom-color: ${color}66 !important; }
      a:hover { border-bottom-color: ${color} !important; }
      body { background: ${bg} !important; }`;
    document.head.appendChild(style);
  }

  function saveColors(color, bg) {
    localStorage.setItem('term-color', color);
    localStorage.setItem('term-bg', bg);
    currentColor = color;
    currentBg    = bg;
    applyColors(color, bg);
  }

  // ── Output helpers ────────────────────────────────────────────────────────
  function print(lines, color) {
    out.innerHTML = '';
    (Array.isArray(lines) ? lines : [lines]).forEach(line => {
      const div = document.createElement('div');
      div.textContent = line;
      if (color) div.style.color = color;
      out.appendChild(div);
    });
  }

  function printError(msg) { print('> ' + msg, '#ff6666'); }
  function printOk(msg)    { print(msg); }

  function appendLines(lines, color) {
    (Array.isArray(lines) ? lines : [lines]).forEach(line => {
      const div = document.createElement('div');
      div.textContent = line;
      if (color) div.style.color = color;
      out.appendChild(div);
    });
  }

  // ── Prompt mode ───────────────────────────────────────────────────────────
  // Lets page commands ask the user for a sequence of inputs, terminal-style.
  //   TERM.prompt([{ key, validate? }, ...], (answers, ctx) => { ... })
  // Typing "cancel" at any step aborts the flow.
  const promptLabel   = document.querySelector('.prompt-row > span');
  const DEFAULT_LABEL = promptLabel ? promptLabel.textContent : '(base) >';
  let   promptState   = null;

  function promptUser(fields, onDone) {
    promptState = { fields, idx: 0, answers: {}, onDone, log: [] };
    askField();
  }

  function askField() {
    promptLabel.textContent = promptState.fields[promptState.idx].key + ' >';
    renderPromptLog();
  }

  function renderPromptLog() {
    out.innerHTML = '';
    appendLines(promptState.log);
  }

  function exitPromptMode() {
    promptLabel.textContent = DEFAULT_LABEL;
    promptState = null;
  }

  function handlePromptInput(raw) {
    const value = raw.trim();
    const f     = promptState.fields[promptState.idx];
    const label = f.key + ' > ';

    if (value.toLowerCase() === 'cancel') {
      promptState.log.push(label + 'cancel', '> cancelled.');
      renderPromptLog();
      exitPromptMode();
      return;
    }

    if (f.validate && !f.validate(value)) {
      promptState.log.push(label + value, '> invalid, try again.');
      renderPromptLog();
      return;
    }

    promptState.log.push(label + value);
    promptState.answers[f.key] = value;
    promptState.idx++;

    if (promptState.idx >= promptState.fields.length) {
      const { answers, onDone } = promptState;
      renderPromptLog();
      exitPromptMode();
      // Appending ctx so the callback's output joins the Q&A log rather than
      // wiping it — the full session stays visible until the next command.
      onDone(answers, {
        print:      appendLines,
        printError: msg => appendLines('> ' + msg, '#ff6666'),
        printOk:    appendLines,
      });
    } else {
      askField();
    }
  }

  window.TERM = { prompt: promptUser };

  // ── Sequence tracker ──────────────────────────────────────────────────────
  function trackSequence(cmd) {
    if (unlocked) return;
    if (cmd === SEQUENCE[seqPointer]) {
      seqPointer++;
      if (seqPointer === SEQUENCE.length) {
        unlocked = true;
        localStorage.setItem('term-unlocked', '1');
      }
    } else {
      seqPointer = cmd === SEQUENCE[0] ? 1 : 0;
    }
  }

  // ── Commands ──────────────────────────────────────────────────────────────
  function cmdLs() {
    const pages = window.PAGE_LS;
    if (!pages || pages.length === 0) {
      print('> ls: nothing to list here.');
    } else {
      print(['> ls:', ...pages.map(p => '  ' + p)]);
    }
  }

  function cmdHelp() {
    const visible = [
      'ls                      list pages in current directory',
      'cd <path>               navigate to path',
      'color <arg>             change color settings (try: color help)',
      'help                    show this message',
      'read <filename>         display a .txt file in current directory',
    ];
    const pageCmds = window.PAGE_COMMANDS || {};
    const pageLines = Object.values(pageCmds)
      .map(fn => fn && fn.help)
      .filter(Boolean);
    const hint = unlocked
      ? ['', '(unlocked) try: konami, ghost, void']
      : ['', '  some commands are not listed here.'];
    print(['> help:', ...visible, ...pageLines, ...hint]);
  }

function linkify(text) {
  const parts = text.split(/(\[[^\]]+\]\([^\)]+\)|https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const md = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
      if (md) return '<a href="' + md[2] + '">' + md[1] + '</a>';
      return '<a href="' + part + '">' + part + '</a>';
    }
    return part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }).join('');
}

async function cmdRead(args) {
  const name = args[0];
  if (!name || name === 'help') {
    return print([
      '> read:',
      '  read <filename>         display a .txt file',
      '  read help               show this message',
    ]);
  }

  const base     = (window.PAGE_URL || '/').replace(/\/?$/, '/');
  const filename = name.endsWith('.txt') ? name : name + '.txt';
  const url      = base + filename;

  let text;
  try {
    const res = await fetch(url);
    if (!res.ok) { printError('read: cannot find "' + name + '"'); return; }
    text = await res.text();
  } catch (e) {
    printError('read: network error');
    return;
  }

  // find or create a <pre> to display the content
  let pre = document.getElementById('term-read-out');
  if (!pre) {
    pre = document.createElement('pre');
    pre.id = 'term-read-out';
    pre.style.cssText = 'line-height:1.4; background:transparent; border:none; margin:0.5rem 0; white-space:pre-wrap;';
    out.insertAdjacentElement('afterend', pre);
  }
  pre.innerHTML = linkify(text);
  pre.style.display = 'block';
}


  function cmdColor(args) {
    const [sub, value] = args;
    if (!sub) return cmdColorHelp();

    if (sub === 'help') {
      if (value) return printError('color help: takes no args');
      return cmdColorHelp();
    }

    if (sub === 'front') {
      if (!value) return printError('usage: color front <hex>');
      saveColors(value, currentBg);
      return printOk('> color set to ' + value);
    }

    if (sub === 'bg') {
      if (!value) return printError('usage: color bg <hex>');
      saveColors(currentColor, value);
      return printOk('> background set to ' + value);
    }

    if (sub === 'reset') {
      if (value) return printError('color reset: takes no args');
      saveColors(DEFAULTS.color, DEFAULTS.bg);
      return printOk('> colors reset.');
    }

    if (PALETTES[sub]) {
      const p = PALETTES[sub];
      saveColors(p.color, p.bg);
      return printOk('> palette: ' + sub);
    }

    return printError('unknown: color ' + sub);
  }

  function cmdColorHelp() {
    print([
      '> color:',
      '  color front <hex>    change text color',
      '  color bg <hex>       change background color',
      '  color <palette>      apply preset (' + Object.keys(PALETTES).join('|') + ')',
      '  color reset          restore default colors',
      '  color help           show this message',
    ]);
  }

  // ── Unlocked mystery commands ─────────────────────────────────────────────
  function cmdKonami() {
    const names = Object.keys(PALETTES);
    const pick  = names[Math.floor(Math.random() * names.length)];
    const p     = PALETTES[pick];
    saveColors(p.color, p.bg);
    printOk('> さすがコナミです');
  }

  function cmdGhost() {
    const style = document.createElement('style');
    style.textContent = '* { opacity: 0.08 !important; }';
    document.head.appendChild(style);
    setTimeout(() => style.remove(), 5000);
  }

  function cmdVoid() {
    out.innerHTML = '';
    input.placeholder = '';
  }

  // ── Router ────────────────────────────────────────────────────────────────
  function handle(raw) {
    if (window.ON_COMMAND) window.ON_COMMAND();
    const pre = document.getElementById('term-read-out');
    if (pre) pre.style.display = 'none';
    const trimmed        = raw.trim();
    if (!trimmed) return;
    const [cmd, ...args] = trimmed.toLowerCase().split(/\s+/);

    trackSequence(cmd);

    if (window.PAGE_COMMANDS && window.PAGE_COMMANDS[cmd]) {
      return window.PAGE_COMMANDS[cmd](args, { print, printError, printOk });
    }

    switch (cmd) {
      case 'ls':                  return cmdLs();
      case 'cd':                  return navigate(args[0]);
      case 'help':                return cmdHelp();
      case 'color':               return cmdColor(args);
      case 'read':                return cmdRead(args);

      // mystery — only work if unlocked
      case 'konami': return unlocked ? cmdKonami() : navigate(trimmed);
      case 'ghost':  return unlocked ? cmdGhost()  : navigate(trimmed);
      case 'void':   return unlocked ? cmdVoid()   : navigate(trimmed);

      default:                    return navigate(trimmed);
    }
  }

  function navigate(path) {
    if (!path) return;
    window.location.href = '/' + path.replace(/^\//, '');
  }

  // ── Command history ───────────────────────────────────────────────────────
  // Persisted: navigation reloads the page, so in-memory history would be lost.
  const HISTORY_MAX = 5;
  const history     = JSON.parse(localStorage.getItem('term-history') || '[]');
  let historyIdx    = history.length;
  let draft         = '';

  function pushHistory(cmd) {
    if (!cmd || history[history.length - 1] === cmd) return;
    history.push(cmd);
    while (history.length > HISTORY_MAX) history.shift();
    localStorage.setItem('term-history', JSON.stringify(history));
  }

  function recallHistory(direction) {
    if (historyIdx === history.length) draft = input.value;
    historyIdx = Math.max(0, Math.min(history.length, historyIdx + direction));
    input.value = historyIdx === history.length ? draft : history[historyIdx];
  }

  // ── Listeners ─────────────────────────────────────────────────────────────
  function submit() {
    const raw = input.value;
    input.value = '';
    historyIdx  = history.length;
    draft       = '';

    if (promptState) {
      handlePromptInput(raw);
      return;
    }

    pushHistory(raw.trim());
    handle(raw);
  }

  btn.addEventListener('click', submit);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')          submit();
    else if (e.key === 'ArrowUp')   { e.preventDefault(); recallHistory(-1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); recallHistory(1);  }
  });

  input.focus();
})();

