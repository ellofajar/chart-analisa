/* === XAU/USD MARKET CONDITION ANALYZER === */

/* ===================== ENGINE: RULE-BASED DECISION ===================== */

function analyze(m) {
  const signals = { buy: 0, sell: 0, reasons: [], warnings: [] };

  // --- TREND via EMA ---
  const emaTrend = m.ema50 && m.ema200
    ? (m.ema50 > m.ema200 ? 'bullish' : m.ema50 < m.ema200 ? 'bearish' : 'neutral')
    : m.trend;

  if (emaTrend === 'bullish') { signals.buy  += 2; signals.reasons.push('EMA50 di atas EMA200 — trend bullish'); }
  if (emaTrend === 'bearish') { signals.sell += 2; signals.reasons.push('EMA50 di bawah EMA200 — trend bearish'); }

  // Price vs EMA50
  if (m.ema50 && m.price) {
    if (m.price > m.ema50) { signals.buy  += 1; signals.reasons.push(`Harga (${m.price}) di atas EMA50 (${m.ema50})`); }
    else                   { signals.sell += 1; signals.reasons.push(`Harga (${m.price}) di bawah EMA50 (${m.ema50})`); }
  }

  // --- RSI ---
  if (m.rsi) {
    if (m.rsi <= 30)       { signals.buy  += 2; signals.reasons.push(`RSI ${m.rsi} — oversold, potensi reversal naik`); }
    else if (m.rsi >= 70)  { signals.sell += 2; signals.reasons.push(`RSI ${m.rsi} — overbought, potensi reversal turun`); }
    else if (m.rsi < 50)   { signals.sell += 1; signals.reasons.push(`RSI ${m.rsi} — momentum bearish (di bawah 50)`); }
    else if (m.rsi > 50)   { signals.buy  += 1; signals.reasons.push(`RSI ${m.rsi} — momentum bullish (di atas 50)`); }
    if (m.rsi > 80)        signals.warnings.push('RSI ekstrem (>80) — risiko koreksi tajam');
    if (m.rsi < 20)        signals.warnings.push('RSI ekstrem (<20) — potensi bounce kuat');
  }

  // --- MACD ---
  if (m.macdLine !== '' && m.macdSignal !== '') {
    const macdDiff = m.macdLine - m.macdSignal;
    if (macdDiff > 0 && m.macdLine > 0) { signals.buy  += 2; signals.reasons.push(`MACD ${m.macdLine} > Signal ${m.macdSignal} — momentum bullish di atas zero`); }
    else if (macdDiff > 0)              { signals.buy  += 1; signals.reasons.push(`MACD crossover bullish (masih di bawah zero)`); }
    else if (macdDiff < 0 && m.macdLine < 0) { signals.sell += 2; signals.reasons.push(`MACD ${m.macdLine} < Signal ${m.macdSignal} — momentum bearish di bawah zero`); }
    else if (macdDiff < 0)              { signals.sell += 1; signals.reasons.push(`MACD crossover bearish (masih di atas zero)`); }
  }

  // --- PRICE ACTION / CANDLE ---
  const bullishCandles = ['bullish engulfing','hammer','morning star','pin bar bullish','bullish harami','tweezer bottom','dragonfly doji'];
  const bearishCandles = ['bearish engulfing','shooting star','evening star','pin bar bearish','bearish harami','tweezer top','gravestone doji'];
  if (m.candle) {
    const c = m.candle.toLowerCase();
    if (bullishCandles.some(x => c.includes(x))) { signals.buy  += 2; signals.reasons.push(`Pola candle: ${m.candle} — sinyal reversal/lanjutan bullish`); }
    if (bearishCandles.some(x => c.includes(x))) { signals.sell += 2; signals.reasons.push(`Pola candle: ${m.candle} — sinyal reversal/lanjutan bearish`); }
  }

  // --- STRUKTUR MARKET ---
  const bullishStruct = ['bos bullish','choch bullish','higher high','higher low','break of structure up'];
  const bearishStruct = ['bos bearish','choch bearish','lower high','lower low','break of structure down'];
  if (m.struktur) {
    const s = m.struktur.toLowerCase();
    if (bullishStruct.some(x => s.includes(x))) { signals.buy  += 2; signals.reasons.push(`Struktur: ${m.struktur} — konfirmasi bullish`); }
    if (bearishStruct.some(x => s.includes(x))) { signals.sell += 2; signals.reasons.push(`Struktur: ${m.struktur} — konfirmasi bearish`); }
  }

  // --- DECISION ---
  const totalSignals = signals.buy + signals.sell;
  const minSignals = 4;

  let direction, confidence;

  if (totalSignals < minSignals || Math.abs(signals.buy - signals.sell) < 2) {
    direction  = 'WAIT';
    confidence = Math.round((Math.abs(signals.buy - signals.sell) / Math.max(totalSignals, 1)) * 60);
  } else if (signals.buy > signals.sell) {
    direction  = 'BUY';
    confidence = Math.min(95, Math.round((signals.buy / totalSignals) * 100));
  } else {
    direction  = 'SELL';
    confidence = Math.min(95, Math.round((signals.sell / totalSignals) * 100));
  }

  // --- LEVEL KALKULASI ---
  const atr = m.atr || (m.resistance - m.support) * 0.3;
  const price = m.price;
  const support = m.support;
  const resistance = m.resistance;

  let entry, sl, tp1, tp2, tp3;

  if (direction === 'BUY') {
    // Entry: sedikit di atas support atau current price jika sudah bounce
    entry = price <= support * 1.002
      ? +(support + atr * 0.2).toFixed(3)
      : +(price + atr * 0.1).toFixed(3);
    sl  = +(support - atr * 0.5).toFixed(3);
    tp1 = +(entry + (entry - sl) * 1.5).toFixed(3);
    tp2 = +(resistance).toFixed(3);
    tp3 = +(resistance + atr * 1.0).toFixed(3);
  } else if (direction === 'SELL') {
    entry = price >= resistance * 0.998
      ? +(resistance - atr * 0.2).toFixed(3)
      : +(price - atr * 0.1).toFixed(3);
    sl  = +(resistance + atr * 0.5).toFixed(3);
    tp1 = +(entry - (sl - entry) * 1.5).toFixed(3);
    tp2 = +(support).toFixed(3);
    tp3 = +(support - atr * 1.0).toFixed(3);
  } else {
    // WAIT — tetap tampilkan level potensial
    entry = +(price).toFixed(3);
    sl    = direction === 'WAIT' && signals.buy >= signals.sell
      ? +(support - atr * 0.5).toFixed(3)
      : +(resistance + atr * 0.5).toFixed(3);
    tp1   = +(price + atr * 1.5).toFixed(3);
    tp2   = +(resistance).toFixed(3);
    tp3   = null;
  }

  const slPips   = Math.abs(entry - sl);
  const tp1Pips  = Math.abs(tp1 - entry);
  const tp2Pips  = tp2 ? Math.abs(tp2 - entry) : 0;
  const tp3Pips  = tp3 ? Math.abs(tp3 - entry) : 0;
  const rr1      = +(tp1Pips / slPips).toFixed(2);
  const rr2      = tp2 ? +(tp2Pips / slPips).toFixed(2) : null;
  const rr3      = tp3 ? +(tp3Pips / slPips).toFixed(2) : null;

  // Setup name
  let setupName = '';
  if (direction === 'BUY')  setupName = `Bullish ${m.candle || (m.struktur || 'Continuation')}`;
  if (direction === 'SELL') setupName = `Bearish ${m.candle || (m.struktur || 'Continuation')}`;
  if (direction === 'WAIT') setupName = 'Sinyal belum cukup kuat — tunggu konfirmasi';

  if (m.rsi <= 30 && direction === 'BUY')  setupName = 'Oversold Reversal dari Support';
  if (m.rsi >= 70 && direction === 'SELL') setupName = 'Overbought Reversal dari Resistance';

  return {
    direction, confidence, setupName,
    entry, sl, tp1, tp2, tp3,
    slPips, tp1Pips, tp2Pips, tp3Pips,
    rr1, rr2, rr3,
    signals, emaTrend, atr,
    waitCondition: direction === 'WAIT'
      ? `Tunggu konfirmasi arah: ${signals.buy > signals.sell ? 'butuh sinyal bullish tambahan (candle/BOS)' : 'butuh sinyal bearish tambahan (candle/BOS)'}`
      : null,
  };
}

