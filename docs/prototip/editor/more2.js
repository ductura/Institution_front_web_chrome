/* Ductura Editor, prototip: sadržaj rada, drugi dio (v0.22).
 * 1 izbornik na desni klik · 2 numerirani popis, eksponent i indeks · 3 prijelom stranice · 4 popis kratica
 * 5 brojčano citiranje (IEEE, Vancouver; jezgra u app.js) · spojene ćelije i položena stranica su u rich.js
 */
(function () {
  'use strict';
  const X = window.DU, { S, U, ACT, esc, $, persist, toast } = X, ed = () => X.editor, D = () => X.D, T = () => S.mode === 'teacher', mi = X.fx.mi, TB = X.tb, AX = X.ai;
  X.hooks.defaults.push(s => { if (s.abbrOn === undefined) s.abbrOn = false; if (!s.abbrX) s.abbrX = {}; });
  const editable = () => !!ed() && ed().isEditable;

  /* ---------- 2. eksponent, indeks, numerirani popis ---------- */
  ['sup', 'sub'].forEach(n => X.hooks.ext.push(X.Mark.create({ name: n, excludes: n === 'sup' ? 'sub' : 'sup', parseHTML() { return [{ tag: n }]; }, renderHTML() { return [n, 0]; } })));
  Object.assign(ACT, {
    olist: () => { X.closePop(); ed().chain().focus().toggleOrderedList().run(); },
    m2Sup: () => { X.closePop(); if (ed().state.selection.empty) return toast('Označite znakove koje želite podići.'); ed().chain().focus().unsetMark('sub').toggleMark('sup').run(); },
    m2Sub: () => { X.closePop(); if (ed().state.selection.empty) return toast('Označite znakove koje želite spustiti.'); ed().chain().focus().unsetMark('sup').toggleMark('sub').run(); },
  });
  TB.TL.olist = ['Numerirani popis', '', 'Popis s brojevima', 23, 2]; TB.IC.olist = '<path d="M7 5h8M7 9h8M7 13h8"/><text x="3.6" y="6.7" text-anchor="middle" font-size="5.5" fill="currentColor" stroke="none">1</text><text x="3.6" y="10.7" text-anchor="middle" font-size="5.5" fill="currentColor" stroke="none">2</text><text x="3.6" y="14.7" text-anchor="middle" font-size="5.5" fill="currentColor" stroke="none">3</text>';
  TB.LEFT.w.splice(TB.LEFT.w.indexOf('list') + 1, 0, 'olist');

  /* ---------- 3. prijelom stranice ---------- */
  X.hooks.ext.push(X.Node.create({ name: 'pagebreak', group: 'block', atom: true, selectable: true, parseHTML() { return [{ tag: 'div[data-pb]' }]; }, renderHTML() { return ['div', { 'data-pb': '1', class: 'pb', contenteditable: 'false' }, ['span', {}, 'prijelom stranice']]; } }));
  ACT.m2Pb = () => { X.closePop(); if (!editable()) return; const $f = ed().state.selection.$from, pos = $f.depth >= 1 ? $f.after(1) : ed().state.doc.content.size; ed().chain().focus().insertContentAt(pos, [{ type: 'pagebreak' }, { type: 'paragraph' }]).setTextSelection(pos + 2).run(); toast('Sljedeći tekst u Wordu počinje na novoj stranici.'); };

  /* ---------- 4. popis kratica ---------- */
  const SMALL = /^(i|u|o|a|na|za|od|do|iz|s|sa|te|ili|of|the|and|for|in|de|la)$/i;
  function abbrs() {
    const doc = ed().state.doc; if (U.abDoc === doc && U.abX === JSON.stringify(S.abbrX)) return U.abL; const map = new Map(), re = /\((\p{Lu}[\p{Lu}\d]{1,8})\)/gu;
    doc.descendants(n => { if (!n.isTextblock) return true; const t = n.textContent; let m; re.lastIndex = 0; while ((m = re.exec(t))) { const ab = m[1]; if (map.has(ab) && map.get(ab)) continue; const ws = t.slice(0, m.index).trim().split(/\s+/).slice(-10); let full = '';
      for (let k = 2; k <= ws.length && !full; k++) { const part = ws.slice(-k), ini = part.filter(w => !SMALL.test(w)).map(w => w.replace(/^[„"(]+/, '')[0] || '').join('').toLocaleUpperCase('hr'); if (ini === ab.replace(/\d/g, '') && !SMALL.test(part[0])) full = part.join(' ').replace(/^[„"(]+/, '').replace(/[,;:]+$/, ''); }
      map.set(ab, full); } return false; });
    const l = [...map.entries()].map(([ab, full]) => ({ ab, full: S.abbrX[ab] || full, auto: !S.abbrX[ab] })).sort((a, b) => a.ab.localeCompare(b.ab, 'hr')); U.abDoc = doc; U.abX = JSON.stringify(S.abbrX); U.abL = l; return l;
  }
  const abBox = document.createElement('div'); abBox.id = 'abbrBox'; let abK = '';
  function abPaint() {
    const toc = $('#toc'); if (!toc) return; if (abBox.parentNode !== toc.parentNode || abBox.previousElementSibling !== toc) toc.after(abBox);
    if (!S.abbrOn || U.outline) { if (abK !== 'off') { abK = 'off'; abBox.innerHTML = ''; } return; }
    const l = abbrs(), ro = !editable(), k = JSON.stringify(l) + ro; if (k === abK) return; abK = k;
    abBox.innerHTML = `<div class="tocbox abx"><h4>Popis kratica</h4>${l.length ? l.map(a => `<div class="abr"><b>${esc(a.ab)}</b><span>${a.full ? esc(a.full) : '<i>puni naziv nije prepoznat</i>'}</span>${ro ? '' : `<button class="lnk" data-act="m2AbEdit" data-ab="${esc(a.ab)}">${a.full ? 'Uredi' : 'Upiši'}</button>`}</div>`).join('') : '<p class="tnote">U radu još nema kratica. Popis se slaže sam kad kraticu prvi put napišete uz puni naziv, na primjer: Europska unija (EU).</p>'}<p class="tnote">Složeno iz teksta rada. Ide u Word ispred literature.</p></div>`;
  }
  X.hooks.paint.push(abPaint);
  Object.assign(ACT, {
    m2Abbr: () => { X.closePop(); S.abbrOn = !S.abbrOn; persist(); abK = ''; abPaint(); if (S.abbrOn) { abBox.scrollIntoView({ block: 'center' }); toast('Popis kratica je na listu, ispod sadržaja.'); } },
    m2AbEdit: el => { const ab = el.dataset.ab, cur = (abbrs().find(a => a.ab === ab) || {}).full || ''; X.fx.ask({ title: 'Kratica ' + ab, label: 'Puni naziv', ph: 'npr. Europska unija', ok: 'Spremi' }, v => { if (v.trim()) S.abbrX[ab] = v.trim(); else delete S.abbrX[ab]; persist(); abK = ''; abPaint(); }); setTimeout(() => { const f = $('#askV'); if (f && !f.value) f.value = cur; }, 40); },
  });

  /* ---------- 5. stil citiranja (u prototipu se bira ovdje; inače ga zadaje profil fakulteta) ---------- */
  const CS = { fpzg: 'FPZG (autor, godina)', apa: 'APA', chicago: 'Chicago', ieee: 'IEEE [1]', vancouver: 'Vancouver [1]', fusnote: 'U fusnotama (pravo)' };
  ACT.m2Cite = el => { S.citeStyle = el.dataset.v; U.citeDirty = true; persist(); X.repaintCites(); X.refresh(); X.renderAll(true); X.renderDlg(); };
  X.more2 = {
    modsExtra: () => `<div class="ptitle">Stil citiranja</div><p class="muted">Stil zadaje profil fakulteta. U prototipu ga možete promijeniti da vidite razliku; brojčani stilovi služe tehničkim i medicinskim fakultetima.</p><div class="row">${Object.entries(CS).map(([k, l]) => `<button class="chip${S.citeStyle === k ? ' done' : ''}" data-act="m2Cite" data-v="${k}">${l}</button>`).join('')}</div>`,
    docxExtra: ({ p, run }) => { if (!S.abbrOn) return ''; const l = abbrs().filter(a => a.full); return l.length ? p(run('Popis kratica'), 'Heading1') + l.map(a => p(run(a.ab, { b: 1 }) + run('\t' + a.full), '', '<w:tabs><w:tab w:val="left" w:pos="1701"/></w:tabs><w:ind w:left="1701" w:hanging="1701"/><w:jc w:val="left"/>')).join('') : ''; },
    abbrs,
  };

  /* ---------- 1. izbornik na desni klik ---------- */
  const b = (act, label, hint, extra) => `<button class="mi" data-act="${act}"${extra || ''}><span>${label}</span><small>${hint || ''}</small></button>`;
  const pk = (pid, d, label, extra) => `<button class="mi" data-act="pkDo" data-do="${d}" data-pid="${esc(pid)}"${extra || ''}><span>${label}</span><small></small></button>`;
  Object.assign(ACT, {
    m2Copy: () => { X.closePop(); try { document.execCommand('copy'); toast('Kopirano.'); } catch (e) { toast('Kopirajte s Ctrl+C.'); } },
    m2Cut: () => { X.closePop(); try { ed().commands.focus(); document.execCommand('cut'); } catch (e) { toast('Izrežite s Ctrl+X.'); } },
    m2Paste: async () => { X.closePop(); try { const t = await navigator.clipboard.readText(); if (!t) return toast('Međuspremnik je prazan.'); ed().chain().focus().insertContent(t.replace(/\r/g, '').replace(/\n+/g, ' ')).run(); } catch (e) { toast('Preglednik ne dopušta lijepljenje iz izbornika. Upotrijebite Ctrl+V.'); } },
    m2SelAll: () => { X.closePop(); ed().chain().focus().selectAll().run(); },
  });
  function ctxMenu(e) {
    const t = e.target; if (!t.closest || !t.closest('#ed') || e.shiftKey || (e.pointerType && e.pointerType !== 'mouse')) return; if (S.submitted && !T()) return;
    e.preventDefault(); e.stopPropagation(); if (TB.hideBub) TB.hideBub();
    const kb = !e.clientX && !e.clientY, cc = kb ? ed().view.coordsAtPos(ed().state.selection.from) : null, at = { left: kb ? cc.left : e.clientX, right: kb ? cc.left : e.clientX, top: kb ? cc.top : e.clientY - 4, bottom: kb ? cc.bottom : e.clientY + 4 };
    const foot = '<div class="pad muted">Shift + desni klik otvara izbornik preglednika.</div>'; let h = '';
    const fig = t.closest('.prikaz');
    if (fig && fig._a) { if (!editable()) return X.openPop(`<div class="mh">${fig._a.kind === 'tablica' ? 'Tablica' : 'Slika'}</div>${T() ? b('comment', 'Komentar', 'uz označeni tekst') : ''}${foot}`, at, 'menu'); const pid = fig._a.pid, o = fig._a.opt || {}, c = t.closest('[data-r]');
      if (fig._a.kind === 'tablica') { if (c) fig._cur = { r: +c.dataset.r, c: +c.dataset.c }; const sp = (o.sp || {})[(fig._cur || { r: 0, c: 0 }).r + ',' + (fig._cur || { r: 0, c: 0 }).c];
        h = `<div class="mh">Tablica</div>${pk(pid, 'rowAdd', 'Dodaj redak ispod')}${pk(pid, 'colAdd', 'Dodaj stupac desno')}${pk(pid, 'rowDel', 'Ukloni ovaj redak')}${pk(pid, 'colDel', 'Ukloni ovaj stupac')}<div class="mh">Ćelija</div>${pk(pid, 'mR', 'Spoji s ćelijom desno')}${pk(pid, 'mD', 'Spoji s ćelijom ispod')}${sp ? pk(pid, 'split', 'Razdvoji') : ''}<button class="mi" data-act="menu-pkcell" data-pid="${esc(pid)}"><span>Boja ćelije</span><small>›</small></button><div class="mh">Izgled</div>${pk(pid, 'head', (o.head === false ? '' : '✓ ') + 'Prvi redak je zaglavlje')}${pk(pid, 'zebra', (o.zebra ? '✓ ' : '') + 'Pruge')}<button class="mi" data-act="menu-pkfill" data-pid="${esc(pid)}"><span>Boja zaglavlja</span><small>›</small></button>${pk(pid, 'land', (o.land ? '✓ ' : '') + 'Položena stranica u Wordu')}${X.acad ? X.acad.ctxTable(pid) : ''}${pk(pid, 'del', 'Ukloni tablicu')}`; }
      else h = `<div class="mh">Slika</div>${pk(pid, 'pick', fig._a.img ? 'Zamijeni sliku' : 'Odaberi sliku')}${fig._a.img ? pk(pid, 'crop', 'Izreži') + pk(pid, 'al', (o.al === 'l' ? '✓ ' : '') + 'Poravnaj lijevo', ' data-v="l"') + pk(pid, 'al', ((o.al || 'c') === 'c' ? '✓ ' : '') + 'Poravnaj u sredinu', ' data-v="c"') + pk(pid, 'al', (o.al === 'r' ? '✓ ' : '') + 'Poravnaj desno', ' data-v="r"') : ''}${pk(pid, 'land', (o.land ? '✓ ' : '') + 'Položena stranica u Wordu')}${pk(pid, 'del', 'Ukloni sliku')}`;
      return X.openPop(h + foot, at, 'menu'); }
    /* tekst: kursor ide na mjesto klika ako klik nije unutar označenog */
    const st = ed().state, sel0 = st.selection, hit = kb ? null : ed().view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (hit && (sel0.empty || hit.pos < sel0.from || hit.pos > sel0.to)) { try { ed().commands.setTextSelection(hit.pos); } catch (err) { /* izvan teksta */ } }
    const sel = ed().state.selection, has = !sel.empty, ls = X.t2 && X.t2.layers ? X.t2.layers(t) : [];
    /* što je na tom mjestu */
    const spL = ls.find(l => l.k === 'sp'), sp = spL && X.rich && X.rich.spAt ? X.rich.spAt(spL.el) : null;
    if (sp) h += `<div class="mh">Pravopis: ${esc(sp.w)}</div>${sp.sug.map(s2 => `<button class="mi" data-act="spRep" data-w="${esc(s2)}"><span><b>${esc(s2)}</b></span><small></small></button>`).join('') || '<div class="pad muted">Nema prijedloga.</div>'}${b('spAdd', 'Dodaj u moj rječnik', '', ' data-k="dictUser"')}${b('spAdd', 'Zanemari u ovom radu', '', ' data-k="dictDoc"')}`;
    const rest = ls.filter(l => l.k !== 'sp'); if (rest.length) { U.t2Els = rest; h += `<div class="mh">Na ovom mjestu</div>${rest.map((l, i) => `<button class="mi" data-act="menu-t2pick" data-i="${i}"><span>${esc(l.label)}</span><small>otvori</small></button>`).join('')}`; }
    if (T()) h += `<div class="mh">Pregled</div>${b('comment', 'Komentar', has ? 'uz označeni tekst' : 'označite tekst')}${b('c2Priv', 'Privatna bilješka', 'vidite je samo Vi')}${b('tReq', 'Zatraži potvrdu', 'uz navod')}${b('menu-tpl', 'Spremljeni komentari', '›')}${b('c2GenNew', 'Opći komentar', '')}${has ? b('m2Copy', 'Kopiraj', 'Ctrl+C') : ''}`;
    else if (has) { const ai = AX && AX.curSrc && AX.curSrc() && ['lekt', 'prij', 'pojam'].some(k => AX.allowed(k));
      h += `<div class="mh">Označeni tekst</div>${b('comment', 'Komentar ili pitanje mentoru', 'Ctrl+Alt+M')}${b('tbCiteEnd', 'Navod iza označenog', '')}${b('menu-hl', 'Marker', '›')}${ai ? b('menu-ai', 'Pomoćnik', '›') : ''}<div class="mh">Oblik</div>${b('bold', 'Podebljano', 'Ctrl+B')}${b('italic', 'Kurziv', 'Ctrl+I')}${b('m2Sup', 'Eksponent', 'x²')}${b('m2Sub', 'Indeks', 'H₂O')}<div class="mh">Premjesti</div>${b('tbSel', 'U blok-citat', '', ' data-v="toQuote"')}${b('tbSel', 'U fusnotu', '', ' data-v="toFn"')}${b('tbSel', 'Odloži', '', ' data-v="stash"')}${b('m2Cut', 'Izreži', 'Ctrl+X')}${b('m2Copy', 'Kopiraj', 'Ctrl+C')}${X.acad ? X.acad.ctxSel() : ''}`; }
    else { const c = TB.ctx && TB.ctx();
      h += `<div class="mh">Ovdje</div>${b('cite', 'Navod', '@')}${b('tbHole', 'Za provjeru', 'vratite se poslije')}${b('menu-ins', 'Umetni', '›')}${b('menu-chars', 'Posebni znak', '›')}${b('m2Paste', 'Zalijepi', 'Ctrl+V')}<div class="mh">Odlomak</div>${c ? b('menu-ctx', c.l.replace(' ▾', ''), '›') : ''}${b('list', 'Popis s natuknicama', '')}${b('olist', 'Numerirani popis', '')}${b('quote', 'Blok-citat', '')}${b('tbMarkAdd', 'Označi ovaj odlomak', 'za povratak')}${b('m2Pb', 'Prijelom stranice ispod', '')}${b('m2SelAll', 'Označi sve', 'Ctrl+A')}`; }
    X.openPop(h + foot, at, 'menu');
  }
  document.addEventListener('contextmenu', ctxMenu, true);

  /* izbornici, paleta, prečaci */
  const ins0 = X.rich.insItems; X.rich.insItems = () => ins0() + mi('m2Pb', 'Prijelom stranice', 'novi list u Wordu') + mi('m2Abbr', 'Popis kratica', S.abbrOn ? '✓' : 'slaže se sam');
  if (TB.CMD) TB.CMD().push(['Numerirani popis', '', 'olist', null, 'w'], ['Eksponent', 'označeni znakovi', 'm2Sup', null, 'w'], ['Indeks', 'označeni znakovi', 'm2Sub', null, 'w'], ['Prijelom stranice', 'novi list u Wordu', 'm2Pb', null, 'w'], ['Popis kratica', 'uključi ili isključi', 'm2Abbr', null, 'w'], ['Stil citiranja', 'u Dodacima editora', 'rMods', null, 'w']);
  if (TB.KEYS) TB.KEYS()[1][1].push(['desni klik', 'Izbornik za mjesto na kojem je pokazivač'], ['Shift+F10', 'Isti izbornik s tipkovnice']);
})();
