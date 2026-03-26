import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Modal from './Modal';

describe('Modal Component', () => {
  afterEach(() => {
    // Clean up - reset body overflow
    document.body.style.overflow = '';
  });

  describe('Rendering', () => {
    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={() => {}}>
          <div>Modal content</div>
        </Modal>
      );
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('renders when isOpen is true', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Modal content</div>
        </Modal>
      );
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('renders with title', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <div>Content</div>
        </Modal>
      );
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
    });

    it('renders close button by default', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      expect(screen.getByLabelText('Tutup modal')).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} showCloseButton={false}>
          <div>Content</div>
        </Modal>
      );
      expect(screen.queryByLabelText('Tutup modal')).not.toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('renders with small size', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="sm">
          <div>Content</div>
        </Modal>
      );
      const modal = screen.getByRole('dialog');
      expect(modal.querySelector('.max-w-sm')).toBeInTheDocument();
    });

    it('renders with medium size by default', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      const modal = screen.getByRole('dialog');
      expect(modal.querySelector('.max-w-md')).toBeInTheDocument();
    });

    it('renders with large size', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="lg">
          <div>Content</div>
        </Modal>
      );
      const modal = screen.getByRole('dialog');
      expect(modal.querySelector('.max-w-lg')).toBeInTheDocument();
    });

    it('renders with extra large size', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="xl">
          <div>Content</div>
        </Modal>
      );
      const modal = screen.getByRole('dialog');
      expect(modal.querySelector('.max-w-xl')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <div>Content</div>
        </Modal>
      );
      
      fireEvent.click(screen.getByLabelText('Tutup modal'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <div>Content</div>
        </Modal>
      );
      
      const overlay = screen.getByRole('dialog');
      fireEvent.click(overlay);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when modal content is clicked', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <div>Content</div>
        </Modal>
      );
      
      fireEvent.click(screen.getByText('Content'));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not close on overlay click when closeOnOverlayClick is false', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} closeOnOverlayClick={false}>
          <div>Content</div>
        </Modal>
      );
      
      const overlay = screen.getByRole('dialog');
      fireEvent.click(overlay);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape key is pressed', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <div>Content</div>
        </Modal>
      );
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on Escape when closeOnEscape is false', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} closeOnEscape={false}>
          <div>Content</div>
        </Modal>
      );
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('Body Scroll Lock', () => {
    it('locks body scroll when modal opens', () => {
      // Reset overflow first
      document.body.style.overflow = '';
      
      const { rerender } = render(
        <Modal isOpen={false} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe('');
      
      rerender(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('unlocks body scroll when modal closes', async () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(
        <Modal isOpen={false} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      await waitFor(() => {
        expect(document.body.style.overflow).toBe('unset');
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper dialog role', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('associates title with dialog using aria-labelledby', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Title">
          <div>Content</div>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(screen.getByText('Test Title')).toHaveAttribute('id', 'modal-title');
    });

    it('focuses modal when opened', async () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        const modalContent = dialog.querySelector('[tabindex="-1"]');
        expect(modalContent).toHaveFocus();
      });
    });

    it('supports keyboard navigation with Escape key', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <div>Content</div>
        </Modal>
      );
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('Overlay', () => {
    it('renders overlay with backdrop blur', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      const overlay = dialog.querySelector('.backdrop-blur-sm');
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('Animation and Transitions (Requirement 16.4)', () => {
    it('applies animation classes when opening', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('animate-in');
    });

    it('applies zoom animation to modal content', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      const modalContent = dialog.querySelector('.animate-in.zoom-in-95');
      expect(modalContent).toBeInTheDocument();
    });

    it('maintains modal visibility during transitions', async () => {
      const { rerender } = render(
        <Modal isOpen={false} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
      
      rerender(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Content')).toBeInTheDocument();
      });
    });

    it('prevents body scroll during modal open', () => {
      document.body.style.overflow = '';
      
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <div>Content</div>
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe('hidden');
    });
  });
});
