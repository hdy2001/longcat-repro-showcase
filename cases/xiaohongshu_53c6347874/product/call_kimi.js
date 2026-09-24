// 调用 Kimi K3 (OpenRouter: moonshotai/kimi-k3) 生成应县木塔 Three.js 建模代码（支持截断续写）
const fs = require('fs');
const path = require('path');

const KEY = fs.readFileSync(path.join(process.env.HOME, '.claude/openrouter-kimi.env'), 'utf8').match(/ANTHROPIC_AUTH_TOKEN="([^"]+)"/)[1];

const WS = 'workspace';

function img64(p) {
  const b = fs.readFileSync(p);
  return 'data:image/jpeg;base64,' + b.toString('base64');
}

const images = [
  ['img_00.jpg', '图1：应县木塔整体外观渲染图（带台基，八角五层屋檐+副阶，攒尖顶带塔刹）'],
  ['scene_05.jpg', '图2：斗拱、平坐栏杆、屋檐瓦面细部'],
  ['scene_08.jpg', '图3：首层内槽柱与梁架（从内槽向上看的仰视视角）'],
  ['scene_09.jpg', '图4：首层内槽柱与梁架另一视角'],
  ['scene_10.jpg', '图5：二层暗层斜撑体系（X形斜撑、短柱、水平构件）'],
];

const systemPrompt = `你是一位精通 Three.js 和中国古建筑结构的三维建模工程师。你的任务是编写一个完整的单文件 HTML 网页，用 Three.js 程序化搭建一座高还原度的「应县木塔（佛宫寺释迦塔）」三维模型。

【建筑事实依据 —— 必须严格遵守】
1. 应县木塔建于辽代1056年，八角形平面，外观5层屋檐+首层副阶（重檐效果），从外看共6层屋檐；结构上每两层明层之间夹一个暗层，共9个结构层。
2. 总高约67.3米（含塔刹）。台基为两层石砌八角/方形台基，带踏道。
3. 首层：台基之上是副阶（环绕首层的走廊，带独立屋檐），副阶内是首层塔身（内外两圈柱子：外槽柱+内槽柱，内槽供奉佛像）。副阶屋檐使首层看起来是重檐。
4. 二至五层：每层由「明层（有门窗、平坐栏杆）+ 暗层（内有斜撑、短柱、水平枋木，无外窗）」组成。明层四周有平坐（挑出的阳台）和栏杆。
5. 每层屋檐：八角攒尖/庑殿式灰瓦屋面，出檐深远，檐口起翘明显（飞檐），檐下有一圈密集斗拱。顶层为八角攒尖顶，上立塔刹（刹杆、宝珠、相轮等，铁制）。
6. 色彩：柱子、门窗为深红褐色；斗拱、栏杆、梁枋为木本色偏黄褐（可略施彩画：柱头、斗拱端部有青绿点缀）；屋面为青灰色瓦；台基为浅灰白石色。
7. 材质感：木纹（可用程序化贴图或色块区分明暗面），瓦垄要一层层做出来（沿屋面放射状排列的瓦垄线条），飞檐翘角要明显。

【参考图说明】
- 图1给出整体比例：台基→副阶重檐→逐层收分（每层平面尺寸逐层递减、屋檐略向上收）→攒尖顶+塔刹。层间比例大致：首层最高，向上各层递减。
- 图2给出斗拱和栏杆的细部做法：斗拱为典型的辽代五铺作双杪偷心造样式（至少做出"斗+拱+翘"两层出跳的简化体块序列，每朵斗拱由坐斗、横拱、华拱/下昂体块组成，逐攒排列）；栏杆为寻杖+盆唇+地栿式木栏杆。
- 图3/图4给出首层内槽梁架：内槽柱柱头用阑额、普拍枋连接，柱头铺作承托梁架（乳栿/草栿），梁上有叉手、托脚，顶部有平闇天花板。
- 图5给出暗层斜撑：暗层外槽柱之间有大面积X形交叉斜撑（两根对角斜木在中间交叉），斜撑与水平枋、短柱共同构成桁架式受力层，这是应县木塔抗震的关键特征。

【代码要求】
1. 单个 HTML 文件，Three.js 使用 CDN：https://unpkg.com/three@0.160.0/build/three.min.js（纯全局 THREE，不用 ES module import，不用 OrbitControls 插件，轨道控制器请自己手写：鼠标拖拽旋转+滚轮缩放+右键平移）。
2. 必须全部程序化建模（参数化），不允许只放一个平面图片。整个场景分组建模：台基、副阶（含副阶屋檐）、塔身各层（柱子、墙体门窗、斗拱层、暗层斜撑、平坐栏杆、屋檐屋面）、塔刹、佛像（首层内槽中央一个简化大佛像即可）。
3. 用函数封装可复用构件：makeDougong()（斗拱攒）、makeEaveRoof(半径,出檐,翘角)（八角屋面+瓦垄+檐口起翘）、makeBalcony()（平坐栏杆）、makeBrace()（X斜撑）、makeColumn()、makeLatticeDoor()（直棂窗/格子门）等，逐层循环调用并做逐层收分。
4. 屋檐做法：用 CylinderGeometry(8段) 做屋面主体（上小下大的截锥），瓦垄用沿圆周均布的细条（细 BoxGeometry 沿半径方向贴在屋面斜面上），檐口加起翘（可对屋面顶点做径向位移让8个角上翘）。檐椽、飞子可用放射状细条表示。
5. 斗拱层：在檐口上方、每层柱头位置和补间位置均布斗拱攒（每边柱头1攒+补间2攒左右），每攒用几个小体块拼出"坐斗+下跳华拱+横拱"的出跳形状，整齐排列形成一圈斗拱带。
6. 墙体：每层外槽柱之间做浅红色墙体，正面开门、两侧开直棂窗（用细木条做格子），门窗要有凹凸厚度。
7. 暗层：在明层屋檐之上做一段较矮的封闭塔身（墙面无窗，颜色略深），其外槽柱之间表现X形斜撑（可用交叉斜置的方木枋，两端搭在柱与阑额上），让结构特征可见。
8. 平坐：每层明层底部向外挑出一圈平台（挑出约一个斗拱跳头），四周做木栏杆（寻杖+盆唇+地栿+短柱，均布）。
9. 塔刹：攒尖顶中央立刹杆（细长圆柱），串3-4个相轮（扁圆环/圆盘）和宝珠（小球），刹顶有细长避雷针式尖顶。
10. 光照：半球光+平行光（带阴影）+淡灰背景雾效，地面一个浅灰圆形台面。手写轨道控制器（阻尼惯性）。
11. 窗口自适应 resize，requestAnimationFrame 渲染循环。整体配色参考图1：木构偏黄褐、墙体偏红褐、屋面青灰、台基浅灰。
12. 避免 z-fighting；总三角形数控制在百万以内保证流畅。
13. 代码紧凑但完整可运行，优先保证功能完整，能一次输出完。

请直接输出完整 HTML 文件内容，不要任何解释性文字，可以用一个 html 代码块包裹。所有几何体参数要具体数值，不要留 placeholder。`;

