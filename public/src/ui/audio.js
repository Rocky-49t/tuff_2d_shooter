let context;
const recentShots = [];

export function unlockAudio() {
  if (!context) context = new AudioContext();
  if (context.state === 'suspended') context.resume();
}

/**
 * @param {object} event
 * @param {{ x: number, y: number, hearRadius?: number } | null} listener - local player for spatial + culling
 */
export function playEventSound(event, listener = null) {
  if (!context) return;
  if (event.type === 'hit' && event.weaponId === 'zombie_claw') return;

  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (event.type === 'shot') {
    while (recentShots.length && nowMs - recentShots[0] > 70) recentShots.shift();
    if (recentShots.length >= 9) return;
    recentShots.push(nowMs);
  }

  let volMul = 1;
  if (listener && Number.isFinite(event.x) && Number.isFinite(event.y) && Number.isFinite(listener.x) && Number.isFinite(listener.y)) {
    const d = Math.hypot(event.x - listener.x, event.y - listener.y);
    const maxR = Number.isFinite(listener.hearRadius) ? listener.hearRadius : 1400;
    if (d > maxR) return;
    volMul = Math.max(0.08, 1 - d / maxR);
  }

  const v = (base) => base * volMul;

  if (event.type === 'shot') tone(95, 0.028, v(0.05), 'square');
  if (event.type === 'hit') tone(210, 0.045, v(0.07), 'sawtooth');
  if (event.type === 'death') tone(70, 0.14, v(0.09), 'triangle');
  if (event.type === 'pickup') tone(520, 0.08, v(0.05), 'sine');
  if (event.type === 'dryFire') tone(130, 0.035, v(0.035), 'square');
  if (event.type === 'explosion') tone(55, 0.12, v(0.08), 'sawtooth');
  if (event.type === 'melee') tone(65, 0.06, v(0.055), 'triangle');
}

function tone(frequency, duration, volume, type) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * 0.65), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}
