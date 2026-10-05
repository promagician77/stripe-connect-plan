(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var eur = function (c) { return (c < 0 ? '−€' : '€') + (Math.abs(c) / 100).toFixed(2); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- tabs ---------- */
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[role=tab]'); if (!b) return;
    document.querySelectorAll('[role=tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t === b)); });
    document.querySelectorAll('.panel').forEach(function (p) { p.hidden = p.id !== b.dataset.tab; });
    window.scrollTo(0, 0);
  });

  /* ---------- money math (integer cents) ---------- */
  function calc(model) {
    var G = Math.round((+$('m-gross').value || 0) * 100);
    var c = +$('m-comm').value || 0, p = +$('m-fp').value || 0, f = Math.round((+$('m-ff').value || 0) * 100);
    var S = Math.round(G * p / 100) + f;
    var r = { model: model, G: G, S: S };
    if (model === 'direct') {
      r.C = Math.round(G * c / 100); r.T = 0;
      r.sellers = [{ name: 'Seller', net: G - S - r.C, note: 'charge lands on their account' }];
      r.platform = r.C; r.btFee = S + r.C;
    } else if (model === 'destination') {
      r.C = Math.round(G * c / 100); r.T = G - r.C;
      r.sellers = [{ name: 'Seller', net: r.T, note: 'automatic transfer' }];
      r.platform = r.C - S; r.btFee = S;
    } else {
      var A = Math.round(G * 2 / 3), B = G - A;
      var cA = Math.round(A * c / 100), cB = Math.round(B * c / 100);
      r.C = cA + cB; r.T = (A - cA) + (B - cB);
      r.sellers = [{ name: 'Seller A', net: A - cA, note: 'transfer 1 of 2' }, { name: 'Seller B', net: B - cB, note: 'transfer 2 of 2' }];
      r.platform = r.C - S; r.btFee = S;
    }
    r.net = r.sellers.reduce(function (a, s) { return a + s.net; }, 0);
    return r;
  }

  /* ---------- connect model tab ---------- */
  var ans = { mor: 'seller', multi: 'no' };
  var MODELS = {
    direct: { name: 'Direct charges', why: 'Seller is merchant of record, one seller per payment, commission as an application fee.',
      facts: [['Merchant of record', 'Seller'], ['Stripe fee paid by', 'Seller'], ['Disputes debited from', "Seller's balance first"], ['Refund flag', 'refund_application_fee']] },
    destination: { name: 'Destination charges', why: 'Platform is merchant of record, funds forwarded to one seller.',
      facts: [['Merchant of record', 'Platform (seller with on_behalf_of)'], ['Stripe fee paid by', 'Platform'], ['Disputes debited from', 'Platform, then reverse transfer'], ['Refund flags', 'reverse_transfer + refund_application_fee']] },
    sct: { name: 'Separate charges & transfers', why: 'One cart, several sellers: charge once, then one transfer per seller.',
      facts: [['Merchant of record', 'Platform'], ['Stripe fee paid by', 'Platform'], ['Disputes debited from', 'Platform, then per-seller reversals'], ['Link', 'transfer_group + source_transaction']] }
  };
  function pick() {
    if (ans.multi === 'yes') return 'sct';
    return ans.mor === 'seller' ? 'direct' : 'destination';
  }
  function box(x, y, w, h, title, sub, fill, stroke) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="' + fill + '" stroke="' + stroke + '"/>' +
      '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 - 2) + '" text-anchor="middle" font-weight="600" font-size="13">' + title + '</text>' +
      '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 16) + '" text-anchor="middle" font-size="12" font-family="JetBrains Mono,monospace" fill="#55667A">' + sub + '</text>';
  }
  function arrow(x1, y1, x2, y2, label, color) {
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 8;
    return '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="' + color + '" stroke-width="1.6" marker-end="url(#fa)"/>' +
      '<text x="' + mx + '" y="' + my + '" text-anchor="middle" font-size="11.5" font-family="JetBrains Mono,monospace" fill="' + color + '">' + label + '</text>';
  }
  function drawFlow(m) {
    var r = calc(m), s = '<defs><marker id="fa" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0 0L8 3L0 6" fill="#0F2A44"/></marker></defs><g font-family="Inter,sans-serif" fill="#0F2A44">';
    s += box(10, 120, 130, 60, 'Customer', 'pays ' + eur(r.G), '#EEF4FA', '#9DB4CC');
    if (m === 'direct') {
      s += box(230, 110, 200, 80, 'Charge on seller account', 'Stripe-Account: acct_…', '#F4F0FF', '#8B7CF6');
      s += box(560, 30, 190, 60, 'Seller', 'nets ' + eur(r.sellers[0].net), '#E8F8F4', '#37C3A5');
      s += box(560, 120, 190, 60, 'Platform', 'application fee ' + eur(r.C), '#fff', '#0F2A44');
      s += box(560, 210, 190, 60, 'Stripe', 'fee ' + eur(r.S) + ' (from seller)', '#FFF6E8', '#F0B35A');
      s += arrow(140, 150, 230, 150, eur(r.G), '#0F2A44');
      s += arrow(430, 135, 560, 62, '', '#1E8A72') + arrow(430, 150, 560, 150, '', '#0F2A44') + arrow(430, 168, 560, 238, '', '#A06A1A');
    } else if (m === 'destination') {
      s += box(230, 110, 200, 80, 'Charge on platform', 'transfer_data.destination', '#F4F0FF', '#8B7CF6');
      s += box(560, 30, 190, 60, 'Seller', 'transfer ' + eur(r.T), '#E8F8F4', '#37C3A5');
      s += box(560, 120, 190, 60, 'Platform', 'keeps ' + eur(r.platform), '#fff', '#0F2A44');
      s += box(560, 210, 190, 60, 'Stripe', 'fee ' + eur(r.S) + ' (from platform)', '#FFF6E8', '#F0B35A');
      s += arrow(140, 150, 230, 150, eur(r.G), '#0F2A44');
      s += arrow(430, 135, 560, 62, '', '#1E8A72') + arrow(430, 150, 560, 150, '', '#0F2A44') + arrow(430, 168, 560, 238, '', '#A06A1A');
    } else {
      s += box(230, 110, 200, 80, 'One charge on platform', 'transfer_group: ORD-…', '#F4F0FF', '#8B7CF6');
      s += box(560, 10, 190, 56, 'Seller A', 'transfer ' + eur(r.sellers[0].net), '#E8F8F4', '#37C3A5');
      s += box(560, 82, 190, 56, 'Seller B', 'transfer ' + eur(r.sellers[1].net), '#E8F8F4', '#37C3A5');
      s += box(560, 154, 190, 56, 'Platform', 'keeps ' + eur(r.platform), '#fff', '#0F2A44');
      s += box(560, 226, 190, 56, 'Stripe', 'fee ' + eur(r.S) + ' (from platform)', '#FFF6E8', '#F0B35A');
      s += arrow(140, 150, 230, 150, eur(r.G), '#0F2A44');
      s += arrow(430, 125, 560, 40, '', '#1E8A72') + arrow(430, 140, 560, 110, '', '#1E8A72') + arrow(430, 160, 560, 182, '', '#0F2A44') + arrow(430, 175, 560, 252, '', '#A06A1A');
    }
    $('flow').innerHTML = s + '</g>';
  }
  function renderModel() {
    var m = pick(), M = MODELS[m];
    $('verdict').innerHTML = '<b>' + M.name + '</b><span>' + M.why + '</span>';
    $('facts').innerHTML = M.facts.map(function (f) { return '<div><b>' + f[1] + '</b>' + f[0] + '</div>'; }).join('');
    document.querySelectorAll('.mcard').forEach(function (c) { c.classList.toggle('on', c.dataset.m === m); });
    drawFlow(m);
  }
  document.querySelectorAll('.seg').forEach(function (seg) {
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      ans[seg.dataset.q] = b.dataset.v;
      seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderModel();
    });
  });

  /* ---------- money ledger tab ---------- */
  function renderMoney() {
    var m = $('m-model').value, r = calc(m);
    var src = {
      direct: ['payment_intent.amount', 'fee_details[type=stripe_fee]', 'application_fee_amount', 'none', 'gross − Stripe − commission'],
      destination: ['payment_intent.amount', 'fee_details[type=stripe_fee]', 'application_fee_amount', 'transfer.amount', 'transfer to seller'],
      sct: ['payment_intent.amount', 'fee_details[type=stripe_fee]', 'gross − Σ transfers', 'Σ transfers[].amount', 'Σ seller transfers']
    }[m];
    var vals = [['Gross', r.G], ['Stripe cost', r.S], ['Platform commission', r.C], ['Transfers', r.T], ['Net to seller(s)', r.net]];
    $('five').innerHTML = vals.map(function (v, i) { return '<div><span>' + v[0] + '</span><b>' + eur(v[1]) + '</b><code>' + src[i] + '</code></div>'; }).join('');
    var parts = r.sellers.map(function (s) { return '<div><span>' + s.name + '</span><b>' + eur(s.net) + '</b><small>' + s.note + '</small></div>'; });
    parts.push('<div><span>Platform</span><b>' + eur(r.platform) + '</b><small>' + (m === 'direct' ? 'application fee' : 'commission − Stripe fee') + '</small></div>');
    parts.push('<div><span>Stripe</span><b>' + eur(r.S) + '</b><small>' + (m === 'direct' ? 'charged to seller' : 'charged to platform') + '</small></div>');
    $('parties').innerHTML = parts.join('');
    var t;
    if (m === 'direct') t = '<b>Trap:</b> the seller\'s <code>balance_transaction.fee</code> shows <b>' + eur(r.btFee) + '</b>, because it includes your ' + eur(r.C) + ' commission. Store that as "Stripe cost" and the commission is counted twice. The real Stripe cost is the <code>stripe_fee</code> line: ' + eur(r.S) + '.';
    else if (m === 'destination') t = '<b>Trap:</b> the platform pays Stripe out of its commission, so it keeps <b>' + eur(r.platform) + '</b>, not ' + eur(r.C) + '. If your financial engine books the full commission as revenue, every order is ' + eur(r.S) + ' too high.';
    else t = '<b>Trap:</b> create each transfer with <code>source_transaction</code> set to the charge. Without it, transfers draw from the platform\'s available balance and fail when card funds haven\'t settled yet.';
    $('trap').innerHTML = t;
  }
  ['m-gross', 'm-comm', 'm-fp', 'm-ff', 'm-model'].forEach(function (id) {
    $(id).addEventListener('input', function () { renderMoney(); renderModel(); });
  });

  /* ---------- webhook simulator ---------- */
  var RANK = { CREATED: 0, REQUIRES_ACTION: 1, PAID: 2, PARTIALLY_REFUNDED: 3, DISPUTED: 3, REFUNDED: 4 };
  var hs, inbox, last;
  function hReset() {
    hs = { state: 'CREATED', path: ['CREATED'], refunded: 0 }; inbox = {}; last = null;
    $('h-log').innerHTML = '<tr><td colspan="4" class="muted">Events appear here as the service receives them.</td></tr>';
    paint();
  }
  function newId() { return 'evt_' + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8); }
  function paint() {
    var el = $('h-state'); el.textContent = hs.state; el.className = 'st ' + hs.state;
    $('h-path').innerHTML = hs.path.map(function (p) { return '<span>' + p + '</span>'; }).join('');
  }
  function log(id, type, acct, cls, msg) {
    var body = $('h-log');
    if (body.querySelector('.muted')) body.innerHTML = '';
    body.insertAdjacentHTML('afterbegin', '<tr class="new"><td>' + esc(id) + '</td><td>' + esc(type) + '</td><td>' + esc(acct) + '</td><td class="' + cls + '">' + esc(msg) + '</td></tr>');
  }
  function move(to) { if (hs.state !== to) { hs.state = to; hs.path.push(to); } }
  function apply(ev) {
    var t = ev.type, cur = RANK[hs.state];
    if (t === 'payout.paid') return ['ok', 'payout recorded for seller'];
    var target = { 'payment_intent.requires_action': 'REQUIRES_ACTION', 'payment_intent.succeeded': 'PAID', 'charge.dispute.created': 'DISPUTED' }[t];
    if (t === 'charge.refunded') {
      if (cur < RANK.PAID) return ['skip', 'ignored: not paid yet'];
      if (hs.state === 'REFUNDED') return ['skip', 'ignored: already fully refunded'];
      if (ev.part === 'partial' && hs.refunded === 0) { hs.refunded = 5000; move('PARTIALLY_REFUNDED'); return ['ok', 'partial refund €50.00 stored, commission refunded'] ; }
      hs.refunded = 15000; move('REFUNDED'); return ['ok', 'refunded in full'];
    }
    if (t === 'charge.dispute.created') {
      if (cur < RANK.PAID) return ['skip', 'ignored: not paid yet'];
      if (hs.state === 'DISPUTED') return ['skip', 'no change'];
      move('DISPUTED'); return ['ok', '→ DISPUTED, financial engine notified'];
    }
    if (RANK[target] < cur || (RANK[target] === cur && target !== hs.state)) return ['skip', 'stale: payment already ' + hs.state + ', ignored'];
    if (target === hs.state) return ['skip', 'no change'];
    move(target);
    return ['ok', '→ ' + target];
  }
  function receive(ev) {
    if (inbox[ev.id]) { log(ev.id, ev.type, ev.acct, 'skip', 'duplicate: 200 OK, not reprocessed'); return; }
    inbox[ev.id] = true; last = ev;
    var res = apply(ev); log(ev.id, ev.type, ev.acct, res[0], res[1]); paint();
  }
  document.querySelectorAll('[data-ev]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.ev;
      if (k === 'dup') { if (!last) { log('-', '-', '-', 'skip', 'nothing to retry yet'); return; } receive(last); return; }
      if (k === 'badsig') { log('(not stored)', 'unknown', '-', 'rej', '400: signature check failed'); return; }
      if (k === 'late') { receive({ id: newId(), type: 'payment_intent.requires_action', acct: 'acct_1SeLLer', late: true }); return; }
      var parts = k.split(':');
      receive({ id: newId(), type: parts[0], part: parts[1], acct: parts[0] === 'payout.paid' ? 'acct_1SeLLer' : 'acct_1SeLLer' });
    });
  });
  $('h-reset').addEventListener('click', hReset);

  /* ---------- payment table columns ---------- */
  var COLS = [['internal_payment_id', 'uuid'], ['order_id', 'varchar'], ['shop_id', 'varchar'], ['connected_account_id', 'varchar'],
    ['payment_intent_id', 'varchar'], ['charge_id', 'varchar'], ['transfer_id', 'varchar'], ['refund_id', 'varchar'],
    ['currency', 'char(3)'], ['gross_amount', 'bigint', 1], ['stripe_cost', 'bigint', 1], ['platform_commission', 'bigint', 1],
    ['transfer_amount', 'bigint', 1], ['net_amount', 'bigint', 1], ['status', 'enum'], ['charge_model', 'enum'],
    ['economic_event_id', 'varchar'], ['reconciliation_ref', 'varchar'], ['created_at', 'timestamptz'], ['updated_at', 'timestamptz']];
  $('cols').innerHTML = COLS.map(function (c) { return '<div class="' + (c[2] ? 'money' : '') + '">' + c[0] + '<span>' + c[1] + '</span></div>'; }).join('');

  renderModel(); renderMoney(); hReset();
})();
