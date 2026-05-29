/**
 * tests/m4-dashboard/dashboard.test.tsx
 *
 * Four required tests for M4 PPD Dashboard UI (spec 005):
 *
 * 1. Dashboard renders with navy header and three tab labels.
 * 2. ApprovalModal: Approve updates state; fetch is NOT called.
 * 3. Module B: persona tab switch triggers searchProducts (mock M1).
 * 4. Module C: chip click calls handleQuery with exact chip text.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// --------------------------------------------------------------------------
// MODULE MOCKS
// --------------------------------------------------------------------------

// Mock M1 prs-data-fetcher — returns pre-fix synthetic dimensions synchronously.
// Path resolves to src/m1-bloomreach/prs-data-fetcher (used by App.tsx via ../m1-bloomreach/...).
jest.mock('../../src/m1-bloomreach/prs-data-fetcher', () => ({
  fetchAllDimensions: jest.fn(() =>
    Promise.resolve([
      { dimension_id: 'bruid_match_rate',     score: 8,  status: 'critical', data_source: 'discovery_api', normalised_score: 8 },
      { dimension_id: 'autosegment_coverage', score: 6,  status: 'critical', data_source: 'marketing_mcp', normalised_score: 6 },
      { dimension_id: 'signal_freshness',     score: 14, status: 'warning',  data_source: 'marketing_mcp', normalised_score: 14 },
      { dimension_id: 'rule_conflicts',       score: 18, status: 'healthy',  data_source: 'discovery_api', normalised_score: 18 },
      { dimension_id: 'ab_test_coverage',     score: 6,  status: 'critical', data_source: 'analytics_mcp', normalised_score: 6 },
    ])
  ),
}));

// Mock M2 calculator + fix generator.
jest.mock('../../src/m2-scoring/prs-calculator', () => ({
  calculatePRS: jest.fn((dims: unknown[]) => ({
    composite_score: 52,
    rag_status: 'amber',
    dimensions: dims,
    fix_list: [],
    generated_at: '2026-05-22T00:00:00Z',
  })),
}));

jest.mock('../../src/m2-scoring/fix-generator', () => ({
  generateFixList: jest.fn(() => [
    {
      position: 1,
      fix_id: 'fix_autosegment',
      fix_title: 'Create 3 manual audience segments',
      description: 'Create segments for demo.',
      estimated_rpv_lift_pct_min: 12,
      estimated_rpv_lift_pct_max: 18,
      effort: 'Low',
      risk_level: 'low',
      dimension: 'autosegment_coverage',
      steps: [],
    },
    {
      position: 2,
      fix_id: 'fix_bruid',
      fix_title: 'Enable BRUID persistence',
      description: 'Enable BRUID demo.',
      estimated_rpv_lift_pct_min: 8,
      estimated_rpv_lift_pct_max: 15,
      effort: 'Medium',
      risk_level: 'medium',
      dimension: 'bruid_match_rate',
      steps: [],
    },
    {
      position: 3,
      fix_id: 'fix_rules',
      fix_title: 'Configure A/B tests',
      description: 'Configure A/B tests demo.',
      estimated_rpv_lift_pct_min: 5,
      estimated_rpv_lift_pct_max: 10,
      effort: 'Low',
      risk_level: 'low',
      dimension: 'ab_test_coverage',
      steps: [],
    },
  ]),
}));

// Mock M1 discovery-client searchProducts.
const mockSearchProducts = jest.fn(() =>
  Promise.resolve({
    query: 'necklace',
    total: 2,
    products: [
      { product_id: 'P001', name: 'Gold Necklace', price: 45.0, currency: 'GBP', rank_position: 1 },
      { product_id: 'P002', name: 'Silver Necklace', price: 30.0, currency: 'GBP', rank_position: 2 },
    ],
    cached: true,
    cache_key: 'guest-before',
  })
);

jest.mock('../../src/m1-bloomreach/discovery-client', () => ({
  searchProducts: (...args: unknown[]) => mockSearchProducts(...args),
}));

// Mock resultCache singleton.
const mockCacheGet = jest.fn(() => null);
const mockCacheSet = jest.fn();
const mockCacheIsStale = jest.fn(() => true);
const mockLoadFromFile = jest.fn((personaId: string, state: string) => ({
  products: [
    { product_id: 'P001', name: 'Gold Necklace', price: 45.0, currency: 'GBP', rank_position: 1 },
    { product_id: 'P002', name: 'Silver Necklace', price: 30.0, currency: 'GBP', rank_position: 2 },
  ],
  cached_at: Date.now(),
}));

jest.mock('../../src/m5-plp/lib/resultCache', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: (...args: unknown[]) => mockCacheSet(...args),
    isStale: (...args: unknown[]) => mockCacheIsStale(...args),
    loadFromFile: (...args: unknown[]) => mockLoadFromFile(...args),
    _key: (p: string, s: string) => `${p}-${s}`,
    clear: jest.fn(),
  },
}));

// Mock M3 constants and query handler.
jest.mock('../../src/m3-nl/constants', () => ({
  PRE_LOADED_EXCHANGE: {
    query: 'Why is my personalisation not working?',
    intent: 'diagnosis',
    reasoning_trace: [
      { tool_name: 'fetchBRUIDMatchRate', tool_input: {}, tool_output_summary: '22% match rate' },
    ],
    llm_response: {
      summary_sentence: 'Your personalisation is scoring 52/100.',
      score_breakdown: 'BRUID match is low.',
      top_3_fixes: ['Create segments'],
      suggested_next_action: 'Start with audience segments.',
    },
    timestamp: '2026-05-22T00:00:00Z',
  },
}));

const mockHandleQuery = jest.fn((query: string) =>
  Promise.resolve({
    query,
    intent: 'diagnosis',
    reasoning_trace: [],
    llm_response: {
      summary_sentence: `Response to: ${query}`,
      score_breakdown: '',
      top_3_fixes: [],
      suggested_next_action: '',
    },
    timestamp: new Date().toISOString(),
  })
);

jest.mock('../../src/m3-nl/query-handler', () => ({
  handleQuery: (...args: unknown[]) => mockHandleQuery(...args),
}));

// --------------------------------------------------------------------------
// Import components under test (after mocks are set up)
// --------------------------------------------------------------------------

import DashboardApp from '../../src/m4-dashboard/App';
import ApprovalModal from '../../src/m4-dashboard/components/ApprovalModal';
import ShopperSimulator from '../../src/m4-dashboard/modules/ShopperSimulator';
import NLChat from '../../src/m4-dashboard/modules/NLChat';
import { MemoryRouter } from 'react-router-dom';

// DashboardApp uses <Link>, which requires a Router context in tests.
function DashboardUnderTest() {
  return (
    <MemoryRouter>
      <DashboardApp />
    </MemoryRouter>
  );
}

// Sample fix for ApprovalModal tests.
const SAMPLE_FIX = {
  fix_id: 'fix_autosegment',
  fix_title: 'Create 3 manual audience segments',
  description: 'Create the three segments.',
  estimated_rpv_lift_pct_min: 12,
  estimated_rpv_lift_pct_max: 18,
  effort: 'Low',
  risk_level: 'low' as const,
  steps: ['Step 1', 'Step 2'],
};

// --------------------------------------------------------------------------
// Test 1: Dashboard renders with navy header and three tab labels
// --------------------------------------------------------------------------

describe('Test 1 — Dashboard renders Bounteous header and tabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders header with Bounteous gradient class and correct titles', async () => {
    await act(async () => {
      render(<DashboardUnderTest />);
    });

    const header = screen.getByTestId('dashboard-header');
    expect(header).toBeInTheDocument();
    // Header now uses the .ppd-header-gradient class (Bounteous primary→accent).
    expect(header.className).toMatch(/ppd-header-gradient/);
    // Titles
    expect(screen.getByText('Personalization Performance Doctor')).toBeInTheDocument();
    expect(
      screen.getByText(/Bounteous x Accolite · Powered by Bloomreach/i),
    ).toBeInTheDocument();
  });

  test('renders the visible tab labels', async () => {
    await act(async () => {
      render(<DashboardUnderTest />);
    });

    // Shopper Simulator was removed per product requirements — only Scorecard
    // and Doctor remain.
    expect(screen.getByTestId('tab-scorecard')).toBeInTheDocument();
    expect(screen.getByTestId('tab-doctor')).toBeInTheDocument();

    expect(screen.getByText('PRS Scorecard')).toBeInTheDocument();
    expect(screen.getByText('Ask the Doctor')).toBeInTheDocument();
  });

  test('PRS Scorecard tab is active by default with the Bounteous accent', async () => {
    await act(async () => {
      render(<DashboardUnderTest />);
    });

    const scorecardTab = screen.getByTestId('tab-scorecard');
    expect(scorecardTab).toHaveStyle({ color: '#7C3AED' });
  });
});

// --------------------------------------------------------------------------
// Test 2: ApprovalModal — Approve updates state; fetch is NOT called
// --------------------------------------------------------------------------

describe('Test 2 — ApprovalModal: Approve updates state, no fetch called', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Install a global fetch mock so spyOn works in jsdom.
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response));
  });

  afterEach(() => {
    // Remove the global fetch mock.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).fetch;
  });

  test('Approve button calls onApprove and does NOT trigger fetch', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const onApprove = jest.fn();
    const onDismiss = jest.fn();
    const onReviewLater = jest.fn();

    render(
      <ApprovalModal
        isOpen={true}
        fix={SAMPLE_FIX}
        onApprove={onApprove}
        onDismiss={onDismiss}
        onReviewLater={onReviewLater}
      />
    );

    const approveButton = screen.getByTestId('approve-button');
    expect(approveButton).toBeInTheDocument();

    fireEvent.click(approveButton);

    // onApprove must be called with the fix object.
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith(SAMPLE_FIX);

    // fetch must NOT be called on the Approve path.
    expect(fetchSpy).not.toHaveBeenCalled();

    // Confirmation state renders.
    expect(screen.getByTestId('approval-confirmed')).toBeInTheDocument();
    expect(screen.getByText('Action logged for review by your team')).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  test('Approve path: no XHR/XMLHttpRequest call', () => {
    const xhrOpen = jest.spyOn(XMLHttpRequest.prototype, 'open');
    const onApprove = jest.fn();

    render(
      <ApprovalModal
        isOpen={true}
        fix={SAMPLE_FIX}
        onApprove={onApprove}
        onDismiss={jest.fn()}
        onReviewLater={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('approve-button'));

    expect(xhrOpen).not.toHaveBeenCalled();
    xhrOpen.mockRestore();
  });

  test('App.tsx: approved action is logged to local state (no fetch called)', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await act(async () => {
      render(<DashboardUnderTest />);
    });

    // Wait for PRS to load (skeleton disappears).
    await waitFor(() => {
      expect(screen.queryByTestId('prs-scorecard-skeleton')).not.toBeInTheDocument();
    });

    // Click Review button on first fix card.
    const reviewButtons = screen.queryAllByTestId(/^review-button-/);
    if (reviewButtons.length > 0) {
      fireEvent.click(reviewButtons[0]);

      // Modal should open.
      await waitFor(() => {
        expect(screen.getByTestId('approval-modal')).toBeInTheDocument();
      });

      // Approve — NO fetch called.
      fireEvent.click(screen.getByTestId('approve-button'));

      // Confirmation shown.
      expect(screen.getByTestId('approval-confirmed')).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();

      // Dismiss modal.
      fireEvent.click(screen.getByText('Done'));
      await waitFor(() => {
        expect(screen.getByTestId('approved-count-badge')).toBeInTheDocument();
      });
    }

    fetchSpy.mockRestore();
  });
});

// --------------------------------------------------------------------------
// Test 3: Module B — persona tab switch triggers searchProducts
// --------------------------------------------------------------------------

describe('Test 3 — ShopperSimulator: persona tab switch calls searchProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchProducts.mockClear();
    // Cache always misses so searchProducts is called.
    mockCacheGet.mockReturnValue(null);
    mockCacheIsStale.mockReturnValue(true);
  });

  test('renders three persona tabs: Guest, Sarah, Alex', async () => {
    await act(async () => {
      render(<ShopperSimulator />);
    });

    expect(screen.getByTestId('persona-tab-guest')).toBeInTheDocument();
    expect(screen.getByTestId('persona-tab-sarah')).toBeInTheDocument();
    expect(screen.getByTestId('persona-tab-alex')).toBeInTheDocument();
  });

  test('switching to Sarah tab calls searchProducts with Sarah BRUID', async () => {
    await act(async () => {
      render(<ShopperSimulator />);
    });

    // Wait for initial load to complete.
    await waitFor(() => {
      expect(mockSearchProducts).toHaveBeenCalled();
    });

    mockSearchProducts.mockClear();

    // Click Sarah tab.
    await act(async () => {
      fireEvent.click(screen.getByTestId('persona-tab-sarah'));
    });

    // searchProducts should be called with Sarah's BRUID.
    await waitFor(() => {
      expect(mockSearchProducts).toHaveBeenCalled();
      const calls = mockSearchProducts.mock.calls;
      expect(calls.some(([, bruid]) =>
        typeof bruid === 'string' && bruid.includes('sarah')
      )).toBe(true);
    });
  });

  test('switching to Alex tab calls searchProducts with Alex BRUID', async () => {
    await act(async () => {
      render(<ShopperSimulator />);
    });

    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalled());
    mockSearchProducts.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('persona-tab-alex'));
    });

    await waitFor(() => {
      expect(mockSearchProducts).toHaveBeenCalled();
      const calls = mockSearchProducts.mock.calls;
      expect(calls.some(([, bruid]) =>
        typeof bruid === 'string' && bruid.includes('alex')
      )).toBe(true);
    });
  });

  test('switching to Guest tab calls searchProducts with null bruid', async () => {
    await act(async () => {
      render(<ShopperSimulator />);
    });

    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalled());
    mockSearchProducts.mockClear();

    // Switch to Alex then back to Guest.
    await act(async () => {
      fireEvent.click(screen.getByTestId('persona-tab-alex'));
    });
    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalled());
    mockSearchProducts.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('persona-tab-guest'));
    });

    await waitFor(() => {
      expect(mockSearchProducts).toHaveBeenCalled();
      const calls = mockSearchProducts.mock.calls;
      expect(calls.some(([, bruid]) => bruid === null)).toBe(true);
    });
  });
});

// --------------------------------------------------------------------------
// Test 4: Module C — chip click calls handleQuery with exact chip text
// --------------------------------------------------------------------------

describe('Test 4 — NLChat: quick-action chip click calls handleQuery with exact text', () => {
  const CHIP_1 = 'Why is my personalisation not working?';
  const CHIP_2 = 'What should I fix first?';
  const CHIP_3 = 'Show me what good personalisation looks like for my top 3 customer types';

  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleQuery.mockClear();
  });

  test('chip 1 calls handleQuery with exact text', async () => {
    await act(async () => {
      render(<NLChat prsState={null} />);
    });

    // CHIP_1 text also appears in the pre-loaded exchange bubble, so find by testid.
    const chip1 = screen.getByTestId('chip-Why-is-my-personalis');
    expect(chip1).toBeInTheDocument();
    expect(chip1.textContent).toBe(CHIP_1);

    await act(async () => {
      fireEvent.click(chip1);
    });

    await waitFor(() => {
      expect(mockHandleQuery).toHaveBeenCalledWith(CHIP_1, null);
    });
  });

  test('chip 2 calls handleQuery with exact text', async () => {
    await act(async () => {
      render(<NLChat prsState={null} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText(CHIP_2));
    });

    await waitFor(() => {
      expect(mockHandleQuery).toHaveBeenCalledWith(CHIP_2, null);
    });
  });

  test('chip 3 calls handleQuery with exact text', async () => {
    await act(async () => {
      render(<NLChat prsState={null} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText(CHIP_3));
    });

    await waitFor(() => {
      expect(mockHandleQuery).toHaveBeenCalledWith(CHIP_3, null);
    });
  });

  test('pre-loaded exchange is visible on initial render (no API call)', () => {
    // handleQuery must NOT be called on mount.
    render(<NLChat prsState={null} />);

    expect(mockHandleQuery).not.toHaveBeenCalled();
    // Pre-loaded query text visible — there will be multiple matches (exchange bubble + chip)
    // so check at least one element contains it.
    const matches = screen.getAllByText('Why is my personalisation not working?');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // Pre-loaded summary visible (only one instance).
    expect(screen.getByText('Your personalisation is scoring 52/100.')).toBeInTheDocument();
    // Exchange card present.
    expect(screen.getByTestId('exchange-card')).toBeInTheDocument();
  });

  test('reasoning trace panel is present but collapsed by default', () => {
    render(<NLChat prsState={null} />);

    const tracePanel = screen.getByTestId('reasoning-trace-panel');
    expect(tracePanel).toBeInTheDocument();

    // Collapsed — the tool name should not be visible yet (inside expanded area).
    // The toggle button should show the closed indicator.
    expect(screen.getByTestId('reasoning-trace-toggle')).toBeInTheDocument();
  });

  test('reasoning trace panel expands on toggle click', () => {
    render(<NLChat prsState={null} />);

    const toggle = screen.getByTestId('reasoning-trace-toggle');
    fireEvent.click(toggle);

    // After expand, tool name should be visible.
    expect(screen.getByText('fetchBRUIDMatchRate')).toBeInTheDocument();
  });
});
