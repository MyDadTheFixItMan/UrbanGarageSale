import { useQuery } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';

// The banner messages admins manage on the dashboard, in their display order.
// An empty list (also when loading fails) lets each page show its default message.
export function usePromotions() {
    const { data = [] } = useQuery({
        queryKey: ['allPromotions'],
        queryFn: async () => {
            try {
                return await firebase.firestore.collection('promotions').getDocs('sequence', 'asc');
            } catch (error) {
                console.error('Error fetching promotions:', error);
                return [];
            }
        },
        staleTime: 1000 * 60 * 5,
    });
    return data;
}
