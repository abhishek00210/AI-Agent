import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminCallsPage() {
  return (
    <AdminListPage
      title="Calls"
      description="Global call search with recording/transcript references and tenant attribution."
      resource="calls"
      columns={[
        { key: "twilioCallSid", label: "Call SID" },
        { key: "organization.name", label: "Organization" },
        { key: "agent.name", label: "Agent" },
        { key: "direction", label: "Direction" },
        { key: "status", label: "Status" },
        { key: "durationSeconds", label: "Seconds" },
        { key: "startedAt", label: "Started" },
      ]}
    />
  );
}
