import React from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  busy = false,
  onConfirm,
  onCancel,
}) => (
  <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onCancel?.(); }}>
    <AlertDialogContent dir="rtl" className="max-w-md rounded-3xl border border-[#E1E8E3] bg-white p-6 shadow-2xl">
      <AlertDialogHeader className="text-right">
        <AlertDialogTitle className="text-xl font-black text-[#14271E]">{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-sm leading-7 text-[#64736B]">{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
        <AlertDialogCancel disabled={busy} onClick={onCancel} className="mt-0 min-h-11 rounded-xl border-[#D8E2DB] px-5 font-bold text-[#41544A]">{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction
          disabled={busy}
          onClick={(event) => { event.preventDefault(); onConfirm?.(); }}
          className="min-h-11 rounded-xl bg-red-700 px-5 font-black text-white hover:bg-red-800"
        >{busy ? 'جارٍ التنفيذ...' : confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
