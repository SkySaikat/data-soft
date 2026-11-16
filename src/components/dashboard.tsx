"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Database,
  Download,
  FileText,
  Globe,
  Info,
  LayoutGrid,
  Link2,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  BUDGETS,
  INDUSTRIES,
  SERVICES,
  STATES,
  type Budget,
  type CollectionRun,
  type Filters,
  type Lead,
  type LeadPage,
  type LeadStatus,
  type Service,
  type Source,
  type Workspace,
} from "@/lib/domain";
import { Dialog } from "./dialog";
import { CollectionPanel } from "./collection-panel";
import { MailWorkspace, ComposeEmail } from "./mail-workspace";
import { ContactPanel } from "./contact-panel";
import { PageSize } from "./page-size";

type View = "leads" | "collection" | "sources" | "ai" | "mail" | "settings";
type Settings = {
  ai: { ready: boolean; model: string; monthlyCap: number; spent: number };
  database: string;
  version: string;
  localOnly: boolean;
};
type Analysis = {
  mode: string;
  cost: number | null;
  data: {
    summary: string;
    opportunities: { service: string; reason: string }[];
    nextStep: string;
    budgetNote: string;
    draft: string;
  };
};
const NAV = [
  { id: "leads", label: "Lead explorer", icon: LayoutGrid },
  { id: "collection", label: "Collect leads", icon: Compass },
  { id: "sources", label: "Source library", icon: Database },
  { id: "ai", label: "AI studio", icon: Sparkles },
  { id: "mail", label: "Email & calling", icon: Mail },
] as const;
const EMPTY_FILTERS: Filters = {
  q: "",
  state: "",
  city: "",
  industry: "",
  service: "",
  budget: "",
  status: "",
  sort: "priority",
  page: "1",
  pageSize: "100",
};
const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New lead",
  reviewing: "Reviewing",
  qualified: "Qualified",
  not_a_fit: "Not a fit",
};
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(`/api/${path}`, options);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
function initials(name: string) {
  return name
    .split(/[ &]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
function budgetColor(budget: Budget) {
  return budget === "unknown"
    ? "gray"
    : budget === "25k_plus"
      ? "purple"
      : budget === "10k_25k"
        ? "blue"
        : "green";
}
function shortHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "No website recorded";
  }
}

