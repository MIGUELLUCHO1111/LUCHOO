"use client";

import { useState } from "react";
import { Upload, FileCheck2, X } from "lucide-react";

export function FileUploadField({
  name,
  label,
  defaultUrl,
}: {
  name: string;
  label: string;
  defaultUrl?: string | null;
}) {
  const [url, setUrl] = useState<string | null>(defaultUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    setUploading(false);

    if (!res.ok) {
      setError("No se pudo subir el archivo.");
      return;
    }
    const data = await res.json();
    setUrl(data.url);
    setFileName(data.filename);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-brand-blue-dark">{label}</label>
      <input type="hidden" name={name} value={url ?? ""} />

      {url ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-brand-blue-50 px-3 py-2 text-sm">
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-brand-blue hover:underline">
            <FileCheck2 className="h-4 w-4" />
            {fileName ?? "Archivo adjunto"}
          </a>
          <button type="button" onClick={() => { setUrl(null); setFileName(null); }} className="text-muted hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted hover:border-brand-blue-light hover:text-brand-blue">
          <Upload className="h-4 w-4" />
          {uploading ? "Subiendo..." : "Adjuntar archivo"}
          <input type="file" className="hidden" onChange={onChange} disabled={uploading} />
        </label>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
