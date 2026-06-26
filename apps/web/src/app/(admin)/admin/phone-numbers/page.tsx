import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminPhoneNumbersPage() {
  return (
    <AdminListPage
      title="Phone Numbers"
      description="Global purchased number inventory, tenant ownership, assignment, and markup visibility."
      resource="phone-numbers"
      columns={[
        { key: "phoneNumber", label: "Number" },
        { key: "organization.name", label: "Organization" },
        { key: "agent.name", label: "Agent" },
        { key: "status", label: "Status" },
        { key: "countryCode", label: "Country" },
        { key: "purchaseSource", label: "Source" },
        { key: "providerCost", label: "Twilio Cost" },
        { key: "customerPrice", label: "Customer Price" },
        { key: "profitMargin", label: "Margin" },
        { key: "purchasedAt", label: "Purchased" },
      ]}
    />
  );
}
