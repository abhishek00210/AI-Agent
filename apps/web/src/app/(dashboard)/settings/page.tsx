import { LockKeyhole, Settings, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

const settingsSections = [
  {
    title: "Organization",
    description: "Manage tenant details, plan status, invitations, and members.",
    href: "/settings/organization",
    icon: UsersRound,
  },
  {
    title: "Profile",
    description: "Update personal information and prepare avatar management.",
    href: "/settings/profile",
    icon: UserRound,
  },
  {
    title: "Security",
    description: "Review active session details and password controls.",
    href: "/settings/security",
    icon: LockKeyhole,
  },
  {
    title: "Integrations",
    description: "Provider settings for voice, billing, and storage will appear here.",
    href: "/settings",
    icon: Settings,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage account, workspace, security, and future provider configuration."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.title}
              href={section.href}
              className="rounded-md border border-zinc-200 bg-white p-5 transition-colors hover:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {section.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
