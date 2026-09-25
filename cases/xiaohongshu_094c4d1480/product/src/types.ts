// ============================================================
// 共享类型
// ============================================================

export type TeamId = 'T' | 'CT';

export interface DamageEvent {
  amount: number;
  from: TeamId;
  attackerName: string;
  victimName: string;
  killed: boolean;
}

export interface KillfeedEntry {
  id: number;
  killer: string;
  killerTeam: TeamId;
  victim: string;
  victimTeam: TeamId;
  weapon: string;
  time: number;
}

/** 机器人感知到的敌人信息 */
export interface EnemyInfo {
  x: number; y: number; z: number;
  vx: number; vz: number;
  visible: boolean;
  lastSeen: number; // 时间戳
}

export const TEAM_NAME: Record<TeamId, string> = { T: '蓝军', CT: '红军' };
export const TEAM_COLOR: Record<TeamId, string> = { T: '#5aa2e8', CT: '#e85a4a' };
