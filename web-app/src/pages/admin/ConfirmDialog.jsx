import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

// "Delete X? This action cannot be undone." confirmation used for users and listings.
export default function ConfirmDeleteDialog({ open, onClose, title, description, itemName, onConfirm, pending }) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <p className="text-slate-600">
                        Are you sure you want to delete <strong>{itemName}</strong>?
                    </p>
                    <p className="text-sm text-red-600">This action cannot be undone.</p>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={pending}
                            className="flex-1 bg-red-500 hover:bg-red-600"
                        >
                            {pending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Delete
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
