import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminPaymentsPage() {
  return (
    <AdminListPage
      title="Payments"
      description="Verified Stripe invoice webhooks, failed payments, and payment event processing status."
      resource="payments"
      columns={[
        { key: "organization.name", label: "Organization" },
        { key: "eventType", label: "Event" },
        { key: "eventId", label: "Stripe Event" },
        { key: "processed", label: "Processed" },
        { key: "createdAt", label: "Created" },
      ]}
    />
  );
}
