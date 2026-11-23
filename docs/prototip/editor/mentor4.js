/* Ductura Editor, prototip: NF-6 (mentorstvo i konzultacije), v0.29.
 * Zadatak nf6-prototip-mentorstvo; nalaz: docs/nalazi/nove-funkcije-6-mentorstvo-konzultacije.md (MK-1 do MK-17).
 * Danielove odluke 23. 11. 2026. (doslovno: „1 samo mentor, student čita 2. Unutar Ducture 3. Nisam siguran još 4. Mentorstvo otvara nastavnik 5. Da 6. Smije 7. Jesu 8. I na drugom računalu. Inače, sve u pilot”):
 *   svih 17 MK u pilotu; (1) zapisnik i dogovorene zadatke piše i dopunjuje samo mentor, student čita; (2) obrasci fakulteta i suglasnost mentora unutar Ducture;
 *   (4) mentorstvo otvara nastavnik, student ne traži mentora i vidi odluku i mentora; (5) kriteriji kao rubrika bez broja, vidljiva studentu, ocjena ostaje u Merlinu;
 *   (6) priprema uz zahtjev za termin uz napomenu „zapis o unosu, ne o autorstvu”; (7) kratke poruke mentor–student uz značku „novo”;
 *   (8) „Poruka sebi” i „Dokle sam stao” na poslužitelju (i na drugom računalu), vidi samo student, briše se na zahtjev studenta.
 * Ovaj modul: stanja svakog odjeljka (puno, prazno, učitavanje, greška) i njihov izbornik, odjeljak „Mentorstvo” (MK-7), izmišljeni primjeri, stanja Poruke sebi (MK-9).
 * Ostalo je u mentor2.js (kartica Mentor), mentor3.js (kriteriji), tools.js, features.js i toolbar2.js (Poruka sebi, Dokle sam stao).
 * Ništa se ne šalje: poslužitelj je simuliran izmišljenim odgovorima. Stanja se biraju u dijalogu „Stanja mentorstva” (kartica Mentor ili Ctrl+K) ili adresom #nf6=<odjeljak>:<stanje>.
 * Asistent u pilotu radi; pružatelj i model se ne imenuju (Q-10). Nema automatskog zaključka o autorstvu.
 */
