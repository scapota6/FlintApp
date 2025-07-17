import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bell, LogOut } from "lucide-react";

export default function Navigation() {
  const { user } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const navItems = [
    { path: "/", label: "Dashboard", active: location === "/" },
    { path: "/trading", label: "Trading", active: location === "/trading" },
    { path: "/transfers", label: "Transfers", active: location === "/transfers" },
    { path: "/watchlist", label: "Watchlist", active: location === "/watchlist" },
    { path: "/activity", label: "Activity", active: location === "/activity" },
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
            <div className="flex items-center space-x-2">
              <img
                src={user?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=32&h=32"}
                alt="Profile"
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="text-sm font-medium text-white hidden sm:block">
                {user?.firstName || 'User'}
              </span>
            </div>
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
