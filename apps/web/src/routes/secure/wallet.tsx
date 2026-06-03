import { createFileRoute } from "@tanstack/react-router";
import { CardsSettings } from "@/features/cards/CardsSettings";
import { BankAccountsSettings } from "@/features/bank-accounts/BankAccountsSettings";
import { ConnectedAccountsSection } from "@/features/plaid/ConnectedAccountsSection";

export const Route = createFileRoute("/secure/wallet")({
  component: WalletPage,
});

function WalletPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">My Wallet</h1>
      <CardsSettings />
      <hr className="border-border" />
      <BankAccountsSettings />
      <hr className="border-border" />
      <ConnectedAccountsSection />
    </div>
  );
}