(function () {
  'use strict';
  const X = window.DU, { S, U, ACT, esc, $, toast, persist } = X, T = () => S.mode === 'teacher';
  U.nf6 = { st: {} };
  X.hooks.defaults.push(s => {
    if (!s.nf6) s.nf6 = { seeded: false, mentSeen: false };
    const n = s.nf6;
    if (!n.ment) n.ment = { mentor: 'Nastavnik A', opened: '2. 11. 2026.', kind: 'završni rad', topic: 'Lokalni mediji i izborna kampanja' };
    if (!n.seeded) {
      n.seeded = true;
      if (!(s.kons || []).length) s.kons = [{ id: 'k-nf6a', when: '12. 11. 2026.', text: 'Dogovoreno: uže pitanje rada, tri izvora za poglavlje 2, prvi nacrt poglavlja 3 do sljedećih konzultacija.', by: 'teacher', add: [{ text: 'Dopuna: poglavlje 3 šaljete cijelo, ne po odlomcima.', when: '13. 11. 2026., 09:10' }] }, { id: 'k-nf6b', when: '5. 11. 2026.', text: 'Prva konzultacija: tema je potvrđena, rok prve etape je dogovoren.', by: 'teacher', add: [] }];
      if (!(s.msgs || []).length) s.msgs = [{ id: 'm-nf6a', who: 'Nastavnik A', role: 'teacher', when: '14. 11. 2026., 10:02', ts: Date.now() - 36e5, text: 'Poglavlje 2 je dobro, pogledajte komentare uz navode.' }, { id: 'm-nf6b', who: 'Student A', role: 'student', when: '14. 11. 2026., 18:20', ts: Date.now() - 18e5, text: 'Hvala, dorađujem do petka.' }];
      if (!(s.meet || []).length) s.meet = [{ id: 'mt-nf6a', when: '20. 11. 2026. u 12:30', topic: 'Struktura poglavlja 4 i izbor izvora', st: 'ask', by: 'student', prep: true }, { id: 'mt-nf6b', when: '27. 11. 2026. u 13:00', topic: 'Pregled cijelog nacrta', st: 'ok', by: 'student', prep: false }];
    }
  });

  /* ---------- tekstovi stanja po odjeljku (MK-17: jedan način pisanja, bez zabranjenih izraza) ---------- */
  const SEC = {
    mentorstvo: ['MK-7', 'Mentorstvo', 'Učitavam podatke o mentorstvu…', 'Podaci o mentorstvu trenutačno nisu dostupni. Pokušajte ponovno.', 'Nastavnik Vam još nije otvorio mentorstvo. Mentora ne tražite Vi; mentorstvo otvara nastavnik, a Vi vidite njegovu odluku i mentora ovdje.', 'Za ovog studenta mentorstvo nije otvoreno. Otvorite ga u „Radovi uz mentora”.'],
    stanje: ['MK-8', 'Stanje rada i dorada', 'Učitavam stanje rada…', 'Stanje rada trenutačno nije dostupno. Pokušajte ponovno.', 'Rad još nije započet.', 'Student još nije započeo rad.'],
    etape: ['MK-6', 'Etape i rokovi etapa', 'Učitavam etape…', 'Etape trenutačno nisu dostupne. Pokušajte ponovno.', 'Fakultet za ovaj rad nije zadao etape.', 'Za ovaj rad nema etapa. Primijenite predložak fakulteta u „Radovi uz mentora”.'],
    poruke: ['MK-1', 'Poruke mentor–student', 'Učitavam poruke…', 'Poruke trenutačno nisu dostupne. Ono što ste upisali je sačuvano.', 'Još nema poruka. Ovdje pišete mentoru kratke poruke koje nisu komentar uz tekst.', 'Još nema poruka. Ovdje pišete studentu kratke poruke koje nisu komentar uz tekst.'],
    termini: ['MK-2, MK-3', 'Termini konzultacija', 'Učitavam termine…', 'Nije poznato je li promjena zabilježena. Provjerite prikaz prije novog pokušaja. Ono što ste upisali je sačuvano.', 'Nema dogovorenih termina.', 'Student još nije zatražio konzultacije.'],
    zapisnik: ['MK-4, MK-5', 'Zapisnik konzultacija i dogovoreni zadaci', 'Učitavam zapisnik…', 'Zapisnik trenutačno nije dostupan. Pokušajte ponovno.', 'Mentor još nije upisao zapis konzultacija.', 'Još nema zapisa. Upišite dogovoreno dok je svježe; student čita zapisnik.'],
    prep: ['MK-10', 'Priprema za konzultacije', 'Slažem pripremu iz Vašeg rada…', 'Pripremu trenutačno nije moguće složiti. Tekst rada nije dirnut.', 'Priprema još nije složena. „Složi iz rada” je zapis o unosu u tekst, ne o autorstvu.', 'Student još nije priložio pripremu.'],
    kako: ['MK-1', 'Kako mentor radi', 'Učitavam…', 'Ovaj podatak trenutačno nije dostupan.', 'Mentor još nije upisao kako radi.', 'Još nije upisano.'],
    rubrika: ['MK-1', 'Kriteriji rada (bez broja)', 'Učitavam kriterije…', 'Kriteriji trenutačno nisu dostupni. Pokušajte ponovno.', 'Fakultet i mentor još nisu zadali kriterije.', 'Kriteriji još nisu zadani.'],
    obrasci: ['MK-12', 'Obrasci fakulteta i suglasnost mentora', 'Učitavam obrasce fakulteta…', 'Popis obrazaca trenutačno nije dostupan. Pokušajte ponovno.', 'Fakultet za ovaj rad ne traži obrasce.', 'Fakultet za ovaj rad ne traži obrasce.'],
    nakon: ['MK-14', 'Nakon predaje i obrana', 'Učitavam stanje nakon predaje…', 'Stanje nakon predaje trenutačno nije dostupno. Pokušajte ponovno.', 'Ovo se puni nakon predaje.', 'Ovo se puni nakon predaje.'],
    rokovi: ['MK-13', 'Vremenska crta rada', 'Učitavam rokove…', 'Rokovi trenutačno nisu dostupni. Pokušajte ponovno.', 'Još nema rokova ni događaja.', 'Još nema rokova ni događaja.'],
    moji: ['MK-11', 'Moji studenti', 'Učitavam popis studenata…', 'Popis trenutačno nije dostupan. Pokušajte ponovno.', 'Nemate mentorstava.', 'Nemate mentorstava.'],
    poruka: ['MK-9', 'Poruka sebi i Dokle sam stao', 'Dohvaćam Poruku sebi s poslužitelja…', 'Poruka sebi trenutačno nije dostupna. Tekst rada nije dirnut.', 'Nema spremljene poruke.', 'Nema spremljene poruke.'],
  };
  const ST = [['puno', 'Puno'], ['prazno', 'Prazno'], ['ucitavanje', 'Učitavanje'], ['greska', 'Greška']];
  const stateOf = k => (U.nf6.st[k] || 'puno');
  const DET = { mentorstvo: 'm4-ment', etape: 'm2-etape', poruke: 'm2-poruke', termini: 'm2-konz', zapisnik: 'm2-zap', prep: 'm2-prep', kako: 'm2-how', rubrika: 'm3-rub', obrasci: 'm2-obr', nakon: 'm2-aft' };

  /* wrap(ključ, html): puno vraća sadržaj, ostala stanja vraćaju odgovarajuću poruku (tekst + role, ne samo boja) */
  function wrap(k, html) {
    const s = stateOf(k), c = SEC[k]; if (s === 'puno' || !c) return html;
    if (s === 'ucitavanje') return `<p class="muted nf6-load" role="status" data-nf6="${c[0].split(',')[0]}" data-nf6-state="ucitavanje"><span class="nf6-dot" aria-hidden="true"></span>${c[2]}</p>`;
    if (s === 'greska') return `<div class="card nf6-err" role="alert" data-nf6="${c[0].split(',')[0]}" data-nf6-state="greska"><b>${c[3]}</b><div class="row" style="margin-top:6px"><button class="btn sm" data-act="nf6Retry" data-k="${k}">Pokušaj ponovno</button></div></div>`;
    return `<p class="muted nf6-empty" data-nf6="${c[0].split(',')[0]}" data-nf6-state="prazno">${T() ? c[5] : c[4]}</p>`;
  }

  /* MK-7: odjeljak „Mentorstvo”: mentorstvo otvara nastavnik, student vidi odluku i mentora */
  function mentorship(det) {
    const m = S.nf6.ment, nw = !T() && !S.nf6.mentSeen && stateOf('mentorstvo') === 'puno';
    const body = `<div class="card" role="group" aria-label="Mentorstvo"><div><span class="muted">Mentor:</span> <b>${esc(m.mentor)}</b></div><div><span class="muted">Vrsta rada:</span> <b>${esc(m.kind)}</b></div><div><span class="muted">Tema:</span> <b>${esc(m.topic)}</b></div><div><span class="muted">Mentorstvo je otvorio:</span> <b>nastavnik, ${esc(m.opened)}</b></div></div>` +
      (T() ? '<p class="muted">Mentorstvo otvarate Vi, u „Radovi uz mentora”. Student ne šalje zahtjev; vidi Vašu odluku i Vas kao mentora.</p>' : `<p class="muted">Mentora ne tražite Vi: mentorstvo otvara nastavnik. Obavijest o tome stiže samo u aplikaciji.</p>${nw ? '<div class="row"><span class="tag c2new">novo</span><button class="btn sm" data-act="nf6MentSeen">Pročitano</button></div>' : ''}`);
    return det('m4-ment', `Mentorstvo${nw ? ' · novo' : ''}`, wrap('mentorstvo', body), nw);
  }

  /* ---------- izbornik stanja (MK-16) ---------- */
  X.hooks.dlg.nf6sim = () => `<h3>Stanja mentorstva (prototip)</h3><p class="muted">Poslužitelj u prototipu ne postoji, pa se stanja biraju ovdje. Svaki odjeljak ima četiri stanja: puno, prazno, učitavanje i greška. Adresa #nf6=zapisnik:greska otvara stanje odmah.</p>` +
    Object.keys(SEC).map(k => `<div class="nf6-row" role="group" aria-label="${esc(SEC[k][1])}"><span class="nf6-lbl"><b>${esc(SEC[k][1])}</b> <span class="tag">${esc(SEC[k][0])}</span></span><span class="seg">${ST.map(([v, l]) => `<button data-act="nf6Set" data-k="${k}" data-v="${v}" aria-pressed="${stateOf(k) === v}">${l}</button>`).join('')}</span></div>`).join('') +
    '<div class="foot"><button class="btn" data-act="nf6Reset">Sve na puno</button><button class="btn pri" data-act="dlgClose">Zatvori</button></div>';
  function apply(k, v) {
    if (v === 'puno') delete U.nf6.st[k]; else U.nf6.st[k] = v;
    if (DET[k]) { (U.det = U.det || {})[DET[k]] = true; }
    if (k === 'poruka') { if (v === 'puno' && !S.noteSelf) { S.noteSelf = { text: 'sutra: dovrši primjer u poglavlju 2.2', pos: 5 }; } if (v === 'prazno') S.noteSelf = null; U.showNote = v === 'puno' && !!S.noteSelf; }
  }
  const rr = () => { X.renderAll(true); if (U.dlg && U.dlg.type === 'nf6sim') X.renderDlg(); };
  Object.assign(ACT, {
    nf6Sim: () => { X.closePop(); X.openDlg({ type: 'nf6sim', wide: true }); },
    nf6Set: el => { apply(el.dataset.k, el.dataset.v); rr(); if (el.dataset.k === 'rokovi' || el.dataset.k === 'moji') X.openDlg({ type: el.dataset.k === 'rokovi' ? 'm2time' : 'm2all' }); },
    nf6Reset: () => { U.nf6.st = {}; rr(); },
    nf6Retry: el => { const k = el.dataset.k; delete U.nf6.st[k]; X.renderAll(true); if (U.dlg && (U.dlg.type === 'm2time' || U.dlg.type === 'm2all')) X.renderDlg(); toast('Podaci su ponovno učitani.'); },
    nf6MentSeen: () => { S.nf6.mentSeen = true; persist(); X.renderAll(true); },
  });

  /* ---------- Poruka sebi i Dokle sam stao (MK-9): stanja uz poslužitelj ---------- */
  X.hooks.banner.push(() => {
    const s = stateOf('poruka'), b = (role, txt, btn) => `<div class="banner nf6-b" role="${role}" data-nf6="MK-9"><span>${txt}</span><span class="grow"></span>${btn || ''}</div>`;
    if (s === 'ucitavanje') return b('status', `<b>${SEC.poruka[2]}</b>`);
    if (s === 'greska') return b('alert', `<b>${SEC.poruka[3]}</b>`, '<button class="btn sm" data-act="nf6Retry" data-k="poruka">Pokušaj ponovno</button>');
    if (s === 'prazno') return b('status', `${SEC.poruka[4]} Poruku sebi i oznaku „Dokle sam stao” sprema poslužitelj; vidite ih samo Vi, i na drugom računalu.`);
    return '';
  });

  /* ---------- ulaz u karticu Mentor i u naredbe ---------- */
  const v0 = X.rp.vRadX;
  X.rp.vRadX = c => { let h = v0(c); const btn = '<button class="btn sm" data-act="nf6Sim">Stanja mentorstva</button>'; return h.includes('<div class="row m2bar">') ? h.replace('<div class="row m2bar">', '<div class="row m2bar">' + btn) : `<div class="row m2bar">${btn}</div>` + h; };
  const m2t0 = X.hooks.dlg.m2time, m2a0 = X.hooks.dlg.m2all;
  if (m2a0) X.hooks.dlg.m2all = d => (stateOf('moji') === 'puno' ? m2a0(d) : `<h3>Moji studenti <span class="tag nf6t" data-nf6="MK-11">NF-6</span></h3>${wrap('moji', '')}<div class="foot"><button class="btn pri" data-act="dlgClose">Zatvori</button></div>`);
  void m2t0;
  X.hooks.cmds.push(['nf6', 'Stanja mentorstva', 'prototip: puno, prazno, učitavanje, greška', () => ACT.nf6Sim()]);
  if (X.tb && X.tb.CMD) X.tb.CMD().push(['Stanja mentorstva', 'prototip', 'nf6Sim', null, 'w']);
  X.nf6 = { wrap, mentorship, SEC, apply, stateOf };
  X.hooks.paint.push(() => { const m = /nf6=([a-z]+):([a-z]+)/.exec(location.hash); if (m && SEC[m[1]] && !U.nf6.hash) { U.nf6.hash = 1; apply(m[1], m[2]); X.renderAll(true); } });
})();
