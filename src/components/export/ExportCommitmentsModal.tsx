'use client';

import React, { useEffect, useRef, useState } from 'react';
import { buildCommitmentsExportUrl, type ExportDateRange } from './exportUrl';

interface ExportCommitmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerAddress: string;
  /** Signed wallet session returned by useWallet; never put this in an export URL. */
  sessionToken?: string | null;
}

function exportErrorMessage(status: number): string {
  if (status === 401) return 'Sign in with your wallet before exporting.';
  if (status === 403) return 'This wallet is not authorized to export the selected commitments.';
  if (status === 429) return 'Too many export requests. Please try again later.';
  if (status === 400) return 'This export request is not valid. Check your wallet and filters.';
  return 'The export could not be completed. Please try again.';
}

export default function ExportCommitmentsModal({
  isOpen,
  onClose,
  ownerAddress,
  sessionToken,
}: ExportCommitmentsModalProps) {
  const [dateRange, setDateRange] = useState<ExportDateRange>('all');
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isOpen) abortRef.current?.abort();
  }, [isOpen]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleClose = () => {
    abortRef.current?.abort();
    inFlightRef.current = false;
    setIsDownloading(false);
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleExport = async () => {
    if (inFlightRef.current) return;
    setError(null);
    setSuccess(false);

    if (!ownerAddress.trim() || !sessionToken?.trim()) {
      setError('Connect and sign in with your wallet before exporting.');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;
    setIsDownloading(true);

    try {
      const response = await fetch(
        buildCommitmentsExportUrl({ ownerAddress, dateRange, format: 'csv' }),
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${sessionToken}` },
          signal: controller.signal,
          cache: 'no-store',
        },
      );

      if (!response.ok) throw new Error(exportErrorMessage(response.status));
      if (!response.headers.get('content-type')?.toLowerCase().includes('text/csv')) {
        throw new Error('The server did not return a CSV export.');
      }

      const csv = await response.blob();
      if (controller.signal.aborted) return;
      // Bounded server response is downloaded as-is; never interpret it as HTML.
      const objectUrl = URL.createObjectURL(csv);
      try {
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `commitments-${dateRange}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        // Defer revocation so browsers have time to begin the save.
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      }
      if (!controller.signal.aborted) setSuccess(true);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Export failed. Please try again.');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        inFlightRef.current = false;
        setIsDownloading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export commitment data"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
    >
      <div
        className="bg-[#0a0a0a] rounded-2xl p-8 border border-[#222] max-w-md w-full"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-white text-lg font-bold mb-4">Export Commitment Data</h2>
        <p className="text-white/60 text-sm mb-4">
          Export commitments for {ownerAddress ? `${ownerAddress.slice(0, 8)}…` : 'your wallet'}.
        </p>

        <label htmlFor="commitment-export-range" className="block text-white text-sm mb-2">
          Date range
        </label>
        <select
          id="commitment-export-range"
          aria-label="Date range"
          value={dateRange}
          disabled={isDownloading}
          onChange={(event) => {
            setDateRange(event.target.value as ExportDateRange);
            setError(null);
            setSuccess(false);
          }}
          className="w-full mb-4 rounded border border-[#333] bg-[#161616] p-2 text-white"
        >
          <option value="all">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="year">This year</option>
        </select>

        <p className="text-white/70 text-sm mb-5">Format: CSV (only supported format)</p>

        {error && <p role="alert" className="text-red-300 text-sm mb-3">{error}</p>}
        {success && (
          <p role="status" className="text-green-300 text-sm mb-3">
            CSV download started.
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2 rounded-lg bg-[#161616] border border-[#232323] text-white text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => void handleExport()}
            className="flex-1 py-2 rounded-lg bg-cyan-700 disabled:opacity-50 text-white text-sm"
          >
            {isDownloading ? 'Exporting…' : 'Download CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
