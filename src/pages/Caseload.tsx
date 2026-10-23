import { useMemo, useState } from "react";
import { CLIENTS, NEED_LABELS, type TriageResult, type TriagedClient } from "../../shared/caseload";
import { BY_ID, ZIP_CENTERS, formatTime, openStatus } from "../../shared/resources";
import { Page } from "../components/Shell";
import { Icon, StatusBadge } from "../components/ui";
import { readStore, useApp, writeStore } from "../lib/app";
import { hasBackend, triageCaseload } from "../lib/backend";

type Contact = "pending" | "sent" | "reached" | "safe";
const STATE_KEY = "lifeline.caseload";

const URGENCY_STYLE: Record<TriagedClient["urgency"], string> = {
  critical: "bg-error text-white",
  high: "bg-secondary-container text-[#151c24]",
  medium: "bg-surface-container-high text-on-surface",
  low: "bg-surface-container text-on-surface-variant",
};

const LANG_TAG = { en: "EN", es: "ES", vi: "VI" } as const;

export default function Caseload() {
  const { online } = useApp();
  const saved = readStore(STATE_KEY, {
    zips: ["95122", "95111"] as string[],
    scenario: "PG&E unplanned outage during a heat advisory, 101°F expected this afternoon",
    result: null as TriageResult | null,
    contact: {} as Record<string, Contact>,
    drafts: {} as Record<string, string>,
    log: {} as Record<string, string>,
  });
  const [state, setState] = useState(saved);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [zipInput, setZipInput] = useState("");

  const save = (patch: Partial<typeof saved>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      writeStore(STATE_KEY, next);
      return next;
    });

  const clientById = useMemo(() => new Map(CLIENTS.map((c) => [c.id, c])), []);
  const affected = CLIENTS.filter((c) => state.zips.includes(c.zip)).length;

  const toggleZip = (z: string) =>
    save({ zips: state.zips.includes(z) ? state.zips.filter((x) => x !== z) : [...state.zips, z].sort() });

  const run = async () => {
    setRunning(true);
    setError("");
    try {
      const result = await triageCaseload(state.zips, state.scenario);
      save({ result, contact: {}, drafts: {}, log: {} });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  // Check-ins are delivered in the Lifeline app (no SMS). Maria's edits to the draft are what gets sent.
  const approveAndSend = (t: TriagedClient) => {
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    save({
      contact: { ...state.contact, [t.clientId]: "sent" },
      log: { ...state.log, [t.clientId]: `Approved by Maria and delivered in the Lifeline app at ${time}.` },
    });
  };

  const mark = (id: string, v: Contact) => save({ contact: { ...state.contact, [id]: v } });
  const counts = state.result
    ? state.result.clients.reduce(
        (acc, t) => {
          const v = state.contact[t.clientId] ?? "pending";
          acc[v]++;
          return acc;
        },
        { pending: 0, sent: 0, reached: 0, safe: 0 } as Record<Contact, number>,
      )
    : null;

  return (
    <Page back="#/" wide>
      <div className="flex flex-col gap-1">
        <span className="self-start text-label-sm px-2 py-0.5 rounded bg-secondary-container text-[#151c24]">
          Fictional demo data: all clients are made up
        </span>
        <h1 className="text-headline-xl text-primary">Maria's caseload</h1>
        <p className="text-body-lg text-on-surface-variant">
          Maria Tran, case manager · {CLIENTS.length} clients. Mark the outage, let Leslie triage who needs help first, then approve each check-in.
        </p>
      </div>

      <section className="grid md:grid-cols-[1fr_1fr] gap-space-md">
        <div className="bg-surface-container-lowest border-[1.5px] border-surface-variant rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="text-headline-md text-primary flex items-center gap-2">
            <Icon name="bolt" fill className="text-secondary" /> Outage
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...new Set(CLIENTS.map((c) => c.zip))].sort().map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => toggleZip(z)}
                aria-pressed={state.zips.includes(z)}
                className={`px-3 min-h-[44px] rounded-full border text-label-md ${
                  state.zips.includes(z) ? "bg-error text-white border-error" : "bg-surface-container-lowest border-surface-variant"
                }`}
              >
                {z} · {CLIENTS.filter((c) => c.zip === z).length}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^\d{5}$/.test(zipInput) && ZIP_CENTERS[zipInput] && !state.zips.includes(zipInput)) toggleZip(zipInput);
              setZipInput("");
            }}
          >
            <input
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="Add ZIP"
              inputMode="numeric"
              className="min-h-[44px] px-3 rounded-xl border border-surface-variant bg-surface-container-lowest w-32"
            />
            <button type="submit" className="min-h-[44px] px-3 rounded-xl border border-surface-variant text-label-md">
              Add
            </button>
          </form>
          <label className="flex flex-col gap-1 text-label-md">
            What happened
            <textarea
              value={state.scenario}
              onChange={(e) => save({ scenario: e.target.value })}
              rows={2}
              className="rounded-xl border border-surface-variant bg-surface-container-lowest p-2 text-body-md font-normal"
            />
          </label>
          <button
            type="button"
            disabled={running || state.zips.length === 0 || !online || !hasBackend}
            onClick={run}
            className="min-h-[56px] rounded-2xl bg-primary-container text-white text-headline-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Icon name={running ? "hourglass_top" : "psychology"} className={running ? "animate-pulse" : ""} />
            {running ? "Leslie is triaging…" : `Triage ${affected} affected client${affected === 1 ? "" : "s"}`}
          </button>
          {!hasBackend && <p className="text-label-sm text-error">The AI backend isn't deployed yet.</p>}
          {!online && <p className="text-label-sm text-error">Triage needs a connection. Your last results stay on this device.</p>}
          {error && <p className="text-label-sm text-error">Triage failed: {error}</p>}
        </div>

        <div className="bg-surface-container-low border border-surface-variant rounded-2xl p-4 flex flex-col gap-2">
          <h2 className="text-headline-md text-primary flex items-center gap-2">
            <Icon name="groups" /> Status
          </h2>
          {state.result && counts ? (
            <>
              <p className="text-body-lg">{state.result.summary}</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {(["pending", "sent", "reached", "safe"] as Contact[]).map((k) => (
                  <div key={k} className="bg-surface-container-lowest rounded-xl p-2">
                    <div className="text-headline-lg text-primary">{counts[k]}</div>
                    <div className="text-label-sm text-on-surface-variant capitalize">{k}</div>
                  </div>
                ))}
              </div>
              <p className="text-label-sm text-on-surface-variant">
                Triaged {new Date(state.result.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} by Amazon
                Bedrock ({state.result.model}) for ZIP {state.result.outageZips.join(", ")}
              </p>
            </>
          ) : (
            <ul className="text-body-md text-on-surface-variant flex flex-col gap-1">
              {CLIENTS.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span>
                    {c.name} <span className="text-label-sm">({LANG_TAG[c.language]})</span>
                  </span>
                  <span className="text-label-sm">{c.zip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {state.result && (
        <section className="flex flex-col gap-space-sm" aria-label="Triaged clients">
          {state.result.clients.map((t) => {
            const c = clientById.get(t.clientId)!;
            const r = t.resourceId ? BY_ID.get(t.resourceId) : undefined;
            const status = r ? openStatus(r) : null;
            const contact = state.contact[t.clientId] ?? "pending";
            const draft = state.drafts[t.clientId] ?? t.message;
            return (
              <article
                key={t.clientId}
                className={`bg-surface-container-lowest border-[1.5px] rounded-2xl p-4 grid md:grid-cols-[1.1fr_1fr] gap-4 ${
                  contact === "safe" ? "border-open opacity-70" : t.urgency === "critical" ? "border-error" : "border-surface-variant"
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-md text-label-sm uppercase ${URGENCY_STYLE[t.urgency]}`}>{t.urgency}</span>
                    <h3 className="text-headline-md text-primary">{c.name}</h3>
                    <span className="text-label-sm text-on-surface-variant">
                      {c.age} · ZIP {c.zip} · {LANG_TAG[c.language]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.needs.map((n) => (
                      <span key={n} className="text-label-sm px-2 py-0.5 rounded bg-surface-container">
                        {NEED_LABELS[n]}
                      </span>
                    ))}
                  </div>
                  <p className="text-body-md">
                    <strong>Why:</strong> {t.reason}
                  </p>
                  <p className="text-body-md">
                    <strong>Do:</strong> {t.recommendedAction}
                  </p>
                  {r && status && (
                    <a href={`#/place/${r.id}`} className="flex flex-col gap-1 rounded-xl border border-surface-variant p-3 hover:border-primary-container">
                      <span className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={status} />
                        {status.state === "open" && status.closesAt && (
                          <span className="text-label-sm text-on-surface-variant">until {formatTime(status.closesAt)}</span>
                        )}
                      </span>
                      <span className="text-label-lg text-primary">{r.name}</span>
                      <span className="text-label-sm text-on-surface-variant">{r.address}</span>
                    </a>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-label-md flex items-center justify-between">
                    Check-in message ({LANG_TAG[c.language]})
                    <span className="text-label-sm text-on-surface-variant">{draft.length}/300</span>
                  </label>
                  <textarea
                    value={draft}
                    onChange={(e) => save({ drafts: { ...state.drafts, [t.clientId]: e.target.value } })}
                    rows={4}
                    disabled={contact !== "pending"}
                    className="rounded-xl border border-surface-variant bg-surface-container-lowest p-2 text-body-md disabled:opacity-80"
                  />
                  <div className="flex flex-wrap gap-2">
                    {contact === "pending" && (
                      <button
                        type="button"
                        onClick={() => approveAndSend(t)}
                        className="min-h-[44px] px-4 rounded-xl bg-secondary-container text-[#151c24] text-label-md flex items-center gap-1 border-2 border-primary-container disabled:opacity-50"
                      >
                        <Icon name="send" /> Approve & send
                      </button>
                    )}
                    {(contact === "sent" || contact === "pending") && (
                      <button type="button" onClick={() => mark(t.clientId, "reached")} className="min-h-[44px] px-3 rounded-xl border border-surface-variant text-label-md flex items-center gap-1">
                        <Icon name="call" /> Reached
                      </button>
                    )}
                    {contact !== "safe" && (
                      <button type="button" onClick={() => mark(t.clientId, "safe")} className="min-h-[44px] px-3 rounded-xl border border-open text-on-open-container text-label-md flex items-center gap-1">
                        <Icon name="task_alt" /> Safe
                      </button>
                    )}
                    {contact !== "pending" && (
                      <span className="text-label-sm text-on-surface-variant self-center capitalize flex items-center gap-1">
                        <Icon name="done_all" className="!text-[18px]" /> {contact}
                      </span>
                    )}
                  </div>
                  {state.log[t.clientId] && <p className="text-label-sm text-on-surface-variant">{state.log[t.clientId]}</p>}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </Page>
  );
}
