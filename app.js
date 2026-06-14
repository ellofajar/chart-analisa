/* === XAU/USD AI ANALYZER === */

let imgBase64 = null;
let imgMime = 'image/png';
let currentStep = 0;
let stepTimer = null;

const STEPS = [
  { id: 'step-1', label: 'Memuat gambar chart' },
  { id: 'step-2', label: 'Membaca indikator & price action' },
  { id: 'step-3', label: 'Mengidentifikasi S/R & struktur' },
  { id: 'step-4', label: 'Menghitung Entry · SL · TP optimal' },
  { id: 'step-5', label: 'Memvalidasi sinyal & risk management' },
];

/* ===================== FILE HANDLING ===================== */

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadFile(f);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});
document.getElementById('btn-remove').addEventListener('click', resetAll);

function loadFile(file) {
  imgMime = file.type || 'image/png';
  const reader = new FileReader();
  reader.onload = ev => {
    imgBase64 = ev.target.result.split(',')[1];
    showPreview(ev.target.result);
    document.getElementById('btn-analyze').disabled = false;
  };
  reader.readAsDataURL(file);
}

function showPreview(src) {
  document.getElementById('drop-zone').style.display = 'none';
  const pa = document.getElementById('preview-area');
  pa.style.display = 'block';
  document.getElementById('preview-img').src = src;
}

/* ===================== API KEY STORAGE ===================== */

const apiKeyInput = document.getElementById('api-key');
const stored = localStorage.getItem('xau_gemini_key');
if (stored) apiKeyInput.value = stored;
apiKeyInput.addEventListener('change', () => {
  const key = apiKeyInput.value.trim();
  if (key) {
    localStorage.setItem('xau_gemini_key', key);
  } else {
    localStorage.removeItem('xau_gemini_key');
  }
});

function getApiKey() {
  return apiKeyInput.value.trim() || localStorage.getItem('xau_gemini_key') || '';
}

/* ===================== LOADING STEPS ===================== */

function startLoadingSteps() {
  currentStep = 0;
  STEPS.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) { el.className = 'loading-step'; }
  });
  advanceStep();
  stepTimer = setInterval(() => advanceStep(), 1800);
}

function advanceStep() {
  if (currentStep > 0) {
    const prev = document.getElementById(STEPS[currentStep - 1].id);
    if (prev) prev.className = 'loading-step done';
  }
  if (currentStep < STEPS.length) {
    const cur = document.getElementById(STEPS[currentStep].id);
    if (cur) cur.className = 'loading-step active';
    currentStep++;
  }
}

function stopLoadingSteps() {
  clearInterval(stepTimer);
  STEPS.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) el.className = 'loading-step done';
  });
}

/* ===================== UI STATE ===================== */

function showEmpty() {
  document.getElementById('empty-state').style.display = 'flex';
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('result-area').style.display = 'none';
}

function showLoading() {
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('loading-state').style.display = 'block';
  document.getElementById('result-area').style.display = 'none';
}

function showResult() {
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('result-area').style.display = 'block';
}

function showError(msg) {
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('result-area').style.display = 'block';
  document.getElementById('result-area').innerHTML = `
    <div class="error-card">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div>
        <strong>Analisa gagal</strong><br/>${msg}
      </div>
    </div>
    <button class="btn-new" onclick="resetAll()" style="margin-top:12px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.27"/></svg>
      Coba lagi
    </button>
  `;
}

/* ===================== RESET ===================== */

function resetAll() {
  imgBase64 = null;
  fileInput.value = '';
  document.getElementById('drop-zone').style.display = 'block';
  document.getElementById('preview-area').style.display = 'none';
  document.getElementById('preview-img').src = '';
  document.getElementById('btn-analyze').disabled = true;
  rebuildResultArea();
  showEmpty();
}

