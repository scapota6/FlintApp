import { useLocation } from "wouter";
import { Link } from "wouter";
import { Home, TrendingUp, ArrowLeftRight, Star, History } from "lucide-react";

export default function MobileNav() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: Home, active: location === "/" },
    { path: "/trading", label: "Trading", icon: TrendingUp, active: location === "/trading" },
    { path: "/transfers", label: "Transfers", icon: ArrowLeftRight, active: location === "/transfers" },
    { path: "/watchlist", label: "Watchlist", icon: Star, active: location === "/watchlist" },
    { path: "/activity", label: "Activity", icon: History, active: location === "/activity" },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <a
                className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-colors ${
                  item.active
                    ? "text-blue-500"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
