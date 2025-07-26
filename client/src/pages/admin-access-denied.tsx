import { Shield } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function AdminAccessDenied() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <Shield className="h-16 w-16 text-red-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
        <p className="text-gray-400 mb-6">
          You don't have permission to access the admin panel. This area is restricted to platform administrators only.
        </p>
        <Link href="/">
          <Button className="bg-blue-600 hover:bg-blue-700">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}