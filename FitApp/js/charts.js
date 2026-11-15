/* ==========================================================================
   TanYar Vector Charts (charts.js) — Athletic Carbon & Coral Palette
   ========================================================================== */

window.FIT_CHARTS = (() => {
  'use strict';

  const fa = (n, d = 0) => Number(n).toLocaleString('fa-IR', { maximumFractionDigits: d });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  function renderSemiGauge({ value, min, max, zones, badgeText, badgeColor, unit, subText }) {
    const cx = 130, cy = 122, r = 96;
    const clamped = clamp(value, min, max);
    const totalSpan = max - min;

    const arcs = zones.map(z => {
      const s = clamp(z.min, min, max);
      const e = clamp(z.max, min, max);
      if (e <= s) return '';
      const a1 = 180 + ((s - min) / totalSpan) * 180;
      const a2 = 180 + ((e - min) / totalSpan) * 180;
      const gap = 1.4;
      if (a2 - a1 <= gap * 2) return '';
      return `<path d="${describeArc(cx, cy, r, a1 + gap, a2 - gap)}" fill="none" stroke="${z.color}" stroke-width="14" stroke-linecap="round"/>`;
    }).join('');

    const valAngle = 180 + ((clamped - min) / totalSpan) * 180;
    const pointer = polarToCartesian(cx, cy, r, valAngle);

    const legend = zones.map(z => `
      <span class="gauge-zone-pill">
        <i style="background:${z.color}"></i>
        <span>${z.name}</span>
      </span>
    `).join('');

    return `
      <div class="gauge-wrap">
        <svg viewBox="0 0 260 146" class="gauge-svg" aria-hidden="true">
          <path d="${describeArc(cx, cy, r, 180, 360)}" fill="none" stroke="var(--surface-3)" stroke-width="14" stroke-linecap="round"/>
          ${arcs}
          <circle cx="${pointer.x.toFixed(2)}" cy="${pointer.y.toFixed(2)}" r="10" fill="var(--surface)" stroke="${badgeColor}" stroke-width="4.5"/>
          <text x="${cx}" y="94" text-anchor="middle" class="gauge-val">${fa(value, 1)}${unit ? `<tspan class="gauge-unit">${unit}</tspan>` : ''}</text>
          <text x="32" y="141" text-anchor="middle" class="gauge-minmax">${fa(min)}</text>
          <text x="228" y="141" text-anchor="middle" class="gauge-minmax">${fa(max)}</text>
        </svg>
        <div class="gauge-badge" style="background:${badgeColor}1c;color:${badgeColor}">${badgeText}</div>
        <p class="gauge-sub">${subText}</p>
        <div class="gauge-legend">${legend}</div>
      </div>
    `;
  }

  function renderBmiChart(m) {
    const zones = [
      { min: 14, max: 18.5, color: '#60a5fa', name: 'کمبود (<۱۸.۵)' },
      { min: 18.5, max: 25, color: '#2dd4bf', name: 'نرمال (۱۸.۵-۲۵)' },
      { min: 25, max: 30, color: '#f5a623', name: 'اضافه‌وزن (۲۵-۳۰)' },
      { min: 30, max: 40, color: '#ff5733', name: 'چاقی (+۳۰)' }
    ];
    const diffAbs = Math.abs(m.weightDiff);
    const diffText = diffAbs < 1.2
      ? `در محدوده ایده‌آل قد خود هستید (${fa(m.healthyMin)} تا ${fa(m.healthyMax)} کیلو)`
      : m.weightDiff > 0
        ? `بازه سالم: <b>${fa(m.healthyMin)} تا ${fa(m.healthyMax)} کیلو</b> (${fa(diffAbs, 1)} کیلو بالاتر از وزن ایده‌آل)`
        : `بازه سالم: <b>${fa(m.healthyMin)} تا ${fa(m.healthyMax)} کیلو</b> (${fa(diffAbs, 1)} کیلو تا وزن ایده‌آل)`;

    return renderSemiGauge({
      value: m.bmi,
      min: 14,
      max: 40,
      zones,
      badgeText: m.bmiCat.label,
      badgeColor: m.bmiCat.color,
      unit: '',
      subText: diffText
    });
  }

  function renderBodyFatChart(m, gender) {
    const min = gender === 'male' ? 3 : 10;
    const max = gender === 'male' ? 40 : 48;
    const methodLabel = m.bfMethod === 'navy'
      ? 'محاسبه‌شده با سایز دور کمر و گردن (فرمول US Navy)'
      : 'برآورد بر اساس BMI، سن و جنسیت · برای دقت بالاتر سایز کمر و گردن را ثبت کنید';

    return renderSemiGauge({
      value: m.bodyFat,
      min,
      max,
      zones: m.bfCat.zones,
      badgeText: m.bfCat.label,
      badgeColor: m.bfCat.color,
      unit: '٪',
      subText: methodLabel
    });
  }

  function renderBodyCompositionBar(m, weight) {
    const leanPct = clamp(Math.round((100 - m.bodyFat) * 10) / 10, 40, 97);
    const fatPct = Math.round((100 - leanPct) * 10) / 10;

    return `
      <div class="comp-box">
        <div class="comp-bar" role="img" aria-label="تفکیک وزن بدن">
          <div class="comp-seg lean" style="width:${leanPct}%"><span>${fa(leanPct, 1)}٪ توده بدون چربی</span></div>
          <div class="comp-seg fat" style="width:${fatPct}%"><span>${fa(fatPct, 1)}٪</span></div>
        </div>
        <div class="comp-grid">
          <div class="comp-stat">
            <span class="dot lean-dot"></span>
            <div>
              <small>عضله، آب و استخوان (LBM)</small>
              <b>${fa(m.leanMassKg, 1)} کیلوگرم</b>
            </div>
          </div>
          <div class="comp-stat">
            <span class="dot fat-dot"></span>
            <div>
              <small>توده چربی بدن</small>
              <b>${fa(m.fatMassKg, 1)} کیلوگرم</b>
            </div>
          </div>
          <div class="comp-stat">
            <span class="dot ffmi-dot"></span>
            <div>
              <small>شاخص عضلانی (FFMI)</small>
              <b>${fa(m.ffmi, 1)} <em class="muted-inline">از ۲۵</em></b>
            </div>
          </div>
          <div class="comp-stat">
            <span class="dot ideal-dot"></span>
            <div>
              <small>وزن فعلی / ایده‌آل قد</small>
              <b>${fa(weight, 1)} / ${fa(m.idealWeight, 1)} کیلو</b>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderNutritionCharts(m) {
    const pKcal = m.protein * 4;
    const cKcal = m.carbs * 4;
    const fKcal = m.fat * 9;
    const sumKcal = Math.max(1, pKcal + cKcal + fKcal);

    const pPct = Math.round((pKcal / sumKcal) * 100);
    const cPct = Math.round((cKcal / sumKcal) * 100);
    const fPct = Math.max(0, 100 - pPct - cPct);

    const r = 54;
    const circ = 2 * Math.PI * r;
    const pLen = (pKcal / sumKcal) * circ;
    const cLen = (cKcal / sumKcal) * circ;
    const fLen = (fKcal / sumKcal) * circ;

    const maxBar = Math.max(m.bmr, m.tdee, m.target, m.hasIntake ? m.currentIntake : 0, 1) * 1.08;
    const bars = [
      { label: 'متابولیسم پایه (BMR)', val: m.bmr, color: '#71717a' },
      { label: 'کالری نگهداری وزن (TDEE)', val: m.tdee, color: '#818cf8' },
      ...(m.hasIntake ? [{ label: 'مصرف قبلی شما', val: m.currentIntake, color: '#f5a623' }] : []),
      { label: `هدف برنامه (${m.goalObj.short})`, val: m.target, color: '#ff5733' }
    ];

    return `
      <div class="nutri-charts-grid">
        <div class="donut-panel">
          <svg viewBox="0 0 140 140" class="donut-svg">
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="14"/>
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="#ff5733" stroke-width="14"
              stroke-dasharray="${pLen.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="0" transform="rotate(-90 70 70)"/>
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="#818cf8" stroke-width="14"
              stroke-dasharray="${cLen.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(-pLen).toFixed(1)}" transform="rotate(-90 70 70)"/>
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="#f5a623" stroke-width="14"
              stroke-dasharray="${fLen.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(-(pLen + cLen)).toFixed(1)}" transform="rotate(-90 70 70)"/>
            <text x="70" y="66" text-anchor="middle" class="donut-big">${fa(m.target)}</text>
            <text x="70" y="84" text-anchor="middle" class="donut-sub">کالری روزانه</text>
          </svg>
          <div class="donut-legend">
            <div><i style="background:#ff5733"></i>پروتئین: <b>${fa(m.protein)} گرم</b> (${fa(pPct)}٪)</div>
            <div><i style="background:#818cf8"></i>کربوهیدرات: <b>${fa(m.carbs)} گرم</b> (${fa(cPct)}٪)</div>
            <div><i style="background:#f5a623"></i>چربی: <b>${fa(m.fat)} گرم</b> (${fa(fPct)}٪)</div>
          </div>
        </div>

        <div class="cal-bars-panel">
          <h4>تراز انرژی روزانه</h4>
          ${bars.map(b => `
            <div class="cal-bar-row">
              <div class="cal-bar-head"><span>${b.label}</span><b>${fa(b.val)} kcal</b></div>
              <div class="cal-bar-track"><i style="width:${clamp((b.val / maxBar) * 100, 8, 100).toFixed(1)}%;background:${b.color}"></i></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderWeightTrendChart(history = [], idealWeight = 70) {
    if (!history || history.length < 2) {
      const current = history?.[0];
      return `
        <div class="trend-empty">
          <p style="margin-bottom:4px;color:var(--text);font-weight:700">وزن پایه: ${current ? fa(current.weight, 1) + ' کیلوگرم (' + current.date + ')' : 'ثبت شده'}</p>
          <small>با ثبت وزن‌های بعدی در طول هفته، منحنی تغییرات وزن شما در این بخش رسم می‌شود.</small>
        </div>
      `;
    }

    const recent = history.slice(-10);
    const weights = recent.map(h => h.weight);
    const minW = Math.min(...weights, idealWeight) - 2;
    const maxW = Math.max(...weights, idealWeight) + 2;
    const span = Math.max(1, maxW - minW);

    const W = 520, H = 175, padX = 38, padY = 24;
    const plotW = W - padX * 2;
    const plotH = H - padY * 2;

    const pts = recent.map((item, idx) => {
      const x = padX + (idx / (recent.length - 1)) * plotW;
      const y = padY + plotH - ((item.weight - minW) / span) * plotH;
      return { x, y, ...item };
    });

    const idealY = padY + plotH - ((idealWeight - minW) / span) * plotH;
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padY + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padY + plotH).toFixed(1)} Z`;

    return `
      <div class="trend-svg-wrap">
        <svg viewBox="0 0 ${W} ${H}" class="trend-svg">
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ff5733" stop-opacity="0.28"/>
              <stop offset="100%" stop-color="#ff5733" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <line x1="${padX}" y1="${idealY.toFixed(1)}" x2="${W - padX}" y2="${idealY.toFixed(1)}" stroke="#2dd4bf" stroke-dasharray="4 4" stroke-width="1.3" opacity="0.7"/>
          <text x="${padX + 4}" y="${(idealY - 5).toFixed(1)}" class="trend-ideal-lbl">محدوده ایده‌آل (${fa(idealWeight, 1)})</text>
          <path d="${areaPath}" fill="url(#trendGrad)"/>
          <path d="${linePath}" fill="none" stroke="#ff5733" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          ${pts.map(p => `
            <g>
              <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="var(--surface)" stroke="#ff5733" stroke-width="2.8"/>
              <text x="${p.x.toFixed(1)}" y="${(p.y - 10).toFixed(1)}" text-anchor="middle" class="trend-pt-val">${fa(p.weight, 1)}</text>
              <text x="${p.x.toFixed(1)}" y="${H - 5}" text-anchor="middle" class="trend-pt-date">${p.date}</text>
            </g>
          `).join('')}
        </svg>
      </div>
    `;
  }

  return {
    renderBmiChart,
    renderBodyFatChart,
    renderBodyCompositionBar,
    renderNutritionCharts,
    renderWeightTrendChart
  };
})();
