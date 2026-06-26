import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminAgentsPage() {
  return (
    <AdminListPage
      title="Agents"
      description="Global agent inventory, status control, and performance counters."
      resource="agents"
      columns={[
        { key: "name", label: "Agent" },
        { key: "organization.name", label: "Organization" },
        { key: "status", label: "Status" },
        { key: "_count.calls", label: "Calls" },
        { key: "_count.leads", label: "Leads" },
        { key: "_count.appointments", label: "Appointments" },
      ]}
    />
  );
}
