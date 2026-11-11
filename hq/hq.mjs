#!/usr/bin/env node
// مقر عقاراتي: سجل الفريق، المستويات، ولوحة المكتب.
// الاستخدام:
//   node hq/hq.mjs list
//   node hq/hq.mjs assign <id> "<مهمة>"        يضيف مهمة لطابور الموظف
//   node hq/hq.mjs start  <id> "<مهمة>"        الموظف يبدي يشتغل
//   node hq/hq.mjs review <id>                 الموظف ينتظر مراجعة
//   node hq/hq.mjs done   <id> <xp> "<ملخص>"   ينهي المهمة ويضيف XP
//   node hq/hq.mjs bonus  <id> <xp> "<سبب>"    مكافأة (اجتماع الأحد)
//   node hq/hq.mjs note   "<نص>"               خبر عام بسجل النشاط
//   node hq/hq.mjs board                       يعيد بناء hq/board.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROSTER = path.join(DIR, 'roster.json');
const ACTIVITY = path.join(DIR, 'activity.json');
const BOARD = path.join(DIR, 'board.html');

export const LEVELS = [
  { n: 1, title: 'متدرّب', min: 0 },
  { n: 2, title: 'موظف', min: 100 },
  { n: 3, title: 'موظف أول', min: 250 },
  { n: 4, title: 'خبير', min: 500 },
  { n: 5, title: 'قائد', min: 1000 },
];

export function levelOf(xp) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) cur = l;
  const next = LEVELS.find((l) => l.min > xp) || null;
  const pct = next ? Math.round(((xp - cur.min) / (next.min - cur.min)) * 100) : 100;
  return { ...cur, next, pct };
}

const readJSON = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const writeJSON = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');

function load() {
  return { roster: readJSON(ROSTER, null), activity: readJSON(ACTIVITY, []) };
}

function everyone(roster) {
  return [roster.ceo, ...roster.team];
}

function find(roster, id) {
  const m = everyone(roster).find((e) => e.id === id);
  if (!m) {
    console.error(`ماكو موظف بهذا المعرّف: ${id}\nالمعرّفات: ${everyone(roster).map((e) => e.id).join(', ')}`);
    process.exit(1);
  }
  return m;
}

function log(activity, entry) {
  activity.unshift({ at: new Date().toISOString(), ...entry });
  activity.length = Math.min(activity.length, 300);
}

function addXp(activity, m, xp, text) {
  const before = levelOf(m.xp).n;
  m.xp = Math.max(0, m.xp + xp);
  const after = levelOf(m.xp);
  if (after.n > before) {
    log(activity, { who: m.id, type: 'levelup', text: `ترقّى ${m.name} إلى المستوى ${after.n} (${after.title}) 🎉` });
    console.log(`🎉 ${m.name} ترقّى إلى المستوى ${after.n}: ${after.title}`);
  }
  return text;
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STATUS = {
  working: { label: 'يشتغل', cls: 'working' },
  review: { label: 'بالمراجعة', cls: 'review' },
  idle: { label: 'متاح', cls: 'idle' },
};

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'هسه';
  if (s < 3600) return `قبل ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} ساعة`;
  return `قبل ${Math.floor(s / 86400)} يوم`;
}

function desk(m, isCeo = false) {
  const lv = levelOf(m.xp);
  const st = STATUS[m.status] || STATUS.idle;
  const nextTxt = lv.next ? `${m.xp} / ${lv.next.min} XP` : `${m.xp} XP · أعلى مستوى`;
  return `<article class="desk ${isCeo ? 'ceo' : ''}">
  <header>
    <span class="avatar" aria-hidden="true">${m.emoji}</span>
    <div class="who"><h3>${esc(m.name)}</h3><p>${esc(m.title)}</p></div>
    <span class="status ${st.cls}"><i></i>${st.label}</span>
  </header>
  <div class="task">${m.task ? esc(m.task) : '<span class="muted">ماكو مهمة حالية</span>'}</div>
  <div class="level"><span class="lv">م${lv.n} · ${lv.title}</span><span class="muted" dir="ltr">${nextTxt}</span></div>
  <div class="bar"><span style="width:${lv.pct}%"></span></div>
  <footer>
    <span class="muted">${m.tasks_done} مهمة منجزة${m.queue.length ? ` · ${m.queue.length} بالطابور` : ''}</span>
    ${m.skills.length ? `<div class="chips">${m.skills.map((s) => `<code>/${esc(s)}</code>`).join('')}</div>` : ''}
  </footer>
</article>`;
}

