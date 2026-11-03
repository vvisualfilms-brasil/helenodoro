// Persistência local (localStorage). Tudo fica no aparelho; nada vai para servidor.
import { idle } from './timer.js';

const KEY = 'helenodoro:v1';

export function defaults() {
  return {
    version: 1,
    settings: {
      defaultPlan: { blocks: 4, focusMin: 50, breakMin: 10 },
      volume: 0.8,
      fullscreen: true,
    },
    days: {},
    active: { date: null, tag: 'video', timer: idle() },
  };
}

export function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw);
    return {
      ...base,
      ...data,
      settings: { ...base.settings, ...data.settings },
      active: { ...base.active, ...data.active },
    };
  } catch {
    return base;
  }
}

export function save(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Modo privado ou armazenamento cheio: o app continua funcionando nesta aba.
  }
}
