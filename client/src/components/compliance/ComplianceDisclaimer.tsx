/**
 * Compliance Disclaimer Component
 * Displays important legal disclaimers about Flint's role
 */

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle, Info, Lock, Eye, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ComplianceDisclaimerProps {
  type?: 'trading' | 'connect' | 'data' | 'general';
  compact?: boolean;
  onAccept?: () => void;
  showOnce?: boolean;
}

export function ComplianceDisclaimer({ 
  type = 'general', 
  compact = false,
  onAccept,
  showOnce = false
}: ComplianceDisclaimerProps) {
  const [accepted, setAccepted] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  
  // Check if disclaimer has been previously accepted
  useEffect(() => {
    if (showOnce) {
      const key = `disclaimer_accepted_${type}`;
      const previouslyAccepted = localStorage.getItem(key);
      if (previouslyAccepted) {
        setAccepted(true);
      } else {
        setShowDialog(true);
      }
    }
  }, [type, showOnce]);

  const handleAccept = () => {
    setAccepted(true);
    if (showOnce) {
      localStorage.setItem(`disclaimer_accepted_${type}`, 'true');
    }
    setShowDialog(false);
    onAccept?.();
  };

  const disclaimers = {
    trading: {
      title: 'Trading Disclaimer',
      icon: AlertTriangle,
      content: (
        <div className="space-y-4 text-sm">
          <div className="font-semibold text-yellow-600 dark:text-yellow-400">
            Important Trading Information
          </div>
          <ul className="space-y-2 list-disc list-inside text-gray-600 dark:text-gray-400">
            <li>Flint displays and routes orders through your connected broker accounts</li>
            <li>Flint is NOT a broker-dealer or custodian of your assets</li>
            <li>All trades are executed directly with your chosen brokerage</li>
            <li>Your assets remain with your broker at all times</li>
            <li>Trading involves risk and you may lose money</li>
            <li>Past performance does not guarantee future results</li>
          </ul>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs">
              By using Flint's trading features, you acknowledge that all investment decisions are your own and 
              Flint does not provide investment advice or recommendations.
            </p>
          </div>
        </div>
      )
    },
    connect: {
      title: 'Account Connection Security',
      icon: Lock,
      content: (
        <div className="space-y-4 text-sm">
          <div className="font-semibold text-blue-600 dark:text-blue-400">
            How We Protect Your Connections
          </div>
          <ul className="space-y-2 list-disc list-inside text-gray-600 dark:text-gray-400">
            <li>All credentials are encrypted using AES-256-GCM encryption</li>
            <li>We use OAuth 2.0 and secure token exchange when available</li>
            <li>Tokens are encrypted at rest and in transit</li>
            <li>You can revoke access at any time from Settings</li>
            <li>We never store your banking passwords directly</li>
            <li>Regular security audits and token rotation</li>
          </ul>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs">
              Flint uses bank-level security through Teller.io for banking connections and SnapTrade for brokerage connections, 
              both of which are regulated financial data providers.
            </p>
          </div>
        </div>
      )
    },
    data: {
      title: 'Data Privacy & Security',
      icon: Eye,
      content: (
        <div className="space-y-4 text-sm">
          <div className="font-semibold text-green-600 dark:text-green-400">
            Your Data, Your Control
          </div>
          <ul className="space-y-2 list-disc list-inside text-gray-600 dark:text-gray-400">
            <li>Your financial data is encrypted end-to-end</li>
            <li>We never sell or share your personal information</li>
            <li>Data is stored in SOC 2 compliant infrastructure</li>
            <li>You can export all your data at any time</li>
            <li>You can delete your account and all data permanently</li>
            <li>We comply with GDPR and CCPA regulations</li>
          </ul>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-xs">
              Flint processes data in accordance with financial industry standards and regulatory requirements. 
              Your data remains yours and can be removed at any time.
            </p>
          </div>
        </div>
      )
    },
    general: {
      title: 'Important Legal Disclaimers',
      icon: Shield,
      content: (
        <div className="space-y-4 text-sm">
          <div className="font-semibold text-purple-600 dark:text-purple-400">
            Understanding Flint's Role
          </div>
          
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h4 className="font-medium mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                NOT a Financial Advisor
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Flint does not provide investment advice, recommendations, or financial planning services. 
                All investment decisions are solely yours.
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h4 className="font-medium mb-1 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                NOT a Custodian
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Flint never holds or has custody of your assets. Your money and investments remain with your 
                chosen financial institutions at all times.
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h4 className="font-medium mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                NOT a Broker-Dealer
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Flint is a technology platform that displays information and routes orders to your connected brokers. 
                We are not registered as a broker-dealer or investment adviser.
              </p>
            </div>
          </div>

          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <p className="text-xs font-medium mb-2">What Flint DOES provide:</p>
            <ul className="text-xs space-y-1 list-disc list-inside text-gray-600 dark:text-gray-400">
              <li>Unified dashboard for viewing accounts</li>
              <li>Order routing to your connected brokers</li>
              <li>Financial data aggregation and visualization</li>
              <li>Transaction history and reporting tools</li>
              <li>Secure credential storage and management</li>
            </ul>
          </div>

          <div className="text-xs text-gray-500 pt-2 border-t">
            By using Flint, you acknowledge and agree to these terms. For complete terms and conditions, 
            please review our <a href="/terms" className="underline">Terms of Service</a> and{' '}
            <a href="/privacy" className="underline">Privacy Policy</a>.
          </div>
        </div>
      )
    }
  };

  const disclaimer = disclaimers[type];
  const Icon = disclaimer.icon;

  if (compact) {
    return (
      <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
        <Icon className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {type === 'trading' && 'Flint routes orders through your broker. Not investment advice.'}
          {type === 'connect' && 'Credentials are encrypted. You control access.'}
          {type === 'data' && 'Your data is encrypted and never sold.'}
          {type === 'general' && 'Flint is not a financial advisor, custodian, or broker.'}
          <Button 
            variant="link" 
            size="sm" 
            className="ml-2 p-0 h-auto text-xs"
            onClick={() => setShowDialog(true)}
          >
            Learn more
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (showDialog && !accepted) {
    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {disclaimer.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh] pr-4">
            {disclaimer.content}
          </ScrollArea>
          <DialogFooter className="flex-col gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="acknowledge" 
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(!!checked)}
              />
              <label 
                htmlFor="acknowledge" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I understand and acknowledge these terms
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAccept} 
                disabled={!accepted}
              >
                Accept & Continue
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {disclaimer.title}
        </CardTitle>
        <CardDescription>
          Please review these important disclosures
        </CardDescription>
      </CardHeader>
      <CardContent>
        {disclaimer.content}
      </CardContent>
    </Card>
  );
}

// Export a minimal footer disclaimer for all pages
export function FooterDisclaimer() {
  return (
    <div className="mt-auto py-4 px-6 border-t bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3" />
          <span>Not a financial advisor • Not a custodian • Not a broker</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/terms" className="hover:underline">Terms</a>
          <a href="/privacy" className="hover:underline">Privacy</a>
          <a href="/security" className="hover:underline">Security</a>
        </div>
      </div>
    </div>
  );
}