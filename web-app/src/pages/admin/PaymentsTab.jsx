import React, { useMemo, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { firebase } from '@/api/firebaseClient';
import { formatAud, AU_DATE } from '@/lib/format';
import { toDate, matchPayments, filterPayments, paymentListingValues, paymentsSince } from './adminStats';
import { usePagedQuery, LoadMoreButton, ListLoading } from './usePagedQuery';

// One page of payments, plus just the listings and payers those payments refer to.
async function fetchPaymentsPage(since, cursor) {
    const page = await firebase.entities.Payment.page({ since, cursor });
    const [listings, users] = await Promise.all([
        firebase.entities.GarageSale.getByIds(page.items.map((p) => p.garage_sale_id)),
        firebase.entities.User.getByIds(page.items.map((p) => p.user_id)),
    ]);
    return { ...page, matched: matchPayments(page.items, listings, users) };
}

function FilterSelect({ label, value, onChange, children }) {
    return (
        <div>
            <label className="text-sm font-medium text-slate-700">{label}</label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="mt-1" aria-label={label}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>{children}</SelectContent>
            </Select>
        </div>
    );
}

function PaymentCard({ payment, sale, payer }) {
    const paidAt = toDate(payment.created_at);
    return (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-purple-200 transition">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <p className="font-semibold text-[#1e3a5f]">{formatAud(payment.amount)}</p>
                    <p className="text-sm text-slate-600 mt-1">{sale?.title || 'Unknown Listing'}</p>
                    <p className="text-base font-medium text-slate-900 mt-2">{payer?.full_name || payment.user_email}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <p className="text-slate-600 font-medium">Date Paid</p>
                        <p className="text-slate-700">{paidAt ? format(paidAt, AU_DATE) : 'N/A'}</p>
                        <p className="text-slate-600 text-xs">{paidAt ? format(paidAt, 'h:mm a') : 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-slate-600 font-medium">Location</p>
                        <p className="text-slate-700">{sale?.suburb || 'N/A'}</p>
                        <p className="text-slate-600 text-xs">{sale?.state || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500">Transaction ID: {payment.transaction_id}</div>
                <Badge className={payment.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                    {payment.status}
                </Badge>
            </div>
        </div>
    );
}

export default function PaymentsTab() {
    const [dateFilter, setDateFilter] = useState('all');
    const [suburbFilter, setSuburbFilter] = useState('all');
    const [stateFilter, setStateFilter] = useState('all');

    // The date filter runs in the query; suburb/state depend on each payment's listing, so they
    // filter the payments loaded so far.
    const paged = usePagedQuery(['payments', dateFilter], (cursor) =>
        fetchPaymentsPage(paymentsSince(dateFilter), cursor));
    const payments = paged.items;
    const matched = useMemo(() => Object.assign({}, ...paged.pages.map((page) => page.matched)), [paged.pages]);
    const visible = filterPayments(payments, matched, { suburb: suburbFilter, state: stateFilter });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
                    <FilterSelect label="Date Paid" value={dateFilter} onChange={setDateFilter}>
                        <SelectItem value="all">All Dates</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">Last 7 Days</SelectItem>
                        <SelectItem value="month">Last 30 Days</SelectItem>
                    </FilterSelect>
                    <FilterSelect label="Suburb" value={suburbFilter} onChange={setSuburbFilter}>
                        <SelectItem value="all">All Suburbs</SelectItem>
                        {paymentListingValues(payments, matched, 'suburb').map((suburb) => (
                            <SelectItem key={suburb} value={suburb}>{suburb}</SelectItem>
                        ))}
                    </FilterSelect>
                    <FilterSelect label="State" value={stateFilter} onChange={setStateFilter}>
                        <SelectItem value="all">All States</SelectItem>
                        {paymentListingValues(payments, matched, 'state').map((state) => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                    </FilterSelect>
                </div>

                {paged.isLoading ? (
                    <ListLoading />
                ) : payments.length === 0 ? (
                    <div className="text-center py-8">
                        <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No payments found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {visible.map((payment) => (
                            <PaymentCard
                                key={payment.id}
                                payment={payment}
                                sale={matched[payment.id]?.sale}
                                payer={matched[payment.id]?.user}
                            />
                        ))}
                    </div>
                )}
                <LoadMoreButton paged={paged} />
            </CardContent>
        </Card>
    );
}
