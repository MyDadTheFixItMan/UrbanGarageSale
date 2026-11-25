import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { firebase } from '@/api/firebaseClient';
import ReportListing, { reportMessage, REPORT_REASONS } from '@/components/listings/ReportListing';

jest.mock('@/api/firebaseClient', () => ({
  firebase: { entities: { ContactMessage: { create: jest.fn() } } },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }) => <div>{children}</div>;
  const Dialog = ({ open, children }) => (open ? <div>{children}</div> : null);
  return { Dialog, DialogContent: Pass, DialogDescription: Pass, DialogFooter: Pass, DialogHeader: Pass, DialogTitle: Pass };
});

const listing = { id: 'sale-1', title: 'Big sale', suburb: 'Ocean Grove', state: 'VIC', postcode: '3226', user_id: 'seller' };
const buyer = { id: 'buyer', email: 'b@x.test', full_name: 'Bea' };

const renderIt = (props) => render(<MemoryRouter><ReportListing listing={listing} {...props} /></MemoryRouter>);

beforeEach(() => jest.clearAllMocks());

test('visitors are asked to sign in to report', () => {
  renderIt({ user: null });
  expect(screen.getByRole('link', { name: /sign in to report it/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /report this listing/i })).not.toBeInTheDocument();
});

test('sellers do not see the report link on their own listing', () => {
  const { container } = renderIt({ user: { id: 'seller', email: 's@x.test' } });
  expect(container).toBeEmptyDOMElement();
});

test('a reason is required', async () => {
  renderIt({ user: buyer });
  await userEvent.click(screen.getByRole('button', { name: /report this listing/i }));
  await userEvent.click(screen.getByRole('button', { name: /send report/i }));
  expect(toast.error).toHaveBeenCalledWith('Please choose a reason.');
  expect(firebase.entities.ContactMessage.create).not.toHaveBeenCalled();
});

test('a report is sent as a contact message an admin can act on', async () => {
  firebase.entities.ContactMessage.create.mockResolvedValue({ id: 'm1' });
  renderIt({ user: buyer });
  await userEvent.click(screen.getByRole('button', { name: /report this listing/i }));
  await userEvent.click(screen.getByRole('radio', { name: REPORT_REASONS[0] }));
  await userEvent.type(screen.getByRole("textbox"), 'Asked for a deposit by bank transfer');
  await userEvent.click(screen.getByRole('button', { name: /send report/i }));

  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  const sent = firebase.entities.ContactMessage.create.mock.calls[0][0];
  expect(sent.name).toBe('Bea');
  expect(sent.message).toContain('LISTING REPORT');
  expect(sent.message).toContain('Reason: Scam or fraud');
  expect(sent.message).toContain('Listing ID: sale-1');
  expect(sent.message).toContain('/ListingDetails?id=sale-1');
  expect(sent.message).toContain('Asked for a deposit by bank transfer');
  expect(screen.queryByRole('button', { name: /send report/i })).not.toBeInTheDocument();
});

test('errors from sending (rate limit, unverified email) are shown and the dialog stays open', async () => {
  firebase.entities.ContactMessage.create.mockRejectedValue(new Error('Please wait a minute before sending another message.'));
  renderIt({ user: buyer });
  await userEvent.click(screen.getByRole('button', { name: /report this listing/i }));
  await userEvent.click(screen.getByRole('radio', { name: REPORT_REASONS[1] }));
  await userEvent.click(screen.getByRole('button', { name: /send report/i }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Please wait a minute before sending another message.'));
  expect(screen.getByRole('button', { name: /send report/i })).toBeEnabled();
});

test('the report message fits the contact message size limit', () => {
  const msg = reportMessage({ ...listing, title: 'x'.repeat(200) }, REPORT_REASONS[4], 'y'.repeat(1000), 'https://www.urbangaragesales.com.au');
  expect(msg.length).toBeLessThanOrEqual(4000);
});
