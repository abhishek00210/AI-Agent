import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminSubscriptionsPage() {
  return (
    <AdminListPage
      title="Subscriptions"
      description="Stripe-backed subscription state, admin overrides, trial grants, and plan management."
      resource="subscriptions"
      columns={[
        { key: "organization.name", label: "Organization" },
        { key: "plan", label: "Plan" },
        { key: "status", label: "Status" },
        { key: "providerSubscriptionId", label: "Stripe Sub" },
        { key: "currentPeriodEnd", label: "Renews" },
        { key: "cancelAtPeriodEnd", label: "Canceling" },
      ]}
    />
  );
}
