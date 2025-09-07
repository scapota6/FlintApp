import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Play,
  ChevronRight,
  Info,
  Zap,
  Shield,
  Target,
  Wrench
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ConnectionIssue {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'authentication' | 'network' | 'configuration' | 'api_limits' | 'account_status';
  title: string;
  description: string;
  affectedProvider: 'teller' | 'snaptrade' | 'both';
  affectedAccounts: string[];
  detectedAt: string;
  autoRepairAvailable: boolean;
  repairActions: RepairAction[];
  userMessage: string;
  technicalDetails?: any;
}

interface RepairAction {
  id: string;
  title: string;
  description: string;
  type: 'automatic' | 'guided' | 'manual';
  estimatedTime: string;
  riskLevel: 'safe' | 'moderate' | 'high';
  steps: RepairStep[];
}

interface RepairStep {
  id: string;
  title: string;
  description: string;
  type: 'api_call' | 'user_action' | 'verification';
  automated: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface DiagnosticsReport {
  overallHealth: 'healthy' | 'degraded' | 'critical';
  lastChecked: string;
  issues: ConnectionIssue[];
  recommendations: string[];
  accountStatus: {
    teller: {
      totalAccounts: number;
      connectedAccounts: number;
      failedAccounts: number;
      lastSuccessfulSync?: string;
    };
    snaptrade: {
      totalAccounts: number;
      connectedAccounts: number;
      failedAccounts: number;
      lastSuccessfulSync?: string;
    };
  };
}

interface TroubleshootingGuideProps {
  isOpen: boolean;
  onClose: () => void;
  initialIssue?: ConnectionIssue;
}

export function ConnectionTroubleshootingGuide({ 
  isOpen, 
  onClose, 
  initialIssue 
}: TroubleshootingGuideProps) {
  const [selectedIssue, setSelectedIssue] = useState<ConnectionIssue | null>(initialIssue || null);
  const [selectedAction, setSelectedAction] = useState<RepairAction | null>(null);
  const [activeSteps, setActiveSteps] = useState<Record<string, RepairStep>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch diagnostics report
  const { data: report, isLoading, refetch } = useQuery<DiagnosticsReport>({
    queryKey: ['/api/diagnostics/health'],
    queryFn: () => apiRequest('/api/diagnostics/health').then(r => r.json()),
    enabled: isOpen
  });

  // Execute repair action
  const repairMutation = useMutation({
    mutationFn: ({ issueId, actionId }: { issueId: string; actionId: string }) =>
      apiRequest('POST', '/api/diagnostics/repair', { issueId, actionId }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Repair Successful",
          description: data.message,
        });
        refetch();
      } else {
        toast({
          title: "Repair Failed", 
          description: data.message,
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Repair Error",
        description: "Failed to execute repair action. Please try again.",
        variant: "destructive"
      });
    }
  });

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'automatic':
        return <Zap className="h-4 w-4 text-green-500" />;
      case 'guided':
        return <Target className="h-4 w-4 text-blue-500" />;
      case 'manual':
        return <Wrench className="h-4 w-4 text-orange-500" />;
      default:
        return <Wrench className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'safe':
        return 'default';
      case 'moderate':
        return 'secondary';
      case 'high':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const executeStep = async (step: RepairStep) => {
    if (!selectedIssue || !selectedAction) return;
    
    setActiveSteps(prev => ({
      ...prev,
      [step.id]: { ...step, status: 'in_progress' }
    }));

    if (step.automated) {
      try {
        await repairMutation.mutateAsync({
          issueId: selectedIssue.id,
          actionId: selectedAction.id
        });
        
        setActiveSteps(prev => ({
          ...prev,
          [step.id]: { ...step, status: 'completed' }
        }));
      } catch (error) {
        setActiveSteps(prev => ({
          ...prev,
          [step.id]: { ...step, status: 'failed' }
        }));
      }
    } else {
      // For manual steps, just mark as completed after user action
      setTimeout(() => {
        setActiveSteps(prev => ({
          ...prev,
          [step.id]: { ...step, status: 'completed' }
        }));
      }, 1000);
    }
  };

  const executeAllSteps = async () => {
    if (!selectedAction) return;
    
    for (const step of selectedAction.steps) {
      await executeStep(step);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Connection Troubleshooting
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XCircle className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(90vh-8rem)]">
          <div className="p-6 space-y-6">
            
            {/* Health Overview */}
            {report && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {getHealthIcon(report.overallHealth)}
                    <span>Connection Health Overview</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refetch()}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Bank Accounts (Teller)</h4>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {report.accountStatus.teller.connectedAccounts} of {report.accountStatus.teller.totalAccounts} connected
                      </div>
                      <Progress 
                        value={report.accountStatus.teller.totalAccounts > 0 
                          ? (report.accountStatus.teller.connectedAccounts / report.accountStatus.teller.totalAccounts) * 100 
                          : 0} 
                        className="h-2" 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Brokerage Accounts (SnapTrade)</h4>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {report.accountStatus.snaptrade.connectedAccounts} of {report.accountStatus.snaptrade.totalAccounts} connected
                      </div>
                      <Progress 
                        value={report.accountStatus.snaptrade.totalAccounts > 0 
                          ? (report.accountStatus.snaptrade.connectedAccounts / report.accountStatus.snaptrade.totalAccounts) * 100 
                          : 0} 
                        className="h-2" 
                      />
                    </div>
                  </div>
                  
                  {report.recommendations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-sm mb-2">Recommendations</h4>
                      <div className="space-y-1">
                        {report.recommendations.map((rec, index) => (
                          <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                            • {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Issues List */}
            {report?.issues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Detected Issues ({report.issues.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {report.issues.map((issue) => (
                      <div
                        key={issue.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedIssue?.id === issue.id 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            {getIssueIcon(issue.type)}
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{issue.title}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {issue.userMessage}
                              </p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {issue.affectedProvider}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {issue.category}
                                </Badge>
                                {issue.autoRepairAvailable && (
                                  <Badge variant="default" className="text-xs">
                                    Auto-repair available
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Issue Details */}
            {selectedIssue && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {getIssueIcon(selectedIssue.type)}
                    <span>Issue Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Description</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedIssue.description}
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium text-sm mb-3">Available Solutions</h4>
                      <div className="space-y-3">
                        {selectedIssue.repairActions.map((action) => (
                          <div
                            key={action.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                              selectedAction?.id === action.id
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                            onClick={() => setSelectedAction(action)}
                          >
                            <div className="flex items-start space-x-3">
                              {getActionIcon(action.type)}
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h5 className="font-medium text-sm">{action.title}</h5>
                                  <Badge variant={getRiskBadgeVariant(action.riskLevel)} className="text-xs">
                                    {action.riskLevel} risk
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    ~{action.estimatedTime}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {action.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Repair Steps */}
            {selectedAction && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Repair Steps</span>
                    <Button 
                      onClick={executeAllSteps}
                      disabled={repairMutation.isPending}
                      className="ml-auto"
                    >
                      {repairMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {selectedAction.type === 'automatic' ? 'Run Automatic Fix' : 'Start Guided Fix'}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedAction.steps.map((step, index) => {
                      const activeStep = activeSteps[step.id] || step;
                      
                      return (
                        <div key={step.id} className="flex items-start space-x-4">
                          <div className="flex-shrink-0 mt-1">
                            {activeStep.status === 'completed' ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : activeStep.status === 'in_progress' ? (
                              <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                            ) : activeStep.status === 'failed' ? (
                              <XCircle className="h-5 w-5 text-red-500" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h6 className="font-medium text-sm">
                                Step {index + 1}: {step.title}
                              </h6>
                              {step.automated ? (
                                <Badge variant="outline" className="text-xs">Automated</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Manual</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {step.description}
                            </p>
                            
                            {!step.automated && activeStep.status === 'in_progress' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={() => executeStep(step)}
                              >
                                Mark as Completed
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Issues Found */}
            {report && report.issues.length === 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium">All connections are healthy!</div>
                  <div className="text-sm mt-1">
                    No issues detected with your financial account connections. 
                    Your bank and brokerage accounts are working properly.
                  </div>
                </AlertDescription>
              </Alert>
            )}

          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export default ConnectionTroubleshootingGuide;