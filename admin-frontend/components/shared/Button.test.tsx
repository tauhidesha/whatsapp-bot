import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('renders with primary variant by default', () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary');
    });

    it('renders with secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-slate-600');
    });

    it('renders with danger variant', () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-danger-600');
    });

    it('renders with success variant', () => {
      render(<Button variant="success">Success</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-success-600');
    });

    it('renders with icon variant', () => {
      render(<Button variant="icon">Icon</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('flex items-center justify-center');
    });
  });

  describe('Sizes', () => {
    it('renders with small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4 py-1.5 text-sm');
    });

    it('renders with medium size by default', () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-6 py-2 text-base');
    });

    it('renders with large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-8 py-2.5 text-lg');
    });

    it('renders icon button with correct size', () => {
      render(<Button variant="icon" size="md">Icon</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10 w-10');
    });
  });

  describe('States', () => {
    it('handles disabled state', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50');
    });

    it('shows loading state', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByText(/memuat/i)).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('shows loading spinner in loading state', () => {
      render(<Button isLoading>Loading</Button>);
      const button = screen.getByRole('button');
      const spinner = button.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('disables button when loading', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} disabled>Disabled</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} isLoading>Loading</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Custom Props', () => {
    it('applies custom className', () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('forwards additional props', () => {
      render(<Button type="submit" data-testid="submit-btn">Submit</Button>);
      const button = screen.getByTestId('submit-btn');
      expect(button).toHaveAttribute('type', 'submit');
    });
  });

  describe('Accessibility', () => {
    it('has proper button role', () => {
      render(<Button>Accessible</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<Button aria-label="Custom label">Icon</Button>);
      expect(screen.getByLabelText('Custom label')).toBeInTheDocument();
    });

    it('is keyboard accessible', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Keyboard</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('announces loading state to screen readers', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByText(/memuat/i)).toBeInTheDocument();
    });

    it('has focus ring for keyboard navigation', () => {
      render(<Button>Focus Ring</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:ring-2');
    });
  });

  describe('Loading State (Requirement 16.4)', () => {
    it('shows loading indicator during async operations', () => {
      render(<Button isLoading>Save</Button>);
      const spinner = screen.getByRole('button').querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('displays loading text with spinner', () => {
      render(<Button isLoading>Save</Button>);
      expect(screen.getByText(/memuat/i)).toBeInTheDocument();
    });

    it('hides loading text for icon buttons', () => {
      render(<Button variant="icon" isLoading>Icon</Button>);
      const button = screen.getByRole('button');
      expect(button.textContent).not.toContain('Memuat');
    });

    it('prevents interaction while loading', () => {
      const handleClick = vi.fn();
      render(<Button isLoading onClick={handleClick}>Save</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('maintains button dimensions while loading', () => {
      const { rerender } = render(<Button>Save</Button>);
      const initialButton = screen.getByRole('button');
      const initialHeight = initialButton.offsetHeight;
      
      rerender(<Button isLoading>Save</Button>);
      const loadingButton = screen.getByRole('button');
      expect(loadingButton.offsetHeight).toBe(initialHeight);
    });
  });
});
