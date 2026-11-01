import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ProfileListingCard from '@/pages/profile/ProfileListingCard';

const listing = (overrides) => ({
  id: 'sale-1', title: 'Moving sale', address: '25 Moorabool Street', suburb: 'Geelong', start_date: '2026-11-07', ...overrides,
});

const renderCard = (overrides) => render(
  <MemoryRouter>
    <ProfileListingCard listing={listing(overrides)} onDelete={() => {}} onPrint={() => {}} />
  </MemoryRouter>
);

describe('ProfileListingCard', () => {
  it('tells the seller why their listing was rejected', () => {
    renderCard({ status: 'rejected', rejection_reason: 'Please remove the price list photo' });
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Please remove the price list photo')).toBeInTheDocument();
  });

  it('shows no rejection reason on other listings', () => {
    renderCard({ status: 'active', rejection_reason: 'Old reason' });
    expect(screen.queryByText('Old reason')).not.toBeInTheDocument();
  });
});
