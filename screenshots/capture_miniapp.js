/**
 * 微信小程序自动截图脚本 v2
 * 使用 automator.launch 自动启动和控制
 */
const automator = require('miniprogram-automator');
const path = require('path');

const SCREENSHOT_DIR = __dirname;
const PROJECT_PATH = path.resolve(__dirname, '..');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshots() {
  console.log('🚀 启动小程序自动化...');

  const miniProgram = await automator.launch({
    projectPath: PROJECT_PATH,
  });

  console.log('✅ 小程序已启动');

  // 等待首页渲染
  const page = await miniProgram.currentPage();
  await sleep(3000);

  console.log('📊 当前页面:', page.path);

  // 截图 1: 行程 Tab（默认）
  console.log('📸 截图 1: 行程规划页...');
  await miniProgram.screenshot({ path: path.join(SCREENSHOT_DIR, '01-trip-planner.png') });
  console.log('  ✅ 01-trip-planner.png');

  // 截图 2: 装备
  console.log('📸 截图 2: 装备库页...');
  try {
    await page.setData({ activeTab: 'gear' });
  } catch (e) {
    console.log('  ⚠️ setData 失败, 尝试 callMethod...');
    await page.callMethod('switchTab', 'gear');
  }
  await sleep(1500);
  await miniProgram.screenshot({ path: path.join(SCREENSHOT_DIR, '02-gear-closet.png') });
  console.log('  ✅ 02-gear-closet.png');

  // 截图 3: 清单
  console.log('📸 截图 3: 打包清单页...');
  try {
    await page.setData({ activeTab: 'packing' });
  } catch (e) {
    await page.callMethod('switchTab', 'packing');
  }
  await sleep(1500);
  await miniProgram.screenshot({ path: path.join(SCREENSHOT_DIR, '03-packing-list.png') });
  console.log('  ✅ 03-packing-list.png');

  // 截图 4: 切换主题
  console.log('📸 截图 4: 切换主题（日系山野小清新）...');
  try {
    await page.setData({ activeTab: 'trip' });
  } catch (e) {
    await page.callMethod('switchTab', 'trip');
  }
  await sleep(1000);

  try {
    await page.setData({ currentTheme: 'nature' });
  } catch (e) {
    await page.callMethod('onToggleTheme');
  }
  await sleep(1500);
  await miniProgram.screenshot({ path: path.join(SCREENSHOT_DIR, '04-theme-nature.png') });
  console.log('  ✅ 04-theme-nature.png');

  console.log('\n✅ 所有截图完成！');

  await miniProgram.close();
}

takeScreenshots().catch(err => {
  console.error('❌ 截图失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
