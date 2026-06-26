import { AdminListPage } from "@/components/admin/admin-list-page";

export default function AdminCampaignsPage() {
  return <AdminListPage title="Outbound Campaigns" description="Campaign activity, targeting volume, status, and conversion across all organizations." resource="campaigns" columns={[
    { key: "organization.name", label: "Organization" },
    { key: "name", label: "Campaign" },
    { key: "campaignType", label: "Type" },
    { key: "status", label: "Status" },
    { key: "assignedAgent.name", label: "Agent" },
    { key: "metrics.targets", label: "Targets" },
    { key: "metrics.callsCompleted", label: "Calls" },
    { key: "metrics.conversionRate", label: "Conversion %" },
  ]} />;
}
