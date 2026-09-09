import { expect, test, type Page } from "@playwright/test";

test("loads scenarios, command diagnostics, and HTML input", async ({ page }: { page: Page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SMEditor" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Extension mode" })).toBeVisible();
  await expect(page.getByText("Available commands")).toBeVisible();

  await page.locator(".scenario-grid").getByRole("button", { name: "Table" }).click();
  await expect(page.locator("table.smeditor-table")).toBeVisible();

  await page.getByRole("button", { name: "Custom" }).click();
  await expect(page.getByText("Missing commands in the active extension mode:")).toBeVisible();

  await page.getByLabel("HTML input").fill("<h1>Loaded from e2e</h1><p>Round trip</p>");
  await page.getByRole("button", { name: "Load HTML" }).click();
  await expect(page.getByRole("heading", { name: "Loaded from e2e" })).toBeVisible();
});
