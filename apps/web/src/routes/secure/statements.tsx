import { createFileRoute } from "@tanstack/react-router";
import { StatementUploader } from "@/features/statements/StatementUploader";
import { StatementsList } from "@/features/statements/StatementsList";

export const Route = createFileRoute("/secure/statements")({
  component: StatementsPage,
});

function StatementsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
      <h1 className="text-3xl font-bold">Statements</h1>
      <StatementUploader />
      <StatementsList />
    </div>
  );
}
