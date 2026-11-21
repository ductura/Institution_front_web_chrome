/* Ductura Editor, prototip: tekst (v0.19).
 * 1 tri razine oznaka i legenda · 2 jedan prozorčić za sve na tom mjestu · 3 tekst iz pomoćnika na klik · 4 navod u dva koraka
 * 5 komentar na mobitelu kao kartica pri dnu · 6 „nije greška” skida i crtu · 7 lijena analiza u dugom radu (app.js, lazyOk)
 * 8 promjene unutar odlomka · 9 rub lista s oznakama · 10 čisti tekst · 11 procjena stranice u rubu
 */
(function () {
  'use strict';
  const X = window.DU, { S, U, ACT, esc, $, persist, toast } = X, mi = X.fx.mi, ed = () => X.editor, D = () => X.D, T = () => S.mode === 'teacher', Deco = X.Decoration, TB = X.tb;
  X.hooks.defaults.push(s => { if (s.t2gut === undefined) s.t2gut = true; if (s.t2pg === undefined) s.t2pg = false; });
  const cut = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

  /* ---------- 1. razine ---------- */
  const HK = { term: 'Pojam', abbr: 'Kratica', colloq: 'Razgovorni izraz', absolute: 'Prejaka tvrdnja', first: 'Prvo lice', passive: 'Pasiv u nizu', trans: 'Prijelaz', short: 'Kratke rečenice' };
  /* vrsta: [selektor, razina (1 obvezno, 2 od mentora, 3 savjet, 4 odakle je tekst), naziv] */
  const KINDS = [
    ['hole', '.hole', 1, () => 'Za provjeru'], ['plain', '.plain-cite', 1, () => 'Navod upisan kao tekst'],
    ['cmt', '.cmt[data-c]', 2, el => { const c = S.comments.find(x => x.id === el.dataset.c); return 'Komentar' + (c ? ': ' + cut(c.text || '', 34) : ''); }], ['mnote', '.mnote', 2, () => 'Privatna bilješka'],
    ['cite', '.cite', 0, el => 'Navod ' + cut(el.textContent, 30)],
    ['claim', '.hint-claim', 3, () => 'Tvrdnja traži izvor'], ['long', '.hint-long', 3, () => 'Duga rečenica'], ['hint', '.hint[data-h]', 3, el => { const h = (D().hints || [])[+el.dataset.h]; return h ? HK[h.kind] || 'Savjet' : 'Savjet'; }],
    ['paste', '.paste', 4, () => 'Zalijepljeni tekst'], ['aitext', '.aitext', 4, () => 'Tekst iz pomoćnika'], ['aimatch', '.aimatch', 4, () => 'Podudaranje s odgovorom pomoćnika'],
  ];
  const OWN = {}; X.t2 = { KINDS, OWN };
  const LV = { 0: '', 1: 'obvezno', 2: 'od mentora', 3: 'savjet', 4: 'odakle je tekst' };
  function layers(t) {
    const pm = ed().view.dom, out = [], seen = new Set(), ro = !ed().isEditable; let x = t;
    while (x && x !== pm && x.nodeType === 1) { KINDS.forEach(k => { if (!x.matches(k[1])) return; if (ro && !/^(cmt|cite|paste|aitext|aimatch|mnote)$/.test(k[0])) return; if (U.t2Clean && k[2] === 3) return; if (k[0] === 'paste' && !S.warn.paste) return; const id = k[0] + (k[0] === 'cmt' ? x.dataset.c : ''); if (seen.has(id)) return; seen.add(id); out.push({ k: k[0], lv: k[2], el: x, label: k[3](x) }); }); x = x.parentNode; }
    return out.sort((a, b) => (a.lv || 2.5) - (b.lv || 2.5));
  }
  if (X.t2) X.t2.layers = layers;
  const fakeEv = (E, e0) => ({ target: { closest: s => (E.matches(s) ? E : null), dataset: E.dataset, classList: E.classList, matches: s => E.matches(s) }, clientX: e0.clientX, clientY: e0.clientY, offsetY: e0.offsetY, t2: true });
  const rectOf = el => el.getBoundingClientRect();

  /* ---------- 2. jedan prozorčić; 3. tekst iz pomoćnika; 5. kartica komentara ---------- */
  function own(l, e0) {
    if (OWN[l.k]) return OWN[l.k](l, e0);
    if (l.k === 'aitext') { const p = (l.el.dataset.ai || '').split(' · '); X.openPop(`<div class="pad"><p><b>Tekst iz pomoćnika</b></p><p>${p[1] ? 'Svrha: ' + esc(p[1]) + '.' : ''} ${p[3] ? 'Uneseno ' + esc(p[3]) + '.' : ''}</p><p class="muted">${T() ? 'Student je ovaj tekst prenio iz pomoćnika u Ducturi. Razgovor je u kartici Asistent.' : 'Ovaj ste tekst prenijeli iz pomoćnika. Oznaka ostaje i vidi je nastavnik; prijenos je u dnevniku.'}</p><button class="lnk" data-act="tbTab" data-v="ai">Otvori Asistenta</button></div>`, rectOf(l.el), 'menu'); return true; }
    if (l.k === 'aimatch') { X.openPop(`<div class="pad"><p><b>Podudaranje s odgovorom pomoćnika</b></p><p>Osam ili više riječi zaredom jednako je odgovoru koji ste dobili od pomoćnika u Ducturi.</p><p class="muted">Ovo je obična usporedba teksta i ništa ne govori o autorstvu. Razgovor je priložen radu.</p><button class="lnk" data-act="tbTab" data-v="ai">Otvori Asistenta</button></div>`, rectOf(l.el), 'menu'); return true; }
    if (l.k === 'mnote') { X.openPop(`<div class="pad"><p><b>Privatna bilješka</b></p><p>${esc((l.el.getAttribute('title') || '').replace(/^Privatna bilješka: /, ''))}</p><p class="muted">Vidite je samo Vi.</p></div>`, rectOf(l.el), 'menu'); return true; }
    if (l.k === 'plain' && ed().isEditable) return plainPop(l.el);
    if (l.k === 'hole' && ed().isEditable) return holePop(l.el);
    if (l.k === 'cmt' && innerWidth <= 1050) { U.active = l.el.dataset.c; U.t2Card = true; X.refresh(); card(); return true; }
    return false;
  }
  X.pickEv = e0 => {
    if (U.t2Pick) { const E = U.t2Pick; U.t2Pick = null; const l = layers(E).find(x => x.el === E && x.k === U.t2PickK); if (l && own(l, e0)) return null; return fakeEv(E, e0); }
    if (!getSelection().isCollapsed) return e0; if (e0.target.closest('.prikaz, .fn, .xref')) return e0;
    const ls = layers(e0.target); if (!ls.length) return U.t2Clean && !T() && e0.target.closest('.hint, .hint-claim, .hint-long, .sp') ? null : e0;
    if (ls.length === 1) return own(ls[0], e0) ? null : e0;
    U.t2Els = ls; X.openPop(`<div class="mh">Na ovom mjestu</div>${ls.map((l, i) => `<button class="mi" data-act="menu-t2pick" data-i="${i}"><span>${esc(l.label)}</span><small>${LV[l.lv]}</small></button>`).join('')}`, { left: e0.clientX, right: e0.clientX, top: e0.clientY - 8, bottom: e0.clientY + 10 }, 'menu'); return null;
  };
  ACT['menu-t2pick'] = el => { const l = (U.t2Els || [])[+el.dataset.i]; X.closePop(); if (!l || !l.el.isConnected) return; const r = rectOf(l.el); U.t2Pick = l.el; U.t2PickK = l.k; l.el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 4, clientY: r.bottom - 4 })); U.t2Pick = null; };

  const cd = document.createElement('div'); cd.id = 't2card'; cd.hidden = true; cd.setAttribute('role', 'dialog'); cd.setAttribute('aria-label', 'Komentar'); document.body.appendChild(cd);
  function card() {
    const c = U.t2Card && S.comments.find(x => x.id === U.active); if (!c || innerWidth > 1050 || U.dlg) { cd.hidden = true; U.t2Card = false; return; }
    const open = S.comments.filter(x => !x.resolved && !x.lost).sort((a, b) => a.from - b.from), i = open.findIndex(x => x.id === c.id), KD = (X.c2 && X.c2.KIND) || {}, rep = c.replies || [];
    const key = [c.id, c.resolved, rep.length, open.length, S.mode].join('|'); if (!cd.hidden && cd.dataset.k === key) return; cd.dataset.k = key;
    cd.innerHTML = `<div class="t2ch"><b>${esc(c.who || (c.role === 'teacher' ? 'Nastavnik' : 'Student'))}</b>${c.kind && KD[c.kind] ? `<span class="tag">${esc(KD[c.kind])}</span>` : ''}<span class="muted">${i >= 0 ? `${i + 1} od ${open.length}` : 'riješeno'}</span><span class="grow"></span><button class="ib" data-act="t2CardX" aria-label="Zatvori">✕</button></div><div class="t2cb"><p>${esc(c.text || '')}</p>${rep.slice(-2).map(r => `<p class="t2r"><b>${esc(r.who || '')}</b> ${esc(r.text || '')}</p>`).join('')}${rep.length > 2 ? `<p class="muted">Još ${rep.length - 2} ranijih odgovora u Komentarima.</p>` : ''}</div><div class="t2cf">${open.length > 1 ? '<button class="btn sm" data-act="t2CardGo" data-d="-1" aria-label="Prethodni komentar">‹</button><button class="btn sm" data-act="t2CardGo" data-d="1" aria-label="Sljedeći komentar">›</button>' : ''}<span class="grow"></span><button class="btn sm" data-act="t2CardOpen">Odgovori</button>${S.submitted ? '' : `<button class="btn sm pri" data-act="t2CardRes">${c.resolved ? 'Otvori ponovno' : 'Riješeno'}</button>`}</div>`;
    cd.hidden = false;
  }
  Object.assign(ACT, {
    t2CardX: () => { U.t2Card = false; cd.hidden = true; U.active = null; X.refresh(); },
    t2CardGo: el => { TB.cmGo(+el.dataset.d); U.t2Card = true; card(); },
    t2CardOpen: () => { U.t2Card = false; cd.hidden = true; X.showTab('cmt'); setTimeout(() => { const n = $(`[data-cid="${U.active}"]`); if (n) n.scrollIntoView({ block: 'nearest' }); }, 60); },
    t2CardRes: () => { ACT.cmResolve({ dataset: { id: U.active } }); cd.dataset.k = ''; setTimeout(card, 60); },
  });

  /* ---------- 4. navod u dva koraka ---------- */
  X.hooks.click.push(e => { const c = e.target.closest && e.target.closest('#ed .cite'); if (!c) return false;
    setTimeout(() => { const pad = $('#pop .pad'); if (!pad || pad.querySelector('.t2more') || T()) return; const parts = [...pad.querySelectorAll(':scope > .pfbox, :scope > .s2pop')]; if (!parts.length) return;
      const must = !!pad.querySelector('.s2pop .tag.warn, .s2pop [data-act="s2ReqGo"], .pfthumbs'), d = document.createElement('details'); d.className = 't2more'; d.open = must || !!U.t2CiteMore; d.innerHTML = '<summary>Potvrda iz izvora i citirano prema</summary>'; parts[0].before(d); parts.forEach(p => d.appendChild(p)); d.addEventListener('toggle', () => { U.t2CiteMore = d.open; }); }, 40);
    return false; });

  /* ---------- 6. „nije greška” skida crtu; 8. promjene unutar odlomka ---------- */
  const diffCache = new Map();
  function wdiff(a, b) { const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]); const ops = []; let i = 0, j = 0; while (i < n && j < m) { if (a[i] === b[j]) { ops.push([0, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { ops.push([-1, a[i], j]); i++; } else { ops.push([1, j]); j++; } } while (i < n) ops.push([-1, a[i++], m]); while (j < m) ops.push([1, j++]); return ops; }
  function inlineChanges(doc, decos) {
    const base = TB.base && TB.base(); if (!base || !base.length) return; const old = new Set(base), cur = new Set(); const blocks = [];
    doc.forEach((n, off) => { const t = n.textBetween(0, n.content.size, ' ', X.leafText).trim(); if (!t) return; const key = (n.type.name === 'heading' ? '# ' : '') + t; cur.add(key); if (!old.has(key)) blocks.push({ n, off, t }); });
    if (!blocks.length) return; const gone = base.filter(k => !cur.has(k)).map(k => ({ k, w: k.replace(/^# /, '').split(/\s+/) }));
    blocks.forEach(b => {
      if (!b.n.isTextblock) { decos.push(Deco.node(b.off, b.off + b.n.nodeSize, { class: 't2new' })); return; }
      const toks = []; b.n.forEach((ch, o) => { const p = b.off + 1 + o; if (ch.isText) { const re = /\S+/g; let m; while ((m = re.exec(ch.text))) toks.push({ w: m[0], a: p + m.index, b: p + m.index + m[0].length }); } else (X.leafText(ch) || '').split(/\s+/).filter(Boolean).forEach(w => toks.push({ w, a: p, b: p + ch.nodeSize, atom: true })); });
      const ws = toks.map(x => x.w), set = new Set(ws); let best = null, bs = 0; gone.forEach(g => { let c = 0; g.w.forEach(w => { if (set.has(w)) c++; }); const sc = c / Math.max(g.w.length, ws.length); if (sc > bs) { bs = sc; best = g; } });
      if (!best || bs < 0.45) { decos.push(Deco.node(b.off, b.off + b.n.nodeSize, { class: 't2new' })); return; }
      const ck = best.k + '\u0001' + ws.join(' '); let ops = diffCache.get(ck); if (!ops) { if (best.w.length * ws.length > 250000) return; ops = wdiff(best.w, ws); if (diffCache.size > 200) diffCache.clear(); diffCache.set(ck, ops); }
      let del = [], delAt = null; const flush = () => { if (!del.length) return; const txt = del.join(' '), at = delAt; decos.push(Deco.widget(at, () => { const s = document.createElement('del'); s.className = 't2del'; s.textContent = txt + ' '; s.contentEditable = 'false'; return s; }, { side: -1, key: 'd' + at + txt.length, ignoreSelection: true })); del = []; delAt = null; };
      let ra = null, rb = null; const flushAdd = () => { if (ra != null) decos.push(Deco.inline(ra, rb, { class: 't2add' })); ra = rb = null; };
      ops.forEach(o => { if (o[0] === -1) { flushAdd(); if (delAt == null) delAt = o[2] < toks.length ? toks[o[2]].a : b.off + b.n.nodeSize - 1; del.push(o[1]); } else { flush(); const tk = toks[o[1]]; if (o[0] === 1 && !tk.atom) { if (ra == null) ra = tk.a; rb = tk.b; } else flushAdd(); } }); flush(); flushAdd();
    });
  }
  X.hooks.end.push(({ doc, decos, d }) => {
    const off = S.hintOff || {};
    if (Object.keys(off).length) for (let i = decos.length - 1; i >= 0; i--) { const dc = decos[i], cls = dc.type && dc.type.attrs && dc.type.attrs.class; if (!cls || !/hint/.test(cls)) continue; let key, t; const size = doc.content.size;
      if (/hint-claim/.test(cls)) { key = 'claim'; t = doc.textBetween(dc.from, Math.min(size, dc.from + 60), ' ') + '…'; } else if (/hint-long/.test(cls)) { key = 'long'; t = doc.textBetween(dc.from, Math.min(size, dc.from + 60), ' ') + '…'; } else { const h = (d.hints || [])[+dc.type.attrs['data-h']]; if (!h) continue; key = h.kind; t = h.word || doc.textBetween(h.pos, Math.min(size, h.to || h.pos + 40), ' ').slice(0, 60); }
      if (off['kind:' + key] || off[key + '|' + t.slice(0, 40)]) decos.splice(i, 1); }
    if (U.tbOnly && !S.submitted) { try { inlineChanges(doc, decos); } catch (err) { /* usporedba nije uspjela; ostaje samo prigušivanje */ } }
  });
  const r2Off0 = ACT.r2Off; if (r2Off0) ACT.r2Off = el => { r2Off0(el); X.refresh(); }; ['r2OffClear', 'r2Kind'].forEach(a => { const f = ACT[a]; if (f) ACT[a] = el => { f(el); X.refresh(); }; });
  const only0 = ACT.tbOnly; ACT.tbOnly = el => { only0(el); X.refresh(); };

  /* ---------- 9. rub lista s oznakama; 11. procjena stranice ---------- */
  const gut = document.createElement('div'); gut.id = 't2gut'; gut.setAttribute('aria-hidden', 'true'); let gKey = '', gT = null;
  function gutter() {
    const sh = $('#sheet'); if (!sh || !ed()) return; if (gut.parentNode !== sh) { sh.appendChild(gut); }
    const on = innerWidth > 1050 && !$('#app').classList.contains('focus') && (S.t2gut !== false || S.t2pg); if (!on) { gut.innerHTML = ''; gKey = ''; return; }
    const v = ed().view, top0 = sh.getBoundingClientRect().top, items = [], y = pos => { try { return Math.round(v.coordsAtPos(Math.max(1, Math.min(pos, v.state.doc.content.size))).top - top0); } catch (e) { return null; } };
    if (S.t2gut !== false) {
      S.comments.forEach(c => { if (!c.resolved && !c.lost) items.push({ k: 'c', y: y(c.from), id: c.id, t: 'Komentar: ' + cut(c.text || '', 60) }); });
      if (!T()) D().holes.forEach(h => items.push({ k: 'h', y: y(h.pos), pos: h.pos, t: 'Za provjeru' }));
      if (T()) (S.mnotes || []).forEach(m => items.push({ k: 'n', y: y(m.from), pos: m.from, t: 'Privatna bilješka: ' + cut(m.text || '', 60) }));
      const ch = U.tbOnly && TB.changed ? TB.changed() || [] : []; ch.forEach(o => { const dom = v.nodeDOM(o); if (dom && dom.getBoundingClientRect) { const r = dom.getBoundingClientRect(); items.push({ k: 'x', y: Math.round(r.top - top0), h: Math.round(r.height), pos: o + 1, t: 'Izmijenjeno od prošlog slanja' }); } });
    }
    let pg = '';
    if (S.t2pg) { let w = 0, next = 350, n = 1; v.state.doc.forEach((node, o) => { const bw = X.wc(node.textContent); if (w + bw >= next && node.isTextblock) { n = Math.floor((w + bw) / 350) + 1; next = (n) * 350; const yy = y(o + 1); if (yy != null) pg += `<span class="t2pg" style="top:${yy}px" title="Procjena prema broju riječi. Točan broj stranice daje Word pri izvozu.">≈ str. ${n}</span>`; } w += bw; }); }
    const k = items.map(i => i.k + i.y + (i.id || i.pos) + (i.h || '')).join(',') + '|' + pg.length + '|' + U.active; if (k === gKey) return; gKey = k;
    const used = {}; gut.innerHTML = pg + items.filter(i => i.y != null).map(i => { if (i.k === 'x') return `<button class="t2g x" style="top:${i.y}px;height:${Math.max(8, i.h)}px" data-act="t2Go" data-pos="${i.pos}" title="${esc(i.t)}" tabindex="-1"></button>`; const slot = Math.round(i.y / 6); used[slot] = (used[slot] || 0) + 1; return `<button class="t2g ${i.k}${i.id && i.id === U.active ? ' on' : ''}" style="top:${i.y + 8}px;right:${14 + (used[slot] - 1) * 11}px" data-act="t2Go" ${i.id ? `data-id="${i.id}"` : `data-pos="${i.pos}"`} title="${esc(i.t)}" tabindex="-1"></button>`; }).join('');
  }
  const gutLater = () => { clearTimeout(gT); gT = setTimeout(gutter, 120); };
  X.hooks.paint.push(() => { gutLater(); card(); $('#ed').classList.toggle('clean', !!U.t2Clean && !T()); });
  addEventListener('resize', gutLater); if (document.fonts && document.fonts.ready) document.fonts.ready.then(gutLater);
  Object.assign(ACT, {
    t2Go: el => { if (el.dataset.id) { ACT.cmFocus({ dataset: { id: el.dataset.id } }); X.showTab('cmt'); } else { X.jump(+el.dataset.pos, false); } },
    t2Gut: () => { X.closePop(); S.t2gut = S.t2gut === false; persist(); gKey = ''; gutter(); }, t2Pg: () => { X.closePop(); S.t2pg = !S.t2pg; persist(); gKey = ''; gutter(); if (S.t2pg) toast('Brojevi stranica su procjena prema broju riječi. Točan broj daje Word.'); },
    /* 10 */
    t2Clean: () => { X.closePop(); U.t2Clean = !U.t2Clean; $('#ed').classList.toggle('clean', U.t2Clean); toast(U.t2Clean ? 'Savjeti su skriveni. Obvezno i komentari mentora ostaju. Ctrl+Alt+H ih vraća.' : 'Savjeti su opet vidljivi.'); },
    /* 1 */
    t2Legend: () => X.openDlg({ type: 't2legend' }),
  });
  X.hooks.dlg.t2legend = () => { const row = (cls, sample, name, what, who) => `<div class="fx t2lg"><span class="t2s"><span class="${cls}">${sample}</span></span><span style="flex:1"><b>${name}</b><span class="d">${what}</span></span><small>${who}</small></div>`;
    return `<h3>Što znače oznake u tekstu</h3><p class="muted">Klik na označeni tekst pokaže objašnjenje. Kad se na istom mjestu nađe više oznaka, Ductura ponudi popis.</p>
      <div class="ptitle">Obvezno prije predaje</div>${row('hole', '[?]', 'Za provjeru', 'Mjesto koje ste ostavili za poslije.', 'vidite Vi i mentor')}${row('plain-cite', '(Autor, 2020)', 'Navod upisan kao tekst', 'Nije povezan s izvorom u Vašem popisu.', 'vidite Vi i mentor')}
      <div class="ptitle">Od mentora</div>${row('cmt', 'označeni tekst', 'Komentar', 'Primjedba ili pitanje uz ovaj dio teksta.', 'vidite Vi i mentor')}${row('cite need-proof', '(Autor, 2020)', 'Zatražena potvrda', 'Mentor traži da uz navod priložite potvrdu iz izvora.', 'vidite Vi i mentor')}
      <div class="ptitle">Savjeti</div>${row('hint-claim', 'tvrdnja bez izvora', 'Savjet', 'Pojam, kratica, duga rečenica, tvrdnja bez izvora i slično. Ne priječe predaju i možete ih isključiti.', 'vidite samo Vi')}
      ${row('sp', 'pogrješka', 'Pravopis', 'Riječ koje nema u hrvatskom rječniku. Možete je ispraviti, dodati u svoj rječnik ili zanemariti.', 'vidite samo Vi')}${row('hl', 'označeno markerom', 'Marker', 'Vaše vlastito označavanje bojom. Ne ide u izvoz.', 'vidite samo Vi')}
      <div class="ptitle">Odakle je tekst</div>${row('paste', 'zalijepljeni tekst', 'Zalijepljeno', 'Tekst koji ste zalijepili izvana i još ga niste parafrazirali ni naveli izvor.', 'vidite Vi i mentor')}${row('aitext', 'tekst iz pomoćnika', 'Iz pomoćnika', 'Tekst prenesen iz pomoćnika u Ducturi.', 'vidite Vi i mentor')}
      <div class="ptitle">Pri pregledu promjena</div>${row('t2add', 'dodano', 'Dodano', 'Riječi kojih u prošloj poslanoj inačici nije bilo.', 'uz Samo promjene')}${row('t2del', 'obrisano', 'Obrisano', 'Riječi koje su bile u prošloj poslanoj inačici.', 'uz Samo promjene')}
      <div class="foot"><button class="btn" data-act="dlgClose">Zatvori</button></div>`; };

  /* =====================================================================
   * v0.20 po neovisnoj recenziji: nepovezan navod do kraja, rupa po vrsti posla, slanje mentoru, naslov u zaglavlju
   * ===================================================================== */
  X.hooks.defaults.push(s => { if (!s.holeN) s.holeN = {}; });
  const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const srcBtn = (act, s2, extra) => `<button class="mi" data-act="${act}" data-id="${esc(s2.id)}"${extra || ''}><span>${esc(s2.authors)} (${X.yearLabel(s2)})</span><small>${esc(cut(s2.title || '', 26))}</small></button>`;
  const rangeOf = el => { const a = ed().view.posAtDOM(el, 0); return { from: a, to: a + el.textContent.length }; };
  function linked(pos, id) {
    const s2 = X.srcById(id); setTimeout(() => { const d = ed().view.nodeDOM(pos), el = d && d.nodeType === 1 ? d : d && d.parentElement; if (!el || !s2) return; X.openPop(`<div class="pad"><p><b>Navod je povezan s izvorom</b></p><p class="q">${X.bibEntry(s2)}</p><p class="muted">Ovako će izvor stajati u popisu literature na kraju rada. Stranicu dodajete upisom :31 odmah iza navoda.</p><div class="row"><button class="btn sm" data-act="t2Bib" data-id="${esc(id)}">Pokaži u literaturi</button><button class="btn sm pri" data-act="t2Cont" data-pos="${pos + 1}">Nastavi pisati</button></div></div>`, el.getBoundingClientRect(), 'menu'); }, 80);
  }
  const putCite = (r, id, page) => { ed().chain().focus().insertContentAt({ from: r.from, to: r.to }, { type: 'citation', attrs: { sourceId: id, page: page || '' } }).setTextSelection(r.from + 1).run(); S.citeRecent = [id].concat((S.citeRecent || []).filter(x => x !== id)).slice(0, 3); persist(); X.renderAll(true); linked(r.from, id); };
  function plainPop(el) {
    const r = rangeOf(el), p = (D().plain || []).find(x => x.from === r.from) || { author: '', year: '', page: '', text: el.textContent }, sur = norm(p.author).split(/[\s,]+/).filter(w => w.length > 1 && !/^(i|et|al\.?|sur\.?)$/.test(w));
    const hit = S.sources.filter(s2 => String(s2.year).slice(0, 4) === p.year && sur.some(w => norm(s2.authors + ' ' + s2.full).includes(w))), rest = S.sources.filter(s2 => !hit.includes(s2));
    U.t2R = { from: r.from, to: r.to, page: p.page || '', author: p.author, year: p.year };
    X.openPop(`<div class="pad"><p><b>Navod nije povezan s izvorom</b></p><p class="muted">${esc(p.text)} je upisan kao običan tekst, pa ga nema u popisu literature i ne mijenja se sa stilom citiranja.</p></div>${hit.length ? `<div class="mh">Izvor iz Vašeg popisa koji odgovara</div>${hit.map(s2 => srcBtn('t2Link', s2)).join('')}` : '<div class="pad">U Vašem popisu nema izvora s tim autorom i godinom.</div>'}${mi('t2NewSrc', 'Dodaj novi izvor…', esc(p.author) + ', ' + esc(p.year))}${rest.length ? `<details class="t2more"><summary>Drugi izvor iz popisa (${rest.length})</summary>${rest.map(s2 => srcBtn('t2Link', s2)).join('')}</details>` : ''}`, el.getBoundingClientRect(), 'menu'); return true;
  }
  const hkey = pos => { const h = (D().holes || []).find(x => x.pos === pos); return h ? h.ctx : null; };
  function holePop(el) {
    const r = rangeOf(el), txt = el.textContent, src = /^\[(izvor|citat|stranica)/i.test(txt), k = hkey(r.from), n = (k && S.holeN[k]) || {}; U.t2R = { from: r.from, to: r.to, page: '', key: k }; $('#pop').dataset.pos = r.from;
    const nextB = (D().holes || []).length > 1 ? '<button class="lnk" data-act="holeNext">Sljedeće mjesto ›</button>' : '';
    if (src) { const near = []; ed().state.doc.nodesBetween(0, r.from, nd => { if (nd.type.name === 'citation') near.push(nd.attrs.sourceId); }); const rec = [...new Set((S.citeRecent || []).concat(near.reverse()))].map(id => S.sources.find(s2 => s2.id === id)).filter(Boolean).slice(0, 3), rest = S.sources.filter(s2 => !rec.includes(s2));
      X.openPop(`<div class="pad"><p><b>Ovdje nedostaje izvor</b></p><p class="muted">Odaberite izvor i oznaka ${esc(txt)} postaje navod. Kursor ostaje na istom mjestu.</p></div>${rec.length ? `<div class="mh">Zadnje korišteni</div>${rec.map(s2 => srcBtn('t2Link', s2)).join('')}` : ''}${mi('t2NewSrc', 'Dodaj novi izvor…', '')}${rest.length ? `<details class="t2more"${rec.length ? '' : ' open'}><summary>Svi izvori (${rest.length})</summary>${rest.map(s2 => srcBtn('t2Link', s2)).join('')}</details>` : ''}<div class="pad">${nextB}</div>`, el.getBoundingClientRect(), 'menu'); $('#pop').dataset.pos = r.from; return true; }
    X.openPop(`<div class="pad"><p><b>Za provjeru</b></p><p class="muted">Ostavili ste ovo mjesto za poslije. Dok oznaka stoji, rad se ne može predati.</p><label class="f">Što treba provjeriti</label><textarea class="ta" id="t2HN" rows="2" placeholder="npr. broj sati iz kurikuluma za 2. razred">${esc(n.note || '')}</textarea><label class="f">Gdje (poveznica ili naziv dokumenta)</label><input class="in" id="t2HL" value="${esc(n.link || '')}" placeholder="npr. https://… ili Kurikulum, str. 12">${n.link && /^https?:\/\//.test(n.link) ? `<p><a class="lnk" href="${esc(n.link)}" target="_blank" rel="noopener">Otvori poveznicu</a></p>` : ''}<div class="row" style="margin-top:8px"><button class="btn sm" data-act="t2HSave">Spremi bilješku</button><button class="btn sm pri" data-act="t2HDone">Provjereno, ukloni oznaku</button></div><div class="row" style="margin-top:6px"><button class="lnk" data-act="t2HSrc">Zapravo treba izvor</button>${nextB}</div></div>`, el.getBoundingClientRect(), 'menu'); $('#pop').dataset.pos = r.from; return true;
  }
  Object.assign(ACT, {
    t2Link: el => { const r = U.t2R; X.closePop(); if (r) putCite(r, el.dataset.id, r.page); },
    t2NewSrc: () => { const r = U.t2R; X.closePop(); if (!r) return; ACT.quick(); if (!U.dlg) return; U.dlg.t2 = r; if (r.author) { U.dlg.authors = r.author; U.dlg.year = r.year || ''; } X.renderDlg(); },
    t2Bib: el => { X.closePop(); const s2 = X.srcById(el.dataset.id), ps = [...document.querySelectorAll('#bib p')], t = s2 && ps.find(p => p.textContent.includes(s2.title) || p.textContent.includes(s2.full)); if (t) { t.scrollIntoView({ block: 'center' }); setTimeout(() => { const t2 = [...document.querySelectorAll('#bib p')].find(p => p.textContent === t.textContent); if (t2) t2.classList.add('tb-flash'); }, 250); toast('Ovo je zapis u popisu literature. Popis se slaže sam iz navoda u tekstu.'); } },
    t2Cont: el => { X.closePop(); ed().chain().focus().setTextSelection(+el.dataset.pos).scrollIntoView().run(); },
    t2HSave: () => { const r = U.t2R; if (!r || !r.key) return X.closePop(); S.holeN[r.key] = { note: $('#t2HN').value.trim(), link: $('#t2HL').value.trim() }; persist(); X.closePop(); toast('Bilješka je spremljena uz ovo mjesto.'); },
    t2HDone: () => { const r = U.t2R; X.closePop(); if (!r) return; if (r.key) delete S.holeN[r.key]; const doc = ed().state.doc, sp = r.from > 1 && doc.textBetween(r.from - 1, r.from) === ' ' && /^[.,;:]?$/.test(doc.textBetween(r.to, Math.min(doc.content.size, r.to + 1))); ed().chain().focus().deleteRange({ from: sp ? r.from - 1 : r.from, to: r.to }).run(); persist(); toast('Oznaka je uklonjena. Nastavite pisati na istom mjestu.'); },
    t2HSrc: () => { const r = U.t2R; X.closePop(); if (r) ed().chain().focus().insertContentAt({ from: r.from, to: r.to }, '[izvor]').run(); },
  });
  const qa0 = ACT.quickAdd; ACT.quickAdd = el => { const r = U.dlg && U.dlg.t2; if (!r) return qa0(el); const n0 = S.sources.length; qa0({ dataset: {} }); if (S.sources.length > n0) { putCite(r, S.sources[S.sources.length - 1].id, r.page); } };

  /* slanje mentoru: kome, što i da nije završna predaja */
  const send0 = X.hooks.dlg.send;
  if (send0) X.hooks.dlg.send = d => { const h = send0(d), r = S.review || {}, c = { h: D().holes.length, k: S.comments.filter(x => !x.resolved && !x.lost).length, p: D().plain.length }, wait = [c.h ? `${c.h} ${X.plural(c.h, 'mjesto za provjeru', 'mjesta za provjeru', 'mjesta za provjeru')}` : '', c.k ? `${c.k} ${X.plural(c.k, 'otvoren komentar', 'otvorena komentara', 'otvorenih komentara')}` : '', c.p ? `${c.p} ${X.plural(c.p, 'nepovezan navod', 'nepovezana navoda', 'nepovezanih navoda')}` : ''].filter(Boolean);
    const empty = D().heads.filter(x => x.level === 2 && !x.words).map(x => x.title);
    const info = `<div class="t2send"><div><span>Kome</span><b>Mentoru (Nastavnik A)</b></div><div><span>Što</span><b>Tekst kakav je sada: ${D().words} riječi, runda ${(r.round || 1) + 1}</b></div><div><span>Zašto</span><b>Pregled i povratna informacija. Ovo nije završna predaja.</b></div></div>${wait.length || empty.length ? `<p class="muted">Mentor će vidjeti i ovo: ${esc(wait.concat(empty.length ? ['prazno poglavlje: ' + empty.join(', ')] : []).join(' · '))}. To ne priječi slanje; u poruci možete napisati što još pišete.</p>` : ''}`;
    return h.replace('</h3>', '</h3>' + info).replace('Poruka mentoru (neobavezno): što ste promijenili i zašto', 'Poruka mentoru (neobavezno): na što želite komentar i što još pišete').replace('id="sendMsg" rows="3"', 'id="sendMsg" rows="3" placeholder="npr. Molim komentar na teorijski okvir. Analizu još pišem."'); };

  /* naslov rada u zaglavlju */
  let crumbK = ''; X.hooks.paint.push(() => { const c = $('.crumb'); if (!c) return; const h1 = D().heads.find(x => x.level === 1), t = (h1 && h1.title) || 'Rad bez naslova', k = t + '|' + X.TASK.course + '|' + X.TASK.title; if (k === crumbK) return; crumbK = k; c.innerHTML = `<b>${esc(t)}</b><i>prototip</i>`; c.title = `${X.TASK.course} / ${X.TASK.title}`; });

  X.hooks.key.push(e => { if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'h') { e.preventDefault(); if (!T()) ACT.t2Clean(); return true; } if (e.key === 'Escape' && !cd.hidden && !U.dlg && $('#pop').hidden) { ACT.t2CardX(); return true; } return false; });
  if (TB.CMD) TB.CMD().push(['Što znače oznake', 'legenda', 't2Legend', null, 'a', 1], ['Čisti tekst', 'sakrij ili prikaži savjete', 't2Clean', null, 'w'], ['Procjena stranica u rubu', 'uključi ili isključi', 't2Pg', null, 'a', 1], ['Rub lista s oznakama', 'uključi ili isključi', 't2Gut', null, 'a', 1]);
  if (TB.KEYS) TB.KEYS()[2][1].push(['Ctrl+Alt+H', 'Čisti tekst: sakrij ili prikaži savjete']);
})();
