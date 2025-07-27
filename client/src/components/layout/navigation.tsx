import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import SearchBar from "@/components/ui/search-bar";

export default function Navigation() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const navItems = [
    { path: "/", label: "Dashboard", active: location === "/" },
    { path: "/trading", label: "Trading", active: location === "/trading" },
    { path: "/transfers", label: "Transfers", active: location === "/transfers" },
    { path: "/watchlist", label: "Watchlist", active: location === "/watchlist" },
    { path: "/news", label: "News", active: location === "/news" },
    { path: "/activity", label: "Activity", active: location === "/activity" },
    ...(isAdmin ? [{ path: "/admin", label: "Admin", active: location === "/admin" }] : []),
  ];

  return (
    <header className="bg-gray-900 border-b border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/">
              <span className="text-2xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text font-mono cursor-pointer">
                FLINT
              </span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8 ml-8">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <span
                  className={`pb-1 px-1 text-sm font-medium transition-all duration-200 cursor-pointer ${
                    item.active
                      ? "text-purple-400 border-b-2 border-purple-400"
                      : "text-gray-400 hover:text-white hover:border-b-2 hover:border-purple-300"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          {/* Search Bar */}
          <div className="hidden md:flex md:items-center md:flex-1 md:max-w-md md:mx-8">
            <SearchBar className="w-full" />
          </div>
          
          {/* User Profile */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white"
            >
              <Bell className="h-5 w-5" />
            </Button>
            <Link href="/profile">
              <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm font-medium text-white hidden sm:block">
                  {user?.firstName || 'User'}
                </span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-gray-400 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </Button>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-400 hover:text-white"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 border-t border-gray-700">
              <SearchBar className="mb-4" />
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      item.active
                        ? "bg-purple-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