export function renderBoard(roster, activity) {
  const all = everyone(roster);
  const working = all.filter((m) => m.status === 'working').length;
  const totalXp = all.reduce((a, m) => a + m.xp, 0);
  const weekAgo = Date.now() - 7 * 86400e3;
  const weekDone = activity.filter((a) => a.type === 'done' && new Date(a.at).getTime() > weekAgo).length;
  const top = [...roster.team].sort((a, b) => b.xp - a.xp).slice(0, 3).filter((m) => m.xp > 0);
  const depts = [...new Set(roster.team.map((m) => m.dept))];
  const feedIcon = { done: '✅', start: '▶️', levelup: '⭐', bonus: '🏅', note: '📌', assign: '📥', review: '👀' };

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>مقر عقاراتي</title>
<style>
:root{--bg:#f6f5f1;--panel:#fff;--ink:#1d1f24;--muted:#6b6f78;--line:#e4e1d8;--accent:#c2643a;--accent-soft:#f6e3d8;--ok:#2f8f5b;--warn:#c58b12;--idle:#9aa0a8;--bar:#ece9e1}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15161a;--panel:#1e2026;--ink:#eceef2;--muted:#9a9fa9;--line:#2c2f37;--accent:#e08458;--accent-soft:#3a2a22;--ok:#4cc184;--warn:#e2ad3c;--idle:#6f7580;--bar:#2a2d34}}
:root[data-theme="dark"]{--bg:#15161a;--panel:#1e2026;--ink:#eceef2;--muted:#9a9fa9;--line:#2c2f37;--accent:#e08458;--accent-soft:#3a2a22;--ok:#4cc184;--warn:#e2ad3c;--idle:#6f7580;--bar:#2a2d34}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,"Segoe UI",Tahoma,sans-serif}
.wrap{max-width:1200px;margin:0 auto;padding:24px 16px 48px}
h1{margin:0;font-size:26px}h2{font-size:17px;margin:28px 0 12px;color:var(--muted);font-weight:600}h3{margin:0;font-size:16px}
.top{display:flex;flex-wrap:wrap;gap:12px;align-items:end;justify-content:space-between}
.muted{color:var(--muted);font-size:13px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:20px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.stat b{display:block;font-size:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.desk{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}
.desk.ceo{border-color:var(--accent);background:linear-gradient(0deg,var(--panel),var(--accent-soft))}
.desk header{display:flex;gap:10px;align-items:center}
.avatar{font-size:26px;width:44px;height:44px;display:grid;place-items:center;background:var(--bg);border-radius:12px;flex:none}
.who{flex:1;min-width:0}.who p{margin:0;color:var(--muted);font-size:13px}
.status{font-size:12px;display:flex;align-items:center;gap:6px;white-space:nowrap}
.status i{width:9px;height:9px;border-radius:50%;background:var(--idle)}
.status.working i{background:var(--ok);box-shadow:0 0 0 4px color-mix(in srgb,var(--ok) 25%,transparent);animation:p 1.6s infinite}
.status.review i{background:var(--warn)}
@keyframes p{50%{box-shadow:0 0 0 7px transparent}}
.task{font-size:14px;min-height:22px;overflow-wrap:anywhere}
.level{display:flex;justify-content:space-between;gap:8px}.lv{font-weight:600;font-size:13px;color:var(--accent)}
.bar{height:6px;background:var(--bar);border-radius:6px;overflow:hidden}.bar span{display:block;height:100%;background:var(--accent)}
.desk footer{display:flex;flex-direction:column;gap:6px}
.chips{display:flex;flex-wrap:wrap;gap:4px}
code{font-size:11px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:1px 6px;direction:ltr}
.cols{display:grid;grid-template-columns:2fr 1fr;gap:16px}
@media (max-width:860px){.cols{grid-template-columns:1fr}}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px}
.feed{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.feed li{display:flex;gap:8px;font-size:14px}.feed li span:last-child{display:block}
.levels{display:flex;flex-direction:column;gap:6px;font-size:14px}.levels div{display:flex;justify-content:space-between}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div><h1>🏢 مقر ${esc(roster.company)}</h1><div class="muted">مدير تنفيذي و${roster.team.length} موظف · تتحدّث اللوحة كل دقيقة</div></div>
    <div class="muted">آخر تحديث: ${new Date().toLocaleString('ar-IQ', { timeZone: 'Asia/Baghdad' })}</div>
  </div>
  <div class="stats">
    <div class="stat"><b>${working}</b><span class="muted">يشتغلون هسه</span></div>
    <div class="stat"><b>${weekDone}</b><span class="muted">مهام هذا الأسبوع</span></div>
    <div class="stat"><b>${totalXp}</b><span class="muted">مجموع XP</span></div>
    <div class="stat"><b>${top[0] ? esc(top[0].name) : '—'}</b><span class="muted">الأعلى XP</span></div>
  </div>

  <h2>الإدارة</h2>
  <div class="grid">${desk(roster.ceo, true)}</div>
  ${depts.map((d) => `<h2>${esc(d)}</h2><div class="grid">${roster.team.filter((m) => m.dept === d).map((m) => desk(m)).join('')}</div>`).join('')}

  <div class="cols">
    <section><h2>آخر النشاط</h2><div class="panel">
      ${activity.length ? `<ul class="feed">${activity.slice(0, 25).map((a) => `<li><span>${feedIcon[a.type] || '•'}</span><span>${esc(a.text)}<span class="muted">${timeAgo(a.at)}</span></span></li>`).join('')}</ul>` : '<p class="muted">ماكو نشاط بعد. أول مهمة تبدي بـ <code>/hq-task</code>.</p>'}
    </div></section>
    <section><h2>المستويات</h2><div class="panel levels">
      ${LEVELS.map((l) => `<div><span>م${l.n} · ${l.title}</span><span class="muted">${l.min}+ XP</span></div>`).join('')}
      ${top.length ? `<hr style="border:0;border-top:1px solid var(--line);width:100%"><b>الأعلى XP</b>${top.map((m, i) => `<div><span>${['🥇', '🥈', '🥉'][i]} ${esc(m.name)}</span><span class="muted">${m.xp} XP</span></div>`).join('')}` : ''}
    </div></section>
  </div>
</div>
</body>
</html>
`;
}

function save(roster, activity) {
  writeJSON(ROSTER, roster);
  writeJSON(ACTIVITY, activity);
  fs.writeFileSync(BOARD, renderBoard(roster, activity));
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const { roster, activity } = load();
  if (!roster) {
    console.error('ماكو hq/roster.json');
    process.exit(1);
  }

  switch (cmd) {
    case 'list': {
      for (const m of everyone(roster)) {
        const lv = levelOf(m.xp);
        console.log(`${m.emoji} ${m.id.padEnd(17)} ${m.name.padEnd(8)} م${lv.n} ${String(m.xp).padStart(5)}XP  ${(STATUS[m.status] || STATUS.idle).label}${m.task ? ' · ' + m.task : ''}${m.queue.length ? ` · طابور: ${m.queue.length}` : ''}`);
      }
      return;
    }
    case 'assign': {
      const [id, task] = args;
      const m = find(roster, id);
      m.queue.push(task);
      log(activity, { who: id, type: 'assign', text: `${m.name} استلم مهمة بالطابور: ${task}` });
      break;
    }
    case 'start': {
      const [id, task] = args;
      const m = find(roster, id);
      m.status = 'working';
      m.task = task;
      m.queue = m.queue.filter((q) => q !== task);
      log(activity, { who: id, type: 'start', text: `${m.name} بدى: ${task}` });
      break;
    }
    case 'review': {
      const m = find(roster, args[0]);
      m.status = 'review';
      log(activity, { who: m.id, type: 'review', text: `${m.name} سلّم للمراجعة: ${m.task}` });
      break;
    }
    case 'done': {
      const [id, xpStr, summary] = args;
      const m = find(roster, id);
      const xp = Number(xpStr) || 0;
      m.status = 'idle';
      m.tasks_done += 1;
      const text = summary || m.task;
      m.task = '';
      log(activity, { who: id, type: 'done', xp, text: `${m.name} أنجز: ${text} (+${xp} XP)` });
      addXp(activity, m, xp, text);
      break;
    }
    case 'bonus': {
      const [id, xpStr, reason] = args;
      const m = find(roster, id);
      const xp = Number(xpStr) || 0;
      log(activity, { who: id, type: 'bonus', xp, text: `مكافأة لـ ${m.name}: ${reason} (+${xp} XP)` });
      addXp(activity, m, xp, reason);
      break;
    }
    case 'note': {
      log(activity, { who: 'ceo', type: 'note', text: args.join(' ') });
      break;
    }
    case 'board':
      break;
    default:
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).join('\n'));
      return;
  }
  save(roster, activity);
  console.log(`✓ تحدّثت اللوحة: ${path.relative(process.cwd(), BOARD)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
