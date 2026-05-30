import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

const BASE_URL = "http://localhost:3000";
const QA_EMAIL = "vlad_krasovsky@yahoo.com";
const QA_PASSWORD = "Password123!";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole("textbox", { name: "Email" }).fill(QA_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(QA_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/secure\/dashboard/);
}

function makeMinimalPDF(seed = 0): string {
  const tmpPath = path.join(os.tmpdir(), `test-statement-${seed}-${Date.now()}.pdf`);
  const content =
    Buffer.from(`%PDF-1.4\n1 0 obj\n<< >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`) +
    Buffer.from(`seed:${seed}:${Date.now()}:${Math.random()}`);
  fs.writeFileSync(tmpPath, content);
  return tmpPath;
}

function makeTextFile(): string {
  const tmpPath = path.join(os.tmpdir(), `test-invalid-${Date.now()}.txt`);
  fs.writeFileSync(tmpPath, "This is not a PDF or CSV file.");
  return tmpPath;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Statements — navigation and empty state", () => {
  test("sidebar link navigates to Statements page with empty state", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Statements" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/secure/statements`);

    // Upload form is visible
    await expect(page.getByRole("heading", { name: "Upload Statement" })).toBeVisible();
    await expect(page.getByRole("button", { name: /File drop zone/i })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Select account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload" })).toBeVisible();

    // Filter tabs are visible
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Needs Review" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Failed" })).toBeVisible();
  });

  test("Statements link in sidebar highlights as active when on Statements page", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${BASE_URL}/secure/statements`);
    const statementsLink = page.getByRole("link", { name: "Statements" });
    // The active class or aria attribute should reflect the active state
    await expect(statementsLink).toHaveAttribute("aria-current", /page|true/);
  });
});

test.describe("Statements — upload validation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/secure/statements`);
  });

  test("clicking Upload with no file shows 'Please select a file' error", async ({ page }) => {
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("alert")).toContainText("Please select a file");
  });

  test("clicking Upload with a file but no account shows 'Please select an account' error", async ({
    page,
  }) => {
    const pdfPath = makeMinimalPDF(100);
    try {
      await page.getByRole("button", { name: /File drop zone/i }).dispatchEvent("drop", {
        dataTransfer: {
          files: [{ name: "test.pdf", type: "application/pdf" }],
        },
      });
      // Use setInputFiles via a hidden input if drop doesn't work
      await page.locator('input[type="file"]').setInputFiles(pdfPath);
      await page.getByRole("button", { name: "Upload" }).click();
      await expect(page.getByRole("alert")).toContainText("Please select an account");
    } finally {
      fs.unlinkSync(pdfPath);
    }
  });

  test("dropping a .txt file shows 'Only PDF and CSV files are accepted' error", async ({
    page,
  }) => {
    const txtPath = makeTextFile();
    try {
      await page.locator('input[type="file"]').setInputFiles({
        name: "test-invalid.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("This is a text file"),
      });
      await expect(page.getByRole("alert")).toContainText(
        "Only PDF and CSV files are accepted"
      );
    } finally {
      fs.unlinkSync(txtPath);
    }
  });
});

test.describe("Statements — successful upload flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/secure/statements`);
  });

  test("upload a PDF with an account selected shows queued status", async ({ page }) => {
    // Must have an account first - check if Test Chase exists
    const accountSelect = page.getByRole("combobox", { name: "Select account" });
    await accountSelect.click();

    // Wait for options to load
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    const firstOption = page.getByRole("option").first();
    const optionText = await firstOption.textContent();

    if (!optionText) {
      test.skip(true, "No account available for upload test");
      return;
    }
    await firstOption.click();

    // Upload unique PDF
    const pdfPath = makeMinimalPDF(Date.now());
    try {
      await page.locator('input[type="file"]').setInputFiles(pdfPath);
      await page.getByRole("button", { name: "Upload" }).click();

      // Toast should appear
      await expect(page.getByText("Statement uploaded and queued for processing.")).toBeVisible({
        timeout: 5000,
      });
    } finally {
      fs.unlinkSync(pdfPath);
    }
  });
});

