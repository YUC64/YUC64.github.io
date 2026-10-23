/* =============================================================================
 *  【饗泰多 SIAM MORE】2027 春節內用預訂 — 菜單資料
 *  資料來源：門市「2027 年春節內用菜單」PDF
 *  - 套餐：需先選套餐才能單點加點（見 CONFIG.rules）
 *  - 單點價目、套餐組合與「選 N」規則完全依照 PDF
 *  - 辣度（辣椒圖示數量）逐項依照 PDF 標示
 *  - 冰／去冰／熱選項依照 PDF 標示，泰式奶茶另提供「去冰」
 *  圖片：assets/img/<key>.jpg（Wikimedia Commons 免費授權，見 assets/img/credits.json；
 *        若檔案不存在，前端會自動以品牌色浮水印卡片代替）
 * ========================================================================== */

const IMG = (key) => `assets/img/${key}.jpg`;

/* ---------------------------------------------------------------------------
 *  辣度表：數字 = PDF 上該道菜的辣椒圖示數量（0/1/2）
 *  查詢時會自動去掉「（大）」「（10 塊）」等後綴
 * ------------------------------------------------------------------------ */
const SPICY = {
  '香煎瀑布牛涼拌': 1, '酸辣海鮮涼拌': 2, '現搗青木瓜涼拌': 1,
  '瑪莎曼燉牛肉': 1, '泰香炙烤牛小排': 0, '爆爽辣炒牛': 2, '蠔氣爆炒牛': 0,
  '蜜醬炙烤肋排': 0, '秘醬炙烤肋排': 0, '扒飯打拋豬': 2, '香烤松阪豬': 0,
  '黃金咖哩雞': 0, '咔滋椒麻雞': 2, '帕能咖哩雞': 1,
  '厚煎海鮮烘蛋': 0, '泰滑蝦扯蛋': 0, '金湯椰香豆腐煲': 0,
  '冠軍月亮蝦餅': 0, '黃咖哩軟殼蟹': 1, '檸香蒸扁鱈': 2, '檸香酸辣小卷': 1,
  '清香檸檬魚': 1,
  '泰香炒野蓮': 0, '泰炒什錦蔬菜': 0, '蒜香乾蝦小豆苗': 0,
  '冬蔭海鮮湯': 2, '蝦仁玉米湯': 0, '香茅椰肉蛤蜊雞湯': 0, '青檸酸辣海鮮湯': 2,
  '蛋素青木瓜涼拌': 0, '清炒水蓮': 0, '清炒什錦蔬菜': 0, '鮮菇玉米湯': 0, '香茅椰肉野菇湯': 0,
  '摩摩喳喳': 0, '椰香黑糯米': 0,
  '泰式奶茶': 0, '檸檬茶': 0, '荔枝冰茶啵啵': 0, '泰象啤酒': 0, '臺虎嗨啤': 0, '可樂': 0,
  '泰國香米飯': 0, '蒜酥松阪蝦醬拌飯': 0,
};

/** 去掉「（大）」「(大)」「（10 塊）」等後綴 */
const stripSize = (name) => String(name).replace(/[（(][^）)]*[）)]/g, '').trim();

/** 取某道菜的辣度（0 = 不辣） */
const spicyOf = (name) => SPICY[stripSize(name)] ?? 0;

/* ---------------------------------------------------------------------------
 *  冰／去冰／熱選項（依 PDF：摩摩喳喳 冰/去冰、椰香黑糯米 冷/熱、泰式奶茶 冰/熱 + 去冰）
 * ------------------------------------------------------------------------ */
const TEMPS = {
  '泰式奶茶': ['冰', '去冰', '熱'],
  '摩摩喳喳': ['冰', '去冰'],
  '椰香黑糯米': ['冷', '熱'],
};
const tempsOf = (name) => TEMPS[stripSize(name)] || [];

/* 套餐的「飲料升級」選項（PDF：可加價升級酒類/特調飲品；價差依現場公告，購物車不加價） */
const DRINK_UPGRADES = ['荔枝冰茶啵啵', '泰象啤酒', '臺虎嗨啤'];

