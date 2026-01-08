import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  AfeStatusBadge,
  SignerStatusBadge,
  AfeProgress,
} from '@/components/afe/afe-status-badge';

describe('AfeStatusBadge Component', () => {
  describe('AFE Status Badges', () => {
    it('renders DRAFT status correctly', () => {
      render(<AfeStatusBadge status="DRAFT" />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('renders PENDING status correctly', () => {
      render(<AfeStatusBadge status="PENDING" />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('renders PARTIALLY_SIGNED status correctly', () => {
      render(<AfeStatusBadge status="PARTIALLY_SIGNED" />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('renders FULLY_SIGNED status correctly', () => {
      render(<AfeStatusBadge status="FULLY_SIGNED" />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('renders REJECTED status correctly', () => {
      render(<AfeStatusBadge status="REJECTED" />);
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });

    it('renders CANCELLED status correctly', () => {
      render(<AfeStatusBadge status="CANCELLED" />);
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });

    it('renders without icon when showIcon is false', () => {
      const { container } = render(<AfeStatusBadge status="DRAFT" showIcon={false} />);

      // Should only have text, no svg icon
      const svgs = container.querySelectorAll('svg');
      expect(svgs).toHaveLength(0);
    });

    it('renders with small size', () => {
      const { container } = render(<AfeStatusBadge status="DRAFT" size="sm" />);

      const badge = container.firstChild;
      expect(badge).toHaveClass('text-[10px]');
    });
  });

  describe('Signer Status Badges', () => {
    it('renders PENDING signer status correctly', () => {
      render(<SignerStatusBadge status="PENDING" />);
      expect(screen.getByText('Waiting')).toBeInTheDocument();
    });

    it('renders ACTIVE signer status correctly', () => {
      render(<SignerStatusBadge status="ACTIVE" />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('renders SIGNED signer status correctly', () => {
      render(<SignerStatusBadge status="SIGNED" />);
      expect(screen.getByText('Signed')).toBeInTheDocument();
    });

    it('renders REJECTED signer status correctly', () => {
      render(<SignerStatusBadge status="REJECTED" />);
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });

    it('renders SKIPPED signer status correctly', () => {
      render(<SignerStatusBadge status="SKIPPED" />);
      expect(screen.getByText('Skipped')).toBeInTheDocument();
    });

    it('renders without icon when showIcon is false', () => {
      const { container } = render(<SignerStatusBadge status="SIGNED" showIcon={false} />);

      const svgs = container.querySelectorAll('svg');
      expect(svgs).toHaveLength(0);
    });

    it('renders with small size', () => {
      const { container } = render(<SignerStatusBadge status="SIGNED" size="sm" />);

      const badge = container.firstChild;
      expect(badge).toHaveClass('text-[10px]');
    });
  });

  describe('AfeProgress Component', () => {
    it('renders progress bar with 0% when no signers', () => {
      render(<AfeProgress signers={[]} />);
      expect(screen.getByText('0/0')).toBeInTheDocument();
    });

    it('renders progress bar with correct count', () => {
      const signers = [
        { status: 'SIGNED' as const },
        { status: 'SIGNED' as const },
        { status: 'PENDING' as const },
        { status: 'ACTIVE' as const },
      ];
      render(<AfeProgress signers={signers} />);
      expect(screen.getByText('2/4')).toBeInTheDocument();
    });

    it('renders progress bar with 100% when all signed', () => {
      const signers = [
        { status: 'SIGNED' as const },
        { status: 'SIGNED' as const },
        { status: 'SIGNED' as const },
      ];
      render(<AfeProgress signers={signers} />);
      expect(screen.getByText('3/3')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <AfeProgress signers={[]} className="custom-progress" />
      );

      expect(container.firstChild).toHaveClass('custom-progress');
    });

    it('has correct progress bar width based on percentage', () => {
      const signers = [
        { status: 'SIGNED' as const },
        { status: 'PENDING' as const },
      ];
      const { container } = render(<AfeProgress signers={signers} />);

      const progressBar = container.querySelector('.bg-green-500');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('shows 0% width when no signers signed', () => {
      const signers = [
        { status: 'PENDING' as const },
        { status: 'ACTIVE' as const },
      ];
      const { container } = render(<AfeProgress signers={signers} />);

      const progressBar = container.querySelector('.bg-green-500');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('shows 100% width when all signers signed', () => {
      const signers = [
        { status: 'SIGNED' as const },
        { status: 'SIGNED' as const },
      ];
      const { container } = render(<AfeProgress signers={signers} />);

      const progressBar = container.querySelector('.bg-green-500');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });
});
