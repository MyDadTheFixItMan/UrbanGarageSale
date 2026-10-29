import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { firebase } from '@/api/firebaseClient';

// Adds a listing to the signed-in user's favourites, or removes it if it's already there.
// The current state is re-read when the button is pressed, so a stale list can't save twice.
// The mutation resolves to true when the listing was removed, false when it was saved.
export function useToggleSaved() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (saleId) => {
            const mine = await firebase.entities.SavedListing.mine();
            const saved = mine.find((s) => s.garage_sale_id === saleId);
            if (saved) {
                await firebase.entities.SavedListing.delete(saved.id);
                return true;
            }
            await firebase.entities.SavedListing.create({ garage_sale_id: saleId });
            return false;
        },
        onSuccess: (removed) => {
            queryClient.invalidateQueries({ queryKey: ['savedListings'] });
            toast.success(removed ? 'Removed from favourites' : 'Saved to favourites');
        },
        onError: (error) => {
            console.error('Updating favourites failed:', error);
            toast.error('Failed to update favourites');
        },
    });
}
