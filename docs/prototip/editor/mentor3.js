/* Ductura Editor, prototip v0.27: mentorski dio, treći krug.
 * Spaja vlasnikov raniji prototip (izvještaj o podrijetlu teksta) s tijekom rada mentora iz mentor2.js.
 *   1. zapisnik nastanka: tipkanje u naletima s ritmom, lijepljenje, umetak iz pomoćnika, brisanje, navod, slanje; lanac otisaka
 *   2. izvještaj "Podrijetlo teksta": sastav, rukopis po podrijetlu, genealogija dijela, reprodukcija, pravila fakulteta, zapisnik
 *   3. pregled runde za mentora (što je novo, komentari, što je sustav označio)
 *   4. komentari uz tekst, povezani crtom s mjestom
 *   5. usporedba predaja
 *   6. kriteriji ocjene
 * Student vidi isti izvještaj kao mentor. Ritam tipkanja bilježi se samo dok ga student ne isključi.
 * Otisak se ovdje računa u pregledniku pojednostavljenom funkcijom; u sustavu ga računa poslužitelj.
 * Pragovi pravila i kriteriji ocjene su primjeri, ne pravila fakulteta.
 */
(function () {
  'use strict';
  const X = window.DU, { S, U, ACT, esc, $, toast, persist, plural } = X, RP = X.rp, ed = () => X.editor, D = () => X.D, T = () => S.mode === 'teacher';
  X.hooks.defaults.push(s => { const def = (k, v) => { if (s[k] == null) s[k] = v; }; def('ev', []); def('evQ', 0); def('evBase', '0'); def('evRhythm', true); def('pol', { unk: 15, ai: 10 }); def('m3hist', []); def('m3align', false); def('m3seen', 0);
    def('rubric', [{ t: 'Tema, cilj i istraživačko pitanje', v: null, n: '' }, { t: 'Struktura i logika izlaganja', v: null, n: '' }, { t: 'Izvori i citiranje', v: null, n: '' }, { t: 'Metoda i analiza', v: null, n: '' }, { t: 'Jezik i stil', v: null, n: '' }, { t: 'Tehnička obrada', v: null, n: '' }]); });
  const hr = n => String(n).replace('.', ','), pct = v => hr(v.toFixed(1)) + ' %', when = t => { const d = new Date(t), z = n => String(n).padStart(2, '0'); return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}., ${z(d.getHours())}:${z(d.getMinutes())}`; };

  U.m3mute = true;
  /* ---------- 1. zapisnik nastanka ---------- */
  const hash = s => { let a = 0x811c9dc5, b = 0x1b873593; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519) ^ (a >>> 13); } return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0'); };
  const core = e => [e.q, e.t, e.k, e.n || 0, e.d || 0, e.x || ''].join('|');
  const snaps = () => U.m3snaps || (U.m3snaps = []);
  function push(e) {
    e.q = ++S.evQ; e.t = e.t || Date.now(); const prev = S.ev.length ? S.ev[S.ev.length - 1].h : S.evBase; e.h = hash(prev + core(e)); S.ev.push(e);
    if (S.ev.length > 400) { const cut = S.ev.splice(0, S.ev.length - 400); S.evBase = cut[cut.length - 1].h; }
    const sn = snaps(); try { sn.push({ q: e.q, b: X.blocksText() }); } catch (err) { /* uređivač još nije spreman */ } if (sn.length > 60) U.m3snaps = sn.filter((x, i) => i % 2 || i > 30);
    persist();
  }
  const verify = () => { let prev = S.evBase; for (const e of S.ev) { if (hash(prev + core(e)) !== e.h) return e.q; prev = e.h; } return 0; };
  const thin = b => { if (b.length <= 130) return b; const out = [], k = b.length / 130; for (let i = 0; i < 130; i++) { let m = 0; for (let j = Math.floor(i * k); j < Math.floor((i + 1) * k); j++) if (b[j] > m) m = b[j]; out.push(m); } return out; };
  let bT = null;
  function flush() { const b = U.m3b; if (!b) return; U.m3b = null; clearTimeout(bT); const e = { k: 'type', t: b.t0, n: b.n, d: b.d, x: b.x.slice(0, 400), ms: b.last - b.t0 }; if (S.evRhythm && b.beats.length > 2) e.b = thin(b.beats); push(e); }
  X.hooks.tx.push(tr => {
    if (!tr.docChanged || !ed() || !ed().isEditable || U.m3mute || tr.getMeta('addToHistory') === false || tr.getMeta('refresh')) return;
    let add = 0, del = 0, txt = '', ai = false, cite = false, pst = !!tr.getMeta('paste');
    tr.steps.forEach((s, i) => { s.getMap().forEach((os, oe, ns, ne) => { del += oe - os; add += ne - ns; if (ne > ns && i === tr.steps.length - 1) { try { txt += tr.doc.textBetween(ns, ne, ' '); tr.doc.nodesBetween(ns, Math.min(ne, tr.doc.content.size), n => { if (n.type.name === 'citation') cite = true; if (n.marks && n.marks.some(m => m.type.name === 'aitext')) ai = true; if (n.marks && n.marks.some(m => m.type.name === 'paste' || m.type.name === 'imported')) pst = true; }); } catch (e) { /* raspon izvan dokumenta */ } } }); });
    if (!add && !del) return;
    const now = Date.now();
    if (ai) { flush(); return push({ k: 'ai', n: txt.length, x: txt.slice(0, 400) }); }
    if (pst) { flush(); return push({ k: 'paste', n: txt.length, x: txt.slice(0, 400) }); }
    if (cite && !txt.trim()) { flush(); return push({ k: 'cite', n: 0, x: '' }); }
    if (!txt && del && !U.m3b) return push({ k: 'del', d: del, n: 0 });
    if (txt.length > 40) { flush(); return push({ k: 'blok', n: txt.length, x: txt.slice(0, 400) }); }
    let b = U.m3b; if (!b || now - b.last > 4000) { flush(); b = U.m3b = { t0: now, last: now, n: 0, d: 0, x: '', beats: [] }; } else b.beats.push(now - b.last);
    b.last = now; b.n += txt.length; b.d += del; b.x += txt; clearTimeout(bT); bT = setTimeout(flush, 4200);
  });
  const wrap = (name, k, lab) => { const f = ACT[name]; if (f) ACT[name] = el => { const r0 = S.review.round, s0 = S.review.status; const out = f(el); if (S.review.round !== r0 || S.review.status !== s0) { flush(); push({ k, n: 0, x: lab }); histAdd(lab); } return out; }; };
  X.hooks.paint.push(() => { const c = S.comments || [], n = c.length, r = c.filter(x => x.resolved).length; if (U.m3c == null) { U.m3c = n; U.m3r = r; return; } if (n > U.m3c) push({ k: 'cmt', n: 0, x: 'komentar #' + (c[n - 1].n || n) }); if (r > U.m3r) push({ k: 'res', n: 0, x: 'riješen komentar' }); U.m3c = n; U.m3r = r; });

  /* ---------- sastav rada po podrijetlu ---------- */
  const KIND = { typed: ['Tipkano u Ducturi', '--p-typed'], known: ['Zalijepljeno, podrijetlo poznato', '--p-internal'], ai: ['Umetnuto iz pomoćnika', '--p-ai'], match: ['Podudara se s odgovorom pomoćnika', '--p-match'], imp: ['Uvezeno iz datoteke', '--p-imp'], unk: ['Zalijepljeno, podrijetlo nepoznato', '--p-unknown'] }, KO = ['typed', 'known', 'ai', 'match', 'imp', 'unk'];
  function spans() {
    const pm = ed().view.dom, out = [], view = ed().view, doc = ed().state.doc;
    [...pm.children].forEach(bl => { if (!bl.matches('p, h1, h2, h3, h4, li, ul, ol, blockquote, .tbx')) return; const segs = []; const w = document.createTreeWalker(bl, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const p = n.parentElement; const ce = p && p.closest('[contenteditable="false"]'); if (!n.nodeValue || !p || (ce && ce !== pm) || p.closest('.ln, .cbh, .pgb')) continue; let k = 'typed', ref = '';
        const a = p.closest('.aitext'); if (a) { k = 'ai'; ref = a.getAttribute('data-ai') || ''; } else if (p.closest('.aimatch')) k = 'match'; else if (p.closest('[data-imp]')) k = 'imp'; else if (p.closest('.paste')) { k = 'unk'; try { const pos = view.posAtDOM(n, 0), nd = doc.nodeAt(pos), m = nd && nd.marks.find(x => x.type.name === 'paste'); if (m && (m.attrs.src || m.attrs.ok)) { k = 'known'; const s = m.attrs.src && X.srcById(m.attrs.src); ref = s ? 'izvor: ' + s.authors + ' (' + s.year + ')' : m.attrs.ok ? 'obrazloženje studenta: ' + m.attrs.ok : ''; } } catch (e) { /* položaj nije pronađen */ } }
        const last = segs[segs.length - 1]; if (last && last.k === k && last.ref === ref) last.t += n.nodeValue; else segs.push({ k, ref, t: n.nodeValue }); }
      if (segs.length) out.push({ head: /^H/.test(bl.tagName), segs }); });
    return out;
  }
  function comp(sp) { const c = {}; let tot = 0; KO.forEach(k => { c[k] = 0; }); sp.forEach(b => b.segs.forEach(s => { c[s.k] += s.t.length; tot += s.t.length; })); const p = k => tot ? c[k] / tot * 100 : 0; return { c, tot, p, rows: KO.filter(k => c[k]).map(k => ({ k, pct: p(k) })) }; }
  const purposes = sp => { const out = {}; sp.forEach(b => b.segs.forEach(s => { if (s.k === 'ai') { const m = /Svrha:\s*([^.]+)/.exec(s.ref || ''); out[m ? m[1].trim() : 'nepoznata svrha'] = 1; } })); return Object.keys(out); };
  function policy(c, sp) {
    const pu = purposes(sp), sent = (S.review.log || []).length > 0;
    return [{ ok: c.p('unk') <= S.pol.unk, hard: true, n: `Nepoznato podrijetlo do ${S.pol.unk} %`, w: 'izmjereno ' + pct(c.p('unk')) }, { ok: c.p('ai') <= S.pol.ai, hard: false, n: `Tekst umetnut iz pomoćnika do ${S.pol.ai} %`, w: 'izmjereno ' + pct(c.p('ai')) + (c.c.match ? '; podudaranja se broje odvojeno, ' + pct(c.p('match')) : '') },
      { ok: true, hard: false, n: 'Svrhe pomoćnika u tekstu', w: pu.length ? pu.join(', ') : 'nema umetnutog teksta' }, { ok: sent, hard: false, n: 'Rad je barem jednom poslan mentoru', w: sent ? 'zabilježeno' : 'još nije' }];
  }
  const stack = c => `<div class="m3stack">${c.rows.map(r => `<i style="width:${r.pct}%;background:var(${KIND[r.k][1]})" title="${esc(KIND[r.k][0])}"></i>`).join('')}</div>`;

  /* ---------- 2. izvještaj ---------- */
  const rhythm = b => { if (!b || b.length < 3) return ''; const mx = Math.max(250, ...b), h = 36; return `<svg class="m3rh" viewBox="0 0 ${b.length * 2} ${h}" preserveAspectRatio="none" role="img" aria-label="ritam unosa">${b.map((v, i) => { const bh = Math.max(1, Math.round(v / mx * (h - 3))); return `<rect x="${i * 2}" y="${h - bh}" width="1.2" height="${bh}" fill="var(${v > 700 ? '--p-ai' : '--p-typed'})" opacity="${v > 700 ? '.9' : '.6'}"/>`; }).join('')}</svg>`; };
  const EVL = { type: 'tipkanje', paste: 'lijepljenje', ai: 'umetak iz pomoćnika', del: 'brisanje', cite: 'navod', blok: 'umetnuto naredbom', cmt: 'komentar', res: 'riješen komentar', send: 'slanje', back: 'vraćeno', start: 'početak bilježenja' };
  const evDesc = e => e.k === 'type' ? `${e.n} zn.${e.d ? ', obrisano ' + e.d : ''}${e.ms > 500 ? ' · ' + hr((e.ms / 1000).toFixed(1)) + ' s' : ''}` : e.k === 'del' ? `${e.d} zn.` : e.k === 'paste' || e.k === 'ai' || e.k === 'blok' ? `${e.n} zn., odjednom` : esc(e.x || '');
  function lineage(seg) {
    if (!seg) return '<p class="muted">Kliknite obojani dio rukopisa.</p>';
    const key = seg.t.trim().slice(0, 14), e = key.length > 5 ? S.ev.slice().reverse().find(x => x.x && (x.x.includes(key) || seg.t.includes(x.x.trim().slice(0, 14) || '\u0000'))) : null;
    const conf = { typed: e ? 'opaženo tipkanje' : 'zatečeno prije početka bilježenja', known: 'opaženo lijepljenje, podrijetlo navedeno', ai: 'zabilježeno u Ducturi', match: 'heuristika: osam ili više riječi zaredom', imp: 'opažen uvoz datoteke', unk: 'opaženo lijepljenje, podrijetlo nije poznato' }[seg.k];
    const ex = { unk: 'Nepoznato podrijetlo nije prekršaj. Može biti vlastiti raniji nacrt, bilješke ili tekst s drugog uređaja. Traži objašnjenje, ne sankciju.', match: 'Podudara se s odgovorom pomoćnika iako nije umetnut klikom. To je heuristika, ne dokazana veza, zato se prikazuje odvojeno od umetnutog teksta.', typed: e ? '' : 'Ovaj je dio bio u radu prije nego što je bilježenje počelo, pa o njegovu nastanku nema zapisa.' }[seg.k] || '';
    return `<div class="m3lin"><b style="color:var(${KIND[seg.k][1]})">${esc(KIND[seg.k][0])}</b><p>${esc(seg.t.length > 220 ? seg.t.slice(0, 220) + '…' : seg.t)}</p></div><dl class="m3ax"><dt>opaženo</dt><dd>${e ? EVL[e.k] + ', ' + when(e.t) : 'nema zapisa'}</dd><dt>povezano s</dt><dd>${esc(seg.ref || 'ništa')}</dd><dt>pouzdanost</dt><dd>${conf}</dd></dl>${ex ? `<p class="m3note">${ex}</p>` : ''}
      <div class="m3rhw"><div class="rpsub">Ritam unosa</div>${e && e.b ? rhythm(e.b) + `<p class="muted">${hr((e.ms / 1000).toFixed(1))} s · ${e.n} znakova · najduža stanka ${hr((Math.max(...e.b) / 1000).toFixed(1))} s. Viši stupac je dulja stanka. Ritam je dokaz o unosu, ne o autorstvu: tko prepisuje tuđi tekst, tipka jednako uvjerljivo.</p>` : `<p class="muted">${e && e.k !== 'type' ? 'Tekst je stigao odjednom, pa ritma nema.' : !S.evRhythm ? 'Student je isključio bilježenje ritma.' : 'Za ovaj dio nema zabilježenog ritma.'}</p>`}</div>`;
  }
  X.hooks.dlg.m3prov = d => {
    flush(); const sp = spans(), c = comp(sp), sn = snaps(), at = d.at == null || d.at >= sn.length ? null : d.at, bad = verify(), pol = policy(c, sp); let si = 0; U.m3sp = [];
    const man = at == null ? sp.map(b => `<${b.head ? 'h5' : 'p'}>${b.segs.map(s => { U.m3sp.push(s); const i = si++; return `<mark class="m3k${d.sel === i ? ' sel' : ''}" style="--k:var(${KIND[s.k][1]})" data-k="${s.k}" data-act="m3Sel" data-i="${i}" title="${esc(KIND[s.k][0])}">${esc(s.t)}</mark>`; }).join('')}</${b.head ? 'h5' : 'p'}>`).join('')
      : (() => { const cur = sn[at].b, old = new Set(at ? sn[at - 1].b : []); return cur.map(t => `<p${at && !old.has(t) ? ' class="m3new"' : ''}>${esc(t.replace(/^# /, ''))}</p>`).join(''); })();
    const log = S.ev.slice().reverse().slice(0, 80).map(e => `<div><span class="q">${e.q}</span><span class="k k-${e.k}">${EVL[e.k] || e.k}</span><span class="d">${evDesc(e)}</span><span class="h">${e.h.slice(0, 7)}</span></div>`).join('');
    return `<h3>Podrijetlo teksta</h3><p class="muted">${T() ? 'Student vidi isti izvještaj.' : 'Ovo je isti izvještaj koji vidi mentor.'} Opisuje nastanak teksta unutar Ducture. Ne otkriva alate izvan nje, ne utvrđuje podrijetlo ideja i ne razlikuje autora od osobe koja prepisuje tuđi tekst. Nije samostalan temelj disciplinskog postupka.</p>
      <div class="m3grid"><div>
        <div class="m3p"><div class="m3hd"><b>Sastav rada</b><span>${S.ev.length} događaja · ${String(c.tot).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} znakova</span></div><div class="m3head"><span class="n">${pct(c.p('unk'))}</span><span><b>nepoznato podrijetlo</b>Udio teksta za koji nema zapisa odakle je. Pitanje za razgovor, ne nalaz o prekršaju.</span></div>${stack(c)}<table class="m3comp">${c.rows.map(r => `<tr><td><i style="background:var(${KIND[r.k][1]})"></i>${esc(KIND[r.k][0])}</td><td class="num">${pct(r.pct)}</td></tr>`).join('')}</table></div>
        <div class="m3p"><div class="m3hd"><b>Rukopis po podrijetlu</b><span>${at == null ? 'kliknite dio teksta' : 'stanje u koraku ' + (at + 1) + ' od ' + sn.length + '; novo je označeno'}</span></div><div class="m3man">${man || '<p class="muted">Rad je prazan.</p>'}</div>
          <div class="m3rep">${sn.length > 1 ? `<button class="btn sm" data-act="m3Play">${U.m3play ? 'Pauza' : 'Reprodukcija'}</button><input type="range" id="m3scrub" min="0" max="${sn.length}" value="${at == null ? sn.length : at}" aria-label="Korak nastanka"><span class="muted">${at == null ? sn.length : at + 1} / ${sn.length}</span>` : '<span class="muted">Reprodukcija pokazuje korake zabilježene otkad je rad otvoren. Napišite nešto pa se vratite ovamo.</span>'}</div></div>
      </div><div>
        <div class="m3p"><div class="m3hd"><b>Pravila fakulteta</b><span>primjer pragova</span></div>${pol.map(r => { const st = r.ok ? 'ok' : r.hard ? 'bad' : 'chk'; return `<div class="m3rule"><span class="tag ${st === 'ok' ? 'ok' : 'warn'} m3${st}">${st === 'ok' ? 'u skladu' : st === 'chk' ? 'za pregled' : 'prekoračeno'}</span><span><b>${esc(r.n)}</b><span class="d">${esc(r.w)}</span></span></div>`; }).join('')}<p class="muted">Ovo je izjava o skladu s pravilima, ne ocjena studenta.${T() ? ' <button class="lnk" data-act="m3Pol">Promijeni pragove</button>' : ''}</p></div>
        <div class="m3p"><div class="m3hd"><b>Genealogija</b></div>${lineage(d.sel != null ? U.m3sp[d.sel] : null)}</div>
        <div class="m3p"><div class="m3hd"><b>Zapisnik događaja</b><span class="${bad ? 'm3badc' : 'm3okc'}">${bad ? 'lanac je prekinut na događaju ' + bad : 'lanac je ponovno izračunat i potvrđen'}</span></div><div class="m3log">${log || '<p class="muted">Još nema događaja.</p>'}</div>
          <label class="check m3sw"><input type="checkbox" data-act="m3Rh"${S.evRhythm ? ' checked' : ''}${T() ? ' disabled' : ''}><span>Bilježi ritam tipkanja${T() ? ' (uključuje i isključuje student)' : ''}</span></label><p class="muted">Bilježe se razmaci među pritiscima tipki, ne koje su tipke pritisnute. Otisak se u prototipu računa u pregledniku, a u sustavu na poslužitelju.</p></div>
      </div></div><div class="foot"><button class="btn pri" data-act="dlgClose">Zatvori</button></div>`;
  };
  let pT = null; const stopPlay = () => { clearTimeout(pT); pT = null; U.m3play = false; };
  Object.assign(ACT, {
    m3Prov: () => { stopPlay(); X.openDlg({ type: 'm3prov', wide: true, sel: null, at: null }); },
    m3Sel: el => { U.dlg.sel = +el.dataset.i; const sc = ($('#dlg .m3man') || {}).scrollTop; X.renderDlg(); const m = $('#dlg .m3man'); if (m) m.scrollTop = sc; },
    m3Rh: () => { S.evRhythm = !S.evRhythm; persist(); X.renderDlg(); toast(S.evRhythm ? 'Ritam tipkanja se bilježi.' : 'Ritam tipkanja se više ne bilježi.'); },
    m3Pol: () => X.fx.ask({ title: 'Pragovi', label: 'Nepoznato podrijetlo i tekst iz pomoćnika, u postocima', desc: 'Upišite dva broja odvojena razmakom. U Ducturi ih zadaje fakultet.', value: S.pol.unk + ' ' + S.pol.ai }, v => { const m = String(v).match(/\d+/g) || []; if (m.length < 2) return toast('Upišite dva broja.'); S.pol = { unk: Math.min(100, +m[0]), ai: Math.min(100, +m[1]) }; persist(); ACT.m3Prov(); }),
    m3Play: () => { const d = U.dlg, sn = snaps(); if (!d || d.type !== 'm3prov') return; if (U.m3play) { stopPlay(); return X.renderDlg(); } U.m3play = true; d.at = 0; d.sel = null; const step = () => { if (!U.dlg || U.dlg.type !== 'm3prov' || !U.m3play) return stopPlay(); X.renderDlg(); if (d.at >= sn.length - 1) { stopPlay(); d.at = null; return X.renderDlg(); } d.at++; pT = setTimeout(step, 700); }; step(); }
  });
  document.addEventListener('input', e => { if (e.target.id !== 'm3scrub' || !U.dlg) return; stopPlay(); const v = +e.target.value; U.dlg.at = v >= snaps().length ? null : v; U.dlg.sel = null; X.renderDlg(); const s = $('#m3scrub'); if (s) s.focus(); });

  /* ---------- 3. pregled runde ---------- */
  function round() {
    const r = S.review || {}, base = (r.status === 'review' && r.prev ? r.prev : r.snapshot) || [], old = new Set(base), cur = X.blocksText(), curS = new Set(cur), per = []; let h = null;
    cur.forEach(t => { if (/^# /.test(t)) { h = { t: t.slice(2), n: 0 }; per.push(h); if (!old.has(t)) h.n++; } else if (!old.has(t)) { if (!h) { h = { t: 'Početak rada', n: 0 }; per.push(h); } h.n++; } });
    const gone = base.filter(t => !curS.has(t)).length, mine = (S.comments || []).filter(c => c.role === 'teacher'), last = c => (c.replies || [])[(c.replies || []).length - 1];
    return { per: per.filter(x => x.n), gone, open: mine.filter(c => !c.resolved).length, done: mine.filter(c => c.resolved).length, ans: mine.filter(c => !c.resolved && last(c) && last(c).role === 'student').length, stu: (S.comments || []).filter(c => c.role !== 'teacher' && !c.resolved).length };
  }
  X.hooks.dlg.m3in = () => {
    flush(); const r = S.review, x = round(), d = D(), sp = spans(), c = comp(sp), qv = (d.qv || []).filter(v => !v.r.ok).length, pol = policy(c, sp).filter(p => !p.ok);
    const flags = [[qv, 'doslovni navod se ne slaže s izvorom', 'doslovna navoda se ne slažu s izvorom', 'doslovnih navoda se ne slaže s izvorom'], [(d.plain || []).length, 'navod je upisan kao tekst, bez veze s izvorom', 'navoda su upisana kao tekst', 'navoda je upisano kao tekst'], [(d.badCites || []).length, 'navod upućuje na izvor kojeg nema u popisu', 'navoda upućuju na izvor kojeg nema', 'navoda upućuje na izvor kojeg nema'], [(d.holes || []).length, 'mjesto je označeno za provjeru', 'mjesta su označena za provjeru', 'mjesta je označeno za provjeru'], [(d.claims || []).length, 'tvrdnja traži izvor', 'tvrdnje traže izvor', 'tvrdnji traži izvor']].filter(f => f[0]);
    const row = (n, t) => `<div class="m3row"><span class="n">${n}</span><span>${t}</span></div>`;
    return `<h3>Pregled runde ${r.round}</h3><p class="muted">${r.status === 'review' ? 'Student je poslao doradu. ' : ''}Sve ispod izračunato je iz teksta i zapisa u Ducturi, bez pomoćnika. Ništa od toga nije ocjena.</p>
      <div class="m3in"><div class="m3p"><div class="m3hd"><b>Što je novo</b></div>${x.per.length ? x.per.map(p => row(p.n, esc(p.t))).join('') : '<p class="muted">Nema izmijenjenih odlomaka od zadnjeg slanja.</p>'}${x.gone ? `<p class="muted">Uklonjeno ili prepisano odlomaka: ${x.gone}.</p>` : ''}<div class="row"><button class="btn sm" data-act="m3Read">Čitaj samo promjene</button><button class="btn sm" data-act="m3Hist">Usporedi predaje</button></div></div>
      <div class="m3p"><div class="m3hd"><b>Vaši komentari</b></div>${row(x.done, 'riješeno')}${row(x.open, 'još otvoreno')}${row(x.ans, 'student je odgovorio, čeka Vas')}${x.stu ? row(x.stu, 'pitanja koja je otvorio student') : ''}<div class="row"><button class="btn sm" data-act="m3Cmt">Otvori komentare</button></div></div>
      <div class="m3p"><div class="m3hd"><b>Što je sustav označio</b></div>${flags.length ? flags.map(f => row(f[0], plural(f[0], f[1], f[2], f[3]).replace(/^\d+\s*/, ''))).join('') : '<p class="muted">Ništa nije označeno.</p>'}<div class="row"><button class="btn sm" data-act="m3Pre">Otvori Pregled</button></div></div>
      <div class="m3p"><div class="m3hd"><b>Podrijetlo teksta</b></div>${stack(c)}${row(pct(c.p('unk')), 'nepoznato podrijetlo')}${row(pct(c.p('ai')), 'umetnuto iz pomoćnika')}${pol.length ? `<p class="m3note">Za pregled: ${pol.map(p => esc(p.n.toLowerCase())).join('; ')}.</p>` : ''}<div class="row"><button class="btn sm" data-act="m3Prov">Otvori izvještaj</button></div></div></div>
      <div class="foot">${r.status === 'review' ? '<button class="btn" data-act="m2Back">Vrati na doradu</button>' : ''}<button class="btn pri" data-act="m3InOk">U redu</button></div>`;
  };
  X.hooks.banner.push(() => T() && S.review.status === 'review' && S.m3seen !== S.review.round ? `<div class="banner"><span><b>Runda ${S.review.round} čeka Vaš pregled.</b> Pogledajte što je novo prije čitanja.</span><span class="grow"></span><button class="btn sm" data-act="m3In">Pregled runde</button></div>` : '');
  const go = (tab, f) => () => { S.m3seen = S.review.round; persist(); X.closeDlg(); if (tab) X.showTab(tab); if (f) f(); X.renderAll(true); };
  Object.assign(ACT, { m3In: () => X.openDlg({ type: 'm3in', wide: true }), m3InOk: go(), m3Cmt: go('cmt'), m3Pre: go('pre'), m3Read: go(null, () => { if (ACT.chNext) ACT.chNext(); }) });

  /* ---------- 4. komentari uz tekst ---------- */
  const svgEl = () => { let s = $('#m3lines'); if (!s) { s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.id = 'm3lines'; s.setAttribute('aria-hidden', 'true'); document.body.appendChild(s); } return s; };
  const wide = () => innerWidth > 1050;
  function align() {
    const pb = $('#pbody'), svg = svgEl(), on = S.m3align && S.tab === 'cmt' && wide() && !U.dlg && pb; let path = '';
    if (pb) { pb.classList.toggle('m3al', !!on); pb.querySelectorAll('.card[data-cid]').forEach(c => { c.style.transform = ''; c.style.visibility = ''; }); }
    if (on) {
      pb.scrollTop = 0; const stage = $('#stage').getBoundingClientRect(), box = pb.getBoundingClientRect(), sheet = $('#sheet').getBoundingClientRect(), cards = [...pb.querySelectorAll('.card[data-cid]')].map(c => { const a = document.querySelector(`#ed .cmt[data-c="${c.dataset.cid}"]`), ar = a && a.getClientRects()[0], r = c.getBoundingClientRect(); return { c, ar, top: r.top, h: r.height, left: r.left }; });
      let prev = cards.length ? Math.min(...cards.map(x => x.top)) : box.top; const vis = cards.filter(x => x.ar && x.ar.bottom > stage.top + 4 && x.ar.top < stage.bottom - 4).sort((a, b) => a.ar.top - b.ar.top);
      cards.forEach(x => { if (!vis.includes(x)) x.c.style.visibility = 'hidden'; });
      vis.forEach(x => { const pos = Math.max(x.ar.top - 10, prev); if (pos + Math.min(x.h, 60) > box.bottom) { x.c.style.visibility = 'hidden'; return; } x.c.style.transform = `translateY(${pos - x.top}px)`; prev = pos + x.h + 8; const y1 = x.ar.top + x.ar.height / 2, xr = sheet.right + 10, y2 = pos + 18; path += `<path d="M${x.ar.right + 2} ${y1} H${xr} L${x.left - 2} ${y2}"/>`; });
    }
    svg.innerHTML = path;
  }
  let aR = 0; const later = () => { if (!aR) aR = requestAnimationFrame(() => { aR = 0; align(); }); };
  RP.HK.cmtTop.push(c => wide() ? `<div class="row m3alrow"><button class="btn sm" data-act="m3Align" aria-pressed="${!!S.m3align}">Uz tekst</button><span class="muted">${S.m3align ? 'Vide se komentari uz dio teksta koji je na zaslonu.' : 'Poravnaj komentare s mjestom u tekstu.'}</span></div>` : '');
  ACT.m3Align = () => { S.m3align = !S.m3align; persist(); X.renderPanel(true); later(); };
  X.hooks.paint.push(later);
  const boot = () => { const st = $('#stage'), pb = $('#pbody'); if (!st || !pb) return setTimeout(boot, 300); st.addEventListener('scroll', later, { passive: true }); addEventListener('resize', later); new MutationObserver(later).observe(pb, { childList: true }); new MutationObserver(later).observe($('#dlg') || document.body, { childList: true, attributes: true }); later(); };
  setTimeout(boot, 0);

  /* ---------- 5. usporedba predaja ---------- */
  const today = () => { const d = new Date(); return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}.`; };
  function histAdd(label, blocks, w) { const b = blocks || X.blocksText(); if (b.join('\n').length > 400000) return; S.m3hist.push({ id: 'h' + Date.now().toString(36) + S.m3hist.length, label, when: w || today(), b }); if (S.m3hist.length > 8) S.m3hist.splice(1, 1); persist(); }
  function diff(A, B) { const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]); const ops = []; let i = 0, j = 0; while (i < n && j < m) { if (A[i] === B[j]) { ops.push(['=', A[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) ops.push(['-', A[i++]]); else ops.push(['+', B[j++]]); } while (i < n) ops.push(['-', A[i++]]); while (j < m) ops.push(['+', B[j++]]); return ops; }
  const words = (a, b) => { const A = a.split(/(\s+)/), B = b.split(/(\s+)/); if (A.length * B.length > 250000) return null; return diff(A, B).map(o => o[0] === '=' ? esc(o[1]) : o[0] === '+' ? `<ins>${esc(o[1])}</ins>` : `<del>${esc(o[1])}</del>`).join(''); };
  const pts = () => S.m3hist.concat([{ id: 'now', label: 'Trenutna verzija', when: 'sada', b: X.blocksText() }]);
  X.hooks.dlg.m3hist = d => {
    const P = pts(), a = P.find(p => p.id === d.a) || P[Math.max(0, P.length - 2)], b = P.find(p => p.id === d.b) || P[P.length - 1], ops = diff(a.b, b.b); let out = '', add = 0, del = 0, k = 0;
    while (k < ops.length) { const [op, t] = ops[k], nx = ops[k + 1]; if (op === '=') { if (/^# /.test(t)) out += `<h5>${esc(t.slice(2))}</h5>`; else if (!d.only) out += `<p class="same">${esc(t)}</p>`; k++; } else if (op === '-' && nx && nx[0] === '+' && !/^# /.test(t)) { const w = words(t, nx[1]); out += w ? `<p class="chg">${w}</p>` : `<p class="del">${esc(t)}</p><p class="add">${esc(nx[1])}</p>`; add++; del++; k += 2; } else { out += `<p class="${op === '+' ? 'add' : 'del'}">${esc(t.replace(/^# /, ''))}</p>`; if (op === '+') add++; else del++; k++; } }
    const sel = (key, cur) => `<select class="in" data-act-change="m3HistSet" data-k="${key}">${P.map(p => `<option value="${p.id}"${p.id === cur.id ? ' selected' : ''}>${esc(p.label)} · ${esc(p.when)}</option>`).join('')}</select>`;
    return `<h3>Usporedi predaje</h3><p class="muted">Točke su trenuci kad je rad poslan mentoru ili vraćen na doradu, ne svako spremanje.</p><div class="m3tl">${P.map(p => `<button data-act="m3HistPick" data-id="${p.id}" class="${p.id === a.id ? 'a' : p.id === b.id ? 'b' : ''}"><i></i><b>${esc(p.label)}</b><span>${esc(p.when)}</span></button>`).join('')}</div>
      <div class="m3hsel"><label>Od ${sel('a', a)}</label><label>Do ${sel('b', b)}</label><label class="check"><input type="checkbox" data-act="m3HistOnly"${d.only ? ' checked' : ''}><span>Samo promjene</span></label></div><p class="muted">${a.id === b.id ? 'Odabrali ste istu točku dvaput.' : `Dodano ili izmijenjeno odlomaka: ${add}. Uklonjeno ili izmijenjeno: ${del}.`}</p><div class="m3diff">${out || '<p class="muted">Nema razlike.</p>'}</div><div class="foot"><button class="btn pri" data-act="dlgClose">Zatvori</button></div>`;
  };
  Object.assign(ACT, { m3Hist: () => X.openDlg({ type: 'm3hist', wide: true, a: null, b: null, only: true }), m3HistOnly: () => { U.dlg.only = !U.dlg.only; X.renderDlg(); },
    m3HistPick: el => { const d = U.dlg, P = pts(), id = el.dataset.id; if (!d.a || (d.a && d.b && d._n)) { d.a = id; d.b = d.b || P[P.length - 1].id; d._n = 0; } else { d.b = id; d._n = 1; } const ia = P.findIndex(p => p.id === d.a), ib = P.findIndex(p => p.id === d.b); if (ia > ib) { const t = d.a; d.a = d.b; d.b = t; } X.renderDlg(); } });
  document.addEventListener('change', e => { const t = e.target; if (t.dataset && t.dataset.actChange === 'm3HistSet' && U.dlg) { U.dlg[t.dataset.k] = t.value; X.renderDlg(); } });

  /* ---------- 6. kriteriji ocjene ---------- */
  /* NF-6 (Daniel, 23. 11. 2026., odluka 5): kriteriji su rubrika BEZ BROJA i bez razina, vidljiva studentu od početka. Ocjena ostaje u Merlinu. Mentor smije dodati napomenu uz kriterij. */
  const rubric = () => { const t = T() && !S.submitted, done = S.rubric.filter(r => r.n).length, W = X.nf6 ? X.nf6.wrap : (k, h) => h; return `<details class="rpd m3rub" data-det="m3-rub" data-nf6="MK-1"${(U.det || {})['m3-rub'] ? ' open' : ''}><summary>Kriteriji rada · ${done} od ${S.rubric.length} s napomenom mentora</summary><div>${W('rubrika', S.rubric.map((r, i) => `<div class="m3cr" role="group" aria-label="Kriterij: ${esc(r.t)}"><b>${esc(r.t)}</b>${r.n ? `<p>${esc(r.n)}</p>` : '<p class="muted">Mentor još nije dodao napomenu.</p>'}${t ? `<button class="lnk" data-act="m3RubN" data-i="${i}">${r.n ? 'uredi napomenu' : '+ napomena'}</button>` : ''}</div>`).join('') + '<p class="muted">Kriteriji su rubrika bez broja i bez razina; vide ih student i mentor. Ocjenu upisujete u Merlin, a ovdje nijedna oznaka ne ulazi u ocjenu. Kriteriji su primjer; u Ducturi ih zadaje fakultet ili nastavnik.</p>')}</div></details>`; };
  Object.assign(ACT, { m3RubN: el => { const r = S.rubric[+el.dataset.i]; X.fx.ask({ title: 'Napomena uz kriterij', label: r.t, value: r.n, multi: true }, v => { r.n = String(v || '').trim(); (U.det = U.det || {})['m3-rub'] = true; persist(); X.renderPanel(true); }); } });
  /* ---------- ulazi u ploči Mentor i u naredbama ---------- */
  const v0 = RP.vRadX; if (v0) RP.vRadX = c => { let h = v0(c); const btn = `<button class="btn sm" data-act="m3Prov">Podrijetlo teksta</button><button class="btn sm" data-act="m3Hist">Usporedi predaje</button>${T() ? '<button class="btn sm" data-act="m3In">Pregled runde</button>' : ''}`; h = h.includes('<div class="row m2bar">') ? h.replace('<div class="row m2bar">', '<div class="row m2bar">' + btn) : `<div class="row m2bar">${btn}</div>` + h; return h + rubric(); };
  X.hooks.cmds.push(['podrijetlo', 'Podrijetlo teksta', 'kako je rad nastao; vide ga student i mentor', () => ACT.m3Prov()], ['predaje', 'Usporedi predaje', 'razlike između dva slanja', () => ACT.m3Hist()], ['runda', 'Pregled runde', 'za mentora: što je novo', () => ACT.m3In()]);
  wrap('sendDo', 'send', 'Poslano mentoru'); wrap('sendReview', 'send', 'Poslano mentoru'); wrap('m2BackSend', 'back', 'Vraćeno na doradu');
  X.m3 = { push, flush, verify, spans, comp, round, align, histAdd, seed() { if (!S.ev.length) push({ k: 'start', n: 0, x: 'tekst zatečen u radu' }); if (!S.m3hist.length && S.review && S.review.snapshot && S.review.snapshot.length) { const l = (S.review.log || [])[0]; histAdd(l ? l.what : 'Prva predaja', S.review.snapshot.slice(), l ? l.when : ''); } } };
  const sd = () => { if (!X.editor) return setTimeout(sd, 200); setTimeout(() => { U.m3mute = false; X.m3.seed(); }, 600); }; sd();
})();
