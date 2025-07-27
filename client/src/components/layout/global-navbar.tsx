import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, User, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/trading', label: 'Trading' },
  { href: '/transfers', label: 'Transfers' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/news', label: 'News' },
  { href: '/activity', label: 'Activity' },
];

export default function GlobalNavbar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
  });

  // Close mobile menu when location changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return location === '/' || location === '/dashboard';
    }
    return location.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100]" style={{ background: 'var(--bg)' }}>
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/dashboard">
              <div className="flex items-center space-x-2 cursor-pointer">
                <div className="text-2xl font-bold">
                  <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                    FLINT
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex space-x-8 flex-1 justify-center">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span className={`text-sm font-medium transition-all duration-200 cursor-pointer relative
                  ${isActiveLink(link.href)
                    ? 'text-white after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-0.5 after:bg-[#8e44ad] after:rounded-full'
                    : 'text-gray-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(142,68,173,0.6)]'
                  }`}>
                  {link.label}
                </span>
              </Link>
            ))}
          </div>



          {/* User Menu */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-[#8e44ad] text-white">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-[#1e1e1e] border-gray-700" align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium text-white">{user?.email}</p>
                      <p className="text-xs text-gray-400">Free Plan</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem className="text-gray-300 hover:text-white hover:bg-gray-800">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-gray-300 hover:text-white hover:bg-gray-800">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem 
                    className="text-gray-300 hover:text-white hover:bg-gray-800"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-[#1e1e1e] border-t border-gray-800">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  className={`block px-3 py-2 text-base font-medium transition-colors duration-200 cursor-pointer
                    ${isActiveLink(link.href)
                      ? 'text-white bg-[#8e44ad]/20 border-l-4 border-[#8e44ad]'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
            <div className="border-t border-gray-700 pt-4 pb-3">
              <div className="flex items-center px-5">
                <div className="flex-shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-[#8e44ad] text-white">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-white">{user?.email}</div>
                  <div className="text-sm font-medium text-gray-400">Free Plan</div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <button className="block px-4 py-2 text-base font-medium text-gray-400 hover:text-white hover:bg-gray-800 w-full text-left">
                  Profile
                </button>
                <button className="block px-4 py-2 text-base font-medium text-gray-400 hover:text-white hover:bg-gray-800 w-full text-left">
                  Settings
                </button>
                <button 
                  onClick={handleLogout}
                  className="block px-4 py-2 text-base font-medium text-gray-400 hover:text-white hover:bg-gray-800 w-full text-left"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}