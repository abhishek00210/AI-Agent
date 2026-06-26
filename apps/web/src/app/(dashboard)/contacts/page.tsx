import { CircleUserRound } from "lucide-react";
import { RoutePlaceholder } from "@/components/layout/route-placeholder";

export default function ContactsPage() {
  return (
    <RoutePlaceholder
      title="Contacts"
      description="Store future customer and prospect records for tenant-scoped workflows."
      icon={CircleUserRound}
      actionLabel="Contacts pending"
    />
  );
}
