import type { LucideIcon } from "lucide-react";
import { Button } from "@ai-agent-platform/ui";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

export function RoutePlaceholder({
  title,
  description,
  icon,
  actionLabel = "Coming soon",
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  actionLabel?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title={`${title} workspace is ready`}
        description="This area is connected to the authenticated SaaS shell and tenant context. Product workflows can be added here without changing the layout architecture."
        action={
          <Button variant="outline" disabled>
            {actionLabel}
          </Button>
        }
      />
    </div>
  );
}
