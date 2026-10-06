'use client';

import { Dialog } from '@/components/ui/Dialog';
import type { NamedDraft } from '@/hooks/useDraftPersistence';
import { Shield, TrendingUp, Flame, RefreshCcw, X, Clock, type LucideIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface ResumeDraftPromptProps {
  drafts: NamedDraft[];
  onResume: (draftId: string) => void | Promise<void>;
  onStartFresh: () => void | Promise<void>;
  onDeleteDraft?: (draftId: string) => void | Promise<void>;
}

type PendingAction = {
  type: 'resume' | 'delete' | 'startFresh';
  id?: string;
};

const typeLabelMap: Record<string, string> = {
  safe: 'Safe Commitment',
  balanced: 'Balanced Commitment',
  aggressive: 'Aggressive Commitment',
};

const typeIconMap: Record<string, LucideIcon> = {
  safe: Shield,
  balanced: TrendingUp,
  aggressive: Flame,
};

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function ResumeDraftPrompt({
  drafts,
  onResume,
  onStartFresh,
  onDeleteDraft,
}: ResumeDraftPromptProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingAction | null>(null);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  const execute = useCallback(
    async (action: PendingAction) => {
      if (pendingRef.current) return;
      pendingRef.current = action;
      setPendingAction(action);
      setError(null);
      try {
        switch (action.type) {
          case 'resume':
            if (!action.id) throw new Error('Draft id is missing');
            await onResume(action.id);
            break;
          case 'delete':
            if (!action.id) throw new Error('Draft id is missing');
            if (!onDeleteDraft) throw new Error('Delete is not available');
            await onDeleteDraft(action.id);
            break;
          case 'startFresh':
            await onStartFresh();
            break;
          default:
            throw new Error(`Unhandled action type: ${(action as PendingAction).type}`);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      } finally {
        pendingRef.current = null;
        setPendingAction(null);
      }
    },
    [onResume, onDeleteDraft, onStartFresh]
  );

  const handleResume = useCallback((id: string) => execute({ type: 'resume', id }), [execute]);
  const handleDelete = useCallback((id: string) => execute({ type: 'delete', id }), [execute]);
  const handleStartFresh = useCallback(() => execute({ type: 'startFresh' }), [execute]);

  if (drafts.length === 0) return null;

  return (
    <Dialog
      isOpen
      onClose={handleStartFresh}
      labelledById="resume-draft-title"
      describedById="resume-draft-description"
      closeOnEscape={!pendingAction}
      initialFocusRef={dismissButtonRef}
      className="mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F14] text-white shadow-2xl"
      backdropClassName="bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="p-6" aria-busy={!!pendingAction}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-2">
              <RefreshCcw size={20} className="text-blue-400" aria-hidden="true" />
            </div>
            <h2 id="resume-draft-title" className="text-xl font-semibold text-white">
              Resume a Draft
            </h2>
          </div>
          <button
            ref={dismissButtonRef}
            type="button"
            onClick={handleStartFresh}
            disabled={!!pendingAction}
            className="text-slate-400 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Dismiss and start fresh"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <p id="resume-draft-description" className="mb-4 text-slate-300">
          You have {drafts.length} in-progress draft{drafts.length > 1 ? 's' : ''}. Pick one to
          continue, or start fresh.
        </p>

        <ul className="mb-6 max-h-64 space-y-3 overflow-y-auto" aria-label="Saved drafts">
          {drafts.map((named) => {
            const { id, data, updatedAt } = named;
            const Icon = data.selectedType ? typeIconMap[data.selectedType] : TrendingUp;
            return (
              <li key={id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Icon size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
                    <span className="truncate text-sm font-medium text-white">
                      {typeLabelMap[data.selectedType ?? 'balanced']}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 text-right text-xs text-slate-400">
                    <span>Amount:</span>
                    <span className="text-slate-200">{data.amount || 'Not set'} {data.asset}</span>
                    <span>Duration:</span>
                    <span className="text-slate-200">{data.durationDays}d</span>
                    <span>Step:</span>
                    <span className="text-slate-200">{data.step} of 3</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={11} aria-hidden="true" />
                    <span>{formatRelativeTime(updatedAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleResume(id)}
                    disabled={!!pendingAction}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Resume
                  </button>
                  {onDeleteDraft && (
                    <button
                      type="button"
                      onClick={() => handleDelete(id)}
                      disabled={!!pendingAction}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Delete draft ${id}`}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={handleStartFresh}
          disabled={!!pendingAction}
          className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 font-medium text-white transition-colors hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start Fresh
        </button>
      </div>
    </Dialog>
  );
}
