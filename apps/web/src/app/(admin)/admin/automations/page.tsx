"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";

type AdminWorkflow = {
  id: string;
  name: string;
  triggerType: string;
  enabled: boolean;
  updatedAt: string;
  organization: { id: string; name: string };
  _count: { executions: number };
  rules: Array<{ id: string; actionType: string; delayMinutes: number }>;
};
type AdminTemplate = {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  estimatedConversionImpact: number;
  adoptionCount: number;
};

export default function AdminAutomationsPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "automations"],
    queryFn: () => adminApi.list("automations") as Promise<AdminWorkflow[]>,
  });
  const templates = useQuery({
    queryKey: ["admin", "workflow-templates"],
    queryFn: () => adminApi.list("workflow-templates") as Promise<AdminTemplate[]>,
  });
  const disable = useMutation({
    mutationFn: (id: string) => adminApi.patch(`/admin/automations/workflows/${id}/disable`, {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "automations"] }),
  });
  const setTemplateStatus = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      adminApi.patch(`/admin/workflow-templates/${id}/status`, { enabled }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "workflow-templates"] }),
  });
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-400">
          Global operations
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Follow-up automations</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Tenant workflows, execution volume, and global safety controls.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[1fr_1fr_160px_120px_120px] bg-white/5 px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
          <span>Workflow</span>
          <span>Organization</span>
          <span>Trigger</span>
          <span>Executions</span>
          <span>Status</span>
        </div>
        {query.data?.map((workflow) => (
          <div
            key={workflow.id}
            className="grid grid-cols-[1fr_1fr_160px_120px_120px] items-center border-t border-white/10 px-4 py-4 text-sm"
          >
            <span className="font-medium">{workflow.name}</span>
            <span className="text-zinc-400">{workflow.organization.name}</span>
            <span>{workflow.triggerType.replaceAll("_", " ")}</span>
            <span>{workflow._count.executions}</span>
            <div>
              {workflow.enabled ? (
                <button className="text-amber-400" onClick={() => disable.mutate(workflow.id)}>
                  Disable
                </button>
              ) : (
                <span className="text-zinc-500">Disabled</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div>
        <h2 className="text-xl font-semibold">Global template library</h2>
        <p className="mt-1 text-sm text-zinc-400">Adoption and availability across tenants.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[1fr_150px_120px_120px_120px] bg-white/5 px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
          <span>Template</span>
          <span>Category</span>
          <span>Impact</span>
          <span>Adoption</span>
          <span>Status</span>
        </div>
        {templates.data?.map((template) => (
          <div
            key={template.id}
            className="grid grid-cols-[1fr_150px_120px_120px_120px] items-center border-t border-white/10 px-4 py-4 text-sm"
          >
            <span className="font-medium">{template.name}</span>
            <span>{template.category}</span>
            <span>{"★".repeat(template.estimatedConversionImpact)}</span>
            <span>{template.adoptionCount}</span>
            <button
              className={template.enabled ? "text-amber-400" : "text-teal-400"}
              onClick={() =>
                setTemplateStatus.mutate({ id: template.id, enabled: !template.enabled })
              }
            >
              {template.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
