"""TrailReady 小程序展示截图脚本（通过 Web 版截取）"""
import asyncio
import os

from playwright.async_api import async_playwright

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "http://localhost:3000"


async def screenshot(page, filename):
    path = os.path.join(OUT_DIR, filename)
    # 使用 iPhone 15 Pro 视口模拟小程序效果
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.screenshot(path=path, full_page=True)
    print(f"✅ {filename}")
    # 恢复桌面视口
    await page.set_viewport_size({"width": 1440, "height": 900})


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        page = await context.new_page()

        # ────── Screenshot 1: 行程规划主页（默认扎营模式） ──────
        print("📸 截图 1: 行程规划（扎营模式）...")
        await page.goto(BASE_URL, wait_until="networkidle")
        await page.wait_for_timeout(2000)
        await screenshot(page, "01-trip-planner-camping.png")

        # ────── Screenshot 2: 旅馆模式 ──────
        print("📸 截图 2: 全程旅馆模式...")
        hotel_btn = page.locator("text=全程住民宿/旅馆")
        await hotel_btn.click()
        await page.wait_for_timeout(2000)
        await screenshot(page, "02-hotel-light-mode.png")

        # ────── Screenshot 3: 装备库 ──────
        print("📸 截图 3: 装备库面板...")
        # 先切回扎营模式
        camping_btn = page.locator("text=包含野外露宿/扎营")
        await camping_btn.click()
        await page.wait_for_timeout(500)
        # 展开装备库
        gear_btn = page.locator("text=装备库")
        await gear_btn.click()
        await page.wait_for_timeout(1500)
        await screenshot(page, "03-gear-closet.png")

        await browser.close()
        print("\n🎉 全部截图完成！保存到:", OUT_DIR)


asyncio.run(main())
