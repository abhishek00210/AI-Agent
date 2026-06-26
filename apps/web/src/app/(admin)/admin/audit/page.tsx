import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminAuditPage() {
  return (
    <AdminListPage
      title="Admin audit logs"
      description="Every privileged admin action is captured here with resource, admin, metadata, and IP."
      resource="audit-logs"
      columns={[
        { key: "action", label: "Action" },
        { key: "resourceType", label: "Resource" },
        { key: "resourceId", label: "Resource ID" },
        { key: "adminUser.email", label: "Admin" },
        { key: "ipAddress", label: "IP" },
        { key: "createdAt", label: "Created" },
      ]}
    />
  );
}