async function rawCall(messages, outFile) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KEY}`,
      'HTTP-Referer': 'http://localhost',
      'X-Title': 'kimi-k3-pagoda',
    },
    body: JSON.stringify({
      model: 'moonshotai/kimi-k3',
      messages,
      max_tokens: 13000,
      temperature: 0.6,
    }),
  });
  const j = await res.json();
  fs.writeFileSync(outFile, JSON.stringify(j, null, 2));
  if (!res.ok || !j.choices) {
    console.error('API error:', JSON.stringify(j).slice(0, 500));
    return null;
  }
  const choice = j.choices[0];
  console.log('finish_reason:', choice.finish_reason, '| usage:', JSON.stringify(j.usage));
  return choice.message.content;
}

(async () => {
  const userContent = [
    { type: 'text', text: '请根据以下参考图，编写应县木塔的 Three.js 程序化建模单文件 HTML。\n\n参考图：' },
    ...images.map(([f]) => ({ type: 'image_url', image_url: { url: img64(path.join(WS, 'inputs', f)), detail: 'high' } })),
    { type: 'text', text: '\n补充描述：' + images.map(([, d]) => d).join('；') + '。\n\n' + systemPrompt },
  ];
  let messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  let all = '';
  for (let round = 1; round <= 4; round++) {
    const content = await rawCall(messages, path.join(WS, `kimi_raw_${round}.json`));
    if (content == null) { console.error('API failed at round', round); process.exit(1); }
    all += content;
    console.log(`round ${round}: got ${content.length} chars`);
    const j = JSON.parse(fs.readFileSync(path.join(WS, `kimi_raw_${round}.json`), 'utf8'));
    if (j.choices[0].finish_reason !== 'length') {
      console.log('=== COMPLETE ===');
      break;
    }
    messages.push({ role: 'assistant', content });
    messages.push({ role: 'user', content: '你上一个回答因为长度被截断了。请从中断处继续输出剩余的代码（不要重复已输出的部分，直接从断点续写，保持代码连续完整）。' });
  }
  fs.writeFileSync(path.join(WS, 'kimi_response_1.md'), all);
  console.log('saved kimi_response_1.md, total', all.length, 'chars');
})().catch(e => { console.error(e); process.exit(1); });
