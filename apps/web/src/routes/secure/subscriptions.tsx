import { createFileRoute } from "@tanstack/react-router";
import { SubscriptionsPage } from "@/features/subscriptions/SubscriptionsPage";

export const Route = createFileRoute("/secure/subscriptions")({
  component: SubscriptionsPage,
});
