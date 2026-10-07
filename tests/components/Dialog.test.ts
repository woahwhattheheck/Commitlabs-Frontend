import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const DIALOG_SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../src/components/ui/Dialog.tsx'),
  'utf-8',
);
const RESUME_DRAFT_SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../src/components/create/ResumeDraftPrompt.tsx'),
  'utf-8',
);
const CREATE_PAGE_SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../src/app/create/page.tsx'),
  'utf-8',
);

describe('Dialog backdrop dismissal', () => {
  it('lets destructive dialogs ignore backdrop clicks without disabling Escape', () => {
    expect(DIALOG_SOURCE).toMatch(/closeOnBackdrop\?: boolean/);
    expect(DIALOG_SOURCE).toMatch(/closeOnBackdrop\s*=\s*true/);
    expect(DIALOG_SOURCE).toMatch(
      /if\s*\(closeOnBackdrop\s*&&\s*event\.target\s*===\s*event\.currentTarget\)/,
    );
    expect(RESUME_DRAFT_SOURCE).toMatch(/closeOnBackdrop=\{false\}/);
    expect(RESUME_DRAFT_SOURCE).toMatch(/closeOnEscape=\{!pendingAction\}/);
  });

  it('keeps the open-session focus snapshot stable across prop updates', () => {
    expect(DIALOG_SOURCE).toMatch(/const onCloseRef = useRef\(onClose\)/);
    expect(DIALOG_SOURCE).toMatch(/const closeOnEscapeRef = useRef\(closeOnEscape\)/);
    expect(DIALOG_SOURCE).toMatch(/const initialFocusRefRef = useRef\(initialFocusRef\)/);
    expect(DIALOG_SOURCE).toMatch(/if \(closeOnEscapeRef\.current\)/);
    expect(DIALOG_SOURCE).toMatch(/onCloseRef\.current\(\)/);
    expect(DIALOG_SOURCE).toMatch(/initialFocusRefRef\.current\.current\.focus\(\)/);
    expect(DIALOG_SOURCE).not.toContain(
      '}, [isOpen, onClose, closeOnEscape, initialFocusRef]);',
    );
  });

  it('wires the named-draft lifecycle through the create page', () => {
    expect(CREATE_PAGE_SOURCE).toMatch(/allDrafts, saveDraft, clearDraft, clearAllDrafts, resumeDraft/);
    expect(CREATE_PAGE_SOURCE).toMatch(/activeDraftIdRef = useRef<string \| null>\(null\)/);
    expect(CREATE_PAGE_SOURCE).toMatch(/saveDraft\(currentDraft, activeDraftIdRef\.current\)/);
    expect(CREATE_PAGE_SOURCE).toMatch(/drafts=\{allDrafts\}/);
    expect(CREATE_PAGE_SOURCE).toMatch(/onDeleteDraft=\{handleDeleteDraft\}/);
    expect(CREATE_PAGE_SOURCE).toMatch(/clearAllDrafts\(\)/);
    expect(CREATE_PAGE_SOURCE).not.toContain("};entId.split");
  });
});
