import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";

import { HealthStatus } from "./health-status";

function renderWithQueryClient(ui: React.ReactElement) {
  // Fresh QueryClient per test with retries disabled for fast failures
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("HealthStatus", () => {
  it("shows API status from mocked endpoint", async () => {
    renderWithQueryClient(<HealthStatus />);
    // MSW intercepts the fetch; findByText waits for async render
    expect(await screen.findByText(/ok/i)).toBeInTheDocument();
  });
});
