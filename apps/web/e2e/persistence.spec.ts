import { test, expect } from "@playwright/test";
import { enterChatDay, playChatToEnd, readCandles } from "./helpers";

// Guest persistence: play a chat to completion, then reload the page. The
// completed-thread state and the candle count must be restored from IndexedDB
// (no account, no server) — the player resumes exactly where they left off.
test("completion and candle count survive a reload", async ({ page }) => {
  await enterChatDay(page);

  await page.getByTestId("thread-link").first().click();
  await playChatToEnd(page);

  // A thread is now marked done on the day list, and we capture the candle count.
  const doneBefore = page.getByTestId("thread-link").and(page.locator('[data-done="1"]'));
  await expect(doneBefore).toHaveCount(1);
  const candlesBefore = await readCandles(page);
  await page.waitForTimeout(500); // let the IndexedDB write flush before reloading

  await page.reload(); // hard reload — HydrationGate re-reads the save

  // State restored: the thread is still done, and the candle count is unchanged.
  await expect(page.getByTestId("thread-link").and(page.locator('[data-done="1"]'))).toHaveCount(1);
  expect(await readCandles(page)).toBe(candlesBefore);
});
