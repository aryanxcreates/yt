"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChannelConfig, PostedComment } from "@/lib/types";

type Toast = { type: "success" | "error"; text: string } | null;

function StatusBadge({ status, error }: { status: ChannelConfig["status"]; error?: string }) {
  const cls = {
    active: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
    pending: "bg-amber-100 text-amber-700",
  }[status];
  const badge = (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
  if (status === "error" && error) {
    return (
      <div className="relative group inline-flex">
        {badge}
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-100 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
          {error}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      </div>
    );
  }
  return badge;
}

function StateBadge({ ch }: { ch: ChannelConfig }) {
  if (ch.followUpVideoId)
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Follow-up posted</span>;
  if (ch.creatorReplied)
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Creator replied</span>;
  if (ch.awaitingReply)
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Awaiting reply</span>;
  if (ch.firstCommentVideoId)
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Comment posted</span>;
  return <span className="text-xs text-gray-400">Watching…</span>;
}

function fmt(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function CommentsDialog({ channel, onClose }: { channel: ChannelConfig; onClose: () => void }) {
  const comments = channel.comments ?? [];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{channel.channelTitle}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {comments.length} comment{comments.length === 1 ? "" : "s"} posted
              {channel.accountName ? ` · as ${channel.accountName}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No comments posted yet.</p>
          ) : (
            comments.map((c: PostedComment, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.type === "first" ? "bg-gray-200 text-gray-700" : "bg-purple-100 text-purple-800"
                  }`}>
                    {c.type === "first" ? "First comment" : "Follow-up"}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(c.postedAt)}</span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{c.text}</p>
                <a
                  href={`https://youtube.com/watch?v=${c.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block text-xs text-blue-600 hover:underline"
                >
                  {c.videoTitle ? truncate(c.videoTitle, 50) : "View video"} ↗
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [viewComments, setViewComments] = useState<ChannelConfig | null>(null);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }

  const fetchChannels = useCallback(async () => {
    const res = await fetch("/api/channels");
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels ?? []);
    }
  }, []);

  useEffect(() => {
    fetch("/api/channels")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setChannels(data.channels ?? []); });
  }, []);

  async function handleSheetsImport() {
    if (!sheetsUrl.trim()) {
      showToast("error", "Enter a Google Sheets URL.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetsUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Import failed.");
        return;
      }
      const errNote = data.errors?.length ? ` (${data.errors.length} failed to resolve)` : "";
      showToast("success", `Added ${data.added} channel(s), skipped ${data.skipped} duplicate(s).${errNote}`);
      setSheetsUrl("");
      fetchChannels();
    } catch {
      showToast("error", "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunNow() {
    setProcessing(true);
    try {
      const res = await fetch("/api/process", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Processing failed.");
        return;
      }
      const { summary } = data as { summary: { total: number; commented: number; errored: number } };
      setLastRun(data.timestamp);
      showToast(
        summary.errored > 0 ? "error" : "success",
        `Run complete — commented on ${summary.commented}/${summary.total} channel(s).${summary.errored ? ` ${summary.errored} error(s).` : ""}`
      );
      fetchChannels();
    } catch {
      showToast("error", "Processing failed.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete(channelId: string) {
    await fetch("/api/channels", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    });
    setChannels((prev) => prev.filter((c) => c.channelId !== channelId));
  }

  async function handleClearAll() {
    if (!confirm("Remove all channels? This cannot be undone.")) return;
    await fetch("/api/channels", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setChannels([]);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {viewComments && (
        <CommentsDialog channel={viewComments} onClose={() => setViewComments(null)} />
      )}

      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.text}
        </div>
      )}

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900 leading-none">YT Auto Commenter</h1>
            <p className="text-xs text-gray-400 mt-0.5">AI-generated comments posted within minutes of new uploads</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Import card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Google Sheets URL
          </label>
          <p className="text-xs text-gray-400 mb-3">
            Column A = YouTube channel URLs. New rows are picked up automatically on every cron run.
          </p>
          <div className="flex gap-3">
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSheetsImport(); }}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <button
              onClick={handleSheetsImport}
              disabled={loading}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? "Importing…" : "Import"}
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { step: "1", title: "Add channels", desc: "Paste your Google Sheet URL (Column A = channel URLs) and click Import." },
              { step: "2", title: "New video detected", desc: "Every run checks each channel. If a new upload is found within 24 h, it posts an AI comment." },
              { step: "3", title: "Awaiting reply", desc: "After the first comment, the channel waits. If the creator replies, the cycle is done." },
              { step: "4", title: "Follow-ups", desc: "Every time they upload without replying, another follow-up is posted — repeating until the creator finally replies." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-700">State legend</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { badge: <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-400">Watching…</span>, desc: "Monitoring for new uploads. No comment posted yet." },
                { badge: <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Awaiting reply</span>, desc: "First comment posted. Waiting to see if the creator replies." },
                { badge: <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Creator replied</span>, desc: "Creator responded to the comment. Cycle complete." },
                { badge: <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Follow-up posted</span>, desc: "No reply yet, so a follow-up was posted — and more will follow on each new upload until they reply." },
              ].map(({ badge, desc }, i) => (
                <div key={i} className="flex items-center gap-2">
                  {badge}
                  <span className="text-xs text-gray-400">{desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold text-gray-700 pt-1">Status legend</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { badge: <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">active</span>, desc: "Running normally." },
                { badge: <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">pending</span>, desc: "Added but not yet processed." },
                { badge: <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">error</span>, desc: "Last run failed — check the error below the channel name." },
              ].map(({ badge, desc }, i) => (
                <div key={i} className="flex items-center gap-2">
                  {badge}
                  {desc && <span className="text-xs text-gray-400">{desc}</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 pt-1">
              Runs automatically every 5 min via cron, or manually with <span className="font-medium text-gray-500">▶ Run Now</span>. New sheet rows are synced on each run. Comments rotate across 3 YouTube accounts.
            </p>
          </div>
        </div>

        {/* Channels table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Channels <span className="text-gray-400 font-normal">({channels.length})</span>
              </h2>
              {lastRun && (
                <p className="text-xs text-gray-400 mt-0.5">Last run: {fmt(lastRun)}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {channels.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={handleRunNow}
                disabled={processing || channels.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {processing ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Running…
                  </>
                ) : <>▶ Run Now</>}
              </button>
            </div>
          </div>

          {channels.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm text-gray-400">No channels yet. Paste your Google Sheets URL above to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 font-medium">Channel</th>
                    <th className="text-left px-4 py-3 font-medium">Account</th>
                    <th className="text-left px-4 py-3 font-medium">State</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Latest video</th>
                    <th className="text-left px-4 py-3 font-medium">Comments</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {channels.map((ch) => (
                    <tr key={ch.channelId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <a href={ch.channelUrl} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:underline">
                          {ch.channelTitle}
                        </a>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className="inline-block max-w-[140px] truncate align-bottom text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full"
                          title={ch.accountName ?? `Account ${(ch.accountIndex ?? 0) + 1}`}
                        >
                          {ch.accountName ?? `Account ${(ch.accountIndex ?? 0) + 1}`}
                        </span>
                      </td>
                      <td className="px-4 py-4"><StateBadge ch={ch} /></td>
                      <td className="px-4 py-4"><StatusBadge status={ch.status} error={ch.error} /></td>
                      <td className="px-4 py-4">
                        {ch.lastVideoId ? (
                          <div>
                            <a href={`https://youtube.com/watch?v=${ch.lastVideoId}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline">
                              {ch.lastVideoTitle ? truncate(ch.lastVideoTitle, 35) : ch.lastVideoId}
                            </a>
                            {ch.lastVideoPublishedAt && (
                              <p className="text-xs text-gray-400 mt-0.5">{fmt(ch.lastVideoPublishedAt)}</p>
                            )}
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        {ch.comments?.length ? (
                          <button
                            onClick={() => setViewComments(ch)}
                            className="group flex flex-col items-start gap-0.5 text-left"
                          >
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:underline">
                              💬 View {ch.comments.length} comment{ch.comments.length === 1 ? "" : "s"}
                            </span>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              Last: {fmt(ch.lastCommentedAt)}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button onClick={() => handleDelete(ch.channelId)}
                          className="text-gray-300 hover:text-red-500 transition-colors text-xs" title="Remove channel">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Auto-runs every 5 min via Vercel Cron · New sheet rows picked up automatically · Comments generated by Claude AI · 3 YouTube accounts in rotation
        </p>
      </main>
    </div>
  );
}
