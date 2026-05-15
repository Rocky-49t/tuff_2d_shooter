let context;

export function unlockAudio() {
  if (!context) context = new AudioContext();
  if (context.state === 'suspended') context.resume();
}

export function playEventSound(event) {
  if (!context) return;
  if (event.type === 'shot') tone(95, 0.028, 0.05, 'square');
  if (event.type === 'hit') tone(210, 0.045, 0.07, 'sawtooth');
  if (event.type === 'death') tone(70, 0.14, 0.09, 'triangle');
  if (event.type === 'pickup') tone(520, 0.08, 0.05, 'sine');
  if (event.type === 'dryFire') tone(130, 0.035, 0.035, 'square');
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
