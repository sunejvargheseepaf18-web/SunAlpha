import React, { useRef, useState } from 'react';
import {
  importHoldingsCsv,
  clearImportedHoldings,
  hasImportedHoldings,
  exportHoldingsCsv,
  exportGhostfolioJson
} from '../services/portfolioIoService';
import { Upload, Download, FileJson, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ImportExportPanelProps {
  /** Called after the holdings source changes so the dashboard reloads. */
  onHoldingsChanged: () => void;
}

// Import broker/CAS-style CSVs (Zerodha headers understood), export the
// current book as canonical CSV or Ghostfolio activities JSON.

export const ImportExportPanel: React.FC<ImportExportPanelProps> = ({ onHoldingsChanged }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState(hasImportedHoldings());
  const [summary, setSummary] = useState<{ ok: number; errors: string[] } | null>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const result = importHoldingsCsv(text);
    setSummary({ ok: result.holdings.length, errors: result.errors });
    if (result.applied) {
      setImported(true);
      onHoldingsChanged();
    }
  };

  const handleRevert = () => {
    clearImportedHoldings();
    setImported(false);
    setSummary(null);
    onHoldingsChanged();
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-gray-800 text-sm">Import / Export Holdings</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {imported
              ? 'Running on your imported holdings.'
              : 'Running on the bundled sample book — import your broker CSV to make it yours.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black"
          >
            <Upload size={13} className="mr-1.5" /> Import CSV
          </button>
          <button
            onClick={exportHoldingsCsv}
            className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200"
            title="Canonical CSV — re-importable here"
          >
            <Download size={13} className="mr-1.5" /> CSV
          </button>
          <button
            onClick={exportGhostfolioJson}
            className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200"
            title="Ghostfolio activities JSON"
          >
            <FileJson size={13} className="mr-1.5" /> Ghostfolio
          </button>
          {imported && (
            <button
              onClick={handleRevert}
              className="flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100"
              title="Back to the sample book"
            >
              <RotateCcw size={13} className="mr-1.5" /> Revert
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div className="mt-3 border-t border-gray-100 pt-3 text-xs">
          {summary.ok > 0 ? (
            <p className="flex items-center text-emerald-600 font-medium">
              <CheckCircle2 size={14} className="mr-1.5" />
              Imported {summary.ok} holding{summary.ok > 1 ? 's' : ''} — the whole app now runs on them.
            </p>
          ) : (
            <p className="flex items-center text-red-600 font-medium">
              <AlertTriangle size={14} className="mr-1.5" /> Nothing imported.
            </p>
          )}
          {summary.errors.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-gray-500 max-h-24 overflow-y-auto">
              {summary.errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