/* ===================== FORM SUBMIT ===================== */

document.getElementById('btn-analyze').addEventListener('click', run);
document.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) run(); });

function getVal(id) { return parseFloat(document.getElementById(id).value) || 0; }
function getStr(id) { return document.getElementById(id).value.trim(); }

function run() {
  const errors = [];
  const price      = getVal('price');
  const support    = getVal('support');
  const resistance = getVal('resistance');
  const atr        = getVal('atr');
  const ema50      = getVal('ema50');
  const ema200     = getVal('ema200');
  const rsi        = getVal('rsi');
  const macdLine   = document.getElementById('macd-line').value.trim();
  const macdSignal = document.getElementById('macd-signal').value.trim();
  const candle     = getStr('candle');
  const struktur   = getStr('struktur');
  const trend      = getStr('trend');

  if (!price)      errors.push('Current Price wajib diisi');
  if (!support)    errors.push('Support wajib diisi');
  if (!resistance) errors.push('Resistance wajib diisi');
  if (support >= resistance) errors.push('Support harus lebih kecil dari Resistance');
  if (rsi && (rsi < 0 || rsi > 100)) errors.push('RSI harus antara 0–100');

  if (errors.length) {
    showError(errors);
    return;
  }

  const result = analyze({
    price, support, resistance, atr,
    ema50, ema200, rsi,
    macdLine: macdLine !== '' ? parseFloat(macdLine) : '',
    macdSignal: macdSignal !== '' ? parseFloat(macdSignal) : '',
    candle, struktur, trend,
  });

  renderResult(result, { price, support, resistance, atr, ema50, ema200, rsi, macdLine, macdSignal, candle, struktur });
}

