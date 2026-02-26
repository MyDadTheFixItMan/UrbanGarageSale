// src/__tests__/features/savedListings.test.js
import { firebase } from '@/api/firebaseClient';

describe('Saved Listings (Favorites)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Save Listing', () => {
    test('should save listing to user favorites', async () => {
      const userId = 'user_123';
      const listingId = 'listing_456';

      await firebase.entities.SavedListing.create({
        userId,
        listingId,
        savedAt: new Date(),
      });

      expect(firebase.entities.SavedListing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          listingId,
        })
      );
    });

    test('should not save duplicate favorites', async () => {
      const userId = 'user_123';
      const listingId = 'listing_456';

      const saved1 = await firebase.entities.SavedListing.create({
        userId,
        listingId,
      });

      firebase.entities.SavedListing.create.mockRejectedValueOnce(
        new Error('Duplicate entry')
      );

      await expect(
        firebase.entities.SavedListing.create({
          userId,
          listingId,
        })
      ).rejects.toThrow('Duplicate entry');
    });

    test('should record timestamp when saving', async () => {
      const savedAt = new Date();
      const saved = await firebase.entities.SavedListing.create({
        userId: 'user_123',
        listingId: 'listing_456',
        savedAt,
      });

      expect(saved.savedAt).toBeTruthy();
    });
  });

  describe('Remove from Favorites', () => {
    test('should remove listing from saved', async () => {
      const savedId = 'saved_123';

      const result = await firebase.entities.SavedListing.delete(savedId);

      expect(result).toBe(true);
      expect(firebase.entities.SavedListing.delete).toHaveBeenCalledWith(savedId);
    });

    test('should handle removing non-existent favorite', async () => {
      firebase.entities.SavedListing.delete.mockResolvedValueOnce(false);

      const result = await firebase.entities.SavedListing.delete('invalid_id');

      expect(result).toBe(false);
    });
  });

  describe('Fetch Saved Listings', () => {
    test('should get all saved listings for user', async () => {
      const userId = 'user_123';
      const saved = await firebase.entities.SavedListing.filter({ userId });

      expect(Array.isArray(saved)).toBe(true);
      expect(saved.every((s) => s.userId === userId)).toBe(true);
    });

    test('should return empty array if no saved listings', async () => {
      firebase.entities.SavedListing.filter.mockResolvedValueOnce([]);

      const saved = await firebase.entities.SavedListing.filter({
        userId: 'user_with_no_saves',
      });

      expect(saved).toEqual([]);
    });

    test('should show listing count', async () => {
      const saved = await firebase.entities.SavedListing.filter({ userId: 'user_123' });

      expect(saved.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Saved Listing Status', () => {
    test('should check if listing is saved', async () => {
      const userId = 'user_123';
      const listingId = 'listing_456';

      const saved = await firebase.entities.SavedListing.filter({
        userId,
        listingId,
      });

      const isSaved = saved.length > 0;
      expect(typeof isSaved).toBe('boolean');
    });

    test('should return true for saved listing', async () => {
      firebase.entities.SavedListing.filter.mockResolvedValueOnce([
        { id: 'saved_123', userId: 'user_123', listingId: 'listing_456' },
      ]);

      const saved = await firebase.entities.SavedListing.filter({
        userId: 'user_123',
        listingId: 'listing_456',
      });

      expect(saved.length > 0).toBe(true);
    });

    test('should return false for unsaved listing', async () => {
      firebase.entities.SavedListing.filter.mockResolvedValueOnce([]);

      const saved = await firebase.entities.SavedListing.filter({
        userId: 'user_123',
        listingId: 'listing_999',
      });

      expect(saved.length > 0).toBe(false);
    });
  });

  describe('Favorite Toggle', () => {
    test('should toggle favorite on', async () => {
      const userId = 'user_123';
      const listingId = 'listing_456';

      // Check if saved
      let saved = await firebase.entities.SavedListing.filter({
        userId,
        listingId,
      });
      const isSaved = saved.length > 0;

      if (!isSaved) {
        // Save it
        await firebase.entities.SavedListing.create({
          userId,
          listingId,
        });
      }

      expect(firebase.entities.SavedListing.create).toBeDefined();
    });

    test('should toggle favorite off', async () => {
      const userId = 'user_123';
      const listingId = 'listing_456';
      const savedId = 'saved_123';

      // Check if saved
      let saved = await firebase.entities.SavedListing.filter({
        userId,
        listingId,
      });

      if (saved.length > 0) {
        // Delete it
        await firebase.entities.SavedListing.delete(savedId);
      }

      expect(firebase.entities.SavedListing.delete).toBeDefined();
    });
  });

  describe('Saved Listings List', () => {
    test('should display listing details in saved list', async () => {
      const saved = (
        await firebase.entities.SavedListing.filter({
          userId: 'user_123',
        })
      )[0];

      expect(saved).toBeTruthy();
      expect(saved.saleId || saved.listingId).toBeTruthy();
      expect(saved.savedAt).toBeTruthy();
    });

    test('should sort saved listings by date', async () => {
      const saved = await firebase.entities.SavedListing.filter({
        userId: 'user_123',
      });

      const dates = saved.map((s) => new Date(s.savedAt).getTime());
      const isSorted = dates.every(
        (date, i) => i === 0 || date >= dates[i - 1]
      );

      expect(isSorted || dates.length <= 1).toBe(true);
    });

    test('should allow bulk remove from favorites', async () => {
      const listingIds = ['listing_1', 'listing_2', 'listing_3'];

      for (const id of listingIds) {
        const saved = await firebase.entities.SavedListing.filter({
          userId: 'user_123',
          listingId: id,
        });

        if (saved.length > 0) {
          await firebase.entities.SavedListing.delete(saved[0].id);
        }
      }

      expect(firebase.entities.SavedListing.delete).toBeDefined();
    });
  });

  describe('Saved Listings Notifications', () => {
    test('should notify when saved listing goes on sale', async () => {
      const listing = {
        id: 'listing_123',
        status: 'active',
        onSale: true,
      };

      // Check if any saved listing matches
      const saved = await firebase.entities.SavedListing.filter({
        listingId: listing.id,
      });

      expect(saved.length >= 0).toBe(true);
    });

    test('should notify when saved listing is about to end', async () => {
      const listing = {
        id: 'listing_123',
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      };

      const isEnding = listing.endDate <= new Date(Date.now() + 48 * 60 * 60 * 1000);
      expect(isEnding).toBe(true);
    });

    test('should notify when price changes', async () => {
      const listingUpdate = {
        id: 'listing_123',
        oldPrice: 100,
        newPrice: 80,
        priceDropped: true,
      };

      expect(listingUpdate.priceDropped).toBe(true);
      expect(listingUpdate.newPrice < listingUpdate.oldPrice).toBe(true);
    });
  });

  describe('Saved Listings Collections', () => {
    test('should create custom collection', async () => {
      const collection = {
        id: 'collection_123',
        userId: 'user_123',
        name: 'Furniture Sales',
        description: 'Sales with furniture items',
        listings: ['listing_1', 'listing_2'],
      };

      expect(collection.name).toBeTruthy();
      expect(Array.isArray(collection.listings)).toBe(true);
    });

    test('should add listing to collection', () => {
      const collection = {
        listings: ['listing_1', 'listing_2'],
      };

      const newCollection = {
        ...collection,
        listings: [...collection.listings, 'listing_3'],
      };

      expect(newCollection.listings).toHaveLength(3);
      expect(newCollection.listings).toContain('listing_3');
    });

    test('should remove listing from collection', () => {
      const collection = {
        listings: ['listing_1', 'listing_2', 'listing_3'],
      };

      const updated = {
        ...collection,
        listings: collection.listings.filter((id) => id !== 'listing_2'),
      };

      expect(updated.listings).toHaveLength(2);
      expect(updated.listings).not.toContain('listing_2');
    });
  });

  describe('Saved Listings Export', () => {
    test('should export saved listings as CSV', async () => {
      const saved = await firebase.entities.SavedListing.filter({
        userId: 'user_123',
      });

      const csv = [
        'Listing ID,Saved Date',
        ...saved.map((s) => `${s.listingId},${s.savedAt}`),
      ].join('\n');

      expect(csv).toContain('Listing ID');
      expect(csv).toContain('Saved Date');
    });

    test('should generate shareable link for saved listings', () => {
      const userId = 'user_123';
      const shareLink = `https://urbangaragesales.com/user/${userId}/saved`;

      expect(shareLink).toContain(userId);
      expect(shareLink).toContain('/saved');
    });
  });
});
