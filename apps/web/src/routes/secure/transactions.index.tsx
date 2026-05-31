import { createFileRoute } from "@tanstack/react-router";
import { TransactionsPage } from "@/features/transactions/TransactionsPage";

export const Route = createFileRoute("/secure/transactions/")({
  component: TransactionsPage,
});