/* ===================== RENDER ===================== */

function renderResult(r, m) {
  document.getElementById('empty-state').style.display = 'none';
  const out = document.getElementById('output');
  out.style.display = 'block';

  const isBuy  = r.direction === 'BUY';
  const isSell = r.direction === 'SELL';
  const isWait = r.direction === 'WAIT';
  const dirClass = isBuy ? 'dir-buy' : isSell ? 'dir-sell' : 'dir-wait';

  // Confidence ring
  const circ    = 2 * Math.PI * 15.9;
  const dashLen = (r.confidence / 100) * circ;
  const ringColor = r.confidence >= 70 ? '#22c55e' : r.confidence >= 50 ? '#f59e0b' : '#ef4444';

  // Quality badge
  const bestRR = r.rr2 || r.rr1;
  let badge = '', badgeClass = '';
  if (isWait)           { badge = '⏳ Wait — Konfirmasi Dulu'; badgeClass = 'badge-amber'; }
  else if (bestRR >= 3) { badge = '🔥 Excellent Setup';        badgeClass = 'badge-green'; }
  else if (bestRR >= 2) { badge = '✅ Good Setup';             badgeClass = 'badge-blue';  }
  else if (bestRR >= 1.5){ badge = '⚠️ Acceptable Setup';     badgeClass = 'badge-amber'; }
  else                  { badge = '❌ Poor R:R — Skip';        badgeClass = 'badge-red';   }

  // TP cards
  const tps = [
    { n:1, price: r.tp1, pips: r.tp1Pips, rr: r.rr1, cls: '' },
    { n:2, price: r.tp2, pips: r.tp2Pips, rr: r.rr2, cls: 'tp-2' },
    { n:3, price: r.tp3, pips: r.tp3Pips, rr: r.rr3, cls: 'tp-3' },
  ].filter(t => t.price);

  // Risk bar
  const total = r.slPips + r.tp1Pips + (r.tp2Pips||0) + (r.tp3Pips||0) || 1;
  const slW  = ((r.slPips   / total) * 100).toFixed(1);
  const tp1W = ((r.tp1Pips  / total) * 100).toFixed(1);
  const tp2W = ((r.tp2Pips  / total) * 100).toFixed(1);
  const tp3W = r.tp3Pips ? ((r.tp3Pips / total) * 100).toFixed(1) : 0;

  // Signal tags
  const buyTags  = r.signals.buy  > 0 ? `<span class="sig-count buy">▲ ${r.signals.buy} sinyal bullish</span>` : '';
  const sellTags = r.signals.sell > 0 ? `<span class="sig-count sell">▼ ${r.signals.sell} sinyal bearish</span>` : '';

  out.innerHTML = `
    <!-- BANNER -->
    <div class="result-banner ${dirClass}">
      <div class="banner-left">
        <div class="banner-dir">${r.direction}</div>
        <div class="banner-setup">${r.setupName}</div>
      </div>
      <div class="banner-right">
        <div class="conf-wrap">
          <div class="conf-label">Confidence</div>
          <div class="conf-value">${r.confidence}%</div>
        </div>
        <div class="conf-ring">
          <svg viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke-width="3" class="ring-track"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke-width="3" class="ring-fill"
              stroke-dasharray="${dashLen.toFixed(1)} ${circ.toFixed(1)}"
              stroke-dashoffset="25"
              style="stroke:${ringColor}"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- BADGE -->
    <div style="margin-bottom:14px">
      <span class="quality-badge ${badgeClass}">${badge}</span>
    </div>

    <!-- SIGNAL SUMMARY -->
    <div class="signal-summary">
      <div class="signal-label">Sinyal Terbaca</div>
      <div class="signal-tags">${buyTags}${sellTags}</div>
      <div class="signal-reasons">
        ${r.signals.reasons.map(s => `<div class="signal-item">${s}</div>`).join('')}
      </div>
    </div>

    <!-- KEY LEVELS -->
    <div class="section-title">Level Kalkulasi</div>
    <div class="levels-grid">
      <div class="level-card level-entry">
        <div class="level-label">Entry</div>
        <div class="level-price">${fmt(r.entry)}</div>
        <div class="level-sub">${isBuy ? 'Limit Buy / Market' : isSell ? 'Limit Sell / Market' : 'Level potensial'}</div>
      </div>
      <div class="level-card level-sl">
        <div class="level-label">Stop Loss</div>
        <div class="level-price">${fmt(r.sl)}</div>
        <div class="level-sub">${fmt(r.slPips)} pips dari entry</div>
      </div>
    </div>

    <!-- TP LEVELS -->
    <div class="section-title">Take Profit</div>
    <div class="tp-grid">
      ${tps.map(t => `
        <div class="tp-card ${t.cls}">
          <div class="tp-num">TP${t.n}</div>
          <div class="tp-price">${fmt(t.price)}</div>
          <div class="tp-rr">R:R ${parseFloat(t.rr).toFixed(2)}R</div>
          <div class="tp-pips">${fmt(t.pips)} pips</div>
        </div>
      `).join('')}
    </div>

    <!-- RISK BAR -->
    <div class="risk-bar-card">
      <div class="risk-bar-header">
        <span>Visualisasi Risk vs Reward</span>
        <span class="rr-summary">TP1: ${r.rr1}R${r.rr2 ? ` · TP2: ${r.rr2}R` : ''}${r.rr3 ? ` · TP3: ${r.rr3}R` : ''}</span>
      </div>
      <div class="risk-bar-track">
        <div class="risk-bar-sl"  style="width:${slW}%"></div>
        <div class="risk-bar-tp1" style="width:${tp1W}%"></div>
        ${r.tp2Pips ? `<div class="risk-bar-tp2" style="width:${tp2W}%"></div>` : ''}
        ${r.tp3Pips ? `<div class="risk-bar-tp3" style="width:${tp3W}%"></div>` : ''}
      </div>
      <div class="risk-bar-legend">
        <span class="legend-sl">■ SL (${fmt(r.slPips)} pips)</span>
        <span class="legend-tp1">■ TP1 (${fmt(r.tp1Pips)} pips)</span>
        ${r.tp2Pips ? `<span class="legend-tp2">■ TP2 (${fmt(r.tp2Pips)} pips)</span>` : ''}
        ${r.tp3Pips ? `<span class="legend-tp3">■ TP3 (${fmt(r.tp3Pips)} pips)</span>` : ''}
      </div>
    </div>

    ${isWait ? `
    <div class="wait-card">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span>${r.waitCondition}</span>
    </div>` : ''}

    ${r.signals.warnings.length ? `
    <div class="warning-card">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>${r.signals.warnings.join(' · ')}</span>
    </div>` : ''}

    <button class="btn-reset" onclick="resetForm()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.27"/></svg>
      Analisa Ulang
    </button>
  `;
}

/* ===================== ERROR ===================== */

function showError(errors) {
  document.getElementById('empty-state').style.display = 'none';
  const out = document.getElementById('output');
  out.style.display = 'block';
  out.innerHTML = `
    <div class="error-card">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:2px">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div>
        <strong>Input tidak lengkap</strong>
        <ul style="margin-top:6px;padding-left:16px;line-height:2">
          ${errors.map(e => `<li>${e}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

/* ===================== RESET ===================== */

function resetForm() {
  ['price','support','resistance','atr','ema50','ema200','rsi','macd-line','macd-signal'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('candle').value = '';
  document.getElementById('struktur').value = '';
  document.getElementById('output').style.display = 'none';
  document.getElementById('empty-state').style.display = 'flex';
  document.getElementById('price').focus();
}

/* ===================== HELPERS ===================== */

function fmt(v) { return v != null ? parseFloat(v).toFixed(3) : '—'; }

/* === Init === */
document.getElementById('price').focus();
