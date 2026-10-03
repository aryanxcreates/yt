"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChannelConfig } from "@/lib/types";

type Toast = { type: "success" | "error"; text: string } | null;

function StatusBadge({ status }: { status: ChannelConfig["status"] }) {
  const cls = {
    active: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
    pending: "bg-amber-100 text-amber-700",
  }[status];
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
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

export default function Home() {
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

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

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 font-medium">Channel</th>
                    <th className="text-left px-4 py-3 font-medium">Account</th>
                    <th className="text-left px-4 py-3 font-medium">State</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Latest video</th>
                    <th className="text-left px-4 py-3 font-medium">Last commented</th>
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
                        {ch.error && (
                          <p className="text-xs text-red-500 mt-0.5">{truncate(ch.error, 60)}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                          #{(ch.accountIndex ?? 0) + 1}
                        </span>
                      </td>
                      <td className="px-4 py-4"><StateBadge ch={ch} /></td>
                      <td className="px-4 py-4"><StatusBadge status={ch.status} /></td>
                      <td className="px-4 py-4">
                        {ch.lastVideoId ? (
                          <a href={`https://youtube.com/watch?v=${ch.lastVideoId}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline">
                            {ch.lastVideoTitle ? truncate(ch.lastVideoTitle, 35) : ch.lastVideoId}
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-400 whitespace-nowrap">{fmt(ch.lastCommentedAt)}</td>
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
          Auto-runs every 15 min via Vercel Cron · New sheet rows picked up automatically · Comments generated by Claude AI · 3 YouTube accounts in rotation
        </p>
      </main>
    </div>
  );
}
