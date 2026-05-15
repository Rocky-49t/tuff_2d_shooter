export const MAPS = [
  {
    id: 'killhouse',
    name: 'Killhouse Annex',
    description: 'Tight rooms, short sightlines, and fast close-quarter pivots.',
    width: 1920,
    height: 1280,
    background: '#242927',
    matchDuration: 150,
    playerSpawns: [
      { x: 190, y: 190, radius: 80 },
      { x: 1720, y: 1070, radius: 80 }
    ],
    botSpawns: [
      { x: 1700, y: 170, radius: 100 },
      { x: 260, y: 1040, radius: 100 },
      { x: 960, y: 250, radius: 80 },
      { x: 960, y: 1030, radius: 80 }
    ],
    obstacles: [
      { x: 0, y: 0, w: 1920, h: 36 },
      { x: 0, y: 1244, w: 1920, h: 36 },
      { x: 0, y: 0, w: 36, h: 1280 },
      { x: 1884, y: 0, w: 36, h: 1280 },
      { x: 360, y: 180, w: 80, h: 360 },
      { x: 360, y: 700, w: 80, h: 380 },
      { x: 690, y: 370, w: 540, h: 80 },
      { x: 690, y: 830, w: 540, h: 80 },
      { x: 1460, y: 180, w: 80, h: 360 },
      { x: 1460, y: 700, w: 80, h: 380 },
      { x: 860, y: 560, w: 200, h: 160 }
    ],
    cover: [
      { x: 540, y: 570, w: 190, h: 36 },
      { x: 1190, y: 670, w: 190, h: 36 },
      { x: 220, y: 610, w: 210, h: 32 },
      { x: 1490, y: 610, w: 210, h: 32 }
    ],
    hazards: [
      { x: 920, y: 610, w: 80, h: 60, damagePerSecond: 7, label: 'sparks' }
    ],
    pickups: [
      { type: 'medkit', x: 960, y: 190 },
      { type: 'ammo', x: 960, y: 1090 },
      { type: 'armor', x: 1740, y: 640 },
      { type: 'adrenaline', x: 180, y: 640 }
    ],
    pveEnemies: [
      { x: 1620, y: 220, archetype: 'rifle' },
      { x: 1640, y: 1030, archetype: 'rusher' },
      { x: 960, y: 1010, archetype: 'rifle' },
      { x: 1180, y: 630, archetype: 'sniper' },
      { x: 620, y: 650, archetype: 'rusher' }
    ],
    pvpBots: 5
  },
  {
    id: 'container_yard',
    name: 'Container Yard',
    description: 'Long lanes, stacked cargo, and dangerous fuel leaks.',
    width: 2240,
    height: 1440,
    background: '#202625',
    matchDuration: 180,
    playerSpawns: [
      { x: 180, y: 220, radius: 100 },
      { x: 2040, y: 1220, radius: 100 }
    ],
    botSpawns: [
      { x: 2020, y: 240, radius: 120 },
      { x: 220, y: 1200, radius: 120 },
      { x: 1120, y: 220, radius: 100 },
      { x: 1120, y: 1240, radius: 100 }
    ],
    obstacles: [
      { x: 0, y: 0, w: 2240, h: 40 },
      { x: 0, y: 1400, w: 2240, h: 40 },
      { x: 0, y: 0, w: 40, h: 1440 },
      { x: 2200, y: 0, w: 40, h: 1440 },
      { x: 420, y: 220, w: 360, h: 88 },
      { x: 420, y: 430, w: 360, h: 88 },
      { x: 420, y: 970, w: 360, h: 88 },
      { x: 420, y: 1180, w: 360, h: 88 },
      { x: 1020, y: 320, w: 100, h: 800 },
      { x: 1320, y: 320, w: 100, h: 800 },
      { x: 1640, y: 230, w: 320, h: 90 },
      { x: 1640, y: 1110, w: 320, h: 90 }
    ],
    cover: [
      { x: 850, y: 700, w: 140, h: 35 },
      { x: 1450, y: 700, w: 140, h: 35 },
      { x: 1040, y: 1180, w: 360, h: 34 },
      { x: 1040, y: 220, w: 360, h: 34 }
    ],
    hazards: [
      { x: 1740, y: 610, w: 150, h: 130, damagePerSecond: 11, label: 'fuel' },
      { x: 320, y: 690, w: 120, h: 100, damagePerSecond: 8, label: 'steam' }
    ],
    pickups: [
      { type: 'ammo', x: 1120, y: 130 },
      { type: 'ammo', x: 1120, y: 1310 },
      { type: 'medkit', x: 2050, y: 720 },
      { type: 'armor', x: 190, y: 720 },
      { type: 'adrenaline', x: 1120, y: 720 }
    ],
    pveEnemies: [
      { x: 1990, y: 380, archetype: 'sniper' },
      { x: 1980, y: 1030, archetype: 'rifle' },
      { x: 1180, y: 560, archetype: 'rifle' },
      { x: 1500, y: 920, archetype: 'rusher' },
      { x: 600, y: 1120, archetype: 'rusher' },
      { x: 1960, y: 720, archetype: 'rifle' }
    ],
    pvpBots: 6
  },
  {
    id: 'metro_station',
    name: 'Metro Station',
    description: 'Symmetric concourse with kiosks, platforms, and exposed center control.',
    width: 2100,
    height: 1320,
    background: '#222625',
    matchDuration: 165,
    playerSpawns: [
      { x: 170, y: 660, radius: 100 },
      { x: 1930, y: 660, radius: 100 }
    ],
    botSpawns: [
      { x: 1050, y: 160, radius: 110 },
      { x: 1050, y: 1160, radius: 110 },
      { x: 1880, y: 230, radius: 110 },
      { x: 220, y: 1090, radius: 110 }
    ],
    obstacles: [
      { x: 0, y: 0, w: 2100, h: 38 },
      { x: 0, y: 1282, w: 2100, h: 38 },
      { x: 0, y: 0, w: 38, h: 1320 },
      { x: 2062, y: 0, w: 38, h: 1320 },
      { x: 420, y: 260, w: 260, h: 110 },
      { x: 420, y: 950, w: 260, h: 110 },
      { x: 1420, y: 260, w: 260, h: 110 },
      { x: 1420, y: 950, w: 260, h: 110 },
      { x: 880, y: 450, w: 340, h: 90 },
      { x: 880, y: 780, w: 340, h: 90 },
      { x: 980, y: 585, w: 140, h: 150 }
    ],
    cover: [
      { x: 720, y: 585, w: 170, h: 34 },
      { x: 1210, y: 700, w: 170, h: 34 },
      { x: 240, y: 510, w: 160, h: 32 },
      { x: 1700, y: 780, w: 160, h: 32 }
    ],
    hazards: [
      { x: 980, y: 120, w: 140, h: 70, damagePerSecond: 9, label: 'track arc' },
      { x: 980, y: 1130, w: 140, h: 70, damagePerSecond: 9, label: 'track arc' }
    ],
    pickups: [
      { type: 'medkit', x: 1050, y: 660 },
      { type: 'ammo', x: 520, y: 660 },
      { type: 'ammo', x: 1580, y: 660 },
      { type: 'armor', x: 1050, y: 260 },
      { type: 'adrenaline', x: 1050, y: 1060 }
    ],
    pveEnemies: [
      { x: 1850, y: 660, archetype: 'rifle' },
      { x: 1740, y: 300, archetype: 'sniper' },
      { x: 1740, y: 1020, archetype: 'sniper' },
      { x: 960, y: 1040, archetype: 'rusher' },
      { x: 960, y: 280, archetype: 'rusher' }
    ],
    pvpBots: 5
  }
];
