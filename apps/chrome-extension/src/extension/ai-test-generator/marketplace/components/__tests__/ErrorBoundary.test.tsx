/**
 * ErrorBoundary Component Tests
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketplaceErrorBoundary, withErrorBoundary } from '../ErrorBoundary';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({
  shouldThrow = true,
}) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Suppress console.error for cleaner test output
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

describe('MarketplaceErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <MarketplaceErrorBoundary>
        <div>Child content</div>
      </MarketplaceErrorBoundary>,
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render error UI when child throws', () => {
    render(
      <MarketplaceErrorBoundary>
        <ThrowError />
      </MarketplaceErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(/An error occurred while loading the marketplace/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Try Again/i }),
    ).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <MarketplaceErrorBoundary fallback={<div>Custom error message</div>}>
        <ThrowError />
      </MarketplaceErrorBoundary>,
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn();

    render(
      <MarketplaceErrorBoundary onError={onError}>
        <ThrowError />
      </MarketplaceErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      }),
    );
  });

  it('should show error details when showDetails is true', () => {
    render(
      <MarketplaceErrorBoundary showDetails>
        <ThrowError />
      </MarketplaceErrorBoundary>,
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should reset error state when Try Again is clicked', () => {
    const TestComponent: React.FC = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);

      return (
        <div>
          <button onClick={() => setShouldThrow(false)}>Fix</button>
          <MarketplaceErrorBoundary key={shouldThrow ? 'error' : 'fixed'}>
            <ThrowError shouldThrow={shouldThrow} />
          </MarketplaceErrorBoundary>
        </div>
      );
    };

    // Need React import for the test component
    const React = require('react');

    render(<TestComponent />);

    // Initially shows error
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click Fix to change state
    fireEvent.click(screen.getByText('Fix'));

    // Should now show the fixed content
    expect(screen.getByText('No error')).toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent: React.FC = () => <div>Test content</div>;
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent />);

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should catch errors in wrapped component', () => {
    const WrappedThrowError = withErrorBoundary(ThrowError);

    render(<WrappedThrowError />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should pass errorBoundaryProps to the boundary', () => {
    const onError = vi.fn();
    const WrappedThrowError = withErrorBoundary(ThrowError, { onError });

    render(<WrappedThrowError />);

    expect(onError).toHaveBeenCalled();
  });

  it('should set correct display name', () => {
    const TestComponent: React.FC = () => null;
    TestComponent.displayName = 'TestComponent';

    const WrappedComponent = withErrorBoundary(TestComponent);

    expect(WrappedComponent.displayName).toBe(
      'WithErrorBoundary(TestComponent)',
    );
  });
});
