import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminOutboundCallsPage() {
  return (
    <AdminListPage
      title="Outbound AI Calls"
      description="Global outbound lead qualification attempts with tenant, lead, agent, outcome, and summary linkage."
      resource="outbound-calls"
      columns={[
        { key: "organization.name", label: "Organization" },
        { key: "customerProfile.name", label: "Customer" },
        { key: "customerProfile.phone", label: "Phone" },
        { key: "lead.name", label: "Lead" },
        { key: "agent.name", label: "Agent" },
        { key: "reasonType", label: "Reason" },
        { key: "status", label: "Status" },
        { key: "qualified", label: "Qualified" },
        { key: "appointmentBooked", label: "Appointment" },
        { key: "durationSeconds", label: "Seconds" },
        { key: "scheduledAt", label: "Scheduled" },
      ]}
    />
  );
}
