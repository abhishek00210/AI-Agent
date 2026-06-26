import { Globe2 } from "lucide-react";
import { RoutePlaceholder } from "@/components/layout/route-placeholder";

export default function WebsitesPage() {
  return (
    <RoutePlaceholder
      title="Websites"
      description="Connect website knowledge sources for future ingestion and indexing."
      icon={Globe2}
      actionLabel="Crawler pending"
    />
  );
}
