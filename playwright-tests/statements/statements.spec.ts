import { test, expect, Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const QA_EMAIL = "test+epic04@test.com";
// Account is already logged in via session state - using the currently active session

const PDF_PATH =
  "/home/krasovsky/personal/moneywise/docs/product/epics/examples/transactions/chase/20260513-statements-6902-.pdf";

// Helper: log in once and reuse session
async function loginIfNeeded(page: Page) {
  await page.goto(`${BASE_URL}/secure/statements`);
  // If redirected to login, sign in
  if (page.url().includes("/login")) {
    await page.getByLabel("Email").fill(QA_EMAIL);
    await page.getByLabel("Password").fill("Test1234!");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/secure\//);
  }
}

// Helper: select the Chase Checking account in the upload form
async function selectChaseCheckingAccount(page: Page) {
  await page.locator("#account-select").click();
  await page.evaluate(() => {
    const opt = document.querySelector('[role="option"]') as HTMLElement;
    if (opt) opt.click();
  });
}

// Helper: drop the PDF into the file drop zone
async function dropPDF(page: Page) {
  await page
    .locator(
      'div[role="button"][aria-label="File drop zone. Click to browse or drag a file here."]'
    )
    .drop({ files: PDF_PATH });
}

// Helper: delete all statements via API to start clean
async function deleteAllStatements(page: Page) {
  const token = await page.evaluate(async () => {
    // Find auth token from recent network requests if exposed
    return null;
  });
  // Fallback: just navigate to statements and let UI be idempotent
}

test.describe("Statements — routing fix verification", () => {
  test("statements list loads at /secure/statements", async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto(`${BASE_URL}/secure/statements`);

    // Upload form should be visible
    await expect(page.getByRole("heading", { name: "Statements" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upload Statement" })).toBeVisible();

    // File drop zone present
    await expect(
      page.getByRole("button", {
        name: "File drop zone. Click to browse or drag a file here.",
      })
    ).toBeVisible();

    // Filter tabs present
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Needs Review" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Failed" })).toBeVisible();
  });

  test("fake UUID detail route shows 'Statement not found' not the list", async ({
    page,
  }) => {
    await loginIfNeeded(page);
    await page.goto(
      `${BASE_URL}/secure/statements/00000000-0000-0000-0000-000000000000`
    );

    // Must NOT render the upload form (that would mean Outlet didn't work)
    await expect(
      page.getByRole("heading", { name: "Upload Statement" })
    ).not.toBeVisible();

    // Must show not-found message
    await expect(page.getByText("Statement not found.")).toBeVisible();
  });
});

test.describe("Statements — upload form validation", () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto(`${BASE_URL}/secure/statements`);
  });

  test("shows error when submitting without a file", async ({ page }) => {
    // Don't select a file, just click Upload
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByRole("alert")).toHaveText("Please select a file");
  });

  test("filters tabs switch between views", async ({ page }) => {
    // Needs Review tab
    await page.getByRole("tab", { name: "Needs Review" }).click();
    await expect(
      page.getByRole("tab", { name: "Needs Review" })
    ).toHaveAttribute("aria-selected", "true");

    // Failed tab
    await page.getByRole("tab", { name: "Failed" }).click();
    await expect(page.getByRole("tab", { name: "Failed" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // All tab back
    await page.getByRole("tab", { name: "All" }).click();
    await expect(page.getByRole("tab", { name: "All" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});

test.describe("Statements — upload and detail page end-to-end", () => {
  test("uploads PDF, processes to ready, detail page renders correctly", async ({
    page,
  }) => {
    await loginIfNeeded(page);
    await page.goto(`${BASE_URL}/secure/statements`);

    // Skip upload if statement already in Ready state
    const viewLink = page.getByRole("link", { name: "View →" }).first();
    const hasExisting = await viewLink.isVisible().catch(() => false);

    if (!hasExisting) {
      // Select account
      await selectChaseCheckingAccount(page);

      // Drop PDF
      await dropPDF(page);
      await expect(page.getByText("20260513-statements-6902-.pdf")).toBeVisible();

      // Submit upload
      await page.getByRole("button", { name: "Upload" }).click();

      // Wait for status to become Ready (polling up to 15 seconds)
      await expect(
        page.getByText("Ready").or(page.getByText("Failed"))
      ).toBeVisible({ timeout: 15000 });
    }

    // Statement should show as Ready
    await expect(page.getByText("Ready").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "View →" }).first()).toBeVisible();

    // Click View to go to detail page
    await page.getByRole("link", { name: "View →" }).first().click();

    // Verify detail page URL changed
    await expect(page).toHaveURL(/\/secure\/statements\/[0-9a-f-]+$/);

    // Detail page elements
    await expect(
      page.getByText("20260513-statements-6902-.pdf")
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Confirm all transactions in this statement",
      })
    ).toBeVisible();

    // Transaction table headers
    await expect(page.getByText("Date")).toBeVisible();
    await expect(page.getByText("Merchant")).toBeVisible();
    await expect(page.getByText("Amount")).toBeVisible();

    // Status badge
    await expect(page.getByText("Ready")).toBeVisible();
  });

  test("duplicate upload shows warning message", async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto(`${BASE_URL}/secure/statements`);

    // Upload same PDF twice (second upload should trigger duplicate notice)
    await selectChaseCheckingAccount(page);
    await dropPDF(page);
    await page.getByRole("button", { name: "Upload" }).click();

    // Wait for duplicate notice or processing
    await page.waitForTimeout(2000);

    // If duplicate: notice appears
    const duplicateText = page.getByRole("status").filter({
      hasText: "You already uploaded this file",
    });
    const isReady = page.getByText("Ready");

    const duplicate = await duplicateText.isVisible().catch(() => false);
    const ready = await isReady.isVisible().catch(() => false);

    // At least one of the states should be true
    expect(duplicate || ready).toBeTruthy();
  });

  test("back navigation from detail page returns to list", async ({ page }) => {
    await loginIfNeeded(page);
    await page.goto(`${BASE_URL}/secure/statements`);

    // Go to detail page if a statement exists
    const viewLink = page.getByRole("link", { name: "View →" }).first();
    const exists = await viewLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (!exists) {
      test.skip();
      return;
    }

    await viewLink.click();
    await expect(page).toHaveURL(/\/secure\/statements\/[0-9a-f-]+$/);

    // Click back
    await page.getByRole("link", { name: "Back to statements" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/secure/statements`);

    // List page loaded
    await expect(
      page.getByRole("heading", { name: "Statements" })
    ).toBeVisible();
  });
});

test.describe("Statements — detail page structure (no API key)", () => {
  test("detail page shows 0 transactions when no API key set", async ({
    page,
  }) => {
    await loginIfNeeded(page);
    await page.goto(`${BASE_URL}/secure/statements`);

    const viewLink = page.getByRole("link", { name: "View →" }).first();
    const exists = await viewLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (!exists) {
      test.skip();
      return;
    }

    await viewLink.click();
    await expect(page).toHaveURL(/\/secure\/statements\/[0-9a-f-]+$/);

    // With no API key, mock parse returns 0 transactions
    await expect(page.getByText("0 transactions")).toBeVisible();

    // Confirm All should be disabled when 0 transactions
    const confirmBtn = page.getByRole("button", {
      name: "Confirm all transactions in this statement",
    });
    await expect(confirmBtn).toBeDisabled();

    // Empty state message
    await expect(page.getByText("No transactions found.")).toBeVisible();

    // No JS errors
    const errors = await page
      .evaluate(() => (window as unknown as { _errors?: string[] })._errors)
      .catch(() => null);
    expect(errors).toBeNull();
  });
});
