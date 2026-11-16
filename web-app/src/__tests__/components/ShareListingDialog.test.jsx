import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { createShareFlyer } from '@/lib/shareFlyer';
import ShareListingDialog from '@/components/listings/ShareListingDialog';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
// The flyer is drawn on a canvas, which jsdom doesn't have.
jest.mock('@/lib/shareFlyer', () => ({ createShareFlyer: jest.fn() }));
jest.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }) => <div>{children}</div>;
  const Dialog = ({ open, children }) => (open ? <div>{children}</div> : null);
  return { Dialog, DialogContent: Pass, DialogDescription: Pass, DialogHeader: Pass, DialogTitle: Pass };
});

// The seller's own listing, with the street address that must never be shared.
const listing = {
  id: 'sale-1',
  title: 'Huge moving sale',
  sale_type: 'moving_sale',
  address: '12 Secret St',
  suburb: 'Brunswick',
  state: 'VIC',
  start_date: '2026-11-21',
  end_date: '2026-11-22',
  start_time: '08:00',
  end_time: '14:00',
};
const linkFor = (channel) => `http://localhost/ListingDetails?id=sale-1&utm_source=${channel}&utm_medium=share`;
const flyerFile = new File(['jpg'], 'moving-sale-brunswick.jpg', { type: 'image/jpeg' });

const setNavigator = (key, value) => Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
const renderDialog = (props = {}) => render(<ShareListingDialog listing={listing} open onOpenChange={() => {}} {...props} />);

beforeEach(() => {
  jest.clearAllMocks();
  setNavigator('clipboard', { writeText: jest.fn().mockResolvedValue(undefined) });
  URL.createObjectURL = jest.fn(() => 'blob:flyer');
  URL.revokeObjectURL = jest.fn();
  createShareFlyer.mockResolvedValue(flyerFile);
});

afterEach(() => {
  delete navigator.share;
  delete navigator.canShare;
  delete navigator.clipboard;
});

describe('ShareListingDialog link', () => {
  it("shares the link through the device's share sheet", async () => {
    setNavigator('share', jest.fn().mockResolvedValue(undefined));
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Share link' }));
    expect(navigator.share).toHaveBeenCalledWith({
      title: 'Huge moving sale',
      text: 'Moving Sale in Brunswick VIC · Sat 21st to Sun 22nd Nov · 8am–2pm',
      url: linkFor('share_sheet'),
    });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('copies the link instead when the browser refuses to share', async () => {
    setNavigator('share', jest.fn().mockRejectedValue(Object.assign(new Error('Refused'), { name: 'NotAllowedError' })));
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Share link' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(linkFor('copy_link')));
    expect(toast.success).toHaveBeenCalledWith('Link copied');
  });

  it('does nothing more when the person closes the share sheet', async () => {
    setNavigator('share', jest.fn().mockRejectedValue(Object.assign(new Error('Cancelled'), { name: 'AbortError' })));
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Share link' }));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("leaves out the share sheet button where the device has none, but can still copy the link", async () => {
    renderDialog();
    expect(screen.queryByRole('button', { name: 'Share link' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /copy link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(linkFor('copy_link'));
    expect(screen.getByRole('textbox', { name: 'Link to this sale' })).toHaveValue(linkFor('copy_link'));
  });

  it("says so when the link can't be copied", async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('Denied'));
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: /copy link/i }));
    expect(toast.error).toHaveBeenCalled();
  });

  it('links to Facebook, WhatsApp and email, each tagged with how it was shared', () => {
    renderDialog();
    expect(screen.getByRole('link', { name: /facebook/i }))
      .toHaveAttribute('href', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(linkFor('facebook'))}`);
    expect(new URL(screen.getByRole('link', { name: /whatsapp/i }).getAttribute('href')).searchParams.get('text'))
      .toContain(linkFor('whatsapp'));
    expect(new URL(screen.getByRole('link', { name: /email/i }).getAttribute('href')).searchParams.get('body'))
      .toContain(linkFor('email'));
  });
});

describe('ShareListingDialog for sellers', () => {
  it('offers the flyer and post text only to sellers promoting their sale', async () => {
    const { unmount } = renderDialog();
    expect(screen.queryByText('Flyer for Instagram')).not.toBeInTheDocument();
    expect(screen.queryByText('Words for your post')).not.toBeInTheDocument();
    expect(createShareFlyer).not.toHaveBeenCalled();
    unmount();

    renderDialog({ promote: true });
    expect(screen.getByText('Flyer for Instagram')).toBeInTheDocument();
    expect(screen.getByText('Words for your post')).toBeInTheDocument();
    await screen.findByRole('img', { name: 'Flyer for Huge moving sale' });
  });

  it('shares the flyer as an image where the device can', async () => {
    setNavigator('share', jest.fn().mockResolvedValue(undefined));
    setNavigator('canShare', jest.fn(() => true));
    renderDialog({ promote: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Share image' }));
    expect(navigator.share).toHaveBeenCalledWith({ files: [flyerFile] });
  });

  it('lets the flyer be saved where the device can only share links', async () => {
    setNavigator('share', jest.fn());
    setNavigator('canShare', jest.fn(() => false));
    renderDialog({ promote: true });
    const save = await screen.findByRole('link', { name: /save image/i });
    expect(save).toHaveAttribute('href', 'blob:flyer');
    expect(save).toHaveAttribute('download', 'moving-sale-brunswick.jpg');
    expect(screen.queryByRole('button', { name: 'Share image' })).not.toBeInTheDocument();
  });

  it("explains when the flyer can't be made", async () => {
    createShareFlyer.mockResolvedValue(null);
    renderDialog({ promote: true });
    expect(await screen.findByText(/couldn't make the flyer/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /save image/i })).not.toBeInTheDocument();
  });

  it('copies ready-made words for a post', async () => {
    renderDialog({ promote: true });
    await userEvent.click(screen.getByRole('button', { name: /copy text/i }));
    const text = navigator.clipboard.writeText.mock.calls[0][0];
    expect(text).toContain('Moving Sale in Brunswick VIC');
    expect(text).toContain(linkFor('post_text'));
    expect(toast.success).toHaveBeenCalledWith('Post text copied');
  });

  it('never shows or shares the street address', async () => {
    renderDialog({ promote: true });
    await screen.findByRole('img', { name: 'Flyer for Huge moving sale' });
    expect(document.body.textContent).not.toMatch(/Secret/);
    for (const link of screen.getAllByRole('link')) {
      expect(decodeURIComponent(link.getAttribute('href'))).not.toMatch(/Secret/);
    }
  });
});
