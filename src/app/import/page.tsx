"use client";

import { useState } from "react";

type ImportResult = {
  success: boolean;
  imported: number;
  skipped: number;
  error?: string;
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    "idle"
  );
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus("uploading");
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data: ImportResult = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "Import failed");
        setStatus("error");
        return;
      }

      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Import Complaints</h1>
        <p className="text-sm text-zinc-400">
          Upload a CSV file to import complaint records.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-zinc-300 file:mr-4 file:cursor-pointer file:rounded file:border-0 file:bg-white file:px-4 file:py-2 file:font-medium file:text-black"
          />

          <button
            type="submit"
            disabled={!file || status === "uploading"}
            className="rounded bg-white px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "uploading" ? "Importing..." : "Import"}
          </button>
        </form>

        {status === "uploading" && (
          <p className="text-sm text-zinc-400">Uploading and processing file…</p>
        )}

        {status === "error" && error && (
          <p className="text-sm text-red-400">Error: {error}</p>
        )}

        {status === "done" && result && (
          <div className="rounded border border-zinc-700 p-4 text-sm">
            <p className="mb-2 text-green-400">Import complete.</p>
            <p>Imported: {result.imported}</p>
            <p>Skipped: {result.skipped}</p>
          </div>
        )}
      </div>
    </div>
  );
}
