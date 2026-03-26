import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Input from './Input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('renders input element', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Input label="Username" />);
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('renders with helper text', () => {
      render(<Input helperText="This is a helper text" />);
      expect(screen.getByText('This is a helper text')).toBeInTheDocument();
    });

    it('renders with left icon', () => {
      render(
        <Input
          leftIcon={<span data-testid="left-icon">🔍</span>}
          placeholder="Search"
        />
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('renders with right icon', () => {
      render(
        <Input
          rightIcon={<span data-testid="right-icon">✓</span>}
          placeholder="Valid"
        />
      );
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('renders with both left and right icons', () => {
      render(
        <Input
          leftIcon={<span data-testid="left-icon">🔍</span>}
          rightIcon={<span data-testid="right-icon">✓</span>}
          placeholder="Search"
        />
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });
  });

  describe('Validation States', () => {
    it('shows error message', () => {
      render(<Input error="This field is required" id="test-input" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('applies error styles when error is present', () => {
      render(<Input error="Error" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-danger-500');
    });

    it('shows success message', () => {
      render(<Input success="Looks good!" id="test-input" />);
      expect(screen.getByText('Looks good!')).toBeInTheDocument();
    });

    it('applies success styles when success is present', () => {
      render(<Input success="Success" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-success-500');
    });

    it('prioritizes error over success', () => {
      render(<Input error="Error" success="Success" id="test-input" />);
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.queryByText('Success')).not.toBeInTheDocument();
    });

    it('sets aria-invalid when error is present', () => {
      render(<Input error="Error" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('sets aria-describedby for error', () => {
      render(<Input error="Error message" id="test-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'test-input-error');
    });
  });

  describe('States', () => {
    it('handles disabled state', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:opacity-50');
    });

    it('handles readonly state', () => {
      render(<Input readOnly value="Read only" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('Interactions', () => {
    it('calls onChange handler when value changes', () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test' } });
      
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('calls onFocus handler when focused', () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      
      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('calls onBlur handler when blurred', () => {
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.blur(input);
      
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Props', () => {
    it('applies custom className', () => {
      render(<Input className="custom-class" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-class');
    });

    it('forwards additional props', () => {
      render(<Input type="email" data-testid="email-input" />);
      const input = screen.getByTestId('email-input');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('supports controlled input', () => {
      const { rerender } = render(<Input value="initial" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).toHaveValue('initial');
      
      rerender(<Input value="updated" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).toHaveValue('updated');
    });
  });

  describe('Padding Styles', () => {
    it('applies correct padding with left icon only', () => {
      render(<Input leftIcon={<span>Icon</span>} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-10 pr-4');
    });

    it('applies correct padding with right icon only', () => {
      render(<Input rightIcon={<span>Icon</span>} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-4 pr-10');
    });

    it('applies correct padding with both icons', () => {
      render(<Input leftIcon={<span>L</span>} rightIcon={<span>R</span>} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-10 pr-10');
    });

    it('applies correct padding with no icons', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('px-4');
    });
  });

  describe('Accessibility', () => {
    it('associates label with input', () => {
      render(<Input label="Email" id="email" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Email');
      expect(label).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<Input aria-label="Search input" />);
      expect(screen.getByLabelText('Search input')).toBeInTheDocument();
    });

    it('is keyboard accessible', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      input.focus();
      expect(input).toHaveFocus();
    });

    it('has proper aria-describedby for helper text', () => {
      render(<Input helperText="Enter a valid email" id="email-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'email-input-helper');
    });

    it('announces validation state to screen readers', () => {
      render(<Input error="This field is required" id="test" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'test-error');
    });
  });

  describe('Validation States (Requirement 16.4)', () => {
    it('displays error state during validation', () => {
      render(<Input error="Email is invalid" id="email" />);
      expect(screen.getByText('Email is invalid')).toBeInTheDocument();
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-danger-500');
    });

    it('displays success state after validation', () => {
      render(<Input success="Email verified" id="email" />);
      expect(screen.getByText('Email verified')).toBeInTheDocument();
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-success-500');
    });

    it('shows warning state with helper text', () => {
      render(<Input helperText="Password should be at least 8 characters" id="pwd" />);
      expect(screen.getByText('Password should be at least 8 characters')).toBeInTheDocument();
    });

    it('applies focus ring for visual feedback', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('focus:ring-2');
    });

    it('maintains visual state during async validation', () => {
      const { rerender } = render(<Input id="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-slate-200');
      
      rerender(<Input id="email" error="Validating..." />);
      expect(screen.getByText('Validating...')).toBeInTheDocument();
    });
  });
});
