import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Clock,
  Database,
  Server,
  Cpu,
  HardDrive,
  Zap,
  TrendingUp,
  Info
} from 'lucide-react';

interface ServiceStatus {
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  message?: string;
  lastCheck?: string;
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: {
    app: string;
    node: string;
    dependencies: Record<string, string>;
  };
  services: {
    database: ServiceStatus;
    snaptrade: ServiceStatus;
    teller: ServiceStatus;
    polygon: ServiceStatus;
    finnhub: ServiceStatus;
    stripe: ServiceStatus;
    encryption: ServiceStatus;
    alertMonitor: ServiceStatus;
  };
  performance: {
    memoryUsage: any;
    cpuUsage: any;
  };
}

export default function Monitoring() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch health status
  const { data: healthData, isLoading, error, refetch } = useQuery<HealthCheckResult>({
    queryKey: ['/api/health'],
    refetchInterval: autoRefresh ? 10000 : false, // Refresh every 10 seconds if auto-refresh is on
  });

  // Fetch job queue status
  const { data: jobsData } = useQuery({
    queryKey: ['/api/health/jobs'],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'operational':
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'down':
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'operational':
      case 'healthy':
      case 'running':
        return <Badge className="bg-green-500 text-white">Operational</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500 text-white">Degraded</Badge>;
      case 'down':
      case 'unhealthy':
      case 'stopped':
        return <Badge className="bg-red-500 text-white">Down</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white">Unknown</Badge>;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 max-w-7xl">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load monitoring data. Please refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            System Monitoring
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
            </Button>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time health monitoring and system status
        </p>
      </div>

      {/* Overall Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(healthData?.status)}
              System Status
            </CardTitle>
            {getStatusBadge(healthData?.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Uptime</p>
              <p className="text-lg font-semibold">
                {healthData?.uptime ? formatUptime(healthData.uptime) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">App Version</p>
              <p className="text-lg font-semibold">{healthData?.version.app || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Node Version</p>
              <p className="text-lg font-semibold">{healthData?.version.node || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Check</p>
              <p className="text-lg font-semibold">
                {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="services">
            <Server className="w-4 h-4 mr-1 hidden sm:inline" />
            Services
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Activity className="w-4 h-4 mr-1 hidden sm:inline" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="jobs">
            <Clock className="w-4 h-4 mr-1 hidden sm:inline" />
            Background Jobs
          </TabsTrigger>
          <TabsTrigger value="dependencies">
            <Database className="w-4 h-4 mr-1 hidden sm:inline" />
            Dependencies
          </TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {healthData?.services && Object.entries(healthData.services).map(([name, service]) => (
              <Card key={name} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium capitalize">
                      {name.replace(/([A-Z])/g, ' $1').trim()}
                    </CardTitle>
                    {getStatusIcon(service.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getStatusBadge(service.status)}
                    {service.latency && (
                      <p className="text-xs text-gray-500">
                        Latency: {service.latency}ms
                      </p>
                    )}
                    {service.message && (
                      <p className="text-xs text-gray-500">
                        {service.message}
                      </p>
                    )}
                    {service.lastCheck && (
                      <p className="text-xs text-gray-400">
                        {new Date(service.lastCheck).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5" />
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthData?.performance.memoryUsage && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Heap Used</span>
                        <span>{formatBytes(healthData.performance.memoryUsage.heapUsed)}</span>
                      </div>
                      <Progress 
                        value={(healthData.performance.memoryUsage.heapUsed / healthData.performance.memoryUsage.heapTotal) * 100} 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Total Heap</span>
                        <span>{formatBytes(healthData.performance.memoryUsage.heapTotal)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>RSS</span>
                        <span>{formatBytes(healthData.performance.memoryUsage.rss)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>External</span>
                        <span>{formatBytes(healthData.performance.memoryUsage.external)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5" />
                  CPU Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthData?.performance.cpuUsage && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>User CPU Time</span>
                        <span>{(healthData.performance.cpuUsage.user / 1000000).toFixed(2)}s</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>System CPU Time</span>
                        <span>{(healthData.performance.cpuUsage.system / 1000000).toFixed(2)}s</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Background Jobs Tab */}
        <TabsContent value="jobs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobsData && Object.entries(jobsData).map(([jobName, jobInfo]: [string, any]) => (
              <Card key={jobName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg capitalize">
                      {jobName.replace(/([A-Z])/g, ' $1').trim()}
                    </CardTitle>
                    {getStatusBadge(jobInfo.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {jobInfo.lastRun && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Last Run:</span>
                        <span>{new Date(jobInfo.lastRun).toLocaleString()}</span>
                      </div>
                    )}
                    {jobInfo.nextRun && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Next Run:</span>
                        <span>{new Date(jobInfo.nextRun).toLocaleString()}</span>
                      </div>
                    )}
                    {jobInfo.processedCount !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Processed:</span>
                        <span className="font-semibold">{jobInfo.processedCount}</span>
                      </div>
                    )}
                    {jobInfo.errorCount !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Errors:</span>
                        <span className={`font-semibold ${jobInfo.errorCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {jobInfo.errorCount}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Dependencies Tab */}
        <TabsContent value="dependencies">
          <Card>
            <CardHeader>
              <CardTitle>Dependency Versions</CardTitle>
              <CardDescription>
                Current versions of major dependencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {healthData?.version.dependencies && Object.entries(healthData.version.dependencies).map(([name, version]) => (
                  <div key={name} className="flex justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="font-medium capitalize">{name}</span>
                    <Badge variant="outline">{version}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert className="mt-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          System monitoring refreshes automatically every 10 seconds when auto-refresh is enabled.
          For detailed logs and metrics, check the server logs.
        </AlertDescription>
      </Alert>
    </div>
  );
}