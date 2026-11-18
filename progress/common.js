// 보고용 · 개인용 공통: 날짜, 데이터, KR 단계, 진척 그래프, 툴팁, 테마
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ?today=2026-11-20 으로 날짜를 바꿔 미리 볼 수 있다
function todayISO() {
  const q = new URLSearchParams(location.search).get('today');
  if (q) return q;
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const D = iso => new Date(iso + 'T00:00:00');
const ISO = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = D(iso); d.setDate(d.getDate() + n); return ISO(d); };
const dayDiff = (a, b) => Math.round((D(b) - D(a)) / 86400000);
const md = iso => { const d = D(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
const mdw = iso => `${md(iso)} (${DAYS[D(iso).getDay()]})`;
// 작업 기간: 2026.11.19 (목) ~ 11.24 (화), 해가 바뀌면 끝에도 연도
const ymdw = (iso, withYear) => { const d = D(iso); return `${withYear ? d.getFullYear() + '.' : ''}${d.getMonth() + 1}.${d.getDate()} (${DAYS[d.getDay()]})`; };
const period = w => w.start ? `${ymdw(w.start, true)} ~ ${ymdw(w.end, w.start.slice(0, 4) !== w.end.slice(0, 4))}` : (w.period || '');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 로컬 서버(server.py)면 /api/progress, 정적 배포(GitHub Pages)면 같은 폴더의 progress.json
async function loadData() {
  try { const r = await fetch('/api/progress?t=' + Date.now()); if (r.ok) return await r.json(); } catch (e) {}
  return (await fetch('progress.json?t=' + Date.now())).json();
}
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const ST_LABEL = { todo: '○ 대기', doing: '◐ 진행 중', done: '✓ 완료' };
const tag = t => `<span class="tag ${t}">${t}</span>`;
const taskMap = data => Object.fromEntries(data.tasks.map(t => [t.id, t]));
const ratio = ts => { const n = ts.length, d = ts.filter(t => t.status === 'done').length; return { n, d, pct: n ? Math.round(d / n * 100) : 0 }; };
const meter = pct => `<div class="meter"><i style="width:${pct}%"></i></div>`;
const currentWeek = (data, today) => data.weeks.find(w => w.report >= today) || data.weeks[data.weeks.length - 1];

// KR 진척: 앞에서부터 연속으로 끝난 단계의 최고 %
function krPct(kr, tm) {
  let p = 0;
  for (const m of kr.milestones) { if (tm[m.task]?.status === 'done') p = m.pct; else break; }
  return p;
}

// KR 단계 표시 (가로 레일 + 단계 점)
function krSteps(kr, tm) {
  const p = krPct(kr, tm);
  const nextPct = kr.milestones.find(m => m.pct > p)?.pct, n = kr.milestones.length;
  // 단계는 같은 간격으로 (25 · 50 · 75 · 90 · 100 처럼 촘촘한 끝 단계가 겹치지 않게)
  const pos = i => (i + 0.5) / n * 100;
  const lastOk = kr.milestones.reduce((a, m, i) => m.pct <= p ? i : a, -1);
  const nodes = kr.milestones.map((m, i) => {
    const ok = m.pct <= p, cls = ok ? 'ok' : m.pct === nextPct ? 'next' : '';
    return `<div class="node ${cls}" style="left:${pos(i)}%"><div class="dot">${ok ? '✓' : ''}</div>
      <div class="lab"><b>${m.pct}%</b>${esc(m.label)}</div></div>`;
  }).join('');
  return `<div class="kr"><div class="name"><b>${kr.id}</b><div>${esc(kr.title)}</div></div>
    <div class="steps"><div class="rail" style="left:${pos(0)}%;right:${100 - pos(n - 1)}%"></div><div class="fill" style="left:${pos(0)}%;width:${lastOk < 0 ? 0 : pos(lastOk) - pos(0)}%"></div>${nodes}</div>
    <div class="pct">${p}%</div></div>`;
}

// 누적 계단 값: series = [{d, v}] (날짜순 누적)
function cumAt(series, d) { let v = 0; for (const p of series) { if (p.d <= d) v = p.v; else break; } return v; }
function cumulative(dates) {
  const cnt = {}; dates.forEach(d => cnt[d] = (cnt[d] || 0) + 1);
  let s = 0; return Object.keys(cnt).sort().map(d => ({ d, v: (s += cnt[d]) }));
}

// 진척(번업) 그래프: 계획(회색) vs 실제(파랑), 오늘 선, 십자선 + 툴팁
function burnup(el, o) {
  const draw = () => {
    const W = el.clientWidth, H = 250, m = { l: 34, r: 78, t: 14, b: 26 };
    const w = W - m.l - m.r, h = H - m.t - m.b, span = dayDiff(o.start, o.end);
    const x = d => m.l + Math.max(0, Math.min(span, dayDiff(o.start, d))) / span * w;
    const y = v => m.t + h - v / o.total * h;
    const step = (series, until) => {
      let p = `M${x(o.start)},${y(0)}`;
      for (const s of series) { if (s.d > until) break; p += ` H${x(s.d)} V${y(s.v)}`; }
      return p + ` H${x(until)}`;
    };
    const lastActual = Math.min(dayDiff(o.start, o.today), span) >= 0 ? (o.today < o.end ? o.today : o.end) : o.start;
    const aNow = cumAt(o.actual, lastActual), pNow = cumAt(o.plan, lastActual);
    const grid = [0, .25, .5, .75, 1].map(f => Math.round(o.total * f)).map(v =>
      `<line x1="${m.l}" x2="${m.l + w}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>
       <text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
    const ticks = o.ticks.map(d => `<text x="${x(d)}" y="${H - 6}" text-anchor="middle">${md(d)}</text>`).join('');
    const showToday = o.today >= o.start && o.today <= o.end;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(o.label)}">
      ${grid}<line x1="${m.l}" x2="${m.l + w}" y1="${y(0)}" y2="${y(0)}" stroke="var(--axis)"/>
      ${ticks}
      <path d="${step(o.plan, o.end)}" fill="none" stroke="var(--plan)" stroke-width="2" stroke-dasharray="5 4"/>
      <path d="${step(o.actual, lastActual)}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
      <path d="${step(o.actual, lastActual)} V${y(0)} H${x(o.start)} Z" fill="var(--accent)" opacity=".08"/>
      ${showToday ? `<line x1="${x(o.today)}" x2="${x(o.today)}" y1="${m.t}" y2="${m.t + h}" stroke="var(--today)" stroke-width="1" stroke-dasharray="2 3"/>
        <text x="${x(o.today) + 5}" y="${m.t + h - 6}" text-anchor="start" style="fill:var(--today);font-weight:700">오늘</text>` : ''}
      <circle cx="${x(lastActual)}" cy="${y(aNow)}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>
      <text class="end" x="${x(lastActual) + 9}" y="${y(aNow) + 4}">실제 ${aNow}</text>
      <text class="end" x="${m.l + w + 6}" y="${y(cumAt(o.plan, o.end)) + 4}" style="fill:var(--ink2)">계획 ${cumAt(o.plan, o.end)}</text>
      <line class="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + h}" stroke="var(--axis)" stroke-width="1" style="display:none"/>
      <rect class="hit" x="${m.l}" y="${m.t}" width="${w}" height="${h}" fill="transparent"/>
    </svg>`;
    const svg = el.querySelector('svg'), xh = svg.querySelector('.xh'), hit = svg.querySelector('.hit');
    hit.addEventListener('mousemove', e => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width);
      const d = addDays(o.start, Math.round((px - m.l) / w * span));
      xh.setAttribute('x1', x(d)); xh.setAttribute('x2', x(d)); xh.style.display = '';
      const pv = cumAt(o.plan, d), av = d <= lastActual ? cumAt(o.actual, d) : null;
      showTip(`<b>${mdw(d)}</b>계획 ${pv} / ${o.total}` + (av === null ? '' :
        `<br>실제 ${av} <span class="${av - pv >= 0 ? 'up' : 'down'}">(${av - pv >= 0 ? '+' : ''}${av - pv})</span>`), e);
    });
    hit.addEventListener('mouseleave', () => { xh.style.display = 'none'; hideTip(); });
    return { aNow, pNow };
  };
  el._draw = draw;
  if (!el._bound) { el._bound = true; let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => el._draw(), 120); }); }
  return draw();
}

