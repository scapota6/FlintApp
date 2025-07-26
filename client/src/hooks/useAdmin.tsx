import { useAuth } from "@/hooks/useAuth";

export function useAdmin() {
  const { user } = useAuth();
  
  // Platform owner emails
  const adminEmails = ['scapota@flint-investing.com'];
  
  const isAdmin = user?.email && adminEmails.includes(user.email);
  
  return {
    isAdmin: !!isAdmin,
    user
  };
}