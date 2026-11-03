// Timer puro (sem DOM). Guarda o horário de término em vez de contar ticks,
// então continua certo mesmo se o celular travar a aba em segundo plano.

export const Phase = Object.freeze({ IDLE: 'idle', FOCUS: 'focus', BREAK: 'break' });

export function idle() {
  return { phase: Phase.IDLE, running: false, durationMs: 0, remainingMs: 0, endAt: null };
}

export function start(phase, durationMs, now) {
  return { phase, running: true, durationMs, remainingMs: durationMs, endAt: now + durationMs };
}

export function pause(t, now) {
  if (!t.running) return t;
  return { ...t, running: false, remainingMs: Math.max(0, t.endAt - now), endAt: null };
}

export function resume(t, now) {
  if (t.running || t.phase === Phase.IDLE) return t;
  return { ...t, running: true, endAt: now + t.remainingMs };
}

export function remainingMs(t, now) {
  return t.running ? Math.max(0, t.endAt - now) : t.remainingMs;
}

export function elapsedMs(t, now) {
  return t.durationMs - remainingMs(t, now);
}

export function isFinished(t, now) {
  return t.phase !== Phase.IDLE && remainingMs(t, now) === 0;
}

// 1500000 -> "25:00"; acima de 1h -> "1:05:00"
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
