// ============================================================
// 故宫布局配置 —— 仅依据参考图的视觉证据（鸟瞰视角）推定的空间关系
// 坐标系：1单位=1米；北 = -Z，南 = +Z，东 = +X，西 = -X；地面 y=0
// ============================================================

export const CFG = {
  // 宫墙范围
  wall: { x: 376, z: 480, h: 10, t: 7 },
  moat: { w: 46 },

  // 中轴线主要建筑（自南而北）
  axis: [
    { id: 'wumen',    name: '午门',     z: 398,  gate: true  },
    { id: 'jinshuiqiao', name: '内金水桥', z: 338, bridge: true },
    { id: 'taihemen', name: '太和门',   z: 222  },
    { id: 'santai',   name: '三层白玉石台基', z: 100 },
    { id: 'taihedian',name: '太和殿',   z: 95   },
    { id: 'zhonghedian', name: '中和殿', z: 6    },
    { id: 'baohedian',name: '保和殿',   z: -72  },
    { id: 'qianqingmen', name: '乾清门', z: -138 },
    { id: 'qianqinggong', name: '乾清宫', z: -186 },
    { id: 'jiaotaidian', name: '交泰殿',  z: -236 },
    { id: 'kunninggong', name: '坤宁宫',  z: -286 },
    { id: 'yuhuayuan', name: '御花园',   z: -392 },
    { id: 'shenwumen', name: '神武门',   z: -466, gate: true },
  ],

  // 角楼（四角）
  corners: [
    { x:  376, z:  480 }, { x: -376, z:  480 },
    { x:  376, z: -480 }, { x: -376, z: -480 },
  ],

  // 东西六宫（小院落群）
  sideCourts: [
    // 东六宫
    { x: 150, z: -150 }, { x: 232, z: -150 },
    { x: 150, z: -216 }, { x: 232, z: -216 },
    { x: 150, z: -282 }, { x: 232, z: -282 },
    // 西六宫
    { x: -150, z: -150 }, { x: -232, z: -150 },
    { x: -150, z: -216 }, { x: -232, z: -216 },
    { x: -150, z: -282 }, { x: -232, z: -282 },
  ],

  // 文华殿 / 武英殿
  sideHalls: [
    { x: 236, z: 96,  name: '文华殿' },
    { x: -236, z: 64, name: '武英殿' },
  ],

  // 初始相机：午门南侧上空约50米，俯瞰中轴线
  cam: { x: 0, y: 55, z: 560, tx: 0, ty: 16, tz: -80 },
};

// 全局调色板（夜色基调）
export const PAL = {
  gold:      0xffc76a,
  goldHot:   0xffe9b0,
  roofDark:  0x4a4030,   // 琉璃瓦夜色
  roofDark2: 0x37301f,
  wallRed:   0x7c2d1f,
  wallRedD:  0x5c2117,
  columnRed: 0x93352a,
  marble:    0xb9b1a1,
  marbleD:   0x8d867a,
  ground:    0x272c38,
  plaza:     0x3a3f4c,
  water:     0x0d1626,
  treeDark:  0x14241c,
  sky0:      0x05070f,   // 天顶
  sky1:      0x0d1830,   // 地平线
};
