import { test, expect } from "@playwright/test";
import { enterChatDay, playChatToEnd, playVnToEnd } from "./helpers";

// The first e2e regression baseline: a player enters, plays a day's chats to
// completion (making a choice), then plays through the VN segment.
test("plays a day's chats to completion, then the VN", async ({ page }) => {
  await enterChatDay(page); // → /story/chat/1

  // Complete every open chat on day 1. With gating opt-in and no time locks,
  // all of the day's chats are playable; finishing them completes the day.
  for (let i = 0; i < 6; i++) {
    const next = page.getByTestId("thread-link").and(page.locator('[data-done="0"]'));
    if (!(await next.first().isVisible().catch(() => false))) break;
    await next.first().click();
    await playChatToEnd(page);
    await expect(page.getByTestId("thread-link").first()).toBeVisible(); // back on the list
  }

  // Day 1 is fully completed.
  await expect(page.getByTestId("thread-link").and(page.locator('[data-done="0"]'))).toHaveCount(0);

  // Day 2 is now the current day and holds a VN unit — play it through.
  await page.goto("/story/chat/2");
  const vn = page.getByTestId("thread-link").and(page.locator('[data-kind="vn"]'));
  await expect(vn.first()).toBeVisible();
  await vn.first().click();
  await playVnToEnd(page);

  // Back on the day-2 list, the VN unit shows completed.
  await expect(
    page.getByTestId("thread-link").and(page.locator('[data-kind="vn"]')).and(page.locator('[data-done="1"]')),
  ).toBeVisible();
});