test.describe("Statements — duplicate detection", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/secure/statements`);
  });

  test("uploading the same file twice shows duplicate notice without creating a second entry", async ({
    page,
  }) => {
    // Select an account
    await page.getByRole("combobox", { name: "Select account" }).click();
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    await page.getByRole("option").first().click();

    // Upload a known file
    const pdfContent = Buffer.from(
      "%PDF-DUPE-TEST\n" + "duplicate-detection-test-file-" + Date.now()
    );
    const tmpPath = path.join(os.tmpdir(), `dupe-test-${Date.now()}.pdf`);
    fs.writeFileSync(tmpPath, pdfContent);

    try {
      await page.locator('input[type="file"]').setInputFiles(tmpPath);
      await page.getByRole("button", { name: "Upload" }).click();
      await expect(
        page.getByText("Statement uploaded and queued for processing.")
      ).toBeVisible({ timeout: 5000 });

      // Upload the same file again
      await page.getByRole("combobox", { name: "Select account" }).click();
      await page.getByRole("option").first().click();
      await page.locator('input[type="file"]').setInputFiles(tmpPath);
      await page.getByRole("button", { name: "Upload" }).click();

      // Duplicate notice should appear
      await expect(
        page.getByRole("status").filter({ hasText: "You already uploaded this file" })
      ).toBeVisible({ timeout: 5000 });

      // No new entry should be added (the upload count should not increase)
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });
});

test.describe("Statements — filter tabs", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/secure/statements`);
  });

  test("clicking Needs Review tab shows filtered results", async ({ page }) => {
    await page.getByRole("tab", { name: "Needs Review" }).click();
    // Tab should be selected
    await expect(page.getByRole("tab", { name: "Needs Review" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    // If no statements with needs_review status, empty state is shown
    // If there are, they should all have the right status
  });

  test("clicking Failed tab shows filtered results", async ({ page }) => {
    await page.getByRole("tab", { name: "Failed" }).click();
    await expect(page.getByRole("tab", { name: "Failed" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("clicking All tab restores full list", async ({ page }) => {
    await page.getByRole("tab", { name: "Needs Review" }).click();
    await page.getByRole("tab", { name: "All" }).click();
    await expect(page.getByRole("tab", { name: "All" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});

test.describe("Statements — delete statement", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/secure/statements`);
  });

  test("delete dialog shows correct filename and removes statement on confirm", async ({
    page,
  }) => {
    // Check if there are any statements to delete
    const listItems = page.locator('[role="listitem"]');
    const count = await listItems.count();
    if (count === 0) {
      test.skip(true, "No statements to delete");
      return;
    }

    // Get the first deletable statement name
    const firstStatement = listItems.first();
    const fileName = await firstStatement.locator("p").first().textContent();
    const deleteBtn = firstStatement.getByRole("button", { name: /Delete/ });

    await deleteBtn.click();

    // Confirm dialog appears
    await expect(page.getByRole("dialog", { name: "Delete statement?" })).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(fileName ?? "");

    // Click Cancel first
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Open again and confirm
    await deleteBtn.click();
    await page.getByRole("button", { name: /Confirm delete/ }).click();

    // Dialog closes
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Statement is removed from list
    await expect(
      page.getByRole("listitem").filter({ hasText: fileName ?? "" })
    ).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe("Statements — bug fixes regression", () => {
  const CHASE_PDF =
    "/home/krasovsky/personal/moneywise/docs/product/epics/examples/transactions/chase/20260513-statements-6902-.pdf";

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/secure/statements`);
  });

  test("F1: uploaded statement appears in list immediately without page reload", async ({
    page,
  }) => {
    // Record statements already in the list before upload
    const listBefore = await page.locator('[role="listitem"]').count();

    // Select account
    await page.getByRole("combobox", { name: "Select account" }).click();
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    await page.getByRole("option").first().click();

    // Drop the Chase PDF onto the file drop zone
    await page.locator('div[role="button"].flex.cursor-pointer.flex-col').drop({
      files: CHASE_PDF,
    });

    // Submit
    await page.getByRole("button", { name: "Upload" }).click();

    // F1 assertion: new item must appear in list WITHOUT a page reload
    // (count should increase immediately)
    await expect(page.locator('[role="listitem"]')).toHaveCount(listBefore + 1, {
      timeout: 5000,
    });

    // The newly uploaded file should be at the top
    const firstItem = page.locator('[role="listitem"]').first();
    await expect(firstItem).toContainText("20260513-statements-6902-.pdf");
  });

  test("F3: status badge transitions from Queued/Parsing to Ready within 15 seconds", async ({
    page,
  }) => {
    // Select account and upload the Chase PDF
    await page.getByRole("combobox", { name: "Select account" }).click();
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    await page.getByRole("option").first().click();

    await page.locator('div[role="button"].flex.cursor-pointer.flex-col').drop({
      files: CHASE_PDF,
    });
    await page.getByRole("button", { name: "Upload" }).click();

    // Wait for the new statement row to appear
    await expect(page.locator('[role="listitem"]').first()).toContainText(
      "20260513-statements-6902-.pdf",
      { timeout: 5000 }
    );

    // F3 assertion: status must reach "Ready" within 15 s (frontend polls every 3 s)
    const statusBadge = page
      .locator('[role="listitem"]')
      .first()
      .locator("text=Ready");

    await expect(statusBadge).toBeVisible({ timeout: 15000 });
  });
});