function rebuildResultArea() {
  const ra = document.getElementById('result-area');
  ra.innerHTML = `
    <div class="result-banner" id="result-banner">
      <div class="banner-left">
        <div class="banner-dir" id="banner-dir">BUY</div>
        <div class="banner-setup" id="banner-setup">—</div>
        <div class="banner-tf" id="banner-tf">M5</div>
      </div>
      <div class="banner-right">
        <div class="conf-wrap">
          <div class="conf-label">AI Confidence</div>
          <div class="conf-value" id="conf-value">—</div>
        </div>
        <div class="conf-ring" id="conf-ring">
          <svg viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke-width="3" class="ring-track"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke-width="3" class="ring-fill" id="ring-fill"
              stroke-dasharray="0 100" stroke-dashoffset="25"/>
          </svg>
        </div>
      </div>
    </div>
    <div class="levels-grid">
      <div class="level-card level-entry">
        <div class="level-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12l7-7 7 7"/></svg></div>
        <div class="level-label">Entry</div>
        <div class="level-price" id="lv-entry">—</div>
        <div class="level-reason" id="lv-entry-r">—</div>
      </div>
      <div class="level-card level-sl">
        <div class="level-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5"/><path d="M5 12l7 7 7-7"/></svg></div>
        <div class="level-label">Stop Loss</div>
        <div class="level-price" id="lv-sl">—</div>
        <div class="level-reason" id="lv-sl-r">—</div>
      </div>
      <div class="level-card level-lot">
        <div class="level-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></div>
        <div class="level-label">Lot size</div>
        <div class="level-price" id="lv-lot">—</div>
        <div class="level-reason" id="lv-lot-r">—</div>
      </div>
    </div>
    <div class="section-title">Take Profit Levels</div>
    <div class="tp-grid" id="tp-grid"></div>
    <div class="risk-bar-card">
      <div class="risk-bar-header"><span>Potensi profit vs risiko</span><span id="risk-summary-text">—</span></div>
      <div class="risk-bar-track">
        <div class="risk-bar-sl" id="risk-bar-sl"></div>
        <div class="risk-bar-tp1" id="risk-bar-tp1"></div>
        <div class="risk-bar-tp2" id="risk-bar-tp2"></div>
      </div>
      <div class="risk-bar-legend">
        <span class="legend-sl">■ SL</span>
        <span class="legend-tp1">■ TP1</span>
        <span class="legend-tp2">■ TP2</span>
      </div>
    </div>
    <div class="section-title">Analisa Teknikal</div>
    <div class="tags-section">
      <div class="tags-row"><div class="tags-label">Indikator terbaca</div><div class="tags-wrap" id="tags-ind"></div></div>
      <div class="tags-row"><div class="tags-label">Price action & struktur</div><div class="tags-wrap" id="tags-pa"></div></div>
      <div class="tags-row"><div class="tags-label">Sinyal konfirmasi</div><div class="tags-wrap" id="tags-sig"></div></div>
    </div>
    <div class="trend-card"><div class="trend-label">Analisa Trend</div><div class="trend-text" id="trend-text">—</div></div>
    <div class="warning-card" id="warning-card" style="display:none">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span id="warning-text">—</span>
    </div>
    <div class="narasi-card"><div class="narasi-label">Ringkasan Analisa</div><div class="narasi-text" id="narasi-text">—</div></div>
    <button class="btn-new" onclick="resetAll()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.27"/></svg>
      Analisa Chart Baru
    </button>
  `;
}

/* ===================== BUILD PROMPT ===================== */

