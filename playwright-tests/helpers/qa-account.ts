import { type Page } from "playwright/test";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Shared QA agent account — seeded (and self-healed) by an Alembic migration
 * on every `make migrate`. Never sign this account up, never change its
 * password or sandbox flag from a test. See docs/testing/qa-agent-account.md.
 */
export const QA_EMAIL = "qa-agent@moneywise.dev";
export const QA_PASSWORD = "QaAgent!Sandbox2026";
export const BASE_URL = "http://localhost:3000";

export async function loginAsQaAgent(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole("textbox", { name: "Email" }).fill(QA_EMAIL);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(QA_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/secure\//);
}

/**
 * Wipes all data in the QA household (transactions, Plaid items, bank
 * accounts, cards). The account and household themselves survive. All data in
 * this household is disposable by contract, so any suite may call this to get
 * a clean slate — typically once in test.beforeAll when the suite asserts
 * empty states.
 */
export function resetQaData(): void {
  execSync(`uv run python -m app.cli reset-data ${QA_EMAIL} --yes`, {
    cwd: path.resolve(__dirname, "../../apps/api"),
    stdio: "pipe",
  });
}
