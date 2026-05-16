export const WEAPONS = {
  mk18: {
    id: 'mk18',
    displayName: 'MK18 Carbine',
    role: 'Primary',
    damage: 23,
    fireRate: 10.5,
    magazineSize: 30,
    reloadTime: 1.55,
    projectileSpeed: 1040,
    spread: 0.045,
    range: 780,
    recoil: 0.028,
    pellets: 1,
    ammoReserve: 120
  },
  vector: {
    id: 'vector',
    displayName: 'Vector SMG',
    role: 'Primary',
    damage: 17,
    fireRate: 15,
    magazineSize: 33,
    reloadTime: 1.35,
    projectileSpeed: 900,
    spread: 0.075,
    range: 560,
    recoil: 0.02,
    pellets: 1,
    ammoReserve: 132
  },
  breacher: {
    id: 'breacher',
    displayName: 'M590 Breacher',
    role: 'Primary',
    damage: 9,
    fireRate: 1.35,
    magazineSize: 7,
    reloadTime: 1.95,
    projectileSpeed: 820,
    spread: 0.22,
    range: 360,
    recoil: 0.095,
    pellets: 8,
    ammoReserve: 35
  },
  marksman: {
    id: 'marksman',
    displayName: 'SR-25 Marksman',
    role: 'Primary',
    damage: 48,
    fireRate: 3.2,
    magazineSize: 20,
    reloadTime: 1.8,
    projectileSpeed: 1260,
    spread: 0.018,
    range: 980,
    recoil: 0.052,
    pellets: 1,
    ammoReserve: 80
  },
  lmg: {
    id: 'lmg',
    displayName: 'M249 Support',
    role: 'Primary',
    damage: 20,
    fireRate: 12,
    magazineSize: 75,
    reloadTime: 2.75,
    projectileSpeed: 980,
    spread: 0.092,
    range: 720,
    recoil: 0.038,
    pellets: 1,
    ammoReserve: 150
  },
  sidearm: {
    id: 'sidearm',
    displayName: 'P320 Sidearm',
    role: 'Secondary',
    damage: 28,
    fireRate: 4.2,
    magazineSize: 15,
    reloadTime: 1.1,
    projectileSpeed: 760,
    spread: 0.055,
    range: 430,
    recoil: 0.035,
    pellets: 1,
    ammoReserve: 45
  },
  /** Non-firing placeholder for wave zombies (melee only). */
  zombie_claw: {
    id: 'zombie_claw',
    displayName: 'Infected claw',
    role: 'Melee',
    damage: 0,
    fireRate: 0.01,
    magazineSize: 1,
    reloadTime: 99,
    projectileSpeed: 0,
    spread: 0,
    range: 0,
    recoil: 0,
    pellets: 1,
    ammoReserve: 0
  }
};

export const LOADOUTS = [
  {
    id: 'rifleman',
    name: 'Rifleman',
    description: 'Balanced carbine, sidearm, and armor for flexible lanes.',
    weapons: ['mk18', 'sidearm'],
    armor: 35,
    speedBonus: 0,
    grenades: 2,
    bandages: 2
  },
  {
    id: 'breacher',
    name: 'Breacher',
    description: 'Shotgun pressure kit with faster movement and low reserves.',
    weapons: ['breacher', 'sidearm'],
    armor: 20,
    speedBonus: 18,
    grenades: 3,
    bandages: 1
  },
  {
    id: 'recon',
    name: 'Recon',
    description: 'Marksman rifle, lighter armor, sharper radar discipline.',
    weapons: ['marksman', 'sidearm'],
    armor: 15,
    speedBonus: 12,
    grenades: 1,
    bandages: 2
  },
  {
    id: 'support',
    name: 'Support',
    description: 'LMG, strong armor, and suppressive fire at lower mobility.',
    weapons: ['lmg', 'sidearm'],
    armor: 50,
    speedBonus: -12,
    grenades: 2,
    bandages: 3
  }
];

export const MODES = [
  {
    id: 'pve_elimination',
    name: 'PvE Elimination',
    description: 'Clear every hostile in the training sector. One life with emergency med support.'
  },
  {
    id: 'pvp_deathmatch',
    name: 'Bot Deathmatch (Offline)',
    description: 'Score the most eliminations before the clock expires. Bots respawn and hunt each other.'
  },
  {
    id: 'pve_waves',
    name: 'Survival Waves',
    description: 'Waves of bots ramp up in strength and numbers. Highest kill score wins when time expires.'
  },
  {
    id: 'pve_capture',
    name: 'Territory Control',
    description: 'Hold capture zones to bank team score. Play solo with AI allies and enemies or online.'
  }
];