export function Dashboard() {
  const [view, setView] = useState<View>("leads"),
    [workspace, setWorkspace] = useState<Workspace>("demo"),
    [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [data, setData] = useState<LeadPage | null>(null),
    [sources, setSources] = useState<Source[]>([]),
    [runs, setRuns] = useState<CollectionRun[]>([]),
    [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set()),
    [detail, setDetail] = useState<Lead | null>(null),
    [addOpen, setAddOpen] = useState(false),
    [importOpen, setImportOpen] = useState(false);
  const [composeLead, setComposeLead] = useState<Lead | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const notify = useCallback((message: string) => setNotice(message), []);
  const reload = useCallback(() => setRefresh((v) => v + 1), []);
  useEffect(() => {
    const url = new URL(location.href);
    const saved =
      url.searchParams.get("workspace") ||
      localStorage.getItem("data-soft-workspace");
    if (saved === "live") setWorkspace("live");
    const storedSize = localStorage.getItem("data-soft-page-size");
    if (
      storedSize &&
      (storedSize === "all" ||
        /^[1-9][0-9]{0,3}$/.test(storedSize) ||
        storedSize === "10000")
    )
      setFilters((f) => ({ ...f, pageSize: storedSize }));
    const v = url.searchParams.get("view");
    if (NAV.some((n) => n.id === v) || v === "settings") setView(v as View);
  }, []);
  useEffect(() => {
    localStorage.setItem("data-soft-workspace", workspace);
    const url = new URL(location.href);
    url.searchParams.set("workspace", workspace);
    url.searchParams.set("view", view);
    history.replaceState(null, "", url);
  }, [workspace, view]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError("");
        const query = new URLSearchParams({
          workspace,
          ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
        });
        api<LeadPage>(`leads?${query}`, { signal: controller.signal })
          .then(setData)
          .catch((e) => {
            if (e.name !== "AbortError") setError(e.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      filters.q ? 180 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [workspace, filters, refresh]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ sources: Source[] }>("sources"),
      api<{ runs: CollectionRun[] }>("runs"),
      api<Settings>("settings"),
    ])
      .then(([s, r, c]) => {
        if (active) {
          setSources(s.sources);
          setRuns(r.runs);
          setSettings(c);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (filters.pageSize)
      localStorage.setItem("data-soft-page-size", filters.pageSize);
  }, [filters.pageSize]);
  async function researchSelected() {
    setBulkBusy(true);
    try {
      if (selected.size > 1000)
        throw new Error("Choose up to 1,000 leads per website-research job.");
      if (workspace !== "live")
        throw new Error(
          "Choose the live workspace for business website research.",
        );
      await api("enrich", post({ leadIds: [...selected] }));
      setSelected(new Set());
      setView("collection");
      notify("Website research queued. Progress is shown below.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }
  async function exportData() {
    try {
      const response = await fetch(
        "/api/export",
        post({
          workspace,
          filters,
          ...(selected.size ? { ids: [...selected] } : {}),
        }),
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Export failed");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `data-soft-${workspace}-leads.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function updateFilter(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value, page: "1" }));
    setSelected(new Set());
  }
  function changeWorkspace(next: Workspace) {
    setWorkspace(next);
    setSelected(new Set());
    setFilters((current) => ({ ...EMPTY_FILTERS, pageSize: current.pageSize }));
    setDetail(null);
  }
  function imported(message: string) {
    changeWorkspace("live");
    setView("leads");
    reload();
    notify(message);
  }
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) =>
      value && !["q", "sort", "page", "pageSize", "ids"].includes(key),
  );
  const query = new URLSearchParams({
    workspace,
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  });
  if (selected.size) query.set("ids", [...selected].join(","));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand" aria-label="DataSoft home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            data<span className="brand-light">soft</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">W</span>
          <div>
            <span className="small-label">AGENCY WORKSPACE</span>
            <strong>My agency</strong>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? "active" : ""}`}
              aria-label={n.label}
              title={n.label}
              onClick={() => setView(n.id)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.id === "leads" ? (
                <span className="nav-count">{data?.summary.total ?? "—"}</span>
              ) : n.id === "ai" ? (
                <span className="new-tag">NEW</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="live-dot" />
            <strong>Built for your next client</strong>
            <p>
              Collect broadly.
              <br />
              Connect thoughtfully.
            </p>
            <button onClick={() => setView("collection")}>
              Find new opportunities <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => setView("settings")}
          >
            <Settings2 size={18} />
            Settings<span className="version">v0.2</span>
          </button>
          <div className="profile">
            <span className="profile-avatar">SA</span>
            <div>
              <strong>Agency owner</strong>
              <span>Local workspace</span>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>
              {view === "settings"
                ? "Settings"
                : NAV.find((n) => n.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="local-status">
              <span className="online-dot" /> Local database
            </span>
            <select
              className={`mode-select ${workspace}`}
              aria-label="Workspace data"
              value={workspace}
              onChange={(e) => changeWorkspace(e.target.value as Workspace)}
            >
              <option value="demo">Sample workspace</option>
              <option value="live">Live workspace</option>
            </select>
            <span className="top-avatar">SA</span>
          </div>
        </header>
        <main>
          {error ? (
            <div role="alert" className="alert error">
              <Info size={17} />
              <span>{error}</span>
              <button className="text-button" onClick={reload}>
                Retry
              </button>
            </div>
          ) : null}
          {view === "leads" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span /> YOUR NEXT CLIENT STARTS HERE
                  </div>
                  <h1>
                    Lead explorer<span className="title-dot">.</span>
                  </h1>
                  <p>A clearer picture of every local opportunity.</p>
                </div>
                <div className="heading-actions">
                  <button
                    className="button secondary"
                    onClick={() => void exportData()}
                  >
                    <Download size={16} />
                    Export{selected.size ? ` (${selected.size})` : ""}
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus size={17} />
                    Add leads
                  </button>
                </div>
              </div>
              {workspace === "demo" ? (
                <div className="demo-banner">
                  <div>
                    <Info size={16} />
                    <span>
                      <strong>You’re exploring sample data.</strong> These
                      businesses are fictional. Your real leads live in a
                      separate workspace.
                    </span>
                  </div>
                  <button onClick={() => changeWorkspace("live")}>
                    Go to live workspace <ArrowRight size={14} />
                  </button>
                </div>
              ) : null}
              <section className="stats-grid" aria-label="Workspace statistics">
                <Stat
                  icon={Users}
                  title="Total businesses"
                  value={data?.summary.total}
                  note="Every size. Every opportunity."
                />
                <Stat
                  icon={Target}
                  title="High priority"
                  value={data?.summary.highPriority}
                  note="Research priority score ≥ 70"
                />
                <Stat
                  icon={Building2}
                  title="Industries covered"
                  value={data?.summary.industries}
                  note="Across your lead database"
                />
                <Stat
                  icon={Mail}
                  title="Contact details found"
                  value={data?.summary.contactable}
                  note="Verification still required"
                />
              </section>
              <section className="budget-section">
                <div className="section-heading">
                  <h2>Find the right-sized opportunity</h2>
                  <span>
                    Estimated monthly service budget <Info size={13} />
                  </span>
                </div>
                <div className="budget-grid">
                  {(Object.entries(BUDGETS) as [Budget, string][]).map(
                    ([key, label]) => (
                      <button
                        key={key}
                        className={`budget-card ${filters.budget === key ? "selected" : ""}`}
                        onClick={() =>
                          updateFilter(
                            "budget",
                            filters.budget === key ? "" : key,
                          )
                        }
                        aria-pressed={filters.budget === key}
                      >
                        <span className={`budget-dot ${budgetColor(key)}`} />
                        <span>{label}</span>
                        <strong>{data?.summary.budgets[key] ?? "—"}</strong>
                        <ChevronRight size={14} />
                      </button>
                    ),
                  )}
                </div>
                <p className="budget-disclaimer">
                  Budget groups are research hypotheses, not willingness to pay.
                  Unknown-budget businesses stay in scope.
                </p>
              </section>
              <section className="leads-section">
                <div className="lead-toolbar">
                  <div className="lead-tabs">
                    <button
                      className={!filters.status ? "selected" : ""}
                      onClick={() => updateFilter("status", "")}
                    >
                      All leads <span>{data?.summary.total ?? 0}</span>
                    </button>
                    <button
                      className={
                        filters.status === "qualified" ? "selected" : ""
                      }
                      onClick={() => updateFilter("status", "qualified")}
                    >
                      Qualified
                    </button>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload size={14} />
                    Import CSV
                  </button>
                </div>
                <div className="list-display-options">
                  <PageSize
                    value={filters.pageSize || "100"}
                    onChange={(value) => updateFilter("pageSize", value)}
                  />
                </div>
                <div className="filter-bar">
                  <label className="search-box">
                    <Search size={17} />
                    <input
                      aria-label="Search businesses"
                      placeholder="Search businesses, cities, or industries…"
                      value={filters.q}
                      onChange={(e) => updateFilter("q", e.target.value)}
                    />
                    {filters.q ? (
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => updateFilter("q", "")}
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </label>
                  <SelectFilter
                    label="Location"
                    icon={MapPin}
                    value={filters.state || ""}
                    onChange={(v) => updateFilter("state", v)}
                    options={STATES.map((s) => [s.code, s.name])}
                  />
                  <SelectFilter
                    label="Industry"
                    icon={Building2}
                    value={filters.industry || ""}
                    onChange={(v) => updateFilter("industry", v)}
                    options={[
                      ...new Set([...INDUSTRIES, ...(data?.industries || [])]),
                    ]
                      .sort()
                      .map((i) => [i, i])}
                  />
                  <SelectFilter
                    label="Service needs"
                    icon={SlidersHorizontal}
                    value={filters.service || ""}
                    onChange={(v) => updateFilter("service", v)}
                    options={Object.entries(SERVICES)}
                  />
                  <select
                    className="sort-select"
                    aria-label="Sort leads"
                    value={filters.sort}
                    onChange={(e) => updateFilter("sort", e.target.value)}
                  >
                    <option value="priority">Priority first</option>
                    <option value="name">Name A–Z</option>
                    <option value="recent">Newest first</option>
                  </select>
                </div>
                {selected.size ? (
                  <div className="bulk-actions">
                    <strong>{selected.size} selected</strong>
                    <button
                      className="button secondary"
                      disabled={bulkBusy || workspace !== "live"}
                      onClick={() => void researchSelected()}
                    >
                      <Search size={14} />
                      Find websites & public contacts
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setSelected(new Set())}
                    >
                      Clear selection
                    </button>
                  </div>
                ) : null}
                <div className="subfilters">
                  <label>
                    <MapPin size={13} />
                    <input
                      aria-label="Filter by city"
                      placeholder="Narrow by city"
                      value={filters.city}
                      onChange={(e) => updateFilter("city", e.target.value)}
                    />
                  </label>
                  {activeFilters.length ? (
                    <button
                      className="text-button"
                      onClick={() => {
                        setFilters((current) => ({
                          ...EMPTY_FILTERS,
                          pageSize: current.pageSize,
                        }));
                        setSelected(new Set());
                      }}
                    >
                      Clear filters <X size={12} />
                    </button>
                  ) : (
                    <span>
                      <ShieldCheck size={13} /> Source history included with
                      every lead
                    </span>
                  )}
                </div>
                {loading && !data ? (
                  <div className="empty-state">
                    <LoaderCircle className="spin" />
                    <h3>Opening your workspace</h3>
                  </div>
                ) : data?.leads.length ? (
                  <>
                    <div
                      className={`table-scroll ${loading ? "refreshing" : ""}`}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th className="check-cell">
                              <input
                                type="checkbox"
                                aria-label="Select all visible leads"
                                checked={data.leads.every((l) =>
                                  selected.has(l.id),
                                )}
                                onChange={(e) =>
                                  setSelected(
                                    e.target.checked
                                      ? new Set(data.leads.map((l) => l.id))
                                      : new Set(),
                                  )
                                }
                              />
                            </th>
                            <th>
                              Business <ArrowDownUp size={11} />
                            </th>
                            <th>Location</th>
                            <th>Public contacts</th>
                            <th>Service needs</th>
                            <th>Est. budget / mo.</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {data.leads.map((lead, index) => (
                            <tr key={lead.id}>
                              <td className="check-cell">
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${lead.name}`}
                                  checked={selected.has(lead.id)}
                                  onChange={(e) =>
                                    setSelected((s) => {
                                      const next = new Set(s);
                                      if (e.target.checked) next.add(lead.id);
                                      else next.delete(lead.id);
                                      return next;
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <button
                                  className="business-cell"
                                  onClick={() => setDetail(lead)}
                                >
                                  <span
                                    className={`business-avatar tone-${index % 5}`}
                                  >
                                    {initials(lead.name)}
                                  </span>
                                  <span>
                                    <strong>{lead.name}</strong>
                                    <small>{lead.industry}</small>
                                  </span>
                                </button>
                              </td>
                              <td>
                                <div className="location-cell">
                                  {lead.city}
                                  <small>
                                    {STATES.find((s) => s.code === lead.state)
                                      ?.name || lead.state}
                                  </small>
                                </div>
                              </td>
                              <td>
                                <div className="table-contact">
                                  {lead.email ? (
                                    <button
                                      title={lead.email}
                                      onClick={() => setComposeLead(lead)}
                                    >
                                      {lead.email}
                                    </button>
                                  ) : (
                                    <span>No email found</span>
                                  )}
                                  {lead.phone ? (
                                    <small title={lead.phone}>
                                      {lead.phone}
                                    </small>
                                  ) : (
                                    <small>No phone recorded</small>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="service-tags">
                                  {lead.services.slice(0, 2).map((s) => (
                                    <span key={s}>{SERVICES[s]}</span>
                                  ))}
                                  {lead.services.length > 2 ? (
                                    <span className="extra-tag">
                                      +{lead.services.length - 2}
                                    </span>
                                  ) : null}
                                  {!lead.services.length ? (
                                    <span className="muted-tag">
                                      Needs research
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`budget-label ${budgetColor(lead.budget)}`}
                                >
                                  {BUDGETS[lead.budget]}
                                </span>
                                <small className="cell-subtitle">
                                  {lead.budget === "unknown"
                                    ? "No estimate yet"
                                    : "Unverified estimate"}
                                </small>
                              </td>
                              <td>
                                <span
                                  className={`score ${lead.score >= 70 ? "high" : "medium"}`}
                                >
                                  <span />
                                  {lead.score}
                                </span>
                              </td>
                              <td>
                                <span className={`status-label ${lead.status}`}>
                                  <span />
                                  {STATUS_LABELS[lead.status]}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={`Open ${lead.name}`}
                                  onClick={() => setDetail(lead)}
                                >
                                  <ArrowUpRight size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-footer">
                      <span>
                        Showing {(data.page - 1) * data.pageSize + 1}–
                        {Math.min(data.page * data.pageSize, data.total)} of{" "}
                        <strong>{data.total}</strong> businesses
                        {loading ? " · Updating…" : ""}
                      </span>
                      <div>
                        <button
                          className="icon-button"
                          aria-label="Previous page"
                          disabled={data.page <= 1 || loading}
                          onClick={() =>
                            setFilters((f) => ({
                              ...f,
                              page: String(data.page - 1),
                            }))
                          }
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="page-number">{data.page}</span>
                        <button
                          className="icon-button"
                          aria-label="Next page"
                          disabled={
                            data.page * data.pageSize >= data.total || loading
                          }
                          onClick={() =>
                            setFilters((f) => ({
                              ...f,
                              page: String(data.page + 1),
                            }))
                          }
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <Search size={25} />
                    </div>
                    <h3>
                      {data?.summary.total
                        ? "No businesses match these filters"
                        : "Your next opportunity starts here"}
                    </h3>
                    <p>
                      {data?.summary.total
                        ? "Try a different city, industry, service, or budget group."
                        : "Import your business listings or start a directory collection. Every business size is welcome."}
                    </p>
                    <button
                      className="button primary"
                      onClick={() =>
                        data?.summary.total
                          ? setFilters((current) => ({
                              ...EMPTY_FILTERS,
                              pageSize: current.pageSize,
                            }))
                          : setView("collection")
                      }
                    >
                      {data?.summary.total
                        ? "Reset filters"
                        : "Collect your first leads"}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </section>
              <div className="bottom-note">
                <span>
                  <span className="online-dot" /> Saved to your local database
                </span>
                <span>
                  Real businesses. Relevant conversations. Better possibilities.
                </span>
              </div>
            </>
          ) : null}
          {view === "collection" ? (
            <CollectionPanel
              sources={sources}
              runs={runs}
              onQueued={() => changeWorkspace("live")}
              onChanged={reload}
              onImport={() => setImportOpen(true)}
            />
          ) : null}
          {view === "sources" ? (
            <>
              <Heading
                eyebrow="DISCOVER BEYOND ONE PLATFORM"
                title="Source library"
                description="A broader view of local business, with a clear record of where every lead came from."
              />
              <div className="source-grid">
                {sources.map((source) => (
                  <article className="source-card" key={source.id}>
                    <div className="source-card-top">
                      <span className="source-icon">
                        <Database size={22} />
                      </span>
                      <span
                        className={`source-status ${source.status === "available" ? "green" : "gray"}`}
                      >
                        {source.status === "available"
                          ? "Ready to use"
                          : source.status === "candidate"
                            ? "Research candidate"
                            : "Permission required"}
                      </span>
                    </div>
                    <span className="eyebrow">{source.family}</span>
                    <h3>{source.name}</h3>
                    <p>{source.description}</p>
                    <footer>
                      <span>{source.imported} live leads added</span>
                      {source.status === "available" ||
                      source.id === "directory" ? (
                        <button
                          className="text-button"
                          onClick={() =>
                            source.id === "csv"
                              ? setImportOpen(true)
                              : setView("collection")
                          }
                        >
                          Open <ArrowRight size={14} />
                        </button>
                      ) : source.url ? (
                        <a
                          className="text-button"
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View source <ArrowUpRight size={14} />
                        </a>
                      ) : null}
                    </footer>
                  </article>
                ))}
              </div>
              <div className="info-box">
                <ShieldCheck size={20} />
                <div>
                  <strong>
                    Public visibility and reuse rights are different.
                  </strong>
                  <p>
                    Candidate sources stay disabled until their access and reuse
                    terms support your collection. This release does not scrape
                    Google Maps. Reviewed email sending is separate from
                    collection.
                  </p>
                </div>
              </div>
            </>
          ) : null}
          {view === "ai" ? (
            <>
              <Heading
                eyebrow="A LITTLE INTELLIGENCE, USED THOUGHTFULLY"
                title="AI studio"
                description="Turn selected research into useful next steps. Keep the everyday work credit-free."
              />
              <div className="ai-hero">
                <div className="ai-hero-icon">
                  <Sparkles size={32} />
                </div>
                <div>
                  <span className="eyebrow">
                    RESEARCH FIRST. GENERATION SECOND.
                  </span>
                  <h2>
                    Better context.
                    <br />
                    More relevant conversations.
                  </h2>
                  <p>
                    Open a lead to build a service summary, review opportunity
                    hypotheses, and prepare a first-message draft. Nothing is
                    sent automatically.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setView("leads")}
                  >
                    Choose a lead <ArrowRight size={16} />
                  </button>
                </div>
                <div className="ai-workflow">
                  <span>
                    <CheckCircle2 size={17} /> Business facts & source history
                  </span>
                  <i />
                  <span>
                    <Sparkles size={17} /> Local or cloud analysis
                  </span>
                  <i />
                  <span>
                    <FileText size={17} /> A draft for your review
                  </span>
                </div>
              </div>
              <div className="two-column">
                <article className="panel">
                  <span className="green-icon">
                    <ShieldCheck size={22} />
                  </span>
                  <h3>Local analysis</h3>
                  <p>
                    Rule-based service summaries and template drafts. Available
                    now, without credentials or AI charges. Labeled as local
                    analysis.
                  </p>
                  <span className="source-status green">
                    Ready · no credits
                  </span>
                </article>
                <article className="panel">
                  <span className="purple-icon">
                    <Sparkles size={22} />
                  </span>
                  <h3>Cloud AI integration</h3>
                  <p>
                    AI SDK integration with server-only credentials, structured
                    responses, a monthly spending ledger, and no automatic
                    retries.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setView("settings")}
                  >
                    {settings?.ai.ready
                      ? "View AI settings"
                      : "Set up cloud AI"}
                    <ArrowRight size={14} />
                  </button>
                </article>
              </div>
            </>
          ) : null}
          {view === "mail" ? <MailWorkspace /> : null}
          {view === "settings" ? <SettingsView settings={settings} /> : null}
        </main>
      </div>
      {notice ? (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
      {addOpen ? (
        <AddLead
          onClose={() => setAddOpen(false)}
          onImport={() => {
            setAddOpen(false);
            setImportOpen(true);
          }}
          onDone={(m) => {
            setAddOpen(false);
            imported(m);
          }}
        />
      ) : null}
      {importOpen ? (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onDone={(m) => {
            setImportOpen(false);
            imported(m);
          }}
        />
      ) : null}
      {composeLead ? (
        <ComposeEmail lead={composeLead} onClose={() => setComposeLead(null)} />
      ) : null}
      {detail ? (
        <LeadDetail
          lead={detail}
          aiReady={settings?.ai.ready || false}
          onClose={() => setDetail(null)}
          onUpdated={(lead) => {
            setDetail(lead);
            reload();
          }}
          notify={notify}
        />
      ) : null}
    </div>
  );
}

function Heading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <span />
          {eyebrow}
        </div>
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function Stat({
  icon: Icon,
  title,
  value,
  note,
}: {
  icon: typeof Users;
  title: string;
  value: number | undefined;
  note: string;
}) {
  return (
    <article className="stat-card">
      <div>
        <span>{title}</span>
        <span className="stat-icon">
          <Icon size={17} />
        </span>
      </div>
      <strong>{value?.toLocaleString() ?? "—"}</strong>
      <p>{note}</p>
    </article>
  );
}
function SelectFilter({
  label,
  icon: Icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon: typeof MapPin;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className={`filter-select ${value ? "has-value" : ""}`}>
      <Icon size={15} />
      <select
        aria-label={`Filter by ${label.toLowerCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown size={12} />
    </label>
  );
}

function AddLead({
  onClose,
  onDone,
  onImport,
}: {
  onClose: () => void;
  onDone: (m: string) => void;
  onImport: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [services, setServices] = useState<Service[]>([]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ imported: number; updated: number }>(
        "leads",
        post({
          ...form,
          services,
          budget: "unknown",
          sourceName: "Manual business research",
        }),
      );
      onDone(
        result.imported
          ? "Business added to your live workspace."
          : "Existing business updated; no duplicate created.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Add a business" onClose={onClose} wide>
      <div className="dialog-body">
        <p className="muted">
          Add what you know. Missing websites, emails, and budgets are welcome.
        </p>
        <button className="upload-shortcut" onClick={onImport}>
          <Upload size={19} />
          <span>
            <strong>Have a business list?</strong>
            <small>Import a CSV with up to 1,000 rows.</small>
          </span>
          <ArrowRight size={17} />
        </button>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="field full">
              Business name
              <input
                name="name"
                required
                minLength={2}
                maxLength={200}
                placeholder="e.g. Cedar Creek Plumbing"
              />
            </label>
            <label className="field">
              Industry
              <select name="industry">
                {INDUSTRIES.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
            <label className="field">
              State
              <select name="state" required defaultValue="">
                <option value="" disabled>
                  Choose state
                </option>
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              City
              <input name="city" required placeholder="City" />
            </label>
            <label className="field">
              Business address
              <input name="address" placeholder="Optional street address" />
            </label>
            <label className="field full">
              Business website
              <input name="website" type="url" placeholder="https://" />
            </label>
            <label className="field">
              Business email
              <input
                name="email"
                type="email"
                placeholder="Public business email, if known"
              />
            </label>
            <label className="field">
              Business phone
              <input name="phone" placeholder="Optional business number" />
            </label>
            <label className="field full">
              Source URL
              <input
                name="sourceUrl"
                type="url"
                placeholder="Where you found this business"
              />
            </label>
            <div className="field full">
              <span>Service needs to research</span>
              <div className="checkbox-grid">
                {Object.entries(SERVICES).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={services.includes(key as Service)}
                      onChange={(e) =>
                        setServices((s) =>
                          e.target.checked
                            ? [...s, key as Service]
                            : s.filter((v) => v !== key),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <label className="field full">
              Research notes
              <textarea
                name="notes"
                maxLength={4000}
                rows={3}
                placeholder="Record observations and uncertainties, not assumptions."
              />
            </label>
          </div>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              Add to live workspace
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

function ImportDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [csv, setCsv] = useState(""),
    [filename, setFilename] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ imported: number; updated: number }>(
        "import",
        post({
          ...form,
          csv,
          permissionConfirmed: form.permissionConfirmed === "on",
        }),
      );
      onDone(
        `${result.imported} businesses added, ${result.updated} existing records updated.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Import business listings" onClose={onClose}>
      <div className="dialog-body">
        <p className="muted">
          Bring your authorized directory export or research list into the live
          database.
        </p>
        <a className="text-button template-link" href="/api/template">
          <Download size={15} />
          Download CSV template
        </a>
        <form onSubmit={submit}>
          <button
            type="button"
            className="file-drop"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={28} />
            <strong>{filename || "Choose a CSV file"}</strong>
            <span>Up to 1,000 rows · 1.5 MB</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="CSV file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 1_500_000) {
                setError("Choose a file smaller than 1.5 MB.");
                return;
              }
              setCsv(await file.text());
              setFilename(file.name);
              setError("");
            }}
          />
          <label className="field">
            Source name
            <input
              name="sourceName"
              required
              minLength={2}
              placeholder="e.g. Approved chamber member export"
            />
          </label>
          <label className="field">
            Source URL
            <input
              name="sourceUrl"
              type="url"
              placeholder="Optional directory or export source URL"
            />
          </label>
          <label className="consent">
            <input type="checkbox" name="permissionConfirmed" required />
            <span>
              I am authorized to import and use these business records.
              Importing does not verify contacts or authorize outreach.
            </span>
          </label>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy || !csv}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Upload size={16} />
              )}
              Import businesses
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

function LeadDetail({
  lead,
  aiReady,
  onClose,
  onUpdated,
  notify,
}: {
  lead: Lead;
  aiReady: boolean;
  onClose: () => void;
  onUpdated: (l: Lead) => void;
  notify: (m: string) => void;
}) {
  const [tab, setTab] = useState<"overview" | "analysis">("overview"),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function update(patch: unknown) {
    try {
      const updated = await api<Lead>(`leads/${lead.id}`, {
        ...post({ ...(patch as object), workspace: lead.workspace }),
        method: "PATCH",
      });
      onUpdated(updated);
      notify("Lead updated and saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function run(mode: "local" | "cloud") {
    setBusy(true);
    setError("");
    try {
      setAnalysis(
        await api<Analysis>(
          "analyze",
          post({ leadId: lead.id, workspace: lead.workspace, mode }),
        ),
      );
      setTab("analysis");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Business detail" onClose={onClose} drawer>
      <div className="detail-intro">
        <span className="business-avatar large tone-0">
          {initials(lead.name)}
        </span>
        <span className="eyebrow">
          {lead.workspace === "demo"
            ? "FICTIONAL SAMPLE BUSINESS"
            : lead.industry}
        </span>
        <h2>{lead.name}</h2>
        <p>
          <MapPin size={14} />
          {lead.city}, {lead.state}
        </p>
        <div className="detail-tags">
          <span className={`budget-label ${budgetColor(lead.budget)}`}>
            {BUDGETS[lead.budget]}
          </span>
          <span className="gray-pill">Priority {lead.score}/100</span>
        </div>
      </div>
      <div className="detail-tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          Overview & evidence
        </button>
        <button
          className={tab === "analysis" ? "active" : ""}
          onClick={() => setTab("analysis")}
        >
          <Sparkles size={14} />
          Analysis & draft
        </button>
      </div>
      <div className="dialog-body detail-body">
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {tab === "overview" ? (
          <>
            <section className="detail-section">
              <h3>Business information</h3>
              <DetailRow
                icon={Building2}
                title="Industry"
                value={lead.industry}
              />
              <DetailRow
                icon={Globe}
                title="Website"
                value={lead.website ? shortHost(lead.website) : "Not recorded"}
                href={lead.workspace === "live" ? lead.website : undefined}
              />
              <DetailRow
                icon={Mail}
                title="Email"
                value={lead.email || "Not recorded"}
              />
              <DetailRow
                icon={Phone}
                title="Phone"
                value={lead.phone || "Not recorded"}
              />
              {lead.address ? (
                <DetailRow icon={MapPin} title="Address" value={lead.address} />
              ) : null}
              <div className="mini-note">
                <ShieldCheck size={14} />
                Public contact details are unverified. Email requires a
                configured sender and explicit message review.
              </div>
            </section>
            <ContactPanel lead={lead} onUpdated={onUpdated} notify={notify} />
            <section className="detail-section">
              <h3>Service needs to research</h3>
              <div className="service-tags">
                {lead.services.length ? (
                  lead.services.map((s) => <span key={s}>{SERVICES[s]}</span>)
                ) : (
                  <span>Not established yet</span>
                )}
              </div>
              <p className="research-notes">
                {lead.notes || "No research notes yet."}
              </p>
            </section>
            <section className="detail-section">
              <h3>Budget & qualification</h3>
              <div className="budget-detail">
                <span>Estimated monthly service fees</span>
                <strong>{BUDGETS[lead.budget]}</strong>
                <small>{lead.budgetConfidence}. Not willingness to pay.</small>
              </div>
              {lead.budgetEvidence.length ? (
                <ul className="evidence-list">
                  {lead.budgetEvidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}
              <form
                className="confirmed-budget"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = new FormData(e.currentTarget).get("confirmed");
                  void update({
                    confirmedBudget: value === "" ? null : Number(value),
                    confirmedBudgetNote: String(
                      new FormData(e.currentTarget).get("confirmationNote") ||
                        "",
                    ),
                  });
                }}
              >
                <label className="field">
                  Prospect-confirmed monthly service budget
                  <input
                    key={`${lead.id}-${lead.confirmedBudget}`}
                    name="confirmed"
                    type="number"
                    min="0"
                    max="10000000"
                    step="1"
                    defaultValue={lead.confirmedBudget ?? ""}
                    placeholder="Only enter what the prospect confirmed"
                  />
                </label>
                <label className="field">
                  Confirmation evidence
                  <input
                    name="confirmationNote"
                    maxLength={1000}
                    placeholder="Who confirmed it, when, services covered, media excluded"
                  />
                </label>
                <button className="button secondary" type="submit">
                  Save confirmed budget
                </button>
              </form>
              <label className="field">
                Lead status
                <select
                  value={lead.status}
                  onChange={(e) => void update({ status: e.target.value })}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </section>
            <section className="detail-section">
              <h3>
                Source history{" "}
                <span className="count-pill">{lead.evidence.length}</span>
              </h3>
              {lead.evidence.map((e, i) => (
                <article className="evidence-card" key={`${e.sourceName}-${i}`}>
                  <div>
                    <Link2 size={15} />
                    <strong>{e.sourceName}</strong>
                  </div>
                  <p>{e.detail}</p>
                  <footer>
                    <span>{new Date(e.observedAt).toLocaleDateString()}</span>
                    {e.sourceUrl ? (
                      <a href={e.sourceUrl} target="_blank" rel="noreferrer">
                        View source <ArrowUpRight size={12} />
                      </a>
                    ) : null}
                  </footer>
                </article>
              ))}
            </section>
            <button
              className="button primary full-button"
              disabled={busy}
              onClick={() => void run("local")}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Sparkles size={16} />
              )}
              Build local analysis · no credits
            </button>
          </>
        ) : (
          <>
            <div className="analysis-options">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void run("local")}
              >
                Local analysis · free
              </button>
              <button
                className="button primary"
                disabled={busy || !aiReady}
                onClick={() => void run("cloud")}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Sparkles size={15} />
                )}
                Use cloud AI
              </button>
            </div>
            {!aiReady ? (
              <div className="mini-note">
                <Info size={14} />
                Cloud AI needs a server-side key, model and token prices. Local
                analysis is available now.
              </div>
            ) : (
              <p className="muted">
                Cloud mode shares this lead’s business research with your
                configured AI provider. No contact details are sent.
              </p>
            )}
            {analysis ? (
              <div className="analysis-result">
                <span
                  className={`source-status ${analysis.mode === "local" ? "green" : "purple"}`}
                >
                  {analysis.mode === "local"
                    ? "Local rules · not AI-generated"
                    : "Cloud AI · review required"}
                </span>
                <h3>Business summary</h3>
                <p>{analysis.data.summary}</p>
                <h3>Opportunity hypotheses</h3>
                {analysis.data.opportunities.length ? (
                  analysis.data.opportunities.map((o, i) => (
                    <article className="opportunity" key={i}>
                      <strong>{o.service}</strong>
                      <p>{o.reason}</p>
                    </article>
                  ))
                ) : (
                  <p>Research service needs before choosing an offer.</p>
                )}
                <h3>Next step</h3>
                <p>{analysis.data.nextStep}</p>
                <div className="mini-note">
                  <Info size={15} />
                  {analysis.data.budgetNote}
                </div>
                <h3>
                  First-message draft{" "}
                  <span className="gray-pill">Not sent</span>
                </h3>
                <pre className="draft-text">{analysis.data.draft}</pre>
                <button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(analysis.data.draft);
                      notify(
                        "Draft copied. Review placeholders, source rights and channel requirements before use.",
                      );
                    } catch {
                      setError(
                        "Clipboard unavailable. Select and copy the draft text manually.",
                      );
                    }
                  }}
                >
                  Copy draft <FileText size={15} />
                </button>
              </div>
            ) : (
              <div className="small-empty">
                <Sparkles size={26} />
                <h3>Make the research useful.</h3>
                <p>Build a summary and a reviewable draft for this business.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
function DetailRow({
  icon: Icon,
  title,
  value,
  href,
}: {
  icon: typeof Globe;
  title: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="detail-row">
      <Icon size={15} />
      <span>{title}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {value}
          <ArrowUpRight size={12} />
        </a>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}
function SettingsView({ settings }: { settings: Settings | null }) {
  return (
    <>
      <Heading
        eyebrow="A SOLID FOUNDATION"
        title="Workspace settings"
        description="Your local data, your integration choices, and a clear path to what comes next."
      />
      <div className="info-box">
        <Globe size={19} />
        <div>
          <strong>Website lookup for missing sites</strong>
          <p>
            Listed websites are used without a search subscription. For missing
            sites, optionally configure BRAVE_SEARCH_API_KEY,
            SEARCH_STORAGE_RIGHTS_CONFIRMED=true and
            SEARCH_MONTHLY_REQUEST_LIMIT in .env.local. Use a plan with storage
            rights; ambiguous matches require manual review. The collection
            worker starts with pnpm dev / pnpm start.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <span className="green-icon">
              <Database size={21} />
            </span>
            <h2>Database & runtime</h2>
          </div>
          <dl className="settings-list">
            <div>
              <dt>Storage</dt>
              <dd>{settings?.database || "Loading…"}</dd>
            </div>
            <div>
              <dt>Database file</dt>
              <dd>
                <code>.data/data-soft.sqlite</code>
              </dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>Local browser · loopback only</dd>
            </div>
            <div>
              <dt>Release</dt>
              <dd>{settings?.version || "0.2.0"}</dd>
            </div>
          </dl>
          <p className="muted">
            Sample and live records are isolated. This first release is
            single-user and local; add authentication and a hosted database
            before remote deployment.
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <span className="purple-icon">
              <Sparkles size={21} />
            </span>
            <h2>AI integration</h2>
          </div>
          <dl className="settings-list">
            <div>
              <dt>Local analysis</dt>
              <dd className="green-text">Available · no credits</dd>
            </div>
            <div>
              <dt>Cloud provider</dt>
              <dd>Vercel AI Gateway</dd>
            </div>
            <div>
              <dt>Cloud status</dt>
              <dd>{settings?.ai.ready ? "Configured" : "Setup needed"}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{settings?.ai.model || "Not configured"}</dd>
            </div>
            <div>
              <dt>Estimated spend / cap</dt>
              <dd>
                ${settings?.ai.spent.toFixed(4) || "0.0000"} / $
                {settings?.ai.monthlyCap || 25}
              </dd>
            </div>
          </dl>
          <h3>Connect cloud AI</h3>
          <p className="muted">
            Copy <code>.env.example</code> to <code>.env.local</code>, set your
            gateway key, current model ID, verified input/output token prices,
            and budget. Restart the server. Credentials stay off the browser.
          </p>
          <pre className="code-block">
            AI_GATEWAY_API_KEY=…{"\n"}AI_MODEL=provider/model-id{"\n"}
            AI_INPUT_PRICE_PER_MILLION=…{"\n"}AI_OUTPUT_PRICE_PER_MILLION=…
            {"\n"}AI_MONTHLY_BUDGET_USD=25
          </pre>
          <a
            className="text-button"
            href="https://vercel.com/docs/ai-gateway/getting-started"
            target="_blank"
            rel="noreferrer"
          >
            AI Gateway setup <ArrowUpRight size={14} />
          </a>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <span className="green-icon">
              <ShieldCheck size={21} />
            </span>
            <h2>Collection boundaries</h2>
          </div>
          <p>
            Available: cross-industry OpenStreetMap discovery, public website
            contact research, authorized CSV imports, NPPES organization
            searches, and approved JSON-LD directories.
          </p>
          <p className="muted">
            Upcoming: more directory formats, specialist contact verification
            and authenticated hosting. Reviewed SMTP email is available in Email
            & calling. SIP/VoIP calls and SMS are not connected yet.
          </p>
        </section>
      </div>
    </>
  );
}
