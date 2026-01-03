/**
 * StateDisplay Components Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  LoadingState,
  ErrorState,
  EmptyState,
  StateDisplay,
} from '../StateDisplay';

describe('LoadingState', () => {
  it('should render spinner by default', () => {
    render(<LoadingState />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render custom loading text', () => {
    render(<LoadingState text="Fetching templates..." />);

    expect(screen.getByText('Fetching templates...')).toBeInTheDocument();
  });

  it('should render skeleton type', () => {
    render(<LoadingState type="skeleton" rows={4} />);

    // Skeleton renders animated placeholder elements
    const skeletons = document.querySelectorAll('.ant-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render inline type', () => {
    render(<LoadingState type="inline" text="Loading inline..." />);

    expect(screen.getByText('Loading inline...')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('should render default error message', () => {
    render(<ErrorState />);

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
  });

  it('should render network error type', () => {
    render(<ErrorState type="network" />);

    expect(screen.getByText('Network Error')).toBeInTheDocument();
    expect(screen.getByText(/Unable to connect/)).toBeInTheDocument();
  });

  it('should render notFound error type', () => {
    render(<ErrorState type="notFound" />);

    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });

  it('should render permission error type', () => {
    render(<ErrorState type="permission" />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('should render server error type', () => {
    render(<ErrorState type="server" />);

    expect(screen.getByText('Server Error')).toBeInTheDocument();
  });

  it('should render custom title and message', () => {
    render(
      <ErrorState
        title="Custom Error"
        message="Custom error message"
      />
    );

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should render retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /Try Again/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should not render retry button when onRetry is not provided', () => {
    render(<ErrorState />);

    expect(screen.queryByRole('button', { name: /Try Again/i })).not.toBeInTheDocument();
  });

  it('should show error details when showDetails is true', () => {
    const error = new Error('Detailed error message');
    error.name = 'TestError';

    render(<ErrorState error={error} showDetails />);

    expect(screen.getByText('TestError')).toBeInTheDocument();
    expect(screen.getByText('Detailed error message')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('should render default empty state', () => {
    render(<EmptyState />);

    expect(screen.getByText('No Data')).toBeInTheDocument();
  });

  it('should render search empty state', () => {
    render(<EmptyState type="search" />);

    expect(screen.getByText('No Results Found')).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search/)).toBeInTheDocument();
  });

  it('should render favorites empty state', () => {
    render(<EmptyState type="favorites" />);

    expect(screen.getByText('No Favorites Yet')).toBeInTheDocument();
  });

  it('should render history empty state', () => {
    render(<EmptyState type="history" />);

    expect(screen.getByText('No History')).toBeInTheDocument();
  });

  it('should render templates empty state', () => {
    render(<EmptyState type="templates" />);

    expect(screen.getByText('No Templates')).toBeInTheDocument();
  });

  it('should render custom title and description', () => {
    render(
      <EmptyState
        title="Custom Title"
        description="Custom description"
      />
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom description')).toBeInTheDocument();
  });

  it('should render action when provided', () => {
    render(
      <EmptyState action={<button>Add Template</button>} />
    );

    expect(screen.getByRole('button', { name: /Add Template/i })).toBeInTheDocument();
  });
});

describe('StateDisplay', () => {
  it('should render children when no state flags are set', () => {
    render(
      <StateDisplay>
        <div>Content</div>
      </StateDisplay>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should render loading state when loading is true', () => {
    render(
      <StateDisplay loading loadingText="Loading...">
        <div>Content</div>
      </StateDisplay>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render error state when error is provided', () => {
    const error = new Error('Test error');
    render(
      <StateDisplay error={error} errorType="server">
        <div>Content</div>
      </StateDisplay>
    );

    expect(screen.getByText('Server Error')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render empty state when empty is true', () => {
    render(
      <StateDisplay empty emptyType="search">
        <div>Content</div>
      </StateDisplay>
    );

    expect(screen.getByText('No Results Found')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should prioritize loading over error and empty', () => {
    const error = new Error('Test error');
    render(
      <StateDisplay loading error={error} empty>
        <div>Content</div>
      </StateDisplay>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should prioritize error over empty', () => {
    const error = new Error('Test error');
    render(
      <StateDisplay error={error} empty>
        <div>Content</div>
      </StateDisplay>
    );

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    const error = new Error('Test error');

    render(
      <StateDisplay error={error} onRetry={onRetry}>
        <div>Content</div>
      </StateDisplay>
    );

    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should render emptyAction in empty state', () => {
    render(
      <StateDisplay empty emptyAction={<button>Create New</button>}>
        <div>Content</div>
      </StateDisplay>
    );

    expect(screen.getByRole('button', { name: /Create New/i })).toBeInTheDocument();
  });
});
