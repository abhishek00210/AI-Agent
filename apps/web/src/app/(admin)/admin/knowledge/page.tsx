import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminKnowledgePage() {
  return (
    <AdminListPage
      title="Knowledge bases"
      description="Inspect tenant knowledge bases, document counts, chunk counts, and processing health."
      resource="knowledge-bases"
      columns={[
        { key: "name", label: "Name" },
        { key: "organization.name", label: "Organization" },
        { key: "status", label: "Status" },
        { key: "_count.documents", label: "Documents" },
        { key: "_count.knowledgeChunks", label: "Chunks" },
        { key: "createdAt", label: "Created" },
      ]}
    />
  );
}
