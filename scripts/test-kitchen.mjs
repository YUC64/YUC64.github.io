/**
 * 內場出單彙總邏輯測試（不需瀏覽器）
 *   node scripts/test-kitchen.mjs
 */
import fs from 'fs';

const real = JSON.parse(fs.readFileSync(process.env.LOCALAPPDATA + '\\Temp\\staff.json', 'utf8')).orders;

const crafted = [
  { orderId: 'XT1', status: '新訂單', name: '甲', car: 'ABC-1234',
    sets: '春節四人套餐 ×2\n\u3000涼拌：香煎瀑布牛涼拌\n\u3000肉類：咔滋椒麻雞（不辣）\n\u3000青菜：泰炒什錦蔬菜\n\u3000飲料：泰式奶茶（冰）、泰式奶茶（冰）、檸檬茶（去冰）\n\u3000內含：冠軍月亮蝦餅、檸香蒸扁鱈',
    alacarte: '香煎瀑布牛涼拌(不辣) x1、泰式奶茶（熱）x2' },
  { orderId: 'XT2', status: '新訂單', name: '乙',
    sets: '春節四人套餐 ×1\n\u3000涼拌：香煎瀑布牛涼拌\n\u3000肉類：咔滋椒麻雞\n\u3000青菜：蒜香乾蝦小豆苗、蒜香乾蝦小豆苗\n\u3000飲料：檸檬茶（冰）\n\u3000內含：冠軍月亮蝦餅',
    alacarte: '' },
  { orderId: 'XT3', status: '已取消', name: '丙', sets: '春節兩人套餐 ×9', alacarte: '泰式奶茶（熱）x9' },
];

let captured = '';
const el = () => ({
  style: {}, dataset: {}, classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
  addEventListener() {}, setAttribute() {}, insertBefore() {}, appendChild() {}, querySelector: () => null,
  querySelectorAll: () => [], set innerHTML(v) { captured = v; }, get innerHTML() { return captured; },
});
global.document = {
  readyState: 'complete', head: { appendChild() {} }, body: { appendChild() {} },
  createElement: el, getElementById: () => null, querySelector: () => null, addEventListener() {},
};
global.window = { __staffOrders: crafted };
await import('../js/staff-kitchen.js');
window.kitchenOpen();
const text = captured.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim();

const check = (cond, label) => console.log((cond ? '  ✅ ' : '  ❌ ') + label);
console.log('① 彙總（3 張單，其中 1 張已取消 → 應只算 2 張）');
check(text.includes('有效訂單 2 張'), '有效訂單 2 張');
check(text.includes('套餐共 3 份'), '套餐共 3 份（四人套餐 2＋1）');
check(text.includes('春節四人套餐') && text.includes('×3'), '春節四人套餐 ×3');
check(!text.includes('春節兩人套餐'), '已取消的訂單不列入');
console.log('② 套餐選項');
check(text.includes('香煎瀑布牛涼拌') && text.includes('×3'), '套餐涼拌：香煎瀑布牛涼拌 ×3');
check(text.includes('不辣 2'), '標示不辣份數（咔滋椒麻雞 ×2 不辣）');
check(text.includes('蒜香乾蝦小豆苗') && text.includes('×2'), '同一道選兩份 → ×2');
console.log('③ 飲料');
check(text.includes('泰式奶茶(冰)') && text.includes('×4'), '泰式奶茶(冰) ×4');
check(text.includes('檸檬茶(去冰)') && text.includes('×2'), '檸檬茶(去冰) ×2');
check(text.includes('泰式奶茶（熱）') && text.includes('×2'), '單點泰式奶茶（熱）×2');
console.log('④ 隨餐附贈／單點');
check(text.includes('冠軍月亮蝦餅') && text.includes('×3'), '冠軍月亮蝦餅 ×3');
check(text.includes('香煎瀑布牛涼拌（不辣）') && text.includes('×1'), '單點不辣另計 ×1');
console.log('⑤ 訂單清單');
check(text.includes('XT1') && text.includes('ABC-1234'), '訂單編號與車號帶出');
console.log('\n--- 摘要輸出（節錄）---');
console.log(text.split('\n').slice(0, 22).join('\n'));

console.log('\n⑥ 空資料（真實資料全是已取消）');
global.window.__staffOrders = real;
captured = '';
window.kitchenOpen();
check(captured.includes('目前沒有有效訂單'), '顯示「目前沒有有效訂單」');
