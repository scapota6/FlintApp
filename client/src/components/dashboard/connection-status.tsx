import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, TrendingUp, Plus } from "lucide-react";
import { useState } from "react";
import AddAccountModal from "@/components/modals/add-account-modal";

interface ConnectionStatusProps {
  accounts: any[];
}

export default function ConnectionStatus({ accounts }: ConnectionStatusProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Default connections if no accounts
  const connections = accounts?.length > 0 ? accounts : [
    {
      institutionName: 'Chase Bank',
      accountType: 'bank',
      isActive: true,
      color: 'bg-blue-600',
    },
    {
      institutionName: 'Bank of America',
      accountType: 'bank',
      isActive: true,
      color: 'bg-red-600',
    },
    {
      institutionName: 'Robinhood',
      accountType: 'brokerage',
      isActive: true,
      color: 'bg-green-600',
    },
    {
      institutionName: 'Coinbase',
      accountType: 'crypto',
      isActive: true,
      color: 'bg-blue-500',
    },
  ];

  const getIcon = (accountType: string) => {
    switch (accountType) {
      case 'bank':
        return Building;
      case 'brokerage':
      case 'crypto':
        return TrendingUp;
      default:
        return Building;
    }
  };

  return (
    <>
      <div className="mb-8">
        <Card className="trade-card shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-white">Connected Accounts</CardTitle>
              <Button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.map((connection, index) => {
                const Icon = getIcon(connection.accountType);
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 ${connection.color} rounded-full flex items-center justify-center`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{connection.institutionName}</p>
                        <p className="text-gray-400 text-sm">
                          {connection.isActive ? 'Connected' : 'Disconnected'}
                        </p>
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${
                      connection.isActive ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <AddAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
