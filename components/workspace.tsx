"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BriefcaseBusiness,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  DollarSign,
  Globe2,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
  Zap,
  Pause,
  Play,
  CheckCircle2,
  AlertCircle,
  LockKeyhole,
  Send,
  ExternalLink,
} from "lucide-react";
import {
  fields,
  labels,
  type AppState,
  type Profile,
  type Job,
  type Screening,
  type Field,
} from "@/lib/types";
const money = (n: number) => `$${Math.round(n / 1000)}k`;
const statuses = {
  aligned: "Logistics aligned",
  review: "Needs a conversation",
  pending: "Awaiting candidate",
};
const initial: AppState = {
  user: null,
  profile: null,
  jobs: [],
  screenings: [],
  candidates: [],
  mode: "demo",
  recruiterAgent: "",
};
type View = "jobs" | "inbox" | "agent" | "candidates" | "about";
async function request(action: string, body: unknown) {
  const res = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "small" : ""}`}>
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      <span>
        your<span className="brand-hr">HR</span>
        <span className="brand-period">.</span>
      </span>
    </span>
  );
}
function CompanyIcon({ company }: { company: string }) {
  return (
    <span
      className={`company-icon company-${company.toLowerCase().replace(/[^a-z]/g, "")}`}
    >
      {company === "Forma" ? (
        <span className="forma-symbol">f</span>
      ) : company === "Layers" ? (
        <span>▱</span>
      ) : company === "Orbit" ? (
        <span>◉</span>
      ) : (
        company.slice(0, 1)
      )}
    </span>
  );
}
function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    const close = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d?.addEventListener("cancel", close);
    return () => {
      d?.removeEventListener("cancel", close);
      d?.close();
    };
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={title}
    >
      <header className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Input({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function FactInput({
  field,
  value,
  onChange,
}: {
  field: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const options: Record<string, string[]> = {
    authorization: ["Yes", "No"],
    sponsorship: ["Yes", "No"],
    relocation: ["Yes", "No"],
    workplace: ["Remote", "Hybrid", "On-site", "Flexible"],
  };
  if (options[field])
    return (
      <select
        aria-label={labels[field as Field] || field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Not answered yet</option>
        {options[field].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  return (
    <input
      aria-label={labels[field as Field] || field}
      type={["salary", "availability"].includes(field) ? "number" : "text"}
      min="0"
      max={
        field === "availability"
          ? 104
          : field === "salary"
            ? 10000000
            : undefined
      }
      step="1"
      placeholder={
        field === "location"
          ? "e.g. San Francisco, CA"
          : field === "salary"
            ? "e.g. 150000"
            : field === "availability"
              ? "e.g. 4"
              : ""
      }
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
export default function Workspace() {
  const [data, setData] = useState<AppState>(initial),
    [loading, setLoading] = useState(true),
    [view, setView] = useState<View>("jobs"),
    [query, setQuery] = useState(""),
    [workplace, setWorkplace] = useState("All arrangements"),
    [sponsorOnly, setSponsorOnly] = useState(false),
    [job, setJob] = useState<Job | null>(null),
    [screenId, setScreenId] = useState<string | null>(null),
    [auth, setAuth] = useState<"register" | "login" | null>(null),
    [posting, setPosting] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [inboxFilter, setInboxFilter] = useState("all");
  const refresh = async () => {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (!r.ok) throw new Error("Could not load your workspace.");
    const d: AppState = await r.json();
    setData(d);
    return d;
  };
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  async function act(action: string, body: unknown, message?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await request(action, body);
      await refresh();
      if (message) setNotice(message);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function demo(role: "candidate" | "recruiter") {
    const r = await act(
      "demo",
      { role },
      `${role === "candidate" ? "Candidate" : "Recruiter"} demo workspace opened`,
    );
    if (r) {
      setView("jobs");
      setScreenId(null);
      setJob(null);
      setAuth(null);
    }
  }
  async function startScreen(j: Job, candidateId?: string) {
    if (!data.user) {
      setJob(null);
      setAuth("register");
      return;
    }
    const r = await act("screen", { jobId: j.id, candidateId });
    if (r) {
      setJob(null);
      setScreenId(r.id);
      setView("inbox");
    }
  }
  const recruiter = data.user?.role === "recruiter";
  const screens = data.screenings;
  const pending = screens.reduce(
    (sum, s) => sum + s.checks.filter((c) => c.status === "pending").length,
    0,
  );
  const answered = screens.reduce(
    (sum, s) =>
      sum +
      s.checks.filter(
        (c) =>
          c.source === "Approved profile" ||
          c.source === "Approved reusable answer",
      ).length,
    0,
  );
  const ownJobs = data.jobs.filter(
    (j) => !recruiter || j.recruiterId === data.user?.id,
  );
  const filtered = ownJobs.filter(
    (j) =>
      `${j.title} ${j.company} ${j.location} ${j.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (workplace === "All arrangements" || j.workplace === workplace) &&
      (!sponsorOnly || j.sponsorship),
  );
  const selected = screens.find((s) => s.id === screenId);
  const nav = [
    {
      id: "jobs",
      label: recruiter ? "Your job posts" : "Find opportunities",
      icon: recruiter ? LayoutDashboard : Compass,
    },
    { id: "inbox", label: "Screening inbox", icon: MessageSquare },
    { id: "agent", label: recruiter ? "Hiring agent" : "My agent", icon: Bot },
    ...(recruiter
      ? [{ id: "candidates", label: "Candidate directory", icon: Users }]
      : []),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="logo-link" href="/" aria-label="yourHR home">
          <Logo />
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              aria-label={n.label}
              className={`nav-item ${view === n.id ? "active" : ""}`}
              onClick={() => {
                setView(n.id as View);
                setScreenId(null);
              }}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.id === "inbox" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-agent">
            <div className="bot-icon">
              <Bot size={22} />
            </div>
            <strong>
              A little less admin.
              <br />A lot more possibility.
            </strong>
            <p>Your next chapter starts with a conversation.</p>
          </div>
          <button
            className={`nav-item ${view === "about" ? "active" : ""}`}
            onClick={() => setView("about")}
          >
            <CircleHelp size={19} />
            How yourHR works
          </button>
          <a
            className="nav-item"
            href="https://github.com/Jameslovecs/yourHR"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={18} />
            Open source
          </a>
          <div className="sidebar-footer">
            Built for people. Powered by agents.
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>
              {view === "jobs"
                ? recruiter
                  ? "Your job posts"
                  : "Opportunities"
                : view === "inbox"
                  ? "Screening inbox"
                  : view === "agent"
                    ? "Agent settings"
                    : view === "candidates"
                      ? "Candidate directory"
                      : "How it works"}
            </strong>
          </div>
          <div className="top-actions">
            <span className="demo-label">Local V1</span>
            {data.user?.demo && (
              <div className="role-switch" aria-label="Demo role">
                <button
                  className={!recruiter ? "selected" : ""}
                  disabled={busy}
                  onClick={() => demo("candidate")}
                >
                  Candidate
                </button>
                <button
                  className={recruiter ? "selected" : ""}
                  disabled={busy}
                  onClick={() => demo("recruiter")}
                >
                  Recruiter
                </button>
              </div>
            )}
            {data.user ? (
              <>
                <span className="avatar" title={data.user.name}>
                  {data.user.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <button
                  aria-label="Sign out"
                  title="Sign out"
                  className="icon-button"
                  disabled={busy}
                  onClick={async () => {
                    await act("logout", {});
                    setView("jobs");
                    setScreenId(null);
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <>
                <button
                  className="text-button"
                  onClick={() => setAuth("login")}
                >
                  Log in
                </button>
                <button
                  className="button primary compact"
                  onClick={() => setAuth("register")}
                >
                  Create account
                </button>
              </>
            )}
          </div>
        </header>
        {error && (
          <div className="alert error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={18} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <CheckCircle2 size={18} />
            {notice}
          </div>
        )}
        <main className="page-content">
          {loading ? (
            <div className="loading">
              <span className="spinner" />
              Getting your workspace ready…
            </div>
          ) : (
            <>
              {!data.user && (
                <div className="demo-banner">
                  <div>
                    <Sparkles size={18} />
                    <span>
                      <strong>Meet your new job-search teammate.</strong> Try
                      the full experience with fictional demo accounts.
                    </span>
                  </div>
                  <div className="demo-buttons">
                    <button onClick={() => demo("candidate")} disabled={busy}>
                      Try candidate demo
                    </button>
                    <button onClick={() => demo("recruiter")} disabled={busy}>
                      Try recruiter demo
                    </button>
                  </div>
                </div>
              )}
              {view === "jobs" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        {recruiter
                          ? "LESS SCREENING. MORE CONNECTING."
                          : "YOUR NEXT CHAPTER"}
                      </div>
                      <h1>
                        {recruiter
                          ? "Great hires start here."
                          : "Find the work. Skip the busywork."}
                      </h1>
                      <p>
                        {recruiter
                          ? "Let your hiring agent cover the basics. Give your time to the people."
                          : "Your agent handles the repetitive questions. You focus on the right fit."}
                      </p>
                    </div>
                    {recruiter && (
                      <button
                        className="button primary"
                        onClick={() => setPosting(true)}
                      >
                        <Plus size={18} />
                        Post a job
                      </button>
                    )}
                  </div>
                  <div className="content-columns">
                    <section className="jobs-column">
                      <div className="hero-panel">
                        <div className="hero-copy">
                          <Pill tone="hero-pill">
                            <Sparkles size={13} />
                            HUMAN-FIRST HIRING
                          </Pill>
                          <h2>
                            {recruiter ? (
                              <>
                                A better first screen.
                                <br />
                                <em>Before the first call.</em>
                              </>
                            ) : (
                              <>
                                Let your agent
                                <br />
                                <em>make the introduction.</em>
                              </>
                            )}
                          </h2>
                          <p>
                            {recruiter
                              ? "Location, salary, sponsorship, availability. Your agent asks once, so your team can go deeper."
                              : "One profile. Answers that travel with you. Less repeating yourself, more meaningful conversations."}
                          </p>
                          <button
                            className="button dark"
                            onClick={() =>
                              data.user ? setView("agent") : setAuth("register")
                            }
                          >
                            <Bot size={17} />
                            {data.profile
                              ? "Meet your agent"
                              : "Set up your agent"}
                          </button>
                        </div>
                        <div className="agent-illustration" aria-hidden="true">
                          <div className="orbit orbit-one" />
                          <div className="orbit orbit-two" />
                          <div className="orbit orbit-three" />
                          <div className="illustration-center">
                            <Bot size={49} strokeWidth={1.4} />
                            <span className="mini-spark">✦</span>
                          </div>
                          <span className="floating-chip chip-location">
                            <MapPin size={15} />
                            Location? Sorted.
                            <Check size={13} />
                          </span>
                          <span className="floating-chip chip-salary">
                            <DollarSign size={15} />
                            Expectations? Aligned.
                            <Check size={13} />
                          </span>
                          <span className="floating-chip chip-human">
                            <Sparkles size={15} />
                            You take it from here.
                          </span>
                        </div>
                      </div>
                      <div className="section-title">
                        <h2>
                          {recruiter
                            ? "Your open roles"
                            : "Explore opportunities"}{" "}
                          <span>{ownJobs.length}</span>
                        </h2>
                        <span className="muted">
                          {recruiter
                            ? "Your agent is ready to screen"
                            : "A better first conversation starts here"}
                        </span>
                      </div>
                      <div className="search-controls">
                        <div className="search-input">
                          <Search size={19} />
                          <input
                            aria-label="Search jobs"
                            placeholder="Job title, company, or keyword"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                          {query && (
                            <button
                              aria-label="Clear search"
                              onClick={() => setQuery("")}
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                        <select
                          aria-label="Work arrangement filter"
                          value={workplace}
                          onChange={(e) => setWorkplace(e.target.value)}
                        >
                          <option>All arrangements</option>
                          <option>Remote</option>
                          <option>Hybrid</option>
                          <option>On-site</option>
                        </select>
                      </div>
                      <div className="filter-line">
                        <button
                          className={`filter-chip ${sponsorOnly ? "chosen" : ""}`}
                          onClick={() => setSponsorOnly(!sponsorOnly)}
                        >
                          <Globe2 size={14} />
                          Sponsorship available
                          {sponsorOnly && <Check size={14} />}
                        </button>
                        <span>
                          {filtered.length}{" "}
                          {filtered.length === 1
                            ? "opportunity"
                            : "opportunities"}
                        </span>
                      </div>
                      <div className="job-grid">
                        {filtered.map((j) => {
                          const s = screens.find((s) => s.jobId === j.id);
                          return (
                            <article className="job-card" key={j.id}>
                              <div className="job-card-top">
                                <CompanyIcon company={j.company} />
                                <div>
                                  <strong>{j.company}</strong>
                                  <span>
                                    {j.workplace === "Remote"
                                      ? "Distributed team"
                                      : j.location}
                                  </span>
                                </div>
                                <span
                                  className="agent-ready"
                                  title="Agent-enabled screening"
                                >
                                  <Bot size={15} />
                                </span>
                              </div>
                              <button
                                className="job-title"
                                onClick={() => setJob(j)}
                              >
                                {j.title}
                              </button>
                              <div className="job-location">
                                <MapPin size={15} />
                                {j.workplace === "Remote"
                                  ? "United States"
                                  : j.location}
                                <span>·</span>
                                {j.workplace}
                              </div>
                              <div className="job-tags">
                                {j.tags.map((t) => (
                                  <span key={t}>{t}</span>
                                ))}
                              </div>
                              <div className="salary">
                                {money(j.salaryMin)} – {money(j.salaryMax)}{" "}
                                <span>USD / year</span>
                              </div>
                              <div className="job-card-footer">
                                <span>
                                  <ShieldCheck size={15} />
                                  {j.sponsorship
                                    ? "Visa sponsorship"
                                    : "Agent screening"}
                                </span>
                                <button
                                  className="button secondary small"
                                  onClick={() => {
                                    if (s && !recruiter) {
                                      setScreenId(s.id);
                                      setView("inbox");
                                    } else setJob(j);
                                  }}
                                >
                                  {s && !recruiter
                                    ? "View screening"
                                    : "View opportunity"}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      {!filtered.length && (
                        <Empty
                          icon={<BriefcaseBusiness />}
                          title="A little room for possibility"
                          text={
                            recruiter
                              ? "Post your first role and let your agent take care of the logistics."
                              : "Try another search or clear your filters to see more roles."
                          }
                        />
                      )}
                      <div className="bottom-note">
                        <ShieldCheck size={16} />
                        Your agent shares only what you approve. You’re always
                        in control.
                      </div>
                    </section>
                    <aside className="right-column">
                      <AgentCard
                        data={data}
                        onEdit={() =>
                          data.user ? setView("agent") : setAuth("register")
                        }
                      />
                      <div className="panel impact-card">
                        <div className="panel-heading">
                          <Zap size={18} />
                          <h3>A little time, back.</h3>
                        </div>
                        <div className="impact-number">
                          {answered}
                          <span>answers handled</span>
                        </div>
                        <p>
                          Repeated questions your agent has answered from
                          approved information.
                        </p>
                        <div className="impact-stats">
                          <div>
                            <strong>{screens.length}</strong>
                            <span>Screenings</span>
                          </div>
                          <div>
                            <strong>{pending}</strong>
                            <span>Need a human</span>
                          </div>
                        </div>
                      </div>
                      <div className="tip-card">
                        <span>THE YOURHR WAY</span>
                        <h3>
                          People make the
                          <br />
                          important decisions.
                        </h3>
                        <p>
                          Agents handle the logistics. You handle the chemistry,
                          the ambition, and the next big thing.
                        </p>
                        <button onClick={() => setView("about")}>
                          See how it works <CircleHelp size={14} />
                        </button>
                      </div>
                    </aside>
                  </div>
                </>
              )}
              {view === "inbox" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        CONVERSATIONS, WITHOUT THE REPETITION
                      </div>
                      <h1>Your screening inbox.</h1>
                      <p>
                        {recruiter
                          ? "The basics are covered. Here’s where your attention matters."
                          : "Your agent takes care of the basics. These conversations are yours."}
                      </p>
                    </div>
                  </div>
                  {selected ? (
                    <ScreenDetail
                      screening={selected}
                      data={data}
                      busy={busy}
                      onBack={() => setScreenId(null)}
                      onAnswer={async (body) =>
                        !!(await act(
                          "answer",
                          body,
                          "Answer shared with the recruiter",
                        ))
                      }
                    />
                  ) : (
                    <>
                      <div className="stats-row">
                        <div>
                          <span>Total screenings</span>
                          <strong>{screens.length}</strong>
                        </div>
                        <div>
                          <span>Logistics aligned</span>
                          <strong>
                            {
                              screens.filter((s) => s.status === "aligned")
                                .length
                            }
                          </strong>
                        </div>
                        <div>
                          <span>Questions for a human</span>
                          <strong>{pending}</strong>
                        </div>
                      </div>
                      <div className="tabs">
                        {[
                          ["all", "All screenings"],
                          ["pending", "Awaiting answers"],
                          ["review", "Needs a conversation"],
                          ["aligned", "Aligned"],
                        ].map(([v, l]) => (
                          <button
                            className={inboxFilter === v ? "active" : ""}
                            key={v}
                            onClick={() => setInboxFilter(v)}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <div className="screen-list">
                        {screens
                          .filter(
                            (s) =>
                              inboxFilter === "all" || s.status === inboxFilter,
                          )
                          .map((s) => (
                            <button
                              className="screen-row"
                              key={s.id}
                              onClick={() => setScreenId(s.id)}
                            >
                              <CompanyIcon company={s.company} />
                              <div className="screen-row-title">
                                <strong>{s.jobTitle}</strong>
                                <span>
                                  {s.company} ·{" "}
                                  {recruiter
                                    ? s.candidateName
                                    : `${s.candidateAgent} & ${s.recruiterAgent}`}
                                </span>
                              </div>
                              <div className="screen-progress">
                                <strong>
                                  {s.checks.filter((c) => c.answer).length}/
                                  {s.checks.length}
                                </strong>
                                <span>answers shared</span>
                              </div>
                              <Pill tone={s.status}>{statuses[s.status]}</Pill>
                            </button>
                          ))}
                      </div>
                      {!screens.filter(
                        (s) =>
                          inboxFilter === "all" || s.status === inboxFilter,
                      ).length && (
                        <Empty
                          icon={<MessageSquare />}
                          title="A fresh start for better conversations"
                          text="Start a screening from a job post. Your agents’ conversation and anything that needs your input will appear here."
                        />
                      )}
                    </>
                  )}
                </>
              )}
              {view === "agent" &&
                (data.user ? (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">
                          YOUR INFORMATION. YOUR RULES.
                        </div>
                        <h1>
                          {recruiter
                            ? "Meet your hiring teammate."
                            : "Teach your agent once."}
                        </h1>
                        <p>
                          {recruiter
                            ? "Set up an agent that covers the basics for every role."
                            : "A reusable profile for the questions you’ve answered a hundred times."}
                        </p>
                      </div>
                    </div>
                    {recruiter ? (
                      <RecruiterAgent
                        name={data.recruiterAgent}
                        busy={busy}
                        onSave={async (name) =>
                          !!(await act(
                            "agent",
                            { name },
                            "Hiring agent updated",
                          ))
                        }
                      />
                    ) : (
                      <ProfileEditor
                        profile={data.profile!}
                        busy={busy}
                        onSave={async (p) =>
                          !!(await act(
                            "profile",
                            p,
                            "Profile and sharing preferences saved",
                          ))
                        }
                      />
                    )}
                  </>
                ) : (
                  <Empty
                    icon={<Bot />}
                    title="Your agent is waiting"
                    text="Create an account or try a demo to set up your reusable profile."
                  />
                ))}
              {view === "candidates" && recruiter && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        OPEN TO A FIRST CONVERSATION
                      </div>
                      <h1>Meet the candidate agents.</h1>
                      <p>
                        These candidates opted in to recruiter-initiated
                        logistics screenings.
                      </p>
                    </div>
                  </div>
                  <div className="candidate-grid">
                    {data.candidates.map((c) => (
                      <CandidateCard
                        key={c.id}
                        candidate={c}
                        jobs={ownJobs}
                        busy={busy}
                        onScreen={(j) => startScreen(j, c.id)}
                      />
                    ))}
                  </div>
                  {!data.candidates.length && (
                    <Empty
                      icon={<Users />}
                      title="No discoverable candidates yet"
                      text="Candidates appear here after enabling recruiter discovery in their agent settings."
                    />
                  )}
                </>
              )}
              {view === "about" && <About />}
            </>
          )}
        </main>
      </div>
      {job && (
        <Modal title="The opportunity" onClose={() => setJob(null)} wide>
          <div className="job-detail">
            <div className="detail-title">
              <CompanyIcon company={job.company} />
              <div>
                <div className="eyebrow">{job.company}</div>
                <h2>{job.title}</h2>
                <p>
                  {job.location} · {job.workplace} · Full-time
                </p>
              </div>
            </div>
            <div className="detail-salary">
              {money(job.salaryMin)} – {money(job.salaryMax)}{" "}
              <span>USD base / year</span>
            </div>
            <h3>About the role</h3>
            {job.description.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <h3>The logistics, up front</h3>
            <div className="logistics-grid">
              {[
                [
                  Globe2,
                  "Sponsorship",
                  job.sponsorship ? "Available" : "Not available",
                ],
                [
                  MapPin,
                  "Relocation support",
                  job.relocation ? "Available" : "Not included",
                ],
                [Clock3, "Target start", `Within ${job.startWithin} weeks`],
                [
                  ShieldCheck,
                  "US work authorization",
                  job.authorization === "Required"
                    ? "Required"
                    : "Flexible / discuss",
                ],
              ].map(([Icon, label, val]) => {
                const I = Icon as typeof Globe2;
                return (
                  <div key={String(label)}>
                    <I size={19} />
                    <span>
                      {String(label)}
                      <strong>{String(val)}</strong>
                    </span>
                  </div>
                );
              })}
            </div>
            {job.questions.length > 0 && (
              <>
                <h3>A question for the person behind the profile</h3>
                {job.questions.map((q) => (
                  <p className="custom-question" key={q}>
                    {q}
                  </p>
                ))}
              </>
            )}
            <div className="screen-cta">
              <div className="bot-icon">
                <Bot size={24} />
              </div>
              <div>
                <strong>{job.agentName} is ready to meet your agent.</strong>
                <p>
                  Approved facts only. No commitments. You review the next
                  steps.
                </p>
              </div>
            </div>
            {recruiter ? (
              <button
                className="button primary full"
                onClick={() => {
                  setJob(null);
                  setView("candidates");
                }}
              >
                Find candidate agents
              </button>
            ) : (
              <button
                className="button primary full"
                disabled={busy || data.profile?.active === false}
                onClick={() => startScreen(job)}
              >
                {busy ? (
                  <>
                    <span className="spinner" />
                    Agents are screening…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    {data.profile?.active === false
                      ? "Resume your agent to screen"
                      : "Let my agent screen"}
                  </>
                )}
              </button>
            )}
            {data.mode === "demo" && (
              <p className="center small-text">
                Demo mode · Structured agent conversation · No AI key needed
              </p>
            )}
          </div>
        </Modal>
      )}
      {auth && (
        <Modal
          title={
            auth === "register"
              ? "A better first conversation starts here."
              : "Welcome back."
          }
          onClose={() => setAuth(null)}
        >
          <AuthForm
            mode={auth}
            busy={busy}
            error={error}
            onSwitch={() => setAuth(auth === "register" ? "login" : "register")}
            onSubmit={async (body) => {
              const r = await act(auth, body);
              if (r) {
                setAuth(null);
                setView(auth === "register" ? "agent" : "jobs");
              }
            }}
            onDemo={demo}
          />
        </Modal>
      )}
      {posting && (
        <Modal
          title="Post an opportunity"
          wide
          onClose={() => setPosting(false)}
        >
          <JobForm
            company={data.user?.company || ""}
            busy={busy}
            error={error}
            onSubmit={async (body) => {
              const r = await act(
                "job",
                body,
                "Your opportunity is live on the local board",
              );
              if (r) setPosting(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function AgentCard({ data, onEdit }: { data: AppState; onEdit: () => void }) {
  const p = data.profile;
  const recruiter = data.user?.role === "recruiter";
  const count = p
    ? fields.filter((f) => p.facts[f].share && p.facts[f].value).length
    : 0;
  return (
    <div className="panel agent-card">
      <div className="panel-heading">
        <h3>Your {recruiter ? "hiring " : ""}agent</h3>
        <button
          className="icon-button"
          aria-label="Edit agent settings"
          onClick={onEdit}
        >
          <Settings2 size={17} />
        </button>
      </div>
      <div className="agent-identity">
        <div className="agent-avatar">
          <Bot size={31} />
        </div>
        <h3>
          {recruiter
            ? data.recruiterAgent
            : p?.agentName || "Your next teammate"}
        </h3>
        <span className="agent-status">
          <span
            className={`status-dot ${p?.active === false ? "paused" : ""}`}
          />
          {!data.user
            ? "Ready when you are"
            : p?.active === false
              ? "Paused"
              : "Ready to help"}
        </span>
      </div>
      <div className="agent-divider" />
      {recruiter ? (
        <p className="agent-description">
          Your agent uses each job’s requirements to ask clear, consistent
          logistics questions.
        </p>
      ) : (
        <>
          <div className="profile-progress-label">
            <span>Approved answers</span>
            <strong>{count} / 7</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${(count / 7) * 100}%` }} />
          </div>
          <div className="agent-checks">
            {[
              "Location & work preferences",
              "Salary & availability",
              "Sponsorship & authorization",
            ].map((s, i) => (
              <div key={s}>
                <CheckCircle2
                  size={15}
                  className={count === 7 ? "green" : "muted"}
                />
                {s}
              </div>
            ))}
          </div>
        </>
      )}
      <button className="button secondary full" onClick={onEdit}>
        {data.user ? "Manage agent" : "Create your agent"}
      </button>
      <div className="privacy-note">
        <LockKeyhole size={12} />
        You decide what gets shared
      </div>
    </div>
  );
}
function ProfileEditor({
  profile,
  busy,
  onSave,
}: {
  profile: Profile;
  busy: boolean;
  onSave: (p: Profile) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Profile>(structuredClone(profile));
  const [dirty, setDirty] = useState(false);
  const update = (p: Profile) => {
    setDraft(p);
    setDirty(true);
  };
  const hints: Partial<Record<Field, string>> = {
    authorization:
      "US work authorization. No citizenship or document details are requested.",
    sponsorship: "Employer sponsorship now or in the future.",
    salary: "Minimum annual base salary in USD. Equity and bonus are separate.",
    availability: "Number of weeks from accepting an offer.",
    location: "Use a city and state. Remote roles in this V1 are US-based.",
  };
  return (
    <form
      className="profile-layout"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSave(draft)) setDirty(false);
      }}
    >
      <div>
        <section className="panel form-panel">
          <div className="form-section-title">
            <div className="bot-icon">
              <Bot size={22} />
            </div>
            <div>
              <h2>Your agent’s identity</h2>
              <p>A small introduction for your personal teammate.</p>
            </div>
          </div>
          <div className="form-grid">
            <Input label="Agent name">
              <input
                required
                maxLength={200}
                value={draft.agentName}
                onChange={(e) =>
                  update({ ...draft, agentName: e.target.value })
                }
              />
            </Input>
            <Input label="Professional headline">
              <input
                maxLength={300}
                placeholder="e.g. Product designer · B2B SaaS"
                value={draft.headline}
                onChange={(e) => update({ ...draft, headline: e.target.value })}
              />
            </Input>
          </div>
        </section>
        <section className="panel form-panel">
          <div className="section-title">
            <div>
              <h2>The basics, answered once.</h2>
              <p>
                Enable “Auto-share” for facts your agent may send to recruiters.
              </p>
            </div>
            <ShieldCheck size={23} />
          </div>
          <div className="facts-list">
            {fields.map((f) => (
              <div className="fact-row" key={f}>
                <Input label={labels[f]} hint={hints[f]}>
                  <FactInput
                    field={f}
                    value={draft.facts[f].value}
                    onChange={(v) =>
                      update({
                        ...draft,
                        facts: {
                          ...draft.facts,
                          [f]: { ...draft.facts[f], value: v },
                        },
                      })
                    }
                  />
                </Input>
                <label className="share-control">
                  <input
                    type="checkbox"
                    checked={draft.facts[f].share}
                    onChange={(e) =>
                      update({
                        ...draft,
                        facts: {
                          ...draft.facts,
                          [f]: { ...draft.facts[f], share: e.target.checked },
                        },
                      })
                    }
                  />
                  <span>Auto-share</span>
                </label>
              </div>
            ))}
          </div>
        </section>
        {Object.keys(draft.savedAnswers).length > 0 && (
          <section className="panel form-panel">
            <h2>Reusable custom answers</h2>
            <p>
              Shared automatically only when a recruiter asks the exact same
              question.
            </p>
            {Object.entries(draft.savedAnswers).map(([q, a]) => (
              <div className="saved-answer" key={q}>
                <strong>{q}</strong>
                <p>{a}</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    const next = { ...draft.savedAnswers };
                    delete next[q];
                    update({ ...draft, savedAnswers: next });
                  }}
                >
                  Stop reusing this answer
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
      <aside>
        <section className="panel form-panel sticky-panel">
          <h3>You’re in control.</h3>
          <p>
            Private facts stay private until you approve an answer for a
            specific screening.
          </p>
          <label className="setting-check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => update({ ...draft, active: e.target.checked })}
            />
            <span>
              <strong>Agent active</strong>
              <small>Allow new logistics screenings.</small>
            </span>
          </label>
          <label className="setting-check">
            <input
              type="checkbox"
              checked={draft.discoverable}
              onChange={(e) =>
                update({ ...draft, discoverable: e.target.checked })
              }
            />
            <span>
              <strong>Let recruiters find me</strong>
              <small>
                Show your name, headline, and agent in the directory. Recruiters
                can start screenings using your approved facts.
              </small>
            </span>
          </label>
          <div className="info-note">
            <ShieldCheck size={18} />
            <span>
              Your agent never accepts an offer, makes commitments, or answers a
              new custom question without you.
            </span>
          </div>
          <button className="button primary full" disabled={busy} type="submit">
            {busy ? "Saving…" : "Save profile & permissions"}
          </button>
          <p className="small-text center">
            {dirty
              ? "You have unsaved changes."
              : "Your saved preferences apply to new screenings."}
          </p>
          <p className="small-text">
            Previously shared answers remain in existing conversation histories.
            Turning off auto-share stops future sharing.
          </p>
        </section>
      </aside>
    </form>
  );
}
function RecruiterAgent({
  name,
  busy,
  onSave,
}: {
  name: string;
  busy: boolean;
  onSave: (name: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(name);
  return (
    <form
      className="panel form-panel narrow-panel"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <div className="form-section-title">
        <div className="agent-avatar">
          <Bot size={28} />
        </div>
        <div>
          <h2>Your screening partner</h2>
          <p>Consistent questions. Clear answers. Human decisions.</p>
        </div>
      </div>
      <Input label="Hiring agent name">
        <input
          required
          maxLength={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Input>
      <div className="info-note">
        <ShieldCheck size={20} />
        <span>
          Set requirements on each job post. Your agent checks seven logistics
          topics, asks your custom questions, and highlights items for human
          review. It never rejects a candidate.
        </span>
      </div>
      <h3>Your agent’s playbook</h3>
      <ul className="playbook">
        <li>Ask the candidate agent for approved logistics facts.</li>
        <li>Respect missing or private answers and wait for the candidate.</li>
        <li>Compare answers against the job’s explicit requirements.</li>
        <li>
          Keep a readable transcript and surface conflicts for discussion.
        </li>
      </ul>
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : "Save hiring agent"}
      </button>
    </form>
  );
}
function CandidateCard({
  candidate,
  jobs,
  busy,
  onScreen,
}: {
  candidate: AppState["candidates"][number];
  jobs: Job[];
  busy: boolean;
  onScreen: (j: Job) => void;
}) {
  const [jobId, setJobId] = useState(jobs[0]?.id || "");
  return (
    <div className="panel form-panel">
      <div className="candidate-top">
        <span className="avatar large">
          {candidate.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div>
          <h3>{candidate.name}</h3>
          <p>{candidate.headline || "Open to a conversation"}</p>
        </div>
      </div>
      <Pill tone="aligned">
        <Bot size={14} />
        {candidate.agentName} · Available for screening
      </Pill>
      <Input label="Screen for a role">
        <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
          {!jobs.length && <option value="">Post a job first</option>}
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title} · {j.company}
            </option>
          ))}
        </select>
      </Input>
      <button
        className="button primary full"
        disabled={busy || !jobId}
        onClick={() => {
          const j = jobs.find((j) => j.id === jobId);
          if (j) onScreen(j);
        }}
      >
        <Sparkles size={16} />
        {busy ? "Screening…" : "Connect our agents"}
      </button>
    </div>
  );
}
function ScreenDetail({
  screening: s,
  data,
  busy,
  onBack,
  onAnswer,
}: {
  screening: Screening;
  data: AppState;
  busy: boolean;
  onBack: () => void;
  onAnswer: (body: unknown) => Promise<boolean>;
}) {
  const candidate = data.user?.role === "candidate";
  return (
    <div>
      <button className="text-button back-button" onClick={onBack}>
        Back to all screenings
      </button>
      <section className="panel screening-detail">
        <div className="screening-header">
          <CompanyIcon company={s.company} />
          <div>
            <h2>{s.jobTitle}</h2>
            <p>
              {s.company} · {s.candidateName} ·{" "}
              {new Date(s.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Pill tone={s.status}>{statuses[s.status]}</Pill>
        </div>
        <div className="agents-connected">
          <span>
            <Bot size={18} />
            {s.candidateAgent}
          </span>
          <span className="connection-line" />
          <ShieldCheck size={19} />
          <span className="connection-line" />
          <span>
            <Bot size={18} />
            {s.recruiterAgent}
          </span>
        </div>
        <div className="summary-box">
          <h3>
            {s.status === "aligned"
              ? "The logistics line up."
              : s.status === "pending"
                ? "A few things need the human touch."
                : "There’s something worth talking about."}
          </h3>
          <p>
            {s.checks.filter((c) => c.status === "aligned").length} aligned ·{" "}
            {s.checks.filter((c) => c.status === "review").length} to discuss ·{" "}
            {s.checks.filter((c) => c.status === "pending").length} awaiting
            answers. This is a logistics summary, not a hiring decision.
          </p>
          {s.aiSummary && (
            <div className="ai-summary">
              <Pill>
                <Sparkles size={12} />
                AI-written recap
              </Pill>
              <p>{s.aiSummary}</p>
            </div>
          )}
          {s.summaryMode === "fallback" && (
            <p className="small-text">
              AI recap unavailable. All structured screening results are
              preserved.
            </p>
          )}
        </div>
        <div className="checks-list">
          {s.checks.map((c) => (
            <div className={`check-item ${c.status}`} key={c.field}>
              <div className="check-icon">
                {c.status === "aligned" ? (
                  <CheckCircle2 size={20} />
                ) : c.status === "pending" ? (
                  <Clock3 size={20} />
                ) : (
                  <MessageSquare size={20} />
                )}
              </div>
              <div className="check-content">
                <div className="check-title">
                  <strong>
                    {c.field.startsWith("custom:") ? c.question : c.label}
                  </strong>
                  <Pill tone={c.status}>
                    {c.status === "aligned"
                      ? "Aligned"
                      : c.status === "pending"
                        ? "Needs an answer"
                        : "Discuss"}
                  </Pill>
                </div>
                <p className="check-answer">
                  {c.answer || "Waiting for candidate approval"}
                </p>
                <p className="check-reason">{c.reason}</p>
                <small>{c.source}</small>
                {candidate && c.status === "pending" && (
                  <AnswerForm
                    field={c.field}
                    question={c.question}
                    initial={data.profile?.facts[c.field as Field]?.value || ""}
                    busy={busy}
                    onSubmit={(answer, remember) =>
                      onAnswer({
                        screeningId: s.id,
                        field: c.field,
                        answer,
                        remember,
                      })
                    }
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        <details className="transcript">
          <summary>
            <MessageSquare size={18} />
            Agent conversation <span>{s.messages.length} messages</span>
            <ChevronDown size={18} />
          </summary>
          <div className="messages">
            {s.messages.map((m, i) => (
              <div key={i} className={`message ${m.speaker}`}>
                {m.speaker !== "system" && (
                  <strong>
                    <Bot size={14} />
                    {m.speaker === "recruiter"
                      ? s.recruiterAgent
                      : s.candidateAgent}
                  </strong>
                )}
                <p>{m.text}</p>
              </div>
            ))}
          </div>
        </details>
        <div className="bottom-note">
          <ShieldCheck size={16} />
          Agents handle the logistics. People decide what comes next.
        </div>
      </section>
    </div>
  );
}
function AnswerForm({
  field,
  question,
  initial,
  busy,
  onSubmit,
}: {
  field: string;
  question: string;
  initial: string;
  busy: boolean;
  onSubmit: (a: string, r: boolean) => Promise<boolean>;
}) {
  const [value, setValue] = useState(initial),
    [remember, setRemember] = useState(false);
  return (
    <form
      className="answer-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value, remember);
      }}
    >
      <Input label={question}>
        {field.startsWith("custom:") ? (
          <textarea
            required
            maxLength={4000}
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your agent leaves this one to you…"
          />
        ) : (
          <FactInput field={field} value={value} onChange={setValue} />
        )}
      </Input>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        {field.startsWith("custom:")
          ? "Approve reuse for this exact question in future screenings"
          : "Save to my profile and allow future auto-sharing"}
      </label>
      <button className="button primary small" disabled={busy || !value.trim()}>
        <Send size={14} />
        {busy ? "Sharing…" : "Approve & share answer"}
      </button>
      <small>
        This answer will be visible to this recruiter and kept in the screening
        history.
      </small>
    </form>
  );
}
function AuthForm({
  mode,
  busy,
  error,
  onSwitch,
  onSubmit,
  onDemo,
}: {
  mode: "register" | "login";
  busy: boolean;
  error: string;
  onSwitch: () => void;
  onSubmit: (b: unknown) => void;
  onDemo: (r: "candidate" | "recruiter") => void;
}) {
  const [role, setRole] = useState("candidate");
  return (
    <form
      className="form-panel auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
          role,
          company: f.get("company") || "",
        });
      }}
    >
      <p>
        {mode === "register"
          ? "Set up your agent, answer the basics once, and spend your time on what matters."
          : "Your agent and conversations are right where you left them."}
      </p>
      {mode === "register" && (
        <>
          <div className="role-choice">
            <button
              type="button"
              className={role === "candidate" ? "active" : ""}
              onClick={() => setRole("candidate")}
            >
              <Users size={20} />
              I’m a candidate
            </button>
            <button
              type="button"
              className={role === "recruiter" ? "active" : ""}
              onClick={() => setRole("recruiter")}
            >
              <BriefcaseBusiness size={20} />
              I’m hiring
            </button>
          </div>
          <Input label="Full name">
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </Input>
          {role === "recruiter" && (
            <Input label="Company">
              <input name="company" required maxLength={100} />
            </Input>
          )}
        </>
      )}
      <Input label="Email">
        <input name="email" type="email" required autoComplete="email" />
      </Input>
      <Input
        label="Password"
        hint={
          mode === "register"
            ? "At least 10 characters. This account is stored on your local server."
            : undefined
        }
      >
        <input
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 10 : 1}
          maxLength={200}
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
        />
      </Input>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full" disabled={busy}>
        {busy
          ? "Opening your workspace…"
          : mode === "register"
            ? "Create account & agent"
            : "Log in"}
      </button>
      <p className="center">
        {mode === "register" ? "Already have an account?" : "New to yourHR?"}{" "}
        <button type="button" className="text-button" onClick={onSwitch}>
          {mode === "register" ? "Log in" : "Create an account"}
        </button>
      </p>
      <div className="auth-demo">
        <span>Just exploring?</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDemo("candidate")}
        >
          Try candidate demo
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDemo("recruiter")}
        >
          Try recruiter demo
        </button>
      </div>
    </form>
  );
}
function JobForm({
  company,
  busy,
  error,
  onSubmit,
}: {
  company: string;
  busy: boolean;
  error: string;
  onSubmit: (body: unknown) => void;
}) {
  return (
    <form
      className="form-panel"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          title: f.get("title"),
          company: f.get("company"),
          location: f.get("location"),
          workplace: f.get("workplace"),
          salaryMin: Number(f.get("salaryMin")),
          salaryMax: Number(f.get("salaryMax")),
          sponsorship: f.get("sponsorship") === "on",
          relocation: f.get("relocation") === "on",
          authorization: f.get("authorization"),
          startWithin: Number(f.get("startWithin")),
          description: f.get("description"),
          tags: [String(f.get("discipline")), "Full-time"],
          questions: String(f.get("questions") || "")
            .split("\n")
            .map((q) => q.trim())
            .filter(Boolean),
        });
      }}
    >
      <p>Put the practical details up front. Your agent takes it from there.</p>
      <div className="form-grid">
        <Input label="Job title">
          <input
            name="title"
            required
            minLength={3}
            maxLength={200}
            placeholder="e.g. Senior Product Designer"
          />
        </Input>
        <Input label="Company">
          <input
            name="company"
            required
            defaultValue={company}
            maxLength={200}
          />
        </Input>
        <Input label="City, state">
          <input
            name="location"
            required
            minLength={2}
            maxLength={200}
            placeholder="San Francisco, CA"
          />
        </Input>
        <Input label="Work arrangement">
          <select name="workplace">
            <option>Remote</option>
            <option>Hybrid</option>
            <option>On-site</option>
          </select>
        </Input>
        <Input label="Minimum salary · USD / year">
          <input
            name="salaryMin"
            type="number"
            required
            min={0}
            max={10000000}
            defaultValue={140000}
          />
        </Input>
        <Input label="Maximum salary · USD / year">
          <input
            name="salaryMax"
            type="number"
            required
            min={1}
            max={10000000}
            defaultValue={180000}
          />
        </Input>
        <Input label="Desired start · weeks">
          <input
            name="startWithin"
            type="number"
            required
            min={0}
            max={104}
            defaultValue={6}
          />
        </Input>
        <Input label="US work authorization">
          <select name="authorization">
            <option value="Required">Required</option>
            <option value="Flexible">Flexible / discuss</option>
          </select>
        </Input>
        <Input label="Discipline">
          <select name="discipline">
            <option>Design</option>
            <option>Engineering</option>
            <option>Product</option>
            <option>Operations</option>
            <option>Marketing</option>
            <option>Other</option>
          </select>
        </Input>
        <div className="job-checkboxes">
          <label className="checkbox-label">
            <input name="sponsorship" type="checkbox" />
            Visa sponsorship available
          </label>
          <label className="checkbox-label">
            <input name="relocation" type="checkbox" />
            Relocation support available
          </label>
        </div>
      </div>
      <Input label="About the role">
        <textarea
          name="description"
          required
          minLength={30}
          maxLength={10000}
          rows={5}
          placeholder="The work, the team, and what makes this opportunity special…"
        />
      </Input>
      <Input
        label="Custom questions (optional)"
        hint="One question per line, up to 5. New custom questions always go to the candidate for approval."
      >
        <textarea
          name="questions"
          rows={3}
          maxLength={2500}
          placeholder="What is a product decision you’re especially proud of?"
        />
      </Input>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="info-note">
        <Globe2 size={18} />
        <span>
          V1 uses US work authorization and USD annual base salary. This post
          will appear on your local job board.
        </span>
      </div>
      <button className="button primary full" disabled={busy}>
        <Plus size={17} />
        {busy ? "Publishing…" : "Publish opportunity"}
      </button>
    </form>
  );
}
function About() {
  return (
    <div className="about">
      <div className="eyebrow">LESS FORM-FILLING. MORE POSSIBILITY.</div>
      <h1>
        Your time belongs
        <br />
        to the important stuff.
      </h1>
      <p className="about-intro">
        Hiring should start with a real conversation, not the same seven
        questions. yourHR gives both sides an agent to get the basics out of the
        way.
      </p>
      <div className="about-grid">
        {[
          [
            Bot,
            "Set up your teammate",
            "Candidates save their logistics once and choose which facts can be shared. Recruiters configure an agent and clear requirements for each role.",
          ],
          [
            MessageSquare,
            "Let the agents talk",
            "A candidate or an opted-in recruiter starts the screening. The hiring agent asks; the candidate agent answers using approved facts.",
          ],
          [
            Users,
            "Bring in the humans",
            "Private facts, missing answers, and customized questions come back to the candidate. People discuss conflicts and decide whether to continue.",
          ],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof Bot;
          return (
            <div className="panel form-panel" key={String(title)}>
              <I size={30} />
              <h2>{String(title)}</h2>
              <p>{String(text)}</p>
            </div>
          );
        })}
      </div>
      <div className="panel form-panel">
        <h2>What “agent” means in this V1</h2>
        <p>
          The built-in agents use a structured, deterministic
          question-and-answer protocol. They don’t guess facts or make hiring
          decisions. Without an API key, the entire workflow runs in demo mode.
          With a server-side OpenAI key, an optional AI-written recap summarizes
          shared answers; the underlying checks stay deterministic.
        </p>
        <p>
          There are no external agent connections yet. Demo accounts and job
          listings are fictional and shared within this local installation. Real
          accounts are stored in SQLite on your machine.
        </p>
        <h3>A deliberately small first step</h3>
        <p>
          US-based jobs, USD base salary, seven logistics questions, and
          human-reviewed custom questions. Resume ranking, interviews,
          scheduling, messaging outside the app, and production identity
          verification are future work.
        </p>
      </div>
    </div>
  );
}
