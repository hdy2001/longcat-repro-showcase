// 全局配置
export const TEAM = { BLUE: 0, RED: 1 } as const;
export type TeamId = typeof TEAM[keyof typeof TEAM];

export const TEAM_INFO = [
  { name: '沙漠之狐', short: '蓝方', color: 0x3d7bd9, css: '#3d7bd9' },
  { name: '沙暴突击队', short: '红方', color: 0xd9483d, css: '#d9483d' },
];

export const CFG = {
  // 玩家
  playerHP: 100,
  eyeHeight: 0.72,
  radius: 0.35,
  walkSpeed: 4.6,
  sprintSpeed: 6.8,
  adsSpeed: 2.6,
  jumpVel: 5.2,
  gravity: 15,
  playerDamage: 26,
  playerHeadMul: 2.2,
  playerHeadY: 1.45,
  respawnTime: 4,

  // 机器人
  botHP: 100,
  botSpeed: 5.0,
  botDamage: 9,
  botHeadY: 1.45,
  botRespawn: 5,
  botAimError: 0.085,      // 弧度
  botReaction: 0.45,       // 秒
  botBurst: [3, 6] as [number, number],
  botFireInterval: 0.09,
  botBurstPause: [0.35, 0.8] as [number, number],
  botSightRange: 75,
  botFov: Math.PI * 1.15,

  // 武器
  fireInterval: 0.1,       // 600 RPM
  magSize: 30,
  reserve: 120,
  reloadTime: 1.8,
  spreadBase: 0.011,
  spreadMove: 0.02,
  spreadAds: 0.003,
  recoil: 0.011,
  range: 120,

  // 比赛
  killTarget: 35,
  matchTime: 300,

  // 物理
  worldGravity: -15,
};
