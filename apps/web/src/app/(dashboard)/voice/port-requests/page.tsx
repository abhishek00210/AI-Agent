"use client";

import type { CreatePortRequestInput, PortRequest } from "@ai-agent-platform/types";
import { Button } from "@ai-agent-platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, PhoneIncoming, Plus, X } from "lucide-react";
import { useState } from "react";
import type React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { authApi } from "@/lib/auth-api";

const empty: CreatePortRequestInput = {
  phoneNumber: "",
  countryCode: "CA",
  currentCarrier: "",
  accountNumber: "",
  accountPin: "",
  businessName: "",
  businessAddress: { line1: "", city: "", region: "", postalCode: "", country: "CA" },
  authorizedContactName: "",
  authorizedContactEmail: "",
  authorizedContactPhone: "",
};

export default function PortRequestsPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PortRequest | null>(null);
  const ports = useQuery({ queryKey: ["port-requests"], queryFn: authApi.portRequests, refetchInterval: 15_000 });
  const cancel = useMutation({ mutationFn: authApi.cancelPortRequest, onSuccess: () => client.invalidateQueries({ queryKey: ["port-requests"] }) });

  return <div className="space-y-7">
    <PageHeader title="Port Requests" description="Move an existing business number into Twilio and keep the same customer-facing number." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Port Existing Number</Button>} />
    {!ports.data?.data.length ? <EmptyState icon={PhoneIncoming} title="No port requests" description="Start a guided carrier port and track it through activation." action={<Button onClick={() => setOpen(true)}>Start Port Wizard</Button>} /> :
      <div className="overflow-x-auto border-y border-zinc-200 dark:border-zinc-800"><table className="w-full min-w-[920px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-3">Number</th><th className="px-4 py-3">Carrier</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Agent</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Estimated completion</th><th className="px-4 py-3">Actions</th></tr></thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{ports.data.data.map((port) => <tr key={port.id}>
          <td className="px-4 py-4 font-mono">{port.phoneNumber}</td><td className="px-4 py-4">{port.currentCarrier}</td><td className="px-4 py-4"><Status status={port.status} /></td><td className="px-4 py-4">{port.assignedAgent?.name ?? "Unassigned"}</td><td className="px-4 py-4">{date(port.submittedAt)}</td><td className="px-4 py-4 font-medium">{date(port.estimatedPortDate)}</td>
          <td className="px-4 py-4"><button className="mr-4 text-teal-600" onClick={() => setSelected(port)}>View</button>{!["COMPLETED","CANCELLED"].includes(port.status) && <button className="text-red-500" onClick={() => window.confirm("Cancel this port request?") && cancel.mutate(port.id)}>Cancel</button>}</td>
        </tr>)}</tbody></table></div>}
    {open && <PortWizard onClose={() => setOpen(false)} onDone={() => { setOpen(false); void client.invalidateQueries({ queryKey: ["port-requests"] }); }} />}
    {selected && <Details port={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function PortWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CreatePortRequestInput>(empty);
  const [created, setCreated] = useState<PortRequest | null>(null);
  const [loa, setLoa] = useState<File | null>(null);
  const [error, setError] = useState("");
  const agents = useQuery({ queryKey: ["agents", "port-options"], queryFn: () => authApi.agents({ limit: 100 }) });
  const save = useMutation({ mutationFn: authApi.createPortRequest });
  const finish = async () => {
    setError("");
    try {
      const port = created ?? await save.mutateAsync(form);
      setCreated(port);
      if (!loa) throw new Error("Choose a Letter of Authorization file.");
      await authApi.uploadPortLoa(port.id, loa);
      await authApi.submitPortRequest(port.id);
      onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Port submission failed."); }
  };
  const update = (key: keyof CreatePortRequestInput, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal title={`Port wizard · Step ${step} of 5`} onClose={onClose}>
    <div className="mb-6 grid grid-cols-5 gap-2">{[1,2,3,4,5].map((value) => <div key={value} className={`h-1 rounded ${value <= step ? "bg-teal-500" : "bg-zinc-200 dark:bg-zinc-800"}`} />)}</div>
    {step === 1 && <Fields><Select label="Country" value={form.countryCode} onChange={(value) => { update("countryCode", value); update("businessAddress", { ...form.businessAddress, country: value }); }} options={[["CA","Canada"],["US","United States"],["GB","United Kingdom"],["AU","Australia"]]} /><Input label="Phone number" value={form.phoneNumber} onChange={(value) => update("phoneNumber", value)} placeholder="+1 416 555 0100" /></Fields>}
    {step === 2 && <Fields><Input label="Current carrier" value={form.currentCarrier} onChange={(value) => update("currentCarrier", value)} /><Input label="Carrier account number" value={form.accountNumber} onChange={(value) => update("accountNumber", value)} /><Input label="Account PIN (optional)" type="password" value={form.accountPin ?? ""} onChange={(value) => update("accountPin", value)} /></Fields>}
    {step === 3 && <Fields><Input label="Business name" value={form.businessName} onChange={(value) => update("businessName", value)} /><Input label="Billing address" value={form.businessAddress.line1 ?? ""} onChange={(value) => update("businessAddress", { ...form.businessAddress, line1: value })} /><Input label="City" value={form.businessAddress.city ?? ""} onChange={(value) => update("businessAddress", { ...form.businessAddress, city: value })} /><Input label="Province / State" value={form.businessAddress.region ?? ""} onChange={(value) => update("businessAddress", { ...form.businessAddress, region: value })} /><Input label="Postal code" value={form.businessAddress.postalCode ?? ""} onChange={(value) => update("businessAddress", { ...form.businessAddress, postalCode: value })} /><Input label="Authorized contact" value={form.authorizedContactName} onChange={(value) => update("authorizedContactName", value)} /><Input label="Contact email" type="email" value={form.authorizedContactEmail} onChange={(value) => update("authorizedContactEmail", value)} /><Input label="Contact phone" value={form.authorizedContactPhone} onChange={(value) => update("authorizedContactPhone", value)} /><Select label="Assign agent (optional)" value={form.assignedAgentId ?? ""} onChange={(value) => update("assignedAgentId", value || undefined)} options={[["","Assign later"], ...(agents.data?.data.filter((agent) => agent.status === "ACTIVE").map((agent) => [agent.id, agent.name]) ?? [])]} /></Fields>}
    {step === 4 && <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700"><FileUp className="mb-3 h-8 w-8 text-teal-500" /><span className="font-medium">{loa?.name ?? "Upload Letter of Authorization"}</span><span className="mt-1 text-xs text-zinc-500">PDF, DOCX, PNG, or JPG · max 15 MB</span><input type="file" className="hidden" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={(event) => setLoa(event.target.files?.[0] ?? null)} /></label>}
    {step === 5 && <div className="space-y-3 rounded-2xl bg-zinc-50 p-5 text-sm dark:bg-zinc-900"><p><b>Number:</b> {form.phoneNumber}</p><p><b>Carrier:</b> {form.currentCarrier}</p><p><b>Business:</b> {form.businessName}</p><p><b>Contact:</b> {form.authorizedContactName} · {form.authorizedContactEmail}</p><p><b>LOA:</b> {loa?.name}</p><p className="text-zinc-500">Typical completion is 3–10 business days. Your tracking page will show the current estimate.</p></div>}
    {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    <div className="mt-7 flex justify-between"><Button variant="outline" onClick={step === 1 ? onClose : () => setStep(step - 1)}>{step === 1 ? "Cancel" : "Back"}</Button>{step < 5 ? <Button onClick={() => setStep(step + 1)}>Continue</Button> : <Button disabled={save.isPending} onClick={() => void finish()}>Submit Port Request</Button>}</div>
  </Modal>;
}

function Details({ port, onClose }: { port: PortRequest; onClose: () => void }) { return <Modal title={port.phoneNumber} onClose={onClose}><div className="space-y-5"><Status status={port.status} /><p className="text-sm text-zinc-500">{port.statusMessage}</p><div className="grid grid-cols-2 gap-4 text-sm"><p><b>Carrier</b><br />{port.currentCarrier}</p><p><b>Estimated completion</b><br />{date(port.estimatedPortDate)}</p><p><b>LOA</b><br />{port.loaDocument?.originalFileName ?? "Not uploaded"}</p><p><b>Agent</b><br />{port.assignedAgent?.name ?? "Unassigned"}</p></div><div><h3 className="mb-3 font-medium">Status history</h3>{port.history.map((item) => <div key={item.id} className="border-l-2 border-teal-500 py-2 pl-4 text-sm"><b>{item.status}</b><p className="text-zinc-500">{item.message}</p><span className="text-xs text-zinc-400">{date(item.createdAt)}</span></div>)}</div></div></Modal>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-950"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><button onClick={onClose}><X className="h-5 w-5" /></button></div>{children}</div></div>; }
function Fields({ children }: { children: React.ReactNode }) { return <div className="grid gap-4 sm:grid-cols-2">{children}</div>; }
function Input({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label className="space-y-1 text-sm"><span className="font-medium">{label}</span><input className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 dark:border-zinc-700" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="space-y-1 text-sm"><span className="font-medium">{label}</span><select className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 dark:border-zinc-700" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>; }
function Status({ status }: { status: PortRequest["status"] }) { const good = ["APPROVED","COMPLETED"].includes(status); const bad = ["REJECTED","FAILED","CANCELLED"].includes(status); return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${good ? "bg-emerald-100 text-emerald-700" : bad ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{status.replaceAll("_", " ")}</span>; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value)) : "—"; }
