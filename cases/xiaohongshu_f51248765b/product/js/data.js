/* ========== 古建数字图谱 · 数据层 ========== */
/* 说明：所有构件均带编号(id)与中文名称(name)，geo 为几何参数，explode 为全拆解位移 */

const MAP_POINTS = [
  { name: "应县木塔", lon: 113.18, lat: 39.56, sub: "辽 · 1056年 · 山西朔州", featured: true, label: "right" },
  { name: "南禅寺大殿", lon: 112.99, lat: 38.68, sub: "唐 · 782年 · 山西忻州", featured: true, label: "right" },
  { name: "佛光寺东大殿", lon: 113.05, lat: 38.87, sub: "唐 · 857年 · 山西忻州", featured: false, label: "top" },
  { name: "晋祠圣母殿", lon: 112.43, lat: 37.69, sub: "北宋 · 1023年 · 山西太原", featured: false, label: "right" },
  { name: "镇国寺万佛殿", lon: 112.18, lat: 37.29, sub: "五代 · 963年 · 山西平遥", featured: false, label: "left" },
  { name: "永乐宫", lon: 110.50, lat: 34.72, sub: "元 · 1247年 · 山西芮城", featured: false, label: "right" },
  { name: "故宫", lon: 116.40, lat: 39.92, sub: "明 · 1420年 · 北京", featured: false, label: "bottom" },
  { name: "独乐寺观音阁", lon: 117.41, lat: 40.05, sub: "辽 · 984年 · 天津蓟州", featured: false, label: "right" },
  { name: "嵩岳寺塔", lon: 113.04, lat: 34.51, sub: "北魏 · 523年 · 河南登封", featured: false, label: "right" },
  { name: "大雁塔", lon: 108.96, lat: 34.22, sub: "唐 · 652年 · 陕西西安", featured: false, label: "right" },
  { name: "曲阜孔庙", lon: 117.00, lat: 35.61, sub: "明 · 1499年 · 山东曲阜", featured: false, label: "right" },
  { name: "武当山金殿", lon: 111.02, lat: 32.40, sub: "明 · 1416年 · 湖北十堰", featured: false, label: "right" },
  { name: "六和塔", lon: 120.12, lat: 30.20, sub: "北宋 · 970年 · 浙江杭州", featured: false, label: "right" },
  { name: "保国寺大殿", lon: 121.55, lat: 29.93, sub: "北宋 · 1013年 · 浙江宁波", featured: false, label: "right" },
  { name: "玄妙观三清殿", lon: 120.63, lat: 31.32, sub: "南宋 · 1179年 · 江苏苏州", featured: false, label: "left" },
  { name: "光孝寺", lon: 113.26, lat: 23.12, sub: "六朝 · 广东广州", featured: false, label: "right" },
  { name: "崇圣寺三塔", lon: 100.16, lat: 25.70, sub: "唐 · 9世纪 · 云南大理", featured: false, label: "right" },
  { name: "布达拉宫", lon: 91.13, lat: 29.66, sub: "唐/清 · 西藏拉萨", featured: false, label: "right" },
  { name: "沈阳故宫", lon: 123.43, lat: 41.80, sub: "清 · 1625年 · 辽宁沈阳", featured: false, label: "right" },
  { name: "岳阳楼", lon: 113.10, lat: 29.37, sub: "清 · 湖南岳阳", featured: false, label: "left" }
];

