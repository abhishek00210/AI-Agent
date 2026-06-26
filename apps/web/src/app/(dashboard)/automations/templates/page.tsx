"use client";

import type { WorkflowTemplateCategory } from "@ai-agent-platform/types";
import { Button } from "@ai-agent-platform/ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, FileCheck2, MessageSquareMore, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

const categories: Array<"ALL" | WorkflowTemplateCategory> = [
  "ALL",
  "LEAD",
  "APPOINTMENT",
  "REVIEW",
  "QUOTE",
];

export default function WorkflowTemplatesPage() {
  const router = useRouter();
  const [category, setCategory] = useState<(typeof categories)[number]>("ALL");
  const templates = useQuery({
    queryKey: ["workflow-templates", category],
    queryFn: () => authApi.workflowTemplates(category === "ALL" ? undefined : category),
  });
  return (
    <div className="space-y-7">
      <PageHeader
        title="Workflow templates"
        description="Choose a proven follow-up, customize it, and activate it in minutes."
      />
      <div className="flex flex-wrap gap-2">
        {categories.map((item) => (
          <button
            key={item}
            className={`rounded-full border px-4 py-2 text-sm ${
              item === category
                ? "border-teal-600 bg-teal-600 text-white"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            }`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {templates.data?.map((template) => (
          <article
            key={template.id}
            className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-teal-50 p-3 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <TemplateIcon category={template.category} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{template.name}</h2>
                  {template.systemTemplate ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] uppercase tracking-wide dark:bg-zinc-900">
                      Proven template
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{template.description}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-y border-zinc-100 py-4 text-sm dark:border-zinc-900">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Trigger</p>
                <p className="mt-1 font-medium">{template.triggerType.replaceAll("_", " ")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Estimated conversion impact
                </p>
                <div
                  className="mt-1 flex gap-0.5"
                  aria-label={`${template.estimatedConversionImpact} out of 5`}
                >
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className={`h-4 w-4 ${
                        index < template.estimatedConversionImpact
                          ? "fill-amber-400 text-amber-400"
                          : "text-zinc-300 dark:text-zinc-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <Button
              className="mt-5 w-full"
              onClick={() => router.push(`/automations/builder?templateId=${template.id}`)}
            >
              Use template <ArrowRight className="h-4 w-4" />
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}

function TemplateIcon({ category }: { category: WorkflowTemplateCategory }) {
  if (category === "APPOINTMENT") return <CalendarClock className="h-5 w-5" />;
  if (category === "REVIEW") return <FileCheck2 className="h-5 w-5" />;
  return <MessageSquareMore className="h-5 w-5" />;
}
