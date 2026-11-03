import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/core/timer.js';
import * as D from '../src/core/day.js';
import { buildWeek, weekKeys, formatDuration } from '../src/core/stats.js';

const plan = { blocks: 3, focusMin: 50, breakMin: 10 };
const MIN = 60_000;

test('timer: pausa não conta como tempo', () => {
  let t = T.start(T.Phase.FOCUS, 50 * MIN, 0);
  t = T.pause(t, 10 * MIN);
  assert.equal(T.remainingMs(t, 30 * MIN), 40 * MIN); // ficou parado 20 min
  t = T.resume(t, 30 * MIN);
  assert.equal(T.isFinished(t, 69 * MIN), false);
  assert.equal(T.isFinished(t, 70 * MIN), true);
});

test('timer: formato do relógio', () => {
  assert.equal(T.formatClock(50 * MIN), '50:00');
  assert.equal(T.formatClock(65 * MIN), '1:05:00');
  assert.equal(T.formatClock(1), '00:01');
});

test('relatório: bloqueado durante blocos e intervalos', () => {
  let day = D.createDay('2026-11-02', plan);
  day = D.recordFocus(day, { tag: 'video', seconds: 3000, completed: true, endedAt: 1 });
  assert.equal(D.canShowDailyReport(day, 'break', '2026-11-02'), false);
  assert.equal(D.canShowDailyReport(day, 'idle', '2026-11-02'), false);
  day = D.recordFocus(day, { tag: 'questoes', seconds: 3000, completed: true, endedAt: 2 });
  assert.equal(D.isLastBlock(day), true);
  assert.equal(D.canShowDailyReport(day, 'focus', '2026-11-02'), false);
});

test('relatório: libera só ao fim do último bloco planejado', () => {
  let day = D.createDay('2026-11-02', plan);
  for (const tag of ['video', 'questoes', 'questoes']) {
    day = D.recordFocus(day, { tag, seconds: 3000, completed: true, endedAt: 9 });
  }
  assert.equal(day.closedAt, 9);
  assert.equal(D.canShowDailyReport(day, 'idle', '2026-11-02'), true);
  const r = D.buildDailyReport(day);
  assert.equal(r.netSeconds, 9000);
  assert.deepEqual(r.byTag, { video: 3000, questoes: 6000 });
  assert.deepEqual(r.percent, { video: 33, questoes: 67 });
  assert.equal(r.adherence, 100);
  assert.equal(r.checklist.every((c) => c.done), true);
});

test('relatório: encerrar o dia antes mostra o que faltou', () => {
  let day = D.createDay('2026-11-02', plan);
  day = D.recordFocus(day, { tag: 'video', seconds: 3000, completed: true, endedAt: 1 });
  day = D.closeDayEarly(day, 5);
  const r = D.buildDailyReport(day);
  assert.equal(D.canShowDailyReport(day, 'idle', '2026-11-02'), true);
  assert.equal(r.endedEarly, true);
  assert.deepEqual(r.checklist.map((c) => c.done), [true, false, false]);
});

test('dia que já passou conta como encerrado', () => {
  const day = D.createDay('2026-11-01', plan);
  assert.equal(D.isDayFinished(day, '2026-11-02'), true);
});

test('tag inválida é recusada', () => {
  assert.throws(() => D.recordFocus(D.createDay('2026-11-02', plan), { tag: 'x', seconds: 1, completed: true }));
});

test('semana: segunda a domingo e hoje trancado até encerrar', () => {
  assert.deepEqual(weekKeys('2026-11-04'), [
    '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
  ]);
  let today = D.createDay('2026-11-03', plan);
  today = D.recordFocus(today, { tag: 'video', seconds: 3000, completed: true, endedAt: 1 });
  let monday = D.createDay('2026-11-02', plan);
  monday = D.recordFocus(monday, { tag: 'questoes', seconds: 1800, completed: true, endedAt: 1 });
  const w = buildWeek({ '2026-11-02': monday, '2026-11-03': today }, '2026-11-03', '2026-11-03');
  assert.equal(w.days[1].locked, true);
  assert.equal(w.totals.total, 1800);
  assert.equal(w.days[2].future, true);
});

test('formato de duração', () => {
  assert.equal(formatDuration(9000), '2h 30min');
  assert.equal(formatDuration(2700), '45min');
  assert.equal(formatDuration(7200), '2h');
});
