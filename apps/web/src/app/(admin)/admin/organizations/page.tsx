import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminOrganizationsPage() {
  return (
    <AdminListPage
      title="Organizations"
      description="Search, inspect, suspend, activate, archive, and audit tenant organizations."
      resource="organizations"
      columns={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "plan", label: "Plan" },
        { key: "status", label: "Status" },
        { key: "provisionStatus", label: "Provision" },
        { key: "country", label: "Country" },
        { key: "currency", label: "Currency" },
        { key: "industry", label: "Industry" },
        { key: "telephonyProvider", label: "Telephony" },
        { key: "paymentProvider", label: "Payments" },
        { key: "timezone", label: "Timezone" },
        { key: "taxRegion", label: "Tax" },
        { key: "_count.members", label: "Users" },
        { key: "_count.agents", label: "Agents" },
        { key: "_count.calls", label: "Calls" },
      ]}
    />
  );
}
