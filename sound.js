// Bip de fim de bloco/intervalo com Web Audio.
// O som é AGENDADO no relógio de áudio quando o timer começa, então toca na hora
// exata mesmo se a aba estiver em segundo plano (onde setInterval atrasa).

let ctx = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Precisa ser chamado dentro de um toque/clique (regra dos navegadores).
export function unlock() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume();
}

const PATTERNS = {
  // fim do bloco de foco: três bips agudos
  focus: [[880, 0], [880, 0.28], [1320, 0.56]],
  // fim do intervalo: dois bips médios
  break: [[660, 0], [660, 0.3]],
  // fim do último bloco do dia: arpejo
  final: [[660, 0], [880, 0.22], [1100, 0.44], [1320, 0.66]],
};

function tone(c, at, freq, volume, nodes) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + 0.25);
  nodes.push(osc);
}

export function scheduleAlarm(secondsFromNow, { kind = 'focus', volume = 0.8 } = {}) {
  const c = getCtx();
  if (!c || volume <= 0) return { cancel() {} };
  const t0 = c.currentTime + Math.max(0, secondsFromNow);
  const nodes = [];
  for (const [freq, offset] of PATTERNS[kind] ?? PATTERNS.focus) tone(c, t0 + offset, freq, volume, nodes);
  return {
    cancel() {
      for (const n of nodes) {
        try { n.stop(); } catch { /* já parou */ }
      }
    },
  };
}

export function beepNow(kind, volume) {
  unlock();
  return scheduleAlarm(0.05, { kind, volume });
}