const BUILDINGS = {

  /* ================= 应县木塔 ================= */
  yx: {
    id: "yx",
    name: "应县木塔",
    fullName: "佛宫寺释迦塔",
    dynasty: "辽代",
    year: "1056年",
    location: "山西省朔州市应县",
    coords: [113.18, 39.56],
    intro: "佛宫寺释迦塔，俗称应县木塔，建于辽清宁二年（1056年），高67.31米，底层直径30.27米，是世界现存最古老、最高大的纯木结构楼阁式建筑。全塔无钉无铆，全靠斗拱、梁柱穿插咬合，历经千年风雨、多次地震巍然屹立，与意大利比萨斜塔、巴黎埃菲尔铁塔并称世界三大奇塔。",
    facts: [
      ["建造年代", "辽清宁二年（1056年）"],
      ["建筑高度", "67.31米"],
      ["平面形制", "八角形 · 五层六檐（含副阶重檐）"],
      ["结构特点", "明层与暗层（平坐）交替，内外两圈柱网"],
      ["斗拱种类", "全塔斗拱54种，堪称斗拱博物馆"],
      ["耗材", "红松木料约3000立方米，重约2600吨"]
    ],
    layers: [
      {
        id: "yx-l0", name: "台基层",
        comps: [
          { id: "YX-01", name: "台基", desc: "八角形石砌台基，叠涩收分，承托全塔荷载，使塔身稳固于地面。", geo: { kind: "platform", r: 16, h: 2 }, explode: [0, 0, 0] }
        ]
      },
      {
        id: "yx-l1", name: "一层 · 副阶",
        comps: [
          { id: "YX-11", name: "副阶檐柱", desc: "底层副阶外圈檐柱，环绕塔身形成回廊，是重檐下檐的支承。", geo: { kind: "porchColumns", r: 13.2, h: 6, n: 8 }, explode: [0, 2, 0], radial: 2.2 },
          { id: "YX-12", name: "塔身墙体", desc: "一层塔身土坯墙与板门，正面设门供礼佛通行，墙面隐出直棂窗。", geo: { kind: "wall", r: 11, h: 9, story: 1 }, explode: [0, 3.4, 0], radial: 1.2 },
          { id: "YX-13", name: "柱头铺作", desc: "一层柱头斗拱，双杪双下昂七铺作，出跳深远，承托上檐。", geo: { kind: "brackets", r: 10.6, n: 16, story: 1 }, explode: [0, 4.8, 0], radial: 0.6 },
          { id: "YX-14", name: "副阶下檐", desc: "重檐的下檐，八角坡面出挑深远，保护塔身免受雨淋。", geo: { kind: "eave", r: 15.6, h: 2.4, story: 1 }, explode: [0, 6.2, 0] },
          { id: "YX-15", name: "一层上檐", desc: "一层顶部屋檐，与副阶下檐构成重檐形制，檐角悬铃。", geo: { kind: "eave", r: 14.2, h: 2.4, story: 1 }, explode: [0, 7.6, 0] }
        ]
      },
      {
        id: "yx-l1b", name: "平坐 · 一层",
        comps: [
          { id: "YX-16", name: "平坐", desc: "暗层外挑平坐，周设栏杆，可供登临远眺，并大大增强塔身整体刚度。", geo: { kind: "balcony", r: 12.6 }, explode: [0, 9, 0] }
        ]
      },
      {
        id: "yx-l2", name: "二层",
        comps: [
          { id: "YX-21", name: "二层檐柱", desc: "外槽与内槽柱网，内外两圈立柱以梁枋相连，刚柔相济。", geo: { kind: "storyColumns", r: 10, h: 8, n: 8, story: 2 }, explode: [0, 10.4, 0], radial: 2.2 },
          { id: "YX-22", name: "二层塔身", desc: "二层塔身墙体与直棂窗，暗层中设有斜撑以加强结构。", geo: { kind: "wall", r: 9, h: 7, story: 2 }, explode: [0, 11.8, 0], radial: 1.2 },
          { id: "YX-23", name: "二层铺作", desc: "二层斗拱层，柱头铺作与补间铺作相间，承托二层屋檐。", geo: { kind: "brackets", r: 8.6, n: 16, story: 2 }, explode: [0, 13.2, 0], radial: 0.6 },
          { id: "YX-24", name: "二层屋檐", desc: "二层屋檐，八角攒尖坡面，檐口曲线柔美。", geo: { kind: "eave", r: 12.8, h: 2.2, story: 2 }, explode: [0, 14.6, 0] }
        ]
      },
      {
        id: "yx-l2b", name: "平坐 · 二层",
        comps: [
          { id: "YX-25", name: "平坐", desc: "二层上平坐，暗层结构，内藏斜撑与枋木拉结。", geo: { kind: "balcony", r: 11.4 }, explode: [0, 16, 0] }
        ]
      },
      {
        id: "yx-l3", name: "三层",
        comps: [
          { id: "YX-31", name: "三层檐柱", desc: "三层柱网，柱径收分，侧脚生起，稳健有力。", geo: { kind: "storyColumns", r: 9, h: 7.5, n: 8, story: 3 }, explode: [0, 17.4, 0], radial: 2.2 },
          { id: "YX-32", name: "三层塔身", desc: "三层塔身墙体，面南开窗，其余各面隐出窗棂。", geo: { kind: "wall", r: 8.2, h: 6.5, story: 3 }, explode: [0, 18.8, 0], radial: 1.2 },
          { id: "YX-33", name: "三层铺作", desc: "三层斗拱层，出跳承檐，形制与下两层呼应。", geo: { kind: "brackets", r: 7.8, n: 16, story: 3 }, explode: [0, 20.2, 0], radial: 0.6 },
          { id: "YX-34", name: "三层屋檐", desc: "三层屋檐，坡面举折平缓，出檐深远。", geo: { kind: "eave", r: 11.6, h: 2.2, story: 3 }, explode: [0, 21.6, 0] }
        ]
      },
      {
        id: "yx-l3b", name: "平坐 · 三层",
        comps: [
          { id: "YX-35", name: "平坐", desc: "三层上平坐，暗层内枋木纵横拉结，如箍束身。", geo: { kind: "balcony", r: 10.4 }, explode: [0, 23, 0] }
        ]
      },
      {
        id: "yx-l4", name: "四层",
        comps: [
          { id: "YX-41", name: "四层檐柱", desc: "四层柱网，柱身修长，收分明显。", geo: { kind: "storyColumns", r: 8.2, h: 7, n: 8, story: 4 }, explode: [0, 24.4, 0], radial: 2.2 },
          { id: "YX-42", name: "四层塔身", desc: "四层塔身墙体，门窗装修简洁。", geo: { kind: "wall", r: 7.5, h: 6, story: 4 }, explode: [0, 25.8, 0], radial: 1.2 },
          { id: "YX-43", name: "四层铺作", desc: "四层斗拱层，承托四层屋檐。", geo: { kind: "brackets", r: 7.1, n: 16, story: 4 }, explode: [0, 27.2, 0], radial: 0.6 },
          { id: "YX-44", name: "四层屋檐", desc: "四层屋檐，八角坡面，檐角微翘。", geo: { kind: "eave", r: 10.6, h: 2.2, story: 4 }, explode: [0, 28.6, 0] }
        ]
      },
      {
        id: "yx-l4b", name: "平坐 · 四层",
        comps: [
          { id: "YX-45", name: "平坐", desc: "四层上平坐，暗层结构，为顶层提供坚实基座。", geo: { kind: "balcony", r: 9.5 }, explode: [0, 30, 0] }
        ]
      },
      {
        id: "yx-l5", name: "五层",
        comps: [
          { id: "YX-51", name: "五层檐柱", desc: "顶层柱网，八柱攒聚，上承塔刹。", geo: { kind: "storyColumns", r: 7.5, h: 6.5, n: 8, story: 5 }, explode: [0, 31.4, 0], radial: 2.2 },
          { id: "YX-52", name: "五层塔身", desc: "五层塔身墙体，近顶收分，挺拔峻秀。", geo: { kind: "wall", r: 6.8, h: 5.5, story: 5 }, explode: [0, 32.8, 0], radial: 1.2 },
          { id: "YX-53", name: "五层铺作", desc: "顶层斗拱层，承托顶层屋檐与塔刹基座。", geo: { kind: "brackets", r: 6.4, n: 16, story: 5 }, explode: [0, 34.2, 0], radial: 0.6 },
          { id: "YX-54", name: "五层屋檐", desc: "顶层屋檐，八角攒尖，上接塔刹，直指苍穹。", geo: { kind: "eave", r: 9.6, h: 2.2, story: 5 }, explode: [0, 35.6, 0] }
        ]
      },
      {
        id: "yx-l6", name: "塔刹",
        comps: [
          { id: "YX-61", name: "塔刹", desc: "铁制塔刹，由覆钵、相轮、宝珠与刹杆组成，八条铁链系于檐角，兼具避雷与装饰之用。", geo: { kind: "spire" }, explode: [0, 40, 0] }
        ]
      }
    ]
  },

  /* ================= 南禅寺大殿 ================= */
  nc: {
    id: "nc",
    name: "南禅寺大殿",
    fullName: "南禅寺大佛殿",
    dynasty: "唐代",
    year: "782年",
    location: "山西省忻州市五台县",
    coords: [112.99, 38.68],
    intro: "南禅寺大殿建于唐建中三年（782年），面阔三间11.75米，进深三间10米，单檐歇山顶，是中国现存最古老的木构建筑，比著名的佛光寺东大殿还早75年。大殿斗拱雄大、出檐深远，梁架逻辑清晰，鸱吻为唐代原物，是研究唐代建筑不可替代的实物遗存。",
    facts: [
      ["建造年代", "唐建中三年（782年）"],
      ["面阔进深", "面阔三间11.75米 · 进深三间10米"],
      ["屋顶形制", "单檐歇山顶"],
      ["柱网", "檐柱12根 · 内柱4根"],
      ["斗拱", "五铺作双杪偷心造"],
      ["地位", "中国现存最早的木构建筑"]
    ],
    layers: [
      {
        id: "nc-l0", name: "台基层",
        comps: [
          { id: "NC-01", name: "台基", desc: "低矮石砌台基，素平无华，是唐代建筑典型的台基做法。", geo: { kind: "boxPlatform", w: 15.5, d: 13.5, h: 1.2 }, explode: [0, 0, 0] }
        ]
      },
      {
        id: "nc-l1", name: "柱网层",
        comps: [
          { id: "NC-11", name: "檐柱", desc: "十二根檐柱，柱头微有卷杀，侧脚与生起明显，使殿身稳固而富有弹性。", geo: { kind: "perimColumns", w: 11.75, d: 10, h: 5, r: 0.28 }, explode: [0, 1.5, 0], radial: 2.4 },
          { id: "NC-12", name: "内槽柱", desc: "四根内柱，高于檐柱，承托四椽栿，构成四架椽屋的承重骨架。", geo: { kind: "innerColumns", h: 6.4, r: 0.32 }, explode: [0, 2.5, 0], radial: 1.2 }
        ]
      },
      {
        id: "nc-l2", name: "围护层",
        comps: [
          { id: "NC-13", name: "墙体门窗", desc: "三面土坯墙，正面三间设板门，山面点缀直棂窗，装修古朴。", geo: { kind: "walls", w: 11.75, d: 10, h: 3.6 }, explode: [0, 3.5, 0], radial: 1.4 }
        ]
      },
      {
        id: "nc-l3", name: "斗拱层",
        comps: [
          { id: "NC-14", name: "柱头铺作", desc: "五铺作双杪偷心造斗拱，雄大疏朗，出檐深远，为唐代斗拱之孤例。", geo: { kind: "brackets", w: 11.75, d: 10, h: 1.1 }, explode: [0, 5, 0], radial: 0.5 }
        ]
      },
      {
        id: "nc-l4", name: "梁架层",
        comps: [
          { id: "NC-15", name: "四椽栿", desc: "大梁四椽栿横跨进深，上立蜀柱，是殿内最主要的承重构件。", geo: { kind: "beams", w: 11.75, d: 10 }, explode: [0, 6.5, 0] },
          { id: "NC-16", name: "平梁", desc: "平梁架于蜀柱之上，上承脊槫，梁短而受力精妙，为唐代梁架典型。", geo: { kind: "pingliang", w: 11.75, d: 10 }, explode: [0, 7.8, 0] },
          { id: "NC-17", name: "叉手托脚", desc: "叉手斜撑脊槫两侧，托脚斜抵平梁，防止梁架侧倾，为唐代典型做法。", geo: { kind: "chashou", w: 11.75, d: 10 }, explode: [0, 9, 0] }
        ]
      },
      {
        id: "nc-l5", name: "屋顶层",
        comps: [
          { id: "NC-18", name: "歇山屋顶", desc: "单檐歇山顶，屋面举折平缓，出檐深远，气势雄浑，为唐构屋顶之典范。", geo: { kind: "roof", w: 16.5, d: 14.5, rise: 3.6, ridge: 3.4 }, explode: [0, 11.5, 0] },
          { id: "NC-19", name: "脊饰鸱吻", desc: "正脊两端鸱吻为唐代原物，尾鳍内卷，是现存最早的鸱吻实例。", geo: { kind: "ridge", w: 16.5, d: 14.5, rise: 3.6, ridge: 3.4 }, explode: [0, 13.5, 0] }
        ]
      }
    ]
  }
};
