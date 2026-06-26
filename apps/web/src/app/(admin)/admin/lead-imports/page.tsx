import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminLeadImportsPage() {
  return (
    <AdminListPage
      title="Lead Imports"
      description="CSV import volume, failures, duplicates, and campaign handoff across organizations."
      resource="lead-imports"
      columns={[
        { key: "fileName", label: "File" },
        { key: "organization.name", label: "Organization" },
        { key: "status", label: "Status" },
        { key: "rowsFound", label: "Rows" },
        { key: "rowsImported", label: "Imported" },
        { key: "rowsFailed", label: "Failed" },
        { key: "duplicates", label: "Duplicates" },
        { key: "campaign.name", label: "Campaign" },
        { key: "createdAt", label: "Created" },
      ]}
    />
  );
}
