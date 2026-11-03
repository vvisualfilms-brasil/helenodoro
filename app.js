// Controlador da interface do Helenodoro.
import * as T from './timer.js';
import * as D from './day.js';
import { dateKey, addDays, buildWeek, formatDuration, parseKey } from './stats.js';
import { load, save } from './storage.js';
import * as sound from './sound.js';
import * as focus from './focus.js';

const $app = document.getElementById('app');
const { Phase } = T;

let store = load();
let view = 'timer'; // timer | hoje | semana | ajustes
let reportDate = null; // dia aberto a partir da semana
let weekOffset = 0;
let editingPlan = false;
let alarm = null;
let controlsTimer = null;
let formErrors = [];

const todayKey = () => dateKey(new Date());
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const persist = () => save(store);

function currentDay() {
  const a = store.active;
  if (a.timer.phase !== Phase.IDLE && a.date && store.days[a.date]) return store.days[a.date];
  return store.days[todayKey()] ?? null;
}

// ---------- Alarme ----------

function armAlarm() {
  alarm?.cancel();
  alarm = null;
  const t = store.active.timer;
  if (!t.running) return;
  const day = store.days[store.active.date];
  let kind = t.phase === Phase.BREAK ? 'break' : 'focus';
  if (t.phase === Phase.FOCUS && day && D.isLastBlock(day)) kind = 'final';
  const secs = T.remainingMs(t, Date.now()) / 1000;
  alarm = sound.scheduleAlarm(secs, { kind, volume: store.settings.volume });
}

// ---------- Ações ----------

function savePlan(form) {
  const data = new FormData(form);
  const { ok, errors, plan } = D.validatePlan({
    blocks: data.get('blocks'),
    focusMin: data.get('focusMin'),
    breakMin: data.get('breakMin'),
  });
  formErrors = errors;
  if (!ok) return render();
  const key = todayKey();
  const existing = store.days[key];
  store.days[key] = existing ? D.withPlan(existing, plan, Date.now()) : D.createDay(key, plan);
  store.settings.defaultPlan = plan;
  editingPlan = false;
  persist();
  render();
}

function startFocus() {
  sound.unlock();
  const day = currentDay();
  if (!day || D.isDayFinished(day, todayKey())) return;
  store.active = {
    ...store.active,
    date: day.date,
    timer: T.start(Phase.FOCUS, day.plan.focusMin * 60_000, Date.now()),
  };
  armAlarm();
  persist();
  render();
  focus.enterFocusMode({ fullscreen: store.settings.fullscreen });
}

function togglePause() {
  const now = Date.now();
  const t = store.active.timer;
  if (t.running) {
    store.active.timer = T.pause(t, now);
  } else {
    sound.unlock();
    store.active.timer = T.resume(t, now);
  }
  armAlarm();
  persist();
  render();
  if (t.phase === Phase.FOCUS) showControls();
}

function resetPhase() {
  const t = store.active.timer;
  if (t.phase === Phase.FOCUS && !confirm('Zerar este bloco? O tempo dele não será contado.')) return;
  alarm?.cancel();
  store.active.timer = T.idle();
  focus.exitFocusMode();
  persist();
  render();
}

// Fim de um bloco ou intervalo. silent = recuperando o que aconteceu com o app fechado.
function completePhase(silent = false) {
  const t = store.active.timer;
  const day = store.days[store.active.date];
  const endedAt = t.endAt ?? Date.now();
  if (!silent) {
    navigator.vibrate?.([300, 120, 300, 120, 300]);
    // Garantia do bip: se o som agendado não tocou (celular suspendeu o áudio, página
    // recarregada etc.), toca agora.
    if (!(alarm?.played?.() ?? false)) {
      let kind = t.phase === Phase.BREAK ? 'break' : 'focus';
      if (t.phase === Phase.FOCUS && day && D.isLastBlock(day)) kind = 'final';
      alarm?.cancel();
      sound.beepNow(kind, store.settings.volume);
    }
  }
  alarm = null;

  if (t.phase === Phase.FOCUS && day) {
    const updated = D.recordFocus(day, {
      tag: store.active.tag,
      seconds: t.durationMs / 1000,
      completed: true,
      endedAt,
    });
    store.days[day.date] = updated;
    focus.exitFocusMode();
    if (D.isPlanComplete(updated)) {
      // Último bloco: aqui (e só aqui) o relatório do dia é liberado.
      store.active.timer = T.idle();
      view = 'hoje';
      reportDate = null;
    } else if (updated.plan.breakMin > 0) {
      store.active.timer = T.start(Phase.BREAK, updated.plan.breakMin * 60_000, endedAt);
      if (!silent) armAlarm();
    } else {
      store.active.timer = T.idle();
    }
  } else {
    store.active.timer = T.idle();
  }
  persist();
  render();
}

