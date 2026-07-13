import { test, expect } from "@playwright/test";
import { enterLobby } from "./helpers";

// MC customisation (DEV_PLAN Phase 3): the first-run picker names the MC and
// sets gender-for-address; the choice drives {MC} substitution and the
// if_gender variants in real content (demo_d1_s1 carries an address trio).

// A 1×1 red PNG — enough for the avatar crop/encode pipeline.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("first-run picker personalizes address and {MC} name in the story", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Touch to Start").click();
  await page.waitForURL(/\/welcome/); // fresh profile → picker, not Lobby

  await page.getByPlaceholder("What do they call you?").fill("Yuki");
  await page.getByRole("button", { name: "As a woman" }).click();
  await page.getByRole("button", { name: "Begin" }).click();
  await page.waitForURL(/\/lobby/);

  // Into the first chat: the gendered variant and the chosen name must show.
  await page.getByRole("link", { name: "Story", exact: true }).click();
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByTestId("thread-link").first().click();
  await expect(page.getByText("Yuki joined the chatroom")).toBeVisible();
  await expect(page.getByText("make yourself comfy, ma'am")).toBeVisible();
});

test("changing address in Settings switches the variant on a fresh run-through", async ({ page }) => {
  await enterLobby(page); // answers the picker with defaults (unset)

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "As a man" }).click();
  await page.getByRole("link", { name: "back" }).click();

  await page.getByRole("link", { name: "Story", exact: true }).click();
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByTestId("thread-link").first().click();
  await expect(page.getByText("make yourself comfy, sir")).toBeVisible();
});

test("picker is not re-prompted after reload, and the avatar survives", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Touch to Start").click();
  await page.waitForURL(/\/welcome/);

  await page.getByTestId("mc-avatar-input").setInputFiles({
    name: "me.png", mimeType: "image/png", buffer: PNG_1PX,
  });
  await expect(page.getByRole("img", { name: "Avatar" })).toBeVisible(); // cropped + stored
  await page.getByRole("button", { name: "Begin" }).click();
  await page.waitForURL(/\/lobby/);

  await page.reload();
  await page.goto("/");
  await page.getByText("Touch to Start").click();
  await page.waitForURL(/\/lobby/); // no re-prompt: mcChosen persisted

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("img", { name: "Avatar" })).toBeVisible(); // blob reloaded from IDB
});

test("New game in Settings erases progress and returns to the picker", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Touch to Start").click();
  await page.waitForURL(/\/welcome/);
  await page.getByPlaceholder("What do they call you?").fill("Yuki");
  await page.getByRole("button", { name: "Begin" }).click();
  await page.waitForURL(/\/lobby/);

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "New game", exact: true }).click(); // arm
  await page.getByRole("button", { name: "Erase everything" }).click(); // confirm
  await page.waitForURL(/\/welcome/);
  await expect(page.getByPlaceholder("What do they call you?")).toHaveValue(""); // identity gone
});

test("a fresh profile deep-linking into the game is routed to the picker", async ({ page }) => {
  await page.goto("/lobby"); // skips the splash tap entirely
  await page.waitForURL(/\/welcome/); // authorized-layout guard
});
