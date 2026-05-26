import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">MoneyWise</h1>
        <p className="text-xl text-muted-foreground">
          Personal finance, simplified.
        </p>
      </div>
    </main>
  );
}
