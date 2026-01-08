import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonAfeCard,
  SkeletonAfeDetail,
  SkeletonDashboard,
} from '@/components/ui/skeleton';

describe('Skeleton Components', () => {
  describe('Skeleton', () => {
    it('renders with default classes', () => {
      render(<Skeleton data-testid="skeleton" />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('animate-pulse');
      expect(skeleton).toHaveClass('rounded-md');
      expect(skeleton).toHaveClass('bg-muted');
    });

    it('accepts additional className', () => {
      render(<Skeleton data-testid="skeleton" className="h-10 w-20" />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('h-10');
      expect(skeleton).toHaveClass('w-20');
    });

    it('passes through other props', () => {
      render(<Skeleton data-testid="skeleton" aria-label="Loading" />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveAttribute('aria-label', 'Loading');
    });
  });

  describe('SkeletonCard', () => {
    it('renders a card structure', () => {
      render(<SkeletonCard data-testid="skeleton-card" />);

      // Should have a container with card styling
      const container = document.querySelector('.rounded-lg.border.bg-card');
      expect(container).toBeInTheDocument();
    });

    it('accepts additional className', () => {
      const { container } = render(<SkeletonCard className="custom-class" />);

      const card = container.firstChild;
      expect(card).toHaveClass('custom-class');
    });
  });

  describe('SkeletonTableRow', () => {
    it('renders with default 5 columns', () => {
      render(
        <table>
          <tbody>
            <SkeletonTableRow />
          </tbody>
        </table>
      );

      const cells = document.querySelectorAll('td');
      expect(cells).toHaveLength(5);
    });

    it('renders with custom number of columns', () => {
      render(
        <table>
          <tbody>
            <SkeletonTableRow columns={3} />
          </tbody>
        </table>
      );

      const cells = document.querySelectorAll('td');
      expect(cells).toHaveLength(3);
    });
  });

  describe('SkeletonTable', () => {
    it('renders with default 5 rows and 5 columns', () => {
      render(<SkeletonTable />);

      const rows = document.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(5);

      const cells = document.querySelectorAll('tbody td');
      expect(cells).toHaveLength(25); // 5 rows * 5 columns
    });

    it('renders with custom rows and columns', () => {
      render(<SkeletonTable rows={3} columns={4} />);

      const rows = document.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(3);

      const cells = document.querySelectorAll('tbody td');
      expect(cells).toHaveLength(12); // 3 rows * 4 columns
    });

    it('renders header row', () => {
      render(<SkeletonTable columns={3} />);

      const headerCells = document.querySelectorAll('thead th');
      expect(headerCells).toHaveLength(3);
    });
  });

  describe('SkeletonAfeCard', () => {
    it('renders AFE card skeleton structure', () => {
      render(<SkeletonAfeCard />);

      // Check for main container
      const container = document.querySelector('.rounded-lg.border.bg-card');
      expect(container).toBeInTheDocument();

      // Check for skeleton elements
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('SkeletonAfeDetail', () => {
    it('renders AFE detail skeleton structure', () => {
      render(<SkeletonAfeDetail />);

      // Should have header section
      const headerSection = document.querySelector('.flex.items-center.gap-4');
      expect(headerSection).toBeInTheDocument();

      // Should have grid layout
      const grid = document.querySelector('.grid.grid-cols-1.lg\\:grid-cols-3');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('SkeletonDashboard', () => {
    it('renders dashboard skeleton structure', () => {
      render(<SkeletonDashboard />);

      // Should have stats grid with 4 items
      const statsGrid = document.querySelector('.grid.gap-4.md\\:grid-cols-2.lg\\:grid-cols-4');
      expect(statsGrid).toBeInTheDocument();

      const statCards = statsGrid?.querySelectorAll('.rounded-lg.border.bg-card');
      expect(statCards).toHaveLength(4);
    });

    it('renders pending AFEs section with 3 cards', () => {
      render(<SkeletonDashboard />);

      // Should have 3 AFE card skeletons in the pending section
      const afeCards = document.querySelectorAll('.p-6.space-y-4 > div');
      expect(afeCards).toHaveLength(3);
    });
  });
});