/** 5 個春節套餐。fixed = 隨套餐附贈的「套餐特選」；groups = 需選 N 的品項。 */
const SETS = [
  {
    id: 'set2',
    name: '春節兩人套餐',
    price: 1760,
    people: 2,
    dishLine: '4 菜、白飯、飲料',
    img: IMG('set2'),
    fixed: ['冠軍月亮蝦餅'],
    groups: [
      { key: 'cold',  label: '涼拌', pick: 1, options: ['酸辣海鮮涼拌', '香煎瀑布牛涼拌'] },
      { key: 'meat',  label: '肉類', pick: 1, options: ['爆爽辣炒牛', '扒飯打拋豬', '咔滋椒麻雞'] },
      { key: 'veg',   label: '青菜', pick: 1, options: ['泰香炒野蓮', '泰炒什錦蔬菜'] },
    ],
    drinkPick: 2,
    rice: '泰國香米飯 x2 人',
  },
  {
    id: 'set4',
    name: '春節四人套餐',
    price: 3520,
    people: 4,
    dishLine: '7 菜、1 湯、白飯、飲料',
    img: IMG('set4'),
    fixed: ['冠軍月亮蝦餅', '檸香蒸扁鱈', '帕能咖哩雞'],
    groups: [
      { key: 'cold',  label: '涼拌',   pick: 1, options: ['酸辣海鮮涼拌', '香煎瀑布牛涼拌'] },
      { key: 'meat',  label: '肉類',   pick: 1, options: ['爆爽辣炒牛', '扒飯打拋豬', '咔滋椒麻雞'] },
      { key: 'veg',   label: '青菜',   pick: 1, options: ['泰香炒野蓮', '泰炒什錦蔬菜'] },
      { key: 'egg',   label: '蛋豆腐', pick: 1, options: ['厚煎海鮮烘蛋', '金湯椰香豆腐煲', '泰滑蝦扯蛋'] },
      { key: 'soup',  label: '湯品',   pick: 1, options: ['青檸酸辣海鮮湯', '香茅椰肉蛤蜊雞湯'] },
    ],
    drinkPick: 4,
    rice: '泰國香米飯 x4 人',
  },
  {
    id: 'set6',
    name: '春節六人套餐',
    price: 5280,
    people: 6,
    dishLine: '10 菜、1 湯、白飯、飲料',
    img: IMG('set6'),
    fixed: ['清香檸檬魚', '冠軍月亮蝦餅', '泰香炙烤牛小排', '黃咖哩軟殼蟹'],
    groups: [
      { key: 'cold',  label: '涼拌',   pick: 1, options: ['酸辣海鮮涼拌', '香煎瀑布牛涼拌'] },
      { key: 'curry', label: '咖哩',   pick: 1, options: ['黃金咖哩雞', '瑪莎曼燉牛肉', '帕能咖哩雞'] },
      { key: 'meat',  label: '肉類',   pick: 1, options: ['爆爽辣炒牛', '扒飯打拋豬', '咔滋椒麻雞'] },
      { key: 'egg',   label: '蛋豆腐', pick: 1, options: ['厚煎海鮮烘蛋', '金湯椰香豆腐煲', '泰滑蝦扯蛋'] },
      { key: 'veg',   label: '青菜',   pick: 2, options: ['蒜香乾蝦小豆苗', '泰炒什錦蔬菜', '泰香炒野蓮'] },
      { key: 'soup',  label: '湯品',   pick: 1, options: ['青檸酸辣海鮮湯', '香茅椰肉蛤蜊雞湯'] },
    ],
    drinkPick: 6,
    rice: '泰國香米飯 x6 人',
  },
  {
    id: 'set8',
    name: '春節八人套餐',
    price: 7060,
    people: 8,
    dishLine: '11 菜、2 湯、白飯、飲料',
    img: IMG('set8'),
    fixed: ['清香檸檬魚', '冠軍月亮蝦餅', '泰香炙烤牛小排（大）', '黃咖哩軟殼蟹'],
    groups: [
      { key: 'cold',  label: '涼拌',   pick: 1, options: ['酸辣海鮮涼拌', '香煎瀑布牛涼拌'] },
      { key: 'curry', label: '咖哩',   pick: 1, options: ['黃金咖哩雞', '瑪莎曼燉牛肉', '帕能咖哩雞'] },
      { key: 'meat',  label: '肉類',   pick: 2, options: ['扒飯打拋豬', '爆爽辣炒牛', '咔滋椒麻雞'] },
      { key: 'egg',   label: '蛋豆腐', pick: 1, options: ['厚煎海鮮烘蛋', '金湯椰香豆腐煲', '泰滑蝦扯蛋'] },
      { key: 'veg',   label: '青菜',   pick: 2, options: ['蒜香乾蝦小豆苗（大）', '泰炒什錦蔬菜（大）', '泰香炒野蓮（大）'] },
      { key: 'soup',  label: '湯品',   pick: 2, options: ['青檸酸辣海鮮湯', '香茅椰肉蛤蜊雞湯'] },
    ],
    drinkPick: 8,
    rice: '泰國香米飯 x8 人',
  },
  {
    id: 'set10',
    name: '春節十人套餐',
    price: 8888,
    people: 10,
    dishLine: '14 菜、2 湯、白飯、飲料',
    img: IMG('set10'),
    fixed: ['清香檸檬魚', '冠軍月亮蝦餅（大）', '秘醬炙烤肋排（10 塊）', '泰香炙烤牛小排（大）', '黃咖哩軟殼蟹'],
    groups: [
      { key: 'cold',  label: '涼拌',   pick: 2, options: ['酸辣海鮮涼拌（大）', '香煎瀑布牛涼拌（大）'] },
      { key: 'curry', label: '咖哩',   pick: 1, options: ['黃金咖哩雞', '瑪莎曼燉牛肉', '帕能咖哩雞'] },
      { key: 'meat',  label: '肉類',   pick: 2, options: ['扒飯打拋豬', '爆爽辣炒牛', '咔滋椒麻雞'] },
      { key: 'egg',   label: '蛋豆腐', pick: 2, options: ['厚煎海鮮烘蛋', '金湯椰香豆腐煲', '泰滑蝦扯蛋'] },
      { key: 'veg',   label: '青菜',   pick: 2, options: ['蒜香乾蝦小豆苗（大）', '泰炒什錦蔬菜（大）', '泰香炒野蓮（大）'] },
      { key: 'soup',  label: '湯品',   pick: 2, options: ['青檸酸辣海鮮湯', '香茅椰肉蛤蜊雞湯'] },
    ],
    drinkPick: 10,
    rice: '泰國香米飯 x10 人',
  },
];

