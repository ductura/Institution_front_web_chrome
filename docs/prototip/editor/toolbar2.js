/* Ductura Editor, prototip: alatna traka, drugi krug (v0.17).
 * 1 sklapanje po širini u Više · 2 četiri izbornika po namjeni · 3 riječi i prečaci (Ctrl+/) · 4 jedan balončić uz označeni tekst
 * 5 naredbena paleta (Ctrl+K) · 6 gumb prema mjestu kursora · 7 mobilna traka iznad tipkovnice · 8 posebni znakovi
 * 9 prilagodba trake · 10 nastavnikova traka · 11 čitanje po promjenama
 * Osnova je odobrena traka iz repoa: riječi umjesto simbola i sklapanje u Više kad ne stane.
 */
(function () {
  'use strict';
  const X = window.DU, { S, U, ACT, esc, $, persist, toast } = X, ed = () => X.editor, D = () => X.D, AX = X.ai, mi = X.fx.mi;
  const T = () => S.mode === 'teacher', mode = () => (S.submitted ? 'l' : T() ? 't' : 'w');
  const cfg = () => { const c = S.tb || (S.tb = {}); c.off = c.off || []; c.order = c.order || {}; return c; };
  X.hooks.defaults.push(s => { if (!s.tb) s.tb = { off: [], order: {} }; if (!s.chRecent) s.chRecent = []; });
  const curRect = () => { const c = ed().view.coordsAtPos(ed().state.selection.from); return { left: c.left, right: c.right, top: c.top, bottom: c.bottom }; };
  const pop = (el, html) => X.openPop(html, el && el.getBoundingClientRect && el.isConnected !== false && el.offsetParent !== null ? el.getBoundingClientRect() : curRect(), 'menu');
  const fake = ds => ({ dataset: ds || {}, getBoundingClientRect: curRect });

  /* ---------- popis alata: [naziv, prečac, opis, prednost pri sklapanju, grupa] ---------- */
  const TL = {
    undo: ['Poništi', 'Ctrl+Z', 'Poništava zadnju izmjenu', 60, 1], redo: ['Ponovi', 'Ctrl+Y', 'Vraća poništenu izmjenu', 20, 1],
    style: ['Stil odlomka', '', 'Odlomak, naslov rada, poglavlje ili potpoglavlje', 100, 2],
    bold: ['Podebljano', 'Ctrl+B', 'Podebljava označeni tekst', 45, 2], italic: ['Kurziv', 'Ctrl+I', 'Kurziv za označeni tekst', 44, 2],
    list: ['Popis', '', 'Popis s natuknicama', 25, 2], quote: ['Blok-citat', '', 'Navod duži od tri retka', 24, 2],
    cite: ['Navod', '@', 'Umeće navod iz Vaših izvora', 90, 3], comment: ['Komentar', 'Ctrl+Alt+M', 'Komentar ili pitanje uz označeni tekst', 85, 3],
    hole: ['Za provjeru', '', 'Ostavite oznaku [?] na mjestu kojem ćete se vratiti i nastavite pisati', 50, 3],
    'menu-ins': ['Umetni ▾', '', 'Navod, izvor, tablica, slika, fusnota, referenca, fraza, znak', 70, 4], 'menu-edit': ['Uredi ▾', '', 'Traženje, odlaganje, premještanje i pretvaranje teksta', 65, 4],
    c2GenNew: ['Opći komentar', '', 'Komentar uz poglavlje ili cijeli rad', 80, 1], c2Priv: ['Privatna bilješka', '', 'Bilješka koju vidite samo Vi', 50, 1],
    tReq: ['Zatraži potvrdu', '', 'Traži od studenta potvrdu iz izvora uz navod', 55, 1],
    cmPrev: ['Prethodni komentar', '', 'Skok na prethodni otvoreni komentar', 30, 2], cmNext: ['Sljedeći komentar', '', 'Skok na sljedeći otvoreni komentar', 62, 2],
    chNext: ['Sljedeća promjena', '', 'Skok na sljedeći izmijenjeni odlomak', 70, 2], m2Back: ['Vrati na doradu', '', 'Vraća rad studentu sa sažetkom primjedbi', 75, 3],
    findOpen: ['Traži', 'Ctrl+F', 'Traži i zamijeni', 55, 9], 'menu-view': ['Prikaz ▾', '', 'Izgled lista i aplikacije, pomoć u tekstu, traka', 30, 9],
    'menu-export': ['Izvezi ▾', '', 'Word, pregled ispisa, kopija teksta', 28, 9], focus: ['Fokus', 'Ctrl+.', 'Način fokusa: samo list', 15, 9], tbCmd: ['Naredbe', 'Ctrl+K', 'Upišite što želite: naredbu, poglavlje ili izvor', 40, 9],
  };
  const LEFT = { w: ['undo', 'redo', 'style', 'bold', 'italic', 'list', 'quote', 'cite', 'comment', 'hole', 'menu-ins', 'menu-edit'], t: ['comment', 'c2GenNew', 'c2Priv', 'tReq', 'cmPrev', 'cmNext', 'chNext', 'm2Back'], l: [] };
  const RIGHT = { w: ['findOpen', 'menu-view', 'menu-export', 'focus', 'tbCmd'], t: ['findOpen', 'menu-view', 'menu-export', 'tbCmd'], l: ['findOpen', 'menu-view', 'menu-export', 'tbCmd'] };
  const lay = () => { const m = mode(), L = LEFT[m], o = cfg().order[m]; return { m, left: o ? o.filter(i => L.includes(i)).concat(L.filter(i => !o.includes(i))) : L.slice(), right: RIGHT[m] }; };
  const sv = d => `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const BUB = '<path d="M3 4h12v8.5H8.5L5.5 15v-2.5H3z"/>';
  const IC = {
    undo: '<path d="M6.5 4 3 7.5 6.5 11"/><path d="M3 7.5h7.5a3.75 3.75 0 0 1 0 7.5H8"/>', redo: '<path d="M11.5 4 15 7.5 11.5 11"/><path d="M15 7.5H7.5a3.75 3.75 0 0 0 0 7.5H10"/>',
    bold: '<text x="9" y="14" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor" stroke="none" font-family="Georgia, serif">B</text>', italic: '<text x="9" y="14" text-anchor="middle" font-size="14" font-style="italic" fill="currentColor" stroke="none" font-family="Georgia, serif">I</text>',
    list: '<circle cx="3.5" cy="5" r=".9" fill="currentColor"/><circle cx="3.5" cy="9" r=".9" fill="currentColor"/><circle cx="3.5" cy="13" r=".9" fill="currentColor"/><path d="M7 5h8M7 9h8M7 13h8"/>',
    quote: '<path d="M4 6.5c0-1.5 1-2.5 2.5-2.5M4 6.5V9h2.5V6.5zM10 6.5C10 5 11 4 12.5 4M10 6.5V9h2.5V6.5zM4 12.5h10M4 15h6"/>',
    cite: '<path d="M6 3C3.8 5.5 3.8 12.5 6 15M12 3c2.2 2.5 2.2 9.5 0 12M7.5 11.5h3M7.5 8h3"/>', comment: BUB,
    hole: '<rect x="3" y="3" width="12" height="12" rx="2" stroke-dasharray="2 2.2"/><text x="9" y="12.8" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" stroke="none">?</text>',
    'menu-ins': '<path d="M9 4v10M4 9h10"/>', 'menu-edit': '<path d="M11.5 3.5l3 3-8 8h-3v-3z"/><path d="M10 5l3 3"/>',
    c2GenNew: BUB + '<path d="M6 7h6M6 9.5h4"/>', c2Priv: '<rect x="4" y="8" width="10" height="7" rx="1.5"/><path d="M6.5 8V6a2.5 2.5 0 0 1 5 0v2"/>',
    tReq: '<rect x="2.5" y="5.5" width="13" height="9" rx="1.5"/><circle cx="9" cy="10" r="2.5"/><path d="M6.5 5.5l1-2h3l1 2"/>',
    cmPrev: BUB + '<path d="M10 6 7.5 8.25 10 10.5"/>', cmNext: BUB + '<path d="M8 6l2.5 2.25L8 10.5"/>',
    chNext: '<path d="M3.5 5.5h5M6 3v5M3.5 12.5h5M11.5 6.5l3 2.5-3 2.5"/>', m2Back: '<path d="M15 9H6M9 5.5 5.5 9 9 12.5M3 4v10"/>',
    findOpen: '<circle cx="8" cy="8" r="4.5"/><path d="M11.5 11.5 15 15"/>', 'menu-view': '<path d="M2 9c2-3.5 4.5-5 7-5s5 1.5 7 5c-2 3.5-4.5 5-7 5s-5-1.5-7-5z"/><circle cx="9" cy="9" r="2"/>',
    'menu-export': '<path d="M9 3v8M5.5 8 9 11.5 12.5 8M3.5 14.5h11"/>', focus: '<path d="M3 6.5V3h3.5M11.5 3H15v3.5M15 11.5V15h-3.5M6.5 15H3v-3.5"/>',
    tbCmd: '<path d="M4 5.5 7.5 9 4 12.5M9.5 13H14"/>', more: '<circle cx="4" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="14" cy="9" r="1.1" fill="currentColor"/>',
  };
  const look = () => cfg().look || 'i';
  const tip = id => { const t = TL[id]; return t[2] + (t[1] ? ' (' + t[1] + ')' : ''); };
  const btn = id => { const lk = look(), mn = /^menu-/.test(id), name = TL[id][0].replace(' ▾', ''); return `<button class="tb ${lk === 'w' ? 'txt' : lk === 'b' ? 'txt ic' : 'ic'}" data-act="${id}" data-tid="${id}" data-t data-l aria-label="${esc(name)}"${mn ? ' aria-haspopup="true"' : ''}>${lk === 'w' ? '' : sv(IC[id])}${lk === 'i' ? '' : `<span>${name}</span>`}${QN[id] ? `<em class="tbq" data-q="${id}"></em>` : ''}${mn ? '<i class="tbc" aria-hidden="true">▾</i>' : ''}</button>`; };

  /* ---------- 6. mjesto kursora ---------- */
  function ctx() {
    const e = ed(); if (!e || !e.isEditable) return null; const s = e.state.selection, $f = s.$from;
    if (s.node && s.node.type.name === 'citation') return { k: 'cite', l: 'Navod ▾', pos: s.from };
    if (s.empty && $f.nodeBefore && $f.nodeBefore.type.name === 'citation') return { k: 'cite', l: 'Navod ▾', pos: s.from - 1 };
    if (s.node && s.node.type.name === 'prikaz') return { k: 'prikaz', l: s.node.attrs.kind === 'tablica' ? 'Tablica ▾' : 'Slika ▾', pos: s.from };
    if ($f.depth < 1) return null; const top = $f.node(1), n = top.type.name;
    if (n === 'heading' && top.attrs.level > 1) return { k: 'head', l: 'Naslov ▾', pos: $f.before(1), level: top.attrs.level };
    if (n === 'blockquote') return { k: 'quote', l: 'Blok-citat ▾' };
    if (n === 'bulletList') return { k: 'list', l: 'Popis ▾' };
    if (top.attrs && top.attrs.vg) return { k: 'var', l: 'Inačica ▾' };
    return null;
  }

  /* ---------- 1. iscrtavanje i sklapanje ---------- */
  let key = '', ctxKey = '';
  function build() {
    const tb = $('#tools'), sel = $('#blockStyle'), { left, right } = lay(), off = cfg().off; let h = '', g = null;
    left.forEach(id => { if (off.includes(id)) return; const t = TL[id]; if (g !== null && t[4] !== g) h += '<span class="sep"></span>'; g = t[4]; h += id === 'style' ? '<span id="tbSel"></span>' : btn(id); });
    h += '<button class="tb txt" data-act="menu-ctx" data-t data-l id="tbCtx" aria-haspopup="true" hidden></button><span class="grow"></span>';
    right.forEach(id => { if (!off.includes(id)) h += btn(id); });
    h += '<button class="tb txt" data-act="menu-more" data-t data-l id="tbMore" aria-haspopup="true" aria-label="Više">' + (look() === 'w' ? 'Više' : sv(IC.more)) + '<i class="tbc" aria-hidden="true">▾</i></button>';
    sel.remove(); tb.innerHTML = h; const slot = $('#tbSel'); if (slot) { slot.replaceWith(sel); sel.hidden = false; } else { sel.hidden = true; tb.appendChild(sel); }
    sel.removeAttribute('title');
  }
  function fit() {
    const tb = $('#tools'); if (!tb || !tb.clientWidth || !$('#tbMore')) return; const items = [...tb.querySelectorAll('.tb[data-tid]')], more = $('#tbMore'), { m, left, right } = lay();
    items.forEach(b => { b.hidden = false; }); tb.querySelectorAll('.sep').forEach(s => { s.hidden = false; });
    const offNow = cfg().off.filter(i => left.includes(i) || right.includes(i)); U.tbColl = []; more.hidden = !offNow.length;
    const over = () => tb.scrollWidth > tb.clientWidth + 1;
    if (over()) { more.hidden = false; const by = items.slice().sort((a, b) => TL[a.dataset.tid][3] - TL[b.dataset.tid][3]); for (const b of by) { if (!over()) break; b.hidden = true; U.tbColl.push(b.dataset.tid); } }
    let seen = false, lastSep = null; [...tb.children].forEach(c => { if (c.classList.contains('sep')) { if (!seen) c.hidden = true; else lastSep = c; seen = false; } else if (c.classList.contains('grow')) { if (!seen && lastSep) lastSep.hidden = true; seen = false; lastSep = null; } else if (!c.hidden && c.id !== 'tbMore' && getComputedStyle(c).display !== 'none') seen = true; });
    U.tbMode = m; let first = true; tb.querySelectorAll('.tb').forEach(b => { const v = !b.hidden && b.offsetParent; b.tabIndex = v && first ? 0 : -1; if (v) first = false; });
  }
  function paint() {
    if (!ed()) return; const k = mode() + '|' + look() + '|' + cfg().off.join(',') + '|' + JSON.stringify(cfg().order); let re = false;
    if (k !== key || !$('#tbMore')) { key = k; ctxKey = ''; build(); re = true; ['bold', 'italic', 'list', 'quote'].forEach(a => { const b = $(`.tb[data-act="${a}"]`); if (b) b.classList.toggle('on', ed().isActive(a === 'list' ? 'bulletList' : a === 'quote' ? 'blockquote' : a)); }); }
    const c = ctx(), ck = c ? c.l : '', cb = $('#tbCtx'); if (ck !== ctxKey) { ctxKey = ck; cb.hidden = !c; cb.textContent = ck; re = true; }
    if (extra()) re = true;
    if (re) fit(); mbar();
  }
  X.hooks.paint.push(paint);
  addEventListener('resize', () => { fit(); mbar(); }); if (window.ResizeObserver) new ResizeObserver(() => fit()).observe($('#tools')); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* ---------- opis alata uz pokazivač ---------- */
  const tt = document.createElement('div'); tt.id = 'tbTip'; tt.hidden = true; tt.setAttribute('role', 'tooltip'); document.body.appendChild(tt); let ttT = null, ttHold = false;
  const CTXD = { 'Naslov ▾': 'Razina naslova i premještanje poglavlja', 'Navod ▾': 'Stranica, potvrda iz izvora, uklanjanje navoda', 'Tablica ▾': 'Uređivanje ili uklanjanje tablice', 'Slika ▾': 'Uređivanje ili uklanjanje slike', 'Blok-citat ▾': 'Povratak u običan odlomak, navod uz citat', 'Popis ▾': 'Izlaz iz popisa', 'Inačica ▾': 'Zadržite jednu inačicu ili pitajte mentora' };
  const tipOf = b => b.dataset.tid ? [TL[b.dataset.tid][0].replace(' ▾', ''), TL[b.dataset.tid][2], TL[b.dataset.tid][1]] : b.id === 'tbMore' ? ['Više', 'Alati koji nisu na traci i prilagodba trake', ''] : b.id === 'tbCtx' ? [b.textContent.replace(' ▾', ''), CTXD[b.textContent] || 'Alati za mjesto na kojem je kursor', ''] : b.id === 'blockStyle' ? ['Stil odlomka', 'Odlomak, naslov rada, poglavlje ili potpoglavlje', ''] : null;
  const tipHide = () => { clearTimeout(ttT); tt.hidden = true; };
  const tipShow = b => { const t = tipOf(b); if (!t || !b.isConnected || !$('#pop').hidden) return; tt.innerHTML = `<b>${esc(t[0])}</b>${t[2] ? `<span class="kbd">${esc(t[2])}</span>` : ''}<p>${esc(t[1])}</p>`; tt.hidden = false; const r = b.getBoundingClientRect(), w = tt.offsetWidth; tt.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'; tt.style.top = (r.bottom + 8) + 'px'; };
  const tipEl = e => e.target.closest && e.target.closest('#tools .tb, #blockStyle');
  document.addEventListener('mouseover', e => { const b = tipEl(e); if (!b) return; if (e.relatedTarget && b.contains(e.relatedTarget)) return; clearTimeout(ttT); ttT = setTimeout(() => tipShow(b), tt.hidden ? 380 : 60); });
  document.addEventListener('mouseout', e => { const b = tipEl(e); if (b && !(e.relatedTarget && b.contains(e.relatedTarget))) { clearTimeout(ttT); ttT = setTimeout(tipHide, 80); } });
  document.addEventListener('focusin', e => { const b = tipEl(e); if (b && b.matches(':focus-visible')) tipShow(b); }); document.addEventListener('focusout', e => { if (tipEl(e)) tipHide(); });
  document.addEventListener('mousedown', tipHide, true); document.addEventListener('keydown', e => { if (e.key === 'Escape') tipHide(); }, true); document.addEventListener('scroll', tipHide, true);
  document.addEventListener('touchstart', e => { const b = tipEl(e); tipHide(); ttHold = false; if (b && b.id !== 'blockStyle') ttT = setTimeout(() => { ttHold = true; tipShow(b); }, 450); }, { passive: true });
  document.addEventListener('touchend', () => { clearTimeout(ttT); if (ttHold) setTimeout(tipHide, 1800); }, { passive: true }); document.addEventListener('touchmove', () => { if (!ttHold) clearTimeout(ttT); }, { passive: true });
  document.addEventListener('click', e => { if (ttHold && tipEl(e)) { e.preventDefault(); e.stopPropagation(); ttHold = false; } }, true);
  document.addEventListener('contextmenu', e => { if (ttHold && tipEl(e)) e.preventDefault(); });

  /* ---------- 2. izbornici ---------- */
  const CH = [['„', 'navodnik, otvara'], ['”', 'navodnik, zatvara'], ['‚', 'polunavodnik, otvara'], ['’', 'polunavodnik, zatvara'], ['»', 'navodnik'], ['«', 'navodnik'], ['–', 'crtica za raspon, npr. 1990–1995'], ['…', 'tri točke'], ['°', 'stupanj'], ['×', 'puta'], ['±', 'plus minus'], ['≤', 'manje ili jednako'], ['≥', 'veće ili jednako'], ['≠', 'različito'], ['≈', 'približno'], ['§', 'paragraf'], ['€', 'euro'], ['‰', 'promil'], ['†', 'preminuo'], ['µ', 'mikro'], ['α', 'alfa'], ['β', 'beta'], ['χ', 'hi'], ['²', 'na kvadrat'], ['³', 'na treću'], ['½', 'polovina'], ['→', 'strelica'], [' ', 'razmak koji se ne lomi']];
  const curVar = () => { const $f = ed().state.selection.$from; return $f.depth >= 1 && $f.node(1).attrs && $f.node(1).attrs.vg; };
  Object.assign(ACT, {
    'menu-ins': el => pop(el, `<div class="mh">Umetni</div>${mi('cite', 'Navod', '@')}${mi('quick', 'Novi izvor', 'dodaj i odmah citiraj')}${mi('insPrikaz', 'Tablica', 's brojem i izvorom', ' data-kind="tablica"')}${mi('insPrikaz', 'Slika', 's brojem, naslovom i izvorom', ' data-kind="slika"')}${mi('insFn', 'Fusnota', 'objašnjenje na dnu')}${mi('insXref', 'Unakrsna referenca', 'poglavlje, tablica, slika')}${mi('tbHole', 'Za provjeru', 'oznaka [?], vratite se poslije')}${mi('phrases', 'Fraza', '/fraza')}${mi('insVar', 'Inačica odlomka', 'dodaj još jednu')}${mi('menu-chars', 'Posebni znak', '„ ” … ° ×')}${X.rich ? X.rich.insItems() : ''}`),
    'menu-edit': el => pop(el, `<div class="mh">Uredi</div>${mi('findOpen', 'Traži i zamijeni', 'Ctrl+F')}${mi('stash', 'Odloži', 'označeni tekst')}${mi('sentUp', 'Rečenica gore', 'Alt+↑')}${mi('sentDown', 'Rečenica dolje', 'Alt+↓')}<div class="mh">Pretvori</div>${mi('toQuote', 'Označeno u blok-citat', 'uvučeno, bez navodnika')}${mi('fromQuote', 'Blok-citat u odlomak', 'vraća navodnike')}${mi('toFn', 'Označeno u fusnotu', '')}${curVar() ? mi('varKeep', 'Zadrži samo ovu inačicu', 'ostale se brišu') + mi('varAsk', 'Pitaj mentora koja je bolja', '') : ''}<div class="mh">Uz pisanje</div>${mi('bars', 'Oblik rečenica', 'duljine u odlomku')}${X.caps && X.caps.tts ? mi('readAloud', U.reading ? 'Zaustavi čitanje' : 'Čitaj naglas', 'odlomak s kursorom') : ''}${X.caps && X.caps.dictation ? mi('dictate', U.dict ? 'Zaustavi diktiranje' : 'Diktiraj', 'pišite govorom') : ''}${mi('noteSelf', 'Poruka sebi', 'za sljedeći put')}${mi('tbChNext', 'Sljedeća promjena', 'od zadnjeg slanja')}${ACT.history ? mi('history', 'Povijest rada', '') : ''}`),
    'menu-view': el => { const o = (g, v, l) => mi('setView', l, S[g] === v ? '✓' : '', ` data-g="${g}" data-v="${v}"`); pop(el, `${T() ? '' : mi('help', 'Pomoć u tekstu', 'koliko upozorenja želite')}<div class="mh">List</div>${o('sheet', 'light', 'Bijeli')}${o('sheet', 'dark', 'Tamni')}<div class="mh">Aplikacija</div>${o('theme', 'dark', 'Tamna')}${o('theme', 'light', 'Svijetla')}<div class="mh">Veličina teksta na zaslonu</div>${mi('menu-zoom', 'Manji tekst', '', ' data-d="-1"')}${mi('menu-zoom', 'Veći tekst', Math.round((S.tz || 1) * 100) + ' %', ' data-d="1"')}<div class="mh">Na zaslonu</div>${mi('tocToggle', 'Sadržaj na listu', S.toc ? '✓' : '')}${mi('railToggle', 'Struktura rada', 'Ctrl+\\')}${mi('tbFocus', 'Način fokusa', 'Ctrl+.')}${T() || !ACT.t2Clean ? '' : mi('t2Clean', U.t2Clean ? 'Prikaži savjete' : 'Čisti tekst', 'Ctrl+Alt+H')}${ACT.t2Legend ? mi('t2Legend', 'Što znače oznake', '') : ''}${ACT.t2Gut && innerWidth > 1050 ? mi('t2Gut', 'Rub lista s oznakama', S.t2gut === false ? '' : '✓') + mi('t2Pg', 'Procjena stranica u rubu', S.t2pg ? '✓' : '') : ''}${X.rich ? X.rich.viewItems() : ''}<div class="mh">Traka</div>${mi('tbCfg', 'Prilagodi alatnu traku', '')}${mi('tbKeys', 'Prečaci', 'Ctrl+/')}${T() ? '' : mi('tbOnb', 'Prvi koraci', 'kratak uvod')}`); },
    'menu-more': el => { const { left, right } = lay(), ids = left.concat(right).filter(i => i !== 'style' && (cfg().off.includes(i) || (U.tbColl || []).includes(i))); pop(el, `<div class="mh">Više</div>${ids.map(i => mi(i, TL[i][0].replace(' ▾', ''), TL[i][1] || (/^menu-/.test(i) ? '›' : ''))).join('')}${mi('tbCfg', 'Prilagodi alatnu traku', '')}`); },
    'menu-chars': el => { const rec = (S.chRecent || []).filter(c => CH.some(x => x[0] === c)), b = c => { const d = CH.find(x => x[0] === c); return `<button data-act="tbCh" data-c="${esc(c)}" title="${esc(d[1])}" aria-label="${esc(d[1])}">${c === ' ' ? '⎵' : esc(c)}</button>`; }; pop(el, `<div class="mh">Posebni znak</div>${rec.length ? `<div class="chg">${rec.map(b).join('')}</div><div class="mh">Svi</div>` : ''}<div class="chg">${CH.map(x => b(x[0])).join('')}</div><div class="pad muted">Pokažite na znak da vidite čemu služi.</div>`); },
    'menu-ctx': el => { const c = ctx(); if (!c) return; const h = c.k === 'cite' ? mi('tbCiteOpen', 'Stranica i potvrda', 'otvara navod') + mi('tbLeafDel', 'Ukloni navod', '')
      : c.k === 'prikaz' ? mi('tbCiteOpen', 'Uredi', 'naslov, izvor, sadržaj') + mi('tbLeafDel', 'Ukloni', '')
      : c.k === 'head' ? mi('tbLevel', 'Poglavlje', c.level === 2 ? '✓' : '', ' data-v="2"') + mi('tbLevel', 'Potpoglavlje', c.level === 3 ? '✓' : '', ' data-v="3"') + mi('tbMove', 'Premjesti gore', 'Alt+Shift+↑', ' data-dir="-1"') + mi('tbMove', 'Premjesti dolje', 'Alt+Shift+↓', ' data-dir="1"') + mi('tbXrefHere', 'Uputi na ovaj naslov', 'unakrsna referenca')
      : c.k === 'quote' ? mi('fromQuote', 'Vrati u odlomak', 'vraća navodnike') + mi('cite', 'Dodaj navod', '@')
      : c.k === 'list' ? mi('list', 'Izađi iz popisa', '') : mi('varKeep', 'Zadrži samo ovu inačicu', 'ostale se brišu') + mi('varAsk', 'Pitaj mentora koja je bolja', '');
      pop(el, `<div class="mh">${c.l.replace(' ▾', '')}</div>${h}`); },
    'menu-ai': el => { const s = AX.selText(), one = s && !/\s\S+\s\S+\s/.test(s.text.trim()), ks = (one ? ['pojam', 'prij'] : ['lekt', 'prij', 'pojam']).filter(k => AX.allowed(k)); hideBub(); pop(el, `<div class="mh">Pomoćnik</div>${ks.map(k => mi('aiFrom', k === 'lekt' ? 'Lektura' : k === 'prij' ? 'Prijevod' : 'Objasni pojam', '', ` data-v="${k}"`)).join('')}`); },
    'menu-mb': el => pop(el, `${mi('menu-ins', 'Umetni', '›')}${mi('menu-edit', 'Uredi', '›')}${mi('menu-chars', 'Posebni znak', '›')}${mi('redo', 'Ponovi', '')}${mi('bold', 'Podebljano', '')}${mi('italic', 'Kurziv', '')}${mi('tbCmd', 'Naredbe', 'sve na jednom mjestu')}`),
    tbHole: () => { X.closePop(); ACT.hole(); }, tbOnb: () => X.openDlg({ type: 'onb', i: 0 }), tbFocus: () => { X.closePop(); ACT.focus(); },
    tbCh: el => { const c = el.dataset.c; X.closePop(); if (!ed().isEditable) return; ed().chain().focus().insertContent(c).run(); S.chRecent = [c].concat((S.chRecent || []).filter(x => x !== c)).slice(0, 7); persist(); },
    tbCiteOpen: () => { const c = ctx(); X.closePop(); if (!c) return; let d = ed().view.nodeDOM(c.pos); if (d && d.nodeType === 3) d = d.parentElement; const t = d && (d.matches('.cite,.prikaz') ? d : d.querySelector('.cite,.prikaz')) || d; if (t) setTimeout(() => t.click(), 0); },
    tbLeafDel: () => { const c = ctx(); X.closePop(); if (c && c.pos != null) ed().chain().focus().command(({ tr }) => { tr.delete(c.pos, c.pos + 1); return true; }).run(); },
    tbLevel: el => { X.closePop(); ed().chain().focus().setHeading({ level: +el.dataset.v }).run(); },
    tbMove: el => { const c = ctx(); X.closePop(); const h = c && D().heads.find(x => x.pos === c.pos); if (h) ACT.move({ dataset: { hid: h.hid, dir: el.dataset.dir } }); },
    tbXrefHere: () => { X.closePop(); toast('Postavite kursor na mjesto upućivanja pa odaberite Umetni, Unakrsna referenca.'); },
    tbCiteEnd: el => { hideBub(); const s = ed().state.selection; ed().chain().focus().setTextSelection(s.to).run(); ACT.cite(fake()); },
    tbSel: el => { hideBub(); ACT[el.dataset.v](fake()); },
    /* 9 */
    tbCfg: () => X.openDlg({ type: 'tbcfg' }), tbKeys: () => X.openDlg({ type: 'tbkeys' }),
    tbTog: el => { const c = cfg(), id = el.dataset.id; c.off = c.off.includes(id) ? c.off.filter(x => x !== id) : c.off.concat(id); persist(); X.renderDlg(); paint(); },
    tbOrd: el => { const { m, left } = lay(), i = left.indexOf(el.dataset.id), j = i + +el.dataset.dir; if (j < 0 || j >= left.length) return; [left[i], left[j]] = [left[j], left[i]]; cfg().order[m] = left; persist(); X.renderDlg(); paint(); },
    tbLook: el => { cfg().look = el.dataset.v; persist(); X.renderDlg(); paint(); },
    tbReset: () => { S.tb = { off: [], order: {} }; persist(); X.renderDlg(); paint(); },
    /* 10 i 11 */
    cmNext: () => cmGo(1), cmPrev: () => cmGo(-1), chNext: () => chGo(1), chPrev: () => chGo(-1), tbChNext: () => { X.closePop(); chGo(1); },
    tReq: () => { const r = domRange() || ed().state.selection, doc = ed().state.doc; let hit = null; const scan = (a, b) => doc.nodesBetween(a, b, (n, p) => { if (!hit && n.type.name === 'citation' && p >= a) hit = { n, p }; });
      scan(r.from, Math.max(r.to, r.from)); if (!hit) { const $f = doc.resolve(r.from); if ($f.depth >= 1) { scan(r.from, $f.after(1)); if (!hit) scan($f.before(1), $f.after(1)); } }
      if (!hit) return toast('Označite rečenicu s navodom ili kliknite na navod u tekstu.'); if (hit.n.attrs.rq) return toast('Uz taj je navod potvrda već zatražena.');
      ACT.s2Req({ dataset: { src: hit.n.attrs.sourceId, page: hit.n.attrs.page || '', pos: hit.p } }); flash(hit.p); },
    tbCmd: () => { X.closePop(); ckOpen(); }, ckRun: el => ckRun(+el.dataset.i), ckClose: () => ckClose(),
  });
  const domRange = () => { const ds = getSelection(); if (!ds || !ds.rangeCount || ds.isCollapsed || !$('#ed').contains(ds.anchorNode)) return null; try { const r = ds.getRangeAt(0), a = ed().view.posAtDOM(r.startContainer, r.startOffset), b = ed().view.posAtDOM(r.endContainer, r.endOffset); return { from: Math.min(a, b), to: Math.max(a, b) }; } catch (e) { return null; } };
  const flash = pos => { let d = ed().view.nodeDOM(pos); if (d && d.nodeType === 3) d = d.parentElement; if (!d || !d.classList) return; d.classList.remove('tb-flash'); void d.offsetWidth; d.classList.add('tb-flash'); setTimeout(() => d.classList && d.classList.remove('tb-flash'), 1700); };

  /* ---------- 10. kretanje po komentarima ---------- */
  function cmGo(dir) {
    const l = S.comments.filter(c => !c.resolved && !c.lost).sort((a, b) => a.from - b.from); if (!l.length) return toast('Nema otvorenih komentara.');
    let i = l.findIndex(c => c.id === U.active); if (i < 0) { const at = ed().state.selection.from; i = dir > 0 ? l.findIndex(c => c.from >= at) : l.map(c => c.from <= at).lastIndexOf(true); if (i < 0) i = dir > 0 ? 0 : l.length - 1; } else i = (i + dir + l.length) % l.length;
    ACT.cmFocus({ dataset: { id: l[i].id } }); toast(`Komentar ${i + 1} od ${l.length}`);
  }
  /* ---------- 11. čitanje po promjenama ---------- */
  const sendWrap = n => { const f = ACT[n]; if (f) ACT[n] = el => { S.review.prev = (S.review.snapshot || []).slice(); return f(el); }; }; sendWrap('sendDo'); sendWrap('sendReview');
  function changed() {
    const r = S.review || {}, base = T() && r.status === 'review' && r.prev ? r.prev : r.snapshot; if (!base || !base.length) return null; const old = new Set(base), out = [];
    ed().state.doc.forEach((n, off) => { const t = n.textBetween(0, n.content.size, ' ', X.leafText).trim(); if (t && !old.has((n.type.name === 'heading' ? '# ' : '') + t)) out.push(off); }); return out;
  }
  function chGo(dir) {
    const l = changed(); if (!l) return toast('Rad još nije slan mentoru, pa nema s čim usporediti.'); if (!l.length) return toast(T() ? 'Od prošlog slanja ništa nije mijenjano.' : 'Od zadnjeg slanja ništa niste mijenjali.');
    const at = U.chAt != null && l.includes(U.chAt) ? U.chAt : ed().state.selection.from - 1; let i = dir > 0 ? l.findIndex(o => o > at) : l.map(o => o < at).lastIndexOf(true); if (i < 0) i = dir > 0 ? 0 : l.length - 1;
    U.chAt = l[i]; X.jump(l[i] + 1, false); flash(l[i]); toast(`Promjena ${i + 1} od ${l.length}`);
  }
  const chBase = () => { const r = S.review || {}; return T() && r.status === 'review' && r.prev ? r.prev : r.snapshot; };
  X.tb = { TL, LEFT, RIGHT, IC, paint: () => { key = ''; paint(); }, hideBub: () => hideBub(), changed, ctx, fit, base: chBase, flash, pop, fake, CMD: () => CMD, KEYS: () => KEYS, cmGo };

  /* ---------- 4. balončić uz označeni tekst ---------- */
  const bub = document.createElement('div'); bub.id = 'selBub'; bub.hidden = true; bub.setAttribute('role', 'toolbar'); bub.setAttribute('aria-label', 'Radnje za označeni tekst'); document.body.appendChild(bub);
  const hideBub = () => { bub.hidden = true; }; let bt = null;
  function showBub() {
    const ds = getSelection(); if (!ed() || S.submitted || U.dlg || U.ck || !ds || !ds.rangeCount || ds.isCollapsed || !$('#ed').contains(ds.anchorNode) || ds.toString().trim().length < 3) return hideBub();
    const b = (a, l, x) => `<button data-act="${a}"${x || ''}>${l}</button>`; let h;
    if (T()) h = b('comment', 'Komentar') + b('c2Priv', 'Privatna bilješka') + b('tReq', 'Zatraži potvrdu');
    else if (!ed().isEditable) return hideBub();
    else { const ai = AX && AX.curSrc && AX.curSrc() && ['lekt', 'prij', 'pojam'].some(k => AX.allowed(k)); h = b('comment', 'Komentar') + b('tbCiteEnd', 'Navod') + b('tbSel', 'U blok-citat', ' data-v="toQuote"') + b('tbSel', 'U fusnotu', ' data-v="toFn"') + b('tbSel', 'Odloži', ' data-v="stash"') + (ACT['menu-hl'] ? b('menu-hl', 'Marker ▾') : '') + (ai ? b('menu-ai', 'Pomoćnik ▾') : ''); }
    bub.innerHTML = h; bub.hidden = false; const r = ds.getRangeAt(0).getBoundingClientRect(), w = bub.offsetWidth, below = innerWidth <= 700 || r.top < 110;
    bub.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'; bub.style.top = (below ? Math.min(innerHeight - 100, r.bottom + 10) : r.top - 44) + 'px';
  }
  document.addEventListener('selectionchange', () => { clearTimeout(bt); bt = setTimeout(showBub, 350); });
  document.addEventListener('scroll', e => { if (e.target !== bub) hideBub(); }, true); addEventListener('resize', hideBub);
  document.addEventListener('mousedown', e => { if (e.target.closest('#selBub, #mbar')) e.preventDefault(); });
  document.addEventListener('click', e => { if (e.target.closest('#selBub button') && !/^menu-/.test(e.target.closest('button').dataset.act)) setTimeout(hideBub, 0); });

  /* ---------- 7. mobilna traka iznad tipkovnice ---------- */
  const mb = document.createElement('div'); mb.id = 'mbar'; mb.hidden = true; mb.setAttribute('role', 'toolbar'); mb.setAttribute('aria-label', 'Brzi alati'); document.body.appendChild(mb); let mbKey = '';
  function mbar() {
    const e = ed(), on = !!e && innerWidth <= 640 && e.isEditable && e.isFocused && !U.dlg && !U.ck; if (!on) { mb.hidden = true; return; }
    const d = X.caps && X.caps.dictation, k = (d ? 1 : 0) + '|' + (U.dict ? 1 : 0);
    if (k !== mbKey || !mb.innerHTML) { mbKey = k; const b = (a, l) => `<button data-act="${a}">${l}</button>`; mb.innerHTML = b('undo', 'Poništi') + b('cite', 'Navod') + b('comment', 'Komentar') + b('hole', 'Za provjeru') + (d ? b('dictate', U.dict ? 'Stani' : 'Diktiraj') : '') + b('menu-mb', 'Više'); }
    const vv = window.visualViewport; mb.style.bottom = (vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0) + 'px'; mb.hidden = false;
  }
  document.addEventListener('focusin', () => setTimeout(mbar, 0)); document.addEventListener('focusout', () => setTimeout(mbar, 200));
  if (window.visualViewport) { visualViewport.addEventListener('resize', mbar); visualViewport.addEventListener('scroll', mbar); }

  /* ---------- 5. naredbena paleta ---------- */
  const ck = document.createElement('div'); ck.id = 'cmdk'; ck.hidden = true; ck.innerHTML = '<div class="ck" role="dialog" aria-label="Naredbe"><input id="ckQ" placeholder="Upišite naredbu, poglavlje ili izvor" aria-label="Naredba, poglavlje ili izvor" autocomplete="off"><div id="ckL" role="listbox"></div><div class="ckf">↑ ↓ odabir · Enter potvrda · Esc zatvori</div></div>'; document.body.appendChild(ck);
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  /* [naziv, napomena, radnja, podaci, tko: w student, t nastavnik, a svi, smije i kad je rad predan] */
  const CMD = [
    ['Navod', 'umetni iz izvora', 'cite', null, 'w'], ['Novi izvor', 'dodaj i citiraj', 'quick', null, 'w'], ['Tablica', 'umetni', 'insPrikaz', { kind: 'tablica' }, 'w'], ['Slika', 'umetni', 'insPrikaz', { kind: 'slika' }, 'w'],
    ['Fusnota', 'umetni', 'insFn', null, 'w'], ['Unakrsna referenca', 'umetni', 'insXref', null, 'w'], ['Za provjeru', 'oznaka [?], vratite se poslije', 'hole', null, 'w'], ['Fraze', 'akademske fraze', 'phrases', null, 'w'], ['Posebni znak', '„ ” … ° ×', 'menu-chars', null, 'w'],
    ['Komentar', 'uz označeni tekst', 'comment', null, 'a'], ['Odloži', 'označeni tekst', 'stash', null, 'w'], ['U blok-citat', 'označeni tekst', 'toQuote', null, 'w'], ['U fusnotu', 'označeni tekst', 'toFn', null, 'w'],
    ['Poruka sebi', 'za sljedeći put', 'noteSelf', null, 'w'], ['Diktiraj', 'pišite govorom', 'dictate', null, 'w'],
    ['Opći komentar', 'uz poglavlje ili rad', 'c2GenNew', null, 't'], ['Privatna bilješka', 'vidite je samo Vi', 'c2Priv', null, 't'], ['Zatraži potvrdu', 'uz navod', 'tReq', null, 't'], ['Vrati na doradu', 'sa sažetkom primjedbi', 'm2Back', null, 't'],
    ['Pregled literature', 'svi izvori rada', 's2LitView', null, 't'], ['Moji studenti', 'svi radovi', 'm2All', null, 't'],
    ['Sljedeći komentar', 'otvoreni', 'cmNext', null, 'a'], ['Prethodni komentar', 'otvoreni', 'cmPrev', null, 'a'], ['Sljedeća promjena', 'od zadnjeg slanja', 'chNext', null, 'a'], ['Prethodna promjena', 'od zadnjeg slanja', 'chPrev', null, 'a'],
    ['Traži i zamijeni', 'Ctrl+F', 'findOpen', null, 'a', 1], ['Način fokusa', 'Ctrl+.', 'focus', null, 'w'], ['Sadržaj na listu', 'prikaži ili sakrij', 'tocToggle', null, 'a', 1], ['Struktura rada', 'Ctrl+\\', 'railToggle', null, 'a', 1], ['Pomoć u tekstu', 'koliko upozorenja', 'help', null, 'w'],
    ['Word (.docx)', 'izvoz', 'docx', null, 'a', 1], ['Pregled ispisa', 'A4', 'print', null, 'a', 1], ['Kopiraj tekst rada', '', 'copy', null, 'a', 1], ['Usporedba teksta', 'promjene od zadnjeg slanja', 'diff', null, 'a', 1], ['Povijest rada', '', 'history', null, 'w'],
    ['Zahtjevi rada', 'pravila fakulteta i stil citiranja', 'rqOpen', null, 'a', 1], ['Prečaci', 'Ctrl+/', 'tbKeys', null, 'a', 1], ['Prilagodi alatnu traku', '', 'tbCfg', null, 'a', 1],
    ['Izvori', 'bočna traka', 'tbTab', { v: 'lit' }, 'a', 1], ['Komentari', 'bočna traka', 'tbTab', { v: 'cmt' }, 'a', 1], ['Pregled', 'bočna traka', 'tbTab', { v: 'nacrt' }, 'a', 1], ['Mentor i predaja', 'bočna traka', 'tbTab', { v: 'rad' }, 'a', 1], ['Asistent', 'bočna traka', 'tbTab', { v: 'ai' }, 'a', 1],
  ];
  ACT.tbTab = el => X.showTab(el.dataset.v);
  function ckItems(q) {
    const m = mode(), nq = norm(q).trim().split(/\s+/).filter(Boolean), hit = s => { const n = norm(s); return nq.every(t => n.includes(t)); }, out = [];
    CMD.forEach(c => { if (!ACT[c[2]]) return; if (m === 'l' ? !c[5] : c[4] !== 'a' && c[4] !== m) return; if (c[2] === 'dictate' && !(X.caps && X.caps.dictation)) return; if (hit(c[0] + ' ' + c[1])) out.push({ g: 'Naredbe', l: c[0], h: c[1], run: () => ACT[c[2]](fake(c[3])) }); });
    if (m === 'w') (X.hooks.cmds || []).forEach(c => { if (hit(c[1] + ' ' + (c[2] || '')) && !out.some(o => o.l === c[1])) out.push({ g: 'Naredbe', l: c[1], h: c[2] || '', run: c[3] }); });
    if (nq.length) {
      D().heads.forEach(h => { if (hit((h.num || '') + ' ' + h.title)) out.push({ g: 'Poglavlja', l: ((h.num || '') + ' ' + h.title).trim(), h: 'idi na', run: () => X.jump(h.pos + 1, false) }); });
      S.sources.forEach(s => { if (hit(s.authors + ' ' + s.title + ' ' + X.yearLabel(s))) out.push({ g: 'Izvori', l: `${s.authors} (${X.yearLabel(s)})`, h: m === 'w' ? 'umetni navod' : 'otvori', run: () => (m === 'w' ? X.insertCitation(s.id, '') : X.showTab('lit')) }); });
      const first = norm(nq[0]); out.sort((a, b) => (norm(b.l).startsWith(first) ? 1 : 0) - (norm(a.l).startsWith(first) ? 1 : 0));
    }
    if (!nq.length) { const rc = (S.ckRecent || []).map(l => out.find(o => o.l === l)).filter(Boolean).map(o => Object.assign({}, o, { g: 'Nedavno' })); return rc.concat(out.filter(o => !rc.some(r => r.l === o.l))).slice(0, 10); }
    return out.slice(0, 14);
  }
  function ckDraw() { const l = U.ck.items = ckItems($('#ckQ').value); if (U.ck.i >= l.length) U.ck.i = 0; let g = ''; $('#ckL').innerHTML = l.length ? l.map((x, i) => `${x.g !== g ? `<div class="ckg">${g = x.g}</div>` : ''}<button class="cki${i === U.ck.i ? ' sel' : ''}" data-act="ckRun" data-i="${i}" role="option" aria-selected="${i === U.ck.i}"><span>${esc(x.l)}</span><small>${esc(x.h)}</small></button>`).join('') : '<div class="pad muted" style="padding:12px">Nema takve naredbe, poglavlja ni izvora.</div>'; const s = $('#ckL .sel'); if (s) s.scrollIntoView({ block: 'nearest' }); }
  function ckOpen() { if (U.dlg) return; const r = domRange(), s = ed().state.selection; U.ck = { i: 0, items: [], sel: r || { from: s.from, to: s.to } }; hideBub(); ck.hidden = false; const q = $('#ckQ'); q.value = ''; ckDraw(); q.focus(); }
  function ckClose() { ck.hidden = true; U.ck = null; }
  function ckRun(i) { const it = U.ck && U.ck.items[i], sel = U.ck && U.ck.sel; ckClose(); if (!it) return; if (it.g === 'Naredbe' || it.g === 'Nedavno') { S.ckRecent = [it.l].concat((S.ckRecent || []).filter(x => x !== it.l)).slice(0, 4); persist(); } try { const e = ed(), max = e.state.doc.content.size; if (sel) e.commands.setTextSelection({ from: Math.min(sel.from, max), to: Math.min(sel.to, max) }); if (e.isEditable) e.commands.focus(); } catch (err) { /* odabir više ne postoji */ } setTimeout(() => it.run(), 30); }
  ck.addEventListener('mousedown', e => { if (e.target === ck) ckClose(); });
  ck.addEventListener('input', () => { U.ck.i = 0; ckDraw(); });

  /* ---------- 3. prečaci ---------- */
  const KEYS = [['Pisanje', [['Ctrl+Z', 'Poništi'], ['Ctrl+Y', 'Ponovi'], ['Ctrl+B', 'Podebljano'], ['Ctrl+I', 'Kurziv'], ['@', 'Navod iz Vaših izvora'], ['/', 'Naredbe u tekstu: /tablica, /slika, /fusnota, /fraza'], [':14 pa razmak', 'Stranica u navodu, odmah iza navoda']]],
    ['Kretanje i uređivanje', [['Ctrl+K', 'Naredbe: sve na jednom mjestu'], ['Ctrl+F', 'Traži i zamijeni'], ['Alt+↑ ili ↓', 'Premjesti rečenicu'], ['Alt+Shift+↑ ili ↓', 'Premjesti poglavlje'], ['Ctrl+Alt+M', 'Komentar uz označeni tekst'], ['desni klik', 'Komentar uz označeni tekst']]],
    ['Prikaz', [['Ctrl+.', 'Način fokusa'], ['Ctrl+\\', 'Struktura rada'], ['Ctrl+/', 'Ovaj popis'], ['Esc', 'Zatvara prozor ili izbornik']]]];
  X.hooks.dlg.tbkeys = () => `<h3>Prečaci</h3><p class="muted">Na Macu umjesto Ctrl vrijedi Cmd.</p>${KEYS.map(g => `<div class="ptitle">${g[0]}</div>${g[1].map(k => `<div class="fx"><span style="flex:1">${k[1]}</span><span class="kbd">${esc(k[0])}</span></div>`).join('')}`).join('')}<div class="foot"><button class="btn" data-act="dlgClose">Zatvori</button></div>`;
  X.hooks.dlg.tbcfg = () => { const { m, left, right } = lay(), off = cfg().off, row = (id, mv) => `<div class="fx"><span style="flex:1"><b class="tbn">${sv(IC[id])}${TL[id][0].replace(' ▾', '')}</b><span class="d">${esc(tip(id))}</span></span>${mv ? `<button class="ib" data-act="tbOrd" data-id="${id}" data-dir="-1" aria-label="Pomakni ulijevo" title="Pomakni ulijevo">←</button><button class="ib" data-act="tbOrd" data-id="${id}" data-dir="1" aria-label="Pomakni udesno" title="Pomakni udesno">→</button>` : ''}<button class="chip${off.includes(id) ? '' : ' done'}" data-act="tbTog" data-id="${id}">${off.includes(id) ? 'U izborniku Više' : 'Na traci'}</button></div>`;
    return `<h3>Prilagodi alatnu traku</h3><p class="muted">${m === 't' ? 'Traka za pregled rada.' : m === 'l' ? 'Rad je predan, pa su dostupni samo alati za čitanje.' : 'Traka za pisanje.'} Odaberite što je na traci, a što u izborniku Više. Kad traka ne stane u širinu, alati se sami sele u Više.</p><div class="ptitle">Izgled gumba</div><div class="row">${[['i', 'Ikone'], ['b', 'Ikone i riječi'], ['w', 'Riječi']].map(o => `<button class="chip${look() === o[0] ? ' done' : ''}" data-act="tbLook" data-v="${o[0]}">${o[1]}</button>`).join('')}</div><p class="muted">Uz ikone se naziv i opis alata pokažu kad pokazivačem stanete na gumb. Na mobitelu gumb držite pritisnutim.</p>${left.length ? `<div class="ptitle">Lijevo</div>${left.filter(i => i !== 'style').map(i => row(i, true)).join('')}` : ''}<div class="ptitle">Desno</div>${right.map(i => row(i, false)).join('')}<div class="foot"><button class="btn" data-act="tbReset">Vrati zadano</button><button class="btn pri" data-act="dlgClose">Gotovo</button></div>`; };

  /* =====================================================================
   * Drugi krug (v0.18): A brojači · B Pošalji mentoru · C Navod pamti · D oznake · E veličina teksta · F zalijepi kao
   * G paleta pamti (gore) · H spremljeni komentari · I samo promjene · J dokle sam stao · K traka tipkovnicom
   * ===================================================================== */
  const QN = { cntHole: 1, cntCmt: 1, cntSrc: 1, tbSend: 1 };
  Object.assign(TL, {
    cntHole: ['Za provjeru', '', 'Skok na sljedeće mjesto koje ste ostavili za provjeru', 58, 5], cntCmt: ['Otvoreni komentari', '', 'Skok na sljedeći otvoreni komentar', 57, 5], cntSrc: ['Navodi bez izvora', '', 'Skok na sljedeći navod koji nije povezan s izvorom', 56, 5],
    tbSend: ['Pošalji mentoru', '', 'Što još čeka prije slanja i slanje dorade', 68, 6], 'menu-marks': ['Oznake', '', 'Označite mjesto na koje se želite vratiti', 35, 3],
    'menu-tpl': ['Spremljeni komentari', '', 'Česta primjedba jednim klikom na označeni tekst', 72, 1], tbOnly: ['Samo promjene', '', 'Prigušuje odlomke koji nisu mijenjani od prošlog slanja', 61, 2], 'menu-stop': ['Dokle sam stao', '', 'Oznaka dokle ste pročitali; vidite je samo Vi', 52, 2],
  });
  Object.assign(IC, {
    cntHole: IC.hole, cntCmt: BUB, cntSrc: '<path d="M6 3C3.8 5.5 3.8 12.5 6 15M12 3c2.2 2.5 2.2 9.5 0 12M7 11.5l4-5"/>',
    tbSend: '<path d="M15.5 2.5 2.5 8l5 2 2 5z"/><path d="M7.5 10l8-7.5"/>', 'menu-marks': '<path d="M5 15V3.5h8.5l-2 3 2 3H5"/>',
    'menu-tpl': BUB + '<path d="M9 5.8l.8 1.6 1.7.25-1.25 1.2.3 1.750L9 9.8l-1.55.8.3-1.750L6.5 7.65l1.7-.25z" fill="currentColor" stroke="none"/>',
    tbOnly: '<path d="M3 4.5h12M3 9h12M3 13.5h12" opacity=".35"/><path d="M3 9h12"/>', 'menu-stop': '<path d="M4.5 3h9v12L9 12l-4.5 3z"/>',
  });
  LEFT.w.splice(LEFT.w.indexOf('hole') + 1, 0, 'menu-marks'); LEFT.w.push('cntHole', 'cntCmt', 'cntSrc', 'tbSend');
  LEFT.t.splice(1, 0, 'menu-tpl'); LEFT.t.splice(LEFT.t.indexOf('chNext') + 1, 0, 'tbOnly', 'menu-stop');
  const openCm = () => S.comments.filter(x => !x.resolved && !x.lost);
  const counts = () => ({ cntHole: D().holes.length, cntCmt: openCm().length, cntSrc: D().plain.length });

  /* ---------- oznake u tekstu, dokle sam stao, samo promjene: stilom po rednom broju odlomka ---------- */
  const st = document.createElement('style'); st.id = 'tbMarks'; document.head.appendChild(st); let cssKey = '';
  const idxOf = pos => { const e = ed(), pm = e.view.dom; try { const $p = e.state.doc.resolve(Math.max(0, Math.min(pos + 1, e.state.doc.content.size))); let d = e.view.nodeDOM($p.depth >= 1 ? $p.before(1) : pos); while (d && d.parentNode !== pm) d = d.parentNode; return d ? [...pm.children].indexOf(d) + 1 : 0; } catch (err) { return 0; } };
  function marksCss() {
    const e = ed(), marks = mode() === 'w' ? S.marks || [] : [], stop = T() ? S.mentorAt : null, only = !!U.tbOnly && !S.submitted; $('#ed').classList.toggle('only-ch', only);
    const k = [e.state.doc.content.size, marks.map(m => m.pos).join(','), stop ? stop.pos : '', only ? (changed() || []).join(',') : '', mode()].join('|'); if (k === cssKey) return; cssKey = k;
    const sel = l => l.filter(Boolean).map(i => `#ed .ProseMirror > :nth-child(${i})`); let css = '';
    const mi2 = sel(marks.map(m => idxOf(m.pos))); if (mi2.length) css += `${mi2.join(',')}{position:relative}${mi2.map(x => x + '::after').join(',')}{content:"";position:absolute;left:-17px;top:.45em;width:9px;height:11px;background:var(--accent);clip-path:polygon(0 0,100% 0,100% 100%,50% 72%,0 100%)}`;
    if (stop) { const i = idxOf(stop.pos); if (i) css += `#ed .ProseMirror > :nth-child(${i}){border-bottom:1px dashed var(--ink-3);padding-bottom:8px}`; }
    if (only) { const ci = sel((changed() || []).map(idxOf)); css += `#ed.only-ch .ProseMirror > *{opacity:.3;transition:opacity .15s}` + (ci.length ? `${ci.map(x => '#ed.only-ch ' + x.slice(4)).join(',')}{opacity:1}` : ''); }
    st.textContent = css;
  }
  X.hooks.tx.push(tr => { if (!tr.docChanged) return; (S.marks || []).forEach(m => { m.pos = tr.mapping.map(m.pos, -1); }); if (S.mentorAt) S.mentorAt.pos = tr.mapping.map(S.mentorAt.pos, -1); });
  const blockAt = () => { const r = domRange(), e = ed(), pos = r ? r.from : e.state.selection.from, $p = e.state.doc.resolve(pos); return $p.depth >= 1 ? { pos: $p.before(1), node: $p.node(1) } : null; };
  const topVisible = () => { const pm = ed().view.dom, top = $('#tools').getBoundingClientRect().bottom + 20; let hit = null; [...pm.children].some(c => { const r = c.getBoundingClientRect(); if (r.bottom > top + 10) { hit = c; return true; } return false; }); if (!hit) return null; try { const p = ed().view.posAtDOM(hit, 0), $p = ed().state.doc.resolve(p); return $p.depth >= 1 ? { pos: $p.before(1), node: $p.node(1) } : null; } catch (err) { return null; } };
  const cutTxt = (n, k) => { const t = n.textBetween(0, n.content.size, ' ', X.leafText).trim(); return t.length > k ? t.slice(0, k - 1) + '…' : t || 'prazan odlomak'; };
  const chapOf = pos => { let h = null; D().heads.forEach(x => { if (x.level > 1 && x.pos <= pos) h = x; }); return h ? `${h.num} ${h.title}` : 'početak rada'; };

  function extra() {
    let re = false; const c = counts(), wait = c.cntHole + c.cntCmt + c.cntSrc;
    document.querySelectorAll('#tools .tbq').forEach(q => { const id = q.dataset.q, n = id === 'tbSend' ? wait : c[id], b = q.parentNode, z = id !== 'tbSend' && !n; if (q.textContent !== String(n || '')) q.textContent = n || ''; if (b.hasAttribute('data-zero') !== z) { b.toggleAttribute('data-zero', z); re = true; } });
    const o = $('#tools [data-tid="tbOnly"]'); if (o) { o.classList.toggle('on', !!U.tbOnly); o.setAttribute('aria-pressed', String(!!U.tbOnly)); }
    marksCss(); document.documentElement.style.setProperty('--tz', S.tz || 1); return re;
  }

  Object.assign(ACT, {
    /* A */
    cntHole: () => { X.closePop(); ACT.railNext({ dataset: { k: 'hole' } }); }, cntCmt: () => { X.closePop(); ACT.railNext({ dataset: { k: 'cmt' } }); }, cntSrc: () => { X.closePop(); ACT.railNext({ dataset: { k: 'plain' } }); },
    /* B */
    tbSend: el => { const c = counts(), r = S.review || {}, must = openCm().filter(x => x.role === 'teacher' && (x.kind || 'must') === 'must').length, row = (a, n, one, few, many, note) => n ? mi(a, `${n} ${X.plural(n, one, few, many)}`, note) : '';
      const rows = row('cntHole', c.cntHole, 'mjesto za provjeru', 'mjesta za provjeru', 'mjesta za provjeru', 'idi na sljedeće') + row('cntCmt', c.cntCmt, 'otvoren komentar', 'otvorena komentara', 'otvorenih komentara', must ? `${must} mora se popraviti` : 'idi na sljedeći') + row('cntSrc', c.cntSrc, 'navod bez izvora', 'navoda bez izvora', 'navoda bez izvora', 'idi na sljedeći');
      pop(el, `<div class="mh">Prije slanja mentoru</div>${rows || '<div class="pad">Ništa ne čeka. Rad je spreman za slanje.</div>'}<div class="pad muted">${r.status === 'review' ? 'Rad je trenutačno kod mentora (runda ' + r.round + ').' : rows ? 'Ovo ne priječi slanje, ali mentor će to vidjeti.' : ''}</div>${ACT.sendReview && r.status !== 'review' ? `<div class="pad"><button class="btn pri sm" data-act="sendReview">Pošalji doradu</button></div>` : ''}`); },
    /* C */
    cite: el => { const all = S.sources, e = ed(), near = []; if (e) e.state.doc.nodesBetween(0, e.state.selection.from, n => { if (n.type.name === 'citation') near.push(n.attrs.sourceId); });
      const rec = [...new Set((S.citeRecent || []).concat(near.reverse()))].map(id => all.find(s => s.id === id)).filter(Boolean).slice(0, 3), it = s => `<button class="mi" data-act="citeIns" data-id="${esc(s.id)}"><span>${esc(s.authors)} (${X.yearLabel(s)})</span><small>${esc(s.title.slice(0, 26))}</small></button>`;
      pop(el, (all.length > 3 && rec.length ? `<div class="mh">Zadnje korišteni</div>${rec.map(it).join('')}<div class="mh">Svi izvori</div>` : '<div class="mh">Umetni navod</div>') + (all.map(it).join('') || '<div class="pad">Još nemate izvora. Dodajte prvi u Umetni, Novi izvor.</div>') + '<div class="pad muted">Brže bez miša: u tekstu upišite @ i početak prezimena, pa Enter. Novi izvor dodajete na istom mjestu.</div>' + mi('quick', 'Dodaj novi izvor…', '')); },
    /* D */
    'menu-marks': el => { const l = (S.marks || []).slice().sort((a, b) => a.pos - b.pos); pop(el, `<div class="mh">Oznake</div>${mi('tbMarkAdd', 'Označi ovaj odlomak', 'vratite se poslije')}${l.map(m => `<div class="mrow"><button class="mi" data-act="tbMarkGo" data-id="${m.id}"><span>${esc(m.label)}</span><small>${esc(m.where)}</small></button><button class="ib" data-act="tbMarkDel" data-id="${m.id}" aria-label="Ukloni oznaku" title="Ukloni oznaku">✕</button></div>`).join('') || '<div class="pad muted">Još nema oznaka. Vidite ih samo Vi.</div>'}`); },
    tbMarkAdd: () => { X.closePop(); const b = blockAt(); if (!b) return; S.marks = S.marks || []; if (S.marks.some(m => m.pos === b.pos)) return toast('Taj je odlomak već označen.'); S.marks.push({ id: X.uid('mk'), pos: b.pos, label: cutTxt(b.node, 34), where: chapOf(b.pos) }); persist(); cssKey = ''; paint(); toast('Odlomak je označen. Oznake su pod gumbom Oznake.'); },
    tbMarkGo: el => { X.closePop(); const m = (S.marks || []).find(x => x.id === el.dataset.id); if (m) { X.jump(m.pos + 1, false); flash(m.pos); } },
    tbMarkDel: el => { S.marks = (S.marks || []).filter(x => x.id !== el.dataset.id); persist(); cssKey = ''; X.closePop(); paint(); },
    /* E */
    'menu-zoom': el => { const Z = [0.9, 1, 1.15, 1.3, 1.5], i = Math.max(0, Z.indexOf(S.tz || 1)), j = Math.max(0, Math.min(Z.length - 1, i + +el.dataset.d)); S.tz = Z[j]; persist(); X.closePop(); paint(); toast(`Tekst na zaslonu: ${Math.round(Z[j] * 100)} %. Izvoz i ispis ostaju po pravilima fakulteta.`); },
    /* F */
    tbPasteQuote: () => { if (U.pasteR) ACT.pasteQuote(); },
    tbPasteStash: () => { const r = U.pasteR; X.closePop(); if (!r) return; ed().chain().focus().setTextSelection({ from: r.from, to: r.to }).run(); ACT.stash(); },
    'menu-pnote': el => { const r = U.pasteR; if (!r) return X.closePop(); if (!S.sources.length) { X.closePop(); return toast('Najprije dodajte izvor kojem bilješka pripada.'); } pop(fake(), `<div class="mh">Bilješka uz koji izvor?</div>${S.sources.map(s => mi('tbPasteNote', `${esc(s.authors)} (${X.yearLabel(s)})`, '', ` data-id="${esc(s.id)}"`)).join('')}`); },
    tbPasteNote: el => { const r = U.pasteR; X.closePop(); if (!r) return; const text = ed().state.doc.textBetween(r.from, r.to, ' '); (S.rnotes[el.dataset.id] = S.rnotes[el.dataset.id] || []).push({ id: X.uid('n'), page: '', text }); ed().chain().focus().deleteRange({ from: r.from, to: r.to }).run(); persist(); X.renderPanel(true); toast('Tekst je spremljen kao bilješka uz izvor i maknut iz rada.'); },
    /* H */
    'menu-tpl': el => { const l = S.tpls || []; pop(el, `<div class="mh">Spremljeni komentari</div>${l.map(x => mi('tbTpl', esc(x.t.length > 44 ? x.t.slice(0, 43) + '…' : x.t), X.c2 && X.c2.KIND ? X.c2.KIND[x.kind] || '' : '', ` data-id="${esc(x.id)}"`)).join('') || '<div class="pad muted">Još nema spremljenih komentara.</div>'}${ACT.c2Tpls ? mi('c2Tpls', 'Uredi spremljene komentare', '') : ''}<div class="pad muted">Označite tekst pa odaberite komentar.</div>`); },
    tbTpl: el => { X.closePop(); hideBub(); const n0 = S.comments.length; ACT.comment(); if (!U.draft) return toast('Najprije označite tekst u radu, unutar jednog odlomka.'); ACT.c2Use({ dataset: { id: el.dataset.id } }); setTimeout(() => { if ($('#cmText') && $('#cmText').value.trim()) { ACT.cmPost(); if (S.comments.length > n0) toast('Komentar je dodan.'); } }, 80); },
    /* I */
    tbOnly: () => { X.closePop(); if (!U.tbOnly) { const l = changed(); if (!l) return toast('Rad još nije slan mentoru, pa nema s čim usporediti.'); if (!l.length) return toast('Od prošlog slanja ništa nije mijenjano.'); toast(`Istaknuto: ${l.length} ${X.plural(l.length, 'izmijenjen odlomak', 'izmijenjena odlomka', 'izmijenjenih odlomaka')}.`); } U.tbOnly = !U.tbOnly; cssKey = ''; paint(); },
    /* J */
    'menu-stop': el => { const m = S.mentorAt; pop(el, `<div class="mh">Dokle sam stao</div>${mi('tbStopSet', 'Stao sam ovdje', 'označeni ili prvi vidljivi odlomak')}${m ? mi('tbStopGo', 'Nastavi od oznake', esc(m.when)) + `<div class="pad muted">${esc(m.where)}: ${esc(m.label)}</div>` + mi('tbStopDel', 'Ukloni oznaku', '') : ''}<div class="pad muted">Oznaku vidite samo Vi. Sprema se na poslužitelju, pa je vidite i na drugom računalu. Brišete je Vi.</div>`); },
    tbStopSet: () => { X.closePop(); const b = (domRange() ? blockAt() : null) || topVisible() || blockAt(); if (!b) return; S.mentorAt = { pos: b.pos, label: cutTxt(b.node, 40), where: chapOf(b.pos), when: X.now() }; persist(); cssKey = ''; paint(); toast('Zapamćeno na poslužitelju. Sljedeći put, i na drugom računalu, odaberite Nastavi od oznake.'); },
    tbStopGo: () => { X.closePop(); const m = S.mentorAt; if (m) { X.jump(m.pos + 1, false); flash(m.pos); } }, tbStopDel: () => { X.closePop(); S.mentorAt = null; persist(); cssKey = ''; paint(); },
  });
  const ci0 = ACT.citeIns; ACT.citeIns = el => { S.citeRecent = [el.dataset.id].concat((S.citeRecent || []).filter(x => x !== el.dataset.id)).slice(0, 3); return ci0(el); };
  CMD.push(['Prvi koraci', 'kratak uvod', 'tbOnb', null, 'w'], ['Označi ovaj odlomak', 'oznaka za povratak', 'tbMarkAdd', null, 'w'], ['Pošalji mentoru', 'što još čeka', 'tbSend', null, 'w'], ['Sljedeće mjesto za provjeru', 'u tekstu', 'cntHole', null, 'w'], ['Samo promjene', 'priguši nemijenjano', 'tbOnly', null, 'a'], ['Stao sam ovdje', 'oznaka čitanja', 'tbStopSet', null, 't'], ['Nastavi od oznake', 'gdje ste stali', 'tbStopGo', null, 't'], ['Veći tekst', 'na zaslonu', 'menu-zoom', { d: 1 }, 'a', 1], ['Manji tekst', 'na zaslonu', 'menu-zoom', { d: -1 }, 'a', 1]);

  /* ---------- F. zalijepi kao ---------- */
  const paste0 = X.hooks.paste;
  X.hooks.paste = (view, e) => { const a = ed().state.selection.from, r = paste0 ? paste0(view, e) : false; if (!r) return r;
    setTimeout(() => { const st2 = ed().state, to = st2.selection.from, $a = st2.doc.resolve(Math.min(a, st2.doc.content.size)), $b = st2.doc.resolve(to); if (to <= a || !$a.sameParent($b)) return; const n = st2.doc.nodeAt(a), mark = n && n.marks.find(m => m.type.name === 'paste'); if (!mark) return; U.pasteR = { from: a, to, mark };
      X.openPop(`<div class="mh">Zalijepljeno. Što je ovo?</div>${mi('tbPasteQuote', 'Doslovni navod', 'navodnici i izvor')}${mi('menu-pnote', 'Bilješka uz izvor', 'ne ide u tekst rada')}${mi('tbPasteStash', 'Odloži za poslije', 'miče iz teksta')}${mi('tbPasteKeep', 'Ostavi u tekstu', 'ostaje označeno')}<div class="pad muted">Zalijepljeni tekst ostaje označen dok ga ne parafrazirate ili ne navedete izvor.</div>`, curRect(), 'menu'); }, 40);
    return r; };
  ACT.tbPasteKeep = () => X.closePop();

  /* ---------- K. traka tipkovnicom ---------- */
  $('#tools').addEventListener('keydown', e => { const t = e.target; if (!t.classList || !t.classList.contains('tb')) return; const l = [...$('#tools').querySelectorAll('.tb')].filter(b => !b.hidden && b.offsetParent), i = l.indexOf(t); let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % l.length; else if (e.key === 'ArrowLeft') j = (i - 1 + l.length) % l.length; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = l.length - 1; else if (e.key === 'Escape' && $('#pop').hidden) { e.preventDefault(); tipHide(); if (ed().isEditable) ed().commands.focus(); return; } else return;
    e.preventDefault(); l.forEach(b => { b.tabIndex = -1; }); l[j].tabIndex = 0; l[j].focus(); });
  X.hooks.key.push(e => { if (e.altKey && e.key === 'F10') { e.preventDefault(); const b = $('#tools .tb[tabindex="0"]') || $('#tools .tb:not([hidden])'); if (b) b.focus(); return true; } return false; });
  KEYS[1][1].push(['Alt+F10', 'Na alatnu traku; strelice lijevo i desno, Esc natrag u tekst']);

  X.hooks.key.push(e => {
    const mod = e.ctrlKey || e.metaKey;
    if (U.ck) {
      if (e.key === 'Escape') { e.preventDefault(); ckClose(); if (ed().isEditable) ed().commands.focus(); return true; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = U.ck.items.length; if (n) { U.ck.i = (U.ck.i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; ckDraw(); } return true; }
      if (e.key === 'Enter') { e.preventDefault(); ckRun(U.ck.i); return true; }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); ckClose(); return true; }
      return false;
    }
    if (mod && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); ckOpen(); return true; }
    if (mod && (e.key === '/' || e.code === 'Slash')) { e.preventDefault(); if (!U.dlg) ACT.tbKeys(); return true; }
    if (e.key === 'Escape' && !bub.hidden) hideBub();
    return false;
  });
})();
