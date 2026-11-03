// Datas e métricas semanais (sem DOM).
import { isDayFinished } from './day.js';

const pad = (n) => String(n).padStart(2, '0');

// Data local (não UTC) no formato AAAA-MM-DD.
export function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

// Semana de segunda a domingo que contém a data.
export function weekKeys(key) {
  const d = parseKey(key);
  const fromMonday = (d.getDay() + 6) % 7;
  const monday = addDays(key, -fromMonday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// 9000 -> "2h 30min"
export function formatDuration(seconds) {
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${pad(m)}min`;
}

// Dashboard da semana. O dia de hoje fica "trancado" (zerado) até ser encerrado,
// para não antecipar o relatório do dia.
export function buildWeek(daysByKey, refKey, todayKey) {
  const keys = weekKeys(refKey);
  const days = keys.map((key, i) => {
    const day = daysByKey[key];
    const future = key > todayKey;
    const locked = key === todayKey && Boolean(day) && !isDayFinished(day, todayKey);
    let video = 0;
    let questoes = 0;
    if (day && !locked) {
      for (const s of day.sessions) {
        if (s.tag === 'video') video += s.seconds;
        else if (s.tag === 'questoes') questoes += s.seconds;
      }
    }
    return {
      key,
      label: WEEKDAYS[i],
      video,
      questoes,
      total: video + questoes,
      locked,
      future,
      hasReport: Boolean(day) && !locked && !future,
    };
  });

  const totals = days.reduce(
    (acc, d) => ({ video: acc.video + d.video, questoes: acc.questoes + d.questoes, total: acc.total + d.total }),
    { video: 0, questoes: 0, total: 0 },
  );
  const studied = days.filter((d) => d.total > 0);
  const best = studied.reduce((a, d) => (!a || d.total > a.total ? d : a), null);
  const videoPct = totals.total ? Math.round((totals.video / totals.total) * 100) : 0;

  return {
    keys,
    days,
    totals,
    percent: { video: videoPct, questoes: totals.total ? 100 - videoPct : 0 },
    studiedDays: studied.length,
    avgPerStudiedDay: studied.length ? Math.round(totals.total / studied.length) : 0,
    bestDay: best,
    todayLocked: days.some((d) => d.locked),
  };
}
