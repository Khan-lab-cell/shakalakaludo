// Sound effects via Howler. Option A: expects files in /public/sounds/.
// Drop in: dice.mp3, move.mp3, kill.mp3, home.mp3, win.mp3
// Missing files log a console warning and resolve silently — the rest of the
// app keeps working without sound.

import { Howl } from 'howler';

const files = {
  dice: ['sounds/dice.mp3'],
  move: ['sounds/move.mp3'],
  kill: ['sounds/kill.mp3'],
  home: ['sounds/home.mp3'],
  win: ['sounds/win.mp3'],
};

const cache = {};
let initialized = false;

function build(key) {
  try {
    const howl = new Howl({
      src: files[key],
      volume: 0.55,
      preload: true,
      onloaderror: () => console.info(`[sounds] ${key}.mp3 not found, playing silence.`),
      onplayerror: () => {},
    });
    cache[key] = howl;
    return howl;
  } catch (e) {
    return { play: () => {}, stop: () => {}, unload: () => {} };
  }
}

export function preloadSounds() {
  if (initialized) return;
  initialized = true;
  Object.keys(files).forEach(build);
}

export function playSound(key) {
  if (!initialized) preloadSounds();
  const h = cache[key] || build(key);
  try { h.stop(); h.play(); } catch (e) { /* ignore */ }
}

export function setMuted(muted) {
  Object.values(cache).forEach((h) => { try { h.mute(muted); } catch (e) {} });
}
