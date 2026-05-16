import { makeInput } from '../simulation/match.js';
import { isDomTypingFocused } from './uiFocus.js';

export class InputBindings {
  constructor(scene) {
    this.scene = scene;
    // disableCapture: do not preventDefault — allows typing WASD in HTML inputs
    this.keys = scene.input.keyboard.addKeys(
      {
        w: 'W',
        a: 'A',
        s: 'S',
        d: 'D',
        r: 'R',
        g: 'G',
        v: 'V',
        shift: 'SHIFT',
        one: 'ONE',
        two: 'TWO',
        three: 'THREE'
      },
      false
    );
    this.reloadQueued = false;
    this.swapQueued = null;
    this.grenadeQueued = false;
    this.bandageQueued = false;
    scene.input.keyboard.on('keydown-R', () => {
      if (!isDomTypingFocused()) this.reloadQueued = true;
    });
    scene.input.keyboard.on('keydown-G', () => {
      if (!isDomTypingFocused()) this.grenadeQueued = true;
    });
    scene.input.keyboard.on('keydown-V', () => {
      if (!isDomTypingFocused()) this.bandageQueued = true;
    });
    scene.input.keyboard.on('keydown-ONE', () => {
      if (!isDomTypingFocused()) this.swapQueued = 0;
    });
    scene.input.keyboard.on('keydown-TWO', () => {
      if (!isDomTypingFocused()) this.swapQueued = 1;
    });
    scene.input.keyboard.on('keydown-THREE', () => {
      if (!isDomTypingFocused()) this.swapQueued = 2;
    });
    scene.input.on('wheel', (_pointer, _gameObjects, _dx, dy) => {
      if (!isDomTypingFocused()) this.swapQueued = dy > 0 ? 1 : 0;
    });
  }

  read(player) {
    if (isDomTypingFocused()) {
      return makeInput({ aimX: player?.x || 0, aimY: player?.y || 0 });
    }
    const pointer = this.scene.input.activePointer;
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const input = makeInput({
      moveX: (this.keys.d.isDown ? 1 : 0) - (this.keys.a.isDown ? 1 : 0),
      moveY: (this.keys.s.isDown ? 1 : 0) - (this.keys.w.isDown ? 1 : 0),
      aimX: worldPoint.x,
      aimY: worldPoint.y,
      fire: pointer.isDown && pointer.leftButtonDown(),
      reload: this.reloadQueued,
      swap: this.swapQueued,
      sprint: this.keys.shift.isDown,
      useGrenade: this.grenadeQueued,
      useBandage: this.bandageQueued
    });
    if (this.swapQueued === 1 && player) input.swap = (player.activeWeaponIndex + 1) % player.weapons.length;
    this.reloadQueued = false;
    this.swapQueued = null;
    this.grenadeQueued = false;
    this.bandageQueued = false;
    return input;
  }
}
