import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle, Loader2, Zap, Shield, TrendingUp } from 'lucide-react';

interface ConnectionStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  duration?: number;
  icon?: any;
}

interface ConnectionStorytellerProps {
  isActive: boolean;
  connectionType: 'bank' | 'brokerage';
  onComplete?: () => void;
  onError?: (error: string) => void;
}

const bankSteps: ConnectionStep[] = [
  {
    id: 'init',
    title: 'Initializing Connection',
    description: 'Preparing secure channel with Teller.io...',
    icon: Shield,
    duration: 1500
  },
  {
    id: 'auth',
    title: 'Authenticating',
    description: 'Verifying your credentials securely...',
    icon: Zap,
    duration: 2000
  },
  {
    id: 'fetch',
    title: 'Fetching Account Data',
    description: 'Retrieving your account information...',
    icon: TrendingUp,
    duration: 2500
  },
  {
    id: 'complete',
    title: 'Connection Established',
    description: 'Your bank account is now connected!',
    icon: CheckCircle,
    duration: 1000
  }
];

const brokerageSteps: ConnectionStep[] = [
  {
    id: 'init',
    title: 'Preparing SnapTrade Connection',
    description: 'Setting up secure brokerage connection...',
    icon: Shield,
    duration: 1500
  },
  {
    id: 'auth',
    title: 'Generating Login Portal',
    description: 'Creating secure authentication link...',
    icon: Zap,
    duration: 2000
  },
  {
    id: 'redirect',
    title: 'Opening SnapTrade Portal',
    description: 'Redirecting to secure connection portal...',
    icon: TrendingUp,
    duration: 1500
  },
  {
    id: 'complete',
    title: 'Portal Ready',
    description: 'Ready to connect your brokerage accounts!',
    icon: CheckCircle,
    duration: 1000
  }
];

export function ConnectionStoryTeller({ isActive, connectionType, onComplete, onError }: ConnectionStorytellerProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const steps = connectionType === 'bank' ? bankSteps : brokerageSteps;
  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (!isActive) {
      setCurrentStepIndex(0);
      setProgress(0);
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    const totalSteps = steps.length;
    let stepTimer: NodeJS.Timeout;
    let progressTimer: NodeJS.Timeout;

    const animateStep = (stepIndex: number) => {
      if (stepIndex >= totalSteps) {
        setProgress(100);
        setIsAnimating(false);
        onComplete?.();
        return;
      }

      const step = steps[stepIndex];
      setCurrentStepIndex(stepIndex);

      // Animate progress for this step
      const stepProgress = (stepIndex / totalSteps) * 100;
      const nextStepProgress = ((stepIndex + 1) / totalSteps) * 100;
      
      let currentProgress = stepProgress;
      const progressIncrement = (nextStepProgress - stepProgress) / (step.duration || 1000) * 50;

      progressTimer = setInterval(() => {
        currentProgress += progressIncrement;
        if (currentProgress >= nextStepProgress) {
          currentProgress = nextStepProgress;
          clearInterval(progressTimer);
        }
        setProgress(currentProgress);
      }, 50);

      stepTimer = setTimeout(() => {
        clearInterval(progressTimer);
        animateStep(stepIndex + 1);
      }, step.duration || 1000);
    };

    animateStep(0);

    return () => {
      clearTimeout(stepTimer);
      clearInterval(progressTimer);
    };
  }, [isActive, steps, onComplete]);

  if (!isActive) return null;

  const getStepStatus = (stepIndex: number): 'pending' | 'active' | 'completed' | 'error' => {
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  const getStatusIcon = (status: string, StepIcon: any) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'active':
        return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-600';
      case 'active':
        return 'bg-blue-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-gray-900 border-gray-700">
      <CardContent className="p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">
            Connecting {connectionType === 'bank' ? 'Bank Account' : 'Brokerage Account'}
          </h3>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-400 mt-2">{Math.round(progress)}% complete</p>
        </div>

        {/* Current Step Highlight */}
        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-600">
          <div className="flex items-center space-x-3">
            {getStatusIcon(getStepStatus(currentStepIndex), currentStep?.icon)}
            <div className="flex-1">
              <h4 className="text-white font-medium">{currentStep?.title}</h4>
              <p className="text-gray-300 text-sm">{currentStep?.description}</p>
            </div>
            <Badge className={getStatusColor(getStepStatus(currentStepIndex))}>
              {getStepStatus(currentStepIndex)}
            </Badge>
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const status = getStepStatus(index);
            const StepIcon = step.icon || Clock;
            
            return (
              <div
                key={step.id}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-300 ${
                  status === 'active' 
                    ? 'bg-blue-900/30 border border-blue-700' 
                    : status === 'completed'
                    ? 'bg-green-900/20 border border-green-700'
                    : 'bg-gray-800/50'
                }`}
              >
                <div className="flex-shrink-0">
                  {getStatusIcon(status, StepIcon)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    status === 'completed' ? 'text-green-300' :
                    status === 'active' ? 'text-blue-300' :
                    'text-gray-400'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {step.description}
                  </p>
                </div>
                {status === 'active' && (
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            {isAnimating ? 'Please wait while we establish your connection...' : 'Connection process complete!'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}