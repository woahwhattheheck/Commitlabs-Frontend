/**
 * @vitest-environment happy-dom
 */
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import CommitmentEarlyExitModal from './CommitmentEarlyExitModal';

const amounts = {
  commitmentId: 'commitment-123',
  originalAmount: '$100.00',
  penaltyPercent: '3%',
  penaltyAmount: '$3.00',
  netReceiveAmount: '$97.00',
};

describe('CommitmentEarlyExitModal', () => {
  it('renders no dialog when closed', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <CommitmentEarlyExitModal
        {...amounts}
        isOpen={false}
        hasAcknowledged={false}
        onChangeAcknowledged={vi.fn()}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables confirmation until the penalty is acknowledged', () => {
    const onConfirm = vi.fn();

    render(
      <CommitmentEarlyExitModal
        {...amounts}
        isOpen
        hasAcknowledged={false}
        onChangeAcknowledged={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('$97.00')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('enables confirmation after acknowledgement and invokes the callback', () => {
    const onConfirm = vi.fn();

    function ControlledModal() {
      const [acknowledged, setAcknowledged] = useState(false);
      return (
        <CommitmentEarlyExitModal
          {...amounts}
          isOpen
          hasAcknowledged={acknowledged}
          onChangeAcknowledged={() => setAcknowledged((current) => !current)}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      );
    }

    render(<ControlledModal />);
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'I understand the penalty' }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('fires cancel without confirming an early exit', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <CommitmentEarlyExitModal
        {...amounts}
        isOpen
        hasAcknowledged
        onChangeAcknowledged={vi.fn()}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
