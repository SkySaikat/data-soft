"use client";
import { useEffect, useState } from "react";
import { Globe, LoaderCircle, Mail, Phone, Search } from "lucide-react";
import type { Lead, WorkJob } from "@/lib/domain";
import { api, post } from "@/lib/client-api";
import { ComposeEmail } from "./mail-workspace";

export function ContactPanel({
  lead,
  onUpdated,
  notify,
}: {
  lead: Lead;
  onUpdated: (lead: Lead) => void;
  notify: (message: string) => void;
}) {
  const [jobId, setJobId] = useState(""),
    [job, setJob] = useState<WorkJob | null>(null),
    [error, setError] = useState(""),
    [composing, setComposing] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const result = await api<{ job: WorkJob }>(`jobs/${jobId}`);
        if (!active) return;
        setJob(result.job);
        if (!["queued", "running"].includes(result.job.status)) {
          clearInterval(timer);
          const updated = await api<Lead>(`leads/${lead.id}?workspace=live`);
          if (active) {
            onUpdated(updated);
            setJobId("");
            notify(result.job.message);
          }
        }
      } catch (error) {
        if (active) setError((error as Error).message);
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [jobId, lead.id, notify, onUpdated]);
  async function research() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ jobId: string }>(
        "enrich",
        post({ leadIds: [lead.id] }),
      );
      setJobId(result.jobId);
      notify("Public website/contact research queued.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveWebsite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<Lead>(`leads/${lead.id}`, {
        ...post({
          workspace: "live",
          website: new FormData(event.currentTarget).get("website"),
        }),
        method: "PATCH",
      });
      onUpdated(result);
      notify("Business website saved. You can now research public contacts.");
    } catch (error) {
      setError((error as Error).message);
    }
  }
  const contacts = lead.contacts || [];
  return (
    <section className="detail-section public-contacts">
      <h3>Public contacts & website research</h3>
      <div className="contact-actions">
        <button
          className="button secondary"
          disabled={lead.workspace !== "live" || busy || Boolean(jobId)}
          onClick={() => void research()}
        >
          {busy || jobId ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <Search size={15} />
          )}
          Find website & contacts
        </button>
        <button
          className="button primary"
          disabled={
            lead.workspace !== "live" ||
            (!lead.email && !contacts.some((c) => c.kind === "email")) ||
            lead.emailSuppressed
          }
          onClick={() => setComposing(true)}
        >
          <Mail size={15} />
          Compose email
        </button>
      </div>
      {jobId ? (
        <p className="muted">
          {job?.message || "Waiting for research worker…"}
        </p>
      ) : null}
      {lead.emailSuppressed ? (
        <p className="form-error">
          This business email is on the do-not-contact list.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {contacts.length ? (
        <div className="public-contact-list">
          {contacts.map((contact) => (
            <div key={contact.id} className="public-contact">
              <span>
                {contact.kind === "email" ? (
                  <Mail size={14} />
                ) : (
                  <Phone size={14} />
                )}
                <strong>{contact.value}</strong>
              </span>
              <small>
                {contact.status === "publicly_listed"
                  ? "Publicly listed · not deliverability verified"
                  : "Imported · not verified"}
                {contact.kind === "phone"
                  ? ` · type: ${contact.phoneType}`
                  : ""}
              </small>
              {contact.sourceUrl ? (
                <a href={contact.sourceUrl} target="_blank" rel="noreferrer">
                  Source page
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          No additional public contacts researched yet. Existing registry
          details remain above.
        </p>
      )}
      {lead.workspace === "live" ? (
        <details className="website-editor">
          <summary>
            <Globe size={14} />
            Add or correct the business website
          </summary>
          <form onSubmit={saveWebsite}>
            <label className="field">
              Verified business website
              <input
                name="website"
                type="url"
                required
                defaultValue={lead.website}
                placeholder="https://business-website.com"
              />
            </label>
            <button className="button secondary">Save website</button>
          </form>
        </details>
      ) : null}
      <p className="muted">
        Website research reads permitted public pages. Listed sites and corporate-email domains are checked first; optional search handles missing sites. Emails are never guessed, and no
        outreach is automatic.
      </p>
      {composing ? (
        <ComposeEmail lead={lead} onClose={() => setComposing(false)} />
      ) : null}
    </section>
  );
}
