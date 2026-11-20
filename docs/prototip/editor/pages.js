/* Ductura Editor, prototip: stranice (v0.23).
 * 1 list podijeljen na stranice A4 prema pravilima fakulteta (pismo, veličina, prored, margine) · 2 brojevi stranica po pravilu
 * 3 naslovnica složena iz profila i podataka o radu · 4 sve boje za marker i tablice
 * Stranice su mjerene u pregledniku: prijelomi su vrlo blizu Wordu, ali točan prijelom daje Word pri izvozu.
 */
(function () {
  'use strict';
  const X = window.DU, { S, U, ACT, esc, $, persist, toast } = X, ed = () => X.editor, D = () => X.D, T = () => S.mode === 'teacher', mi = X.fx.mi, TB = X.tb, Deco = X.Decoration;
  X.hooks.defaults.push(s => { if (s.pgView === undefined) s.pgView = true; if (!s.cover) s.cover = { student: 'Student A', mentor: '', study: '', place: 'Zagreb', date: '' }; });
  const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const num = t => parseFloat(String(t).replace(',', '.'));

  /* ---------- pravila fakulteta: oblik stranice ---------- */
  let fK = '', fV = null;
  function fmt() {
    const p = X.rules && X.rules.profile && X.rules.profile(), k = p ? p.id : '-'; if (k === fK && fV) return fV; fK = k;
    const facts = p ? (p.facts || []).concat(p.manualChecks || []) : [], all = norm(facts.join(' · ')), src = [], use = re => { const f = facts.find(x => re.test(norm(x))); if (f && !src.includes(f)) src.push(f); };
    const font = p && p.font ? String(p.font).split(/\s+ili\s+|,|\//)[0].trim() : 'Times New Roman', m = { t: 2.5, r: 2.5, b: 2.5, l: 2.5 }; let q;
    if ((q = /margine?[^·]{0,40}?lijev\w*\s+(\d+(?:[.,]\d+)?)\s*cm[^·]{0,30}?ostale\s+(\d+(?:[.,]\d+)?)/.exec(all)) || (q = /lijev\w*\s+(\d+(?:[.,]\d+)?)\s*cm[^·]{0,30}?ostale\s+(\d+(?:[.,]\d+)?)/.exec(all))) { m.l = num(q[1]); m.t = m.r = m.b = num(q[2]); use(/lijev\w*\s+\d/); }
    else if ((q = /margine\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*cm/.exec(all))) { m.l = num(q[1]); m.t = m.r = m.b = num(q[2]); use(/margine\s+\d+(?:[.,]\d+)?\s*\//); }
    else if ((q = /margine\s+(\d+(?:[.,]\d+)?)\s*cm/.exec(all))) { m.t = m.r = m.b = m.l = num(q[1]); use(/margine\s+\d/); }
    Object.keys(m).forEach(i => { if (!(m[i] >= 1 && m[i] <= 5)) m[i] = 2.5; });
    const right = /desn\w+\s+(kut|ugl)/.test(all), numPos = right ? 'right' : 'center', fromUvod = /od uvoda|uvod\w*\s+pocinje|pocinj\w+[^·]{0,40}uvod|zapocinj\w+[^·]{0,40}uvod|prva numerirana[^·]{0,40}uvod/.test(all), allPg = !fromUvod && /sve\s+(se\s+)?stranice[^·]{0,30}numerir/.test(all);
    if (right) use(/desn\w+\s+(kut|ugl)/); if (fromUvod) use(/uvod/); const cov = facts.filter(x => /naslovn|korice/.test(norm(x)));
    fV = { font, size: (p && p.size) || 12, spacing: (p && p.spacing) || 1.5, m, numPos, numStart: allPg ? 'all' : 'uvod', known: { font: !!(p && p.font), size: !!(p && p.size), spacing: !!(p && p.spacing), margins: /margin/.test(all), num: right || fromUvod || allPg }, src, cov, label: p ? p.label : '', unit: p && X.rules.data ? (X.rules.data.units.find(u => u.id === p.unitId) || {}).name || '' : '' }; return fV;
  }

  /* ---------- stanje i mjere ---------- */
  const sheet = () => $('#sheet'), avail = () => { const st = sheet().parentNode, cs = getComputedStyle(st); return st.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); }, on = () => S.pgView !== false && !!ed() && avail() >= 640 && !$('#app').classList.contains('focus') && !U.outline;
  const GAP = 26; let PX = 39.05;
  const dim = () => { const f = fmt(); PX = Math.min(820, Math.floor(avail())) / 21; return { f, H: (29.7 - f.m.t - f.m.b) * PX, mt: f.m.t * PX, mb: f.m.b * PX, ml: f.m.l * PX, mr: f.m.r * PX, G: f.m.t * PX + f.m.b * PX + GAP }; };
  function applyCss() {
    const sh = sheet(), o = on(); sh.classList.toggle('pg', o); if (!o) { ['--pg-w', '--pg-mt', '--pg-mb', '--pg-ml', '--pg-mr', '--pg-fs', '--pg-lh', '--pg-font', '--pg-h', '--pg-gap', '--pg-after'].forEach(k => sh.style.removeProperty(k)); return null; }
    const d = dim(), f = d.f, st = sh.style; st.setProperty('--pg-w', (PX * 21) + 'px'); st.setProperty('--pg-mt', d.mt + 'px'); st.setProperty('--pg-mb', d.mb + 'px'); st.setProperty('--pg-ml', d.ml + 'px'); st.setProperty('--pg-mr', d.mr + 'px'); st.setProperty('--pg-fs', (f.size * 0.03528 * PX) + 'px'); st.setProperty('--pg-lh', String(Math.round(f.spacing * 1.15 * 1000) / 1000)); st.setProperty('--pg-font', `"${f.font}", "Liberation Serif", Times, serif`); st.setProperty('--pg-h', d.H + 'px'); st.setProperty('--pg-gap', GAP + 'px'); st.setProperty('--pg-after', (6 * 0.03528 * PX) + 'px'); return d;
  }
  const pgLabel = n => { const f = fmt(); return n == null ? '' : String(n); };
  const gapEl = (n, blk, tag) => { const e = document.createElement(blk ? 'div' : 'span'); e.className = 'pgb' + (blk ? ' blk' : '') + (tag ? ' ' + tag : ''); e.contentEditable = 'false'; e.setAttribute('aria-hidden', 'true'); e.innerHTML = `<span class="pgb-f ${fmt().numPos}">${n ? `<b>${n}</b>` : ''}</span><span class="pgb-g"></span><span class="pgb-h"></span>`; return e; };

  /* ---------- naslovnica ---------- */
  const title = () => { const h = D().heads.find(x => x.level === 1); return (h && h.title) || 'Naslov rada'; };
  const today = () => { const d = new Date(), M = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac']; return `${M[d.getMonth()]} ${d.getFullYear()}.`; };
  const cov = () => { const c = S.cover || {}, f = fmt(); return { uni: 'Sveučilište u Zagrebu', unit: f.unit || 'Fakultet političkih znanosti', study: c.study || '', kind: X.TASK.kind || 'Rad', title: title(), student: c.student || 'Student A', mentor: c.mentor || '', place: c.place || 'Zagreb', date: c.date || today() }; };
  const coverBox = document.createElement('div'); coverBox.id = 'pgCover'; let covK = '';
  function coverPaint() {
    const sh = sheet(), toc = $('#toc'); if (!on()) { if (coverBox.parentNode) coverBox.remove(); covK = ''; sh.querySelectorAll(':scope > .pgb.fm').forEach(x => x.remove()); return; }
    if (coverBox.parentNode !== sh || coverBox.nextElementSibling === null) sh.insertBefore(coverBox, toc);
    const c = cov(), f = fmt(), ro = !ed().isEditable, k = JSON.stringify(c) + ro + f.cov.length; if (k !== covK) { covK = k;
      coverBox.innerHTML = `<div class="cv-top">${esc(c.uni)}<br>${esc(c.unit)}${c.study ? '<br>' + esc(c.study) : ''}</div><div class="cv-mid"><div class="cv-name">${esc(c.student)}</div><div class="cv-title">${esc(c.title)}</div><div class="cv-kind">${esc(c.kind)}</div>${c.mentor ? `<div class="cv-ment">Mentor: ${esc(c.mentor)}</div>` : ''}</div><div class="cv-bot">${esc(c.place)}, ${esc(c.date)}</div>${ro ? '' : `<div class="cv-note"><button class="lnk" data-act="pgCoverEdit">Podaci za naslovnicu</button>${f.cov.length ? `<span>Pravilo fakulteta: ${esc(f.cov[0])}</span>` : '<span>Naslovnica je složena po općem obrascu. Usporedite je sa službenim predloškom fakulteta.</span>'}</div>`}`; }
    /* razmak iza naslovnice i iza sadržaja */
    const need = [[coverBox, 'c']].concat((X.pgFront ? X.pgFront() : []).map(e => [e, 'f'])).concat(toc && toc.firstElementChild ? [[toc, 't']] : []), lab = i => (S.fmRoman && i > 0 ? ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'][i] || '' : ''); sh.querySelectorAll(':scope > .pgb.fm').forEach(x => { if (!need.some(n => n[0].nextElementSibling === x)) x.remove(); });
    need.forEach(([el], i) => { const nx = el.nextElementSibling, ok = nx && nx.classList.contains('fm'); if (ok && nx.dataset.n === lab(i)) return; if (ok) nx.remove(); const g = gapEl(lab(i), true, 'fm'); g.dataset.n = lab(i); el.after(g); });
    if (X.pgTocNums) X.pgTocNums();
  }
  ACT.pgCoverEdit = () => X.openDlg({ type: 'pgcover' });
  X.hooks.dlg.pgcover = () => { const c = S.cover, f = (k, l, ph) => `<label class="f">${l}</label><input class="in" data-bind="S.cover.${k}" value="${esc(c[k] || '')}" placeholder="${esc(ph)}">`, r = fmt(); return `<h3>Podaci za naslovnicu</h3><p class="muted">Naslov i vrsta rada dolaze iz rada, a fakultet iz profila pravila${r.label ? ' (' + esc(r.label) + ')' : ''}. U aplikaciji ime studenta i mentora dolaze iz prijave i zadatka.</p>${f('student', 'Student', 'Ime i prezime')}${f('mentor', 'Mentor', 'npr. izv. prof. dr. sc. Ime Prezime')}${f('study', 'Studij', 'npr. Diplomski studij politologije')}${f('place', 'Mjesto', 'Zagreb')}${f('date', 'Mjesec i godina', today())}${r.cov.length ? `<div class="ptitle">Što o naslovnici kažu pravila</div>${r.cov.map(x => `<p class="muted">${esc(x)}</p>`).join('')}` : ''}<div class="foot"><button class="btn pri" data-act="pgCoverOk">Gotovo</button></div>`; };
  ACT.pgCoverOk = () => { persist(); X.closeDlg(); covK = ''; later(); };

  /* ---------- prijelomi ---------- */
  const linesOf = (dom, G) => { const r = document.createRange(); r.selectNodeContents(dom); const rects = [...r.getClientRects()].filter(q => q.width > 0.5 && q.height > 2 && q.height < G - 6).sort((a, b) => a.top - b.top || a.left - b.left), out = []; rects.forEach(q => { const l = out[out.length - 1]; if (l && q.top < l.bottom - 3) { l.bottom = Math.max(l.bottom, q.bottom); l.left = Math.min(l.left, q.left); } else out.push({ top: q.top, bottom: q.bottom, left: q.left }); }); return out; };
  let passes = 0, lastDoc = null, pT = null;
  function paginate() {
    const d = applyCss(); coverPaint(); const v = ed().view, doc = v.state.doc, pm = v.dom;
    if (!d) { tailClean(); if ((U.pgBreaks || []).length) { U.pgBreaks = []; X.refresh(); } U.pgCount = 0; return; }
    if (doc !== lastDoc) { lastDoc = doc; passes = 0; }
    const H = d.H, G = d.G, pmTop = pm.getBoundingClientRect().top, gaps = [...pm.querySelectorAll('.pgb')].map(g => g.getBoundingClientRect().top), cy = y => y - pmTop - gaps.filter(g => g < y - 1).length * G;
    let start = 0, page = 1, prevHead = null; const out = [];
    doc.forEach((node, off) => {
      let dom = v.nodeDOM(off); if (!dom || dom.nodeType !== 1) return; const r = dom.getBoundingClientRect(); if (!r.height) return; const type = node.type.name, top = cy(r.top), bot = cy(r.bottom);
      if (type === 'pagebreak') { out.push({ pos: off + node.nodeSize, n: page, blk: 1 }); page++; start = bot; prevHead = null; return; }
      if (bot <= start + H + 0.5) { prevHead = type === 'heading' ? { off, top } : null; return; }
      const textual = (node.isTextblock && type !== 'heading' && type !== 'codeBlock') || type === 'bulletList' || type === 'orderedList' || type === 'blockquote';
      const before = () => { const hd = prevHead && prevHead.top > start + 1 ? prevHead : null, at = hd ? hd.off : off, y = hd ? hd.top : top; if (y <= start + 1) return false; out.push({ pos: at, n: page, blk: 1 }); page++; start = y; return true; };
      const lines = textual ? linesOf(dom, G).map(l => ({ a: l, top: cy(l.top), bottom: cy(l.bottom) })) : null;
      if (!lines || lines.length < 2) { before(); prevHead = type === 'heading' ? { off, top } : null; return; }
      let i0 = 0, guard = 0;
      while (guard++ < 60) { const idx = lines.findIndex((l, i) => i >= i0 && l.bottom > start + H + 0.5); if (idx < 0) break; let bi = idx;
        if (bi - i0 === 1 && lines.length > 2) bi = i0; else if (bi === lines.length - 1 && bi - i0 >= 2) bi--;
        if (bi <= i0) { if (i0 === 0 && before()) continue; bi = Math.max(idx, i0 + 1); if (bi >= lines.length) break; }
        const l = lines[bi], hit = v.posAtCoords({ left: l.a.left + 2, top: (l.a.top + l.a.bottom) / 2 }); if (!hit || hit.pos <= off || hit.pos >= off + node.nodeSize) { if (i0 === 0) before(); break; }
        out.push({ pos: hit.pos, n: page, blk: 0 }); page++; start = l.top; i0 = bi; }
      prevHead = null;
    });
    U.pgCount = page; const sig = JSON.stringify(out), old = JSON.stringify(U.pgBreaks || []);
    if (sig !== old && passes < 5) { passes++; U.pgBreaks = out; X.refresh(); return later(60); }
    tail(d, cy, start, page, gaps.length);
  }
  /* iza teksta: fusnote, literatura, sažetak; prijelom ide između odlomaka */
  const tailEls = () => ['#fnlist', '#bib', '#absBox', '#idxTail', '#cvTail'].map(q => $(q)).filter(Boolean);
  const tailClean = () => { tailEls().forEach(c => c.querySelectorAll('.pgb').forEach(x => x.remove())); const e = $('#pgEnd'); if (e) e.remove(); };
  function tail(d, cy0, start, page, nGaps) {
    tailClean(); const pmTop = ed().view.dom.getBoundingClientRect().top; let added = 0; const cy = y => y - pmTop - (nGaps + added) * d.G;
    tailEls().forEach(c => [...c.children].forEach(el => { if (el.classList.contains('pgb')) return; const r = el.getBoundingClientRect(); if (!r.height) return; if (cy(r.bottom) > start + d.H + 0.5 && cy(r.top) > start + 1) { el.before(gapEl(page, true, 'tl')); added++; page++; start = cy(el.getBoundingClientRect().top); } }));
    const last = tailEls().filter(c => c.getBoundingClientRect().height).pop() || ed().view.dom, rest = Math.max(0, start + d.H - cy(last.getBoundingClientRect().bottom));
    const e = document.createElement('div'); e.id = 'pgEnd'; e.setAttribute('aria-hidden', 'true'); e.style.height = Math.min(rest, d.H) + 'px'; e.innerHTML = `<span class="pgb-f ${fmt().numPos}"><b>${page}</b></span>`; sheet().appendChild(e); U.pgCount = page;
  }
  const later = ms => { clearTimeout(pT); pT = setTimeout(() => { try { paginate(); } catch (e) { /* mjerenje nije uspjelo; ostaje zadnje stanje */ } }, ms == null ? 260 : ms); };
  X.hooks.paint.push(() => later());
  X.hooks.tx.push(tr => { if (tr.docChanged && U.pgBreaks) U.pgBreaks.forEach(b => { b.pos = tr.mapping.map(b.pos, -1); }); });
  X.hooks.end.push(({ doc, decos }) => { if (!S.pgView || !(U.pgBreaks || []).length) return; const size = doc.content.size; U.pgBreaks.forEach(b => { const pos = Math.max(0, Math.min(b.pos, size)); decos.push(Deco.widget(pos, () => gapEl(b.n, !!b.blk), { side: -1, key: 'pg' + b.n + (b.blk ? 'b' : 'i'), ignoreSelection: true })); }); });
  addEventListener('resize', () => later(120)); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => later(50));

  /* ---------- izvoz: naslovnica ---------- */
  const docxCover = ({ p, run, MAR }) => { const c = cov(), ctr = '<w:jc w:val="center"/><w:spacing w:after="0" w:line="276" w:lineRule="auto"/>', big = (t, sz, b) => `<w:r><w:rPr>${b ? '<w:b/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${String(t).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))}</w:t></w:r>`, gap = n => new Array(n).fill(p('', '', ctr)).join('');
    return p(big(c.uni, 28), '', ctr) + p(big(c.unit, 28), '', ctr) + (c.study ? p(big(c.study, 24), '', ctr) : '') + gap(8) + p(big(c.student, 28), '', ctr) + gap(2) + p(big(c.title, 36, 1), '', ctr) + gap(1) + p(big(c.kind, 28), '', ctr) + (c.mentor ? gap(3) + p(big('Mentor: ' + c.mentor, 24), '', ctr) : '') + gap(c.mentor ? 8 : 12) + p(big(`${c.place}, ${c.date}`, 24), '', ctr) + `<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/>${MAR}</w:sectPr></w:pPr></w:p>`; };

  /* ---------- 4. sve boje ---------- */
  const HUES = [0, 28, 48, 90, 150, 185, 215, 265, 310], PAL = (() => { const out = []; [[92, 82], [88, 68], [80, 55], [70, 42], [60, 30]].forEach(([s, l]) => HUES.forEach(h => out.push(hsl(h, s, l)))); ['#ffffff', '#e6e6e6', '#bfbfbf', '#8c8c8c', '#595959', '#262626'].forEach(g => out.push(g)); return out; })();
  function hsl(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); return '#' + [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  const grid = (act, extra, cur) => `<div class="swg">${PAL.map(c => `<button class="sw${cur === c ? ' on' : ''}" data-act="${act}"${extra(c)} style="background:${c}" title="${c}" aria-label="Boja ${c}"></button>`).join('')}</div>`;
  const pick = document.createElement('input'); pick.type = 'color'; pick.id = 'pgPick'; pick.hidden = true; document.body.appendChild(pick); let pickCb = null;
  pick.addEventListener('change', () => { const cb = pickCb; pickCb = null; if (cb) cb(pick.value); });
  ACT.pgPick = el => { const k = el.dataset.k, pid = el.dataset.pid; X.closePop(); pickCb = c => { if (k === 'hl') ACT.rHl({ dataset: { c } }); else ACT.pkDo({ dataset: { pid, do: k, v: c } }); }; pick.value = '#ffd966'; try { if (pick.showPicker) pick.showPicker(); else pick.click(); } catch (e) { pick.click(); } };
  ACT['menu-hl'] = el => { if (TB.hideBub) TB.hideBub(); TB.pop(el, `<div class="mh">Marker</div>${grid('rHl', c => ` data-c="${c}"`)}${mi('pgPick', 'Druga boja…', 'bilo koja', ' data-k="hl"')}${mi('rHl', 'Ukloni marker', '', ' data-c=""')}<div class="pad muted">Marker je Vaše označavanje. Mentor ga ne vidi i ne ide u izvoz.</div>`); };
  ACT['menu-pkfill'] = el => { const pid = el.dataset.pid; X.openPop(`<div class="mh">Boja zaglavlja</div>${grid('pkDo', c => ` data-do="fill" data-pid="${esc(pid)}" data-v="${c}"`)}${mi('pgPick', 'Druga boja…', 'bilo koja', ` data-k="fill" data-pid="${esc(pid)}"`)}<button class="mi" data-act="pkDo" data-do="fill" data-pid="${esc(pid)}" data-v=""><span>Bez boje</span><small></small></button><div class="pad muted">Boje tablice prenose se u Word. Provjerite dopušta li ih Vaš fakultet.</div>`, el.getBoundingClientRect(), 'menu'); };
  ACT['menu-pkcell'] = el => { const pid = el.dataset.pid; X.openPop(`<div class="mh">Boja ćelije</div>${grid('pkDo', c => ` data-do="cfill" data-pid="${esc(pid)}" data-v="${c}"`)}${mi('pgPick', 'Druga boja…', 'bilo koja', ` data-k="cfill" data-pid="${esc(pid)}"`)}<button class="mi" data-act="pkDo" data-do="cfill" data-pid="${esc(pid)}" data-v=""><span>Bez boje</span><small></small></button><div class="pad muted">Vrijedi za ćeliju u kojoj je kursor.</div>`, el.getBoundingClientRect(), 'menu'); };

  /* ---------- izbornici ---------- */
  ACT.pgToggle = () => { X.closePop(); if (S.pgView !== false && !on() && avail() < 640) return toast('Prikaz stranica treba širi zaslon. Na mobitelu ostaje procjena broja stranica.'); S.pgView = S.pgView === false; persist(); passes = 0; U.pgBreaks = S.pgView ? U.pgBreaks : []; X.refresh(); later(30); toast(S.pgView ? 'List je podijeljen na stranice prema pravilima fakulteta.' : 'List je opet u jednom komadu.'); };
  ACT.pgInfo = () => X.openDlg({ type: 'pginfo' });
  X.hooks.dlg.pginfo = () => { const f = fmt(), row = (l, v, ok) => `<div class="fx"><span style="flex:1"><b>${l}</b><span class="d">${v}</span></span><small class="muted">${ok ? 'iz pravila fakulteta' : 'opća vrijednost'}</small></div>`;
    return `<h3>Oblik stranice</h3><p class="muted">${f.label ? esc(f.label) : 'Profil fakulteta nije odabran'}. Ove se vrijednosti primjenjuju na list i na izvoz u Word; ne mijenjate ih sami.</p>${row('Pismo', esc(f.font) + ', ' + f.size + ' pt', f.known.font || f.known.size)}${row('Prored', String(f.spacing).replace('.', ','), f.known.spacing)}${row('Margine', `lijevo ${String(f.m.l).replace('.', ',')} cm, desno ${String(f.m.r).replace('.', ',')} cm, gore ${String(f.m.t).replace('.', ',')} cm, dolje ${String(f.m.b).replace('.', ',')} cm`, f.known.margins)}${row('Brojevi stranica', (f.numPos === 'right' ? 'dolje desno' : 'dolje u sredini') + (f.numStart === 'all' ? ', sve stranice' : ', od prve stranice teksta; naslovnica i sadržaj bez broja'), f.known.num)}${f.src.length ? `<div class="ptitle">Iz pravila</div>${f.src.map(x => `<p class="muted">${esc(x)}</p>`).join('')}` : ''}<p class="muted">Prijelomi stranica na listu su mjereni u pregledniku i mogu se od Worda razlikovati za redak ili dva. Točan prijelom daje Word pri izvozu.</p><div class="foot"><button class="btn pri" data-act="dlgClose">Zatvori</button></div>`; };
  const view0 = X.rich.viewItems; X.rich.viewItems = () => view0() + `<div class="mh">Stranice</div>${mi('pgToggle', 'List podijeljen na stranice', S.pgView !== false ? (on() ? '✓' : 'treba širi zaslon') : '')}${mi('pgInfo', 'Oblik stranice', 'po pravilima fakulteta')}${T() ? '' : mi('pgCoverEdit', 'Podaci za naslovnicu', '')}`;
  if (TB.CMD) TB.CMD().push(['List podijeljen na stranice', 'uključi ili isključi', 'pgToggle', null, 'a', 1], ['Oblik stranice', 'pismo, prored, margine, brojevi', 'pgInfo', null, 'a', 1], ['Podaci za naslovnicu', 'student, mentor, studij', 'pgCoverEdit', null, 'w']);
  X.pg = { fmt, docxCover, on, cov, paginate: () => later(0) };
})();