// 툴팁 (data-tip 속성을 가진 요소 공통)
let TIP;
function showTip(html, e) {
  if (!TIP) { TIP = document.createElement('div'); TIP.id = 'tip'; document.body.appendChild(TIP); }
  TIP.innerHTML = html; TIP.style.display = 'block';
  const x = Math.min(e.clientX + 14, innerWidth - TIP.offsetWidth - 8), y = Math.min(e.clientY + 14, innerHeight - TIP.offsetHeight - 8);
  TIP.style.left = x + 'px'; TIP.style.top = y + 'px';
}
function hideTip() { if (TIP) TIP.style.display = 'none'; }
document.addEventListener('mousemove', e => {
  if (e.target.closest('.chart')) return;
  const t = e.target.closest('[data-tip]');
  t ? showTip(t.dataset.tip, e) : hideTip();
});

// 밝게 / 어둡게
function initTheme(btn) {
  const saved = localStorage.getItem('okr-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  const dark = () => document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const label = () => btn.textContent = dark() ? '☀ 밝게' : '☾ 어둡게';
  label();
  btn.onclick = () => { const t = dark() ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('okr-theme', t); label(); };
}

// 주간 기록 글을 보기 좋게: ━━ 제목 ━━ · 【 소제목 】 · ①/1) 번호 · ·/-/▸ 목록 · → 화살표
// ▣ 상자 | 설명 / ↓ 연결 설명 (흐름도) · 앞 공백 2칸 = 한 단계 들여쓰기
function richText(src) {
  const out = [], GAP = '<i class="rt-gap"></i>';
  const inline = t => esc(t).replace(/^([^:·\-()]{1,14}):\s/, '<b>$1:</b> ');
  for (const raw of String(src ?? '').split('\n')) {
    const lv = Math.min(3, Math.floor(raw.match(/^\s*/)[0].length / 2)), t = raw.trim();
    let m;
    if (!t) { if (out.length && out[out.length - 1] !== GAP) out.push(GAP); continue; }
    if ((m = t.match(/^━+\s*(.+?)\s*━+$/))) out.push(`<h4 class="rt-h">${esc(m[1])}</h4>`);
    else if ((m = t.match(/^【\s*(.+?)\s*】$/))) out.push(`<h5 class="rt-sub">${esc(m[1])}</h5>`);
    else if ((m = t.match(/^▣\s*(.+)$/))) { const [a, b] = m[1].split('|'); out.push(`<div class="rt-box"><b>${esc(a.trim())}</b>${b ? `<span>${esc(b.trim())}</span>` : ''}</div>`); }
    else if ((m = t.match(/^↓\s*(.*)$/))) out.push(`<div class="rt-conn"><i>↓</i><span>${inline(m[1])}</span></div>`);
    else if ((m = t.match(/^([①-⑳]|\d{1,2}\))\s*(.*)$/))) out.push(`<div class="rt-li rt-num l${lv}"><span class="rt-m">${m[1]}</span><span>${inline(m[2])}</span></div>`);
    else if ((m = t.match(/^[·\-▸•]\s*(.*)$/))) out.push(`<div class="rt-li l${lv}"><span class="rt-m rt-dot"></span><span>${inline(m[1])}</span></div>`);
    else if ((m = t.match(/^→\s*(.*)$/))) out.push(`<div class="rt-li rt-arrow l${lv}"><span class="rt-m">→</span><span>${inline(m[1])}</span></div>`);
    else out.push(`<div class="rt-p l${lv}">${inline(t)}</div>`);
  }
  while (out[out.length - 1] === GAP) out.pop();
  return out.join('');
}
