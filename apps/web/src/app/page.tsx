import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Check,
  ChevronDown,
  DatabaseZap,
  FileText,
  Globe2,
  MessageSquareText,
  PhoneCall,
  Play,
  Radar,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

const siteUrl = "https://agent.zodo.ca";
const logoSrc = "/brand/zodo-ai-logo.png";

export const metadata: Metadata = {
  title: "Zodo AI Employee Platform | Never Miss Another Customer",
  description:
    "Hire AI employees that answer calls, qualify leads, book appointments, remember customers, update CRM, and follow up 24/7 across Canada and India.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Zodo AI Employee Platform",
    description:
      "AI employees for calls, chat, appointments, CRM, customer memory, and automated follow-up.",
    url: siteUrl,
    siteName: "Zodo AI",
    type: "website",
    images: [{ url: logoSrc, width: 955, height: 290, alt: "Zodo AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zodo AI Employee Platform",
    description: "Never miss another customer. AI employees that answer, qualify, book, and follow up.",
  },
};

const navItems = ["Products", "Solutions", "Pricing", "Developers", "Resources", "Company"];

const stats = [
  { value: "24/7", label: "availability" },
  { value: "2", label: "countries live" },
  { value: "11+", label: "workflows automated" },
  { value: "<1 min", label: "to answer every call" },
];

const logos = ["Northstar Dental", "Atlas Roofing", "Harbor Realty", "Maple HVAC", "Nova Clinics"];

const features = [
  {
    icon: PhoneCall,
    title: "Voice AI",
    copy: "Answers inbound calls, handles outbound calls, transfers, records, and summarizes conversations.",
  },
  {
    icon: MessageSquareText,
    title: "Chat AI",
    copy: "Turns website conversations into qualified opportunities with context-aware answers.",
  },
  {
    icon: DatabaseZap,
    title: "Knowledge Base",
    copy: "Searches PDFs, websites, FAQs, text, and Word documents before answering.",
  },
  {
    icon: Users,
    title: "Customer Memory",
    copy: "Recognizes returning callers and uses summaries, appointments, and CRM history naturally.",
  },
  {
    icon: Workflow,
    title: "Automation",
    copy: "Sends follow-ups, reminders, review requests, and campaign calls without manual work.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    copy: "Tracks calls, leads, appointments, revenue, campaigns, usage, and conversion performance.",
  },
  {
    icon: Globe2,
    title: "Phone Numbers",
    copy: "Buy, forward, or port numbers with Twilio in Canada and Exotel in India.",
  },
  {
    icon: CalendarCheck,
    title: "Appointments",
    copy: "Books, reschedules, confirms, and reminds customers using your real availability.",
  },
  {
    icon: ShieldCheck,
    title: "CRM Foundation",
    copy: "Updates leads, customer profiles, timelines, transcripts, summaries, and communication threads.",
  },
];

const industries = [
  "Roofing",
  "Dental",
  "Healthcare",
  "Real Estate",
  "Law Firms",
  "Home Services",
  "Insurance",
  "HVAC",
  "Salons",
  "Restaurants",
];

const integrations = ["Twilio", "Exotel", "Stripe", "Razorpay", "Google Calendar", "Outlook", "Zapier", "Webhooks"];

const comparison = [
  {
    name: "Human Receptionist",
    availability: "Business hours",
    memory: "Manual notes",
    followUp: "Often delayed",
    scale: "Hire more people",
  },
  {
    name: "Traditional Call Center",
    availability: "Scheduled shifts",
    memory: "Disconnected",
    followUp: "Separate process",
    scale: "Expensive",
  },
  {
    name: "Generic AI Bot",
    availability: "Online",
    memory: "Shallow",
    followUp: "Limited",
    scale: "Narrow use case",
  },
  {
    name: "Zodo AI Employee",
    availability: "24/7 voice + chat",
    memory: "Customer profiles",
    followUp: "Automatic",
    scale: "Instant",
  },
];

const plans = [
  {
    name: "Starter",
    price: "$99",
    copy: "For small teams that want every call answered.",
    features: ["1 AI employee", "500 voice minutes", "500 SMS", "10 knowledge bases"],
  },
  {
    name: "Pro",
    price: "$199",
    copy: "For growing teams automating calls, CRM, and follow-up.",
    features: ["5 AI employees", "2,500 voice minutes", "2,500 SMS", "Advanced analytics"],
    featured: true,
  },
  {
    name: "Agency",
    price: "$399",
    copy: "For teams operating multiple brands, numbers, and workflows.",
    features: ["Unlimited AI employees", "10,000 voice minutes", "Campaigns", "Priority support"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    copy: "For regulated teams, custom integrations, and dedicated support.",
    features: ["Custom limits", "Security review", "Dedicated onboarding", "SLA options"],
  },
];

const faqs = [
  {
    question: "Is this just a chatbot?",
    answer:
      "No. Zodo is an AI employee platform that combines voice, chat, CRM, appointments, memory, analytics, knowledge search, and automation.",
  },
  {
    question: "Can we use our existing business number?",
    answer:
      "Yes. You can buy a new number, forward your existing number, or use porting workflows where supported.",
  },
  {
    question: "Does it work in Canada and India?",
    answer:
      "Yes. Canada uses Twilio and Stripe. India uses Exotel and Razorpay, with country-aware defaults.",
  },
  {
    question: "What knowledge can the AI use?",
    answer:
      "PDFs, websites, FAQs, text, and Word documents are supported today, with Google Drive, Notion, and Confluence planned.",
  },
  {
    question: "Can it book appointments?",
    answer:
      "Yes. The AI can collect details, check configured availability, book appointments, send confirmations, and update CRM timelines.",
  },
];

const workflow = [
  "Incoming call",
  "AI answers",
  "Qualifies need",
  "Books appointment",
  "Updates CRM",
  "Sends confirmation",
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#05070d] text-white">
      <JsonLd />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_20%_10%,rgba(52,211,153,0.18),transparent_26%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.18),transparent_28%),linear-gradient(180deg,#05070d_0%,#070914_48%,#03040a_100%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:64px_64px]" />

      <Header />

      <section className="relative z-10 flex min-h-[calc(100svh-76px)] items-center px-5 pb-14 pt-28 sm:px-8 lg:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="max-w-3xl animate-[riseIn_.8s_ease-out_both]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/75 shadow-2xl shadow-emerald-500/10 backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              AI employees for Canada and India
            </div>
            <h1 className="max-w-4xl text-balance text-6xl font-semibold tracking-[-0.075em] text-white sm:text-7xl lg:text-[6.7rem] lg:leading-[0.88]">
              Meet your AI employee.
              <span className="block bg-gradient-to-r from-white via-emerald-100 to-cyan-200 bg-clip-text text-transparent">
                Never miss a customer.
              </span>
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-slate-300 sm:text-xl">
              Answers every call, qualifies leads, books appointments, updates CRM, remembers customers, and follows up 24/7.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex h-[52px] items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-slate-950 transition hover:scale-[1.02] hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#demo"
                className="inline-flex h-[52px] items-center justify-center rounded-full border border-white/15 bg-white/[0.05] px-6 text-sm font-semibold text-white backdrop-blur transition hover:border-white/25 hover:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <Play className="mr-2 h-4 w-4" />
                Watch Live Demo
              </Link>
              <Link
                href="#pricing"
                className="inline-flex h-[52px] items-center justify-center rounded-full px-4 text-sm font-semibold text-slate-300 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                Book Demo
              </Link>
            </div>
          </div>

          <HeroConsole />
        </div>
      </section>

      <ProofSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <ProductDemoSection />
      <IndustriesSection />
      <IntegrationsSection />
      <ComparisonSection />
      <TestimonialsSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#05070d]/70 backdrop-blur-2xl">
      <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10" aria-label="Main navigation">
        <Link href="/" className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <Image
            src={logoSrc}
            alt="Zodo AI"
            width={191}
            height={58}
            priority
            className="h-12 w-auto rounded-xl object-contain shadow-lg shadow-emerald-500/10"
          />
        </Link>
        <div className="hidden items-center gap-7 lg:flex">
          {navItems.map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-slate-300 transition hover:text-white">
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white sm:inline-flex">
            Login
          </Link>
          <Link href="#pricing" className="hidden rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 sm:inline-flex">
            Book Demo
          </Link>
          <Link href="/register" className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200">
            Start Free Trial
          </Link>
        </div>
      </nav>
    </header>
  );
}

function HeroConsole() {
  return (
    <div className="relative mx-auto w-full max-w-2xl animate-[riseIn_.9s_.12s_ease-out_both]">
      <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-tr from-emerald-400/20 via-cyan-400/10 to-indigo-500/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-300/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-300/80" />
          </div>
          <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Live call in progress
          </span>
        </div>

        <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
            <div className="rounded-3xl bg-slate-950/70 p-5">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Incoming call</p>
                  <p className="mt-1 text-lg font-semibold">+1 (416) ••• 4436</p>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-300 text-slate-950 animate-[pulseGlow_2s_ease-in-out_infinite]">
                  <PhoneCall className="h-5 w-5" />
                </span>
              </div>
              <div className="space-y-3">
                {workflow.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 text-sm text-slate-200"
                    style={{ animation: `stepIn 4.8s ${index * 0.32}s ease-in-out infinite` }}
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-300/15 text-xs text-emerald-200">
                      {index + 1}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">AI Employee</p>
                <h2 className="mt-1 text-2xl font-semibold">Reception + Sales</h2>
              </div>
              <Radar className="h-6 w-6 text-cyan-200 animate-spin [animation-duration:8s]" />
            </div>
            <div className="space-y-3">
              <SpeechBubble role="AI" text="Hi, thanks for calling. How can I help today?" />
              <SpeechBubble role="Customer" text="I need a roof inspection this week." muted />
              <SpeechBubble role="AI" text="I can help with that. What address should we schedule for?" />
            </div>
            <div className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
              <div className="flex items-start gap-3">
                <CalendarCheck className="mt-1 h-5 w-5 text-emerald-200" />
                <div>
                  <p className="font-semibold text-emerald-100">Appointment booked</p>
                  <p className="mt-1 text-sm text-emerald-100/70">Friday, 2:30 PM · CRM updated · SMS confirmation sent</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpeechBubble({ role, text, muted = false }: { role: string; text: string; muted?: boolean }) {
  return (
    <div className={`rounded-3xl px-4 py-3 ${muted ? "bg-white/[0.06] text-slate-300" : "bg-white text-slate-950"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-50">{role}</p>
      <p className="mt-1 text-sm leading-6">{text}</p>
    </div>
  );
}

function ProofSection() {
  return (
    <section className="relative z-10 border-y border-white/10 bg-white/[0.03] px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Built for businesses that cannot miss calls</p>
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-slate-300">
              {logos.map((logo) => (
                <span key={logo}>{logo}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
                <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section id="solutions" className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <SectionIntro
        eyebrow="The hidden leak"
        title="Missed calls quietly become lost revenue."
        copy="Most customers will not wait, leave a voicemail, or call back. They call the next business."
      />
      <div className="mx-auto mt-14 grid max-w-6xl gap-5 md:grid-cols-3">
        {[
          ["Missed call", "A customer calls after hours, during lunch, or while your team is busy."],
          ["Lost lead", "No instant answer means no qualification, no booking, and no CRM update."],
          ["Lost revenue", "The opportunity disappears before anyone knows it existed."],
        ].map(([title, copy], index) => (
          <div key={title} className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 transition hover:-translate-y-1 hover:bg-white/[0.07]">
            <span className="text-sm text-emerald-200">0{index + 1}</span>
            <h3 className="mt-8 text-2xl font-semibold">{title}</h3>
            <p className="mt-4 leading-7 text-slate-400">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SolutionSection() {
  return (
    <section id="products" className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <SectionIntro
          align="left"
          eyebrow="The AI employee loop"
          title="From first ring to booked revenue."
          copy="Zodo listens, understands, acts, and records every important customer moment."
        />
        <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
          <div className="absolute inset-y-10 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-emerald-300/50 to-transparent md:block" />
          <div className="grid gap-4 md:grid-cols-2">
            {workflow.map((step, index) => (
              <div key={step} className="rounded-3xl bg-slate-950/70 p-5 transition hover:bg-slate-900">
                <div className="mb-5 flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-300 text-sm font-bold text-slate-950">
                    {index + 1}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold">{step}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{solutionCopy(step)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <SectionIntro
        eyebrow="Product depth"
        title="Everything an AI employee needs to actually work."
        copy="Voice, chat, memory, knowledge, appointments, automations, analytics, and CRM in one operating system."
      />
      <div className="mx-auto mt-14 grid max-w-7xl gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 md:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: { icon: LucideIcon; title: string; copy: string } }) {
  const Icon = feature.icon;

  return (
    <div className="group bg-[#070914] p-7 transition hover:bg-[#0b1020]">
      <Icon className="h-6 w-6 text-emerald-200 transition group-hover:scale-110" />
      <h3 className="mt-8 text-xl font-semibold">{feature.title}</h3>
      <p className="mt-3 leading-7 text-slate-400">{feature.copy}</p>
    </div>
  );
}

function ProductDemoSection() {
  return (
    <section id="demo" className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <SectionIntro
        eyebrow="Interactive product preview"
        title="A live operating system for customer conversations."
        copy="Every call becomes a transcript, summary, timeline event, lead update, appointment, and follow-up."
      />
      <div className="mx-auto mt-14 max-w-7xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="grid min-h-[620px] lg:grid-cols-[260px_1fr_340px]">
          <aside className="border-b border-white/10 bg-white/[0.03] p-6 lg:border-b-0 lg:border-r">
            <p className="text-sm font-semibold text-slate-400">Workspace</p>
            <div className="mt-8 space-y-2">
              {["Live Calls", "CRM Timeline", "Appointments", "Knowledge", "Automations", "Analytics"].map((item, index) => (
                <div key={item} className={`rounded-2xl px-4 py-3 text-sm ${index === 0 ? "bg-white text-slate-950" : "text-slate-400"}`}>
                  {item}
                </div>
              ))}
            </div>
          </aside>
          <div className="p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold">Roof inspection call</h3>
                <p className="mt-1 text-sm text-slate-500">Live transcript · knowledge lookup · appointment intent detected</p>
              </div>
              <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-sm text-emerald-200">Connected</span>
            </div>
            <div className="space-y-4">
              <TimelineRow icon={PhoneCall} title="Call received" copy="Returning customer recognized from caller ID." />
              <TimelineRow icon={FileText} title="Knowledge searched" copy="Matched service area, inspection policy, and booking rules." />
              <TimelineRow icon={CalendarCheck} title="Appointment created" copy="Friday at 2:30 PM with confirmation SMS." />
              <TimelineRow icon={Sparkles} title="AI summary generated" copy="Customer requested roof inspection after recent storm damage." />
            </div>
          </div>
          <aside className="border-t border-white/10 bg-white/[0.03] p-6 lg:border-l lg:border-t-0">
            <h3 className="text-lg font-semibold">Customer profile</h3>
            <div className="mt-5 rounded-3xl bg-white/[0.055] p-5">
              <p className="text-sm text-slate-500">Name</p>
              <p className="mt-1 font-semibold">John Smith</p>
              <p className="mt-5 text-sm text-slate-500">Lead status</p>
              <p className="mt-1 font-semibold text-emerald-200">Booked</p>
              <p className="mt-5 text-sm text-slate-500">Memory</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">Previously asked for a roofing estimate. Prefers afternoon appointments.</p>
            </div>
            <div className="mt-5 rounded-3xl bg-emerald-300 p-5 text-slate-950">
              <p className="text-sm font-semibold">Next best action</p>
              <p className="mt-2 text-sm">Send reminder 24 hours before appointment.</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function IndustriesSection() {
  return (
    <section className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <SectionIntro
        eyebrow="Industries"
        title="Built for businesses where every conversation matters."
        copy="From local services to regulated teams, Zodo adapts to your workflows and knowledge."
      />
      <div className="mx-auto mt-14 grid max-w-7xl grid-cols-2 gap-3 md:grid-cols-5">
        {industries.map((industry) => (
          <div key={industry} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 text-center font-semibold transition hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-emerald-300/10">
            {industry}
          </div>
        ))}
      </div>
    </section>
  );
}

function IntegrationsSection() {
  return (
    <section id="developers" className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-white/10 bg-white/[0.04] p-8 sm:p-12">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <SectionIntro
            align="left"
            eyebrow="Integrations"
            title="Connect the stack you already trust."
            copy="Telephony, payments, calendar, automations, APIs, and webhooks are designed as provider-based foundations."
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {integrations.map((integration) => (
              <div key={integration} className="grid min-h-24 place-items-center rounded-3xl bg-slate-950/70 p-4 text-center font-semibold text-slate-200 transition hover:bg-white hover:text-slate-950">
                {integration}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <SectionIntro
        eyebrow="Why choose Zodo"
        title="Not a receptionist. Not a bot. An operating system for AI employees."
        copy="The difference is the ability to answer, remember, act, and improve across every customer interaction."
      />
      <div className="mx-auto mt-14 max-w-7xl overflow-x-auto rounded-[2rem] border border-white/10">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead className="bg-white/[0.06] text-sm text-slate-400">
            <tr>
              <th className="p-5">Option</th>
              <th className="p-5">Availability</th>
              <th className="p-5">Memory</th>
              <th className="p-5">Follow-up</th>
              <th className="p-5">Scale</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row) => (
              <tr key={row.name} className={`border-t border-white/10 ${row.name.includes("Zodo") ? "bg-emerald-300/10 text-emerald-50" : "text-slate-300"}`}>
                <td className="p-5 font-semibold">{row.name}</td>
                <td className="p-5">{row.availability}</td>
                <td className="p-5">{row.memory}</td>
                <td className="p-5">{row.followUp}</td>
                <td className="p-5">{row.scale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section id="resources" className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
        {[
          ["We stopped losing after-hours roof leads.", "Zodo answers every call, books the inspection, and sends the confirmation before our team opens the next morning.", "Operations Director, Roofing"],
          ["The AI remembers our patients.", "Returning callers feel recognized without the team digging through notes. It is calm, useful, and surprisingly natural.", "Clinic Manager, Healthcare"],
          ["It feels like adding a full-time coordinator.", "Calls, website chats, summaries, CRM updates, reminders — the work simply gets done.", "Broker Owner, Real Estate"],
        ].map(([quote, body, author]) => (
          <figure key={quote} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-7">
            <div className="mb-6 flex gap-1 text-emerald-200">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="text-2xl font-semibold leading-tight">{quote}</blockquote>
            <p className="mt-5 leading-7 text-slate-400">{body}</p>
            <figcaption className="mt-8 text-sm font-semibold text-slate-300">{author}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <SectionIntro
        eyebrow="Pricing"
        title="Start with one AI employee. Scale when it works."
        copy="Simple plans for teams that want more calls answered, more appointments booked, and less manual follow-up."
      />
      <div className="mx-auto mt-14 grid max-w-7xl gap-4 lg:grid-cols-4">
        {plans.map((plan) => (
          <div key={plan.name} className={`rounded-[2rem] border p-6 ${plan.featured ? "border-emerald-300/50 bg-emerald-300 text-slate-950" : "border-white/10 bg-white/[0.045]"}`}>
            <p className="text-lg font-semibold">{plan.name}</p>
            <div className="mt-5 flex items-end gap-1">
              <span className="text-5xl font-semibold tracking-tight">{plan.price}</span>
              {plan.price !== "Custom" ? <span className="pb-2 text-sm opacity-70">/mo</span> : null}
            </div>
            <p className={`mt-4 min-h-14 text-sm leading-6 ${plan.featured ? "text-slate-800" : "text-slate-400"}`}>{plan.copy}</p>
            <ul className="mt-7 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <SectionIntro eyebrow="FAQ" title="Questions businesses ask before hiring an AI employee." />
      <div className="mx-auto mt-12 max-w-3xl divide-y divide-white/10 rounded-[2rem] border border-white/10 bg-white/[0.045]">
        {faqs.map((faq) => (
          <details key={faq.question} className="group p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
              {faq.question}
              <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
            </summary>
            <p className="mt-4 leading-7 text-slate-400">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative z-10 px-5 py-28 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[3rem] border border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.38),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.04))] p-10 text-center shadow-2xl shadow-emerald-950/30 sm:p-16">
        <p className="text-sm uppercase tracking-[0.24em] text-emerald-100">Ready to hire your first AI employee?</p>
        <h2 className="mx-auto mt-6 max-w-4xl text-balance text-5xl font-semibold tracking-[-0.055em] sm:text-7xl">
          Answer every call. Book every opportunity. Grow without waiting.
        </h2>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/register" className="inline-flex h-[52px] items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100">
            Start Free Trial
          </Link>
          <Link href="#demo" className="inline-flex h-[52px] items-center justify-center rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/10">
            Book Demo
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const groups = {
    Products: ["Voice AI", "Chat AI", "Knowledge Base", "CRM", "Analytics"],
    Solutions: ["Roofing", "Dental", "Healthcare", "Real Estate", "Home Services"],
    Developers: ["API", "Webhooks", "Integrations", "Provider Architecture"],
    Company: ["About", "Security", "Contact", "Careers"],
    Legal: ["Privacy", "Terms", "Compliance"],
  };
  return (
    <footer id="company" className="relative z-10 border-t border-white/10 px-5 py-14 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_2fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src={logoSrc}
              alt="Zodo AI"
              width={239}
              height={73}
              className="h-16 w-auto rounded-2xl object-contain"
            />
          </div>
          <p className="mt-5 max-w-sm leading-7 text-slate-400">
            AI employees for businesses that want every customer answered, remembered, and followed up.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(groups).map(([group, links]) => (
            <div key={group}>
              <p className="font-semibold">{group}</p>
              <div className="mt-4 space-y-3">
                {links.map((link) => (
                  <a key={link} href="#" className="block text-sm text-slate-500 transition hover:text-white">
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}

function SectionIntro({
  eyebrow,
  title,
  copy,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-4xl text-center" : "max-w-xl"}>
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">{eyebrow}</p>
      <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">{title}</h2>
      {copy ? <p className="mt-5 text-lg leading-8 text-slate-400">{copy}</p> : null}
    </div>
  );
}

function TimelineRow({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <div className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.045] p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p>
      </div>
    </div>
  );
}

function solutionCopy(step: string) {
  const copy: Record<string, string> = {
    "Incoming call": "The call is routed instantly from Twilio or Exotel to your AI employee.",
    "AI answers": "The AI starts naturally with your business instructions, voice, and greeting policy.",
    "Qualifies need": "It asks concise questions and captures service, urgency, location, and contact details.",
    "Books appointment": "It uses your availability and booking rules to create a real appointment.",
    "Updates CRM": "Customer profiles, leads, transcripts, and timelines stay connected automatically.",
    "Sends confirmation": "SMS and follow-up automations keep the customer moving forward.",
  };
  return copy[step] ?? "The platform handles the operational work automatically.";
}

function JsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Zodo AI Employee Platform",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description:
      "AI employee platform for phone calls, website chat, appointments, CRM updates, customer memory, analytics, and follow-up automation.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "99",
      highPrice: "399",
      priceCurrency: "CAD",
    },
    areaServed: ["Canada", "India"],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
