/**
 * Watchlist Page
 * Main page for watchlist management and price alerts
 */

import { motion } from 'framer-motion';
import WatchlistPanel from '@/components/watchlist/WatchlistPanel';
import PriceAlerts from '@/components/watchlist/PriceAlerts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Bell } from 'lucide-react';

export default function Watchlist() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-black pt-16 px-4 pb-8"
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Watchlist & Alerts
          </h1>
          <p className="text-gray-400">
            Track your favorite symbols and get notified of price changes
          </p>
        </div>

        <Tabs defaultValue="watchlist" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md bg-gray-900 border border-gray-800">
            <TabsTrigger value="watchlist" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Watchlist
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Price Alerts
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="watchlist" className="mt-6">
            <WatchlistPanel />
          </TabsContent>
          
          <TabsContent value="alerts" className="mt-6">
            <PriceAlerts />
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
}