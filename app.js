/* === XAU/USD TRADE CALCULATOR === */

/* ===================== DIRECTION TOGGLE ===================== */

let direction = 'BUY';

document.querySelectorAll('.dir-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    direction = btn.dataset.dir;
    document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* ===================== INPUT FORMATTING ===================== */

// Allow only numeric input with decimals
document.querySelectorAll('input[type="number"]').forEach(inp => {
  inp.addEventListener('wheel', e => e.preventDefault());
});

/* ===================== CALCULATE ===================== */

document.getElementById('btn-calculate').addEventListener('click', calculate);

// Also calculate on Enter key
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') calculate();
});

function getVal(id) {
  return parseFloat(document.getElementById(id).value) || 0;
}

function calculate() {
  const entry   = getVal('entry');
  const sl      = getVal('sl');
  const tp1     = getVal('tp1');
  const tp2     = getVal('tp2');
  const tp3     = getVal('tp3');
  const balance = getVal('balance');
  const riskPct = getVal('risk');
  const lotManual = getVal('lot-manual');
  const useLotManual = document.getElementById('mode-manual').classList.contains('active');

  // Validation
  const errors = [];
  if (!entry) errors.push('Harga Entry wajib diisi');
  if (!sl)    errors.push('Stop Loss wajib diisi');
  if (!tp1)   errors.push('Minimal TP1 wajib diisi');
  if (!balance) errors.push('Balance wajib diisi');
  if (!riskPct) errors.push('Risk % wajib diisi');

  if (direction === 'BUY') {
    if (sl && entry && sl >= entry) errors.push('SL harus di BAWAH Entry untuk BUY');
    if (tp1 && entry && tp1 <= entry) errors.push('TP1 harus di ATAS Entry untuk BUY');
    if (tp2 && tp1 && tp2 <= tp1)   errors.push('TP2 harus di atas TP1');
    if (tp3 && tp2 && tp3 <= tp2)   errors.push('TP3 harus di atas TP2');
  } else {
    if (sl && entry && sl <= entry) errors.push('SL harus di ATAS Entry untuk SELL');
    if (tp1 && entry && tp1 >= entry) errors.push('TP1 harus di BAWAH Entry untuk SELL');
    if (tp2 && tp1 && tp2 >= tp1)   errors.push('TP2 harus di bawah TP1');
    if (tp3 && tp2 && tp3 >= tp2)   errors.push('TP3 harus di bawah TP2');
  }

  if (errors.length) {
    showValidationError(errors);
    return;
  }

  // === CORE CALCULATIONS ===
  // XAUUSD: 1 lot = 100 oz, 1 pip = $0.01, nilai per pip per lot = $1
  // Tapi konvensi umum: 1 pip XAUUSD = $0.1 movement, 1 lot = $10/pip, 0.01 lot = $0.10/pip
  // Formula: pip value per lot = $10 (untuk pair XAU/USD standar)

  const slPips    = Math.abs(entry - sl);
  const tp1Pips   = tp1 ? Math.abs(tp1 - entry) : 0;
  const tp2Pips   = tp2 ? Math.abs(tp2 - entry) : 0;
  const tp3Pips   = tp3 ? Math.abs(tp3 - entry) : 0;

  const pipValuePerLot = 10; // $10 per pip per 1.0 lot (XAUUSD standar)

  // Risk amount in dollar
  const riskDollar = balance * (riskPct / 100);

  // Lot size based on risk
  const lotAuto = riskDollar / (slPips * pipValuePerLot);
  const lot = useLotManual && lotManual > 0 ? lotManual : lotAuto;

  // Dollar values
  const slDollar  = lot * slPips  * pipValuePerLot;
  const tp1Dollar = tp1 ? lot * tp1Pips * pipValuePerLot : 0;
  const tp2Dollar = tp2 ? lot * tp2Pips * pipValuePerLot : 0;
  const tp3Dollar = tp3 ? lot * tp3Pips * pipValuePerLot : 0;

  // R:R
  const rr1 = tp1Pips / slPips;
  const rr2 = tp2 ? tp2Pips / slPips : null;
  const rr3 = tp3 ? tp3Pips / slPips : null;

  // Render result
  renderResult({
    direction, entry, sl, tp1, tp2, tp3,
    slPips, tp1Pips, tp2Pips, tp3Pips,
    lot, lotAuto, riskDollar,
    slDollar, tp1Dollar, tp2Dollar, tp3Dollar,
    rr1, rr2, rr3,
    balance, riskPct,
    tf: document.getElementById('tf').value,
    session: document.getElementById('session').value,
  });
}

/* ===================== LOT MODE TOGGLE ===================== */

