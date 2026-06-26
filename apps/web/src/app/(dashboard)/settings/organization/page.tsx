"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MemberRole, OrganizationMemberSummary } from "@ai-agent-platform/types";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { Button, cn } from "@ai-agent-platform/ui";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";
import { useAuthStore } from "@/store/auth-store";

const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required."),
  country: z.enum(["CA", "IN"]),
  currency: z.enum(["CAD", "INR"]),
  timezone: z.string().trim().min(1),
  language: z.enum(["en", "fr", "hi"]),
  telephonyProvider: z.enum(["TWILIO", "EXOTEL"]),
  paymentProvider: z.enum(["STRIPE", "RAZORPAY"]),
  dateFormat: z.string().trim().min(1),
  timeFormat: z.string().trim().min(1),
  numberFormat: z.string().trim().min(1),
  businessHoursTimezone: z.string().trim().min(1),
  taxRegion: z.string().trim().min(1),
});

const inviteMemberSchema = z.object({
  email: z.string().email("Enter a valid email."),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

const greetingSettingsSchema = z.object({
  enabled: z.boolean(),
  recencyWindowDays: z.coerce.number().int().min(1).max(365),
  confidenceThreshold: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

type UpdateOrganizationForm = z.infer<typeof updateOrganizationSchema>;
type InviteMemberForm = z.infer<typeof inviteMemberSchema>;
type GreetingSettingsForm = z.infer<typeof greetingSettingsSchema>;

const roles: MemberRole[] = ["OWNER", "ADMIN", "MEMBER"];

export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setCurrentOrganization = useAuthStore((state) => state.setCurrentOrganization);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";

  const organizationQuery = useQuery({
    queryKey: ["organization", "current"],
    queryFn: async () => {
      const organization = await authApi.currentOrganization();
      setCurrentOrganization(organization);
      return organization;
    },
  });

  const membersQuery = useQuery({
    queryKey: ["organization", "members"],
    queryFn: authApi.organizationMembers,
  });

  const updateOrganizationForm = useForm<UpdateOrganizationForm>({
    resolver: zodResolver(updateOrganizationSchema),
    values: {
      name: organizationQuery.data?.name ?? "",
      country: organizationQuery.data?.country ?? "CA",
      currency: organizationQuery.data?.currency ?? "CAD",
      timezone: organizationQuery.data?.timezone ?? "America/Toronto",
      language: organizationQuery.data?.language ?? "en",
      telephonyProvider: organizationQuery.data?.telephonyProvider ?? "TWILIO",
      paymentProvider: organizationQuery.data?.paymentProvider ?? "STRIPE",
      dateFormat: organizationQuery.data?.dateFormat ?? "yyyy-MM-dd",
      timeFormat: organizationQuery.data?.timeFormat ?? "HH:mm",
      numberFormat: organizationQuery.data?.numberFormat ?? "+1",
      businessHoursTimezone:
        organizationQuery.data?.businessHoursTimezone ?? "America/Toronto",
      taxRegion: organizationQuery.data?.taxRegion ?? "GST/HST",
    },
  });

  const inviteMemberForm = useForm<InviteMemberForm>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "MEMBER" },
  });
  const greetingSettingsForm = useForm<GreetingSettingsForm>({
    resolver: zodResolver(greetingSettingsSchema),
    values: organizationQuery.data?.greetingSettings ?? {
      enabled: true,
      recencyWindowDays: 90,
      confidenceThreshold: "MEDIUM",
    },
  });

  const updateOrganization = useMutation({
    mutationFn: authApi.updateCurrentOrganization,
    onSuccess: (organization) => {
      setNotice("Organization updated.");
      setCurrentOrganization(organization);
      void queryClient.invalidateQueries({ queryKey: ["organization", "current"] });
    },
  });

  const inviteMember = useMutation({
    mutationFn: authApi.inviteOrganizationMember,
    onSuccess: () => {
      setNotice("Invitation created.");
      setInviteOpen(false);
      inviteMemberForm.reset({ email: "", role: "MEMBER" });
    },
  });

  const updateGreetingSettings = useMutation({
    mutationFn: authApi.updateGreetingSettings,
    onSuccess: () => {
      setNotice("Personalized greeting settings updated.");
      void queryClient.invalidateQueries({ queryKey: ["organization", "current"] });
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: MemberRole }) =>
      authApi.updateOrganizationMemberRole(memberId, { role }),
    onSuccess: () => {
      setNotice("Member role updated.");
      void queryClient.invalidateQueries({ queryKey: ["organization", "members"] });
    },
  });

  const removeMember = useMutation({
    mutationFn: authApi.removeOrganizationMember,
    onSuccess: () => {
      setNotice("Member removed.");
      void queryClient.invalidateQueries({ queryKey: ["organization", "members"] });
      void queryClient.invalidateQueries({ queryKey: ["organization", "current"] });
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Organization settings"
        description="Manage tenant details and workspace membership for the current organization."
        action={
          <Button disabled={!canManage} onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Invite member
          </Button>
        }
      />

      {notice ? <Notice tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}
      {organizationQuery.error ? (
        <Notice tone="error" message={readError(organizationQuery.error)} />
      ) : null}
      {updateOrganization.error ? (
        <Notice tone="error" message={readError(updateOrganization.error)} />
      ) : null}
      {inviteMember.error ? <Notice tone="error" message={readError(inviteMember.error)} /> : null}
      {updateGreetingSettings.error ? (
        <Notice tone="error" message={readError(updateGreetingSettings.error)} />
      ) : null}
      {updateRole.error ? <Notice tone="error" message={readError(updateRole.error)} /> : null}
      {removeMember.error ? <Notice tone="error" message={readError(removeMember.error)} /> : null}

      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">Organization details</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Tenant metadata is scoped to your authenticated organization.
            </p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
              <Detail label="Plan" value={organizationQuery.data?.plan ?? "Loading"} />
              <Detail label="Status" value={organizationQuery.data?.status ?? "Loading"} />
              <Detail label="Country" value={organizationQuery.data?.country ?? "Loading"} />
              <Detail
                label="Members"
                value={String(organizationQuery.data?.memberCount ?? "Loading")}
              />
            </dl>
          </div>
          <form
            className="w-full max-w-md space-y-3"
            onSubmit={updateOrganizationForm.handleSubmit((values) =>
              updateOrganization.mutate(values),
            )}
          >
            <label className="block text-sm font-medium">
              Name
              <input
                className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
                disabled={!canManage || organizationQuery.isLoading}
                {...updateOrganizationForm.register("name")}
              />
            </label>
            {updateOrganizationForm.formState.errors.name ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {updateOrganizationForm.formState.errors.name.message}
              </p>
            ) : null}
            <Button type="submit" disabled={!canManage || updateOrganization.isPending}>
              {updateOrganization.isPending ? "Saving..." : "Save organization"}
            </Button>
          </form>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-base font-semibold">Localization</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Country controls the default telephony provider, payment provider, currency,
              timezone, phone format, and tax region. Currency and providers are readonly here
              because they are auto-managed from country defaults.
            </p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
              <Detail label="Telephony" value={organizationQuery.data?.telephonyProvider ?? "—"} />
              <Detail label="Payments" value={organizationQuery.data?.paymentProvider ?? "—"} />
              <Detail label="Currency" value={organizationQuery.data?.currency ?? "—"} />
            </dl>
          </div>
          <form
            className="grid w-full max-w-2xl gap-4 sm:grid-cols-2"
            onSubmit={updateOrganizationForm.handleSubmit((values) =>
              updateOrganization.mutate(values),
            )}
          >
            <SelectField
              label="Country"
              disabled={!canManage || organizationQuery.isLoading}
              register={updateOrganizationForm.register("country")}
              options={[
                ["CA", "Canada"],
                ["IN", "India"],
              ]}
            />
            <SelectField
              label="Language"
              disabled={!canManage || organizationQuery.isLoading}
              register={updateOrganizationForm.register("language")}
              options={[
                ["en", "English"],
                ["fr", "French"],
                ["hi", "Hindi"],
              ]}
            />
            <TextInput
              label="Currency"
              readOnly
              register={updateOrganizationForm.register("currency")}
            />
            <TextInput
              label="Telephony provider"
              readOnly
              register={updateOrganizationForm.register("telephonyProvider")}
            />
            <TextInput
              label="Payment provider"
              readOnly
              register={updateOrganizationForm.register("paymentProvider")}
            />
            <TextInput
              label="Timezone"
              disabled={!canManage || organizationQuery.isLoading}
              register={updateOrganizationForm.register("timezone")}
            />
            <TextInput
              label="Business hours timezone"
              disabled={!canManage || organizationQuery.isLoading}
              register={updateOrganizationForm.register("businessHoursTimezone")}
            />
            <TextInput
              label="Phone number format"
              readOnly
              register={updateOrganizationForm.register("numberFormat")}
            />
            <TextInput
              label="Date format"
              disabled={!canManage || organizationQuery.isLoading}
              register={updateOrganizationForm.register("dateFormat")}
            />
            <TextInput
              label="Time format"
              disabled={!canManage || organizationQuery.isLoading}
              register={updateOrganizationForm.register("timeFormat")}
            />
            <TextInput
              label="Tax region"
              disabled={!canManage || organizationQuery.isLoading}
              register={updateOrganizationForm.register("taxRegion")}
            />
            <div className="flex items-end">
              <Button type="submit" disabled={!canManage || updateOrganization.isPending}>
                {updateOrganization.isPending ? "Saving..." : "Save localization"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-base font-semibold">Personalized greetings</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Let returning callers hear a natural greeting based on recent, high-confidence
              customer memory. Older context is intentionally avoided.
            </p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
              <Detail
                label="Mode"
                value={organizationQuery.data?.greetingSettings.enabled ? "Enabled" : "Disabled"}
              />
              <Detail
                label="Recency"
                value={`${organizationQuery.data?.greetingSettings.recencyWindowDays ?? 90} days`}
              />
              <Detail
                label="Confidence"
                value={organizationQuery.data?.greetingSettings.confidenceThreshold ?? "MEDIUM"}
              />
            </dl>
          </div>
          <form
            className="w-full max-w-md space-y-4"
            onSubmit={greetingSettingsForm.handleSubmit((values) =>
              updateGreetingSettings.mutate(values),
            )}
          >
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-teal-600"
                disabled={!canManage || organizationQuery.isLoading}
                {...greetingSettingsForm.register("enabled")}
              />
              Enable personalized greetings
            </label>
            <label className="block text-sm font-medium">
              Recency window in days
              <input
                type="number"
                min={1}
                max={365}
                className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
                disabled={!canManage || organizationQuery.isLoading}
                {...greetingSettingsForm.register("recencyWindowDays")}
              />
            </label>
            <label className="block text-sm font-medium">
              Confidence threshold
              <select
                className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
                disabled={!canManage || organizationQuery.isLoading}
                {...greetingSettingsForm.register("confidenceThreshold")}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>
            <Button type="submit" disabled={!canManage || updateGreetingSettings.isPending}>
              {updateGreetingSettings.isPending ? "Saving..." : "Save greeting settings"}
            </Button>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold">Members</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Member actions are constrained to the current tenant.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Joined</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {membersQuery.data?.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  canManage={canManage}
                  currentUserId={user?.id}
                  onRoleChange={(role) => updateRole.mutate({ memberId: member.id, role })}
                  onRemove={() => removeMember.mutate(member.id)}
                />
              ))}
              {membersQuery.isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-center text-zinc-500" colSpan={5}>
                    Loading members...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Invite member</h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Invitations are stored for the current organization.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setInviteOpen(false)}>
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <form
              className="mt-5 space-y-4"
              onSubmit={inviteMemberForm.handleSubmit((values) => inviteMember.mutate(values))}
            >
              <label className="block text-sm font-medium">
                Email
                <input
                  className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
                  type="email"
                  {...inviteMemberForm.register("email")}
                />
              </label>
              <label className="block text-sm font-medium">
                Role
                <select
                  className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
                  {...inviteMemberForm.register("role")}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <Button className="w-full" type="submit" disabled={inviteMember.isPending}>
                {inviteMember.isPending ? "Inviting..." : "Create invitation"}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MemberRow({
  member,
  canManage,
  currentUserId,
  onRoleChange,
  onRemove,
}: {
  member: OrganizationMemberSummary;
  canManage: boolean;
  currentUserId?: string;
  onRoleChange: (role: MemberRole) => void;
  onRemove: () => void;
}) {
  const isCurrentUser = currentUserId === member.user.id;
  const displayName = `${member.user.firstName} ${member.user.lastName}`;

  return (
    <tr>
      <td className="px-6 py-4 font-medium">{displayName}</td>
      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">{member.user.email}</td>
      <td className="px-6 py-4">
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-teal-600 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
          value={member.role}
          disabled={!canManage || isCurrentUser}
          onChange={(event) => onRoleChange(event.target.value as MemberRole)}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </td>
      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
        {new Date(member.createdAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4">
        <Button
          variant="outline"
          size="sm"
          disabled={!canManage || member.role === "OWNER" || isCurrentUser}
          onClick={onRemove}
        >
          Remove
        </Button>
      </td>
    </tr>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function TextInput({
  label,
  register,
  disabled,
  readOnly,
}: {
  label: string;
  register: UseFormRegisterReturn;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 read-only:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:read-only:bg-zinc-900"
        disabled={disabled}
        readOnly={readOnly}
        {...register}
      />
    </label>
  );
}

function SelectField({
  label,
  register,
  disabled,
  options,
}: {
  label: string;
  register: UseFormRegisterReturn;
  disabled?: boolean;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select
        className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
        disabled={disabled}
        {...register}
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Notice({
  tone,
  message,
  onDismiss,
}: {
  tone: "error" | "success";
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border px-4 py-3 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          : "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
      )}
    >
      <span>{message}</span>
      {onDismiss ? (
        <button className="text-xs font-medium" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
