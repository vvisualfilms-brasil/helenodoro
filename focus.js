// Modo foco: tela cheia, tela sempre acesa e "Não Perturbe".
//
// Sobre bloquear notificações: um site/PWA NÃO tem permissão para silenciar as
// notificações do sistema (iOS e Android não deixam). Então há dois caminhos:
//   1. Web (padrão): o app não emite nada durante o foco, mantém a tela acesa
//      e guia o usuário a ligar o Foco / Não Perturbe do aparelho.
//   2. Nativo (Capacitor, Android): se existir o plugin HelenodoroDnd, o app liga
//      e desliga o Não Perturbe sozinho. Ver docs/NATIVO.md.

let wakeLock = null;
let wantWakeLock = false;

async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {
    // Sem suporte ou bateria fraca: segue sem travar a tela acesa.
  }
}

document.addEventListener('visibilitychange', () => {
  if (wantWakeLock && document.visibilityState === 'visible') acquireWakeLock();
});

function nativeDnd() {
  return window.Capacitor?.Plugins?.HelenodoroDnd ?? null;
}

export const dnd = {
  mode() {
    return nativeDnd() ? 'native' : 'guided';
  },
  async enable() {
    const p = nativeDnd();
    if (!p) return false;
    try {
      await p.enable();
      return true;
    } catch {
      return false;
    }
  },
  async disable() {
    const p = nativeDnd();
    if (!p) return;
    try { await p.disable(); } catch { /* ignora */ }
  },
};

export async function enterFocusMode({ fullscreen = true } = {}) {
  wantWakeLock = true;
  await acquireWakeLock();
  if (fullscreen && document.fullscreenEnabled && !document.fullscreenElement) {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch { /* iPhone não tem tela cheia por elemento; como PWA já abre sem barras */ }
  }
  await dnd.enable();
}

export async function exitFocusMode() {
  wantWakeLock = false;
  try { await wakeLock?.release(); } catch { /* ignora */ }
  wakeLock = null;
  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch { /* ignora */ }
  }
  await dnd.disable();
}

// Celular/tablet de lado. Em computador (mouse) não conta, senão o app
// ficaria sempre no modo mínimo, já que monitor é sempre "paisagem".
const landscapeQuery = '(orientation: landscape) and (pointer: coarse)';

export function isLandscape() {
  return window.matchMedia(landscapeQuery).matches;
}

export function onOrientationChange(cb) {
  window.matchMedia(landscapeQuery).addEventListener('change', (e) => cb(e.matches));
}
