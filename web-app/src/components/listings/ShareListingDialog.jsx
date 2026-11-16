import React, { useEffect, useRef, useState } from 'react';
import { Share2, Copy, Mail, MessageCircle, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    SHARE_CHANNELS,
    copyText,
    emailShareUrl,
    facebookShareUrl,
    listingPostText,
    listingShareUrl,
    openShareSheet,
    shareSheetData,
    whatsAppShareUrl,
} from '@/lib/share';

// Ways to share a listing. Everyone gets its link: the device's share sheet where there is one,
// and copy, Facebook, WhatsApp and email. `promote` adds what a seller needs to advertise their
// sale: a flyer image for Instagram, where links can't be clicked, and words for a post.
export default function ShareListingDialog({ listing, open, onOpenChange, promote = false }) {
    // The dialog stays on screen while it animates closed, after the page has cleared `listing`.
    const lastListing = useRef(listing);
    if (listing) lastListing.current = listing;
    const sale = lastListing.current;

    const [flyer, setFlyer] = useState(null);
    const [flyerFailed, setFlyerFailed] = useState(false);

    // The flyer is drawn when the dialog opens, so it's ready at a tap: browsers only let a page
    // share straight after the tap, not after a wait.
    useEffect(() => {
        if (!open || !promote || !sale) return undefined;
        let cancelled = false;
        let url;
        setFlyer(null);
        setFlyerFailed(false);
        import('@/lib/shareFlyer')
            .then(({ createShareFlyer }) => createShareFlyer(sale))
            .then((file) => {
                if (cancelled) return;
                if (!file) {
                    setFlyerFailed(true);
                    return;
                }
                url = URL.createObjectURL(file);
                setFlyer({ file, url });
            })
            .catch(() => {
                if (!cancelled) setFlyerFailed(true);
            });
        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [open, promote, sale?.id]);

    if (!sale) return null;

    const urlFor = (channel) => listingShareUrl(window.location.origin, sale.id, channel);
    const hasShareSheet = typeof navigator.share === 'function';
    const canShareFlyer = Boolean(flyer) && typeof navigator.canShare === 'function' && navigator.canShare({ files: [flyer.file] });
    const postText = listingPostText(sale, urlFor(SHARE_CHANNELS.POST_TEXT));

    const copyLink = async () => {
        if (await copyText(urlFor(SHARE_CHANNELS.COPY_LINK))) {
            toast.success('Link copied');
        } else {
            toast.error("Couldn't copy the link. Select it below and copy it instead.");
        }
    };

    const shareLink = async () => {
        const result = await openShareSheet(shareSheetData(sale, urlFor(SHARE_CHANNELS.SHARE_SHEET)));
        if (result === 'unavailable') await copyLink();
    };

    const shareFlyer = async () => {
        const result = await openShareSheet({ files: [flyer.file], title: sale.title });
        if (result === 'unavailable') toast.error("This browser can't share the image. Save it, then post it from your photos.");
    };

    const copyPostText = async () => {
        if (await copyText(postText)) {
            toast.success('Post text copied');
        } else {
            toast.error("Couldn't copy the text. Select it and copy it instead.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Share this sale</DialogTitle>
                    <DialogDescription>
                        {promote
                            ? 'Post it in local buy, swap and sell groups and send it to friends: every share brings more buyers. Your street address is never shared.'
                            : 'Send it to a friend or post it in a local group.'}
                    </DialogDescription>
                </DialogHeader>

                {/* min-w-0: the dialog is a grid, and without it a long link widens the dialog past the
                    edge of a phone screen instead of wrapping. */}
                <div className="min-w-0 space-y-3">
                    {hasShareSheet && (
                        <Button className="w-full bg-navy hover:bg-navy-dark" onClick={shareLink}>
                            <Share2 />
                            Share link
                        </Button>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Button variant="outline" size="sm" onClick={copyLink}>
                            <Copy />
                            Copy link
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={facebookShareUrl(urlFor(SHARE_CHANNELS.FACEBOOK))} target="_blank" rel="noopener noreferrer">
                                Facebook
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={whatsAppShareUrl(sale, urlFor(SHARE_CHANNELS.WHATSAPP))} target="_blank" rel="noopener noreferrer">
                                <MessageCircle />
                                WhatsApp
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={emailShareUrl(sale, urlFor(SHARE_CHANNELS.EMAIL))}>
                                <Mail />
                                Email
                            </a>
                        </Button>
                    </div>
                    <input
                        readOnly
                        value={urlFor(SHARE_CHANNELS.COPY_LINK)}
                        onFocus={(event) => event.target.select()}
                        aria-label="Link to this sale"
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                    />
                </div>

                {promote && (
                    <section className="min-w-0 border-t pt-4">
                        <h3 className="font-semibold text-navy">Flyer for Instagram</h3>
                        <p className="text-sm text-slate-500 mb-3">
                            Links don't work in Instagram posts, so post this instead. It suits Stories too.
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="w-24 aspect-[4/5] shrink-0 rounded-md border bg-slate-100 overflow-hidden flex items-center justify-center">
                                {flyer ? (
                                    <img src={flyer.url} alt={`Flyer for ${sale.title || 'this sale'}`} className="w-full h-full object-cover" />
                                ) : !flyerFailed && (
                                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" aria-label="Making the flyer" />
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                {flyerFailed ? (
                                    <p className="text-sm text-slate-500">This browser couldn't make the flyer. Try another browser, or share the link.</p>
                                ) : (
                                    <>
                                        {canShareFlyer && (
                                            <Button className="w-full bg-navy hover:bg-navy-dark" onClick={shareFlyer}>
                                                <Share2 />
                                                Share image
                                            </Button>
                                        )}
                                        {flyer ? (
                                            <Button variant="outline" className="w-full" asChild>
                                                <a href={flyer.url} download={flyer.file.name}>
                                                    <Download />
                                                    Save image
                                                </a>
                                            </Button>
                                        ) : (
                                            <Button variant="outline" className="w-full" disabled>
                                                Making the flyer…
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {promote && (
                    <section className="min-w-0 border-t pt-4">
                        <h3 className="font-semibold text-navy">Words for your post</h3>
                        <p className="text-sm text-slate-500 mb-3">
                            Facebook groups and Instagram need you to write the post yourself. Paste this in.
                        </p>
                        <p className="whitespace-pre-line [overflow-wrap:anywhere] rounded-md border bg-slate-50 p-3 text-sm text-slate-700">{postText}</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={copyPostText}>
                            <Copy />
                            Copy text
                        </Button>
                    </section>
                )}
            </DialogContent>
        </Dialog>
    );
}
