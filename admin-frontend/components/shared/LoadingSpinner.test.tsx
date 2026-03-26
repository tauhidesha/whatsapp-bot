import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner Component', () => {
  describe('Rendering', () => {
    it('renders loading spinner', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('has aria-label for accessibility', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByLabelText('Memuat...');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('renders with small size', () => {
      render(<LoadingSpinner size="sm" />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('w-4 h-4 border-2');
    });

    it('renders with medium size by default', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('w-8 h-8 border-4');
    });

    it('renders with large size', () => {
      render(<LoadingSpinner size="lg" />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('w-12 h-12 border-4');
    });
  });

  describe('Styling', () => {
    it('has primary color for top border', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('border-t-primary');
    });

    it('has slate color for other borders', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('border-slate-200');
    });

    it('has dark mode support', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('dark:border-slate-700');
    });

    it('has spin animation', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('animate-spin');
    });

    it('is rounded', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('rounded-full');
    });
  });

  describe('Container', () => {
    it('is centered', () => {
      const { container } = render(<LoadingSpinner />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex items-center justify-center');
    });
  });

  describe('Accessibility', () => {
    it('has status role for screen readers', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('has descriptive aria-label', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByLabelText('Memuat...');
      expect(spinner).toBeInTheDocument();
    });

    it('announces loading state to assistive technology', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-label', 'Memuat...');
    });
  });

  describe('Loading Indicator (Requirement 16.4)', () => {
    it('provides visual loading feedback', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('animate-spin');
    });

    it('uses primary color for loading indicator', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('border-t-primary');
    });

    it('maintains consistent appearance across sizes', () => {
      const { rerender } = render(<LoadingSpinner size="sm" />);
      let spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('animate-spin');
      
      rerender(<LoadingSpinner size="md" />);
      spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('animate-spin');
      
      rerender(<LoadingSpinner size="lg" />);
      spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('animate-spin');
    });

    it('supports dark mode for async operations', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('dark:border-slate-700');
    });

    it('is properly centered for UI integration', () => {
      const { container } = render(<LoadingSpinner />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('items-center');
      expect(wrapper).toHaveClass('justify-center');
    });
  });
});
