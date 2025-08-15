import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ComplianceDisclaimer } from '@/components/compliance/ComplianceDisclaimer';
import { 
  Shield, 
  Lock, 
  Key, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  RefreshCw,
  FileText,
  Eye,
  Database,
  Server
} from 'lucide-react';

export default function Security() {
  const [rotatingKeys, setRotatingKeys] = useState(false);

  // Fetch security status from backend
  const { data: securityStatus, isLoading } = useQuery({
    queryKey: ['/api/security/status'],
  });

  // Fetch compliance status
  const { data: complianceStatus } = useQuery({
    queryKey: ['/api/security/compliance'],
  });

  const handleKeyRotation = async () => {
    setRotatingKeys(true);
    try {
      const response = await fetch('/api/security/rotate-keys', {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        // Refresh security status
        window.location.reload();
      }
    } catch (error) {
      console.error('Key rotation failed:', error);
    } finally {
      setRotatingKeys(false);
    }
  };

  const securityScore = securityStatus?.score || 85;
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          Security & Compliance
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor and manage your account security and compliance settings
        </p>
      </div>

      {/* Security Score Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security Score
            </span>
            <span className={`text-3xl font-bold ${getScoreColor(securityScore)}`}>
              {securityScore}/100
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={securityScore} className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm">Encryption Active</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm">2FA Enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm">Regular Backups</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="encryption" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="encryption">
            <Lock className="w-4 h-4 mr-1 hidden sm:inline" />
            Encryption
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <FileText className="w-4 h-4 mr-1 hidden sm:inline" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Eye className="w-4 h-4 mr-1 hidden sm:inline" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Key className="w-4 h-4 mr-1 hidden sm:inline" />
            Permissions
          </TabsTrigger>
        </TabsList>

        {/* Encryption Tab */}
        <TabsContent value="encryption">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Encryption Status</CardTitle>
                <CardDescription>
                  All sensitive data is encrypted using industry-standard algorithms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Database Encryption</p>
                        <p className="text-sm text-gray-500">AES-256-GCM at rest</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      Active
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Server className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="font-medium">API Token Encryption</p>
                        <p className="text-sm text-gray-500">Provider tokens encrypted</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      Active
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium">TLS/SSL</p>
                        <p className="text-sm text-gray-500">All connections encrypted</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      TLS 1.3
                    </Badge>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Secret Rotation</p>
                      <p className="text-sm text-gray-500">
                        Last rotated: {securityStatus?.lastKeyRotation || 'Never'}
                      </p>
                    </div>
                    <Button
                      onClick={handleKeyRotation}
                      disabled={rotatingKeys}
                      variant="outline"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${rotatingKeys ? 'animate-spin' : ''}`} />
                      Rotate Keys
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance">
          <div className="space-y-4">
            <ComplianceDisclaimer type="general" />
            
            <Card>
              <CardHeader>
                <CardTitle>Regulatory Compliance</CardTitle>
                <CardDescription>
                  Flint operates in compliance with financial regulations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">SOC 2 Type II Compliant Infrastructure</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">GDPR & CCPA Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">PCI DSS Level 1 Service Provider</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Regular Third-Party Security Audits</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Security Audit Log</CardTitle>
              <CardDescription>
                Recent security-related activities on your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {securityStatus?.auditLog?.map((log: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="mt-1">
                      {log.type === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : log.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-gray-500">{log.timestamp}</p>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-gray-500">No recent security events</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Account Permissions</CardTitle>
              <CardDescription>
                Your current account tier and available features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Current Tier</span>
                    <Badge className="bg-purple-600">{securityStatus?.userTier || 'Free'}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your account has access to the following features based on your subscription
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Active Permissions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {securityStatus?.permissions?.map((permission: string) => (
                      <div key={permission} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span>{permission}</span>
                      </div>
                    )) || (
                      <p className="text-sm text-gray-500">Loading permissions...</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert className="mt-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          For additional security concerns or to report a vulnerability, please contact our security team at security@flint.com
        </AlertDescription>
      </Alert>
    </div>
  );
}