(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var qa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var fmt = function (n, d) { return Number(n).toLocaleString('ro-RO', { maximumFractionDigits: d === undefined ? 1 : d }); };
  var smooth = reduce ? 'auto' : 'smooth';

  /* ---------- Date din studiul de caz ---------- */
  var REF = {
    target: 6, rate5: 8.6, rate13: 7.4,   // găleți/min: țintă și valori testate
    validatedKg: 13, payloadKg: 20, gripperKg: 5, scaleKg: 25,
    pallet5: 100, pallet13: 44, gaugeMax: 12
  };

  /* ---------- Nav ---------- */
  var nav = $('nav');
  var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- Titlu hero ---------- */
  var title = document.querySelector('.hero-title');
  if (title && !reduce) {
    title.innerHTML = title.textContent.trim().split(/\s+/).map(function (w, i) {
      return '<span class="w" style="animation-delay:' + (120 + i * 70) + 'ms">' + w + '</span>';
    }).join(' ');
  }

  /* ---------- Simulare palet: 4 straturi × 25 găleți = 100 ---------- */
  var pallet = $('pallet'), cells = [];
  for (var i = 0; i < 25; i++) { var b = document.createElement('span'); b.className = 'bucket'; pallet.appendChild(b); cells.push(b); }
  var order = [];
  for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) order.push(r * 5 + (r % 2 ? 4 - c : c));
  var sim = { inLayer: 0, layer: 1, placed: 0 };
  function showSim() { $('pcount').textContent = sim.placed; $('player').textContent = sim.layer; }
  function simStep() {
    if (sim.inLayer >= 25) {
      sim.inLayer = 0;
      if (sim.layer >= 4) { sim.layer = 1; sim.placed = 0; } else { sim.layer += 1; }
      pallet.classList.add('clear');
      setTimeout(function () {
        cells.forEach(function (x) { x.className = 'bucket'; });
        pallet.classList.remove('clear');
        showSim();
        setTimeout(simStep, 300);
      }, 550);
      return;
    }
    cells[order[sim.inLayer]].className = 'bucket in' + (sim.layer > 1 ? ' l' + sim.layer : '');
    sim.inLayer += 1; sim.placed += 1;
    showSim();
    setTimeout(simStep, sim.inLayer >= 25 ? 900 : 280);
  }
  if (reduce) { cells.forEach(function (x) { x.className = 'bucket in'; x.style.opacity = 1; x.style.transform = 'none'; }); sim.placed = 25; showSim(); }
  else setTimeout(simStep, 900);

  /* ---------- Apariție la scroll ---------- */
  var revealEls = qa('.split, .facts, .flow, .tool-head, .faq');
  if ('IntersectionObserver' in window && !reduce) {
    revealEls.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Butoane de tip opțiune ---------- */
  function segValue(id) { var s = document.querySelector('#' + id + ' [aria-checked=true]'); return s ? s.getAttribute('data-v') : null; }
  function setSeg(id, v) { qa('#' + id + ' [role=radio]').forEach(function (btn) { btn.setAttribute('aria-checked', String(btn.getAttribute('data-v') === String(v))); }); }
  ['industry', 'handle', 'shifts', 'pref'].forEach(function (id) {
    qa('#' + id + ' [role=radio]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setSeg(id, btn.getAttribute('data-v'));
        if (id === 'industry') { $('e-industry').textContent = ''; setTimeout(function () { if (step === 1) go(2); }, reduce ? 0 : 220); }
      });
    });
  });

  /* ---------- Greutate: butoane rapide + câmp ---------- */
  var W = $('weight');
  function syncQuick() {
    var v = parseFloat(W.value);
    qa('#weightQuick button').forEach(function (b) { b.classList.toggle('on', parseFloat(b.getAttribute('data-kg')) === v); });
  }
  qa('#weightQuick button').forEach(function (b) {
    b.addEventListener('click', function () { W.value = b.getAttribute('data-kg'); syncQuick(); clearErr('weight'); });
  });
  W.addEventListener('input', function () { syncQuick(); clearErr('weight'); });

  /* ---------- Wizard ---------- */
  var step = 1, current = null;
  var STEP_OF = { industry: 1, weight: 2, perday: 3, minutes: 3, ops: 3, perpallet: 3 };

  function num(id) { var v = String($(id).value).trim(); return v === '' ? null : Number(v); }
  function read() {
    return { industry: segValue('industry'), weight: num('weight'), handle: segValue('handle'), perday: num('perday'),
      shifts: Number(segValue('shifts')), minutes: num('minutes'), ops: num('ops'), perpallet: num('perpallet') };
  }
  function validate(d) {
    var e = {};
    if (!d.industry) e.industry = 'Alegeți una dintre variante ca să continuăm.';
    if (d.weight === null) e.weight = 'Alegeți o greutate sau scrieți-o în căsuță.';
    else if (!(d.weight > 0)) e.weight = 'Greutatea trebuie să fie mai mare decât 0 kg.';
    else if (d.weight > 60) e.weight = 'Peste 60 kg nu e o găleată obișnuită. Verificați dacă ați scris în kilograme.';
    if (d.perday === null) e.perday = 'Scrieți câte găleți paletizați pe zi, aproximativ.';
    else if (!(d.perday > 0) || d.perday % 1 !== 0) e.perday = 'Folosiți un număr întreg mai mare decât 0.';
    if (d.minutes === null || !(d.minutes >= 60 && d.minutes <= 480)) e.minutes = 'Un schimb are între 60 și 480 de minute de lucru.';
    if (d.ops === null) e.ops = 'Scrieți 0 dacă nu știți.';
    else if (d.ops < 0 || d.ops > 20 || d.ops % 1 !== 0) e.ops = 'Un număr întreg între 0 și 20.';
    if (d.perpallet !== null && (!(d.perpallet > 0) || d.perpallet % 1 !== 0 || d.perpallet > 500)) e.perpallet = 'Lăsați gol sau scrieți un număr întreg.';
    if (!e.perday && !e.minutes && d.perday / (d.shifts * d.minutes) > 60) e.perday = 'Rezultă peste 60 de găleți pe minut. Verificați numărul.';
    return e;
  }
  function clearErr(k) { var m = $('e-' + k); if (m) m.textContent = ''; var f = $(k); if (f && f.classList) f.classList.remove('invalid'); }
  function showErrs(errs, onlyStep) {
    Object.keys(STEP_OF).forEach(function (k) {
      if (onlyStep && STEP_OF[k] !== onlyStep) return;
      var msg = errs[k] || '';
      $('e-' + k).textContent = msg;
      var f = $(k); if (f && f.tagName === 'INPUT') { f.classList.toggle('invalid', !!msg); f.setAttribute('aria-invalid', msg ? 'true' : 'false'); }
    });
    if (onlyStep === 3 && (errs.minutes || errs.ops || errs.perpallet)) $('more').open = true;
  }

  function go(n, opts) {
    step = n;
    qa('.wiz-step').forEach(function (s) {
      var on = Number(s.getAttribute('data-step')) === n;
      s.hidden = !on;
      if (on) { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); }
    });
    $('wizBar').style.width = (Math.min(n, 3) / 3 * 100) + '%';
    $('wizCount').textContent = n <= 3 ? 'Întrebarea ' + n + ' din 3' : 'Gata. Iată rezultatul.';
    $('wizBack').hidden = n === 1 || n === 4;
    $('wizNext').hidden = n === 4 || (n === 1 && !segValue('industry'));
    $('wizNext').textContent = n === 3 ? 'Vezi rezultatul' : 'Continuă';
    $('wizard').classList.toggle('is-result', n === 4);
    if (!opts || opts.scroll !== false) {
      var top = $('wizard').getBoundingClientRect().top;
      if (top < 60 || top > window.innerHeight * 0.6) $('wizard').scrollIntoView({ behavior: smooth, block: 'start' });
    }
    if (n === 2 && !(opts && opts.noFocus)) setTimeout(function () { if (!W.value) W.focus({ preventScroll: true }); }, 250);
    if (n === 3 && !(opts && opts.noFocus)) setTimeout(function () { if (!$('perday').value) $('perday').focus({ preventScroll: true }); }, 250);
  }

  function next() {
    var d = read(), e = validate(d);
    var stepErrs = Object.keys(e).filter(function (k) { return STEP_OF[k] === step; });
    showErrs(e, step);
    if (stepErrs.length) { var f = $(stepErrs[0]); if (f && f.focus) f.focus(); return; }
    if (step < 3) go(step + 1); else showResult(d);
  }
  $('wizNext').addEventListener('click', next);
  $('wizBack').addEventListener('click', function () { go(step - 1); });
  $('editAnswers').addEventListener('click', function () { go(1); });
  ['weight', 'perday', 'minutes', 'ops', 'perpallet'].forEach(function (id) {
    $(id).addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); next(); } });
    $(id).addEventListener('input', function () { clearErr(id); });
  });

  /* ---------- Evaluare ---------- */
  function evaluate(d) {
    var checks = [], score = 0, reasons = [];
    var cap = d.weight <= 5 ? REF.rate5 : REF.rate13;   // capacitatea unei celule
    var maxBucket = REF.payloadKg - REF.gripperKg;      // 15 kg
    var load = d.weight + REF.gripperKg;

    // produs
    if (d.industry === 'solvent') { score = 2; checks.push(['bad', '<b>Tip de produs nepotrivit.</b> Produsele pe bază de solvent necesită echipamente certificate pentru medii cu risc de explozie. Nu recomandăm această soluție.']); }
    else if (d.industry === 'food') checks.push(['ok', '<b>Produs potrivit.</b> Paletizarea găleților cu produse alimentare este o aplicație deja implementată cu succes.']);
    else { score = Math.max(score, 1); reasons.push('compatibilitatea ambalajului'); checks.push(['warn', '<b>Produs de confirmat.</b> Un inginer verifică ambalajul și condițiile de lucru specifice acestui tip de produs.']); }

    // greutate
    if (d.weight <= REF.validatedKg) checks.push(['ok', '<b>Greutate potrivită.</b> ' + fmt(d.weight) + ' kg pe găleată plus 5 kg dispozitivul de prindere: robotul lucrează cu ' + fmt(load) + ' kg din capacitatea sa de 20 kg.']);
    else if (d.weight <= maxBucket) { score = Math.max(score, 1); reasons.push('configurația pentru greutatea găleții'); checks.push(['warn', '<b>Greutate la limita capacității.</b> ' + fmt(d.weight) + ' kg pe găleată plus 5 kg dispozitivul de prindere înseamnă ' + fmt(load) + ' kg din maximum 20 kg. Configurația se confirmă la evaluare.']); }
    else { score = 2; checks.push(['bad', '<b>Greutate prea mare.</b> ' + fmt(d.weight) + ' kg pe găleată plus 5 kg dispozitivul de prindere înseamnă ' + fmt(load) + ' kg, peste capacitatea de 20 kg a robotului. Soluția se aplică găleților de până la 15 kg.']); }

    // mâner
    if (d.handle === 'yes') checks.push(['ok', '<b>Prindere sigură.</b> Robotul identifică automat poziția mânerului înainte de a prinde găleata.']);
    else { score = Math.max(score, 1); reasons.push('sistemul de prindere'); checks.push(['warn', '<b>Prindere adaptată.</b> Pentru găleți fără mâner, dispozitivul de prindere se proiectează după forma ambalajului.']); }

    // ritm
    var rate = d.perday / (d.shifts * d.minutes);
    var robots = Math.max(1, Math.ceil(rate / REF.target));
    var rateNote;
    if (rate <= REF.target) { rateNote = 'O celulă paletizează până la ' + fmt(cap) + ' găleți pe minut.'; checks.push(['ok', '<b>Volum acoperit.</b> Linia dvs. are nevoie de ' + fmt(rate, 1) + ' găleți pe minut. O singură celulă robotică este suficientă.']); }
    else if (rate <= cap) { score = Math.max(score, 1); reasons.push('ritmul întregii linii'); rateNote = 'Aproape de capacitatea unei celule (' + fmt(cap) + ' găleți/min).'; checks.push(['warn', '<b>Volum ridicat.</b> Linia dvs. are nevoie de ' + fmt(rate, 1) + ' găleți pe minut, aproape de capacitatea unei celule. Recomandăm analiza fluxului întregii linii.']); }
    else { score = Math.max(score, 1); reasons.push('numărul de celule necesare'); rateNote = 'Peste capacitatea unei singure celule.'; checks.push(['warn', '<b>Volum mare.</b> Linia dvs. are nevoie de ' + fmt(rate, 1) + ' găleți pe minut, peste capacitatea unei singure celule. Volumul poate fi acoperit cu aproximativ ' + robots + ' celule.']); }
    if (rate < 1) checks.push(['info', '<b>Volum redus.</b> Celula ar funcționa mult sub capacitate. Vă recomandăm o discuție despre rentabilitatea investiției.']);

    // paleți
    var perPallet = d.perpallet || (d.weight === 5 ? REF.pallet5 : (d.weight === 13 ? REF.pallet13 : null));
    var pallets = perPallet ? Math.ceil(d.perday / perPallet) : null;
    checks.push(['info', '<b>Schimbarea paleților.</b> Paleții plini se schimbă în continuare de operator' + (pallets ? ', aproximativ ' + fmt(pallets, 0) + ' pe zi.' : '.') + ' Celula are două posturi, astfel încât robotul nu se oprește în acest timp.']);

    var titles = ['Linia dvs. este potrivită pentru paletizare robotică', 'Linia dvs. poate fi automatizată, după o verificare tehnică', 'Soluția nu se potrivește configurației actuale'];
    var texts = [
      'Produsul, greutatea și volumul se încadrează în parametrii soluției. Următorul pas: o demonstrație.',
      'Majoritatea parametrilor se încadrează. Un inginer trebuie să confirme ' + reasons.join(' și ') + '.',
      'Detaliile de mai jos arată ce ar trebui modificat pentru ca soluția să funcționeze.'
    ];
    return { score: score, rate: rate, tested: cap, robots: robots, pallets: pallets, tons: d.perday * d.weight / 1000, checks: checks, rateNote: rateNote, title: titles[score], text: texts[score] };
  }

  var ARC = Math.PI * 90;
  function arcDash(from, to) {
    var a = Math.max(0, Math.min(1, from / REF.gaugeMax)) * ARC, b2 = Math.max(0, Math.min(1, to / REF.gaugeMax)) * ARC;
    return '0 ' + a + ' ' + Math.max(0, b2 - a) + ' ' + ARC * 2;
  }

  function showResult(d) {
    var res = evaluate(d); current = { d: d, r: res };
    $('verdict').setAttribute('data-state', ['ok', 'eval', 'bad'][res.score]);
    $('vTitle').textContent = res.title;
    $('vText').textContent = res.text;
    var sym = { ok: '✓', warn: '!', bad: '✕', info: 'i' };
    $('checks').innerHTML = res.checks.map(function (c, k) { return '<li style="animation-delay:' + (k * 60) + 'ms"><span class="ic ' + c[0] + '">' + sym[c[0]] + '</span><span>' + c[1] + '</span></li>'; }).join('');
    $('toRequest').textContent = ['Programează o demonstrație', 'Cere evaluare tehnică', 'Discută alternativele cu un inginer'][res.score];
    $('loadVal').textContent = fmt(d.weight + REF.gripperKg) + ' kg';
    $('rateVal').textContent = fmt(res.rate, 1) + '/min';
    $('rateNote').textContent = res.rateNote;
    $('fCells').textContent = res.score === 2 ? '–' : res.robots;
    $('fTons').textContent = fmt(res.tons, 1) + ' t';
    $('fPallets').textContent = res.pallets ? fmt(res.pallets, 0) + '/zi' : '–';
    $('gOk').setAttribute('stroke-dasharray', arcDash(0, REF.target));
    $('gEval').setAttribute('stroke-dasharray', arcDash(REF.target, res.tested));
    // pornim de la zero, apoi animăm
    $('loadMarker').style.left = '0%'; $('needle').style.transform = 'rotate(-90deg)';
    go(4);
    setTimeout(function () {
      $('loadMarker').style.left = (Math.min(d.weight + REF.gripperKg, REF.scaleKg) / REF.scaleKg * 100) + '%';
      $('needle').style.transform = 'rotate(' + (-90 + Math.max(0, Math.min(1, res.rate / REF.gaugeMax)) * 180) + 'deg)';
    }, reduce ? 0 : 350);
    $('request').hidden = true;
  }

  /* ---------- Cerere ---------- */
  var INDUSTRY = { food: 'Alimente', paint: 'Vopsea lavabilă', chem: 'Adezivi și amorse', solvent: 'Produse pe bază de solvent', other: 'Alt produs' };
  $('toRequest').addEventListener('click', function () {
    if (!current) return;
    var d = current.d, r = current.r;
    $('reqTitle').textContent = ['Programează o demonstrație', 'Cerere de evaluare tehnică', 'Discuție despre alternative'][r.score];
    $('reqBtn').textContent = ['Programează demonstrația', 'Trimite cererea de evaluare', 'Trimite cererea'][r.score];
    setSeg('pref', r.score === 0 ? 'Demonstrație online' : 'Evaluare la fabrică');
    $('reqSummary').innerHTML = '<b>' + r.title + '</b>' + INDUSTRY[d.industry] + ', găleată de ' + fmt(d.weight) + ' kg, ' + fmt(d.perday, 0) + ' găleți pe zi';
    $('reqInner').hidden = false; $('sent').hidden = true;
    $('request').hidden = false;
    $('request').scrollIntoView({ behavior: smooth, block: 'start' });
    setTimeout(function () { $('company').focus({ preventScroll: true }); }, 500);
  });

  $('reqForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = { company: $('company').value.trim(), role: $('role').value, county: $('county').value.trim(), email: $('email').value.trim() };
    var errs = {};
    if (f.company.length < 2) errs.company = 'Scrieți numele firmei.';
    if (!f.role) errs.role = 'Alegeți rolul dvs.';
    if (f.county.length < 2) errs.county = 'Scrieți județul.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) errs.email = 'Adresa trebuie să arate ca nume@firma.ro.';
    if (!$('testdata').checked) errs.testdata = 'Bifați acordul ca să trimitem cererea.';
    ['company', 'role', 'county', 'email', 'testdata'].forEach(function (k) {
      $('e-' + k).textContent = errs[k] || '';
      if (k !== 'testdata') $(k).classList.toggle('invalid', !!errs[k]);
    });
    var firstErr = Object.keys(errs)[0];
    if (firstErr) { $(firstErr).focus(); return; }
    $('reqInner').hidden = true; $('sent').hidden = false;
  });

  $('newCheck').addEventListener('click', function () {
    ['company', 'county', 'email'].forEach(function (k) { $(k).value = ''; });
    $('role').value = ''; $('testdata').checked = false;
    $('request').hidden = true;
    go(1);
  });

  go(1, { scroll: false, noFocus: true });
})();