function buildPrompt(tf, bal, risk, session, note) {
  return `Kamu adalah senior trader XAUUSD (Gold/Dollar) berpengalaman lebih dari 10 tahun, spesialis teknikal analisis multi-timeframe. Kamu akan menganalisa screenshot chart XAUUSD ini secara sangat mendalam dan profesional.

PARAMETER:
- Timeframe chart: ${tf}
- Sesi trading aktif: ${session}
- Balance akun: $${bal}
- Risk per trade: ${risk}%
${note ? `- Konteks trader: ${note}` : ''}

INSTRUKSI ANALISA (lakukan step by step dalam pikiranmu):

1. BACA CHART: Identifikasi semua yang terlihat — candlestick, warna, body/shadow, posisi relatif
2. BACA INDIKATOR: Catat semua indikator beserta nilainya (EMA/MA lines dengan warnanya, RSI level, MACD histogram/signal, ATR value, Bollinger Bands, dll)
3. IDENTIFIKASI STRUKTUR: Higher High/Low atau Lower High/Low, BOS, CHOCH, Order Block, FVG, Imbalance
4. IDENTIFIKASI S/R: Level support resistance dari swing high/low yang terlihat
5. TENTUKAN TREND: Berdasarkan posisi harga vs MA, arah MA, momentum indikator
6. VALIDASI SETUP: Apakah ada konfluensi sinyal yang cukup untuk entry? Minimal 3 konfirmasi berbeda
7. KALKULASI LEVEL: Entry di level optimal (bukan sekedar harga saat ini), SL di bawah/atas struktur terdekat, TP berdasarkan level S/R berikutnya
8. RISK MANAGEMENT: Hitung lot size berdasarkan risk % dari balance, pastikan SL tidak terlalu sempit

ATURAN KETAT:
- Jika sinyal tidak cukup kuat (< 3 konfirmasi), berikan WAIT
- Entry harus di level yang logis (di S/R, di EMA, setelah retest, bukan di tengah-tengah)
- SL harus di balik struktur (bukan arbitrary poin)
- TP harus di resistance/support nyata yang terlihat di chart
- R:R minimum TP1 = 1.5, TP2 = 2.5
- Lot size: SL dollar = (balance × risk%) / (SL pips × $10 per pip per 0.1 lot)
- Jika WAIT, tetap berikan level potensial entry jika kondisi berubah

Berikan output dalam format JSON saja, tanpa markdown, tanpa teks di luar JSON:
{
  "direction": "BUY" atau "SELL" atau "WAIT",
  "setup_type": "nama setup spesifik (contoh: Bullish Reversal dari EMA 50, Bearish Continuation setelah BOS, Counter-trend Bounce dari S/R)",
  "confidence": angka 1-100,
  "current_price": angka harga yang terbaca dari chart,
  "trend_htf": "bullish/bearish/sideways berdasarkan indikator",
  "entry": angka harga entry ideal,
  "entry_type": "market/limit/stop — tipe order yang disarankan",
  "entry_reason": "alasan konkret titik entry ini (max 12 kata)",
  "sl": angka harga stop loss,
  "sl_reason": "alasan konkret penempatan SL (max 12 kata)",
  "sl_pips": jarak SL dari entry dalam poin (desimal),
  "sl_dollar": kerugian $ jika kena SL,
  "lot_suggested": lot size yang disarankan (2 desimal),
  "tp1": angka harga TP1,
  "tp1_label": "level/area apa",
  "tp1_rr": rasio RR TP1 (1 desimal),
  "tp1_profit": estimasi profit $ di TP1,
  "tp2": angka harga TP2,
  "tp2_label": "level/area apa",
  "tp2_rr": rasio RR TP2 (1 desimal),
  "tp2_profit": estimasi profit $ di TP2,
  "tp3": angka atau null,
  "tp3_label": "level/area atau null",
  "tp3_rr": angka atau null,
  "tp3_profit": angka atau null,
  "indikator_terbaca": ["list semua indikator yang terlihat di chart"],
  "price_action": ["pola candlestick atau struktur yang teridentifikasi"],
  "sinyal_masuk": ["list sinyal konfirmasi yang valid — min 3 jika direction bukan WAIT"],
  "trend_analysis": "analisa trend komprehensif berdasarkan semua indikator yang terbaca (2-3 kalimat)",
  "alasan": "narasi analisa lengkap 5-7 kalimat dalam bahasa Indonesia yang menjelaskan mengapa setup ini valid atau tidak valid, apa yang terlihat, dan bagaimana mengelola trade ini",
  "wait_condition": "kondisi yang perlu dipenuhi sebelum entry jika direction adalah WAIT — atau null",
  "warning": "risiko spesifik yang perlu diwaspadai — atau null"
}`;
}