document.getElementById('mode-auto').addEventListener('click', () => {
  document.getElementById('mode-auto').classList.add('active');
  document.getElementById('mode-manual').classList.remove('active');
  document.getElementById('lot-manual-wrap').style.display = 'none';
});
document.getElementById('mode-manual').addEventListener('click', () => {
  document.getElementById('mode-manual').classList.add('active');
  document.getElementById('mode-auto').classList.remove('active');
  document.getElementById('lot-manual-wrap').style.display = 'block';
});

/* ===================== VALIDATION ERROR ===================== */

function showValidationError(errors) {
  const out = document.getElementById('output');
  out.style.display = 'block';
  document.getElementById('empty-state').style.display = 'none';
  out.innerHTML = `
    <div class="error-card">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:2px">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div>
        <strong>Input tidak valid</strong>
        <ul style="margin-top:6px;padding-left:16px;line-height:2">
          ${errors.map(e => `<li>${e}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

/* ===================== RENDER RESULT ===================== */

function renderResult(d) {
  const out = document.getElementById('output');
  document.getElementById('empty-state').style.display = 'none';
  out.style.display = 'block';

  const isBuy = d.direction === 'BUY';
  const dirClass = isBuy ? 'dir-buy' : 'dir-sell';
  const dirColor = isBuy ? 'var(--green)' : 'var(--red)';

  // Risk bar widths — proporsional
  const maxPips = Math.max(d.slPips, d.tp1Pips, d.tp2Pips || 0, d.tp3Pips || 0, 1);
  const totalBar = d.slPips + d.tp1Pips + (d.tp2Pips || 0) + (d.tp3Pips || 0) || 1;
  const slW   = ((d.slPips   / totalBar) * 100).toFixed(1);
  const tp1W  = ((d.tp1Pips  / totalBar) * 100).toFixed(1);
  const tp2W  = d.tp2Pips ? ((d.tp2Pips / totalBar) * 100).toFixed(1) : 0;
  const tp3W  = d.tp3Pips ? ((d.tp3Pips / totalBar) * 100).toFixed(1) : 0;

  // TP cards
  const tpCards = [
    { n: 1, price: d.tp1, pips: d.tp1Pips, dollar: d.tp1Dollar, rr: d.rr1, cls: '' },
    { n: 2, price: d.tp2, pips: d.tp2Pips, dollar: d.tp2Dollar, rr: d.rr2, cls: 'tp-2' },
    { n: 3, price: d.tp3, pips: d.tp3Pips, dollar: d.tp3Dollar, rr: d.rr3, cls: 'tp-3' },
  ].filter(t => t.price);

  // Quality badge
  const bestRR = d.rr2 || d.rr1;
  let quality = '', qualityClass = '';
  if (bestRR >= 3)      { quality = '🔥 Excellent Setup'; qualityClass = 'badge-green'; }
  else if (bestRR >= 2) { quality = '✅ Good Setup';      qualityClass = 'badge-blue'; }
  else if (bestRR >= 1.5){ quality = '⚠️ Acceptable';    qualityClass = 'badge-amber'; }
  else                  { quality = '❌ Poor R:R';        qualityClass = 'badge-red'; }

  out.innerHTML = `
    <!-- BANNER -->
    <div class="result-banner ${dirClass}">
      <div class="banner-left">
        <div class="banner-dir">${d.direction}</div>
        <div class="banner-meta">XAU/USD · ${d.tf} · ${d.session}</div>
      </div>
      <div class="banner-right">
        <span class="quality-badge ${qualityClass}">${quality}</span>
      </div>
    </div>

    <!-- KEY LEVELS -->
    <div class="levels-grid">
      <div class="level-card level-entry">
        <div class="level-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14"/><path d="M5 12l7-7 7 7"/></svg>
        </div>
        <div class="level-label">Entry</div>
        <div class="level-price">${fmt(d.entry)}</div>
        <div class="level-sub">${d.direction === 'BUY' ? 'Market / Limit Buy' : 'Market / Limit Sell'}</div>
      </div>
      <div class="level-card level-sl">
        <div class="level-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5"/><path d="M5 12l7 7 7-7"/></svg>
        </div>
        <div class="level-label">Stop Loss</div>
        <div class="level-price">${fmt(d.sl)}</div>
        <div class="level-sub">${fmt(d.slPips)} pips · <span style="color:var(--red)">-$${fmt2(d.slDollar)}</span></div>
      </div>
      <div class="level-card level-lot">
        <div class="level-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        </div>
        <div class="level-label">Lot Size</div>
        <div class="level-price">${d.lot.toFixed(2)}</div>
        <div class="level-sub">Risk $${fmt2(d.riskDollar)} (${d.riskPct}%)</div>
      </div>
    </div>

    <!-- TP LEVELS -->
    <div class="section-title">Take Profit Levels</div>
    <div class="tp-grid">
      ${tpCards.map(t => `
        <div class="tp-card ${t.cls}">
          <div class="tp-num">TP${t.n}</div>
          <div class="tp-price">${fmt(t.price)}</div>
          <div class="tp-rr">R:R ${t.rr.toFixed(2)}R</div>
          <div class="tp-pips">${fmt(t.pips)} pips</div>
          <div class="tp-profit">+$${fmt2(t.dollar)}</div>
        </div>
      `).join('')}
    </div>

    <!-- RISK BAR -->
    <div class="risk-bar-card">
      <div class="risk-bar-header">
        <span>Visualisasi Risk vs Reward</span>
        <span class="rr-summary">TP1: ${d.rr1.toFixed(2)}R${d.rr2 ? ` · TP2: ${d.rr2.toFixed(2)}R` : ''}${d.rr3 ? ` · TP3: ${d.rr3.toFixed(2)}R` : ''}</span>
      </div>
      <div class="risk-bar-track">
        <div class="risk-bar-sl"  style="width:${slW}%"  title="SL: ${fmt(d.slPips)} pips"></div>
        <div class="risk-bar-tp1" style="width:${tp1W}%" title="TP1: ${fmt(d.tp1Pips)} pips"></div>
        ${d.tp2Pips ? `<div class="risk-bar-tp2" style="width:${tp2W}%" title="TP2: ${fmt(d.tp2Pips)} pips"></div>` : ''}
        ${d.tp3Pips ? `<div class="risk-bar-tp3" style="width:${tp3W}%" title="TP3: ${fmt(d.tp3Pips)} pips"></div>` : ''}
      </div>
      <div class="risk-bar-legend">
        <span class="legend-sl">■ SL (${fmt(d.slPips)} pips)</span>
        <span class="legend-tp1">■ TP1 (${fmt(d.tp1Pips)} pips)</span>
        ${d.tp2Pips ? `<span class="legend-tp2">■ TP2 (${fmt(d.tp2Pips)} pips)</span>` : ''}
        ${d.tp3Pips ? `<span class="legend-tp3">■ TP3 (${fmt(d.tp3Pips)} pips)</span>` : ''}
      </div>
    </div>

    <!-- SUMMARY TABLE -->
    <div class="section-title">Ringkasan Kalkulasi</div>
    <div class="summary-table">
      <div class="sum-row"><span>Balance Akun</span><span>$${fmt2(d.balance)}</span></div>
      <div class="sum-row"><span>Risk per Trade</span><span>${d.riskPct}% · <span style="color:var(--red)">-$${fmt2(d.riskDollar)}</span></span></div>
      <div class="sum-row"><span>Lot Size</span><span>${d.lot.toFixed(2)} lot${d.lot !== d.lotAuto ? ` <span style="color:var(--text-muted);font-size:11px">(manual)</span>` : ''}</span></div>
      <div class="sum-row"><span>Jarak SL</span><span>${fmt(d.slPips)} pips · $${fmt2(d.slDollar)}</span></div>
      <div class="sum-row"><span>Pip Value</span><span>$${(d.lot * 10).toFixed(2)} / pip</span></div>
      ${d.tp1 ? `<div class="sum-row sum-profit"><span>Profit TP1</span><span style="color:var(--green)">+$${fmt2(d.tp1Dollar)} (R:R ${d.rr1.toFixed(2)})</span></div>` : ''}
      ${d.tp2 ? `<div class="sum-row sum-profit"><span>Profit TP2</span><span style="color:var(--green)">+$${fmt2(d.tp2Dollar)} (R:R ${d.rr2.toFixed(2)})</span></div>` : ''}
      ${d.tp3 ? `<div class="sum-row sum-profit"><span>Profit TP3</span><span style="color:var(--green)">+$${fmt2(d.tp3Dollar)} (R:R ${d.rr3.toFixed(2)})</span></div>` : ''}
    </div>

    <button class="btn-reset" onclick="resetForm()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.27"/></svg>
      Hitung Ulang
    </button>
  `;
}

/* ===================== HELPERS ===================== */

function fmt(v)  { return v ? parseFloat(v).toFixed(3) : '—'; }
function fmt2(v) { return v ? parseFloat(v).toFixed(2) : '—'; }

function resetForm() {
  ['entry','sl','tp1','tp2','tp3'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('output').style.display = 'none';
  document.getElementById('empty-state').style.display = 'flex';
  document.getElementById('entry').focus();
}

/* === Init === */
document.getElementById('entry').focus();
