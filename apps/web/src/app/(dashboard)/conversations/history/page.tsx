import { MessagesSquare } from "lucide-react";
import { RoutePlaceholder } from "@/components/layout/route-placeholder";

export default function ChatHistoryPage() {
  return (
    <RoutePlaceholder
      title="Chat history"
      description="Review future text and voice conversation transcripts across this organization."
      icon={MessagesSquare}
      actionLabel="History pending"
    />
  );
}
