/* Ductura Editor, prototip: NF-2 (radni prostor i editor), v0.28.
 * Plan: ductura/.github docs/plan/NOVE-FUNKCIJE.md, „Odluke · NF-2”; nalaz: docs/nalazi/nove-funkcije-2-radni-prostor-editor.md.
 * Svih 26 prijedloga (P-1 do P-26) je u pilotu. Tablica P-n → INVENTAR ID → element je na kraju nalaza.
 *   1 stanja otvaranja, spremanja, mreže, sukoba, drugog uređaja i oporavka (P-1, P-2, P-3, P-18, P-21, P-26): traka obavijesti + dijalog „Stanja”
 *   2 zaglavlje: Povijest, Prečaci, prebacivač lista, Predaja rada s brojem blokada (P-5, P-14, P-17)
 *   3 statusna traka: opseg riječi i najave (P-2, P-6)
 *   4 Asistent isključen + pravila uporabe alata (P-9, P-10)
 *   5 izjava: stanje s poslužitelja, „što je zabilježeno”, dijalog iz editora (P-11, P-12), objašnjenje podudaranja (P-13)
 *   6 povijest i usporedba, vraćanje s pregledom razlike (P-14, P-15)
 *   7 Proba predaje sa stvarnim podacima (P-16), dohvat DOI/ISBN (P-7), zahtjevi nastavnika (P-8), uvoz iz datoteke (P-19)
 *   8 vodič „Prvi koraci” (P-20), sitnice (P-23), stil citiranja (P-24), ograničenja pilota (P-4, P-25)
 * Ništa se ne šalje: poslužitelj je u prototipu simuliran izmišljenim odgovorima. Stanja se biraju u dijalogu „Stanja radnog prostora”
 * (Prikaz ▾) ili adresom #nf2=<stanje>. Nijedna poruka ne tvrdi „spremljeno na poslužitelju” bez potpisane potvrde (B-6).
 */
