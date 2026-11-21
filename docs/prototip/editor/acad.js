/* Ductura Editor, prototip: ono što akademski rad traži, a editor još nije imao (v0.24).
 * 1 tablica zalijepljena iz Excela ili Worda · 2 sadržaj i popisi s brojevima stranica (list i Word) · 3 poveznice · 4 tipografija dok se tipka
 * 5 (uvoz BibTeX i RIS postoji od ranije) · 6 izjava, zahvala, životopis · 7 strani jezik u tekstu · 8 navodi u fusnotama (ibid., nav. dj.)
 * 9 formule u Wordovu obliku (OMML) · 10 grafikon iz tablice · 11 kemijske formule (mhchem) · 12 sinonimi (pomoćnik) · 13 bilješke na kraju rada
 * 14 kazalo pojmova · 15 rimski brojevi uvodnih stranica
 */
(function () {
  'use strict';
  const X = window.DU, { S, U, ACT, esc, $, persist, toast } = X, ed = () => X.editor, D = () => X.D, T = () => S.mode === 'teacher', mi = X.fx.mi, TB = X.tb, AX = X.ai;
  X.hooks.defaults.push(s => { if (s.typo === undefined) s.typo = true; if (!s.fm) s.fm = { izjava: { on: false, text: '' }, zahvala: { on: false, text: '' }, cv: { on: false, text: '' } }; if (s.fmRoman === undefined) s.fmRoman = false; if (s.notesEnd === undefined) s.notesEnd = false; if (s.idxOn === undefined) s.idxOn = false; if (s.ai2 && s.ai2.on && s.ai2.on.sin === undefined) s.ai2.on.sin = !!s.ai2.l2; });
  const editable = () => !!ed() && ed().isEditable, xe = t => String(t == null ? '' : t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const pgOn = () => !!(X.pg && X.pg.on()), pageOf = pos => 1 + (U.pgBreaks || []).filter(b => b.pos <= pos).length;
  const domPage = el => { if (!el || !pgOn()) return null; const y = el.getBoundingClientRect().top; return 1 + [...document.querySelectorAll('#sheet .pgb:not(.fm)')].filter(g => g.getBoundingClientRect().top < y).length; };
  const b = (act, label, hint, extra) => `<button class="mi" data-act="${act}"${extra || ''}><span>${label}</span><small>${hint || ''}</small></button>`;

  /* ---------- 1. tablica iz Excela ili Worda ---------- */
  const paste0 = X.hooks.paste;
  X.hooks.paste = (v, e) => {
    const cd = e.clipboardData; if (cd && editable()) { const html = cd.getData('text/html') || '', txt = (cd.getData('text/plain') || '').replace(/\r/g, ''); let rows = null;
      if (/<table[\s>]/i.test(html)) { try { const t = new DOMParser().parseFromString(html, 'text/html').querySelector('table'); if (t) rows = [...t.rows].map(tr => { const out = []; [...tr.cells].forEach(c => { out.push(c.textContent.replace(/\s+/g, ' ').trim()); for (let i = 1; i < (c.colSpan || 1); i++) out.push(''); }); return out; }); } catch (err) { rows = null; } }
      else { const ls = txt.split('\n').filter(l => l.length); if (ls.length >= 2 && ls.every(l => l.includes('\t'))) rows = ls.map(l => l.split('\t').map(c => c.trim())); }
      if (rows) { rows = rows.filter(r => r.some(c => c)); const C = Math.max(0, ...rows.map(r => r.length)); if (rows.length >= 1 && C >= 2 && rows.length * C <= 3000) { rows = rows.map(r => r.concat(new Array(C - r.length).fill('')));
        const $f = ed().state.selection.$from, pos = $f.depth >= 1 ? $f.after(1) : ed().state.doc.content.size; ed().chain().focus().insertContentAt(pos, { type: 'prikaz', attrs: { kind: 'tablica', title: '', source: '', rows, img: '', opt: {} } }).run(); toast(`Zalijepljena je tablica: ${rows.length} ${X.plural(rows.length, 'redak', 'retka', 'redaka')}, ${C} ${X.plural(C, 'stupac', 'stupca', 'stupaca')}. Upišite naslov i izvor.`); return true; } } }
    return paste0 ? paste0(v, e) : false;
  };

  /* ---------- 4. tipografija dok se tipka ---------- */
  X.hooks.tx.push(tr => {
    if (!S.typo || !tr.docChanged || tr.getMeta('typo') || !editable() || tr.steps.length !== 1) return; const sel = ed().state.selection; if (!sel.empty) return; const $f = sel.$from; if (!$f.parent.isTextblock || $f.parent.type.name === 'codeBlock') return;
    let one = false; tr.steps[0].getMap().forEach((a, b2, c, d) => { if (d - c === 1 && b2 - a === 0) one = true; }); if (!one) return;
    const bef = $f.parent.textBetween(Math.max(0, $f.parentOffset - 4), $f.parentOffset, null, '￼'); let rep = null, len = 0;
    if (bef.endsWith('"')) { const pv = bef.slice(-2, -1); rep = !pv || /[\s(\[„‚]/.test(pv) ? '„' : '”'; len = 1; } else if (/\s-\s$/.test(bef)) { rep = ' – '; len = 3; } else if (bef.endsWith('...')) { rep = '…'; len = 3; }
    if (!rep) return; const tail = bef.slice(-len), at = sel.from;
    /* zamjena ide po položaju znaka, ne po kursoru, pa radi i kad se tipka brzo */
    (U.tyQ = U.tyQ || []).push({ at, len, tail, rep }); if (U.tyT) return; U.tyT = setTimeout(() => { U.tyT = null; const q = U.tyQ; U.tyQ = []; const st = ed().state; let tr2 = st.tr, shift = 0; q.forEach(x => { const a = x.at - x.len + shift, e = x.at + shift; if (a >= 0 && e <= tr2.doc.content.size && tr2.doc.textBetween(a, e) === x.tail) { tr2 = tr2.insertText(x.rep, a, e); shift += x.rep.length - x.len; } }); if (tr2.docChanged) ed().view.dispatch(tr2.setMeta('typo', 1)); }, 0);
  });
  ACT.acTypo = () => { X.closePop(); S.typo = !S.typo; persist(); toast(S.typo ? 'Navodnici, crtica i tri točke ispravljaju se dok tipkate. Ctrl+Z vraća upisani znak.' : 'Automatska tipografija je isključena.'); };

  /* ---------- 3. poveznice ---------- */
  Object.assign(ACT, {
    acLink: () => { X.closePop(); if (!editable()) return; const s = ed().state.selection, cur = ed().getAttributes('link').href || ''; if (s.empty && !cur) return toast('Označite tekst koji postaje poveznica.');
      X.fx.ask({ title: 'Poveznica', label: 'Adresa', ph: 'https://…', ok: 'Spremi' }, v => { v = v.trim(); if (!v) return ed().chain().focus().extendMarkRange('link').unsetLink().run(); if (!/^(https?:\/\/|mailto:)/i.test(v)) v = 'https://' + v; ed().chain().focus().extendMarkRange('link').setLink({ href: v }).run(); }); setTimeout(() => { const f = $('#askV'); if (f && cur) f.value = cur; }, 40); },
    acLinkDel: () => { X.closePop(); ed().chain().focus().extendMarkRange('link').unsetLink().run(); },
  });
  if (X.t2) { X.t2.KINDS.push(['link', 'a.lnk2', 0, el => 'Poveznica ' + (el.getAttribute('href') || '').replace(/^https?:\/\//, '').slice(0, 30)]);
    X.t2.OWN.link = l => { const h = l.el.getAttribute('href') || ''; try { const p = ed().view.posAtDOM(l.el, 0); ed().commands.setTextSelection(p + 1); } catch (e) { /* ostaje odabir */ } X.openPop(`<div class="pad"><p><b>Poveznica</b></p><p class="q" style="word-break:break-all">${esc(h)}</p><div class="row"><a class="btn sm" href="${esc(h)}" target="_blank" rel="noopener">Otvori</a>${editable() ? '<button class="btn sm" data-act="acLink">Uredi</button><button class="lnk" data-act="acLinkDel">Ukloni poveznicu</button>' : ''}</div></div>`, l.el.getBoundingClientRect(), 'menu'); return true; }; }
  $('#ed').addEventListener('click', e => { if (e.target.closest && e.target.closest('a.lnk2')) e.preventDefault(); });

  /* ---------- 7. strani jezik ---------- */
  const LG = { en: 'engleski', de: 'njemački', fr: 'francuski', it: 'talijanski', la: 'latinski', xx: 'drugi jezik' };
  X.hooks.ext.push(X.Mark.create({ name: 'lang', addAttributes() { return { l: { default: 'en', parseHTML: el => el.getAttribute('data-l') || 'en', renderHTML: a => ({ 'data-l': a.l, lang: a.l === 'xx' ? null : a.l }) } }; }, parseHTML() { return [{ tag: 'span[data-l]' }]; }, renderHTML({ HTMLAttributes }) { return ['span', Object.assign({ class: 'fl' }, HTMLAttributes), 0]; } }));
  ACT['menu-lang'] = el => { if (TB.hideBub) TB.hideBub(); TB.pop(el, `<div class="mh">Strani jezik</div>${Object.entries(LG).map(([k, l]) => b('acLang', l, '', ` data-l="${k}"`)).join('')}${b('acLang', 'Ukloni oznaku', '', ' data-l=""')}<div class="pad muted">Označeni tekst ide u kurziv i pravopis ga ne podcrtava.</div>`); };
  ACT.acLang = el => { X.closePop(); if (ed().state.selection.empty) return toast('Označite riječi na stranom jeziku.'); const l = el.dataset.l; if (l) ed().chain().focus().setMark('lang', { l }).run(); else ed().chain().focus().unsetMark('lang').run(); };

  /* ---------- 8. navodi u fusnotama ---------- */
  const fnStyle = () => S.citeStyle === 'fusnote', strip = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
  let seq = { last: null, seen: new Set() };
  const fnNote = (a, st) => { st = st || seq; const s = X.srcById(a.sourceId), pg = a.page ? `, str. ${a.page}` : ''; if (!s) return 'Izvor nije u popisu.'; let t; if (st.last === s.id) t = 'Ibid.' + pg; else if (st.seen.has(s.id)) t = `${s.authors}, nav. dj.${pg}`; else t = strip(X.bibEntry(s)).replace(/\.\s*$/, '') + pg; st.last = s.id; st.seen.add(s.id); return (a.via ? `${a.via}, cit. prema: ` : '') + t.replace(/\.$/, '') + '.'; };
  let fnK = '';
  function fnPaint() {
    const edEl = $('#ed'), on = fnStyle(); edEl.classList.toggle('cfn', on); if (!on) { if (fnK) { fnK = ''; edEl.querySelectorAll('.cite[data-n]').forEach(c => c.removeAttribute('data-n')); X.renderAll(); } return; }
    let n = 0; edEl.querySelectorAll('.ProseMirror .cite, .ProseMirror .fn').forEach(el => { n++; if (el.classList.contains('fn')) { if (el.textContent !== String(n)) el.textContent = n; } else if (el.dataset.n !== String(n)) el.dataset.n = n; });
    const st = { last: null, seen: new Set() }, notes = []; ed().state.doc.descendants(node => { if (node.type.name === 'citation') notes.push(fnNote(node.attrs, st)); else if (node.type.name === 'footnote') { st.last = null; notes.push(node.attrs.text || 'prazna fusnota'); } return true; });
    const k = notes.join('\u0001'), box = $('#fnlist'); if (k === fnK && box.querySelector('.fnl.c8')) return; fnK = k; box.innerHTML = notes.length ? `<div class="fnl c8">${notes.map((t, i) => `<p><sup>${i + 1}</sup> ${esc(t)}</p>`).join('')}</div>` : '';
  }

  /* ---------- 6, 13, 14, 15. dijelovi rada ---------- */
  const izjTpl = () => { const c = X.pg ? X.pg.cov() : { title: '', kind: 'rad', student: '', place: 'Zagreb', date: '' }; return `Izjavljujem da sam ${String(c.kind).toLowerCase()} pod naslovom „${c.title}” izradio/la samostalno, služeći se navedenom literaturom i uz stručno vodstvo mentora. Svi dijelovi rada koji su preuzeti iz drugih izvora, doslovno ili prepričani, označeni su navodom izvora.\n\n${c.place}, ${c.date}\n\n${c.student}`; };
  const FM = { izjava: ['Izjava o izvornosti', 'ispred sadržaja', izjTpl], zahvala: ['Zahvala', 'ispred sadržaja', () => ''], cv: ['Životopis', 'na kraju rada', () => ''] };
  const fmText = k => (S.fm[k].text || '').trim() || FM[k][2]();
  const paras = t => String(t).split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
  const fmEls = {}; ['izjava', 'zahvala'].forEach(k => { const e = document.createElement('div'); e.className = 'fmp'; e.id = 'fm-' + k; fmEls[k] = e; });
  const cvTail = document.createElement('div'); cvTail.id = 'cvTail'; const idxTail = document.createElement('div'); idxTail.id = 'idxTail';
  X.pgFront = () => ['izjava', 'zahvala'].filter(k => S.fm[k].on && fmEls[k].parentNode).map(k => fmEls[k]);
  function index() { const g = (S.glossary || []).filter(x => x.term); if (!g.length) return []; const hits = g.map(x => ({ term: x.term, keys: [x.term].concat(x.variants || []).map(t => t.toLocaleLowerCase('hr')).map(t => (t.length > 5 ? t.slice(0, t.length - 2) : t)), pages: new Set() }));
    ed().state.doc.descendants((n, pos) => { if (!n.isTextblock) return true; const t = n.textContent.toLocaleLowerCase('hr'); hits.forEach(h => h.keys.forEach(k => { let i = t.indexOf(k); while (i >= 0) { h.pages.add(pgOn() ? pageOf(pos + 1 + i) : 0); i = t.indexOf(k, i + k.length); } })); return false; });
    return hits.filter(h => h.pages.size).sort((a, c) => a.term.localeCompare(c.term, 'hr')).map(h => ({ term: h.term, pages: [...h.pages].filter(Boolean).sort((a, c) => a - c) })); }
  let fmK = '';
  function fmPaint() {
    const sh = $('#sheet'), toc = $('#toc'), abs = $('#absBox'); if (!sh || !toc || !ed()) return; const on = pgOn();
    ['izjava', 'zahvala'].forEach(k => { const e = fmEls[k]; if (S.fm[k].on) { if (e.parentNode !== sh) sh.insertBefore(e, toc); const h = `<h2>${FM[k][0]}</h2>${paras(fmText(k)).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') || '<p class="tnote">Tekst još nije upisan.</p>'}${editable() ? '<p class="tnote"><button class="lnk" data-act="acParts">Uredi u Dijelovima rada</button></p>' : ''}`; if (e.dataset.k !== h) { e.dataset.k = h; e.innerHTML = h; } } else if (e.parentNode) e.remove(); });
    if (abs) { if (idxTail.parentNode !== sh) abs.after(idxTail); if (cvTail.parentNode !== sh) idxTail.after(cvTail); }
    const ix = S.idxOn ? index() : null, ih = ix ? `<h2>Kazalo pojmova</h2>${ix.length ? ix.map(x => `<p class="ixr"><span>${esc(x.term)}</span><i>${x.pages.join(', ')}</i></p>`).join('') : '<p class="tnote">Kazalo se slaže iz pojmovnika. Dodajte pojmove u pojmovnik pa će se ovdje pojaviti sa stranicama.</p>'}` : '';
    const ch = S.fm.cv.on ? `<h2>Životopis</h2>${paras(fmText('cv')).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') || '<p class="tnote">Tekst još nije upisan.</p>'}` : '';
    const k = ih + '\u0001' + ch; if (k !== fmK) { fmK = k; idxTail.innerHTML = ih; cvTail.innerHTML = ch; }
  }
  X.pgTocNums = () => { const on = pgOn(); document.querySelectorAll('#toc .tocl').forEach(el => { let n = ''; if (on) { if (el.dataset.act === 'jump' && el.dataset.pos) n = pageOf(+el.dataset.pos); else if (el.dataset.act === 'jumpBib') n = domPage($('#bib')) || ''; } let i = el.querySelector('.tpn'); if (!n) { if (i) i.remove(); return; } if (!i) { i = document.createElement('i'); i.className = 'tpn'; el.appendChild(i); } if (i.textContent !== String(n)) i.textContent = n; }); };
  X.hooks.paint.push(() => { fmPaint(); fnPaint(); X.pgTocNums(); });
  ACT.acParts = () => X.openDlg({ type: 'acparts' });
  ACT.acPartsOk = () => { persist(); X.closeDlg(); fmK = ''; X.renderAll(true); if (X.pg) X.pg.paginate(); };
  X.hooks.dlg.acparts = () => { const sw = (bind, on, l, d) => `<label class="check"><input type="checkbox" data-bind="${bind}" data-rerender="dlg"${on ? ' checked' : ''}><span><b>${l}</b>${d ? ` <span class="muted">${d}</span>` : ''}</span></label>`;
    return `<h3>Dijelovi rada</h3><p class="muted">Uključite dijelove koje Vaš fakultet traži. Pojavljuju se na listu i u Wordu, na mjestu koje im pripada.</p>
      <div class="ptitle">Ispred teksta</div><p class="muted">Naslovnica i sadržaj su uvijek uključeni.</p>${['izjava', 'zahvala'].map(k => sw(`S.fm.${k}.on`, S.fm[k].on, FM[k][0], '') + (S.fm[k].on ? `<textarea class="ta" rows="${k === 'izjava' ? 6 : 3}" data-bind="S.fm.${k}.text" placeholder="${esc(FM[k][2]() || 'Tekst zahvale')}">${esc(S.fm[k].text || '')}</textarea>${k === 'izjava' ? '<p class="muted">Ako ostavite prazno, koristi se opći tekst prikazan u polju. Fakulteti često propisuju vlastiti tekst izjave; prepišite ga ovamo.</p>' : ''}` : '')).join('')}${sw('S.abbrOn', S.abbrOn, 'Popis kratica', 'slaže se sam iz teksta')}${sw('S.fmRoman', S.fmRoman, 'Rimski brojevi na uvodnim stranicama', 'i, ii, iii do početka teksta')}
      <div class="ptitle">Iza teksta</div>${sw('S.notesEnd', S.notesEnd, 'Bilješke na kraju rada', 'umjesto fusnota na dnu stranice, u Wordu')}${sw('S.idxOn', S.idxOn, 'Kazalo pojmova', 'iz pojmovnika, sa stranicama')}${sw('S.fm.cv.on', S.fm.cv.on, 'Životopis', '')}${S.fm.cv.on ? `<textarea class="ta" rows="4" data-bind="S.fm.cv.text" placeholder="Kratak životopis u trećem licu">${esc(S.fm.cv.text || '')}</textarea>` : ''}
      <div class="foot"><button class="btn pri" data-act="acPartsOk">Gotovo</button></div>`; };

  /* ---------- 9. formule u Wordovu obliku ---------- */
  const NARY = '∑∏∫∮⋃⋂';
  function omml(tex) {
    try { if (!window.katex) return ''; const ml = window.katex.renderToString(tex, { output: 'mathml', throwOnError: true }), doc = new DOMParser().parseFromString(ml, 'text/html'), m = doc.querySelector('math'); if (!m) return '';
      const r = t => (t ? `<m:r><m:t xml:space="preserve">${xe(t)}</m:t></m:r>` : ''), kids = n => [...n.children].filter(c => c.localName !== 'annotation').map(go).join(''), arg = n => (n ? go(n) : '');
      function go(n) { const c = [...n.children], t = n.localName;
        if (t === 'mi' || t === 'mn' || t === 'mo' || t === 'mtext' || t === 'ms') return r(n.textContent);
        if (t === 'mfrac') return `<m:f><m:num>${arg(c[0])}</m:num><m:den>${arg(c[1])}</m:den></m:f>`;
        if (t === 'msup') return `<m:sSup><m:e>${arg(c[0])}</m:e><m:sup>${arg(c[1])}</m:sup></m:sSup>`;
        if (t === 'msub') return `<m:sSub><m:e>${arg(c[0])}</m:e><m:sub>${arg(c[1])}</m:sub></m:sSub>`;
        if (t === 'msubsup' || t === 'munderover') { const op = c[0] ? c[0].textContent.trim() : ''; if (op.length === 1 && NARY.includes(op)) return `<m:nary><m:naryPr><m:chr m:val="${xe(op)}"/><m:limLoc m:val="${t === 'munderover' ? 'undOvr' : 'subSup'}"/></m:naryPr><m:sub>${arg(c[1])}</m:sub><m:sup>${arg(c[2])}</m:sup><m:e></m:e></m:nary>`; return `<m:sSubSup><m:e>${arg(c[0])}</m:e><m:sub>${arg(c[1])}</m:sub><m:sup>${arg(c[2])}</m:sup></m:sSubSup>`; }
        if (t === 'munder') { const op = c[0] ? c[0].textContent.trim() : ''; if (op.length === 1 && NARY.includes(op)) return `<m:nary><m:naryPr><m:chr m:val="${xe(op)}"/><m:limLoc m:val="undOvr"/><m:supHide m:val="1"/></m:naryPr><m:sub>${arg(c[1])}</m:sub><m:sup></m:sup><m:e></m:e></m:nary>`; return `<m:limLow><m:e>${arg(c[0])}</m:e><m:lim>${arg(c[1])}</m:lim></m:limLow>`; }
        if (t === 'mover') { const a = c[1] ? c[1].textContent.trim() : ''; if (a.length === 1 && !/[\p{L}\d]/u.test(a)) return `<m:acc><m:accPr><m:chr m:val="${xe(a === '¯' || a === '‾' ? '̅' : a === '^' ? '̂' : a === '~' ? '̃' : a === '→' ? '⃗' : a)}"/></m:accPr><m:e>${arg(c[0])}</m:e></m:acc>`; return `<m:limUpp><m:e>${arg(c[0])}</m:e><m:lim>${arg(c[1])}</m:lim></m:limUpp>`; }
        if (t === 'msqrt') return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg></m:deg><m:e>${kids(n)}</m:e></m:rad>`;
        if (t === 'mroot') return `<m:rad><m:deg>${arg(c[1])}</m:deg><m:e>${arg(c[0])}</m:e></m:rad>`;
        if (t === 'mtable') return `<m:m>${c.map(tr => `<m:mr>${[...tr.children].map(td => `<m:e>${kids(td)}</m:e>`).join('')}</m:mr>`).join('')}</m:m>`;
        if (t === 'mspace' || t === 'annotation' || t === 'mphantom') return '';
        return kids(n); }
      const out = go(m); return out ? `<m:oMath>${out}</m:oMath>` : ''; } catch (e) { return ''; }
  }

  /* ---------- 10. grafikon iz tablice ---------- */
  const numOf = c => { const v = parseFloat(String(c).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(v) ? v : null; };
  ACT.acChart = el => { X.closePop(); const pid = el.dataset.pid, type = el.dataset.t, h = X.rich.findPk(pid); if (!h || !editable()) return; const a = h.n.attrs, rows = a.rows || [], head = (a.opt || {}).head !== false, hdr = head ? rows[0] : rows[0].map((_, i) => 'Stupac ' + (i + 1)), body = head ? rows.slice(1) : rows;
    const cols = []; for (let j = 1; j < hdr.length; j++) { const vals = body.map(r => numOf(r[j])); if (vals.filter(v => v != null).length >= Math.max(1, Math.ceil(body.length / 2))) cols.push({ name: hdr[j] || 'Niz ' + j, vals: vals.map(v => v || 0) }); }
    if (!cols.length || !body.length) return toast('Za grafikon treba tablica s nazivima u prvom stupcu i brojkama u ostalima.');
    const W = 1200, H = 700, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), L = 90, R = 30, Tp = 40, B = 110, pw = W - L - R, ph = H - Tp - B, labs = body.map(r => r[0] || ''), max0 = Math.max(...cols.flatMap(c => c.vals), 0), min0 = Math.min(...cols.flatMap(c => c.vals), 0);
    const step = (() => { const raw = (max0 - min0 || 1) / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; })(), top = Math.ceil(max0 / step) * step || step, bot = Math.floor(min0 / step) * step, y = v => Tp + ph - (v - bot) / (top - bot) * ph, COL = ['#2f5d8a', '#c26a2d', '#5a8f5a', '#8b5a9e', '#7a7a7a', '#b8a03a'];
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.font = '28px "Times New Roman", serif'; g.textBaseline = 'middle'; g.strokeStyle = '#d9d9d9'; g.fillStyle = '#333'; g.lineWidth = 1;
    for (let v = bot; v <= top + step / 1000; v += step) { const yy = Math.round(y(v)) + 0.5; g.beginPath(); g.moveTo(L, yy); g.lineTo(W - R, yy); g.stroke(); g.textAlign = 'right'; g.fillText(String(Math.round(v * 1000) / 1000).replace('.', ','), L - 12, yy); }
    g.strokeStyle = '#333'; g.beginPath(); g.moveTo(L + 0.5, Tp); g.lineTo(L + 0.5, Tp + ph); g.lineTo(W - R, Tp + ph + 0.5); g.stroke();
    const gw = pw / labs.length; g.textAlign = 'center';
    labs.forEach((l, i) => { const cx = L + gw * (i + 0.5); g.fillStyle = '#333'; const t = l.length > 16 ? l.slice(0, 15) + '…' : l; g.fillText(t, cx, Tp + ph + 26); });
    if (type === 'line') cols.forEach((c, k) => { g.strokeStyle = g.fillStyle = COL[k % COL.length]; g.lineWidth = 3; g.beginPath(); c.vals.forEach((v, i) => { const cx = L + gw * (i + 0.5); if (i) g.lineTo(cx, y(v)); else g.moveTo(cx, y(v)); }); g.stroke(); c.vals.forEach((v, i) => { g.beginPath(); g.arc(L + gw * (i + 0.5), y(v), 6, 0, Math.PI * 2); g.fill(); }); });
    else { const bw = Math.min(90, gw * 0.8 / cols.length); cols.forEach((c, k) => { g.fillStyle = COL[k % COL.length]; c.vals.forEach((v, i) => { const x0 = L + gw * (i + 0.5) - bw * cols.length / 2 + bw * k, y0 = y(Math.max(v, 0)), y1 = y(Math.min(v, 0)); g.fillRect(x0 + 2, y0, bw - 4, Math.max(1, y1 - y0)); }); }); }
    let lx = L; g.textAlign = 'left'; cols.forEach((c, k) => { g.fillStyle = COL[k % COL.length]; g.fillRect(lx, H - 44, 22, 22); g.fillStyle = '#333'; g.fillText(c.name, lx + 30, H - 33); lx += 50 + g.measureText(c.name).width; });
    const n = (D().prikazN || {})[pid] || ''; ed().chain().focus().insertContentAt(h.pos + h.n.nodeSize, { type: 'prikaz', attrs: { kind: 'slika', title: a.title || '', source: `izrada autora prema Tablici ${n}`, rows: [], img: cv.toDataURL('image/png'), opt: { nw: W, nh: H, w: 90, al: 'c' } } }).run(); toast('Grafikon je umetnut ispod tablice kao slika. Ako promijenite brojke, izradite ga ponovno.'); };

  /* ---------- 11. kemijske formule ---------- */
  if (X.rich.MODS) X.rich.MODS.kem = ['Kemijske formule', 'Kemijski izrazi i jednadžbe, upisani kao \\ce{H2SO4}', /fkit|pmf|farmac|fbf|pbf|kemij|agr|sumar|mef\b|medicin|vef|stomat|rgn|metalur/i];
  ACT.acChem = () => { X.closePop(); ACT.rFx({ dataset: { inline: '1' } }); if (U.dlg) { U.dlg.tex = '\\ce{H2SO4}'; X.renderDlg(); setTimeout(() => { const f = $('#fxT'); if (f) { f.focus(); f.setSelectionRange(4, f.value.length - 1); } }, 60); } };

  /* ---------- 12. sinonimi ---------- */
  if (AX && AX.P) AX.P.sin = { l: 2, t: 'Sinonimi', d: 'druge riječi istog značenja za označenu riječ', in: 'Riječ', ph: 'npr. utjecati', rule: 'Navedi do osam hrvatskih sinonima ili bliskoznačnica za zadanu riječ, primjerenih akademskom stilu, i uz svaku kratko reci po čemu se razlikuje. Ne piši rečenice umjesto studenta i ne mijenjaj njegov tekst.' };
  ACT.acSyn = () => { X.closePop(); const s = AX.selText(); if (!s) return; const w = s.text.trim().split(/\s+/)[0].slice(0, 40); ACT.aiFrom({ dataset: { v: 'sin' } }); U.aiIn = w; X.renderPanel(true); const f = $('#aiIn'); if (f) f.value = w; };

  /* ---------- izvoz u Word ---------- */
  let links = [];
  const dc0 = X.pg && X.pg.docxCover;
  if (dc0) X.pg.docxCover = h => { const s = dc0(h), { p, run, MAR } = h, i = s.lastIndexOf('<w:p><w:pPr><w:sectPr>'), cover = s.slice(0, i), PB = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>', f = X.pg.fmt(), tw = Math.round((21 - f.m.l - f.m.r) * 567), ctr = '<w:jc w:val="center"/>', hd = t => p(run(t, { b: 1 }), '', '<w:spacing w:before="0" w:after="240"/><w:jc w:val="left"/>');
    const ent = (t, pg, ind) => `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${tw}"/></w:tabs><w:spacing w:after="0"/><w:ind w:left="${ind || 0}"/><w:jc w:val="left"/></w:pPr>@@${run(t)}${pg ? `<w:r><w:tab/></w:r>${run(String(pg))}` : ''}</w:p>`;
    let front = ''; ['izjava', 'zahvala'].forEach(k => { if (S.fm[k].on) front += PB + hd(FM[k][0]) + paras(fmText(k)).map(x => p(x.split('\n').map((l, j) => (j ? '<w:r><w:br/></w:r>' : '') + run(l)).join(''))).join(''); });
    const on = pgOn(), heads = D().heads.filter(x => x.level > 1), bibPg = domPage($('#bib')), FB = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>';
    let toc = heads.map(x => ent(`${x.num} ${x.title}`, on ? pageOf(x.pos) : '', x.level === 3 ? 283 : 0)).concat(D().cited && Object.keys(D().cited).length ? [ent('Literatura', bibPg || '', 0)] : []);
    if (toc.length) { toc[0] = toc[0].replace('@@', FB); front += PB + hd('Sadržaj') + toc.join('').replace(/@@/g, '') + '<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>'; }
    const pkL = (D().prikazi || []), lst = (kind, title, lab) => { const l = pkL.filter(x => x.kind === kind); return l.length ? hd(title) + l.map(x => ent(`${lab} ${x.n}. ${x.title || 'bez naslova'}`, on ? pageOf(x.pos) : '', 0).replace('@@', '')).join('') : ''; }, lists = lst('tablica', 'Popis tablica', 'Tablica') + lst('slika', 'Popis slika', 'Slika') + (X.stem ? X.stem.docxList(ent, hd, on, pageOf) : ''); if (lists) front += PB + lists;
    return cover + front + `<w:p><w:pPr><w:sectPr>${S.fmRoman ? '<w:footerReference w:type="default" r:id="rId2"/>' : ''}<w:pgSz w:w="11906" w:h="16838"/>${MAR}${S.fmRoman ? '<w:pgNumType w:fmt="lowerRoman" w:start="1"/><w:titlePg/>' : ''}</w:sectPr></w:pPr></w:p>`; };
  X.acad = {
    omml, fnStyle, fnNote: a => fnNote(a, seq), fnBreak: () => { seq.last = null; }, docxStart: () => { seq = { last: null, seen: new Set() }; links = []; },
    docxLink: (href, r0) => { links.push(href); return `<w:hyperlink r:id="rIdL${links.length}" w:history="1">${r0.replace('<w:rPr>', '<w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/>').replace(/<w:r><w:t /, '<w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t ')}</w:hyperlink>`; },
    docxTail: ({ p, run }) => { let o = ''; if (S.idxOn) { const ix = index(); if (ix.length) o += p(run('Kazalo pojmova'), 'Heading1') + ix.map(x => p(run(x.term) + (x.pages.length ? '<w:r><w:tab/></w:r>' + run(x.pages.join(', ')) : ''), '', `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${Math.round((21 - X.pg.fmt().m.l - X.pg.fmt().m.r) * 567)}"/></w:tabs><w:spacing w:after="0"/><w:jc w:val="left"/>`)).join(''); } if (S.fm.cv.on && fmText('cv')) o += p(run('Životopis'), 'Heading1') + paras(fmText('cv')).map(x => p(run(x))).join(''); return o; },
    docxPost: (files, { RL, HD, NS }) => { const ct = '[Content_Types].xml', rel = 'word/_rels/document.xml.rels';
      files['word/settings.xml'] = `${HD}<w:settings ${NS}><w:updateFields w:val="true"/></w:settings>`; files[ct] = files[ct].replace('</Types>', '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>'); files[rel] = files[rel].replace('</Relationships>', `<Relationship Id="rIdS1" Type="${RL}/settings" Target="settings.xml"/></Relationships>`);
      if (links.length) files[rel] = files[rel].replace('</Relationships>', links.map((h, i) => `<Relationship Id="rIdL${i + 1}" Type="${RL}/hyperlink" Target="${xe(h).replace(/"/g, '&quot;')}" TargetMode="External"/>`).join('') + '</Relationships>');
      if (S.notesEnd) { const fn = files['word/footnotes.xml']; files['word/endnotes.xml'] = fn.replace(/w:footnotes/g, 'w:endnotes').replace(/<w:footnote /g, '<w:endnote ').replace(/<\/w:footnote>/g, '</w:endnote>').replace(/w:footnoteRef\/>/g, 'w:endnoteRef/>'); files['word/footnotes.xml'] = fn.replace(/<w:footnote w:id="[1-9]\d*">[\s\S]*?<\/w:footnote>/g, ''); files['word/document.xml'] = files['word/document.xml'].replace(/<w:footnoteReference w:id=/g, '<w:endnoteReference w:id=');
        files[ct] = files[ct].replace('</Types>', '<Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/></Types>'); files[rel] = files[rel].replace('</Relationships>', `<Relationship Id="rIdE1" Type="${RL}/endnotes" Target="endnotes.xml"/></Relationships>`); } },
    ctxSel: () => `<div class="mh">Još</div>${b('acLink', 'Poveznica', 'klikabilna adresa')}${b('menu-lang', 'Strani jezik', '›')}${AX && AX.curSrc && AX.curSrc() && AX.allowed('sin') && !/\s\S+\s/.test((AX.selText() || { text: '' }).text.trim()) ? b('acSyn', 'Sinonimi', 'pomoćnik') : ''}`,
    ctxTable: pid => `<button class="mi" data-act="acChart" data-pid="${esc(pid)}" data-t="bar"><span>Grafikon iz tablice: stupci</span><small></small></button><button class="mi" data-act="acChart" data-pid="${esc(pid)}" data-t="line"><span>Grafikon iz tablice: linija</span><small></small></button>`,
    index,
  };
  /* izbornici, paleta */
  const ins0 = X.rich.insItems; X.rich.insItems = () => ins0() + (X.rich.modOn('kem') ? mi('acChem', 'Kemijska formula', 'npr. H2SO4') : '') + mi('acLink', 'Poveznica', 'na označeni tekst') + mi('acParts', 'Dijelovi rada', 'izjava, zahvala, životopis, kazalo');
  const view0 = X.rich.viewItems; X.rich.viewItems = () => view0() + (T() ? '' : mi('acTypo', 'Tipografija dok tipkam', S.typo ? '✓ „ ” – …' : ''));
  if (TB.CMD) TB.CMD().push(['Dijelovi rada', 'izjava, zahvala, životopis, kazalo, bilješke', 'acParts', null, 'w'], ['Poveznica', 'na označeni tekst', 'acLink', null, 'w'], ['Kemijska formula', 'npr. H2SO4', 'acChem', null, 'w'], ['Tipografija dok tipkam', 'navodnici, crtica, tri točke', 'acTypo', null, 'w'], ['Strani jezik', 'označeni tekst je engleski', 'acLang', { l: 'en' }, 'w']);
})();
