import React, { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";

// Every admin query key starts with this, so one invalidation refreshes lists and totals.
export const ADMIN_KEY = 'admin';

// Loads a Firestore list one page at a time. `fetchPage(cursor)` returns { items, cursor, ... }
// (see the entities' page() readers); pages are kept so extra per-page data stays available.
export function usePagedQuery(queryKey, fetchPage, { enabled = true } = {}) {
    const query = useInfiniteQuery({
        queryKey: [ADMIN_KEY, ...queryKey],
        queryFn: ({ pageParam }) => fetchPage(pageParam),
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
        enabled,
    });
    const pages = useMemo(() => query.data?.pages ?? [], [query.data]);
    const items = useMemo(() => pages.flatMap((page) => page.items), [pages]);
    return {
        items,
        pages,
        isLoading: query.isLoading,
        hasMore: query.hasNextPage,
        loadMore: query.fetchNextPage,
        loadingMore: query.isFetchingNextPage,
    };
}

export function LoadMoreButton({ paged }) {
    if (!paged.hasMore) return null;
    return (
        <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={() => paged.loadMore()} disabled={paged.loadingMore}>
                {paged.loadingMore && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Load more
            </Button>
        </div>
    );
}

export function ListLoading() {
    return (
        <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
    );
}