/** 單點分類（依 PDF 分類與排序） */
const CATEGORIES = [
  { key: 'cold',     label: '涼拌' },
  { key: 'beef',     label: '牛肉' },
  { key: 'pork',     label: '豬肉' },
  { key: 'chicken',  label: '雞肉' },
  { key: 'seafood',  label: '海鮮' },
  { key: 'eggtofu',  label: '蛋豆腐' },
  { key: 'veg',      label: '青菜' },
  { key: 'soup',     label: '湯品' },
  { key: 'veggie',   label: '素食' },
  { key: 'dessert',  label: '甜點' },
  { key: 'drink',    label: '飲料' },
  { key: 'staple',   label: '主食' },
];

/** 單點品項。unit = 單位說明（如「/人」） */
const ALC = [
  { id: 'a01', cat: 'cold',    name: '香煎瀑布牛涼拌',   price: 410, img: IMG('beefsalad') },
  { id: 'a02', cat: 'cold',    name: '酸辣海鮮涼拌',     price: 400, img: IMG('seafoodsalad') },
  { id: 'a03', cat: 'cold',    name: '現搗青木瓜涼拌',   price: 270, img: IMG('somitam') },

  { id: 'a04', cat: 'beef',    name: '瑪莎曼燉牛肉',     price: 510, img: IMG('massaman') },
  { id: 'a05', cat: 'beef',    name: '泰香炙烤牛小排',   price: 710, img: IMG('shortrib') },
  { id: 'a06', cat: 'beef',    name: '爆爽辣炒牛',       price: 360, img: IMG('stirfrybeef') },
  { id: 'a07', cat: 'beef',    name: '蠔氣爆炒牛',       price: 360, img: IMG('oysterbeef') },

  { id: 'a08', cat: 'pork',    name: '蜜醬炙烤肋排',     price: 610, img: IMG('spareribs') },
  { id: 'a09', cat: 'pork',    name: '扒飯打拋豬',       price: 320, img: IMG('krapao') },
  { id: 'a10', cat: 'pork',    name: '香烤松阪豬',       price: 390, img: IMG('porkneck') },

  { id: 'a11', cat: 'chicken', name: '黃金咖哩雞',       price: 330, img: IMG('yellowcurry') },
  { id: 'a12', cat: 'chicken', name: '咔滋椒麻雞',       price: 330, img: IMG('crispychicken') },
  { id: 'a13', cat: 'chicken', name: '帕能咖哩雞',       price: 350, img: IMG('panang') },

  { id: 'a14', cat: 'seafood', name: '冠軍月亮蝦餅',     price: 480, img: IMG('fishcake'), hot: true },
  { id: 'a15', cat: 'seafood', name: '黃咖哩軟殼蟹',     price: 580, img: IMG('softshell') },
  { id: 'a16', cat: 'seafood', name: '檸香蒸扁鱈',       price: 500, img: IMG('halibut') },
  { id: 'a17', cat: 'seafood', name: '檸香酸辣小卷',     price: 480, img: IMG('squid') },

  { id: 'a18', cat: 'eggtofu', name: '厚煎海鮮烘蛋',     price: 330, img: IMG('omelette') },
  { id: 'a19', cat: 'eggtofu', name: '泰滑蝦扯蛋',       price: 350, img: IMG('shrimpegg') },
  { id: 'a20', cat: 'eggtofu', name: '金湯椰香豆腐煲',   price: 380, img: IMG('tofupot') },

  { id: 'a21', cat: 'veg',     name: '泰香炒野蓮',       price: 260, img: IMG('watermimosa') },
  { id: 'a22', cat: 'veg',     name: '泰炒什錦蔬菜',     price: 240, img: IMG('mixedveg') },
  { id: 'a23', cat: 'veg',     name: '蒜香乾蝦小豆苗',   price: 350, img: IMG('peashoots') },

  { id: 'a24', cat: 'soup',    name: '冬蔭海鮮湯',       price: 390, img: IMG('tomyam') },
  { id: 'a25', cat: 'soup',    name: '蝦仁玉米湯',       price: 380, img: IMG('cornshrimp') },
  { id: 'a26', cat: 'soup',    name: '香茅椰肉蛤蜊雞湯', price: 380, img: IMG('tomkha') },
  { id: 'a27', cat: 'soup',    name: '青檸酸辣海鮮湯',   price: 420, img: IMG('sourtomsoup') },

  { id: 'a28', cat: 'veggie',  name: '蛋素青木瓜涼拌',   price: 260, img: IMG('vegsomtam'), veg: true },
  { id: 'a29', cat: 'veggie',  name: '清炒水蓮',         price: 220, img: IMG('waterlily'), veg: true },
  { id: 'a30', cat: 'veggie',  name: '清炒什錦蔬菜',     price: 220, img: IMG('vegmixed'), veg: true },
  { id: 'a31', cat: 'veggie',  name: '鮮菇玉米湯',       price: 320, img: IMG('mushroomsoup'), veg: true },
  { id: 'a32', cat: 'veggie',  name: '香茅椰肉野菇湯',   price: 300, img: IMG('mushroomcoconut'), veg: true },

  { id: 'a33', cat: 'dessert', name: '摩摩喳喳',         price: 100, img: IMG('momo'), unit: '冰／去冰' },
  { id: 'a34', cat: 'dessert', name: '椰香黑糯米',       price: 100, img: IMG('blackrice'), unit: '冷／熱' },

  { id: 'a35', cat: 'drink',   name: '泰式奶茶',         price: 120, img: IMG('thaitea'), unit: '冰／去冰／熱' },
  { id: 'a36', cat: 'drink',   name: '檸檬茶',           price: 120, img: IMG('lemontea') },
  { id: 'a37', cat: 'drink',   name: '荔枝冰茶啵啵',     price: 150, img: IMG('lycheetea') },
  { id: 'a38', cat: 'drink',   name: '泰象啤酒',         price: 150, img: IMG('changbeer'), alcohol: true },
  { id: 'a39', cat: 'drink',   name: '臺虎嗨啤',         price: 130, img: IMG('craftbeer'), alcohol: true },
  { id: 'a40', cat: 'drink',   name: '可樂',             price:  60, img: IMG('cola') },

  { id: 'a41', cat: 'staple',  name: '泰國香米飯',       price:  40, img: IMG('rice'), unit: '/人' },
  { id: 'a42', cat: 'staple',  name: '蒜酥松阪蝦醬拌飯', price: 420, img: IMG('shrimppaste_rice') },
];

/** 套餐飲料可選品項 */
const DRINK_OPTIONS = ['泰式奶茶', '檸檬茶'];

/* 供 app.js 使用 */
window.MENU = { SETS, ALC, CATEGORIES, DRINK_OPTIONS, DRINK_UPGRADES, SPICY, TEMPS, spicyOf, tempsOf, stripSize };