function closeDay() {
  const day = currentDay();
  if (!day) return;
  if (!confirm('Encerrar o dia agora? Os blocos que faltam ficam como não feitos.')) return;
  alarm?.cancel();
  store.active.timer = T.idle();
  store.days[day.date] = D.closeDayEarly(day, Date.now());
  focus.exitFocusMode();
  persist();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `helenodoro-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function showControls() {
  document.body.classList.add('show-controls');
  clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => {
    if (store.active.timer.running) document.body.classList.remove('show-controls');
  }, 3500);
}

// ---------- Telas ----------

function tagPicker(title) {
  return `
    <fieldset class="tags">
      <legend>${title}</legend>
      ${Object.entries(D.TAGS).map(([key, t]) => `
        <button type="button" class="tag ${store.active.tag === key ? 'is-on' : ''}" data-tag="${key}" data-kind="${key}" aria-pressed="${store.active.tag === key}">
          <span class="tag-emoji">${t.emoji}</span>
          <span><strong>${t.label}</strong><small>${t.hint}</small></span>
        </button>`).join('')}
    </fieldset>`;
}

function chipRow(name, values, current, unit) {
  return values.map((v) => `
    <button type="button" class="chip ${Number(current) === v ? 'is-on' : ''}" data-set="${name}" data-val="${v}">${v}${unit}</button>`).join('');
}

function planForm(day) {
  const p = day?.plan ?? store.settings.defaultPlan;
  const done = day ? D.completedBlocks(day) : 0;
  return `
    <section class="card">
      <h1>${day ? 'Editar plano de hoje' : 'Plano de hoje'}</h1>
      <p class="muted">Quantos blocos você vai estudar hoje? O relatório do dia só abre quando o último terminar.</p>
      <form id="plan-form" novalidate>
        <label class="field">
          <span>Blocos de foco</span>
          <input name="blocks" type="number" inputmode="numeric" min="${Math.max(1, done)}" max="24" value="${p.blocks}">
        </label>
        <div class="chips">${chipRow('blocks', [2, 3, 4, 6, 8], p.blocks, '')}</div>

        <label class="field">
          <span>Duração de cada bloco (min)</span>
          <input name="focusMin" type="number" inputmode="numeric" min="1" max="240" value="${p.focusMin}">
        </label>
        <div class="chips">${chipRow('focusMin', [25, 30, 40, 50, 60], p.focusMin, ' min')}</div>

        <label class="field">
          <span>Intervalo depois de cada bloco (min)</span>
          <input name="breakMin" type="number" inputmode="numeric" min="0" max="120" value="${p.breakMin}">
        </label>
        <div class="chips">${chipRow('breakMin', [5, 10, 15, 20], p.breakMin, ' min')}</div>

        ${formErrors.length ? `<p class="error">${formErrors.map(esc).join('<br>')}</p>` : ''}
        <div class="row">
          ${day ? '<button type="button" class="btn ghost" data-action="cancel-plan">Cancelar</button>' : ''}
          <button class="btn primary" type="submit">${day ? 'Salvar plano' : 'Começar o dia'}</button>
        </div>
      </form>
    </section>`;
}

function readyStage(day) {
  const n = D.completedBlocks(day) + 1;
  const last = n === day.plan.blocks;
  return `
    <section class="stage">
      <p class="eyebrow">Bloco ${n} de ${day.plan.blocks}${last ? ' · último do dia' : ''}</p>
      <div class="clock">${T.formatClock(day.plan.focusMin * 60_000)}</div>
      ${tagPicker('O que você vai estudar neste bloco?')}
      <button class="btn primary big" data-action="start">▶ Iniciar bloco</button>
      <div class="row center">
        <button class="link" data-action="edit-plan">Editar plano de hoje</button>
      </div>
      ${focus.dnd.mode() === 'guided' ? `<p class="tip">🔕 Antes de começar, ligue o <strong>Não Perturbe / Foco</strong> do celular. <button class="link" data-action="go" data-view="ajustes">Como?</button></p>` : ''}
    </section>`;
}

function focusStage(t) {
  const tag = D.TAGS[store.active.tag];
  return `
    <section class="stage immersive-stage" data-action="reveal">
      <div class="clock giant" id="clock" aria-live="off">${T.formatClock(T.remainingMs(t, Date.now()))}</div>
      <div class="controls">
        <p class="muted small">${tag.emoji} ${tag.label}${t.running ? '' : ' · pausado'}</p>
        <div class="row center">
          <button class="btn" data-action="pause">${t.running ? '❚❚ Pausar' : '▶ Continuar'}</button>
          <button class="btn ghost" data-action="reset">↺ Zerar</button>
        </div>
      </div>
    </section>`;
}

function breakStage(day, t) {
  // De propósito sem resumo do dia aqui: o relatório só aparece no fim.
  return `
    <section class="stage break">
      <p class="eyebrow">☕ Intervalo</p>
      <div class="clock" id="clock">${T.formatClock(T.remainingMs(t, Date.now()))}</div>
      <p class="muted">Levante, beba água, olhe para longe. Próximo: bloco ${D.completedBlocks(day) + 1} de ${day.plan.blocks}.</p>
      ${tagPicker('Próximo bloco')}
      <div class="row center">
        <button class="btn" data-action="pause">${t.running ? '❚❚ Pausar' : '▶ Continuar'}</button>
        <button class="btn ghost" data-action="reset">Pular intervalo</button>
      </div>
    </section>`;
}

function doneStage() {
  return `
    <section class="stage">
      <img class="hero-tomato" src="tomato.svg" alt="">
      <h1>Dia encerrado</h1>
      <p class="muted">Seu relatório de hoje está pronto.</p>
      <button class="btn primary big" data-action="go" data-view="hoje">Ver relatório do dia</button>
    </section>`;
}

function timerView() {
  const day = currentDay();
  const t = store.active.timer;
  if (!day || editingPlan) return planForm(day);
  if (t.phase === Phase.FOCUS) return focusStage(t);
  if (t.phase === Phase.BREAK) return breakStage(day, t);
  if (D.isDayFinished(day, todayKey())) return doneStage();
  return readyStage(day);
}

function splitBar(video, questoes, pct) {
  if (!video && !questoes) return '<div class="split empty"></div>';
  return `
    <div class="split" role="img" aria-label="Videoaula ${pct.video}%, Questões ${pct.questoes}%">
      <span class="seg video" style="flex:${video}"></span><span class="seg questoes" style="flex:${questoes}"></span>
    </div>
    <div class="legend">
      <span><i class="dot video"></i>🖥️ Videoaula · ${formatDuration(video)} · ${pct.video}%</span>
      <span><i class="dot questoes"></i>📝 Questões · ${formatDuration(questoes)} · ${pct.questoes}%</span>
    </div>`;
}

function longDate(key) {
  return parseKey(key).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function reportView() {
  const tk = todayKey();
  const key = reportDate ?? currentDay()?.date ?? tk;
  const day = store.days[key];
  const back = reportDate ? '<button class="link" data-action="back-week">← Semana</button>' : '';

  if (!day) {
    return `<section class="card">${back}<h1>Relatório do dia</h1>
      <p class="muted">Nenhum plano ${key === tk ? 'para hoje ainda' : 'neste dia'}.</p>
      ${key === tk ? '<button class="btn primary" data-action="go" data-view="timer">Planejar o dia</button>' : ''}</section>`;
  }

  if (!D.canShowDailyReport(day, store.active.timer.phase, tk)) {
    return `
      <section class="card locked">
        <div class="lock">🔒</div>
        <h1>Relatório trancado</h1>
        <p class="muted">O resumo do dia abre quando o último bloco planejado terminar. Até lá, foco no próximo bloco.</p>
        <div class="row center">
          <button class="btn primary" data-action="go" data-view="timer">Voltar ao timer</button>
        </div>
        <button class="link danger" data-action="close-day">Encerrar o dia agora</button>
      </section>`;
  }

  const r = D.buildDailyReport(day);
  return `
    <section class="card">
      ${back}
      <p class="eyebrow">${esc(longDate(key))}</p>
      <h1>${r.endedEarly ? 'Dia encerrado' : 'Dia concluído 🍅'}</h1>
      <div class="stats">
        <div class="stat"><span class="num">${formatDuration(r.netSeconds)}</span><span class="lbl">horas líquidas</span></div>
        <div class="stat"><span class="num">${r.doneBlocks}/${r.plannedBlocks}</span><span class="lbl">blocos</span></div>
        <div class="stat"><span class="num">${r.adherence}%</span><span class="lbl">do planejado</span></div>
      </div>
      <h2>Videoaula × Questões</h2>
      ${splitBar(r.byTag.video, r.byTag.questoes, r.percent)}
      <h2>Planejado × feito</h2>
      <ul class="checklist">
        ${r.checklist.map((c) => `
          <li class="${c.done ? 'ok' : 'miss'}">
            <span class="check">${c.done ? '✓' : '✕'}</span>
            <span>Bloco ${c.index} · ${day.plan.focusMin} min</span>
            <span class="muted">${c.done ? `${D.TAGS[c.tag].emoji} ${D.TAGS[c.tag].label}` : 'não feito'}</span>
          </li>`).join('')}
      </ul>
      ${r.partialSeconds ? `<p class="muted small">Inclui ${formatDuration(r.partialSeconds)} de bloco interrompido.</p>` : ''}
    </section>`;
}

function weekChart(w) {
  const W = 700, H = 230, top = 28, bottom = 36, left = 8;
  const maxH = Math.max(3600, ...w.days.map((d) => d.total));
  const scale = Math.ceil(maxH / 3600) * 3600;
  const colW = (W - left * 2) / 7;
  const barW = Math.min(56, colW * 0.6);
  const plotH = H - top - bottom;
  const y = (s) => (s / scale) * plotH;

  const bars = w.days.map((d, i) => {
    const x = left + i * colW + (colW - barW) / 2;
    const base = H - bottom;
    const hv = y(d.video), hq = y(d.questoes);
    const label = d.locked ? '🔒' : d.total ? formatDuration(d.total) : '';
    const click = d.hasReport ? ` data-action="open-day" data-key="${d.key}" class="bar-hit"` : '';
    return `
      <g${click}>
        <rect x="${x}" y="${top}" width="${barW}" height="${plotH}" rx="8" class="bar-bg"/>
        ${hv ? `<rect x="${x}" y="${base - hv}" width="${barW}" height="${hv}" class="bar video"/>` : ''}
        ${hq ? `<rect x="${x}" y="${base - hv - hq}" width="${barW}" height="${hq}" class="bar questoes"/>` : ''}
        <text x="${x + barW / 2}" y="${base - hv - hq - 8}" class="bar-val" text-anchor="middle">${label}</text>
        <text x="${x + barW / 2}" y="${H - 12}" class="bar-day ${d.key === todayKey() ? 'today' : ''}" text-anchor="middle">${d.label}</text>
      </g>`;
  }).join('');
  return `<svg class="week-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Horas por dia da semana">${bars}</svg>`;
}

function weekView() {
  const tk = todayKey();
  const ref = addDays(tk, weekOffset * 7);
  const w = buildWeek(store.days, ref, tk);
  const fmt = (k) => parseKey(k).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  return `
    <section class="card">
      <div class="row between">
        <button class="btn ghost small" data-action="week" data-dir="-1" aria-label="Semana anterior">←</button>
        <div class="center-text"><p class="eyebrow">Semana</p><strong>${fmt(w.keys[0])} – ${fmt(w.keys[6])}</strong></div>
        <button class="btn ghost small" data-action="week" data-dir="1" ${weekOffset >= 0 ? 'disabled' : ''} aria-label="Próxima semana">→</button>
      </div>
      <div class="stats">
        <div class="stat"><span class="num">${formatDuration(w.totals.total)}</span><span class="lbl">horas líquidas</span></div>
        <div class="stat"><span class="num">${w.studiedDays}</span><span class="lbl">dias estudados</span></div>
        <div class="stat"><span class="num">${formatDuration(w.avgPerStudiedDay)}</span><span class="lbl">média por dia</span></div>
      </div>
      ${weekChart(w)}
      <h2>Videoaula × Questões</h2>
      ${splitBar(w.totals.video, w.totals.questoes, w.percent)}
      ${w.bestDay ? `<p class="muted small">Melhor dia: ${esc(longDate(w.bestDay.key))} (${formatDuration(w.bestDay.total)}). Toque numa barra para ver o relatório do dia.</p>` : ''}
      ${w.todayLocked ? '<p class="muted small">🔒 Hoje entra na conta quando o dia for encerrado.</p>' : ''}
    </section>`;
}

function settingsView() {
  const s = store.settings;
  const p = s.defaultPlan;
  const native = focus.dnd.mode() === 'native';
  return `
    <section class="card">
      <h1>Ajustes</h1>
      <h2>Plano padrão</h2>
      <p class="muted">${p.blocks} blocos de ${p.focusMin} min com ${p.breakMin} min de intervalo. Muda ao salvar um plano do dia.</p>

      <h2>Som</h2>
      <label class="field">
        <span>Volume do bip</span>
        <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-setting="volume">
      </label>
      <div class="row">
        <button class="btn ghost small" data-action="test-beep" data-kind="focus">Fim do bloco</button>
        <button class="btn ghost small" data-action="test-beep" data-kind="break">Fim do intervalo</button>
        <button class="btn ghost small" data-action="test-beep" data-kind="final">Último bloco</button>
      </div>

      <h2>Modo foco</h2>
      <label class="toggle">
        <input type="checkbox" data-setting="fullscreen" ${s.fullscreen ? 'checked' : ''}>
        <span>Tela cheia ao iniciar o bloco</span>
      </label>
      <p class="muted small">Durante o bloco a tela fica acesa e só o cronômetro aparece. Vire o celular de lado para o modo mínimo.</p>

      <h2>🔕 Silenciar notificações</h2>
      ${native
        ? '<p>O Não Perturbe liga sozinho no início de cada bloco e desliga no intervalo.</p>'
        : `<p class="muted">Navegadores não deixam um site desligar as notificações do celular. O Helenodoro não envia nenhuma; para silenciar as dos outros apps, ligue o modo do sistema antes do bloco:</p>
      <details><summary>iPhone</summary>
        <ol><li>Ajustes → Foco → <strong>+</strong> → crie o foco “Estudo” e deixe só chamadas de favoritos.</li>
        <li>Antes do bloco, abra a Central de Controle e ligue “Estudo”.</li>
        <li>Dica: adicione o Helenodoro à Tela de Início (Compartilhar → Adicionar à Tela de Início) para abrir sem barras.</li></ol>
      </details>
      <details><summary>Android</summary>
        <ol><li>Puxe a barra rápida e ligue <strong>Não perturbe</strong>.</li>
        <li>Ou use Configurações → Bem-estar digital → <strong>Modo foco</strong> para pausar apps que distraem.</li>
        <li>Instale o app pelo menu do Chrome → “Instalar app”.</li></ol>
      </details>
      <details><summary>Computador</summary>
        <ol><li>Mac: Central de Controle → Foco. Windows: Configurações → Sistema → Foco.</li></ol>
      </details>`}

      <h2>Dados</h2>
      <p class="muted small">Tudo fica salvo só neste aparelho.</p>
      <button class="btn ghost small" data-action="export">Exportar dados (JSON)</button>
    </section>`;
}

const TABS = [
  ['timer', '🍅', 'Timer'],
  ['hoje', '📋', 'Hoje'],
  ['semana', '📊', 'Semana'],
  ['ajustes', '⚙️', 'Ajustes'],
];

function render() {
  const phase = store.active.timer.phase;
  const inFocus = phase === Phase.FOCUS;
  const timing = phase !== Phase.IDLE;
  if (timing) view = 'timer';

  document.body.classList.toggle('immersive', inFocus);
  document.body.classList.toggle('timing', timing);
  document.body.classList.toggle('paused', timing && !store.active.timer.running);
  if (!inFocus) document.body.classList.remove('show-controls');

  const body =
    view === 'hoje' ? reportView()
    : view === 'semana' ? weekView()
    : view === 'ajustes' ? settingsView()
    : timerView();

  $app.innerHTML = `
    <header class="chrome topbar">
      <img src="tomato.svg" alt="" width="26" height="26"><span>Helenodoro</span>
    </header>
    <main class="view view-${view}">${body}</main>
    <nav class="chrome tabbar" aria-label="Seções">
      ${TABS.map(([k, icon, label]) => `
        <button data-action="go" data-view="${k}" class="${view === k ? 'is-on' : ''}" ${timing && k !== 'timer' ? 'disabled' : ''}>
          <span>${icon}</span><small>${label}</small>
        </button>`).join('')}
    </nav>`;
  paintClock();
}

function paintClock() {
  const t = store.active.timer;
  const el = document.getElementById('clock');
  if (t.phase === Phase.IDLE) {
    document.title = 'Helenodoro';
    return;
  }
  const text = T.formatClock(T.remainingMs(t, Date.now()));
  if (el && el.textContent !== text) el.textContent = text;
  document.title = `${text} · ${t.phase === Phase.FOCUS ? 'Foco' : 'Intervalo'}`;
}

// ---------- Eventos ----------

$app.addEventListener('click', (e) => {
  const tagBtn = e.target.closest('[data-tag]');
  if (tagBtn) {
    store.active.tag = tagBtn.dataset.tag;
    persist();
    return render();
  }
  const chip = e.target.closest('[data-set]');
  if (chip) {
    const input = chip.form?.elements[chip.dataset.set] ?? document.querySelector(`[name="${chip.dataset.set}"]`);
    input.value = chip.dataset.val;
    chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === chip));
    return;
  }
  // Celular deitado: só o cronômetro aparece, então tocar na tela pausa/continua.
  if (document.body.classList.contains('timing') && focus.isLandscape() && e.target.closest('.stage')) {
    return togglePause();
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'reveal') return showControls();
  if (a === 'go') { view = el.dataset.view; reportDate = null; editingPlan = false; return render(); }
  if (a === 'start') return startFocus();
  if (a === 'pause') return togglePause();
  if (a === 'reset') return resetPhase();
  if (a === 'edit-plan') { editingPlan = true; formErrors = []; return render(); }
  if (a === 'cancel-plan') { editingPlan = false; formErrors = []; return render(); }
  if (a === 'close-day') return closeDay();
  if (a === 'week') { weekOffset = Math.min(0, weekOffset + Number(el.dataset.dir)); return render(); }
  if (a === 'open-day') { reportDate = el.dataset.key; view = 'hoje'; return render(); }
  if (a === 'back-week') { reportDate = null; view = 'semana'; return render(); }
  if (a === 'test-beep') return sound.beepNow(el.dataset.kind, store.settings.volume);
  if (a === 'export') return exportData();
});

$app.addEventListener('submit', (e) => {
  if (e.target.id === 'plan-form') {
    e.preventDefault();
    savePlan(e.target);
  }
});

$app.addEventListener('input', (e) => {
  const key = e.target.dataset.setting;
  if (!key) return;
  store.settings[key] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
  persist();
});

// Navegadores só liberam áudio depois de um toque.
window.addEventListener('pointerdown', () => sound.unlock());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { sound.unlock(); tick(); }
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space' && store.active.timer.phase !== Phase.IDLE) {
    e.preventDefault();
    togglePause();
  }
});

focus.onOrientationChange(() => render());

// ---------- Início ----------

function tick() {
  const t = store.active.timer;
  if (t.phase === Phase.IDLE) return;
  if (T.isFinished(t, Date.now())) completePhase(false);
  else paintClock();
}

// Recupera o que terminou enquanto o app estava fechado (sem bipar atrasado).
let guard = 0;
while (store.active.timer.phase !== Phase.IDLE && T.isFinished(store.active.timer, Date.now()) && guard++ < 50) {
  completePhase(true);
}
armAlarm();
render();
setInterval(tick, 250);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
