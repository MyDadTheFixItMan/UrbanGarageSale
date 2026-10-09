import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from "sonner";
import { format } from 'date-fns';
import { firebase } from '@/api/firebaseClient';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AU_DATE_TIME } from '@/lib/format';
import { toDate, filterMessages } from './adminStats';
import { ADMIN_KEY, usePagedQuery, LoadMoreButton, ListLoading } from './usePagedQuery';

const EMPTY_TEXT = {
    all: 'No contact messages yet',
    waiting: 'No messages waiting for response',
    closed: 'No messages with responses',
};

function formatWhen(value) {
    const date = toDate(value);
    return date ? format(date, AU_DATE_TIME) : '';
}

function useMessageMutations(currentUserEmail, onResponded) {
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey: [ADMIN_KEY] });

    const updateStatus = useMutation({
        mutationFn: ({ messageId, status }) => firebase.entities.ContactMessage.update(messageId, { status }),
        onSuccess: () => {
            refresh();
            toast.success('Message status updated');
        },
        onError: () => toast.error('Failed to update message status'),
    });

    const remove = useMutation({
        mutationFn: (messageId) => firebase.entities.ContactMessage.delete(messageId),
        onSuccess: () => {
            refresh();
            toast.success('Message deleted');
        },
        onError: () => toast.error('Failed to delete message'),
    });

    const respond = useMutation({
        mutationFn: async ({ message, response }) => {
            await firebase.entities.ContactMessage.update(message.id, {
                response,
                response_by: currentUserEmail,
                response_at: new Date()
            });
            // The response is saved even if the email notification fails.
            try {
                await firebase.functions.invoke('sendContactResponseEmail', {
                    userEmail: message.email,
                    userName: message.name,
                    originalMessage: message.message,
                    responseMessage: response
                });
            } catch (error) {
                console.error('Failed to send email:', error);
            }
        },
        onSuccess: (_, { message }) => {
            refresh();
            onResponded(message.id);
            toast.success('Response sent and email notification queued');
        },
        onError: () => toast.error('Failed to send response'),
    });

    return { updateStatus, remove, respond };
}

export default function MessagesTab({ currentUserEmail }) {
    const [filter, setFilter] = useState('all');
    const paged = usePagedQuery(['messages'], (cursor) => firebase.entities.ContactMessage.page({ cursor }));
    const messages = paged.items;
    const [expandedId, setExpandedId] = useState(null);
    const [responseTexts, setResponseTexts] = useState({});

    const closeReply = (messageId) => {
        setResponseTexts((prev) => ({ ...prev, [messageId]: '' }));
        setExpandedId(null);
    };
    const { updateStatus, remove, respond } = useMessageMutations(currentUserEmail, closeReply);
    const visible = filterMessages(messages, filter);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle>Messages</CardTitle>
                    <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="w-full sm:w-48" aria-label="Filter messages">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Messages</SelectItem>
                            <SelectItem value="waiting">Waiting for Response</SelectItem>
                            <SelectItem value="closed">Closed (Responded)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {paged.isLoading ? (
                    <ListLoading />
                ) : visible.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-slate-500">{EMPTY_TEXT[filter]}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {visible.map((message) => (
                            <Card key={message.id} className={`border ${message.status === 'unread' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                                <CardContent className="pt-6">
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-slate-700">{message.name}</h3>
                                                <p className="text-sm text-slate-500">{message.email}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500">{formatWhen(message.created_at)}</p>
                                                {message.status === 'unread' && (
                                                    <Badge className="bg-blue-500 text-white mt-1">Unread</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-slate-700 whitespace-pre-wrap">{message.message}</p>

                                        {message.response && (
                                            <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                                                <p className="text-xs font-semibold text-green-700 mb-1">Response from {message.response_by || 'Admin'}</p>
                                                <p className="text-sm text-green-800 whitespace-pre-wrap">{message.response}</p>
                                                {message.response_at && (
                                                    <p className="text-xs text-green-600 mt-2">{formatWhen(message.response_at)}</p>
                                                )}
                                            </div>
                                        )}

                                        {expandedId === message.id && (
                                            <div className="mt-4 space-y-2 p-3 bg-slate-50 rounded border border-slate-200">
                                                <label htmlFor={`response-${message.id}`} className="text-sm font-medium text-slate-700">Your Response</label>
                                                <Textarea
                                                    id={`response-${message.id}`}
                                                    value={responseTexts[message.id] || ''}
                                                    onChange={(e) => setResponseTexts((prev) => ({ ...prev, [message.id]: e.target.value }))}
                                                    placeholder="Type your response here..."
                                                    rows={4}
                                                    className="resize-none"
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => respond.mutate({ message, response: responseTexts[message.id] })}
                                                        disabled={respond.isPending || !responseTexts[message.id]?.trim()}
                                                        className="bg-green-600 hover:bg-green-700"
                                                    >
                                                        {respond.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                                        Send Response
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => closeReply(message.id)}>
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => updateStatus.mutate({
                                                    messageId: message.id,
                                                    status: message.status === 'unread' ? 'read' : 'unread'
                                                })}
                                                disabled={updateStatus.isPending}
                                                className="flex-1"
                                            >
                                                {updateStatus.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                                {message.status === 'unread' ? 'Mark as Read' : 'Mark as Unread'}
                                            </Button>
                                            {!message.response && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setExpandedId(expandedId === message.id ? null : message.id)}
                                                    className="bg-blue-50 hover:bg-blue-100"
                                                >
                                                    {expandedId === message.id ? 'Close' : 'Reply'}
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => remove.mutate(message.id)}
                                                disabled={remove.isPending}
                                                className="text-red-600 hover:text-red-700"
                                                aria-label="Delete message"
                                            >
                                                {remove.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
                {/* "Waiting" and "Closed" filter the messages loaded so far. */}
                <LoadMoreButton paged={paged} />
            </CardContent>
        </Card>
    );
}
