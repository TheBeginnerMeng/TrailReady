"""TrailReady 产品演示截图脚本"""
import asyncio
import os

from playwright.async_api import async_playwright

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "http://localhost:3000"


async def take_full_page_screenshot(page, filename):
    """Take a full viewport screenshot."""
    path = os.path.join(OUT_DIR, filename)
    await page.screenshot(path=path, full_page=False)
    print(f"✅ {filename}")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        page = await context.new_page()

        # ────────── Screenshot 1: 默认行程计划器（全程扎营模式） ──────────
        print("📸 截图 1: 行程计划器主页（默认扎营模式）...")
        await page.goto(BASE_URL, wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await take_full_page_screenshot(page, "01-trip-planner-camping.png")

        # ────────── Screenshot 2: 切换到全程旅馆模式 ──────────
        print("📸 截图 2: 全程旅馆模式（极限减负）...")
        # 点击「全程住民宿/旅馆」按钮
        hotel_btn = page.locator("button:has-text('全程住民宿/旅馆')")
        await hotel_btn.click()
        await page.wait_for_timeout(1500)
        await take_full_page_screenshot(page, "02-hotel-light-mode.png")

        # ────────── Screenshot 3: 展开装备库 ──────────
        print("📸 截图 3: 装备库面板...")
        # 先切回扎营模式
        camping_btn = page.locator("button:has-text('包含野外露宿/扎营')")
        await camping_btn.click()
        await page.wait_for_timeout(800)
        # 点击装备库按钮
        gear_btn = page.locator("button:has-text('装备库')")
        await gear_btn.click()
        await page.wait_for_timeout(1000)
        await take_full_page_screenshot(page, "03-gear-closet.png")

        await browser.close()
        print("\n🎉 全部截图完成！保存到:", OUT_DIR)


asyncio.run(main())
