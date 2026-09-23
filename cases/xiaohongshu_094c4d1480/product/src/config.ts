// ===== Game configuration =====

export const TEAM_ALPHA = 0;
export const TEAM_BRAVO = 1;

export const TEAM_NAMES = ['ALPHA 沙暴', 'BRAVO 毒蝎'] as const;
export const TEAM_COLORS = ['#ffc46b', '#7de08a'] as const;

export const BOT_NAMES: string[][] = [
  ['秃鹫', '沙狐', '刺刃', '毒蜂', '孤狼'],
  ['响尾蛇', '秃鹰', '铁钳', '黑曼巴', '猎犬'],
];

export const PLAYER_TEAM = TEAM_ALPHA;

// player
export const PLAYER = {
  height: 1.8,
  radius: 0.4,
  eyeHeight: 1.62,
  walkSpeed: 4.6,
  sprintSpeed: 7.2,
  crouchSpeed: 2.2,
  accel: 60,
  airAccel: 12,
  jumpVel: 6.4,
  gravity: 18,
  maxHp: 100,
  respawnDelay: 3.0,
  spawnProtectTime: 1.5,
};

// weapon
export const WEAPON = {
  name: 'MK-4 卡宾枪',
  rpm: 660,
  damage: 26,
  headshotMult: 3.0,
  falloffStart: 28,
  falloffEnd: 85,
  falloffMin: 0.62,
  magSize: 30,
  reserveMags: 4,
  reloadTime: 2.1,
  baseSpreadDeg: 0.55,
  moveSpreadDeg: 1.3,
  airSpreadDeg: 2.2,
  bloomPerShotDeg: 0.16,
  bloomMaxDeg: 2.4,
  recoilPitchDeg: 0.34,
  recoilYawDeg: 0.12,
  range: 250,
};

// bots
export const BOT = {
  height: 1.8,
  radius: 0.42,
  hp: 100,
  runSpeed: 4.3,
  engageSpeed: 2.0,
  damage: 13,
  rpm: 520,
  burstLen: [3, 6] as [number, number],
  reactTime: [0.25, 0.5] as [number, number],
  aimErrorDeg: 3.2,
  sightRange: 70,
  fovDeg: 150,
  loseSightTime: 2.5,
  respawnDelay: 3.0,
  spawnProtectTime: 1.5,
  count: [4, 5] as [number, number], // bots per team (player fills one alpha slot)
  separation: 1.1,
};

// match
export const MATCH = {
  killTarget: 40,
  roundTime: 300,
  countdown: 3,
};

// physics
export const PHYS = {
  fixedDt: 1 / 60,
  gravity: -9.81,
};

// waypoint validation
export const WP_MARGIN = 0.55;