/* ===================== MAIN ANALYSIS ===================== */

async function runAnalysis() {
  if (!imgBase64) return;

  const apiKey = getApiKey();
  if (!apiKey) {
    alert('Masukkan API Key Google Gemini terlebih dahulu di kolom pengaturan.\nDapatkan gratis di: https://aistudio.google.com/apikey');
    return;
  }

  const tf = document.getElementById('tf').value;
  const bal = document.getElementById('bal').value;
  const risk = document.getElementById('risk').value;
  const session = document.getElementById('session').value;
  const note = document.getElementById('note').value;

  // Lock button
  const btn = document.getElementById('btn-analyze');
  btn.disabled = true;
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .8s linear infinite">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Menganalisa...
  `;

  showLoading();
  startLoadingSteps();

  try {
    const GEMINI_MODEL = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: imgMime,
                data: imgBase64
              }
            },
            { text: buildPrompt(tf, bal, risk, session, note) }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
        }
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${resp.status}`;
      throw new Error(errMsg);
    }

    const data = await resp.json();

    // Gemini response structure
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) throw new Error('Respons kosong dari Gemini. Coba ulangi analisa.');

    const clean = raw.replace(/```json|```/g, '').trim();

    let d;
    try {
      d = JSON.parse(clean);
    } catch (parseErr) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) d = JSON.parse(match[0]);
      else throw new Error('Response bukan JSON valid. Coba ulangi analisa.');
    }

    stopLoadingSteps();
    renderResult(d, tf, parseFloat(bal), parseFloat(risk));

  } catch (err) {
    stopLoadingSteps();
    let msg = err.message;
    if (msg.includes('API_KEY_INVALID') || msg.includes('400')) msg = 'API Key Gemini tidak valid. Cek kembali key kamu.';
    if (msg.includes('403')) msg = 'API Key tidak punya akses. Pastikan Gemini API sudah diaktifkan.';
    if (msg.includes('429')) msg = 'Rate limit tercapai. Tunggu sebentar lalu coba lagi.';
    if (msg.includes('503') || msg.includes('overloaded')) msg = 'Server Gemini sedang sibuk. Coba beberapa menit lagi.';
    showError(msg);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
      Analisa Chart Sekarang
    `;
  }
}

/* ===================== RENDER RESULT ===================== */

function renderResult(d, tf, bal, risk) {
  rebuildResultArea();
  showResult();

  // Direction banner
  const banner = document.getElementById('result-banner');
  const dir = (d.direction || 'WAIT').toUpperCase();
  banner.className = 'result-banner dir-' + dir.toLowerCase();
  document.getElementById('banner-dir').textContent = dir;
  document.getElementById('banner-setup').textContent = d.setup_type || '—';
  document.getElementById('banner-tf').textContent = tf;

  // Confidence ring
  const conf = parseInt(d.confidence) || 0;
  document.getElementById('conf-value').textContent = conf + '%';
  const ringFill = document.getElementById('ring-fill');
  if (ringFill) {
    const circ = 2 * Math.PI * 15.9;
    const dashLen = (conf / 100) * circ;
    ringFill.style.strokeDasharray = dashLen.toFixed(1) + ' ' + circ.toFixed(1);
    ringFill.style.stroke = conf >= 70 ? '#22c55e' : conf >= 50 ? '#f59e0b' : '#ef4444';
  }

  // Key levels
  document.getElementById('lv-entry').textContent = fmtPrice(d.entry);
  document.getElementById('lv-entry-r').textContent = d.entry_reason || '—';
  document.getElementById('lv-sl').textContent = fmtPrice(d.sl);
  document.getElementById('lv-sl-r').textContent = d.sl_reason || '—';
  document.getElementById('lv-lot').textContent = parseFloat(d.lot_suggested || 0).toFixed(2) + ' lot';
  document.getElementById('lv-lot-r').textContent = `-$${parseFloat(d.sl_dollar || 0).toFixed(2)} jika kena SL`;

  // TP Grid
  const tpGrid = document.getElementById('tp-grid');
  const tps = [
    { n: 1, price: d.tp1, label: d.tp1_label, rr: d.tp1_rr, profit: d.tp1_profit, cls: '' },
    { n: 2, price: d.tp2, label: d.tp2_label, rr: d.tp2_rr, profit: d.tp2_profit, cls: 'tp-2' },
    { n: 3, price: d.tp3, label: d.tp3_label, rr: d.tp3_rr, profit: d.tp3_profit, cls: 'tp-3' },
  ].filter(t => t.price);

  tpGrid.innerHTML = tps.map(t => `
    <div class="tp-card ${t.cls}">
      <div class="tp-num">TP${t.n}</div>
      <div class="tp-price">${fmtPrice(t.price)}</div>
      <div class="tp-rr">R:R ${parseFloat(t.rr || 0).toFixed(1)}R</div>
      <div class="tp-lbl">${t.label || '—'}</div>
      ${t.profit ? `<div class="tp-profit">+$${parseFloat(t.profit).toFixed(0)}</div>` : ''}
    </div>
  `).join('');

  // Risk bar — proporsional terhadap pip aktual, total bar = 100%
  const slPips  = parseFloat(d.sl_pips || Math.abs((d.entry || 0) - (d.sl  || 0))) || 1;
  const tp1Pips = Math.abs((d.tp1 || 0) - (d.entry || 0)) || 0;
  const tp2Pips = Math.abs((d.tp2 || 0) - (d.entry || 0)) || 0;
  const totalPips = slPips + tp1Pips + tp2Pips || 1;
  const slW  = ((slPips  / totalPips) * 100).toFixed(1);
  const tp1W = ((tp1Pips / totalPips) * 100).toFixed(1);
  const tp2W = ((tp2Pips / totalPips) * 100).toFixed(1);
  document.getElementById('risk-bar-sl').style.width  = slW  + '%';
  document.getElementById('risk-bar-tp1').style.width = tp1W + '%';
  document.getElementById('risk-bar-tp2').style.width = tp2W + '%';
  const rr1 = parseFloat(d.tp1_rr || 0).toFixed(1);
  const rr2 = parseFloat(d.tp2_rr || 0).toFixed(1);
  document.getElementById('risk-summary-text').textContent = `TP1: ${rr1}R · TP2: ${rr2}R`;

  // Tags
  renderTags('tags-ind', d.indikator_terbaca || [], 'tag-ind');
  renderTags('tags-pa', d.price_action || [], 'tag-pa');
  renderTags('tags-sig', d.sinyal_masuk || [], 'tag-sig');

  // Trend
  document.getElementById('trend-text').textContent = d.trend_analysis || '—';

  // Warning
  if (d.warning) {
    document.getElementById('warning-card').style.display = 'flex';
    document.getElementById('warning-text').textContent = d.warning;
  }

  // Wait condition
  let narasiExtra = '';
  if (d.wait_condition) {
    narasiExtra = `\n\n⏳ Kondisi untuk entry: ${d.wait_condition}`;
  }
  document.getElementById('narasi-text').textContent = (d.alasan || '—') + narasiExtra;
}

function renderTags(containerId, items, cls) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items || !items.length) { el.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">—</span>'; return; }
  el.innerHTML = items.map(i => `<span class="tag ${cls}">${i}</span>`).join('');
}

function fmtPrice(v) {
  if (v === null || v === undefined) return '—';
  return parseFloat(v).toFixed(3);
}

/* === Init === */
showEmpty();