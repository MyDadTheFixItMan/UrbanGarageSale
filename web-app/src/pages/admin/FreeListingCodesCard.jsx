import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Tag, Send } from 'lucide-react';
import { toast } from "sonner";
import { format, parseISO } from 'date-fns';
import { firebase } from '@/api/firebaseClient';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AU_DATE } from '@/lib/format';
import { createPageUrl } from '../../utils';
import { ADMIN_KEY } from './usePagedQuery';
import { toDate, freeCodeStatus, defaultFreeCodeExpiry } from './adminStats';

const CODES_KEY = [ADMIN_KEY, 'freeListingCodes'];

const STATUS_STYLES = {
    unused: ['Not used yet', 'bg-blue-100 text-blue-700'],
    used: ['Used', 'bg-green-100 text-green-700'],
    expired: ['Expired', 'bg-slate-200 text-slate-600'],
    cancelled: ['Cancelled', 'bg-red-100 text-red-700'],
};

const emptyForm = () => ({ name: '', email: '', note: '', expiresOn: defaultFreeCodeExpiry() });
const dayLabel = (isoDate) => (isoDate ? format(parseISO(isoDate), AU_DATE) : '');

// The text a code is shared as (by text message or any app the phone offers).
const shareMessage = (code, expiresOn) =>
    `Here's a code for a free garage sale listing on Urban Garage Sale: ${code}\n` +
    `Enter it under "Have a free listing code?" when you create your listing at ${window.location.origin}${createPageUrl('CreateListing')}` +
    (expiresOn ? ` (use it by ${dayLabel(expiresOn)}).` : '.');

async function copyCode(code) {
    try {
        await navigator.clipboard.writeText(code);
        toast.success(`${code} copied`);
    } catch {
        toast.error("Couldn't copy the code. Select it and copy it instead.");
    }
}

// Opens the phone's share sheet (Messages, WhatsApp, email...) where the browser has one.
const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

async function shareCode(code, expiresOn) {
    try {
        await navigator.share({ text: shareMessage(code, expiresOn) });
    } catch (error) {
        if (error?.name !== 'AbortError') toast.error("Couldn't open sharing. Copy the code instead.");
    }
}

function CodeActions({ code, expiresOn }) {
    return (
        <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => copyCode(code)}>Copy</Button>
            {canShare() && (
                <Button type="button" size="sm" variant="outline" onClick={() => shareCode(code, expiresOn)}>Share</Button>
            )}
        </div>
    );
}

function codeDates(code, status) {
    if (status === 'used') {
        const usedAt = toDate(code.used_at);
        return usedAt ? `Used ${format(usedAt, AU_DATE)}` : 'Used';
    }
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'expired') return `Expired after ${dayLabel(code.expires_on)}`;
    return `Use by ${dayLabel(code.expires_on)}`;
}

function CodeRow({ code, onCancel }) {
    const status = freeCodeStatus(code);
    const [label, style] = STATUS_STYLES[status] ?? STATUS_STYLES.unused;
    const recipient = [code.recipient_name, code.recipient_email].filter(Boolean).join(' · ');

    return (
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-semibold text-navy tracking-wider">{code.code ?? code.id}</span>
                <Badge className={style}>{label}</Badge>
            </div>
            {recipient && <p className="text-sm text-slate-700 break-words">{recipient}</p>}
            {code.note && <p className="text-sm text-slate-500 whitespace-pre-line break-words">{code.note}</p>}
            <p className="text-xs text-slate-500">
                {codeDates(code, status)}
                {code.emailed_at ? ' · Emailed' : ''}
            </p>
            {status === 'unused' && (
                <div className="flex flex-wrap gap-2">
                    <CodeActions code={code.code ?? code.id} expiresOn={code.expires_on} />
                    <Button type="button" size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onCancel(code)}>
                        Cancel code
                    </Button>
                </div>
            )}
            {status === 'used' && code.used_for && (
                <Link to={createPageUrl(`ListingDetails?id=${code.used_for}`)} className="text-sm font-medium text-navy underline">
                    View listing
                </Link>
            )}
        </div>
    );
}

