import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastProvider,
  ToastViewport,
  variantIcons,
} from '@/components/ui/toast';

describe('Toast Components', () => {
  describe('Toast', () => {
    it('renders with default variant', () => {
      render(
        <ToastProvider>
          <Toast data-testid="toast">
            <ToastTitle>Test Title</ToastTitle>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toBeInTheDocument();
    });

    it('renders with success variant', () => {
      render(
        <ToastProvider>
          <Toast variant="success" data-testid="toast">
            <ToastTitle>Success</ToastTitle>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('border-green-200');
    });

    it('renders with error variant', () => {
      render(
        <ToastProvider>
          <Toast variant="error" data-testid="toast">
            <ToastTitle>Error</ToastTitle>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('border-red-200');
    });

    it('renders with warning variant', () => {
      render(
        <ToastProvider>
          <Toast variant="warning" data-testid="toast">
            <ToastTitle>Warning</ToastTitle>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('border-yellow-200');
    });

    it('renders with info variant', () => {
      render(
        <ToastProvider>
          <Toast variant="info" data-testid="toast">
            <ToastTitle>Info</ToastTitle>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('border-blue-200');
    });
  });

  describe('ToastTitle', () => {
    it('renders title text', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastTitle>My Toast Title</ToastTitle>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      expect(screen.getByText('My Toast Title')).toBeInTheDocument();
    });
  });

  describe('ToastDescription', () => {
    it('renders description text', () => {
      render(
        <ToastProvider>
          <Toast>
            <ToastDescription>My description text</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      expect(screen.getByText('My description text')).toBeInTheDocument();
    });
  });

  describe('variantIcons', () => {
    it('has icons for all variants', () => {
      expect(variantIcons.default).toBeNull();
      expect(variantIcons.success).toBeDefined();
      expect(variantIcons.error).toBeDefined();
      expect(variantIcons.warning).toBeDefined();
      expect(variantIcons.info).toBeDefined();
    });
  });
});
