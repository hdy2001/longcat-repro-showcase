/* ============================================================
 * 伞面纹理绘制（Canvas 2D 程序化生成）
 * 依据伞型风格绘制不同伞面图案，输出为 THREE.CanvasTexture
 * ============================================================ */

const UmbrellaTextures = (() => {

  const SIZE = 1024;

  /** 创建画布 */
  function makeCanvas(drawFn, w = SIZE, h = SIZE) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    drawFn(ctx, w, h);
    return c;
  }

  /** 绘制辐射伞骨投影线（伞骨在伞面上的投影） */
  function drawRibLines(ctx, count, color, width) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    const cx = SIZE / 2, cy = 0; // 伞顶中心在 canvas 顶部
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(a) * SIZE, cy + Math.cos(a) * SIZE);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** 水墨山水（余杭伞 / 绿油纸伞） */
  function drawLandscape(ctx, base, ink) {
    // 渐变底色
    const g = ctx.createLinearGradient(0, 0, 0, SIZE);
    g.addColorStop(0, shade(base, -12));
    g.addColorStop(0.35, base);
    g.addColorStop(1, shade(base, 8));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 远山（三层，透明度递减）
    const ranges = [
      { y: 0.42, amp: 60, alpha: 0.32, col: ink },
      { y: 0.55, amp: 90, alpha: 0.45, col: ink },
      { y: 0.72, amp: 120, alpha: 0.6, col: ink }
    ];
    ranges.forEach(r => {
      ctx.save();
      ctx.globalAlpha = r.alpha;
      ctx.fillStyle = r.col;
      ctx.beginPath();
      ctx.moveTo(0, SIZE * r.y + r.amp);
      for (let x = 0; x <= SIZE; x += 8) {
        const y = SIZE * r.y
          + Math.sin(x * 0.011 + r.y * 9) * r.amp
          + Math.sin(x * 0.031 + r.y * 4) * r.amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(SIZE, SIZE); ctx.lineTo(0, SIZE);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // 近景树影笔触
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      const x = 120 + i * 130, y = SIZE * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 20, y - 70, x + 45, y - 110);
      ctx.stroke();
    }
    ctx.restore();

    // 红印
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#b5382e";
    ctx.fillRect(SIZE - 96, SIZE - 190, 52, 52);
    ctx.fillStyle = "#f5efe0";
    ctx.font = "30px 'Kaiti SC','KaiTi',serif";
    ctx.textAlign = "center";
    ctx.fillText("印", SIZE - 70, SIZE - 154);
    ctx.restore();
  }

  /** 书法伞面（明式） */
  function drawCalligraphy(ctx, base, ink) {
    const g = ctx.createRadialGradient(SIZE/2, SIZE*0.3, 40, SIZE/2, SIZE*0.3, SIZE);
    g.addColorStop(0, shade(base, 14));
    g.addColorStop(1, shade(base, -10));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 环形题字带
    ctx.save();
    ctx.translate(SIZE/2, SIZE*0.52);
    ctx.fillStyle = ink;
    ctx.font = "bold 84px 'Kaiti SC','STKaiti','KaiTi',serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = "清风徐来";
    const R = SIZE * 0.31;
    for (let i = 0; i < text.length; i++) {
      const a = -Math.PI / 2 + (i - (text.length - 1) / 2) * 0.42;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(R, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // 环形装饰线
    ctx.save();
    ctx.strokeStyle = shade(ink, 10);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    [0.36, 0.44].forEach(r => {
      ctx.beginPath();
      ctx.arc(SIZE/2, SIZE*0.52, SIZE * r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  /** 漆面（福州伞） */
  function drawLacquer(ctx, base) {
    const g = ctx.createLinearGradient(0, 0, 0, SIZE);
    g.addColorStop(0, shade(base, 26));
    g.addColorStop(0.3, base);
    g.addColorStop(0.55, shade(base, -14));
    g.addColorStop(1, shade(base, -26));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 高光弧带
    ctx.save();
    ctx.globalAlpha = 0.28;
    const hg = ctx.createLinearGradient(0, SIZE*0.34, SIZE, SIZE*0.34);
    hg.addColorStop(0, "rgba(255,255,255,0)");
    hg.addColorStop(0.5, "rgba(255,255,255,0.85)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(SIZE/2, SIZE*0.4, SIZE*0.46, SIZE*0.05, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // 描金环带
    ctx.save();
    ctx.strokeStyle = "#d9b45a";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(SIZE/2, SIZE*0.5, SIZE*0.44, 0, Math.PI*2); ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(SIZE/2, SIZE*0.5, SIZE*0.47, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  /** 金龙云纹（华盖） */
  function drawImperial(ctx, base, gold) {
    const g = ctx.createRadialGradient(SIZE/2, SIZE*0.35, 30, SIZE/2, SIZE*0.35, SIZE*0.95);
    g.addColorStop(0, shade(base, 18));
    g.addColorStop(1, shade(base, -18));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 祥云纹（螺旋）
    ctx.save();
    ctx.strokeStyle = gold;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 4;
    for (let ring = 0; ring < 3; ring++) {
      const R = SIZE * (0.18 + ring * 0.13);
      const n = 8 + ring * 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.4;
        const cx = SIZE/2 + Math.cos(a) * R;
        const cy = SIZE*0.5 + Math.sin(a) * R;
        ctx.beginPath();
        ctx.arc(cx, cy, 14 + ring * 5, a, a + Math.PI * 1.5);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 中心团纹
    ctx.save();
    ctx.fillStyle = gold;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(SIZE/2, SIZE*0.5, SIZE*0.085, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  /** 织锦纹（汉代车盖） */
  function drawBrocade(ctx, base, accent) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 菱格锦纹
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2.5;
    const step = SIZE / 10;
    for (let i = -10; i <= 20; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step + SIZE, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * step + SIZE, 0); ctx.lineTo(i * step, SIZE); ctx.stroke();
    }
    ctx.restore();

    // 团花纹
    ctx.save();
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cx = SIZE/2 + Math.cos(a) * SIZE * 0.3;
      const cy = SIZE * 0.52 + Math.sin(a) * SIZE * 0.3;
      for (let p = 0; p < 6; p++) {
        const pa = (p / 6) * Math.PI * 2;
        ctx.fillStyle = p % 2 ? accent : shade(base, 20);
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(pa) * 26, cy + Math.sin(pa) * 26, 20, 10, pa, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** 手绘花卉（现代工艺伞） */
  function drawFloral(ctx, base, accent) {
    const g = ctx.createLinearGradient(0, 0, 0, SIZE);
    g.addColorStop(0, shade(base, 12));
    g.addColorStop(1, shade(base, -8));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 散布花卉
    const rng = mulberry32(20240924);
    for (let i = 0; i < 26; i++) {
      const x = rng() * SIZE, y = SIZE * 0.3 + rng() * SIZE * 0.7;
      const r = 12 + rng() * 22;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = 0.55 + rng() * 0.3;
      ctx.fillStyle = i % 3 === 0 ? accent : (i % 3 === 1 ? shade(accent, 24) : shade(base, 26));
      const petals = 5 + Math.floor(rng() * 3);
      for (let p = 0; p < petals; p++) {
        const a = (p / petals) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.55, r * 0.28, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#e8c85a";
      ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 藤蔓曲线
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, SIZE * 0.42);
    ctx.bezierCurveTo(SIZE*0.3, SIZE*0.3, SIZE*0.6, SIZE*0.55, SIZE, SIZE*0.4);
    ctx.stroke();
    ctx.restore();
  }

  /** 颜色明暗调整 */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  /** 可复现随机数 */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 生成伞面纹理
   * @param {Object} model 伞的3D配置
   * @returns {HTMLCanvasElement}
   */
  function generate(model) {
    const { canopyColor, textureStyle, ribCount } = model;
    const canvas = makeCanvas((ctx) => {
      switch (textureStyle) {
        case "landscape":
          drawLandscape(ctx, canopyColor, shade(canopyColor, -46));
          break;
        case "calligraphy":
          drawCalligraphy(ctx, canopyColor, shade(canopyColor, -52));
          break;
        case "lacquer":
          drawLacquer(ctx, canopyColor);
          break;
        case "imperial":
          drawImperial(ctx, canopyColor, "#e8c85a");
          break;
        case "brocade":
          drawBrocade(ctx, canopyColor, "#d9b45a");
          break;
        case "floral":
          drawFloral(ctx, canopyColor, "#d46a8a");
          break;
        default: // plain 油布素面
          const g = ctx.createLinearGradient(0, 0, 0, SIZE);
          g.addColorStop(0, shade(canopyColor, 16));
          g.addColorStop(0.5, canopyColor);
          g.addColorStop(1, shade(canopyColor, -12));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, SIZE, SIZE);
          // 布纹噪点
          ctx.save();
          ctx.globalAlpha = 0.06;
          ctx.fillStyle = "#000";
          for (let i = 0; i < SIZE; i += 4) {
            ctx.fillRect(0, i, SIZE, 1);
            ctx.fillRect(i, 0, 1, SIZE);
          }
          ctx.restore();
      }
      // 统一叠加伞骨投影 + 边缘滚边
      drawRibLines(ctx, ribCount, "rgba(0,0,0,0.10)", 2.2);
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, SIZE - 8);
      ctx.lineTo(SIZE, SIZE - 8);
      ctx.stroke();
      ctx.restore();
    });
    return canvas;
  }

  return { generate };
})();