(function () {
  'use strict';
  const X = window.DU, { S, U, ACT, esc, $, toast, persist, plural } = X, ed = () => X.editor, D = () => X.D, T = () => S.mode === 'teacher';
  const mi = X.fx.mi, fmtN = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const N = U.nf2 = { open: '', net: 'on', pend: 0, srv: false, conflict: false, stopped: false, other: '', recover: false, match: false, pilot: false, req: '', noRules: false, hist: 'ok', lk: '' };
  X.hooks.defaults.push(s => { if (!s.nf2) s.nf2 = {}; const n = s.nf2; if (n.onbSeen === undefined) n.onbSeen = false; if (!n.decl) n.decl = { use: null, tools: [], help: [], confirm: false, hash: '', touched: false, tool: '', purpose: '', phase: '', helpKind: 'language', helpText: '' }; if (!n.vers) n.vers = null; if (n.imported === undefined) n.imported = 0; });
  const offline = () => !navigator.onLine || N.net === 'off';
  const hash = s => { let a = 0; for (let i = 0; i < s.length; i++) a = (Math.imul(a, 31) + s.charCodeAt(i)) | 0; return String(a); };
  const textHash = () => { try { return hash(X.blocksText().join('\n')); } catch (e) { return ''; } };
  const live = document.createElement('div'); live.id = 'nf2live'; live.className = 'sr'; live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status'); document.body.appendChild(live);
  const say = t => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
  const rr = () => { X.renderAll(true); };

  /* ---------- 1. stanja (P-1, P-2, P-3, P-18, P-21, P-26) ---------- */
  const OPEN = {
    load: ['status', '<b>Otvaram rad…</b>', ''],
    slow: ['status', '<b>Još uvijek otvaram rad.</b> Ako se ništa ne promijeni, pokušajte ponovno. Tekst na ovom uređaju ostaje netaknut.', '<button class="lnk" data-act="nf2Retry">Pokušaj ponovno</button>'],
    empty: ['status', '<b>Rad još nije započet.</b> Započnite ga da biste mogli pisati.', '<button class="btn pri sm" data-act="nf2Start">Započni rad</button>'],
    scope: ['alert', '<b>Prijava više ne vrijedi</b>, pa se rad ne može otvoriti. Tekst na ovom uređaju ostaje netaknut.', '<button class="btn pri sm" data-act="nf2Login">Prijavi se</button>'],
    net: ['alert', '<b>Rad trenutačno nije moguće otvoriti.</b> Tekst na ovom uređaju ostaje netaknut.', '<button class="btn pri sm" data-act="nf2Retry">Pokušaj ponovno</button>'],
    upgrade: ['alert', '<b>Ova verzija stranice više ne može otvoriti rad.</b> Učitajte je ponovno. Tekst na ovom uređaju ostaje netaknut.', '<button class="btn pri sm" data-act="nf2Reload">Učitaj ponovno</button>'],
    closed: ['alert', '<b>Obavijest zadatka se promijenila ili zadatak trenutačno ne prima rad.</b>', '<button class="btn sm" data-act="nf2Notice">Pročitaj obavijest zadatka</button>'],
  };
  X.hooks.banner.push(() => {
    let h = ''; const b = (role, txt, btns, cls) => `<div class="banner nf2-b${cls ? ' ' + cls : ''}" role="${role}"><span>${txt}</span><span class="grow"></span>${btns || ''}</div>`;
    const o = OPEN[N.open]; if (o) h += b(o[0], o[1], o[2]);
    if (N.recover) h += b('status', '<b>Na ovom uređaju čuva se Vaš tekst od prethodne odjave</b> (23. 11. 2026., 14:05).', '<button class="btn pri sm" data-act="nf2Rec" data-v="go">Nastavi rad</button><button class="btn sm" data-act="nf2Rec" data-v="copy">Preuzmi kopiju teksta</button><button class="lnk" data-act="nf2Rec" data-v="hide">Sakrij obavijest</button>');
    if (N.conflict) h += b('alert', '<b>Rad na poslužitelju razlikuje se od teksta na ovom uređaju.</b> Tekst ostaje na uređaju i ništa se ne šalje dok ne odlučite kako dalje.', '<button class="btn sm" data-act="nf2Export">Izvezi tekst</button><button class="btn pri sm" data-act="nf2Conf">Odluči…</button>');
    if (N.stopped) h += b('alert', '<b>Slanje na poslužitelj je zaustavljeno.</b> Tekst je i dalje na ovom uređaju.', '<button class="btn pri sm" data-act="nf2Export">Izvezi tekst</button><button class="btn sm" data-act="nf2Prob">Javi problem</button>');
    if (N.net === 'off') h += b('status', `<b>Bez mreže.</b> Tekst se i dalje sprema na ovom uređaju. Slanje na poslužitelj nastavlja se kad se mreža vrati.${N.pend ? ' Čeka slanje: ' + N.pend + ' ' + plural(N.pend, 'izmjena', 'izmjene', 'izmjena') + '.' : ''}`);
    if (N.net === 'back') h += b('status', `<b>Veza je vraćena.</b> Šalje se ${N.pend || 1} ${plural(N.pend || 1, 'izmjena', 'izmjene', 'izmjena')}.`);
    if (N.other) h += b('status', `<b>Rad je otvoren na drugom uređaju (${esc(N.other)}).</b> Zadnje spremanje tamo: 14:32. Ova kartica ništa ne sprema dok je druga otvorena.`);
    if (N.match) h += b('status', '<b>Dio teksta podudara se s odgovorom pomoćnika.</b> Ovo je obična usporedba teksta i ništa ne govori o autorstvu.', '<button class="lnk" data-act="nf2Expl">Objasni, ako želiš…</button>');
    return h;
  });
  const PRESET = { puno: { open: '' }, ucitavanje: { open: 'load' }, sporo: { open: 'slow' }, prazno: { open: 'empty' }, prijava: { open: 'scope' }, mreza: { open: 'net' }, verzija: { open: 'upgrade' }, zatvoreno: { open: 'closed' }, offline: { net: 'off', pend: 3 }, povratak: { net: 'back', pend: 3 }, posluzitelj: { srv: true }, sukob: { conflict: true }, zaustavljeno: { stopped: true }, uredaj: { other: 'mobitel' }, oporavak: { recover: true }, podudaranje: { match: true }, pilot: { pilot: true }, zahtjevi: { req: 'ok' }, zahtjevi_ucitavanje: { req: 'load' }, zahtjevi_greska: { req: 'err' }, zahtjevi_prazno: { req: 'none' }, bez_pravila: { noRules: true }, povijest_prazno: { hist: 'empty' }, povijest_jedna: { hist: 'single' }, povijest_ucitavanje: { hist: 'load' }, povijest_greska: { hist: 'err' } };
  function apply(k) {
    if (k === 'reset') { Object.assign(N, { open: '', net: 'on', pend: 0, srv: false, conflict: false, stopped: false, other: '', recover: false, match: false, pilot: false, req: '', noRules: false, hist: 'ok' }); return; }
    const p = PRESET[k]; if (!p) return; Object.assign(N, p);
    if (p.net === 'back') setTimeout(() => { if (N.net === 'back') { N.net = 'on'; N.pend = 0; say('Veza je vraćena.'); rr(); } }, 5000);
  }
  X.nf2 = { apply, N, PRESET };
  Object.assign(ACT, {
    nf2Set: el => { apply(el.dataset.v); pilotCmds(); rr(); if (U.dlg && U.dlg.type === 'nf2sim') X.renderDlg(); },
    nf2Retry: () => { N.open = 'load'; rr(); setTimeout(() => { N.open = ''; rr(); toast('Rad je otvoren.'); }, 900); },
    nf2Start: () => { N.open = 'load'; rr(); setTimeout(() => { N.open = ''; rr(); toast('Rad je otvoren. Jezik rada: hrvatski. Pravila fakulteta: verzija 1.'); }, 900); },
    nf2Login: () => { N.open = ''; rr(); toast('Prototip: prijava ide kroz AAI@EduHr (D-09), ovdje se ne radi.'); },
    nf2Reload: () => { N.open = ''; rr(); toast('Stranica je učitana ponovno.'); },
    nf2Notice: () => { N.open = ''; rr(); X.openDlg({ type: 'notice' }); },
    nf2Rec: el => { const v = el.dataset.v; if (v === 'copy') { toast('Kopija teksta je preuzeta (prototip).'); return; } N.recover = false; rr(); if (v === 'go') toast('Nastavlja se rad od 23. 11. 2026., 14:05.'); },
    nf2Export: () => { X.closePop(); ACT.copy(); },
    nf2Prob: () => X.openDlg({ type: 'nf2prob' }),
    nf2Sim: () => { X.closePop(); X.openDlg({ type: 'nf2sim', wide: true }); },
    nf2Conf: () => X.openDlg({ type: 'nf2conf', step: 0 }),
    nf2ConfNext: () => { U.dlg.step = 1; X.renderDlg(); },
    nf2ConfBack: () => { U.dlg.step = 0; X.renderDlg(); },
    nf2ConfKeep: () => { N.conflict = false; X.closeDlg(); rr(); toast('Prototip: nova revizija s ovog uređaja čeka potvrdu poslužitelja.'); },
    nf2ConfView: () => { X.closeDlg(); X.openDlg({ type: 'nf2hist', sel: 9, server: true, mode: 'view' }); },
    nf2ProbSend: () => { X.closeDlg(); toast('Prijava je poslana. U nju je ušla samo oznaka stanja, ne tekst rada.'); },
    nf2Expl: () => X.openDlg({ type: 'nf2expl' }),
    nf2ExplSend: () => { const t = ($('#nf2ex') || {}).value || ''; if (!t.trim()) return toast('Upišite objašnjenje ili zatvorite prozor.'); X.closeDlg(); toast('Objašnjenje je zabilježeno uz nalaz. Vidi ga i nastavnik.'); },
  });
  X.hooks.dlg.nf2prob = () => `<h3>Javi problem</h3><p class="muted">U prijavu ide samo oznaka stanja i inačica stranice. Tekst rada se ne šalje.</p><div class="card"><div class="meta">Oznaka stanja</div><div class="mono">syncState: stopped</div><div class="meta" style="margin-top:6px">Vrsta</div><div>tehnički problem</div></div><label class="f">Što ste radili (neobavezno)</label><textarea class="ta" rows="3" maxlength="1000" placeholder="Npr. tipkao sam kad se veza prekinula."></textarea><div class="foot"><button class="btn" data-act="dlgClose">Odustani</button><button class="btn pri" data-act="nf2ProbSend">Pošalji prijavu</button></div>`;
  X.hooks.dlg.nf2expl = () => `<h3>Objasni, ako želiš</h3><p class="muted">Napiši kako je taj dio nastao. Nije obvezno, ne blokira predaju i ne ulazi u ocjenu. Isto vidi i nastavnik.</p><textarea class="ta" id="nf2ex" rows="4" maxlength="2000" aria-label="Objašnjenje"></textarea><div class="foot"><button class="btn" data-act="dlgClose">Zatvori</button><button class="btn pri" data-act="nf2ExplSend">Pošalji objašnjenje</button></div>`;
  X.hooks.dlg.nf2conf = d => d.step === 0
    ? `<h3>Sukob: što dalje?</h3><p>Rad na poslužitelju razlikuje se od teksta na ovom uređaju. Ništa se ne briše. Najprije izvezite tekst, ako želite sigurnu kopiju.</p><div class="fx"><span style="flex:1"><b>1. Izvezi tekst</b><span class="d">Kopija teksta s ovog uređaja.</span></span><button class="btn sm" data-act="nf2Export">Izvezi tekst</button></div><div class="fx"><span style="flex:1"><b>2. Pogledaj verziju s poslužitelja</b><span class="d">Samo za čitanje, uz razliku prema Vašem tekstu.</span></span><button class="btn sm" data-act="nf2ConfView">Pogledaj</button></div><div class="fx"><span style="flex:1"><b>3. Zadrži tekst s ovog uređaja</b><span class="d">Nastaje nova revizija iznad poslužiteljske. Ranije se ne brišu.</span></span><button class="btn sm" data-act="nf2ConfNext">Zadrži…</button></div><p class="muted">Prototip: poslužitelj danas javlja sukob (stale_base, chain_conflict), ali nema operacije za ovu odluku. Vidi INVENTAR-editor §5, NF2-P3.</p><div class="foot"><button class="btn" data-act="dlgClose">Zatvori</button></div>`
    : `<h3>Zadržati tekst s ovog uređaja?</h3><p>Vaš tekst postaje najnovija revizija. Verzija s poslužitelja ostaje u povijesti i može se vratiti.</p><div class="foot"><button class="btn" data-act="nf2ConfBack">Natrag</button><button class="btn pri" data-act="nf2ConfKeep">Da, zadrži</button></div>`;

  const SIM = [
    ['Otvaranje rada (P-1)', [['puno', 'Puno'], ['ucitavanje', 'Učitavanje'], ['sporo', 'Sporo učitavanje'], ['prazno', 'Prazno'], ['prijava', 'Greška: prijava'], ['mreza', 'Greška: mreža'], ['verzija', 'Greška: stara stranica'], ['zatvoreno', 'Zadatak ne prima rad']]],
    ['Mreža i spremanje (P-2, P-3, P-18)', [['offline', 'Bez mreže'], ['povratak', 'Veza vraćena'], ['posluzitelj', 'Spremljeno na poslužitelju'], ['sukob', 'Sukob'], ['zaustavljeno', 'Slanje zaustavljeno']]],
    ['Uređaj i oporavak (P-21, P-26)', [['uredaj', 'Drugi uređaj'], ['oporavak', 'Ponuda oporavka']]],
    ['Izvori i pravila (P-8, P-16)', [['zahtjevi', 'Zahtjevi nastavnika'], ['zahtjevi_ucitavanje', 'Učitavanje'], ['zahtjevi_greska', 'Greška'], ['zahtjevi_prazno', 'Prazno'], ['bez_pravila', 'Fakultet nije objavio pravila']]],
    ['Povijest (P-14, P-15)', [['povijest_prazno', 'Nema verzija'], ['povijest_jedna', 'Jedna verzija'], ['povijest_ucitavanje', 'Učitavanje'], ['povijest_greska', 'Greška']]],
    ['Ostalo', [['podudaranje', 'Podudaranje s pomoćnikom (P-13)'], ['pilot', 'Ograničenja pilota (P-4, P-25)']]],
  ];
  X.hooks.dlg.nf2sim = () => `<h3>Stanja radnog prostora (prototip)</h3><p class="muted">Poslužitelj u prototipu ne postoji, pa se stanja biraju ovdje. Dijalog ostaje otvoren da vidite traku iznad lista. Adresa #nf2=offline otvara stanje odmah.</p>${SIM.map(([t, l]) => `<div class="ptitle">${t}</div><div class="row">${l.map(([k, n]) => `<button class="chip${isOn(k) ? ' done' : ''}" aria-pressed="${isOn(k)}" data-act="nf2Set" data-v="${k}">${n}</button>`).join('')}</div>`).join('')}<div class="foot"><button class="btn" data-act="nf2Set" data-v="reset">Sve na zadano</button><button class="btn pri" data-act="dlgClose">Gotovo</button></div>`;
  function isOn(k) { const p = PRESET[k]; return !!p && Object.keys(p).every(f => N[f] === p[f]); }

  /* ---------- 2. zaglavlje (P-5, P-14, P-17, WEB-23) ---------- */
  function header() {
    const top = $('.top'); if (!top || $('.nf2h')) return;
    const g = document.createElement('div'); g.className = 'nf2h';
    g.innerHTML = '<button class="btn sm nf2-opt" data-act="nf2Hist" title="Povijest i usporedba">Povijest</button><button class="btn sm nf2-opt" data-act="tbKeys" title="Prečaci (Ctrl+/)">Prečaci</button><button class="btn sm nf2-opt" data-act="nf2Sheet" id="nf2Sheet"></button><span class="nf2-sub" id="nf2Sub"></span>';
    top.insertBefore(g, top.querySelector('.only-mid') || null);
  }
  function headerPaint() {
    const g = $('.nf2h'); if (!g) return; const dark = S.sheet === 'dark', sh = $('#nf2Sheet');
    if (sh) { sh.textContent = dark ? 'Tamni list' : 'Bijeli list'; sh.setAttribute('aria-pressed', String(dark)); sh.title = 'Prebaci boju lista'; }
    const sub = $('#nf2Sub'); if (!sub) return;
    if (T() || S.submitted) { sub.innerHTML = ''; return; }
    let n = 0; try { n = X.runChecks().filter(f => f.sev === 'block').length; } catch (e) { n = 0; }
    const off = offline(), lab = n ? `Predaja rada: ${n} ${plural(n, 'stvar', 'stvari', 'stvari')} prije predaje` : 'Predaja rada';
    const key = off + '|' + n; if (sub.dataset.k === key) return; sub.dataset.k = key;
    sub.innerHTML = off ? `<button class="btn pri sm" disabled aria-disabled="true" aria-describedby="nf2Off" aria-label="${lab}"><span class="w">Predaja rada</span><span class="s">Predaja</span></button><span id="nf2Off" class="sr">Predaja rada traži vezu s mrežom.</span><span class="nf2-note">Predaja rada traži vezu s mrežom.</span>`
      : `<button class="btn pri sm" data-act="submit" aria-label="${lab}"><span class="w">Predaja rada</span><span class="s">Predaja</span>${n ? `<b class="nf2n">${n}</b>` : ''}</button>${n ? `<span class="nf2-note">${n} ${plural(n, 'stvar', 'stvari', 'stvari')} prije predaje</span>` : ''}`;
  }
  X.hooks.paint.push(headerPaint);
  Object.assign(ACT, { nf2Sheet: () => { S.sheet = S.sheet === 'dark' ? 'light' : 'dark'; persist(); rr(); }, nf2Hist: () => { X.closePop(); X.openDlg({ type: 'nf2hist', mode: 'list' }); } });

  /* ---------- 3. statusna traka: spremanje, opseg (P-2, P-6) ---------- */
  const st0 = X.render.status; let lvl = '', rng = '';
  X.render.status = function () {
    st0(); const st = $('#status'); if (!st) return; const first = st.firstElementChild, d = D();
    const level = N.conflict || N.stopped ? 'error' : offline() ? 'offline' : N.srv ? 'server' : 'device';
    if (first && !U.otherTab && !N.other) {
      if (level === 'offline') first.innerHTML = `<span class="dot local"></span>Izvan mreže · Spremljeno na uređaju${N.pend ? ' · čeka slanje: ' + N.pend + ' ' + plural(N.pend, 'izmjena', 'izmjene', 'izmjena') : ''}`;
      else if (level === 'error') first.innerHTML = `<span class="dot err"></span>${N.conflict ? 'Sukob' : 'Greška'}`;
      else if (level === 'server' && U.save !== 'saving') first.innerHTML = '<span class="dot ok"></span>Spremljeno na poslužitelju';
    }
    if (N.other && first) first.innerHTML = '<span class="dot"></span>Otvoreno na drugom uređaju · samo čitanje';
    const sp = [...st.querySelectorAll('span')].find(s => /riječi/.test(s.textContent) && /\//.test(s.textContent));
    const w = d.words, mn = TASKmin(), mx = TASKmax(), r = w < mn ? 'below' : w > mx ? 'above' : 'in';
    if (sp && !T()) sp.insertAdjacentHTML('beforeend', ` · <span class="nf2-rng" data-r="${r}">${r === 'below' ? 'još ' + fmtN(mn - w) + ' do donje granice' : r === 'above' ? 'iznad gornje granice za ' + fmtN(w - mx) : 'unutar opsega'}</span>`);
    const msg = { device: 'Spremljeno na uređaju.', server: 'Spremljeno na poslužitelju.', error: N.conflict ? 'Sukob: tekst ostaje na uređaju.' : 'Slanje je zaustavljeno. Tekst je na uređaju.', offline: 'Izvan mreže. Tekst se sprema na uređaju.' };
    if (lvl && lvl !== level) say(msg[level]); lvl = level;
    if (rng && rng !== r) say(r === 'below' ? 'Opseg: niste dosegli donju granicu.' : r === 'above' ? 'Opseg: prešli ste gornju granicu za ' + fmtN(w - mx) + ' riječi.' : 'Opseg: unutar granica.'); rng = r;
  };
  const TASKmin = () => X.TASK.min, TASKmax = () => X.TASK.max;
  X.hooks.tx.push(tr => { if (tr.docChanged && offline()) N.pend = Math.min(99, N.pend + 1); });
  addEventListener('offline', () => { N.pend = N.pend || 0; rr(); });
  addEventListener('online', () => { if (N.pend) { N.net = 'back'; setTimeout(() => { if (N.net === 'back') { N.net = 'on'; N.pend = 0; say('Veza je vraćena.'); rr(); } }, 5000); } rr(); });

  /* ---------- 4. Asistent isključen + pravila uporabe alata (P-9, P-10) ---------- */
  const NOTICE = { policy: 'partially_allowed', purposes: [['formatting', 'formatiranje', 1], ['proofreading', 'lektura i jezična provjera', 1], ['literature_search', 'traženje literature', 1], ['transcription', 'transkripcija', 0], ['translation', 'prijevod', 1]] };
  const POL = { prohibited: 'Alati nisu dopušteni.', partially_allowed: 'Alati su djelomično dopušteni.', encouraged: 'Alati su dopušteni.' };
  function aiCard() {
    return `<div class="ptitle">Asistent <span class="tag">isključen u pilotu</span></div><p>Asistent u ovom pilotu nije uključen. Nema razgovora koji bi se bilježio i ništa se ne šalje nikamo. Kad ga ustanova uključi, ova će kartica to jasno reći.</p>
    <div class="ptitle">Pravila za ovaj zadatak</div><div class="card"><p style="margin:0 0 6px"><b>${POL[NOTICE.policy]}</b></p>${NOTICE.purposes.map(([, l, ok]) => `<div class="nf2-pur"><span class="${ok ? 'nf2-y' : 'nf2-n'}" aria-hidden="true">${ok ? '✓' : '×'}</span><span>${l}<span class="sr"> · ${ok ? 'dopušteno' : 'nije dopušteno'}</span></span></div>`).join('')}</div>
    <p class="muted">Alate koje koristite izvan Ducture navedite u izjavi pri predaji.</p><div class="row"><button class="btn sm" data-act="nf2Notice">Pročitaj obavijest zadatka</button><button class="btn sm" data-act="nf2Decl">Izjava o korištenju alata</button></div>`;
  }
  X.panels.ai = aiCard; if (X.rp) X.rp.vAi = aiCard;

  /* ---------- 5. izjava (P-11, P-12) ---------- */
  const decl = () => S.nf2.decl;
  function declState() { const d = decl(); if (!d.touched) return 'none'; if (!d.confirm) return 'draft'; return d.hash === textHash() ? 'confirmed' : 'stale'; }
  const DS = { none: ['Nije ispunjena.', ''], draft: ['Nacrt, još nije potvrđena.', 'warn'], confirmed: ['Potvrđena za ovu verziju teksta.', 'ok'], stale: ['Tekst se promijenio nakon potvrde. Potvrdite je ponovno pri predaji.', 'warn'], bound: ['Vezana uz predani rad.', 'ok'] };
  const declText = () => { const s = S.submitted ? 'bound' : declState(); return DS[s][0]; };
  const HK = { language: 'jezik', structure: 'struktura', sources: 'izvori', content: 'sadržaj', technical: 'tehnika', other: 'drugo' };
  X.hooks.dlg.nf2decl = d => {
    const c = decl(), s = S.submitted ? 'bound' : declState(), ro = !!S.submitted || T();
    return `<h3>Izjava o korištenju alata</h3><p class="muted">Obrazac je test-izjava fakulteta (verzija 1). Potvrđujete je pri predaji; ovdje je možete pripremiti ranije i ažurirati čim upotrijebite alat.</p><p><span class="tag ${DS[s][1]}">${DS[s][0]}</span></p>
    <div class="ptitle">Što je zabilježeno u Ducturi</div><div class="fx"><span style="flex:1"><b>Prijenosi iz pomoćnika</b></span><span>0</span></div><div class="fx"><span style="flex:1"><b>Razgovori bez prijenosa</b></span><span>0</span></div><div class="fx"><span style="flex:1"><b>Prilozi</b></span><span>0</span></div><p class="muted">Asistent u pilotu nije uključen, pa ovdje nema zapisa. Prikazuje se samo ono što je Ductura zabilježila; vi dodajete ono što je bilo izvan nje.</p>
    <div class="ptitle">Alati izvan Ducture</div><label class="check"><input type="radio" name="nf2use" data-act="nf2Use" data-v="not_used"${c.use === 'not_used' ? ' checked' : ''}${ro ? ' disabled' : ''}><span>Nisam koristio/la alate umjetne inteligencije</span></label><label class="check"><input type="radio" name="nf2use" data-act="nf2Use" data-v="used"${c.use === 'used' ? ' checked' : ''}${ro ? ' disabled' : ''}><span>Koristio/la sam alate</span></label>
    ${c.use === 'used' ? `${c.tools.map((t, i) => `<div class="fx"><span style="flex:1"><b>${esc(t.label)}</b><span class="d">${esc(t.purpose)} · ${esc(t.phase)}</span></span>${ro ? '' : `<button class="lnk" data-act="nf2ToolDel" data-i="${i}">Ukloni</button>`}</div>`).join('')}${ro || c.tools.length >= 8 ? '' : `<div class="row"><input class="in" style="flex:1;min-width:110px" data-bind="S.nf2.decl.tool" value="${esc(c.tool)}" placeholder="Alat, npr. DeepL" maxlength="120" aria-label="Alat"><input class="in" style="flex:1;min-width:110px" data-bind="S.nf2.decl.purpose" value="${esc(c.purpose)}" placeholder="Svrha" maxlength="200" aria-label="Svrha"><input class="in" style="flex:1;min-width:110px" data-bind="S.nf2.decl.phase" value="${esc(c.phase)}" placeholder="Faza rada" maxlength="200" aria-label="Faza rada"><button class="btn sm" data-act="nf2ToolAdd">Dodaj</button></div>`}` : ''}
    <div class="ptitle">Pomoć drugih osoba</div>${c.help.map((h, i) => `<div class="fx"><span style="flex:1"><b>${HK[h.kind]}</b><span class="d">${esc(h.text)}</span></span>${ro ? '' : `<button class="lnk" data-act="nf2HelpDel" data-i="${i}">Ukloni</button>`}</div>`).join('') || '<p class="muted">Nije navedena.</p>'}${ro ? '' : `<div class="row"><select class="in" data-bind="S.nf2.decl.helpKind" aria-label="Vrsta pomoći">${Object.entries(HK).map(([k, v]) => `<option value="${k}"${c.helpKind === k ? ' selected' : ''}>${v}</option>`).join('')}</select><input class="in" style="flex:1;min-width:120px" data-bind="S.nf2.decl.helpText" value="${esc(c.helpText)}" placeholder="Što je tko napravio" maxlength="300" aria-label="Opis pomoći"><button class="btn sm" data-act="nf2HelpAdd">Dodaj</button></div>`}
    <p class="muted">Izjava ne govori ništa o tome kako je rad nastao, nego bilježi što ste naveli. Ne blokira pisanje.</p><div class="foot"><button class="btn" data-act="dlgClose">Zatvori</button>${ro ? '' : `<button class="btn" data-act="nf2DeclSave">Spremi nacrt</button><button class="btn pri" data-act="nf2DeclOk"${offline() ? ' disabled title="Potvrda traži vezu s mrežom."' : ''}>Potvrđujem izjavu</button>`}</div>`;
  };
  const dl = () => { if (U.dlg && U.dlg.type === 'nf2decl') X.renderDlg(); };
  Object.assign(ACT, {
    nf2Decl: () => { X.closePop(); X.openDlg({ type: 'nf2decl', wide: true }); },
    nf2Use: el => { const c = decl(); c.use = el.dataset.v; c.touched = true; c.confirm = false; persist(); dl(); },
    nf2ToolAdd: () => { const c = decl(); if (!c.tool.trim() || !c.purpose.trim()) return toast('Upišite alat i svrhu.'); c.tools.push({ label: c.tool.trim(), purpose: c.purpose.trim(), phase: (c.phase || 'cijeli rad').trim() }); c.tool = c.purpose = c.phase = ''; c.touched = true; c.confirm = false; persist(); dl(); },
    nf2ToolDel: el => { decl().tools.splice(+el.dataset.i, 1); decl().confirm = false; persist(); dl(); },
    nf2HelpAdd: () => { const c = decl(); if (!c.helpText.trim()) return toast('Upišite što je tko napravio.'); c.help.push({ kind: c.helpKind, text: c.helpText.trim() }); c.helpText = ''; c.touched = true; c.confirm = false; persist(); dl(); },
    nf2HelpDel: el => { decl().help.splice(+el.dataset.i, 1); decl().confirm = false; persist(); dl(); },
    nf2DeclSave: () => { decl().touched = true; persist(); X.closeDlg(); rr(); toast('Nacrt izjave je spremljen na uređaju.'); },
    nf2DeclOk: () => { const c = decl(); if (c.use === null) return toast('Odaberite jesu li korišteni alati.'); c.touched = true; c.confirm = true; c.hash = textHash(); persist(); X.closeDlg(); rr(); toast('Izjava je potvrđena za ovu verziju teksta (prototip: bez potpisa poslužitelja).'); },
  });
  const rePanel = f => (...a) => String(f(...a)).replace(/(<b>Izjava o korištenju AI-ja<\/b><span class="d">)[^<]*(<\/span><\/span>)(<\/div>)/, `$1${declText()}$2<button class="btn sm" data-act="nf2Decl">Otvori</button>$3`);
  X.panels.rad = rePanel(X.panels.rad);

  /* ---------- 6. povijest i usporedba, vraćanje (P-14, P-15) ---------- */
  const V0 = () => [{ kind: 'checkpoint', rev: 9, at: '23. 11. 2026., 14:20', words: 2140 }, { kind: 'checkpoint', rev: 8, at: '22. 11. 2026., 21:02', words: 2105, from: 4 }, { kind: 'submission', rev: 6, at: '20. 11. 2026., 18:05', words: 1980, n: 2 }, { kind: 'checkpoint', rev: 4, at: '18. 11. 2026., 09:40', words: 1620 }, { kind: 'submission', rev: 2, at: '16. 11. 2026., 18:20', words: 1210, n: 1 }];
  const vers = () => { const h = N.hist; if (h === 'empty') return []; if (h === 'single') return V0().slice(0, 1); if (!S.nf2.vers) S.nf2.vers = V0(); return S.nf2.vers; };
  const vname = v => v.kind === 'submission' ? `Predaja ${v.n}` : `Verzija ${v.rev}`;
  const BL = [['unchanged', 'heading', 'Uvod'], ['removed', 'paragraph', 'Čitanje naglas često se opisuje kao jednostavna praksa.'], ['added', 'paragraph', 'Čitanje naglas često se opisuje kao jednostavna i jeftina praksa koja djeci otvara svijet knjige.'], ['unchanged', 'paragraph', 'Ovaj rad pita koliko je ta praksa povezana s razvojem rječnika.'], ['added', 'paragraph', 'Rječnik se ovdje shvaća kao broj riječi koje dijete razumije i koristi.'], ['removed', 'heading', 'Teorijski okvir']];
  const diffHtml = bl => bl.map(([c, k, t]) => { const x = k === 'heading' ? `<b>${esc(t)}</b>` : esc(t); return c === 'removed' ? `<p><del>${x}</del></p>` : c === 'added' ? `<p><ins>${x}</ins></p>` : `<p>${x}</p>`; }).join('');
  const dcount = () => ({ a: BL.filter(b => b[0] === 'added').length, r: BL.filter(b => b[0] === 'removed').length });
  X.hooks.dlg.nf2hist = d => {
    const hs = N.hist, L = vers(), sent = L.filter(v => v.kind === 'submission'), off = offline();
    if (hs === 'load') return `<h3>Povijest i usporedba</h3><p role="status"><span class="dot saving"></span>Učitavam verzije…</p><div class="foot"><button class="btn" data-act="dlgClose">Zatvori</button></div>`;
    if (hs === 'err') return `<h3>Povijest i usporedba</h3><div role="alert" class="banner" style="margin:0 0 10px"><span><b>Verzije trenutačno nije moguće dohvatiti.</b> Tekst na ovom uređaju je netaknut.</span></div><div class="foot"><button class="btn" data-act="dlgClose">Zatvori</button><button class="btn pri" data-act="nf2Set" data-v="puno">Pokušaj ponovno</button></div>`;
    if (d.mode === 'restore') { const c = dcount(), v = L.find(x => x.rev === d.sel); return `<h3>Vratiti ovu verziju?</h3><p><b>${esc(vname(v))}</b> · ${esc(v.at)} · ${fmtN(v.words)} riječi</p><div class="ptitle">Što će se promijeniti u odnosu na sadašnji tekst</div><p>Dodano ${c.a} ${plural(c.a, 'odlomak', 'odlomka', 'odlomaka')}, uklonjeno ${c.r} ${plural(c.r, 'odlomak', 'odlomka', 'odlomaka')}.</p><div class="diff">${diffHtml(BL.filter(b => b[0] !== 'unchanged').slice(0, 3))}</div><p class="muted">Vraćanje stvara novu verziju; nijedna ranija verzija se ne briše.</p>${off ? '<p class="muted" role="status">Vraćanje traži vezu s mrežom.</p>' : ''}<div class="foot"><button class="btn" data-act="nf2HistMode" data-v="view">Odustani</button><button class="btn pri" data-act="nf2Restore"${off ? ' disabled' : ''}>Da, vrati</button></div>`; }
    if (d.mode === 'view') { const v = L.find(x => x.rev === d.sel) || L[0]; if (!v) return ''; return `<h3>${esc(vname(v))}</h3><p class="muted">${esc(v.at)} · ${fmtN(v.words)} riječi · samo za čitanje${v.from ? ' · vraćeno iz verzije ' + v.from : ''}</p><div class="card"><div class="diff">${diffHtml(BL.filter(b => b[0] !== 'removed'))}</div></div><div class="foot"><button class="btn" data-act="nf2HistMode" data-v="list">Natrag na popis</button>${S.mode === 'write' && !S.submitted && !d.server ? `<button class="btn pri" data-act="nf2HistMode" data-v="restore">Vrati ovu verziju…</button>` : ''}</div>`; }
    const opt = (sel, name) => `<select class="in" data-bind="dlg.${name}" data-rerender="dlg" aria-label="${name === 'cA' ? 'Starija poslana verzija' : 'Novija poslana verzija'}">${sent.map(v => `<option value="${v.rev}"${String(sel) === String(v.rev) ? ' selected' : ''}>${vname(v)} · ${esc(v.at.split(',')[0])}</option>`).join('')}</select>`;
    const cmp = sent.length >= 2 ? `<div class="row"><label class="f" style="margin:0">Usporedi s …</label>${opt(d.cA || sent[1].rev, 'cA')}<span aria-hidden="true">→</span>${opt(d.cB || sent[0].rev, 'cB')}</div><div class="diff" style="margin-top:8px">${diffHtml(BL)}</div>` : `<p class="muted">Za usporedbu su potrebne dvije poslane verzije.${L.length === 1 ? ' Za sada postoji jedna verzija, pa se usporedba ne nudi.' : ''}</p>`;
    return `<h3>Povijest i usporedba</h3><div class="ptitle">Verzije rada (${L.length})</div>${L.map(v => `<div class="fx"><button class="rps-m" data-act="nf2HistView" data-rev="${v.rev}" style="flex:1;text-align:left"><b>${esc(vname(v))}</b><span class="d" style="display:block">${esc(v.at)} · ${fmtN(v.words)} riječi${v.from ? ' · vraćeno iz verzije ' + v.from : ''}</span></button></div>`).join('') || '<p class="muted">Još nema verzija. Prva se pojavi nakon prvog spremanja na poslužitelju.</p>'}<p class="muted">Prikazane su samo najnovije verzije kad ih je više od stranice.</p><div class="ptitle">Usporedba poslanih verzija</div>${cmp}<div class="foot"><button class="btn pri" data-act="dlgClose">Zatvori</button></div>`;
  };
  Object.assign(ACT, {
    nf2HistView: el => { U.dlg.sel = +el.dataset.rev; U.dlg.mode = 'view'; X.renderDlg(); },
    nf2HistMode: el => { U.dlg.mode = el.dataset.v; X.renderDlg(); },
    nf2Restore: () => { const L = vers(), v = L.find(x => x.rev === U.dlg.sel), n = L[0].rev + 1; S.nf2.vers = [{ kind: 'checkpoint', rev: n, at: '23. 11. 2026., 14:40', words: v.words, from: v.rev, pending: true }, ...L]; persist(); X.closeDlg(); toast('Verzija je vraćena. Nova verzija čeka potvrdu poslužitelja.'); },
  });

  /* ---------- 7. Proba predaje (P-16), DOI/ISBN (P-7), zahtjevi nastavnika (P-8), uvoz (P-19) ---------- */
  const paket0 = X.hooks.dlg.paket;
  X.hooks.dlg.paket = d => {
    let h = paket0(d); const row = (st, t, dsc) => `<div class="fx">${st}<span style="flex:1"><b>${t}</b><span class="d">${dsc}</span></span></div>`, ok = '<span class="s ok">✓</span>', wn = '<span class="s warn">!</span>';
    h = h.replace(/(<b>Izjava o AI-ju<\/b><span class="d">)[^<]*(<\/span>)/, `$1${declText()}$2`);
    const rq = (S.proofReq || []), open = rq.filter(r => !r.done).length;
    const extra = row(rq.length ? (open ? wn : ok) : ok, 'Potvrde koje traži mentor', rq.length ? (open ? `Još ${open} od ${rq.length} čeka potvrdu.` : 'Sve zatražene potvrde su priložene.') : 'Mentor za sada nije zatražio potvrde.')
      + row(N.noRules ? wn : ok, 'Zahtjevi fakulteta', N.noRules ? 'Fakultet još nije objavio pravila za ovaj rad (Q-11). Provjere pravila ne postoje.' : 'Pravila fakulteta, verzija 1. Provjere su gore pod „Prije predaje”.')
      + row(ok, 'Obrasci fakulteta', 'Obrazac izjave: test-izjava, verzija 1 (izmišljen obrazac, dok ga fakultet ne objavi).');
    return h.replace('<div class="ptitle">Autorska putovnica</div>', extra + '<div class="ptitle">Autorska putovnica</div>');
  };
  const LK = { '10.1234/primjer.2021.7': { kind: 'članak', authors: 'Horvat', full: 'Horvat, Ivana', year: '2021', title: 'Primjer članka o čitanju naglas', pub: 'Časopis za primjer, 12(3), 45–60' }, '9780000000002': { kind: 'knjiga', authors: 'Novak', full: 'Novak, Petar', year: '2018', title: 'Primjer knjige o rječniku djeteta', pub: 'Zagreb: Nakladnik' } };
  const quick0 = X.hooks.dlg.quick;
  X.hooks.dlg.quick = d => {
    let h = quick0(d); const m = { load: ['status', 'Dohvaćam podatke…'], ok: ['status', 'Podaci su dohvaćeni. Provjerite ih prije spremanja.'], none: ['status', 'Izvor nije pronađen, unesite ga ručno.'], err: ['alert', 'Dohvat podataka trenutačno nije dostupan. Izvor možete unijeti ručno.'], off: ['alert', 'Dohvat traži vezu s mrežom. Izvor možete unijeti ručno.'], bad: ['alert', 'Upišite DOI (npr. 10.1234/…) ili ISBN.'] }[N.lk];
    h = h.replace(/<p class="muted">U aplikaciji se podaci upisuju sami[^<]*<\/p>/, '<p class="muted">Upišite DOI ili ISBN pa odaberite Dohvati podatke. Poslužitelju se šalje samo taj identifikator, ne tekst rada.</p>');
    return h.replace(/(<input class="in" data-bind="dlg.ident"[^>]*>)/, `$1<div class="row" style="margin:6px 0"><button class="btn sm" data-act="nf2Look"${N.lk === 'load' ? ' disabled' : ''}>Dohvati podatke</button><span id="nf2lk" role="${m ? m[0] : 'status'}" class="muted">${m ? m[1] : ''}</span></div>`);
  };
  Object.assign(ACT, {
    nf2Look: () => { const d = U.dlg, id = String(d.ident || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/[-\s]/g, ''); if (offline()) { N.lk = 'off'; return X.renderDlg(); } if (!/^10\.\S+/.test(id) && !/^(\d{9}[\dX]|\d{13})$/.test(id)) { N.lk = 'bad'; return X.renderDlg(); } N.lk = 'load'; X.renderDlg();
      setTimeout(() => { if (!U.dlg || U.dlg !== d) { N.lk = ''; return; } const r = LK[id]; if (r) { Object.assign(d, r); N.lk = 'ok'; } else N.lk = 'none'; X.renderDlg(); }, 700); },
  });
  const lit0 = X.hooks.litExtra;
  X.hooks.litExtra = ro => (lit0 ? lit0(ro) : '') + reqBlock();
  if (X.rp && X.rp.HK) X.rp.HK.srcTop.push(() => reqBlock());
  function reqBlock() {
    const rq = (S.proofReq || []).filter(r => !r.done).length, rc = (S.recs || []).filter(r => r.st === 'new').length; if (!N.req && !(rq || rc)) return '';
    const st = N.req === 'load' ? '<p role="status"><span class="dot saving"></span>Učitavam zahtjeve nastavnika…</p>' : N.req === 'err' ? '<div role="alert"><p><b>Zahtjeve nastavnika trenutačno nije moguće dohvatiti.</b></p><button class="btn sm" data-act="nf2Set" data-v="zahtjevi">Pokušaj ponovno</button></div>' : N.req === 'none' ? '<p class="muted">Nastavnik za sada nije zatražio potvrde ni preporučio izvore.</p>' : (rq || rc ? `<p class="muted">Zatražene potvrde: ${rq} · preporučeni izvori: ${rc}.</p>` : `<div class="fx"><span style="flex:1"><b>Zatražena potvrda: Autor B (2021), str. 33</b><span class="d">Priložite sliku ili isječak stranice. Rok 28. 11. 2026.</span></span></div><div class="fx"><span style="flex:1"><b>Preporučeni izvor: Autor E (2020)</b><span class="d">Izmišljen primjer: Naslov o čitanju u razredu.</span></span></div>`) + '<p class="muted">Vidite samo ono što je nastavnik namijenio studentu; radne bilješke mentora ne vidite.</p>';
    return `<div class="ptitle">Zatražene potvrde i preporučeni izvori</div>${st}`;
  }
  const impHtml = d => {
    const m = d.err === 'big' ? 'Datoteka je veća od 2 MB. Odaberite manju ili zalijepite tekst.' : d.err === 'fmt' ? 'Podržani su samo .docx i .pdf.' : d.err === 'off' ? 'Uvoz traži vezu s mrežom. Tekst možete zalijepiti.' : '';
    return `<h3>Uvezi tekst iz datoteke</h3><p class="muted">Uvezeni tekst dobiva oznaku uvezeno i vrijeme uvoza, a ne oznaku teksta napisanog u Ducturi. To je zapis o tome odakle tekst dolazi, a ne dokaz o njegovu nastanku.</p>
    ${d.step === 'prev' ? `<div class="card"><h4>Pregled uvoza</h4><div class="meta">${esc(d.name)} · ${fmtN(d.words)} riječi</div><p class="muted" style="margin:6px 0 0">${esc(d.text)}</p></div><p role="status">Pregled čeka Vašu potvrdu. Ništa nije dodano u rad.</p><div class="foot"><button class="btn" data-act="dlgClose">Odustani</button><button class="btn pri" data-act="nf2ImpOk">Potvrdi uvoz</button></div>`
      : d.step === 'read' ? '<p role="status"><span class="dot saving"></span>Čitam datoteku…</p><div class="foot"><button class="btn" data-act="dlgClose">Odustani</button></div>'
      : `<label class="f" for="nf2f">Datoteka (.docx ili .pdf, do 2 MB)</label><input type="file" id="nf2f" class="in" accept=".docx,.pdf" aria-describedby="nf2fe">${m ? `<p id="nf2fe" role="alert"><b>${m}</b></p>` : '<p id="nf2fe" class="muted">Prototip: datoteka se ne čita, pregled je izmišljen.</p>'}<div class="foot"><button class="btn" data-act="dlgClose">Zatvori</button><button class="btn pri" data-act="nf2ImpRun">Pregledaj uvoz</button></div>`}`;
  };
  X.hooks.dlg.nf2imp = impHtml;
  Object.assign(ACT, {
    nf2Imp: () => X.openDlg({ type: 'nf2imp', step: 'pick' }),
    nf2ImpRun: () => { const d = U.dlg, f = ($('#nf2f') || {}).files && $('#nf2f').files[0]; if (offline()) { d.err = 'off'; return X.renderDlg(); } if (!f) { d.err = 'fmt'; return X.renderDlg(); } if (!/\.(docx|pdf)$/i.test(f.name)) { d.err = 'fmt'; return X.renderDlg(); } if (f.size > 2 * 1024 * 1024) { d.err = 'big'; return X.renderDlg(); } d.err = ''; d.step = 'read'; X.renderDlg(); setTimeout(() => { if (U.dlg !== d) return; Object.assign(d, { step: 'prev', name: f.name, words: 640, text: 'Izmišljeni pregled: „Čitanje naglas u razredu često se opisuje kao jednostavna praksa…” (prvi odlomak uvezenog teksta).' }); X.renderDlg(); }, 700); },
    nf2ImpOk: () => { const d = U.dlg; ed().chain().focus('end').insertContent(`<p>${esc(d.text)}</p>`).run(); S.imported = (S.imported || 0) + d.words; persist(); X.closeDlg(); rr(); toast(`Uvezeno ${d.words} riječi, označeno kao uvezeno.`); },
  });
  const impText0 = ACT.impText; ACT.impText = () => { X.closePop(); X.openDlg({ type: 'nf2imp', step: 'pick' }); };
  X.nf2.impText0 = impText0;

  /* ---------- 8. vodič (P-20), sitnice (P-23), stil citiranja (P-24), ograničenja pilota (P-4, P-25) ---------- */
  const onb0 = X.hooks.dlg.onb;
  X.hooks.dlg.onb = d => onb0(d).replace('<p class="muted">Prvi koraci', '<p class="muted">Oko 2 minute · Prvi koraci').replace('<div class="foot"><button class="btn" data-act="onbEnd">Preskoči</button>', `<div class="foot">${d.i > 0 ? '<button class="btn" data-act="nf2OnbBack">Natrag</button>' : ''}<button class="btn" data-act="onbEnd">Preskoči vodič</button>`).replace('Počni pisati', 'Završi vodič').replace('<h3>', '<h3 id="nf2onbh" tabindex="-1">');
  Object.assign(ACT, {
    onbEnd: () => { S.nf2.onbSeen = true; S.onb = 1; persist(); X.closeDlg(); },
    nf2OnbBack: () => { U.dlg.i = Math.max(0, U.dlg.i - 1); X.renderDlg(); },
  });
  ACT.copy = async () => { try { await navigator.clipboard.writeText(X.plainText()); toast('Tekst je stavljen u međuspremnik.'); } catch (e) { toast('Nije uspjelo. Označite tekst i upotrijebite Ctrl+C.'); } };
  if (X.more2) { const m0 = X.more2.modsExtra; X.more2.modsExtra = () => m0() + '<p class="muted">Stil citiranja je postavka ustanove (<span class="mono">citationStyle</span>). U pilotu na FPZG-u vrijedi FPZG; ostali stilovi su u prototipu radi pregleda.</p>'; }
  const PN = { tablica: 'tablica', slika: 'slika', formula: 'formula', fraza: 'fraza', ref: 'ref', fakultet: 'fakultet', sastavnice: 'sastavnice', podrijetlo: 'podrijetlo', predaje: 'predaje', runda: 'runda' };
  function pilotCmds() {
    (X.hooks.cmds || []).forEach(c => { if (!PN[c[0]]) return; if (!c._o) c._o = { h: c[2], r: c[3] };
      Object.defineProperty(c, 2, { configurable: true, enumerable: true, get: () => (N.pilot ? 'nije u pilotu' : c._o.h), set: v => { c._o.h = v; } });
      Object.defineProperty(c, 3, { configurable: true, enumerable: true, get: () => (N.pilot ? () => toast(`Naredba /${c[0]} nije u pilotu. Dolazi s novom shemom teksta (tablica, slika, formula) ili kasnije.`) : c._o.r), set: v => { c._o.r = v; } }); });
  }
  const pop = new MutationObserver(() => { const p = $('#pop'); if (!p || p.hidden || p.dataset.nf2) return; const hi = p.querySelector('[data-act="tbCfg"]'); if (!hi || !p.querySelector('[data-act="tbKeys"]')) return; p.dataset.nf2 = '1'; hi.insertAdjacentHTML('beforebegin', mi('nf2Hist', 'Povijest i usporedba', 'verzije, usporedba, vraćanje') + mi('nf2Decl', 'Izjava o korištenju alata', declText()) + mi('nf2Sim', 'Stanja radnog prostora (prototip)', '')); });
  pop.observe($('#pop'), { attributes: true, attributeFilter: ['hidden'], childList: true });
  new MutationObserver(() => { const p = $('#pop'); if (p && p.hidden) delete p.dataset.nf2; }).observe($('#pop'), { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(() => { const h = $('#nf2onbh'); if (h && U.dlg && U.dlg.type === 'onb' && !h.dataset.f) { h.dataset.f = '1'; h.focus(); } }).observe($('#dlg'), { childList: true });
  if (X.tb && X.tb.CMD) X.tb.CMD().push(['Stanja radnog prostora', 'prototip', 'nf2Sim', null, 'w'], ['Povijest i usporedba', 'verzije', 'nf2Hist', null, 'w'], ['Izjava o korištenju alata', 'nacrt i potvrda', 'nf2Decl', null, 'w']);

  const ab0 = X.afterBoot;
  X.afterBoot = fresh => {
    if (!S.onb && fresh) S.onb = 1; /* vodič se otvara niže, ne obavijest iz features.js */
    ab0 && ab0(fresh); header(); pilotCmds();
    const m = /nf2=([a-z_]+)/.exec(location.hash); if (m) { apply(m[1]); rr(); }
    if (!S.nf2.onbSeen && !m) setTimeout(() => { if (!U.dlg && !S.nf2.onbSeen) X.openDlg({ type: 'onb', i: 0, auto: true }); }, 700);
    rr();
  };
})();
