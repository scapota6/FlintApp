import React from 'react';
import AccountDetailsDialog from './AccountDetailsDialog';

export default function AccountCard({ account, currentUser }: any) {
  const [open, setOpen] = React.useState(false);
  
  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{account.brokerageName || account.brokerage}</div>
          <div className="text-sm text-gray-500">{account.id} · {account.type}</div>
        </div>
        <button 
          onClick={() => setOpen(true)} 
          className="rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
        >
          Details
        </button>
      </div>

      <AccountDetailsDialog
        accountId={String(account.id)}
        open={open}
        onClose={() => setOpen(false)}
        currentUserId={String(currentUser?.id)}
      />
    </div>
  );
}