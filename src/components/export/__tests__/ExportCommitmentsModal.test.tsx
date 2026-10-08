// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExportCommitmentsModal from '../ExportCommitmentsModal';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Commitment CSV export request', () => {
  it('sends the selected non-default date range and signed wallet authorization', async () => {
    const sendRequest = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', sendRequest);

    render(
      <ExportCommitmentsModal
        isOpen
        onClose={() => {}}
        ownerAddress={`G${'A'.repeat(55)}`}
        sessionToken="sample-test-session"
      />,
    );

    fireEvent.change(screen.getByLabelText('Date range'), {
      target: { value: '7d' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(sendRequest).toHaveBeenCalledTimes(1));
    const [requestUrl, options] = sendRequest.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const request = new URL(requestUrl, 'https://test.example');
    expect(request.pathname).toBe('/api/commitments/export');
    expect(request.searchParams.get('dateRange')).toBe('7d');
    expect(request.searchParams.get('format')).toBe('csv');
    expect(request.searchParams.get('ownerAddress')).toBe(`G${'A'.repeat(55)}`);
    expect(options.headers).toEqual({ Authorization: 'Bearer sample-test-session' });
    expect(requestUrl).not.toContain('sample-test-session');
  });
});