// Free listing codes: the admin makes a one-use code for a person and emails it to them (or
// copies or shares it), and sees which codes have been used.
export default function FreeListingCodesCard() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState(emptyForm);
    const [created, setCreated] = useState(null);
    const [codeToCancel, setCodeToCancel] = useState(null);

    const { data: codes = [], isLoading } = useQuery({
        queryKey: CODES_KEY,
        queryFn: () => firebase.entities.FreeListingCode.recent(),
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey: CODES_KEY });
    const setField = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.value }));

    const createMutation = useMutation({
        mutationFn: (details) => firebase.entities.FreeListingCode.create(details),
        onSuccess: (result, details) => {
            const email = details.email.trim();
            setCreated({ ...result, email });
            setForm(emptyForm());
            refresh();
            if (!email) toast.success(`Code ${result.code} created`);
            else if (result.emailed) toast.success(`Code ${result.code} emailed to ${email}`);
            else toast.warning(`Code ${result.code} created, but the email couldn't be sent. Copy it and send it yourself.`);
        },
        onError: (error) => {
            toast.error(`Couldn't create the code: ${error.message}`);
        },
    });

    const cancelMutation = useMutation({
        mutationFn: (code) => firebase.entities.FreeListingCode.cancel(code),
        onSuccess: () => {
            refresh();
            setCodeToCancel(null);
            toast.success('Code cancelled');
        },
        onError: (error) => {
            toast.error(`Couldn't cancel the code: ${error.message}`);
        },
    });

    const handleCreate = (e) => {
        e.preventDefault();
        if (!form.expiresOn) {
            toast.error('Please choose the last day the code can be used');
            return;
        }
        createMutation.mutate({ ...form });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    Free Listing Codes
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <p className="text-sm text-slate-600">
                    Send someone a code for one free listing. They enter it when they publish their sale, and it goes
                    to approval like any other listing. Each code works once. If you reject the listing, the code can
                    be used again.
                </p>

                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="code-name" className="block text-sm font-medium text-slate-700 mb-1.5">Their name (optional)</label>
                            <Input id="code-name" value={form.name} onChange={setField('name')} maxLength={100} autoComplete="off" />
                        </div>
                        <div>
                            <label htmlFor="code-email" className="block text-sm font-medium text-slate-700 mb-1.5">Their email (to send the code)</label>
                            <Input id="code-email" type="email" value={form.email} onChange={setField('email')} maxLength={254} autoComplete="off" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="code-note" className="block text-sm font-medium text-slate-700 mb-1.5">Note in the email (optional)</label>
                        <Textarea id="code-note" value={form.note} onChange={setField('note')} maxLength={500} rows={2} />
                    </div>
                    <div className="sm:w-1/2">
                        <label htmlFor="code-expires" className="block text-sm font-medium text-slate-700 mb-1.5">Last day to use it</label>
                        <Input id="code-expires" type="date" value={form.expiresOn} onChange={setField('expiresOn')} min={format(new Date(), 'yyyy-MM-dd')} required />
                    </div>
                    <Button type="submit" disabled={createMutation.isPending} className="bg-navy hover:bg-navy-dark gap-2">
                        {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {form.email.trim() ? 'Create & Email Code' : 'Create Code'}
                    </Button>
                </form>

                {created && (
                    <div className="p-4 rounded-xl border border-green-200 bg-green-50 space-y-2">
                        <p className="text-sm text-green-700 font-medium">New code</p>
                        <p className="font-mono text-2xl font-bold text-navy tracking-wider break-all">{created.code}</p>
                        <p className="text-sm text-slate-600">
                            {created.emailed
                                ? `Emailed to ${created.email}.`
                                : 'Not emailed. Copy it or share it to send it yourself.'}
                            {' '}Use by {dayLabel(created.expiresOn)}.
                        </p>
                        <CodeActions code={created.code} expiresOn={created.expiresOn} />
                    </div>
                )}

                <div className="space-y-3">
                    <p className="font-medium text-navy">Codes sent</p>
                    {isLoading && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
                    {!isLoading && codes.length === 0 && <p className="text-sm text-slate-500">No codes yet.</p>}
                    {codes.map((code) => (
                        <CodeRow key={code.id} code={code} onCancel={setCodeToCancel} />
                    ))}
                </div>
            </CardContent>

            <AlertDialog open={!!codeToCancel} onOpenChange={(open) => !open && setCodeToCancel(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel this code?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {codeToCancel?.code} will stop working straight away. This can't be undone, but you can send a new code.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep code</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                cancelMutation.mutate(codeToCancel.code ?? codeToCancel.id);
                            }}
                            disabled={cancelMutation.isPending}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {cancelMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Cancel code
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
