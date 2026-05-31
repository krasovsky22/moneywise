import { test, expect, type Page } from "playwright/test";

const BASE_URL = "http://localhost:3000";
const QA_EMAIL = "test+epic04@test.com";
const QA_PASSWORD = "Test1234!";

async function loginViaApi(page: Page): Promise<string> {
  const resp = await page.request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email: QA_EMAIL, password: QA_PASSWORD },
  });
  const body = (await resp.json()) as { access_token: string };
  return body.access_token;
}

async function loginViaUi(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/secure/statements`);
  if (page.url().includes("/login")) {
    await page.getByLabel("Email").fill(QA_EMAIL);
    await page.getByLabel("Password").fill(QA_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/secure\//);
  }
}

async function getFirstCategoryId(page: Page, token: string): Promise<string> {
  const resp = await page.request.get(`${BASE_URL}/api/v1/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const cats = (await resp.json()) as Array<{
    id: string;
    children: Array<{ id: string }>;
  }>;
  return cats[0]?.children[0]?.id ?? cats[0]?.id ?? "";
}

async function getSecondCategoryId(page: Page, token: string): Promise<string> {
  const resp = await page.request.get(`${BASE_URL}/api/v1/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const cats = (await resp.json()) as Array<{
    id: string;
    children: Array<{ id: string }>;
  }>;
  return cats[0]?.children[1]?.id ?? cats[0]?.children[0]?.id ?? cats[0]?.id ?? "";
}

async function waitForTransactions(
  page: Page,
  token: string,
  statementId: string,
  timeoutMs = 20000,
): Promise<Array<{ id: string; merchant_clean: string }>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const resp = await page.request.get(
      `${BASE_URL}/api/v1/statements/${statementId}/transactions`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const txs = (await resp.json()) as Array<{ id: string; merchant_clean: string }>;
    if (txs.length > 0) return txs;
    await page.waitForTimeout(1000);
  }
  return [];
}

async function getBankAccountId(page: Page, token: string): Promise<string> {
  const resp = await page.request.get(`${BASE_URL}/api/v1/bank-accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const accounts = (await resp.json()) as Array<{ id: string }>;
  return accounts[0]?.id ?? "";
}

async function uploadUniqueStatement(
  page: Page,
  token: string,
  accountId: string,
): Promise<string> {
  const unique = Date.now().toString();
  const csvContent = `Date,Description,Amount\n2026-01-15,AutoRuleTest ${unique},-45.00`;
  const resp = await page.request.post(`${BASE_URL}/api/v1/statements`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: `test-${unique}.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from(csvContent),
      },
      account_type: "bank_account",
      account_id: accountId,
    },
  });
  const body = (await resp.json()) as {
    statement?: { id: string };
    duplicate?: boolean;
  };
  return body.statement?.id ?? "";
}

test.describe("Auto-rule on category change — API contract", () => {
  let token: string;
  let accountId: string;
  let sharedStmtId: string;
  let sharedTxId: string;
  let sharedMerchant: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    token = await loginViaApi(page);
    accountId = await getBankAccountId(page, token);

    sharedStmtId = await uploadUniqueStatement(page, token, accountId);
    const txs = await waitForTransactions(page, token, sharedStmtId);
    sharedTxId = txs[0]?.id ?? "";
    sharedMerchant = txs[0]?.merchant_clean ?? "";

    await ctx.close();
  });

  test("PATCH /transactions/{id} with category_id creates a CategoryRule for merchant_clean", async ({
    page,
  }) => {
    const categoryId = await getFirstCategoryId(page, token);

    await page.request.delete(
      `${BASE_URL}/api/v1/categories/rules/by-merchant?pattern=${encodeURIComponent(sharedMerchant)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const patchResp = await page.request.patch(
      `${BASE_URL}/api/v1/transactions/${sharedTxId}`,
      {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        data: { category_id: categoryId },
      },
    );
    expect(patchResp.ok()).toBe(true);

    const rulesResp = await page.request.get(`${BASE_URL}/api/v1/categories/rules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rules = (await rulesResp.json()) as Array<{
      pattern: string;
      category_id: string;
    }>;
    const rule = rules.find((r) => r.pattern === sharedMerchant);
    expect(rule).toBeDefined();
    expect(rule?.category_id).toBe(categoryId);
  });

  test("PATCH /transactions/{id}?create_rule=false skips rule creation", async ({ page }) => {
    const categoryId = await getSecondCategoryId(page, token);

    await page.request.delete(
      `${BASE_URL}/api/v1/categories/rules/by-merchant?pattern=${encodeURIComponent(sharedMerchant)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const patchResp = await page.request.patch(
      `${BASE_URL}/api/v1/transactions/${sharedTxId}?create_rule=false`,
      {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        data: { category_id: categoryId },
      },
    );
    expect(patchResp.ok()).toBe(true);

    const rulesResp = await page.request.get(`${BASE_URL}/api/v1/categories/rules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rules = (await rulesResp.json()) as Array<{ pattern: string }>;
    const rule = rules.find((r) => r.pattern === sharedMerchant);
    expect(rule).toBeUndefined();
  });

  test("upsert updates existing rule category rather than creating a duplicate", async ({
    page,
  }) => {
    const cat1 = await getFirstCategoryId(page, token);
    const cat2 = await getSecondCategoryId(page, token);

    await page.request.delete(
      `${BASE_URL}/api/v1/categories/rules/by-merchant?pattern=${encodeURIComponent(sharedMerchant)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    await page.request.patch(`${BASE_URL}/api/v1/transactions/${sharedTxId}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { category_id: cat1 },
    });

    await page.request.patch(`${BASE_URL}/api/v1/transactions/${sharedTxId}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { category_id: cat2 },
    });

    const rulesResp = await page.request.get(`${BASE_URL}/api/v1/categories/rules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rules = (await rulesResp.json()) as Array<{
      pattern: string;
      category_id: string;
    }>;
    const matching = rules.filter((r) => r.pattern === sharedMerchant);
    expect(matching.length).toBe(1);
    expect(matching[0].category_id).toBe(cat2);

    await page.request.delete(
      `${BASE_URL}/api/v1/categories/rules/by-merchant?pattern=${encodeURIComponent(sharedMerchant)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  });

  test("DELETE /categories/rules/by-merchant returns 204 for existing pattern", async ({
    page,
  }) => {
    const categoryId = await getFirstCategoryId(page, token);

    await page.request.post(`${BASE_URL}/api/v1/categories/rules`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { pattern: "DeleteByMerchantTestPattern", category_id: categoryId },
    });

    const delResp = await page.request.delete(
      `${BASE_URL}/api/v1/categories/rules/by-merchant?pattern=DeleteByMerchantTestPattern`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(delResp.status()).toBe(204);

    const rulesResp = await page.request.get(`${BASE_URL}/api/v1/categories/rules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rules = (await rulesResp.json()) as Array<{ pattern: string }>;
    expect(rules.find((r) => r.pattern === "DeleteByMerchantTestPattern")).toBeUndefined();
  });

  test("DELETE /categories/rules/by-merchant returns 404 for unknown pattern", async ({
    page,
  }) => {
    const delResp = await page.request.delete(
      `${BASE_URL}/api/v1/categories/rules/by-merchant?pattern=completely_nonexistent_pattern_zzz`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(delResp.status()).toBe(404);
  });
});

test.describe("Auto-rule on category change — UI behavior", () => {
  test("statement review page does not show rule-creation dialog", async ({ page }) => {
    await loginViaUi(page);

    const token = await loginViaApi(page);
    const accountId = await getBankAccountId(page, token);
    const stmtId = await uploadUniqueStatement(page, token, accountId);

    if (!stmtId) {
      test.skip();
      return;
    }

    const txs = await waitForTransactions(page, token, stmtId);
    if (txs.length === 0) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/secure/statements/${stmtId}`);
    await expect(page.getByText(txs[0].merchant_clean)).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("dialog", { name: /save categorization rule/i }),
    ).not.toBeVisible();

    const categoryPicker = page.locator("[role='combobox']").first();
    const hasCategories = await categoryPicker.isVisible().catch(() => false);

    if (hasCategories) {
      await categoryPicker.click();
      const firstOption = page.locator("[role='option']").first();
      const optionVisible = await firstOption.isVisible().catch(() => false);
      if (optionVisible) {
        await firstOption.click();
        await page.waitForTimeout(1500);

        await expect(page.getByText(/Rule saved:/)).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
        await expect(
          page.getByRole("dialog", { name: /categorization rule/i }),
        ).not.toBeVisible();
      }
    }
  });
});
