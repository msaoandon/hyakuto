import { expect, type Page } from "@playwright/test";

// Shared drivers for the player flow. Selectors prefer visible text / roles;
// three `data-testid`s (thread-link, choice-option, vn-choice-option) cover the
// spots where the on-screen text is authored content we don't want to hard-code.

/** Splash → Lobby → Story → the current day's Chat list. */
export async function enterChatDay(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByText("Touch to Start").click(); // waits out the hydration gate
  await page.getByRole("link", { name: "Story", exact: true }).click();
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await expect(page.getByTestId("thread-link").first()).toBeVisible();
}

/** Nudge the chat pace to fastest so the message drip doesn't dominate runtime. */
async function maxOutPace(page: Page): Promise<void> {
  const faster = page.getByRole("button", { name: "Faster" });
  for (let i = 0; i < 4; i++) {
    if (await faster.isEnabled().catch(() => false)) await faster.click();
  }
}

/**
 * Play the currently-open chat to its end: whenever a choice is offered, tap
 * Reply and pick the first option; otherwise wait for the drip. Clicks Exit once
 * the thread ends. Resilient to threads with zero or several choices.
 */
export async function playChatToEnd(page: Page): Promise<void> {
  await maxOutPace(page);
  const exit = page.getByRole("button", { name: "Exit", exact: true });
  const reply = page.getByRole("button", { name: "Reply", exact: true });

  for (let i = 0; i < 200; i++) {
    if (await exit.isVisible().catch(() => false)) {
      await exit.click();
      return;
    }
    if ((await reply.isVisible().catch(() => false)) && (await reply.isEnabled().catch(() => false))) {
      await reply.click();
      await page.getByTestId("choice-option").first().click();
    }
    await page.waitForTimeout(500);
  }
  throw new Error("chat never reached the Exit state");
}

/**
 * Step a VN reader to its end: click through Skip/Next, answer the MC chooser
 * (first option) whenever it appears, then Exit. VN is player-driven (no timer),
 * so this is fast and deterministic.
 */
export async function playVnToEnd(page: Page): Promise<void> {
  const exit = page.getByRole("button", { name: "Exit", exact: true });
  const advance = page.getByRole("button", { name: /^(Next|Skip)$/ });
  const chooser = page.getByTestId("vn-choice-option").first();

  for (let i = 0; i < 300; i++) {
    if (await exit.isVisible().catch(() => false)) {
      await exit.click();
      return;
    }
    if (await chooser.isVisible().catch(() => false)) {
      await chooser.click();
      continue;
    }
    if (await advance.isVisible().catch(() => false)) {
      await advance.click();
    }
    await page.waitForTimeout(200);
  }
  throw new Error("VN never reached the Exit state");
}

/** The persistent 🕯 count from the Story header (its aria-label is "N candles"). */
export async function readCandles(page: Page): Promise<number> {
  const text = await page.getByLabel(/\d+ candles/).first().textContent();
  return Number((text ?? "").replace(/\D/g, ""));
}
