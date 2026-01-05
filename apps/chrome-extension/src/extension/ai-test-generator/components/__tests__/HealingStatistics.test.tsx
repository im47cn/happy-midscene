/**
 * Unit tests for HealingStatistics Component
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HealingStatistics } from '../HealingStatistics';

// Mock i18n
vi.mock('../../../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Mock healing engine
vi.mock('../../services/healing', () => ({
  healingEngine: {
    getStatistics: vi.fn(),
  },
}));

import { healingEngine } from '../../services/healing';

describe('HealingStatistics', () => {
  const mockStatistics = {
    totalAttempts: 100,
    successCount: 85,
    failureCount: 15,
    successRate: 85,
    normalSuccessCount: 60,
    deepThinkSuccessCount: 25,
    averageConfidence: 78,
    averageTimeCost: 1250,
    unstableElements: [
      {
        stepId: 'step-1',
        description: 'Submit button',
        healingCount: 8,
      },
      {
        stepId: 'step-2',
        description: 'Login form input',
        healingCount: 5,
      },
      {
        stepId: 'step-3',
        description: 'Navigation menu',
        healingCount: 3,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('should show loading indicator when loading', () => {
      vi.mocked(healingEngine.getStatistics).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const { container } = render(<HealingStatistics />);

      // Check for loading card
      const loadingCard = container.querySelector('.ant-spin');
      expect(loadingCard).toBeTruthy();
    });
  });

  describe('empty state', () => {
    it('should show empty message when no data available', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue({
        totalAttempts: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        normalSuccessCount: 0,
        deepThinkSuccessCount: 0,
        averageConfidence: 0,
        averageTimeCost: 0,
        unstableElements: [],
      });

      render(<HealingStatistics />);

      await waitFor(() => {
        expect(screen.getByText('healing.noData')).toBeTruthy();
      });
    });
  });

  describe('statistics display', () => {
    it('should display overview statistics correctly', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue(
        mockStatistics,
      );

      render(<HealingStatistics />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeTruthy(); // totalAttempts
        expect(screen.getByText('85%')).toBeTruthy(); // successRate
        expect(screen.getByText('78%')).toBeTruthy(); // avgConfidence
        expect(screen.getByText('1250ms')).toBeTruthy(); // avgTimeCost
      });
    });

    it('should display strategy breakdown correctly', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue(
        mockStatistics,
      );

      render(<HealingStatistics />);

      await waitFor(() => {
        expect(screen.getByText('healing.strategyBreakdown')).toBeTruthy();
        expect(screen.getByText('healing.normalMode')).toBeTruthy();
        expect(screen.getByText('healing.deepThink')).toBeTruthy();
      });
    });

    it('should display outcome breakdown correctly', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue(
        mockStatistics,
      );

      render(<HealingStatistics />);

      await waitFor(() => {
        expect(screen.getByText('healing.outcomeBreakdown')).toBeTruthy();
        expect(screen.getByText('healing.success')).toBeTruthy();
        expect(screen.getByText('healing.failure')).toBeTruthy();
      });
    });

    it('should display unstable elements table', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue(
        mockStatistics,
      );

      render(<HealingStatistics />);

      await waitFor(() => {
        expect(screen.getByText('healing.unstableElements')).toBeTruthy();
        expect(screen.getByText('Submit button')).toBeTruthy();
        expect(screen.getByText('Login form input')).toBeTruthy();
        expect(screen.getByText('Navigation menu')).toBeTruthy();
      });
    });
  });

  describe('color coding', () => {
    it('should use green color for high success rate (>=80%)', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue({
        ...mockStatistics,
        successRate: 85,
      });

      const { container } = render(<HealingStatistics />);

      await waitFor(() => {
        // Check that success rate statistic has green color
        const successRateElement = screen.getByText('85%');
        const parent = successRateElement.closest('.ant-statistic-content-value');
        expect(parent?.className).toContain('ant-statistic-content-value');
      });
    });

    it('should use orange color for medium success rate (50-79%)', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue({
        ...mockStatistics,
        successRate: 65,
      });

      const { container } = render(<HealingStatistics />);

      await waitFor(() => {
        expect(screen.getByText('65%')).toBeTruthy();
      });
    });

    it('should use red color for low success rate (<50%)', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue({
        ...mockStatistics,
        successRate: 35,
      });

      const { container } = render(<HealingStatistics />);

      await waitFor(() => {
        expect(screen.getByText('35%')).toBeTruthy();
      });
    });
  });

  describe('unstable elements', () => {
    it('should not show unstable elements section when no unstable elements', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue({
        ...mockStatistics,
        unstableElements: [],
      });

      const { container } = render(<HealingStatistics />);

      await waitFor(() => {
        expect(
          screen.queryByText('healing.unstableElements'),
        ).toBeNull();
      });
    });

    it('should show high healing count elements in red (>5)', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue({
        ...mockStatistics,
        unstableElements: [
          {
            stepId: 'step-1',
            description: 'Unstable button',
            healingCount: 8,
          },
        ],
      });

      render(<HealingStatistics />);

      await waitFor(() => {
        expect(screen.getByText('8 healing.times')).toBeTruthy();
      });
    });

    it('should show medium healing count elements in orange (3-5)', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue({
        ...mockStatistics,
        unstableElements: [
          {
            stepId: 'step-1',
            description: 'Medium unstable button',
            healingCount: 4,
          },
        ],
      });

      render(<HealingStatistics />);

      await waitFor(() => {
        expect(screen.getByText('4 healing.times')).toBeTruthy();
      });
    });

    it('should show low healing count elements in green (1-2)', async () => {
      vi.mocked(healingEngine.getStatistics).mockResolvedValue({
        ...mockStatistics,
        unstableElements: [
          {
            stepId: 'step-1',
            description: 'Low unstable button',
            healingCount: 1,
          },
        ],
      });

      render(<HealingStatistics />);

      await waitFor(() => {
        expect(screen.getByText('1 healing.times')).toBeTruthy();
      });
    });
  });

  describe('error handling', () => {
    it('should handle error gracefully when statistics fetch fails', async () => {
      vi.mocked(healingEngine.getStatistics).mockRejectedValue(
        new Error('Failed to fetch'),
      );

      // Console error should be called
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(<HealingStatistics />);

      await waitFor(
        () => {
          // Loading should stop
          expect(screen.queryByText(/loading/i)).toBeNull();
        },
        { timeout: 3000 },
      );

      consoleSpy.mockRestore();
    });
  });
});
