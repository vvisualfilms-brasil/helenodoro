// Regras de negócio do dia de estudo (sem DOM).
//
// Um "dia" é: { date: 'AAAA-MM-DD', plan: { blocks, focusMin, breakMin }, sessions: [], closedAt }
// Cada sessão: { tag: 'video' | 'questoes', seconds, completed, endedAt }

export const TAGS = Object.freeze({
  video: { label: 'Videoaula', emoji: '🖥️', hint: 'estudo teórico' },
  questoes: { label: 'Questões', emoji: '📝', hint: 'estudo prático' },
});

export function isValidTag(tag) {
  return Object.prototype.hasOwnProperty.call(TAGS, tag);
}

export function validatePlan(plan) {
  const blocks = Math.round(Number(plan.blocks));
  const focusMin = Math.round(Number(plan.focusMin));
  const breakMin = Math.round(Number(plan.breakMin));
  const errors = [];
  if (!(blocks >= 1 && blocks <= 24)) errors.push('Blocos: de 1 a 24.');
  if (!(focusMin >= 1 && focusMin <= 240)) errors.push('Foco: de 1 a 240 minutos.');
  if (!(breakMin >= 0 && breakMin <= 120)) errors.push('Intervalo: de 0 a 120 minutos.');
  return { ok: errors.length === 0, errors, plan: { blocks, focusMin, breakMin } };
}

export function createDay(date, plan) {
  return { date, plan: { ...plan }, sessions: [], closedAt: null };
}

export function completedBlocks(day) {
  return day.sessions.filter((s) => s.completed).length;
}

export function isPlanComplete(day) {
  return completedBlocks(day) >= day.plan.blocks;
}

// O dia está encerrado quando: todos os blocos planejados terminaram,
// o usuário encerrou o dia de propósito, ou o dia já passou.
export function isDayFinished(day, todayKey) {
  if (!day) return false;
  return Boolean(day.closedAt) || isPlanComplete(day) || (todayKey != null && day.date < todayKey);
}

// Último bloco = o próximo bloco a terminar fecha o plano.
export function isLastBlock(day) {
  return completedBlocks(day) === day.plan.blocks - 1;
}

export function recordFocus(day, { tag, seconds, completed, endedAt }) {
  if (!isValidTag(tag)) throw new Error(`Tag inválida: ${tag}`);
  const sessions = [...day.sessions, { tag, seconds: Math.max(0, Math.round(seconds)), completed, endedAt }];
  const next = { ...day, sessions };
  if (!next.closedAt && isPlanComplete(next)) next.closedAt = endedAt;
  return next;
}

// Trocar o plano no meio do dia. Se o novo número de blocos já foi atingido, o dia fecha.
export function withPlan(day, plan, now) {
  const next = { ...day, plan: { ...plan } };
  if (!next.closedAt && isPlanComplete(next)) next.closedAt = now;
  return next;
}

export function closeDayEarly(day, now) {
  return day.closedAt ? day : { ...day, closedAt: now };
}

// REGRA PRINCIPAL: o relatório do dia só aparece depois do encerramento.
// Nunca durante um bloco nem durante um intervalo.
export function canShowDailyReport(day, timerPhase, todayKey) {
  if (!day) return false;
  if (timerPhase === 'focus' || timerPhase === 'break') return false;
  return isDayFinished(day, todayKey);
}

export function buildDailyReport(day) {
  const byTag = { video: 0, questoes: 0 };
  let netSeconds = 0;
  let partialSeconds = 0;
  for (const s of day.sessions) {
    byTag[s.tag] = (byTag[s.tag] ?? 0) + s.seconds;
    netSeconds += s.seconds;
    if (!s.completed) partialSeconds += s.seconds;
  }
  const done = day.sessions.filter((s) => s.completed);
  const plannedSeconds = day.plan.blocks * day.plan.focusMin * 60;
  const pct = (part) => (netSeconds ? Math.round((part / netSeconds) * 100) : 0);
  const videoPct = pct(byTag.video);

  return {
    date: day.date,
    plannedBlocks: day.plan.blocks,
    doneBlocks: done.length,
    plannedSeconds,
    netSeconds,
    partialSeconds,
    byTag,
    percent: { video: videoPct, questoes: netSeconds ? 100 - videoPct : 0 },
    adherence: plannedSeconds ? Math.min(100, Math.round((netSeconds / plannedSeconds) * 100)) : 0,
    endedEarly: done.length < day.plan.blocks,
    checklist: Array.from({ length: Math.max(day.plan.blocks, done.length) }, (_, i) => ({
      index: i + 1,
      done: Boolean(done[i]),
      tag: done[i]?.tag ?? null,
      seconds: done[i]?.seconds ?? 0,
    })),
  };
}
