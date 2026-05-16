export const MAPS = [
  {
    id: 'killhouse',
    name: 'Killhouse Annex — Training Arena',
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
    pvpBots: 5,
    capturePoints: [
      { id: 'K-A', x: 420, y: 640, radius: 72 },
      { id: 'K-B', x: 1500, y: 640, radius: 72 },
      { id: 'K-C', x: 960, y: 380, radius: 68 }
    ]
  },
  {
    id: 'container_yard',
    name: 'Container Yard — Training Arena',
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
    pvpBots: 6,
    capturePoints: [
      { id: 'CY-1', x: 560, y: 720, radius: 74 },
      { id: 'CY-2', x: 1680, y: 720, radius: 74 },
      { id: 'CY-3', x: 1120, y: 420, radius: 70 }
    ]
  },
  {
    id: 'metro_station',
    name: 'Metro Station — Training Arena',
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
    pvpBots: 5,
    capturePoints: [
      { id: 'M-1', x: 520, y: 660, radius: 72 },
      { id: 'M-2', x: 1580, y: 660, radius: 72 },
      { id: 'M-3', x: 1050, y: 360, radius: 68 }
    ]
  },
  {
    id: 'sunridge_expanse',
    name: 'Sunridge Expanse Battlefield',
    description: 'Sun-baked grass, orchard groves, farm roads, and a lonely highway — huge fights, long rotations.',
    width: 4400,
    height: 3000,
    background: '#3a6b45',
    matchDuration: 240,
    playerSpawns: [
      { x: 420, y: 520, radius: 140 },
      { x: 3980, y: 2480, radius: 140 }
    ],
    botSpawns: [
      { x: 2200, y: 400, radius: 160 },
      { x: 2200, y: 2600, radius: 160 },
      { x: 520, y: 1500, radius: 140 },
      { x: 3880, y: 1500, radius: 140 }
    ],
    decorations: [
      { kind: 'field', x: 0, y: 0, w: 4400, h: 3000, color: '#4a8f58', alpha: 0.92 },
      { kind: 'road', x: 0, y: 1460, w: 4400, h: 88, color: '#4d4a42', alpha: 1 },
      { kind: 'road', x: 2160, y: 0, w: 96, h: 3000, color: '#4d4a42', alpha: 1 },
      { kind: 'road', x: 1180, y: 620, w: 520, h: 52, color: '#5c574e', alpha: 0.95 },
      { kind: 'road', x: 2680, y: 1820, w: 620, h: 52, color: '#5c574e', alpha: 0.95 },
      { kind: 'sand', x: 3200, y: 200, w: 900, h: 700, color: '#c9b48a', alpha: 0.88 },
      { kind: 'sand', x: 280, y: 2050, w: 820, h: 620, color: '#c9b48a', alpha: 0.88 },
      { kind: 'water', x: 3600, y: 2280, w: 520, h: 360, color: '#3a6d8c', alpha: 0.75 },
      { kind: 'lot', x: 3080, y: 1180, w: 280, h: 200, color: '#6a6560', alpha: 0.9 },
      { kind: 'building', x: 3140, y: 1220, w: 160, h: 120, color: '#8b7355', stroke: '#3d3228' },
      { kind: 'building', x: 3320, y: 1240, w: 140, h: 100, color: '#7a6a55', stroke: '#3d3228' },
      { kind: 'building', x: 720, y: 1880, w: 200, h: 140, color: '#9a8060', stroke: '#3d3228' },
      { kind: 'building', x: 940, y: 1980, w: 110, h: 90, color: '#7d6a50', stroke: '#3d3228' },
      { kind: 'tree', x: 580, y: 1120, r: 26, color: '#2d5c34' },
      { kind: 'tree', x: 820, y: 1280, r: 32, color: '#234a2a' },
      { kind: 'tree', x: 1100, y: 980, r: 28, color: '#2d5c34' },
      { kind: 'tree', x: 1520, y: 420, r: 34, color: '#1e4226' },
      { kind: 'tree', x: 1780, y: 560, r: 30, color: '#2d5c34' },
      { kind: 'tree', x: 2580, y: 720, r: 28, color: '#234a2a' },
      { kind: 'tree', x: 2920, y: 520, r: 36, color: '#1e4226' },
      { kind: 'tree', x: 3380, y: 920, r: 30, color: '#2d5c34' },
      { kind: 'tree', x: 3820, y: 1320, r: 32, color: '#234a2a' },
      { kind: 'tree', x: 4100, y: 1680, r: 28, color: '#2d5c34' },
      { kind: 'tree', x: 3600, y: 1980, r: 26, color: '#1e4226' },
      { kind: 'tree', x: 1880, y: 2180, r: 34, color: '#2d5c34' },
      { kind: 'tree', x: 1480, y: 2480, r: 30, color: '#234a2a' },
      { kind: 'tree', x: 980, y: 2380, r: 28, color: '#2d5c34' },
      { kind: 'rock', x: 2420, y: 1420, r: 22, color: '#6b6f6a' },
      { kind: 'rock', x: 2680, y: 1560, r: 18, color: '#5c605c' },
      { kind: 'rock', x: 1280, y: 1680, r: 20, color: '#6b6f6a' },
      { kind: 'rock', x: 3520, y: 400, r: 24, color: '#5c605c' }
    ],
    obstacles: [
      { x: 0, y: 0, w: 4400, h: 48 },
      { x: 0, y: 2952, w: 4400, h: 48 },
      { x: 0, y: 0, w: 48, h: 3000 },
      { x: 4352, y: 0, w: 48, h: 3000 },
      { x: 3140, y: 1220, w: 160, h: 120 },
      { x: 3320, y: 1240, w: 140, h: 100 },
      { x: 720, y: 1880, w: 200, h: 140 },
      { x: 940, y: 1980, w: 110, h: 90 },
      { x: 2060, y: 1320, w: 280, h: 360 },
      { x: 2680, y: 920, w: 320, h: 200 },
      { x: 1280, y: 2180, w: 400, h: 120 },
      { x: 3480, y: 2000, w: 220, h: 180 },
      { x: 1620, y: 520, w: 180, h: 260 },
      { x: 900, y: 720, w: 140, h: 240 }
    ],
    cover: [
      { x: 2260, y: 1380, w: 220, h: 44 },
      { x: 1960, y: 1740, w: 200, h: 40 },
      { x: 3020, y: 2040, w: 260, h: 40 }
    ],
    hazards: [],
    pickups: [
      { type: 'medkit', x: 2200, y: 320 },
      { type: 'medkit', x: 2200, y: 2680 },
      { type: 'ammo', x: 4200, y: 1500 },
      { type: 'ammo', x: 200, y: 1500 },
      { type: 'armor', x: 2200, y: 1500 }
    ],
    pveEnemies: [
      { x: 3800, y: 450, archetype: 'rifle' },
      { x: 600, y: 2550, archetype: 'rusher' },
      { x: 2200, y: 1500, archetype: 'sniper' }
    ],
    pvpBots: 8,
    capturePoints: [
      { id: 'SR-N', x: 2200, y: 520, radius: 88 },
      { id: 'SR-S', x: 2200, y: 2480, radius: 88 },
      { id: 'SR-E', x: 3920, y: 1500, radius: 84 },
      { id: 'SR-W', x: 480, y: 1500, radius: 84 }
    ]
  },
  {
    id: 'crimson_industrial',
    name: 'Crimson Industrial Sector',
    description: 'Rust-red desert concrete, rail spurs, warehouses, and cooling ponds — collisions and flanks everywhere.',
    width: 4000,
    height: 2800,
    background: '#5c3d38',
    matchDuration: 240,
    playerSpawns: [
      { x: 360, y: 480, radius: 130 },
      { x: 3640, y: 2320, radius: 130 }
    ],
    botSpawns: [
      { x: 2000, y: 320, radius: 150 },
      { x: 2000, y: 2480, radius: 150 },
      { x: 480, y: 1400, radius: 130 },
      { x: 3520, y: 1400, radius: 130 }
    ],
    decorations: [
      { kind: 'sand', x: 0, y: 0, w: 4000, h: 2800, color: '#7a5248', alpha: 0.94 },
      { kind: 'road', x: 0, y: 1340, w: 4000, h: 96, color: '#4a4540', alpha: 1 },
      { kind: 'road', x: 1920, y: 0, w: 88, h: 2800, color: '#4a4540', alpha: 1 },
      { kind: 'road', x: 880, y: 1850, w: 640, h: 56, color: '#5a544c', alpha: 0.96 },
      { kind: 'water', x: 2920, y: 1880, w: 480, h: 420, color: '#4a6670', alpha: 0.7 },
      { kind: 'lot', x: 1200, y: 520, w: 520, h: 360, color: '#5e564f', alpha: 0.88 },
      { kind: 'building', x: 1320, y: 600, w: 220, h: 160, color: '#8b7355', stroke: '#2a211c' },
      { kind: 'building', x: 1560, y: 640, w: 140, h: 100, color: '#756350', stroke: '#2a211c' },
      { kind: 'building', x: 2580, y: 920, w: 280, h: 200, color: '#6a5c4a', stroke: '#2a211c' },
      { kind: 'building', x: 2860, y: 960, w: 160, h: 130, color: '#5a4d3f', stroke: '#2a211c' },
      { kind: 'building', x: 520, y: 2080, w: 240, h: 160, color: '#7a6854', stroke: '#2a211c' },
      { kind: 'tree', x: 620, y: 1180, r: 22, color: '#3d5038' },
      { kind: 'tree', x: 880, y: 1020, r: 26, color: '#32442e' },
      { kind: 'tree', x: 1080, y: 2280, r: 24, color: '#3d5038' },
      { kind: 'tree', x: 3180, y: 500, r: 22, color: '#32442e' },
      { kind: 'tree', x: 3480, y: 800, r: 20, color: '#3d5038' },
      { kind: 'rock', x: 1680, y: 1800, r: 28, color: '#6e6560' },
      { kind: 'rock', x: 2280, y: 2000, r: 24, color: '#5a524e' },
      { kind: 'rock', x: 920, y: 520, r: 20, color: '#6e6560' }
    ],
    obstacles: [
      { x: 0, y: 0, w: 4000, h: 44 },
      { x: 0, y: 2756, w: 4000, h: 44 },
      { x: 0, y: 0, w: 44, h: 2800 },
      { x: 3956, y: 0, w: 44, h: 2800 },
      { x: 1320, y: 600, w: 220, h: 160 },
      { x: 1560, y: 640, w: 140, h: 100 },
      { x: 2580, y: 920, w: 280, h: 200 },
      { x: 2860, y: 960, w: 160, h: 130 },
      { x: 520, y: 2080, w: 240, h: 160 },
      { x: 1840, y: 1180, w: 360, h: 440 },
      { x: 2680, y: 1500, w: 300, h: 160 },
      { x: 980, y: 1680, w: 240, h: 300 },
      { x: 560, y: 760, w: 200, h: 260 },
      { x: 3120, y: 1220, w: 200, h: 340 }
    ],
    cover: [
      { x: 1980, y: 1240, w: 200, h: 42 },
      { x: 2460, y: 1800, w: 220, h: 40 },
      { x: 980, y: 1320, w: 200, h: 38 }
    ],
    hazards: [
      { x: 2920, y: 1880, w: 480, h: 420, damagePerSecond: 5, label: 'coolant' }
    ],
    pickups: [
      { type: 'ammo', x: 2000, y: 260 },
      { type: 'ammo', x: 2000, y: 2540 },
      { type: 'medkit', x: 200, y: 1400 },
      { type: 'medkit', x: 3800, y: 1400 },
      { type: 'armor', x: 2000, y: 1400 }
    ],
    pveEnemies: [
      { x: 3300, y: 1100, archetype: 'sniper' },
      { x: 700, y: 1700, archetype: 'rifle' },
      { x: 2000, y: 2000, archetype: 'rusher' }
    ],
    pvpBots: 8,
    capturePoints: [
      { id: 'CI-1', x: 2000, y: 480, radius: 86 },
      { id: 'CI-2', x: 2000, y: 2320, radius: 86 },
      { id: 'CI-3', x: 3400, y: 1400, radius: 82 },
      { id: 'CI-4', x: 600, y: 1400, radius: 82 }
    ]
  }
];
