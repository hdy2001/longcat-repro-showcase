(function () {
    'use strict';
    // ---------------------------------------------------------- 错误收集
    const __errors = [];
    window.__errors = __errors;
    window.addEventListener('error', (e) => __errors.push(String(e.message || e)));
    window.addEventListener('unhandledrejection', (e) => __errors.push('promise: ' + String(e.reason)));
    // ---------------------------------------------------------- 常量
    const GRAVITY = -24;
    const PLAYER_SPEED = 5.4;
    const BOT_SPEED = 4.3;
    const EYE_PLAYER = 1.62;
    const EYE_BOT = 1.5;
    const CAPSULE_HH = 0.6; // 半高
    const CAPSULE_R = 0.35; // 半径
    const EYE_OFFSET = 0.95; // 脚底到胶囊中心
    const MAG_SIZE = 30;
    const MAG_RESERVE = 120;
    const FIRE_INTERVAL = 112; // ms
    const RELOAD_TIME = 1600; // ms
    const BOT_RELOAD_TIME = 1700;
    const RESPAWN_TIME = 3000;
    const SCORE_TARGET = 25;
    const BOT_HP = 100;
    const PLAYER_HP = 100;
    // ---------------------------------------------------------- 工具
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
    function angleLerp(a, b, t) {
        let d = (b - a) % (Math.PI * 2);
        if (d > Math.PI)
            d -= Math.PI * 2;
        if (d < -Math.PI)
            d += Math.PI * 2;
        return a + d * t;
    }
    const boxes = [];
    const WALL_T = 0.4;
    function runX(z, x1, x2, h, tex, gaps = []) {
        let cur = x1;
        const gs = gaps.slice().sort((p, q) => p.a - q.a);
        for (const g of gs) {
            if (g.a > cur) {
                const b = g.a;
                boxes.push({ x: (cur + b) / 2, y: h / 2, z, w: b - cur, h, d: WALL_T, tex, collide: true, shadow: true });
            }
            cur = Math.max(cur, g.b);
            if (g.gh < h)
                boxes.push({ x: (g.a + g.b) / 2, y: (g.gh + h) / 2, z, w: g.b - g.a, h: h - g.gh, d: WALL_T, tex, collide: true, shadow: true });
        }
        if (cur < x2)
            boxes.push({ x: (cur + x2) / 2, y: h / 2, z, w: x2 - cur, h, d: WALL_T, tex, collide: true, shadow: true });
    }
    function runZ(x, z1, z2, h, tex, gaps = []) {
        let cur = z1;
        const gs = gaps.slice().sort((p, q) => p.a - q.a);
        for (const g of gs) {
            if (g.a > cur) {
                const b = g.a;
                boxes.push({ x, y: h / 2, z: (cur + b) / 2, w: WALL_T, h, d: b - cur, tex, collide: true, shadow: true });
            }
            cur = Math.max(cur, g.b);
            if (g.gh < h)
                boxes.push({ x, y: (g.gh + h) / 2, z: (g.a + g.b) / 2, w: WALL_T, h: h - g.gh, d: g.b - g.a, tex, collide: true, shadow: true });
        }
        if (cur < z2)
            boxes.push({ x, y: h / 2, z: (cur + z2) / 2, w: WALL_T, h, d: z2 - cur, tex, collide: true, shadow: true });
    }
    function addBox(x, y, z, w, h, d, tex, topTex, shadow = true) {
        boxes.push({ x, y, z, w, h, d, tex, topTex, collide: true, shadow });
    }
    // 台阶楼梯: 从 (x1,z1) 向 +dir 上升
    function stairsX(x1, x2, z1, z2, rise, steps, dir, tex) {
        for (let i = 0; i < steps; i++) {
            const top = rise * (i + 1) / steps;
            const cx = x1 + dir * (x2 - x1) * (i + 0.5) / steps;
            addBox(cx, top / 2, (z1 + z2) / 2, Math.abs(x2 - x1) / steps + 0.06, top, Math.abs(z2 - z1), tex);
        }
    }
    function stairsZ(z1, z2, x1, x2, rise, steps, dir, tex) {
        for (let i = 0; i < steps; i++) {
            const top = rise * (i + 1) / steps;
            const cz = z1 + dir * (z2 - z1) * (i + 0.5) / steps;
            addBox((x1 + x2) / 2, top / 2, cz, Math.abs(x2 - x1), top, Math.abs(z2 - z1) / steps + 0.06, tex);
        }
    }
    const boxStairMat = new THREE.MeshStandardMaterial({ color: 0xb08a4e, roughness: 0.95 });
    function crate(x, z, y = 0, s = 1.15, ry = 0) {
        if (ry !== 0) { /* 旋转箱子仅视觉, 碰撞仍按轴对齐 */
            addBox(x, y + s / 2, z, s, s, s, 'crate', undefined, true);
            return;
        }
        addBox(x, y + s / 2, z, s, s, s, 'crate', undefined, true);
    }
    function sandbags(x, z, w) { addBox(x, 0.55, z, w, 1.1, 1.0, 'sandbag'); }
    function rock(x, z, s) { addBox(x, s * 0.55, z, s * 1.5, s * 1.1, s * 1.5, 'rock'); }
    function buildMap() {
        // ---- 外围墙 ----
        runX(44, -56, 56, 5, 'stone');
        runX(-44, -56, 56, 5, 'stone');
        runZ(-56, -44, 44, 5, 'stone');
        runZ(56, -44, 44, 5, 'stone');
        // ---- 蓝方基地(南) 北墙: 大门+两翼门 ----
        runX(26, -51, 51, 4, 'stone', [
            { a: -4, b: 4, gh: 3.2 }, { a: -38, b: -34, gh: 3.2 }, { a: 34, b: 38, gh: 3.2 },
        ]);
        runZ(-51, 26, 44, 4, 'stone');
        runZ(51, 26, 44, 4, 'stone');
        // ---- 红方基地(北) 南墙 ----
        runX(-26, -51, 51, 4, 'stone', [
            { a: -4, b: 4, gh: 3.2 }, { a: -38, b: -34, gh: 3.2 }, { a: 34, b: 38, gh: 3.2 },
        ]);
        runZ(-51, -44, -26, 4, 'stone');
        runZ(51, -44, -26, 4, 'stone');
        // ---- 中路(中央建筑两侧) ----
        runZ(-8, -16, 26, 4, 'stone', [{ a: 13, b: 17, gh: 3.2 }]); // 西路(A短道门)
        runZ(8, -16, 26, 4, 'stone', [{ a: 13, b: 17, gh: 3.2 }]); // 东路(B短道门)
        // ---- A区(西) 围墙 ----
        runX(-16, -46, -16, 4, 'stone', [{ a: -28, b: -22, gh: 3.2 }]); // 北门(接大路)
        runZ(-46, -16, 20, 4, 'stone', [{ a: -10, b: -4, gh: 3.2 }, { a: 6, b: 12, gh: 3.2 }]); // 西门×2(接长廊)
        runZ(-16, -16, 26, 4, 'stone', [{ a: 13, b: 17, gh: 3.2 }]); // 东门(A短道)
        runX(20, -46, -16, 4, 'stone'); // 南墙
        // ---- B区(东) 围墙 ----
        runX(-16, 16, 46, 4, 'stone', [{ a: 22, b: 28, gh: 3.2 }]);
        runZ(46, -16, 20, 4, 'stone', [{ a: -10, b: -4, gh: 3.2 }, { a: 6, b: 12, gh: 3.2 }]);
        runZ(16, -16, 26, 4, 'stone', [{ a: 13, b: 17, gh: 3.2 }]);
        runX(20, 16, 46, 4, 'stone');
        // ---- A/B 短道(连接中路与A/B区) ----
        runX(18, -16, -8, 4, 'stone'); // A短道北墙
        runX(12, -16, -8, 4, 'stone'); // A短道南墙
        runX(20, -16, -8, 4, 'stone'); // 封南口袋
        runX(18, 8, 16, 4, 'stone'); // B短道北墙
        runX(12, 8, 16, 4, 'stone'); // B短道南墙
        runX(20, 8, 16, 4, 'stone');
        // ---- 长廊(西) x∈[-56,-51] ----
        runZ(-51, -16, 26, 4, 'stone', [{ a: -10, b: -4, gh: 3.2 }, { a: 6, b: 12, gh: 3.2 }]); // 东墙(两门)
        // ---- 长廊(东) x∈[46,51] ----
        runZ(46, -16, 26, 4, 'stone', [{ a: -10, b: -4, gh: 3.2 }, { a: 6, b: 12, gh: 3.2 }]);
        runZ(51, -16, 22, 4, 'stone'); // 东长廊东墙(封条)
        // ---- 南广场(长廊→基地) ----
        runX(22, -46, -34, 4, 'stone'); // 西广场北墙
        runZ(-34, 22, 26, 4, 'stone'); // 西广场东墙
        runX(22, 34, 46, 4, 'stone'); // 东广场北墙
        runX(22, 51, 56, 4, 'stone');
        runZ(34, 22, 26, 4, 'stone'); // 东广场西墙
        // ---- 中央建筑(隧道穿堂 + 屋顶) ----
        runX(7, -6, 6, 4.5, 'stone', [{ a: -2.5, b: 2.5, gh: 3.6 }]); // 南墙+隧道口
        runX(-7, -6, 6, 4.5, 'stone', [{ a: -2.5, b: 2.5, gh: 3.6 }]); // 北墙+隧道口
        runZ(-6, -7, 7, 4.5, 'stone');
        runZ(6, -7, 7, 4.5, 'stone');
        addBox(0, 3.8, 0, 12, 0.4, 14, 'metal', 'metal'); // 屋顶板
        // 屋顶矮墙(留楼梯口)
        addBox(-4, 4.25, 7, 4, 0.5, 0.24, 'stone');
        addBox(4, 4.25, 7, 4, 0.5, 0.24, 'stone');
        addBox(-4, 4.25, -7, 4, 0.5, 0.24, 'stone');
        addBox(4, 4.25, -7, 4, 0.5, 0.24, 'stone');
        addBox(6, 4.25, 0, 0.24, 0.5, 14, 'stone');
        addBox(-6, 4.25, 0, 0.24, 0.5, 14, 'stone');
        // 中央楼梯(南/北面上屋顶)
        stairsZ(11.8, 7.0, -2, 2, 3.6, 16, -1, 'stair');
        stairsZ(-11.8, -7.0, -2, 2, 3.6, 16, 1, 'stair');
        // ---- A区平台(0.9高) ----
        addBox(-30, 0.45, 2, 20, 0.9, 28, 'stone', 'platA');
        stairsX(-16, -20, 13, 17, 0.9, 4, -1, 'stair'); // 东梯(A短道门→平台)
        stairsX(-46, -40, 7, 11, 0.9, 4, 1, 'stair'); // 西梯(长廊→平台)
        stairsZ(-16, -12, -27, -23, 0.9, 4, 1, 'stair'); // 北梯(大路门→平台)
        // ---- B区平台 ----
        addBox(30, 0.45, 2, 20, 0.9, 28, 'stone', 'platB');
        stairsX(16, 20, 13, 17, 0.9, 4, 1, 'stair');
        stairsX(46, 40, 7, 11, 0.9, 4, -1, 'stair');
        stairsZ(-16, -12, 23, 27, 0.9, 4, 1, 'stair');
        // ---- 掩体: 木箱 ----
        crate(-20, 34);
        crate(-21.3, 34.3, 1.15);
        crate(20, 34);
        crate(21.3, 34.3, 1.15); // 蓝基地
        crate(-36, 33);
        crate(36, 33);
        crate(-20, -34);
        crate(-21.3, -34.3, 1.15);
        crate(20, -34);
        crate(21.3, -34.3, 1.15); // 红基地
        crate(-36, -33);
        crate(36, -33);
        crate(4.5, 18);
        crate(-4.5, -18); // 中路
        crate(-30, -21);
        crate(30, -21);
        crate(-15, -21);
        crate(15, -21); // 南北大路
        crate(-32, 2);
        crate(-33.2, 2.3, 1.15);
        crate(-26, 10);
        crate(-35, -6); // A区
        crate(32, 2);
        crate(33.2, 2.3, 1.15);
        crate(26, 10);
        crate(35, -6); // B区
        crate(-53.5, 18);
        crate(53.5, 18); // 长廊
        // ---- 掩体: 沙袋 ----
        sandbags(15, 32, 4);
        sandbags(-15, 32, 4);
        sandbags(15, -32, 4);
        sandbags(-15, -32, 4);
        sandbags(-4.5, -23, 4);
        sandbags(4.5, 23, 4);
        sandbags(0, -21, 5);
        sandbags(-24, -8, 3);
        sandbags(24, -8, 3);
        // ---- 岩石 ----
        rock(-4.5, 13, 1.5);
        rock(4, -11, 1.6);
    }
    // 小地图区域
    const ZONES = [
        { x1: -46, z1: -16, x2: -16, z2: 20, label: 'A', color: 'rgba(255,90,70,0.16)' },
        { x1: 16, z1: -16, x2: 46, z2: 20, label: 'B', color: 'rgba(255,90,70,0.16)' },
        { x1: -8, z1: -16, x2: 8, z2: 26, label: '中', color: 'rgba(255,200,90,0.10)' },
        { x1: -56, z1: -16, x2: -51, z2: 22, label: '廊', color: 'rgba(255,255,255,0.06)' },
        { x1: 46, z1: -16, x2: 51, z2: 22, label: '廊', color: 'rgba(255,255,255,0.06)' },
        { x1: -51, z1: 26, x2: 51, z2: 44, label: '', color: 'rgba(80,160,255,0.08)' },
        { x1: -51, z1: -44, x2: 51, z2: -26, label: '', color: 'rgba(255,80,60,0.08)' },
        { x1: -51, z1: -26, x2: 51, z2: -16, label: '', color: 'rgba(255,255,255,0.05)' },
    ];
    // ---- 机器人路点图 ----
    const wpList = [];
    function wp(x, y, z) { wpList.push({ x, y, z }); return wpList.length - 1; }
    const edges = [];
    function edge(a, b) { edges.push([a, b]); edges.push([b, a]); }
    const WP = {
        b_spawn: wp(0, 0, 38), b_gate: wp(0, 0, 25),
        wp1: wp(-42, 0, 24), wp2: wp(-53.5, 0, 21), wp3: wp(-53.5, 0, 9), wp4: wp(-53.5, 0, -13),
        anw: wp(-48.5, 0, -19),
        c_gate: wp(-52, 0, 9), a_wg: wp(-48, 0, 9), a_w1: wp(-43, 0, 9),
        a_ws0: wp(-45.3, 0, 9), a_ws1: wp(-40.5, 0.9, 9), a_wplat: wp(-38, 0.9, 9),
        xw_w: wp(-30, 0, -21), xc: wp(0, 0, -21), xe_e: wp(30, 0, -21),
        a_ng: wp(-25, 0, -17.5), a_nring: wp(-25, 0, -14), a_ns0: wp(-25, 0, -15.3), a_ns1: wp(-25, 0.9, -12.7), a_nplat: wp(-25, 0.9, -10),
        a_e0: wp(-17.5, 0, 15), a_es0: wp(-16.5, 0, 15), a_es1: wp(-19.5, 0.9, 15), a_eplat: wp(-22, 0.9, 15),
        a_center: wp(-30, 0.9, 2),
        mw_d: wp(-7, 0, 15), as_w: wp(-12, 0, 15),
        mid_s: wp(0, 0, 20), tun_s: wp(0, 0, 12), tun_m: wp(0, 0, 0), tun_n: wp(0, 0, -12), mid_n: wp(0, 0, -14),
        rs_sb: wp(0, 0, 11.5), rs_st: wp(0, 3.6, 7.4), roof_c: wp(0, 3.6, 0), rs_nt: wp(0, 3.6, -7.4), rs_nb: wp(0, 0, -11.5),
        me_d: wp(7, 0, 15), bs_w: wp(12, 0, 15),
        b_e0: wp(17.5, 0, 15), b_es0: wp(16.5, 0, 15), b_es1: wp(19.5, 0.9, 15), b_eplat: wp(22, 0.9, 15),
        b_center: wp(30, 0.9, 2),
        b_wplat: wp(38, 0.9, 9), b_ws1: wp(40.5, 0.9, 9), b_ws0: wp(45.3, 0, 9), b_w1: wp(43, 0, 9),
        b_wg: wp(48, 0, 9), e_gate: wp(52, 0, 9), ep3: wp(53.5, 0, 9), ep2: wp(53.5, 0, 21), ep1: wp(42, 0, 24), ep4: wp(53.5, 0, -13),
        aen: wp(48.5, 0, -19),
        b_ng: wp(25, 0, -17.5), b_nring: wp(25, 0, -14), b_ns0: wp(25, 0, -15.3), b_ns1: wp(25, 0.9, -12.7), b_nplat: wp(25, 0.9, -10),
        rw_g: wp(-36, 0, -24), rw_in: wp(-36, 0, -31),
        r_g: wp(0, 0, -24), re_g: wp(36, 0, -24), re_in: wp(36, 0, -31), r_spawn: wp(0, 0, -38),
    };
    function buildGraph() {
        edge(WP.b_spawn, WP.b_gate);
        edge(WP.b_gate, WP.wp1);
        edge(WP.b_gate, WP.ep1);
        edge(WP.b_gate, WP.mid_s);
        edge(WP.wp1, WP.wp2);
        edge(WP.wp2, WP.wp3);
        edge(WP.wp3, WP.wp4);
        edge(WP.wp4, WP.anw);
        edge(WP.anw, WP.xw_w);
        edge(WP.wp3, WP.c_gate);
        edge(WP.c_gate, WP.a_wg);
        edge(WP.a_wg, WP.a_w1);
        edge(WP.a_w1, WP.a_ws0);
        edge(WP.a_ws0, WP.a_ws1);
        edge(WP.a_ws1, WP.a_wplat);
        edge(WP.a_wplat, WP.a_center);
        edge(WP.a_center, WP.a_nplat);
        edge(WP.a_center, WP.a_eplat);
        edge(WP.a_nplat, WP.a_ns1);
        edge(WP.a_ns1, WP.a_ns0);
        edge(WP.a_ns0, WP.a_nring);
        edge(WP.a_nring, WP.a_ng);
        edge(WP.a_ng, WP.xw_w);
        edge(WP.a_eplat, WP.a_es1);
        edge(WP.a_es1, WP.a_es0);
        edge(WP.a_es0, WP.a_e0);
        edge(WP.a_e0, WP.as_w);
        edge(WP.as_w, WP.mw_d);
        edge(WP.mw_d, WP.mid_s);
        edge(WP.mid_s, WP.tun_s);
        edge(WP.tun_s, WP.tun_m);
        edge(WP.tun_m, WP.tun_n);
        edge(WP.tun_n, WP.mid_n);
        edge(WP.mid_n, WP.xc);
        edge(WP.xc, WP.xw_w);
        edge(WP.xc, WP.xe_e);
        edge(WP.tun_s, WP.rs_sb);
        edge(WP.rs_sb, WP.rs_st);
        edge(WP.rs_st, WP.roof_c);
        edge(WP.roof_c, WP.rs_nt);
        edge(WP.rs_nt, WP.rs_nb);
        edge(WP.rs_nb, WP.tun_n);
        edge(WP.mid_s, WP.me_d);
        edge(WP.me_d, WP.bs_w);
        edge(WP.bs_w, WP.b_e0);
        edge(WP.b_e0, WP.b_es0);
        edge(WP.b_es0, WP.b_es1);
        edge(WP.b_es1, WP.b_eplat);
        edge(WP.b_eplat, WP.b_center);
        edge(WP.b_center, WP.b_wplat);
        edge(WP.b_center, WP.b_nplat);
        edge(WP.b_wplat, WP.b_ws1);
        edge(WP.b_ws1, WP.b_ws0);
        edge(WP.b_ws0, WP.b_w1);
        edge(WP.b_w1, WP.b_wg);
        edge(WP.b_wg, WP.e_gate);
        edge(WP.e_gate, WP.ep3);
        edge(WP.ep3, WP.ep2);
        edge(WP.ep2, WP.ep1);
        edge(WP.ep2, WP.ep4);
        edge(WP.ep4, WP.aen);
        edge(WP.aen, WP.xe_e);
        edge(WP.xe_e, WP.b_ng);
        edge(WP.b_ng, WP.b_nring);
        edge(WP.b_nring, WP.b_ns0);
        edge(WP.b_ns0, WP.b_ns1);
        edge(WP.b_ns1, WP.b_nplat);
        edge(WP.rw_g, WP.xw_w);
        edge(WP.rw_g, WP.rw_in);
        edge(WP.rw_in, WP.r_spawn);
        edge(WP.re_g, WP.xe_e);
        edge(WP.re_g, WP.re_in);
        edge(WP.re_in, WP.r_spawn);
        edge(WP.r_g, WP.xc);
        edge(WP.r_g, WP.r_spawn);
    }
    const adj = [];
    function buildAdj() {
        for (let i = 0; i < wpList.length; i++)
            adj.push([]);
        for (const [a, b] of edges)
            adj[a].push(b);
    }
    function findPath(from, to) {
        if (from === to)
            return [from];
        const prev = new Int32Array(wpList.length).fill(-1);
        const q = [from];
        prev[from] = from;
        let head = 0;
        while (head < q.length) {
            const cur = q[head++];
            for (const nb of adj[cur]) {
                if (prev[nb] === -1) {
                    prev[nb] = cur;
                    if (nb === to) {
                        const path = [to];
                        let p = to;
                        while (p !== from) {
                            p = prev[p];
                            path.push(p);
                        }
                        path.reverse();
                        return path;
                    }
                    q.push(nb);
                }
            }
        }
        return [from];
    }
    // ============================================================
    // Web Audio 程序化音效
    // ============================================================
    class AudioEngine {
        constructor() {
            this.ctx = null;
            this.master = null;
            this.noiseBuf = null;
            this.windOn = false;
        }
        init() {
            if (this.ctx)
                return;
            const AC = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.55;
            this.master.connect(this.ctx.destination);
            const len = this.ctx.sampleRate * 2;
            this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const d = this.noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++)
                d[i] = Math.random() * 2 - 1;
            this.startWind();
        }
        resume() { if (this.ctx && this.ctx.state === 'suspended')
            this.ctx.resume(); }
        startWind() {
            if (!this.ctx || this.windOn)
                return;
            this.windOn = true;
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuf;
            src.loop = true;
            const f = this.ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = 320;
            f.Q.value = 0.6;
            const g = this.ctx.createGain();
            g.gain.value = 0.05;
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 0.13;
            const lfoG = this.ctx.createGain();
            lfoG.gain.value = 0.025;
            lfo.connect(lfoG);
            lfoG.connect(g.gain);
            src.connect(f);
            f.connect(g);
            g.connect(this.master);
            src.start();
            lfo.start();
        }
        noise(dur, vol, freq, type, pan = 0) {
            if (!this.ctx || !this.master || !this.noiseBuf)
                return;
            const t = this.ctx.currentTime;
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuf;
            src.playbackRate.value = rand(0.9, 1.1);
            const f = this.ctx.createBiquadFilter();
            f.type = type;
            f.frequency.value = freq;
            f.Q.value = 0.8;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
            src.connect(f);
            f.connect(g);
            if (p) {
                p.pan.value = pan;
                g.connect(p);
                p.connect(this.master);
            }
            else
                g.connect(this.master);
            src.start(t);
            src.stop(t + dur + 0.05);
        }
        tone(freq, dur, vol, type, slideTo = 0, pan = 0, delay = 0) {
            if (!this.ctx || !this.master)
                return;
            const t = this.ctx.currentTime + delay;
            const o = this.ctx.createOscillator();
            o.type = type;
            o.frequency.setValueAtTime(freq, t);
            if (slideTo > 0)
                o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
            o.connect(g);
            if (p) {
                p.pan.value = pan;
                g.connect(p);
                p.connect(this.master);
            }
            else
                g.connect(this.master);
            o.start(t);
            o.stop(t + dur + 0.05);
        }
        shot(vol = 1, pan = 0) {
            this.noise(0.16, 0.85 * vol, 1700, 'lowpass', pan);
            this.tone(160, 0.09, 0.4 * vol, 'square', 60, pan);
        }
        distantShot(dist, pan) {
            const v = clamp(1 - dist / 75, 0, 1) * 0.5;
            if (v < 0.03)
                return;
            this.noise(0.2, v, 620, 'lowpass', pan);
        }
        reload() {
            this.tone(1900, 0.035, 0.25, 'square');
            this.tone(1400, 0.035, 0.22, 'square', 0, 0, 0.55);
            this.tone(1700, 0.035, 0.22, 'square', 0, 0, 1.1);
            this.tone(2100, 0.04, 0.28, 'square', 0, 0, 1.5);
        }
        empty() { this.tone(2400, 0.03, 0.2, 'square'); }
        hit() { this.tone(1350, 0.05, 0.3, 'sine', 900); }
        kill() { this.tone(620, 0.09, 0.3, 'triangle'); this.tone(930, 0.14, 0.3, 'triangle', 0, 0, 0.08); }
        hurt() { this.noise(0.18, 0.5, 300, 'lowpass'); this.tone(110, 0.15, 0.35, 'sine', 55); }
        step() { this.noise(0.055, 0.14, 480, 'lowpass'); }
        die() { this.noise(0.4, 0.5, 500, 'lowpass'); this.tone(220, 0.5, 0.3, 'sawtooth', 40); }
        respawn() { this.tone(520, 0.1, 0.25, 'sine', 780); }
    }
    // ============================================================
    // 程序化纹理
    // ============================================================
    function makeCanvas(s) {
        const c = document.createElement('canvas');
        c.width = c.height = s;
        return [c, c.getContext('2d')];
    }
    function noiseOn(ctx, s, n, alpha, dark) {
        for (let i = 0; i < n; i++) {
            const v = Math.random();
            ctx.fillStyle = dark ? `rgba(60,40,15,${alpha * v})` : `rgba(255,240,210,${alpha * v})`;
            ctx.fillRect(Math.random() * s, Math.random() * s, rand(1, 3), rand(1, 3));
        }
    }
    function texSand() {
        const [c, x] = makeCanvas(256);
        x.fillStyle = '#d3ac6d';
        x.fillRect(0, 0, 256, 256);
        noiseOn(x, 256, 2600, 0.10, true);
        noiseOn(x, 256, 1800, 0.10, false);
        for (let i = 0; i < 12; i++) {
            x.fillStyle = `rgba(150,115,60,${rand(0.04, 0.09)})`;
            x.beginPath();
            x.ellipse(Math.random() * 256, Math.random() * 256, rand(20, 70), rand(12, 40), rand(0, 3), 0, 7);
            x.fill();
        }
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }
    function texStone() {
        const [c, x] = makeCanvas(256);
        x.fillStyle = '#bd9250';
        x.fillRect(0, 0, 256, 256);
        const rows = 4, bh = 256 / rows;
        for (let r = 0; r < rows; r++) {
            let px = -(r % 2) * 40;
            while (px < 256) {
                const bw = rand(70, 120);
                const l = rand(-14, 14);
                x.fillStyle = `rgb(${189 + l},${146 + l},${80 + l})`;
                x.fillRect(px + 2, r * bh + 2, bw - 4, bh - 4);
                noiseOn(x, 256, 300, 0.12, true);
                px += bw;
            }
        }
        x.strokeStyle = 'rgba(70,50,25,0.85)';
        x.lineWidth = 3;
        for (let r = 0; r <= rows; r++) {
            x.beginPath();
            x.moveTo(0, r * bh);
            x.lineTo(256, r * bh);
            x.stroke();
        }
        noiseOn(x, 256, 1500, 0.08, false);
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }
    function texCrate() {
        const [c, x] = makeCanvas(128);
        x.fillStyle = '#9a7443';
        x.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 4; i++) {
            x.fillStyle = `rgb(${154 + randInt(-12, 12)},${116 + randInt(-10, 10)},${67 + randInt(-8, 8)})`;
            x.fillRect(4, i * 32 + 3, 120, 26);
            x.fillStyle = 'rgba(60,40,18,0.8)';
            x.fillRect(4, i * 32 + 1, 120, 3);
        }
        x.strokeStyle = '#5e4225';
        x.lineWidth = 8;
        x.strokeRect(4, 4, 120, 120);
        x.strokeStyle = 'rgba(94,66,37,0.9)';
        x.lineWidth = 5;
        x.beginPath();
        x.moveTo(4, 4);
        x.lineTo(124, 124);
        x.moveTo(124, 4);
        x.lineTo(4, 124);
        x.stroke();
        x.fillStyle = 'rgba(240,225,190,0.55)';
        x.font = 'bold 26px monospace';
        x.textAlign = 'center';
        x.fillText('7.62', 64, 70);
        noiseOn(x, 128, 500, 0.12, true);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }
    function texSandbag() {
        const [c, x] = makeCanvas(128);
        x.fillStyle = '#a8915c';
        x.fillRect(0, 0, 128, 128);
        for (let r = 0; r < 3; r++)
            for (let i = 0; i < 4; i++) {
                const bx = i * 34 + (r % 2) * 15, by = r * 44 + 6;
                x.fillStyle = `rgb(${168 + randInt(-14, 10)},${145 + randInt(-12, 8)},${92 + randInt(-10, 8)})`;
                x.beginPath();
                x.ellipse(bx + 15, by + 14, 17, 13, 0, 0, 7);
                x.fill();
                x.strokeStyle = 'rgba(70,55,30,0.6)';
                x.lineWidth = 2;
                x.stroke();
            }
        noiseOn(x, 128, 400, 0.1, true);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }
    function texMetal() {
        const [c, x] = makeCanvas(128);
        x.fillStyle = '#7e8890';
        x.fillRect(0, 0, 128, 128);
        x.strokeStyle = 'rgba(40,48,54,0.8)';
        x.lineWidth = 3;
        x.strokeRect(6, 6, 116, 116);
        x.beginPath();
        x.moveTo(6, 64);
        x.lineTo(122, 64);
        x.stroke();
        x.fillStyle = 'rgba(35,40,45,0.9)';
        for (const [rx, ry] of [[16, 16], [112, 16], [16, 112], [112, 112], [64, 16], [64, 112], [16, 64], [112, 64]]) {
            x.beginPath();
            x.arc(rx, ry, 4, 0, 7);
            x.fill();
        }
        noiseOn(x, 128, 700, 0.14, true);
        noiseOn(x, 128, 300, 0.1, false);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }
    function texPlatform(letter) {
        const [c, x] = makeCanvas(256);
        x.fillStyle = '#c2a878';
        x.fillRect(0, 0, 256, 256);
        noiseOn(x, 256, 2000, 0.1, true);
        noiseOn(x, 256, 1200, 0.08, false);
        x.strokeStyle = 'rgba(250,240,220,0.9)';
        x.lineWidth = 10;
        x.beginPath();
        x.arc(128, 128, 92, 0, 7);
        x.stroke();
        x.fillStyle = 'rgba(250,240,220,0.9)';
        x.font = 'bold 130px monospace';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(letter, 128, 136);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }
    function texRock() {
        const [c, x] = makeCanvas(128);
        x.fillStyle = '#8d7a5c';
        x.fillRect(0, 0, 128, 128);
        noiseOn(x, 128, 1600, 0.2, true);
        noiseOn(x, 128, 700, 0.12, false);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }
    function texFlash() {
        const [c, x] = makeCanvas(64);
        const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
        g.addColorStop(0, 'rgba(255,255,230,1)');
        g.addColorStop(0.3, 'rgba(255,200,90,0.9)');
        g.addColorStop(1, 'rgba(255,120,20,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, 64, 64);
        x.strokeStyle = 'rgba(255,230,150,0.95)';
        x.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 4 + 0.4;
            x.beginPath();
            x.moveTo(32, 32);
            x.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30);
            x.stroke();
        }
        const t = new THREE.CanvasTexture(c);
        return t;
    }
    // ============================================================
    // 全局状态
    // ============================================================
    let renderer, scene, camera, world, charCtrl;
    let audio = new AudioEngine();
    const charByCollider = new Map();
    let player = null;
    const bots = [];
    const tracers = [];
    const sparks = [];
    const keys = {};
    let gameState = 'menu';
    let scores = [0, 0];
    let firing = false;
    let mouseDX = 0, mouseDY = 0;
    let bobPhase = 0, bobAmp = 0;
    let gunKick = 0, recoilPitch = 0;
    let muzzleLight = null;
    let flashSprite = null;
    let lastShotAt = 0;
    let reloading = false, reloadEnd = 0;
    let hitmarkUntil = 0, hitmarkKill = false;
    let vignetteUntil = 0, vignetteMax = 0;
    let deathAt = 0;
    let lastStepAt = 0;
    let spawnProtect = 0;
    const clock = { last: 0, acc: 0 };
    // ============================================================
    // 角色
    // ============================================================
    class Character {
        constructor(team, isPlayer, name, x, z, yaw) {
            this.vy = 0;
            this.grounded = false;
            this.hp = 100;
            this.alive = true;
            this.body = null;
            this.collider = null;
            this.yaw = 0;
            this.pitch = 0;
            this.ammo = MAG_SIZE;
            this.reserve = MAG_RESERVE;
            this.lastShotAt = 0;
            this.reloading = false;
            this.reloadEnd = 0;
            this.reloadDur = RELOAD_TIME;
            this.lastDamageAt = 0;
            this.kills = 0;
            this.deaths = 0;
            // bot AI
            this.aiState = 'move';
            this.path = [];
            this.pathIdx = 0;
            this.role = '';
            this.target = null;
            this.reactAt = 0;
            this.burstLeft = 0;
            this.nextBurstAt = 0;
            this.nextScanAt = 0;
            this.engageSince = 0;
            this.holdUntil = 0;
            this.scanPhase = 0;
            this.stuckT = 0;
            this.lastX = 0;
            this.lastZ = 0;
            this.repathAt = 0;
            this.group = null;
            this.hpBar = null;
            this.flashSprites = [];
            this.muzzleWorld = null;
            this.flashUntil = 0;
            this.deadUntil = 0;
            this.team = team;
            this.isPlayer = isPlayer;
            this.name = name;
            this.pos = new THREE.Vector3(x, 0, z);
            this.vel = new THREE.Vector3();
            this.yaw = yaw;
            if (!isPlayer)
                this.buildVisual();
        }
        eyeH() { return this.isPlayer ? EYE_PLAYER : EYE_BOT; }
        eyePos(out) { return out.set(this.pos.x, this.pos.y + this.eyeH(), this.pos.z); }
        forward(out) {
            const cp = Math.cos(this.pitch);
            return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
        }
        spawn(x, z, yaw) {
            if (this.collider)
                charByCollider.delete(this.collider.handle);
            if (this.body) {
                world.removeRigidBody(this.body);
            }
            this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, EYE_OFFSET, z));
            this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE_HH, CAPSULE_R), this.body);
            charByCollider.set(this.collider.handle, this);
            this.pos.set(x, 0, z);
            this.vel.set(0, 0, 0);
            this.vy = 0;
            this.yaw = yaw;
            this.pitch = 0;
            this.hp = this.isPlayer ? PLAYER_HP : BOT_HP;
            this.alive = true;
            this.ammo = MAG_SIZE;
            this.reserve = MAG_RESERVE;
            this.reloading = false;
            this.lastShotAt = 0;
            this.path = [];
            this.pathIdx = 0;
            this.target = null;
            this.aiState = 'move';
            if (this.group) {
                this.group.visible = true;
                this.group.position.copy(this.pos);
                this.group.rotation.set(0, this.yaw, 0);
            }
        }
        buildVisual() {
            const g = new THREE.Group();
            const teamCol = this.team === 0 ? 0x2e6fd8 : 0xc23b2a;
            const dark = 0x2c2c30;
            const skin = 0xc9a284;
            // 腿
            const legMat = new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.9 });
            const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.2), legMat);
            legL.position.set(-0.11, 0.31, 0);
            const legR = legL.clone();
            legR.position.x = 0.11;
            // 身体
            const torsoMat = new THREE.MeshStandardMaterial({ color: teamCol, roughness: 0.8 });
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.3), torsoMat);
            torso.position.y = 0.94;
            // 战术背心
            const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.34), new THREE.MeshStandardMaterial({ color: 0x3a3f35, roughness: 0.95 }));
            vest.position.y = 0.98;
            // 头 + 头盔
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }));
            head.position.y = 1.42;
            const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: this.team === 0 ? 0x274d85 : 0x7a2a1e, roughness: 0.7 }));
            helmet.position.y = 1.46;
            // 枪
            const gunMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.5, metalness: 0.6 });
            const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.78), gunMat);
            gun.position.set(0.2, 1.18, -0.3);
            // 手臂
            const armMat = new THREE.MeshStandardMaterial({ color: teamCol, roughness: 0.85 });
            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.42), armMat);
            armL.position.set(-0.26, 1.2, -0.2);
            armL.rotation.x = 0.2;
            const armR = armL.clone();
            armR.position.set(0.24, 1.14, -0.32);
            armR.rotation.x = -0.15;
            g.add(legL, legR, torso, vest, head, helmet, gun, armL, armR);
            g.traverse((o) => { if (o.isMesh) {
                o.castShadow = true;
            } });
            // 血条
            const bgS = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1a1a1a, depthTest: false }));
            bgS.scale.set(0.72, 0.09, 1);
            bgS.position.y = 1.86;
            const fgS = new THREE.Sprite(new THREE.SpriteMaterial({ color: this.team === 0 ? 0x4da3ff : 0xff5040, depthTest: false }));
            fgS.scale.set(0.66, 0.05, 1);
            fgS.position.y = 1.86;
            bgS.renderOrder = 90;
            fgS.renderOrder = 91;
            g.add(bgS, fgS);
            this.hpBar = fgS;
            // 枪口火光
            const fs = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
            fs.scale.set(0.5, 0.5, 1);
            fs.position.set(0.2, 1.18, -0.75);
            fs.visible = false;
            fs.renderOrder = 95;
            g.add(fs);
            this.flashSprites = [fs];
            this.group = g;
            scene.add(g);
        }
        muzzlePos(out) {
            const f = this.forward(new THREE.Vector3());
            out.set(this.pos.x + f.x * 0.55, this.pos.y + this.eyeH() - 0.28 + f.y * 0.55, this.pos.z + f.z * 0.55);
            return out;
        }
        damage(amount, attacker) {
            if (!this.alive || gameState !== 'playing')
                return;
            if (this.isPlayer && performance.now() < spawnProtect)
                return;
            this.hp -= amount;
            this.lastDamageAt = performance.now();
            if (attacker && attacker.isPlayer) {
                hitmarkUntil = performance.now() + 130;
                audio.hit();
            }
            if (this.isPlayer) {
                vignetteUntil = performance.now() + 320;
                vignetteMax = clamp(amount / 45, 0.25, 0.9);
                audio.hurt();
            }
            // 被打后机器人反击
            if (!this.isPlayer && attacker && this.alive && this.aiState !== 'engage') {
                this.target = attacker;
                this.aiState = 'engage';
                this.engageSince = performance.now();
                this.reactAt = performance.now() + rand(200, 400);
            }
            if (this.hp <= 0)
                this.die(attacker);
            if (this.group && this.hpBar)
                this.hpBar.scale.x = 0.66 * clamp(this.hp / 100, 0, 1);
        }
        die(attacker) {
            this.alive = false;
            this.deaths++;
            this.deadUntil = performance.now() + RESPAWN_TIME;
            if (this.group) {
                this.group.rotation.z = Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1);
                this.group.position.y = this.pos.y + 0.3;
            }
            if (attacker && attacker.team !== this.team) {
                attacker.kills++;
                scores[attacker.team]++;
                addKillfeed(attacker, this);
                if (attacker.isPlayer) {
                    hitmarkUntil = performance.now() + 300;
                    hitmarkKill = true;
                    audio.kill();
                }
                checkVictory();
            }
            else {
                addKillfeed(null, this);
            }
            if (this.isPlayer) {
                audio.die();
                deathAt = performance.now();
                gameState = 'dead';
                showDeathOverlay();
            }
            if (this.collider) {
                charByCollider.delete(this.collider.handle);
                world.removeCollider(this.collider);
                this.collider = null;
            }
            if (this.body) {
                world.removeRigidBody(this.body);
                this.body = null;
            }
        }
        updateVisual() {
            if (!this.group)
                return;
            this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
            this.group.rotation.y = this.yaw;
            if (this.hpBar) {
                const m = this.hpBar.material;
                m.color.setHex(this.team === 0 ? 0x4da3ff : 0xff5040);
            }
            if (this.flashSprites[0])
                this.flashSprites[0].visible = performance.now() < this.flashUntil;
        }
    }
    // ============================================================
    // 武器视图模型
    // ============================================================
    let gunGroup, magGroup, gunBase = new THREE.Vector3(0.24, -0.22, -0.42);
    function buildWeapon() {
        gunGroup = new THREE.Group();
        const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f34, roughness: 0.45, metalness: 0.65 });
        const poly = new THREE.MeshStandardMaterial({ color: 0x4d4438, roughness: 0.8 });
        const tan = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.75 });
        const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            m.rotation.set(rx, ry, rz);
            gunGroup.add(m);
            return m;
        };
        // 机匣(枪身)
        add(new THREE.BoxGeometry(0.075, 0.1, 0.4), metal, 0, 0, 0);
        // 护木
        add(new THREE.BoxGeometry(0.068, 0.078, 0.3), tan, 0, 0.008, -0.33);
        // 枪管 + 枪口
        add(new THREE.CylinderGeometry(0.017, 0.017, 0.24, 10), metal, 0, 0.02, -0.58, Math.PI / 2);
        add(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 10), metal, 0, 0.02, -0.68, Math.PI / 2);
        // 准星/照门
        add(new THREE.BoxGeometry(0.014, 0.05, 0.014), metal, 0, 0.075, -0.52);
        add(new THREE.BoxGeometry(0.034, 0.042, 0.02), metal, 0, 0.072, -0.04);
        // 握把
        add(new THREE.BoxGeometry(0.05, 0.13, 0.062), poly, 0, -0.115, 0.13, 0.35);
        // 枪托
        add(new THREE.BoxGeometry(0.056, 0.095, 0.24), tan, 0, -0.015, 0.3);
        add(new THREE.BoxGeometry(0.05, 0.05, 0.1), poly, 0, -0.04, 0.44);
        // 弹匣组(换弹动画驱动)
        magGroup = new THREE.Group();
        const mag1 = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.15, 0.075), metal);
        mag1.position.set(0, -0.19, -0.01);
        mag1.rotation.x = 0.1;
        const mag2 = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.11, 0.066), poly);
        mag2.position.set(0, -0.29, 0.005);
        mag2.rotation.x = 0.32;
        magGroup.add(mag1, mag2);
        magGroup.position.set(0, 0, 0);
        gunGroup.add(magGroup);
        // 枪口火光
        flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
        flashSprite.scale.set(0.16, 0.16, 1);
        flashSprite.position.set(0, 0.02, -0.76);
        flashSprite.visible = false;
        gunGroup.add(flashSprite);
        muzzleLight = new THREE.PointLight(0xffa040, 0, 8);
        muzzleLight.position.set(0, 0.02, -0.8);
        gunGroup.add(muzzleLight);
        gunGroup.position.copy(gunBase);
        gunGroup.rotation.y = -0.03;
        camera.add(gunGroup);
    }
    // ============================================================
    // 场景构建
    // ============================================================
    let flashTex;
    const matCache = {};
    function texFor(kind) {
        if (matCache[kind])
            return matCache[kind];
        let t;
        switch (kind) {
            case 'stone':
                t = texStone();
                break;
            case 'crate':
                t = texCrate();
                break;
            case 'sandbag':
                t = texSandbag();
                break;
            case 'metal':
                t = texMetal();
                break;
            case 'rock':
                t = texRock();
                break;
            case 'platA':
                t = texPlatform('A');
                break;
            case 'platB':
                t = texPlatform('B');
                break;
            default: t = texSand();
        }
        matCache[kind] = t;
        return t;
    }
    function buildWorld() {
        buildMap();
        buildGraph();
        buildAdj();
        // 地面
        const groundTex = texSand();
        groundTex.repeat.set(20, 16);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 110), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
        // 物理: 地面
        const gb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
        world.createCollider(RAPIER.ColliderDesc.cuboid(70, 0.5, 55), gb);
        // 物理 + 网格
        const boxMatCache = {};
        for (const b of boxes) {
            if (b.collide) {
                const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(b.x, b.y, b.z));
                world.createCollider(RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2), rb);
            }
            if (b.tex === 'rock')
                continue; // 岩石用多面体网格
            let mats;
            if (b.tex === 'stair') {
                mats = [boxStairMat, boxStairMat, boxStairMat, boxStairMat, boxStairMat, boxStairMat];
            }
            else {
                const key = b.tex + '|' + Math.round(Math.max(b.w, b.d) * 2) / 2 + '|' + Math.round(b.h * 2) / 2;
                if (!boxMatCache[key]) {
                    const rep = Math.max(1, Math.round(Math.max(b.w, b.d) / 2.2));
                    const repY = Math.max(1, Math.round(b.h / 2.2));
                    const mat = new THREE.MeshStandardMaterial({ map: texFor(b.tex).clone(), roughness: 0.95 });
                    mat.map.repeat.set(rep, repY);
                    mat.map.needsUpdate = true;
                    const sideMats = [mat, mat, mat, mat, mat, mat];
                    if (b.topTex) {
                        const tm = new THREE.MeshStandardMaterial({ map: texFor(b.topTex).clone(), roughness: 0.95 });
                        tm.map.repeat.set(Math.max(1, Math.round(b.w / 4)), Math.max(1, Math.round(b.d / 4)));
                        tm.map.needsUpdate = true;
                        sideMats[2] = tm;
                    }
                    boxMatCache[key] = sideMats;
                }
                mats = boxMatCache[key];
            }
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mats);
            mesh.position.set(b.x, b.y, b.z);
            mesh.castShadow = b.shadow;
            mesh.receiveShadow = true;
            scene.add(mesh);
        }
        // 岩石视觉(碰撞已是盒子)
        const rockMat = new THREE.MeshStandardMaterial({ map: texFor('rock'), roughness: 1 });
        for (const b of boxes) {
            if (b.tex !== 'rock')
                continue;
            const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), rockMat);
            m.position.set(b.x, b.y + 0.1, b.z);
            m.scale.set(b.w / 1.6, b.h / 1.1, b.d / 1.6);
            m.rotation.y = b.x * 1.7;
            m.castShadow = m.receiveShadow = true;
            scene.add(m);
        }
    }
    function buildSkyAndLights() {
        // 湛蓝天空球
        const skyGeo = new THREE.SphereGeometry(480, 24, 16);
        const skyMat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: { sunDir: { value: new THREE.Vector3(0.45, 0.62, 0.3).normalize() } },
            vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
            fragmentShader: `
      varying vec3 vDir; uniform vec3 sunDir;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 zen = vec3(0.035, 0.30, 0.85);
        vec3 hor = vec3(0.55, 0.75, 0.98);
        vec3 col = mix(hor, zen, pow(h, 0.5));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.95, 0.8) * pow(s, 700.0) * 3.0;
        col += vec3(1.0, 0.9, 0.7) * pow(s, 8.0) * 0.28;
        gl_FragColor = vec4(col, 1.0);
      }`,
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        scene.add(sky);
        // 正午太阳(硬阴影)
        const sun = new THREE.DirectionalLight(0xfff1da, 2.7);
        sun.position.set(60, 95, 42);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -75;
        sun.shadow.camera.right = 75;
        sun.shadow.camera.top = 75;
        sun.shadow.camera.bottom = -75;
        sun.shadow.camera.near = 20;
        sun.shadow.camera.far = 260;
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.03;
        scene.add(sun);
        scene.add(new THREE.HemisphereLight(0xbdd8ff, 0xd8b87c, 0.85));
        scene.fog = new THREE.Fog(0xa9c6e4, 90, 460);
    }
    // ============================================================
    // 射击 / 特效
    // ============================================================
    const tmpV1 = new THREE.Vector3();
    const tmpV2 = new THREE.Vector3();
    const tmpV3 = new THREE.Vector3();
    function spawnTracer(from, to) {
        const g = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
        scene.add(l);
        tracers.push({ line: l, life: 0.07 });
    }
    function spawnSpark(p) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: 0xffcc66, blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
        s.position.copy(p);
        s.scale.set(0.22, 0.22, 1);
        scene.add(s);
        sparks.push({ sp: s, life: 0.14 });
    }
    function fireWeapon(sh) {
        const now = performance.now();
        if (!sh.alive || sh.reloading)
            return;
        if (now - sh.lastShotAt < (sh.isPlayer ? FIRE_INTERVAL : 100))
            return;
        if (sh.ammo <= 0) {
            if (sh.isPlayer) {
                audio.empty();
                startReload(sh);
            }
            else
                startReload(sh);
            return;
        }
        sh.lastShotAt = now;
        sh.ammo--;
        // 散布
        const moving = sh.vel.lengthSq() > 2 ? 1 : 0;
        let spread = sh.isPlayer ? (0.011 + moving * 0.017 + Math.abs(recoilPitch) * 0.1) : 0.045;
        if (!sh.isPlayer && sh.target) {
            const eng = clamp((now - sh.engageSince) / 1500, 0, 1);
            spread = lerp(0.065, 0.022, eng);
        }
        const eye = sh.eyePos(tmpV1);
        const dir = sh.forward(tmpV2);
        dir.x += rand(-spread, spread);
        dir.y += rand(-spread, spread);
        dir.z += rand(-spread, spread);
        dir.normalize();
        const ray = new RAPIER.Ray({ x: eye.x, y: eye.y, z: eye.z }, { x: dir.x, y: dir.y, z: dir.z });
        const maxDist = 220;
        let end = null;
        if (sh.collider) {
            const hit = world.castRayAndGetNormal(ray, maxDist, true, undefined, undefined, sh.collider);
            if (hit) {
                const p = charByCollider.get(hit.collider.handle);
                const hx = eye.x + dir.x * hit.timeOfImpact;
                const hy = eye.y + dir.y * hit.timeOfImpact;
                const hz = eye.z + dir.z * hit.timeOfImpact;
                end = tmpV3.set(hx, hy, hz);
                if (p && p.team !== sh.team) {
                    const headshot = hy > p.pos.y + 1.45;
                    p.damage((sh.isPlayer ? 26 : 13) * rand(0.85, 1.15) * (headshot ? 2 : 1), sh);
                    spawnSpark(end);
                }
                else {
                    spawnSpark(end);
                }
            }
            else {
                end = tmpV3.set(eye.x + dir.x * maxDist, eye.y + dir.y * maxDist, eye.z + dir.z * maxDist);
            }
        }
        // 曳光 + 枪口
        const mp = sh.muzzlePos(new THREE.Vector3());
        if (end)
            spawnTracer(mp, end.clone ? end.clone() : end);
        if (sh.isPlayer) {
            gunKick = Math.min(gunKick + 0.55, 1.4);
            recoilPitch += 0.0038 + Math.random() * 0.002;
            flashSprite.visible = true;
            flashSprite.material.rotation = Math.random() * Math.PI * 2;
            const fs = flashSprite.scale;
            fs.set(0.15 + Math.random() * 0.08, 0.15 + Math.random() * 0.08, 1);
            muzzleLight.intensity = 3.2;
            setTimeout(() => { flashSprite.visible = false; }, 42);
            audio.shot(1);
        }
        else {
            sh.flashUntil = now + 50;
            const d = player ? mp.distanceTo(player.pos) : 999;
            const pan = player ? clamp(tmpV1.copy(mp).sub(player.pos).normalize().x, -1, 1) * 0.7 : 0;
            audio.distantShot(d, pan);
        }
        if (sh.isPlayer)
            updateAmmoHud();
    }
    function startReload(sh) {
        if (sh.reloading || sh.reserve <= 0 || sh.ammo >= MAG_SIZE)
            return;
        sh.reloading = true;
        sh.reloadEnd = performance.now() + sh.reloadDur;
        if (sh.isPlayer)
            audio.reload();
    }
    // ============================================================
    // 角色移动
    // ============================================================
    function moveCharacter(ch, wishX, wishZ, speed, dt, jump) {
        const k = Math.min(1, 13 * dt);
        ch.vel.x += (wishX * speed - ch.vel.x) * k;
        ch.vel.z += (wishZ * speed - ch.vel.z) * k;
        ch.vy += GRAVITY * dt;
        if (ch.vy < -32)
            ch.vy = -32;
        if (jump && ch.grounded)
            ch.vy = 5.6;
        const p = ch.body ? ch.body.translation() : { x: ch.pos.x, y: EYE_OFFSET, z: ch.pos.z };
        charCtrl.computeColliderMovement(ch.collider, { x: ch.vel.x * dt, y: ch.vy * dt, z: ch.vel.z * dt });
        const m = charCtrl.computedMovement();
        const nx = p.x + m.x, ny = p.y + m.y, nz = p.z + m.z;
        if (ch.body)
            ch.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
        ch.pos.set(nx, ny - EYE_OFFSET, nz);
        ch.grounded = charCtrl.computedGrounded();
    }
    // ============================================================
    // 机器人 AI
    // ============================================================
    const BOT_NAMES_RED = ['蝰蛇', '秃鹫', '豺狼', '毒蝎'];
    const BOT_NAMES_BLUE = ['夜莺', '幽灵', '猎犬'];
    const ROLE_WPS = {
        attackA: [WP.a_center, WP.a_wplat, WP.a_nplat, WP.a_eplat],
        attackB: [WP.b_center, WP.b_wplat, WP.b_nplat, WP.b_eplat],
        midPush: [WP.xc, WP.tun_m, WP.roof_c],
        defendB: [WP.b_center, WP.b_wplat],
        defendA: [WP.a_center, WP.a_wplat],
    };
    function botPickRole(bot) {
        const r = Math.random();
        if (bot.team === 0) {
            bot.role = r < 0.4 ? 'attackA' : (r < 0.8 ? 'attackB' : 'midPush');
        }
        else {
            bot.role = r < 0.35 ? 'attackA' : (r < 0.7 ? 'attackB' : (r < 0.88 ? 'midPush' : 'defendB'));
        }
        botPlanPath(bot);
    }
    function botPlanPath(bot) {
        const opts = ROLE_WPS[bot.role];
        const dest = opts[randInt(0, opts.length - 1)];
        // 从最近路点出发
        let best = 0, bd = 1e9;
        for (let i = 0; i < wpList.length; i++) {
            const dx = wpList[i].x - bot.pos.x, dz = wpList[i].z - bot.pos.z;
            const d = dx * dx + dz * dz;
            if (d < bd) {
                bd = d;
                best = i;
            }
        }
        bot.path = findPath(best, dest);
        bot.pathIdx = 0;
        bot.aiState = 'move';
        bot.repathAt = performance.now() + 2000;
    }
    function botNearestEnemy(bot) {
        const all = player && player.alive ? bots.concat([player]) : bots;
        let best = null, bd = 65 * 65;
        for (const c of all) {
            if (!c.alive || c.team === bot.team)
                continue;
            const dx = c.pos.x - bot.pos.x, dz = c.pos.z - bot.pos.z;
            const d = dx * dx + dz * dz;
            if (d < bd) {
                bd = d;
                best = c;
            }
        }
        return best;
    }
    function botHasLOS(bot, target) {
        const eye = bot.eyePos(tmpV1);
        const tp = tmpV2.set(target.pos.x, target.pos.y + 1.3, target.pos.z);
        const d = tp.clone().sub(eye);
        const dist = d.length();
        if (dist < 0.5)
            return true;
        d.normalize();
        const ray = new RAPIER.Ray({ x: eye.x, y: eye.y, z: eye.z }, { x: d.x, y: d.y, z: d.z });
        const ex = bot.collider;
        const hit = world.castRayAndGetNormal(ray, dist, true, undefined, undefined, ex);
        if (!hit)
            return true;
        const p = charByCollider.get(hit.collider.handle);
        return !!p && p !== bot && p.team !== bot.team;
    }
    function updateBot(bot, dt) {
        if (!bot.alive)
            return;
        const now = performance.now();
        // ---- 索敌 ----
        if (bot.aiState !== 'engage' && now > bot.nextScanAt) {
            bot.nextScanAt = now + 120;
            const e = botNearestEnemy(bot);
            if (e && botHasLOS(bot, e)) {
                bot.target = e;
                bot.aiState = 'engage';
                bot.engageSince = now;
                bot.reactAt = now + rand(230, 480);
                bot.burstLeft = 0;
                bot.nextBurstAt = 0;
            }
        }
        let wishX = 0, wishZ = 0, jump = false;
        if (bot.aiState === 'engage' && bot.target) {
            const t = bot.target;
            const dx = t.pos.x - bot.pos.x, dz = t.pos.z - bot.pos.z;
            const dist = Math.hypot(dx, dz);
            // 面向目标
            const wantYaw = Math.atan2(-dx, -dz);
            bot.yaw = angleLerp(bot.yaw, wantYaw, Math.min(1, 10 * dt));
            // 射击节奏
            if (now >= bot.reactAt && t.alive && botHasLOS(bot, t)) {
                if (bot.ammo <= 0)
                    startReload(bot);
                else if (bot.burstLeft > 0) {
                    fireWeapon(bot);
                    bot.burstLeft--;
                    if (bot.burstLeft === 0)
                        bot.nextBurstAt = now + rand(420, 950);
                }
                else if (now >= bot.nextBurstAt) {
                    bot.burstLeft = randInt(3, 6);
                }
            }
            // 走位: 保持距离 + 横移
            const ux = dx / (dist || 1), uz = dz / (dist || 1);
            const strafe = Math.sin(now * 0.0016 + bot.scanPhase) * 0.7;
            wishX = -uz * strafe;
            wishZ = ux * strafe;
            if (dist > 26) {
                wishX += ux * 0.9;
                wishZ += uz * 0.9;
            }
            else if (dist < 5) {
                wishX -= ux * 0.7;
                wishZ -= uz * 0.7;
            }
            if (!t.alive || !botHasLOS(bot, t)) {
                bot.target = null;
                bot.aiState = bot.path.length && bot.pathIdx < bot.path.length ? 'move' : 'hold';
                if (bot.aiState === 'hold')
                    bot.holdUntil = now + rand(4000, 8000);
            }
        }
        else if (bot.aiState === 'move') {
            if (bot.pathIdx >= bot.path.length) {
                bot.aiState = 'hold';
                bot.holdUntil = now + rand(5000, 9000);
            }
            else {
                const node = wpList[bot.path[bot.pathIdx]];
                const dx = node.x - bot.pos.x, dz = node.z - bot.pos.z;
                const dist = Math.hypot(dx, dz);
                if (dist < 0.6 && Math.abs(node.y - (bot.pos.y + 0.95)) < 1.6) {
                    bot.pathIdx++;
                }
                else {
                    bot.yaw = angleLerp(bot.yaw, Math.atan2(-dx, -dz), Math.min(1, 8 * dt));
                    wishX = dx / (dist || 1);
                    wishZ = dz / (dist || 1);
                }
                // 卡住检测
                if (now > bot.repathAt) {
                    bot.repathAt = now + 2000;
                    if (Math.hypot(bot.pos.x - bot.lastX, bot.pos.z - bot.lastZ) < 0.4) {
                        jump = true;
                        if (Math.random() < 0.4)
                            bot.pathIdx = Math.max(0, bot.pathIdx - 1);
                    }
                    bot.lastX = bot.pos.x;
                    bot.lastZ = bot.pos.z;
                }
            }
        }
        else { // hold 巡逻扫描
            bot.scanPhase += dt;
            bot.yaw += Math.sin(bot.scanPhase * 0.9) * dt * 0.7;
            if (now > bot.holdUntil)
                botPickRole(bot);
        }
        // 换弹完成
        if (bot.reloading && now >= bot.reloadEnd) {
            bot.reloading = false;
            const need = MAG_SIZE - bot.ammo;
            const take = Math.min(need, bot.reserve);
            bot.ammo += take;
            bot.reserve -= take;
        }
        // 简单分离
        const all = player && player.alive ? bots.concat([player]) : bots;
        for (const o of all) {
            if (o === bot || !o.alive)
                continue;
            const dx = bot.pos.x - o.pos.x, dz = bot.pos.z - o.pos.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < 0.81 && d2 > 0.0001) {
                const d = Math.sqrt(d2);
                wishX += dx / d * 0.8;
                wishZ += dz / d * 0.8;
            }
        }
        moveCharacter(bot, wishX, wishZ, BOT_SPEED, dt, jump);
        bot.updateVisual();
    }
    // ============================================================
    // 玩家
    // ============================================================
    function updatePlayer(dt) {
        if (!player || !player.alive)
            return;
        const now = performance.now();
        // 视角
        player.yaw -= mouseDX * 0.0022;
        player.pitch = clamp(player.pitch - mouseDY * 0.0022, -1.55, 1.55);
        mouseDX = 0;
        mouseDY = 0;
        recoilPitch = lerp(recoilPitch, 0, Math.min(1, 9 * dt));
        // 移动
        let fx = 0, fz = 0;
        if (keys['KeyW'])
            fz -= 1;
        if (keys['KeyS'])
            fz += 1;
        if (keys['KeyA'])
            fx -= 1;
        if (keys['KeyD'])
            fx += 1;
        const len = Math.hypot(fx, fz) || 1;
        fx /= len;
        fz /= len;
        const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
        const wishX = fx * cos - fz * sin;
        const wishZ = fx * sin + fz * cos;
        moveCharacter(player, wishX, wishZ, PLAYER_SPEED, dt, keys['Space']);
        // 脚步声
        const spd = Math.hypot(player.vel.x, player.vel.z);
        if (player.grounded && spd > 2 && now - lastStepAt > 340 / (spd / PLAYER_SPEED)) {
            lastStepAt = now;
            audio.step();
        }
        // 开火
        if (firing)
            fireWeapon(player);
        // 换弹完成
        if (reloading && now >= reloadEnd) {
            reloading = false;
            const need = MAG_SIZE - player.ammo;
            const take = Math.min(need, player.reserve);
            player.ammo += take;
            player.reserve -= take;
            updateAmmoHud();
        }
        // 缓慢回血(5秒未受伤)
        if (player.hp < PLAYER_HP && now - player.lastDamageAt > 5000) {
            player.hp = Math.min(PLAYER_HP, player.hp + 11 * dt);
            updateHealthHud();
        }
        // 相机
        bobPhase += spd * dt * 1.85;
        bobAmp = lerp(bobAmp, player.grounded ? clamp(spd / PLAYER_SPEED, 0, 1) : 0, Math.min(1, 8 * dt));
        const bobY = Math.sin(bobPhase * 2) * 0.02 * bobAmp;
        camera.position.set(player.pos.x, player.pos.y + EYE_PLAYER + bobY, player.pos.z);
        camera.rotation.set(player.pitch + recoilPitch, player.yaw, 0);
        // 枪械动画
        gunKick = lerp(gunKick, 0, Math.min(1, 10 * dt));
        const sway = Math.sin(bobPhase) * 0.007 * bobAmp;
        const gx = gunBase.x + Math.cos(bobPhase) * 0.006 * bobAmp;
        const gy = gunBase.y + Math.sin(bobPhase * 2) * 0.008 * bobAmp;
        gunGroup.position.set(gx + sway, gy, gunBase.z + gunKick * 0.09);
        gunGroup.rotation.x = gunKick * 0.14;
        gunGroup.rotation.z = Math.sin(bobPhase) * 0.012 * bobAmp;
        // 换弹动画
        if (reloading) {
            const t = 1 - (reloadEnd - now) / RELOAD_TIME;
            const down = t < 0.25 ? t / 0.25 : (t > 0.75 ? (1 - t) / 0.25 : 1);
            magGroup.position.y = -down * 0.17;
            magGroup.rotation.x = down * 0.55;
            gunGroup.rotation.z += down * 0.18;
        }
        else {
            magGroup.position.y = lerp(magGroup.position.y, 0, Math.min(1, 12 * dt));
            magGroup.rotation.x = lerp(magGroup.rotation.x, 0, Math.min(1, 12 * dt));
        }
        muzzleLight.intensity = lerp(muzzleLight.intensity, 0, Math.min(1, 18 * dt));
    }
    // ============================================================
    // HUD
    // ============================================================
    let elHealth, elHealthBar, elAmmo, elReserve;
    let elScore, elKillfeed, elHitmark, elVignette;
    let elCross, minimapCtx, elMsg;
    let elMenu, elPause, elDeath, elVictory;
    let elDeathInfo, elVictoryInfo, elScoreHint;
    function $(id) { return document.getElementById(id); }
    function updateHealthHud() {
        const hp = player ? player.hp : 0;
        elHealth.textContent = String(Math.max(0, Math.ceil(hp)));
        elHealthBar.style.width = clamp(hp, 0, 100) + '%';
        elHealthBar.style.background = hp > 50 ? 'linear-gradient(90deg,#5be37a,#2fae4e)' : hp > 25 ? 'linear-gradient(90deg,#ffc857,#e8a020)' : 'linear-gradient(90deg,#ff5a4e,#d83a2e)';
    }
    function updateAmmoHud() {
        if (!player)
            return;
        elAmmo.textContent = reloading ? '--' : String(player.ammo);
        elReserve.textContent = String(player.reserve);
    }
    function updateScoreHud() {
        elScore.innerHTML = `<span class="sb">蓝队 ${scores[0]}</span><span class="ss">:</span><span class="sr">${scores[1]} 红队</span>`;
    }
    function addKillfeed(killer, victim) {
        const div = document.createElement('div');
        div.className = 'kf';
        const kn = killer ? killer.name : '☠';
        const kc = killer ? (killer.team === 0 ? 'kb' : 'kr') : 'kn';
        div.innerHTML = `<span class="${kc}">${kn}</span> ▸ <span class="${victim.team === 0 ? 'kb' : 'kr'}">${victim.name}</span>`;
        elKillfeed.prepend(div);
        while (elKillfeed.children.length > 5)
            elKillfeed.removeChild(elKillfeed.lastChild);
        setTimeout(() => { if (div.parentNode)
            div.parentNode.removeChild(div); }, 4200);
    }
    function checkVictory() {
        if (scores[0] >= SCORE_TARGET || scores[1] >= SCORE_TARGET) {
            gameState = 'victory';
            document.exitPointerLock && document.exitPointerLock();
            elVictoryInfo.innerHTML = scores[0] > scores[1]
                ? `<span class="win">胜利!</span> 蓝队 ${scores[0]} : ${scores[1]} 红队`
                : `<span class="lose">战败…</span> 蓝队 ${scores[0]} : ${scores[1]} 红队`;
            elVictory.classList.add('show');
        }
    }
    function showDeathOverlay() {
        elDeathInfo.textContent = '';
        elDeath.classList.add('show');
    }
    function updateHudFrame() {
        if (!player)
            return;
        updateHealthHud();
        updateAmmoHud();
        updateScoreHud();
        // 命中标记
        const now = performance.now();
        elHitmark.style.opacity = now < hitmarkUntil ? '1' : '0';
        elHitmark.className = hitmarkKill ? 'kill' : '';
        // 受击红晕
        elVignette.style.opacity = now < vignetteUntil ? String(vignetteMax * (1 - (now - (vignetteUntil - 320)) / 320) * 2.2) : '0';
        // 准星
        const spread = 10 + (reloading ? 14 : 0) + (player.vel.lengthSq() > 2 ? 8 : 0) + gunKick * 10;
        elCross.style.setProperty('--gap', spread + 'px');
        // 重生倒计时
        if (gameState === 'dead') {
            const left = Math.max(0, player.deadUntil - now);
            elDeathInfo.textContent = `阵亡 — ${(left / 1000).toFixed(1)}s 后重生`;
        }
        drawMinimap();
    }
    function drawMinimap() {
        const ctx = minimapCtx;
        const W = 224, H = 184;
        const sx = W / 116, sz = H / 92;
        const mx = (x) => (x + 58) * sx;
        const mz = (z) => (z + 46) * sz;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(24,20,12,0.92)';
        ctx.fillRect(0, 0, W, H);
        // 区域
        for (const z of ZONES) {
            ctx.fillStyle = z.color;
            ctx.fillRect(mx(z.x1), mz(z.z1), (z.x2 - z.x1) * sx, (z.z2 - z.z1) * sz);
            if (z.label) {
                ctx.fillStyle = 'rgba(255,120,90,0.9)';
                ctx.font = 'bold 20px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(z.label, mx((z.x1 + z.x2) / 2), mz((z.z1 + z.z2) / 2) + 7);
            }
        }
        // 墙体
        ctx.fillStyle = '#8a6f42';
        for (const b of boxes) {
            if (!b.collide || b.tex === 'rock')
                continue;
            ctx.fillRect(mx(b.x - b.w / 2), mz(b.z - b.d / 2), Math.max(1.5, b.w * sx), Math.max(1.5, b.d * sz));
        }
        const now = performance.now();
        // 队友
        if (player) {
            for (const b of bots) {
                if (b.team !== 0 || !b.alive)
                    continue;
                ctx.fillStyle = '#4da3ff';
                ctx.beginPath();
                ctx.arc(mx(b.pos.x), mz(b.pos.z), 3, 0, 7);
                ctx.fill();
            }
            // 开火暴露的敌人
            for (const b of bots) {
                if (b.team !== 1 || !b.alive)
                    continue;
                if (now - b.lastShotAt < 4000) {
                    ctx.fillStyle = `rgba(255,70,50,${0.6 + 0.4 * Math.sin(now * 0.012)})`;
                    ctx.beginPath();
                    ctx.arc(mx(b.pos.x), mz(b.pos.z), 3.5, 0, 7);
                    ctx.fill();
                }
            }
            // 玩家箭头
            ctx.save();
            ctx.translate(mx(player.pos.x), mz(player.pos.z));
            ctx.rotate(-player.yaw);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(0, -6);
            ctx.lineTo(4.2, 5);
            ctx.lineTo(-4.2, 5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }
    // ============================================================
    // 重生
    // ============================================================
    function respawnChar(ch) {
        const isBlue = ch.team === 0;
        const spots = isBlue ? [[-6, 36], [0, 38.5], [6, 36]] : [[-6, -36], [0, -38.5], [6, -36]];
        const s = spots[randInt(0, 2)];
        ch.spawn(s[0], s[1], isBlue ? 0 : Math.PI);
        if (ch.isPlayer) {
            spawnProtect = performance.now() + 1500;
            gameState = 'playing';
            elDeath.classList.remove('show');
            reloading = false;
            updateAmmoHud();
            updateHealthHud();
            audio.respawn();
        }
        else {
            botPickRole(ch);
        }
    }
    // ============================================================
    // 输入
    // ============================================================
    function setupInput() {
        document.addEventListener('keydown', (e) => {
            keys[e.code] = true;
            if (e.code === 'KeyR' && player && player.alive && gameState === 'playing')
                startReload(player);
            if (e.code === 'Space')
                e.preventDefault();
        });
        document.addEventListener('keyup', (e) => { keys[e.code] = false; });
        document.addEventListener('mousemove', (e) => {
            if (gameState !== 'playing' || !document.pointerLockElement)
                return;
            mouseDX += e.movementX;
            mouseDY += e.movementY;
        });
        document.addEventListener('mousedown', (e) => {
            if (gameState === 'playing' && e.button === 0)
                firing = true;
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0)
                firing = false;
        });
        document.addEventListener('pointerlockchange', () => {
            const locked = document.pointerLockElement != null;
            if (!locked && gameState === 'playing') {
                gameState = 'paused';
                elPause.classList.add('show');
                firing = false;
            }
        });
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    // ============================================================
    // 出生布置
    // ============================================================
    function setupTeams() {
        player = new Character(0, true, '你', 0, 38, 0);
        player.spawn(0, 38.5, 0);
        charByCollider.set(player.collider.handle, player);
        for (let i = 0; i < 3; i++) {
            const b = new Character(0, false, BOT_NAMES_BLUE[i], -6 + i * 6, 36 + (i % 2) * 2.5, 0);
            b.spawn(-6 + i * 6, 36 + (i % 2) * 2.5, 0);
            bots.push(b);
        }
        for (let i = 0; i < 4; i++) {
            const b = new Character(1, false, BOT_NAMES_RED[i], -9 + i * 6, -36 - (i % 2) * 2.5, Math.PI);
            b.spawn(-9 + i * 6, -36 - (i % 2) * 2.5, Math.PI);
            bots.push(b);
        }
        for (const b of bots)
            botPickRole(b);
    }
    // ============================================================
    // 主循环
    // ============================================================
    function frame() {
        requestAnimationFrame(frame);
        const now = performance.now();
        let dt = Math.min((now - clock.last) / 1000, 0.05);
        clock.last = now;
        if (gameState === 'playing' || gameState === 'dead') {
            world.timestep = dt;
            if (player)
                updatePlayer(dt);
            for (const b of bots) {
                if (!b.alive && now >= b.deadUntil)
                    respawnChar(b);
                updateBot(b, dt);
            }
            // 特效
            for (let i = tracers.length - 1; i >= 0; i--) {
                tracers[i].life -= dt;
                if (tracers[i].life <= 0) {
                    scene.remove(tracers[i].line);
                    tracers.splice(i, 1);
                }
            }
            for (let i = sparks.length - 1; i >= 0; i--) {
                sparks[i].life -= dt;
                sparks[i].sp.material.opacity = sparks[i].life / 0.14;
                if (sparks[i].life <= 0) {
                    scene.remove(sparks[i].sp);
                    sparks.splice(i, 1);
                }
            }
            if (player && !player.alive && now >= player.deadUntil)
                respawnChar(player);
            world.step();
            if (player)
                player.updateVisual();
            updateHudFrame();
        }
        else if (gameState === 'menu') {
            // 菜单环绕镜头
            const t = now * 0.00006;
            camera.position.set(Math.cos(t) * 55, 26, Math.sin(t) * 55);
            camera.lookAt(0, 0, 0);
        }
        renderer.render(scene, camera);
    }
    // ============================================================
    // 启动
    // ============================================================
    function boot() {
        try {
            // 渲染器
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.BasicShadowMap;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.06;
            document.body.appendChild(renderer.domElement);
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 900);
            scene.add(camera);
            flashTex = texFlash();
            buildSkyAndLights();
            buildWorld();
            buildWeapon();
            // HUD 引用
            elHealth = $('hp-num');
            elHealthBar = $('hp-bar');
            elAmmo = $('ammo-mag');
            elReserve = $('ammo-reserve');
            elScore = $('score');
            elKillfeed = $('killfeed');
            elHitmark = $('hitmark');
            elVignette = $('vignette');
            elCross = $('crosshair');
            elMsg = $('msg');
            elMenu = $('menu');
            elPause = $('pause');
            elDeath = $('death');
            elVictory = $('victory');
            elDeathInfo = $('death-info');
            elVictoryInfo = $('victory-info');
            minimapCtx = $('minimap').getContext('2d');
            setupInput();
            setupTeams();
            updateScoreHud();
            updateHealthHud();
            updateAmmoHud();
            // 按钮
            $('btn-start').addEventListener('click', () => {
                audio.init();
                audio.resume();
                elMenu.classList.remove('show');
                renderer.domElement.requestPointerLock();
                gameState = 'playing';
                document.querySelectorAll('.hud').forEach((el) => el.classList.add('show'));
                $('score-hint').classList.add('show');
            });
            renderer.domElement.addEventListener('click', () => {
                if (gameState === 'playing' && !document.pointerLockElement) {
                    renderer.domElement.requestPointerLock();
                }
            });
            $('btn-resume').addEventListener('click', () => {
                audio.resume();
                renderer.domElement.requestPointerLock();
                gameState = 'playing';
                elPause.classList.remove('show');
            });
            $('btn-restart1').addEventListener('click', () => { elPause.classList.remove('show'); location.reload(); });
            $('btn-restart2').addEventListener('click', () => location.reload());
            // 测试钩子
            window.__game = {
                get state() { return gameState; },
                get player() { return player ? { x: player.pos.x, y: player.pos.y, z: player.pos.z, hp: player.hp, ammo: player.ammo, alive: player.alive, yaw: player.yaw } : null; },
                get bots() { return bots.map((b) => ({ name: b.name, team: b.team, x: b.pos.x, y: b.pos.y, z: b.pos.z, hp: b.hp, alive: b.alive, role: b.role })); },
                get scores() { return scores.slice(); },
                teleport(x, z, yaw = 0) {
                    if (player && player.body) {
                        player.body.setTranslation({ x, y: EYE_OFFSET, z }, true);
                        player.pos.set(x, 0, z);
                        player.yaw = yaw;
                    }
                },
                key(code, down) { keys[code] = down; },
                setFiring(v) { firing = v; },
                look(yaw, pitch) { if (player) {
                    player.yaw = yaw;
                    player.pitch = pitch;
                } },
                get reloading() { return reloading; },
            };
            clock.last = performance.now();
            requestAnimationFrame(frame);
        }
        catch (err) {
            __errors.push('boot: ' + String(err && err.stack || err));
        }
    }
    // Rapier 初始化后启动
    (async () => {
        try {
            await RAPIER.init();
            world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
            charCtrl = world.createCharacterController(0.02);
            charCtrl.enableAutostep(0.4, 0.3, true);
            charCtrl.setApplyImpulsesToDynamicBodies(false);
            boot();
        }
        catch (err) {
            __errors.push('rapier: ' + String(err));
        }
    })();
})();
