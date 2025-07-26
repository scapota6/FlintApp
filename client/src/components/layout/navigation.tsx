import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bell, LogOut } from "lucide-react";

export default function Navigation() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [location] = useLocation();

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
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/">
              <span className="text-xl font-semibold text-white cursor-pointer">Flint</span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <span
                  className={`pb-1 px-1 text-sm font-medium transition-colors cursor-pointer ${
                    item.active
                      ? "text-blue-500 border-b-2 border-blue-500"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
          
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
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
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
          </div>
        </div>
      </div>
    </header>
  );
}
