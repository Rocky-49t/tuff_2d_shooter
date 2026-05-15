import { makeInput } from '../simulation/match.js';

export class InputBindings {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard.addKeys({
      w: 'W',
      a: 'A',
      s: 'S',
      d: 'D',
      r: 'R',
      shift: 'SHIFT',
      one: 'ONE',
      two: 'TWO',
      three: 'THREE'
    });
    this.reloadQueued = false;
    this.swapQueued = null;
    scene.input.keyboard.on('keydown-R', () => {
      this.reloadQueued = true;
    });
    scene.input.keyboard.on('keydown-ONE', () => {
      this.swapQueued = 0;
    });
    scene.input.keyboard.on('keydown-TWO', () => {
      this.swapQueued = 1;
    });
    scene.input.keyboard.on('keydown-THREE', () => {
      this.swapQueued = 2;
    });
    scene.input.on('wheel', (_pointer, _gameObjects, _dx, dy) => {
      this.swapQueued = dy > 0 ? 1 : 0;
    });
  }

  read(player) {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA') {
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
      sprint: this.keys.shift.isDown
    });
    if (this.swapQueued === 1 && player) input.swap = (player.activeWeaponIndex + 1) % player.weapons.length;
    this.reloadQueued = false;
    this.swapQueued = null;
    return input;
  }
}
