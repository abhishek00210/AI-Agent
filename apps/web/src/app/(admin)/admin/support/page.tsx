import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminSupportPage() {
  return (
    <AdminListPage
      title="Support tickets"
      description="Admin support queue with assignment, priority, resolve, and close APIs."
      resource="tickets"
      columns={[
        { key: "subject", label: "Subject" },
        { key: "organization.name", label: "Organization" },
        { key: "user.email", label: "User" },
        { key: "priority", label: "Priority" },
        { key: "status", label: "Status" },
        { key: "assignedAdmin.email", label: "Assigned" },
        { key: "updatedAt", label: "Updated" },
      ]}
    />
  );
}
