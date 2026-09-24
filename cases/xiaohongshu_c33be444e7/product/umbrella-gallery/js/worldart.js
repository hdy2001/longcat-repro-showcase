/* ============================================================
 * 世界伞文化 SVG 插画（程序化生成，风格统一）
 * 每把伞一个扁平东方风插画，含背景晕染与地域装饰元素
 * ============================================================ */

const WorldArt = (() => {

  const W = 600, H = 450;

  /** 宣纸晕染背景 */
  function bg(extra = "") {
    return `
      <rect width="${W}" height="${H}" fill="#f5f0e6"/>
      <circle cx="300" cy="210" r="175" fill="#ece3d0" opacity="0.7"/>
      <circle cx="300" cy="210" r="150" fill="#f2ebdb" opacity="0.8"/>
      <g opacity="0.5">${extra}</g>`;
  }

  /** 放射伞骨线（以cx,cy为伞顶，r为伞面半径，向下展开） */
  function ribs(cx, topY, r, n, color, opacity = 0.5) {
    let s = "";
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (0.06 + 0.88 * (i / n));
      const x = cx + Math.sin(a) * r * 1.15;
      const y = topY + Math.cos(a) * r * 1.15;
      s += `<line x1="${cx}" y1="${topY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
              stroke="${color}" stroke-width="1.4" opacity="${opacity}"/>`;
    }
    return s;
  }

  /* ---------- 日本 · 番伞 ---------- */
  function japan() {
    const cx = 300, top = 92, r = 165;
    const edge = [];
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI * (0.08 + 0.84 * (i / 24));
      edge.push(`${(cx + Math.sin(a) * r).toFixed(1)},${(top + Math.cos(a) * r).toFixed(1)}`);
    }
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${bg(`<g fill="#d4a7a0" opacity="0.6">
        <circle cx="80" cy="80" r="4"/><circle cx="120" cy="60" r="3"/><circle cx="520" cy="70" r="4"/>
        <circle cx="480" cy="100" r="3"/><circle cx="540" cy="380" r="4"/><circle cx="60" cy="350" r="3"/>
      </g>`)}
      <line x1="${cx}" y1="${top + r + 8}" x2="${cx}" y2="${top + r + 88}" stroke="#5a4632" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${top + r + 92}" r="4" fill="#5a4632"/>
      <polygon points="${edge.join(" ")}" fill="#b5382e"/>
      <polygon points="${edge.join(" ")}" fill="url(#jg)"/>
      ${ribs(cx, top, r, 48, "#f5efe0", 0.45)}
      <circle cx="${cx}" cy="${top}" r="9" fill="#2c2620"/>
      <defs><linearGradient id="jg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.28"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.18"/>
      </linearGradient></defs>
    </svg>`;
  }

  /* ---------- 英国 · 长柄伞 ---------- */
  function england() {
    const cx = 300, top = 108, rx = 158, ry = 88;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${bg(`<g stroke="#8a97a8" stroke-width="2" opacity="0.55" stroke-linecap="round">
        <line x1="90" y1="60" x2="82" y2="86"/><line x1="140" y1="40" x2="132" y2="66"/>
        <line x1="480" y1="55" x2="472" y2="81"/><line x1="530" y1="90" x2="522" y2="116"/>
        <line x1="510" y1="30" x2="502" y2="56"/>
      </g>`)}
      <path d="M ${cx - rx} ${top + ry} A ${rx} ${ry} 0 0 1 ${cx + rx} ${top + ry}"
            fill="none" stroke="#2c3a4a" stroke-width="0"/>
      <path d="M ${cx - rx} ${top + ry} A ${rx} ${ry} 0 0 1 ${cx + rx} ${top + ry} L ${cx + rx} ${top + ry} Z" fill="#2c3a4a"/>
      <path d="M ${cx - rx} ${top + ry} A ${rx} ${ry} 0 0 1 ${cx + rx} ${top + ry} Z" fill="url(#eg)"/>
      ${ribs(cx, top, Math.max(rx, ry), 16, "#4a5a6e", 0.5)}
      <line x1="${cx}" y1="${top - 16}" x2="${cx}" y2="${top + ry + 6}" stroke="#1f2a36" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M ${cx} ${top + ry + 6} q 0 52 -34 52 q -26 0 -26 -22" fill="none" stroke="#6b4a2f" stroke-width="7" stroke-linecap="round"/>
      <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.25"/>
      </linearGradient></defs>
    </svg>`;
  }

  /* ---------- 法国 · 宫廷阳伞 ---------- */
  function france() {
    const cx = 300, top = 118, r = 150;
    let lace = "";
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI * (0.07 + 0.86 * (i / 20));
      const x = cx + Math.sin(a) * r;
      const y = top + Math.cos(a) * r;
      lace += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#f2e4ee" stroke="#d4a7c4" stroke-width="1.5"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${bg(`<g fill="#d4a7c4" opacity="0.4">
        <path d="M470 70 q6 10 0 14 q-6 -4 0 -14"/><path d="M120 90 q6 10 0 14 q-6 -4 0 -14"/>
      </g>`)}
      <line x1="${cx}" y1="${top + r + 4}" x2="${cx}" y2="${top + r + 72}" stroke="#8a6b42" stroke-width="4" stroke-linecap="round"/>
      <path d="M ${cx} ${top + r + 72} q0 40 26 40" fill="none" stroke="#8a6b42" stroke-width="6" stroke-linecap="round"/>
      <path d="M ${cx - r} ${top + r} A ${r} ${r * 0.82} 0 0 1 ${cx + r} ${top + r} Z" fill="#e8b8d0"/>
      <path d="M ${cx - r} ${top + r} A ${r} ${r * 0.82} 0 0 1 ${cx + r} ${top + r} Z" fill="url(#fg)"/>
      ${ribs(cx, top, r * 0.82, 12, "#c98bab", 0.4)}
      ${lace}
      <path d="M ${cx - 16} ${top - 2} q 8 -14 16 0 q 8 -14 16 0 q -8 4 -16 0 q -8 14 -16 0 Z" fill="#b5382e"/>
      <defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.35"/>
        <stop offset="1" stop-color="#a04a78" stop-opacity="0.2"/>
      </linearGradient></defs>
    </svg>`;
  }

  /* ---------- 泰国 · 清迈纸伞 ---------- */
  function thailand() {
    const cx = 300, top = 100, r = 155;
    let tassel = "";
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI * (0.08 + 0.84 * (i / 16));
      const x = cx + Math.sin(a) * r;
      const y = top + Math.cos(a) * r;
      tassel += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + 26).toFixed(1)}" stroke="#c47a2e" stroke-width="2.5"/>
                <circle cx="${x.toFixed(1)}" cy="${(y + 30).toFixed(1)}" r="3" fill="#c47a2e"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${bg(`<g fill="#3a6a5a" opacity="0.3">
        <ellipse cx="90" cy="90" rx="16" ry="6"/><ellipse cx="510" cy="80" rx="20" ry="7"/>
        <ellipse cx="500" cy="370" rx="18" ry="6"/>
      </g>`)}
      <line x1="${cx}" y1="${top + r + 6}" x2="${cx}" y2="${top + r + 84}" stroke="#6b4a2f" stroke-width="5" stroke-linecap="round"/>
      <path d="M ${cx - r} ${top + r} A ${r} ${r * 0.9} 0 0 1 ${cx + r} ${top + r} Z" fill="#3a6a5a"/>
      <path d="M ${cx - r} ${top + r} A ${r} ${r * 0.9} 0 0 1 ${cx + r} ${top + r} Z" fill="url(#tg)"/>
      ${ribs(cx, top, r * 0.9, 32, "#7aa88f", 0.5)}
      ${tassel}
      <circle cx="${cx}" cy="${top}" r="11" fill="#c47a2e"/>
      <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.3"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.2"/>
      </linearGradient></defs>
    </svg>`;
  }

  /* ---------- 印度 · 皇家伞盖 Chattri ---------- */
  function india() {
    const cx = 300, base = 330, w = 130;
    let arch = "";
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (i / 7);
      const x = cx + Math.cos(a) * w;
      arch += `<line x1="${x.toFixed(1)}" y1="${base}" x2="${x.toFixed(1)}" y2="${(base - 96).toFixed(1)}" stroke="#c47a2e" stroke-width="4"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${bg(`<g fill="#c47a2e" opacity="0.35">
        <circle cx="100" cy="80" r="3"/><circle cx="500" cy="100" r="3"/><circle cx="540" cy="330" r="3"/>
      </g>`)}
      <rect x="${cx - w - 26}" y="${base}" width="${(w + 26) * 2}" height="16" rx="4" fill="#a8622a"/>
      <rect x="${cx - w - 12}" y="${base - 12}" width="${(w + 12) * 2}" height="14" rx="4" fill="#c47a2e"/>
      ${arch}
      <path d="M ${cx - w - 12} ${base - 96} A ${w + 12} ${w + 12} 0 0 1 ${cx + w + 12} ${base - 96} Z" fill="#c47a2e"/>
      <path d="M ${cx - w - 12} ${base - 96} A ${w + 12} ${w + 12} 0 0 1 ${cx + w + 12} ${base - 96} Z" fill="url(#ig)"/>
      <circle cx="${cx}" cy="${base - 96 - (w + 12)}" r="8" fill="#e8c85a"/>
      <line x1="${cx}" y1="${base - 96 - (w + 12)}" x2="${cx}" y2="${base - 96 - (w + 12) - 20}" stroke="#e8c85a" stroke-width="4"/>
      <defs><linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.3"/>
        <stop offset="1" stop-color="#7a3a10" stop-opacity="0.25"/>
      </linearGradient></defs>
    </svg>`;
  }

  /* ---------- 埃及 · 法老仪仗伞 ---------- */
  function egypt() {
    const cx = 300, top = 112, r = 158;
    let feather = "";
    for (let i = 0; i <= 22; i++) {
      const a = Math.PI * (0.06 + 0.88 * (i / 22));
      const x = cx + Math.sin(a) * r;
      const y = top + Math.cos(a) * r;
      feather += `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} q ${(Math.sin(a) * 14).toFixed(1)} 8 ${(Math.sin(a) * 2).toFixed(1)} 26 q ${(-Math.sin(a) * 10).toFixed(1)} -8 ${(-Math.sin(a) * 16).toFixed(1)} -26 Z"
                 fill="#e8c85a" opacity="0.9"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${bg(`<g fill="#c9a15a" opacity="0.3">
        <rect x="80" y="70" width="30" height="4"/><rect x="490" y="60" width="36" height="4"/>
        <rect x="470" y="360" width="30" height="4"/>
      </g>`)}
      <line x1="${cx}" y1="${top + r + 6}" x2="${cx}" y2="${top + r + 80}" stroke="#b08a3a" stroke-width="5" stroke-linecap="round"/>
      <path d="M ${cx - r} ${top + r} A ${r} ${r * 0.86} 0 0 1 ${cx + r} ${top + r} Z" fill="#c9a15a"/>
      <path d="M ${cx - r} ${top + r} A ${r} ${r * 0.86} 0 0 1 ${cx + r} ${top + r} Z" fill="url(#egy)"/>
      ${ribs(cx, top, r * 0.86, 8, "#e8c85a", 0.5)}
      ${feather}
      <circle cx="${cx}" cy="${top}" r="9" fill="#b5382e"/>
      <circle cx="${cx}" cy="${top}" r="4" fill="#e8c85a"/>
      <defs><linearGradient id="egy" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.32"/>
        <stop offset="1" stop-color="#8a6420" stop-opacity="0.22"/>
      </linearGradient></defs>
    </svg>`;
  }

  const painters = {
    "japan-wagasa": japan,
    "england-silk": england,
    "france-parasol": france,
    "thailand-bosang": thailand,
    "india-chattri": india,
    "egypt-royal": egypt
  };

  /** 取某世界伞插画 SVG 字符串 */
  function get(id) {
    return (painters[id] || japan)();
  }

  return { get };
})();
