/** 內場出單：用餐時段分組測試 */
import fs from 'fs';

const orders = [
  { status: '新訂單', slot: '17:00', sets: '春節四人套餐 ×2\n　涼拌：香煎瀑布牛涼拌（不辣）\n　飲料：泰式奶茶（冰）、檸檬茶（去冰）', alacarte: '泰式奶茶（熱）x2' },
  { status: '新訂單', slot: '17:00', sets: '春節兩人套餐 ×1\n　飲料：泰式奶茶（冰）、泰式奶茶（冰）', alacarte: '' },
  { status: '新訂單', slot: '19:30', sets: '春節六人套餐 ×1\n　肉類：咔滋椒麻雞\n　飲料：泰式奶茶（冰）', alacarte: '' },
  { status: '新訂單', slot: '', sets: '春節兩人套餐 ×1\n　飲料：檸檬茶（冰）', alacarte: '' },
  { status: '已取消', slot: '19:30', sets: '春節十人套餐 ×9', alacarte: '' },
];

let captured = '';
const el = () => ({
  style: {}, dataset: {}, classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
  addEventListener() {}, setAttribute() {}, insertBefore() {}, appendChild() {},
  querySelector: () => null, querySelectorAll: () => [],
  set innerHTML(v) { captured = v; }, get innerHTML() { return captured; },
});
global.document = {
  readyState: 'complete',
  head: { appendChild() {} },
  body: { appendChild() {}, classList: { add() {}, remove() {} } },
  createElement: el, getElementById: () => null, querySelector: () => null, addEventListener() {},
};
global.window = { __staffOrders: orders };

await import('../js/staff-kitchen.js');
window.kitchenOpen();

const text = captured.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
console.log(text);

const check = (cond, label) => console.log((cond ? '✅ ' : '❌ ') + label);
console.log('\n--- 檢查 ---');
check(text.includes('17:00'), '出現 17:00 時段');
check(text.includes('19:30'), '出現 19:30 時段');
check(text.includes('未指定時段'), '未填時段的訂單歸到「未指定時段」');
check(text.includes('2 張・') || text.includes('2 張'), '17:00 有 2 張');
check(!text.includes('春節十人套餐'), '已取消的訂單不列入');
process.exit(0);
