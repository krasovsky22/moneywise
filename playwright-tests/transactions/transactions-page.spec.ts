import { test, expect, type Page } from "playwright/test";
import { BASE_URL, loginAsQaAgent } from "../helpers/qa-account";

async function ensureLoggedIn(page: Page) {
  await page.goto(`${BASE_URL}/secure/transactions`);
  if (!page.url().includes("/secure/")) {
    await loginAsQaAgent(page);
    await page.goto(`${BASE_URL}/secure/transactions`);
  }
}

// The shared QA household may be empty; tests that act on the first table
// row seed a transaction when none exist.
async function ensureRowsExist(page: Page) {
  await expect(page.getByText(/\d+ total/)).toBeVisible();
  if ((await page.locator("table tbody tr").count()) === 0) {
    await page.getByRole("button", { name: /Add transaction/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add Transaction" });
    await dialog.getByLabel("Amount *").fill("-1.00");
    await dialog.getByLabel("Merchant *").fill("QA Seed Row");
    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  }
}

test.describe("Transactions page — page render", () => {
  test("heading, total count, and key toolbar elements are visible", async ({
    page,
  }) => {
    await ensureLoggedIn(page);

    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
    await expect(page.getByText(/\d+ total/)).toBeVisible();
    await expect(page.getByPlaceholder("Search transactions…")).toBeVisible();
    await expect(page.getByRole("button", { name: /Date range/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Filters/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Export CSV/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add transaction/i })).toBeVisible();
  });

  test("table has expected column headers", async ({ page }) => {
    await ensureLoggedIn(page);

    await expect(page.getByRole("columnheader", { name: "Date" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Merchant" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Amount" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Type" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Category" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Source" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Actions" })).toBeVisible();
  });
});

test.describe("Transactions page — sidebar navigation", () => {
  test("Transactions link in sidebar is active and highlighted on /secure/transactions", async ({
    page,
  }) => {
    await ensureLoggedIn(page);

    const transactionsLink = page.locator('a[href="/secure/transactions"]');
    await expect(transactionsLink).toBeVisible();
    // Active state: bg-primary class applied
    await expect(transactionsLink).toHaveClass(/bg-primary/);
    // ARIA: aria-current="page"
    await expect(transactionsLink).toHaveAttribute("aria-current", "page");
  });

  test("clicking Transactions in sidebar navigates to /secure/transactions", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/secure/dashboard`);
    // May need to log in first
    if (!page.url().includes("/secure/")) {
      await ensureLoggedIn(page);
      await page.goto(`${BASE_URL}/secure/dashboard`);
    }
    await page.locator('a[href="/secure/transactions"]').click();
    await page.waitForURL(/\/secure\/transactions/);
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
  });
});

test.describe("Transactions page — Add transaction modal", () => {
  test("modal opens with all required fields when 'Add transaction' is clicked", async ({
    page,
  }) => {
    await ensureLoggedIn(page);

    await page.getByRole("button", { name: /Add transaction/i }).click();

    const dialog = page.getByRole("dialog", { name: "Add Transaction" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Date *")).toBeVisible();
    await expect(dialog.getByLabel("Amount *")).toBeVisible();
    await expect(dialog.getByLabel("Merchant *")).toBeVisible();
    await expect(dialog.getByLabel("Transaction type")).toBeVisible();
    await expect(dialog.getByLabel("Select category")).toBeVisible();
    await expect(dialog.getByLabel("Notes")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add transaction" })).toBeVisible();
  });

  test("validation: shows error toast when required fields are missing", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    await page.getByRole("button", { name: /Add transaction/i }).click();

    const dialog = page.getByRole("dialog", { name: "Add Transaction" });
    await expect(dialog).toBeVisible();

    // Submit with only merchant filled, amount missing
    await dialog.getByLabel("Merchant *").fill("Test merchant");
    // Amount left empty — click submit
    await dialog.getByRole("button", { name: "Add transaction" }).click();

    // Toast error should appear
    await expect(page.getByText(/required/i)).toBeVisible({ timeout: 3000 });

    // Dialog should remain open
    await expect(dialog).toBeVisible();
  });

  test("happy path: creates a transaction and it appears in the table", async ({
    page,
  }) => {
    await ensureLoggedIn(page);

    const initialCount = await page.locator("table tbody tr").count();

    await page.getByRole("button", { name: /Add transaction/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add Transaction" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Amount *").fill("-12.99");
    await dialog.getByLabel("Merchant *").fill("Playwright QA Test");
    await dialog.getByRole("button", { name: "Add transaction" }).click();

    // Dialog should close on success
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Table should have one more row
    await expect(page.locator("table tbody tr")).toHaveCount(initialCount + 1, {
      timeout: 5000,
    });

    // New transaction should appear in table
    await expect(page.getByRole("cell", { name: /Playwright QA Test/ })).toBeVisible();

    // Clean up: delete the test transaction
    await page.getByRole("button", { name: /Delete Playwright QA Test/ }).click();
  });

  test("Cancel button closes the modal without creating a transaction", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const initialCount = await page.locator("table tbody tr").count();

    await page.getByRole("button", { name: /Add transaction/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add Transaction" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Merchant *").fill("Should not be saved");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator("table tbody tr")).toHaveCount(initialCount);
  });
});

test.describe("Transactions page — Edit modal", () => {
  test("clicking pencil icon opens TransactionModal pre-filled with transaction data", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    await ensureRowsExist(page);

    // Click first edit button in table
    const firstEditBtn = page.locator("table tbody tr:first-child button[aria-label^='Edit']");
    await expect(firstEditBtn).toBeVisible();
    const merchantName = await firstEditBtn.getAttribute("aria-label");
    const name = merchantName?.replace("Edit ", "") ?? "transaction";

    await firstEditBtn.click();

    // Edit modal should open with the merchant name as title
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: name })).toBeVisible();

    // Should have Details and History tabs
    await expect(page.getByRole("button", { name: "Details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "History" })).toBeVisible();

    // Should have date, amount, merchant, type, notes fields
    await expect(page.getByLabel("Date")).toBeVisible();
    await expect(page.getByLabel("Amount")).toBeVisible();
    await expect(page.getByLabel("Merchant")).toBeVisible();

    // Should have Split, Delete, Cancel, Save changes buttons
    await expect(page.getByRole("button", { name: "Split" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  test("History tab shows empty state when no history exists", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    await ensureRowsExist(page);

    await page.locator("table tbody tr:first-child button[aria-label^='Edit']").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByText("No history yet.")).toBeVisible();
  });

  test("Split button opens the Split Transaction modal", async ({ page }) => {
    await ensureLoggedIn(page);
    await ensureRowsExist(page);

    await page.locator("table tbody tr:first-child button[aria-label^='Edit']").click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible();

    await page.getByRole("button", { name: "Split" }).click();

    // Split Transaction dialog opens
    await expect(page.getByText("Split Transaction")).toBeVisible();
    await expect(page.getByText("Part 1")).toBeVisible();
    await expect(page.getByText("Part 2")).toBeVisible();
    await expect(page.getByText("Remaining")).toBeVisible();
    await expect(page.getByRole("button", { name: /Add part/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Split transaction" })).toBeVisible();
  });
});

test.describe("Transactions page — Delete and Undo", () => {
  test("deleting a transaction shows undo toast and removes row", async ({
    page,
  }) => {
    await ensureLoggedIn(page);

    // First create a test transaction to delete
    await page.getByRole("button", { name: /Add transaction/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add Transaction" });
    await dialog.getByLabel("Amount *").fill("-5.00");
    await dialog.getByLabel("Merchant *").fill("ToDeleteQA");
    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("cell", { name: /ToDeleteQA/ })).toBeVisible();

    const countBefore = await page.locator("table tbody tr").count();

    // Delete it
    await page.getByRole("button", { name: /Delete ToDeleteQA/ }).click();

    // Toast: "ToDeleteQA deleted." with Undo button
    await expect(page.getByText(/ToDeleteQA deleted/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

    // Row is removed
    await expect(page.locator("table tbody tr")).toHaveCount(countBefore - 1, {
      timeout: 5000,
    });
  });

  test("Undo restores the deleted transaction", async ({ page }) => {
    await ensureLoggedIn(page);

    // Create then delete a transaction
    await page.getByRole("button", { name: /Add transaction/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add Transaction" });
    await dialog.getByLabel("Amount *").fill("-3.50");
    await dialog.getByLabel("Merchant *").fill("UndoTestQA");
    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const countBefore = await page.locator("table tbody tr").count();

    await page.getByRole("button", { name: /Delete UndoTestQA/ }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(countBefore - 1, {
      timeout: 5000,
    });

    // Click Undo
    await page.getByRole("button", { name: "Undo" }).click();

    // Transaction is restored
    await expect(page.locator("table tbody tr")).toHaveCount(countBefore, {
      timeout: 5000,
    });
    await expect(page.getByRole("cell", { name: /UndoTestQA/ })).toBeVisible();

    // Final cleanup
    await page.getByRole("button", { name: /Delete UndoTestQA/ }).click();
  });
});

test.describe("Transactions page — Filter bar", () => {
  test("search filter narrows the table results", async ({ page }) => {
    await ensureLoggedIn(page);

    // Seed a matching transaction if the QA household doesn't have one
    await expect(page.getByText(/\d+ total/)).toBeVisible();
    if ((await page.getByRole("cell", { name: /Whole Foods/ }).count()) === 0) {
      await page.getByRole("button", { name: /Add transaction/i }).click();
      const dialog = page.getByRole("dialog", { name: "Add Transaction" });
      await dialog.getByLabel("Amount *").fill("-42.17");
      await dialog.getByLabel("Merchant *").fill("Whole Foods");
      await dialog.getByRole("button", { name: "Add transaction" }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    }

    // Type in search box
    await page.getByPlaceholder("Search transactions…").fill("Whole Foods");
    await page.waitForTimeout(500); // debounce

    // Should show fewer/filtered results
    await expect(page.getByText(/1 total|Search: Whole Foods/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("cell", { name: /Whole Foods/ }).first()).toBeVisible();
  });

  test("Clear all button resets filters", async ({ page }) => {
    await ensureLoggedIn(page);

    await page.getByPlaceholder("Search transactions…").fill("Whole Foods");
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: /Clear all/i })).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: /Clear all/i }).click();
    await expect(page.getByPlaceholder("Search transactions…")).toHaveValue("");
  });

  test("Date range dropdown shows preset options", async ({ page }) => {
    await ensureLoggedIn(page);

    await page.getByRole("button", { name: /Date range/i }).click();
    await expect(page.getByText("This month")).toBeVisible();
    await expect(page.getByText("Last 3 months")).toBeVisible();
    await expect(page.getByText("This year")).toBeVisible();
    await expect(page.getByText("Custom range")).toBeVisible();
  });

  test("Filters panel shows category, amount range, status, source, and type filters", async ({
    page,
  }) => {
    await ensureLoggedIn(page);

    await page.getByRole("button", { name: /Filters/i }).click();
    await expect(page.getByText("CATEGORY")).toBeVisible();
    await expect(page.getByText("AMOUNT RANGE")).toBeVisible();
    await expect(page.getByText("STATUS")).toBeVisible();
    await expect(page.getByText("SOURCE")).toBeVisible();
    await expect(page.getByText("TYPE")).toBeVisible();
  });
});

test.describe("Transactions page — Export CSV", () => {
  test("Export CSV button triggers a file download", async ({ page }) => {
    await ensureLoggedIn(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export CSV/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("transactions.csv");
  });
});

test.describe("Transactions page — Inline category picker", () => {
  test("category combobox in table row opens a searchable dropdown", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    await ensureRowsExist(page);

    // Click the inline category combobox in first row
    const firstCategoryCombo = page.locator("table tbody tr:first-child [role='combobox'][aria-label='Select category']");
    await firstCategoryCombo.click();

    // Dropdown should open with a search box and categories
    await expect(page.getByPlaceholder("Search categories...")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Entertainment")).toBeVisible();
  });
});

test.describe("Transactions page — JS errors", () => {
  test("no JavaScript errors occur on page load and basic interactions", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await ensureLoggedIn(page);
    await ensureRowsExist(page);

    // Open and close Add modal
    await page.getByRole("button", { name: /Add transaction/i }).click();
    await expect(page.getByRole("dialog", { name: "Add Transaction" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Open and close Edit modal
    await page.locator("table tbody tr:first-child button[aria-label^='Edit']").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    expect(errors).toHaveLength(0);
  });
});
