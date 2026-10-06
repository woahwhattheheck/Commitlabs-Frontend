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
});
