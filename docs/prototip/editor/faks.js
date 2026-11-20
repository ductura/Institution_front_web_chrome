/* Ductura Editor, prototip v0.26: jedan editor, profil iz tri sloja.
 *   1. područje (službena podjela sastavnica Sveučilišta u Zagrebu) -> koji su alati uključeni
 *   2. fakultet (pravila iz Lektina paketa)                          -> oblikovanje, naslovnica, stil citiranja
 *   3. studij (iznimke po nazivu profila)                             -> npr. psihologija na Filozofskom
 * Područje je preuzeto iz Vodiča za buduće studente Sveučilišta u Zagrebu. Zadani alati po području
 * i iznimke po fakultetu PRIJEDLOG su prototipa, nisu pravilo fakulteta; u sučelju je to označeno.
 */
(function () {
  'use strict';
  const X = window.DU, { S, U, ACT, esc, $, toast, persist } = X, R = X.rules;
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const AREAS = {
    pri: ['Prirodoslovno područje', { formula: 1, kod: 1, kem: 1 }, 'apa', 1],
    teh: ['Tehničko područje', { formula: 1, kod: 1 }, 'ieee', 1],
    bm: ['Biomedicinsko područje', { kem: 1 }, 'vancouver', 1],
    bt: ['Biotehničko područje', { formula: 1, kem: 1 }, 'apa', 1],
    dru: ['Društveno područje', {}, 'apa', 0],
    hum: ['Humanističko područje', {}, 'fusnote', 0],
    umj: ['Umjetničko područje', {}, 'chicago', 0]
  }, ORDER = ['pri', 'teh', 'bm', 'bt', 'dru', 'hum', 'umj'];
  const UNIT = { pmf: 'pri', arh: 'teh', fer: 'teh', fkit: 'teh', fpz: 'teh', fsb: 'teh', geof: 'teh', geoteh: 'teh', grad: 'teh', grf: 'teh', simet: 'teh', rgnf: 'teh', ttf: 'teh', fbf: 'bm', mef: 'bm', sfzg: 'bm', vef: 'bm', agr: 'bt', pbf: 'bt', sumfak: 'bt', erf: 'dru', efzg: 'dru', foi: 'dru', fpzg: 'dru', kif: 'dru', pravo: 'dru', ufzg: 'dru', ffzg: 'hum', kbf: 'hum', fhs: 'hum', ffrz: 'hum', mvi: 'hum', adu: 'umj', alu: 'umj', muza: 'umj' };
  /* iznimke po fakultetu: alat koji područje ne daje, a struka ga treba (ili obrnuto) */
  const UX = { foi: { formula: 1, kod: 1 }, efzg: { formula: 1 }, kif: { formula: 1 }, fkit: { kem: 1 }, simet: { kem: 1 }, rgnf: { kem: 1 }, ttf: { kem: 1 }, arh: { kod: 0 }, geoteh: { kem: 1 }, fbf: { formula: 1 }, pravo: {} }, UCITE = { pravo: 'fusnote' };
  /* iznimke po studiju, iz naziva profila */
  const PX = [[/psiholog/, { formula: 1 }, 'apa'], [/informat|racunar|racunal/, { kod: 1 }, null], [/matemat|fizik|statist/, { formula: 1 }, null], [/kemij|biokem/, { kem: 1 }, null], [/sociolog|demograf|ekonom/, { formula: 1 }, null]];
  const MODN = { formula: 'formule i teoremi', kod: 'programski kod', kem: 'kemijske formule' }, CN = { fpzg: 'FPZG autor-godina', apa: 'autor-godina (APA)', chicago: 'Chicago autor-godina', ieee: 'IEEE, brojčani', vancouver: 'Vancouver, brojčani', fusnote: 'fusnote' };
  const CMAP = { fpzg: 'fpzg', apa7: 'apa', harvard: 'apa', 'chicago-author': 'chicago', vancouver: 'vancouver', ieee: 'ieee', 'chicago-notes': 'fusnote', 'pravo-fusnote': 'fusnote', 'pravo-social-author': 'apa' };

  function setup(p) {
    p = p || (R && R.profile && R.profile()); if (!p) return null;
    const a = UNIT[p.unitId] || 'dru', A = AREAS[a], mods = Object.assign({}, A[1], UX[p.unitId] || {}), lab = norm(p.label || ''); let cite = CMAP[p.citation] || null, src = cite ? 'pravilo' : (p.citation === 'custom' ? 'vlastiti' : 'podrucje'), study = [];
    PX.forEach(x => { if (x[0].test(lab)) { Object.assign(mods, x[1]); study.push(Object.keys(x[1]).map(k => MODN[k]).join(', ')); if (!cite && x[2]) { cite = x[2]; src = 'studij'; } } });
    if (!cite) cite = UCITE[p.unitId] || A[2];
    return { area: a, areaName: A[0], mods, cite, src, abbr: !!A[3], study };
  }
  X.fak = { AREAS, UNIT, setup, mod: k => { const s = setup(); return !!(s && s.mods[k]); } };

  const SRC = { pravilo: 'iz pravila fakulteta', vlastiti: 'fakultet ima vlastiti stil; do unosa vrijedi uobičajeni za područje', podrucje: 'uobičajeno za područje, fakultet ga nije propisao', studij: 'uobičajeno za studij' };
  const modTxt = m => Object.keys(MODN).filter(k => m[k]).map(k => MODN[k]).join(', ') || 'osnovni alati, bez dodataka';
  const sumHtml = p => { const s = setup(p); if (!s) return ''; return `<div class="fk-sum"><b>${esc(s.areaName)}</b><dl><dt>Dodatni alati</dt><dd>${esc(modTxt(s.mods))}</dd><dt>Stil citiranja</dt><dd>${esc(CN[s.cite] || s.cite)} <span class="muted">(${SRC[s.src]})</span></dd><dt>Oblikovanje</dt><dd>font, prored, margine, brojevi stranica i naslovnica iz pravila fakulteta</dd>${s.abbr ? '<dt>Popis kratica</dt><dd>uključen</dd>' : ''}</dl></div>`; };

  /* izbor fakulteta: sastavnice po područjima, s desne strane što se namješta */
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  X.hooks.dlg.rqpick = d => {
    if (!R.data) return '<h3>Fakultet i profil</h3><p class="muted">Pravila se još učitavaju.</p><div class="foot"><button class="btn" data-act="dlgClose">Zatvori</button></div>';
    const q = norm(d.q || ''), cur = R.profile(), unit = d.unit || (cur && cur.unitId), sl = R.data.meta.statusLabels || {}, hit = u => !q || norm(u.name).includes(q) || u.id.includes(q);
    const list = ORDER.map(a => { const us = R.data.units.filter(u => (UNIT[u.id] || 'dru') === a && hit(u)); return us.length ? `<div class="fk-ar">${esc(AREAS[a][0])}</div>` + us.map(u => `<button class="rrow${u.id === unit ? ' act' : ''}" data-act="rqUnit" data-id="${u.id}"><span class="rt">${esc(u.name)}</span></button>`).join('') : ''; }).join('');
    const ps = unit ? R.data.profiles.filter(p => p.unitId === unit) : [], shown = cur && cur.unitId === unit ? cur : ps[0];
    return `<h3>Fakultet i profil</h3><p class="muted">U aplikaciji fakultet dolazi iz prijave (AAI), a vrsta rada iz zadatka nastavnika, pa je sve namješteno bez pitanja. U prototipu ih birate sami. Editor je jedan: fakultet mu zadaje alate i pravila.</p><input class="in" data-bind="dlg.q" data-rerender="dlg" value="${esc(d.q || '')}" placeholder="Traži fakultet" id="rqQ">
      <div class="rq-pick"><div class="rq-units">${list || '<p class="muted">Nema takve sastavnice.</p>'}</div>
      <div class="rq-profs">${unit ? sumHtml(shown) + `<div class="fk-ar">Vrsta rada</div>` + ps.map(p => `<button class="rcl" data-act="rqSet" data-id="${p.id}" aria-pressed="${p.id === S.profileId}"><b>${esc(p.label)}</b><span>${esc(sl[p.status] || p.status)}${p.wordMin ? ' · ' + fmt(p.wordMin) + (p.wordMax ? ' do ' + fmt(p.wordMax) : '+') + ' riječi' : p.pageMin ? ' · ' + p.pageMin + (p.pageMax ? ' do ' + p.pageMax : '+') + ' str.' : ''}</span></button>`).join('') : '<p class="muted">Odaberite fakultet.</p>'}</div></div>
      <div class="foot"><button class="btn" data-act="fkTable">Sve sastavnice</button><button class="btn pri" data-act="dlgClose">Gotovo</button></div>`;
  };
  /* tablica svih sastavnica */
  X.hooks.dlg.fktable = () => { if (!R.data) return ''; const row = u => { const ps = R.data.profiles.filter(p => p.unitId === u.id), s = setup(ps[0] || { unitId: u.id, label: u.name }), own = s.src === 'pravilo'; return `<tr><td><button class="lnk" data-act="fkGo" data-id="${u.id}">${esc(u.name)}</button></td><td>${esc(modTxt(s.mods))}</td><td>${esc(CN[s.cite])}${own ? '' : ' <span class="muted">*</span>'}</td><td class="num">${ps.length}</td></tr>`; };
    return `<h3>Sastavnice Sveučilišta u Zagrebu</h3><p class="muted">${R.data.units.length} sastavnica u sedam područja. Područje određuje dodatne alate, fakultet pravila oblikovanja i citiranja, a studij može donijeti iznimku. Stil je prikazan za prvu vrstu rada i može se razlikovati po vrsti rada. Zvjezdica znači da ga fakultet nije propisao pa vrijedi uobičajeni za područje.</p><div class="fk-tw"><table class="fk-t"><thead><tr><th>Sastavnica</th><th>Dodatni alati</th><th>Stil citiranja</th><th class="num">Profila</th></tr></thead>${ORDER.map(a => `<tbody><tr class="fk-th"><th colspan="4">${esc(AREAS[a][0])}</th></tr>${R.data.units.filter(u => (UNIT[u.id] || 'dru') === a).map(row).join('')}</tbody>`).join('')}</table></div><div class="foot"><button class="btn" data-act="rqPick">Natrag na izbor</button><button class="btn pri" data-act="dlgClose">Zatvori</button></div>`; };

  const set0 = ACT.rqSet;
  Object.assign(ACT, {
    fkTable: () => X.openDlg({ type: 'fktable', wide: true }),
    fkGo: el => X.openDlg({ type: 'rqpick', q: '', unit: el.dataset.id, wide: true }),
    rqSet: el => { set0(el); const s = setup(); if (!s) return; S.mods = {}; S.citeStyle = s.cite; U.citeDirty = true; S.abbrOn = s.abbr; persist(); X.repaintCites(); X.refresh(); X.renderAll(true); X.renderDlg(); toast(`Namješteno: ${s.areaName.toLowerCase()}, ${modTxt(s.mods)}, ${CN[s.cite]}.`); }
  });
  X.hooks.cmds.push(['fakultet', 'Fakultet i profil', 'alati i pravila po fakultetu', () => ACT.rqPick()], ['sastavnice', 'Sve sastavnice', 'tablica fakulteta po područjima', () => ACT.fkTable()]);
})();
