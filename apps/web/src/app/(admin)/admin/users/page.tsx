import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminUsersPage() {
  return (
    <AdminListPage
      title="Users"
      description="Global tenant-user lookup with suspension and password-reset APIs protected by admin audit logs."
      resource="users"
      columns={[
        { key: "email", label: "Email" },
        { key: "firstName", label: "First" },
        { key: "lastName", label: "Last" },
        { key: "status", label: "Status" },
        { key: "memberships", label: "Organizations" },
        { key: "createdAt", label: "Created" },
      ]}
    />
  );
}
