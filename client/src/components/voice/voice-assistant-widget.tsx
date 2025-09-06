import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  X, 
  Loader2,
  MessageSquare,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { processVoiceCommand } from '@/services/voice-command-processor';
import { useLocation } from 'wouter';

interface VoiceAssistantWidgetProps {
  onCommandExecuted?: (command: string, result: any) => void;
}

export default function VoiceAssistantWidget({ onCommandExecuted }: VoiceAssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setTranscript(transcript);
        
        if (event.results[current].isFinal) {
          handleCommand(transcript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        // Speech recognition error handled
        setIsListening(false);
        if (event.error === 'no-speech') {
          toast({
            title: "No speech detected",
            description: "Please try speaking again",
            variant: "destructive"
          });
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [toast]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setResponse('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleCommand = async (command: string) => {
    setIsProcessing(true);
    
    try {
      const result = await processVoiceCommand(command, {
        navigate: setLocation,
        toast
      });
      
      setResponse(result.response);
      
      if (result.speak) {
        speak(result.response);
      }
      
      if (onCommandExecuted) {
        onCommandExecuted(command, result);
      }
    } catch (error) {
      // Error processing command handled
      const errorMessage = "Sorry, I couldn't process that command. Please try again.";
      setResponse(errorMessage);
      speak(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      synthRef.current = new SpeechSynthesisUtterance(text);
      synthRef.current.rate = 1.0;
      synthRef.current.pitch = 1.0;
      synthRef.current.volume = 1.0;
      
      window.speechSynthesis.speak(synthRef.current);
    }
  };

  const toggleWidget = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      stopListening();
      window.speechSynthesis.cancel();
    }
  };

  // Check for browser support
  const isSupported = typeof window !== 'undefined' && 'webkitSpeechRecognition' in window;

  if (!isSupported) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      <motion.div
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <Button
          onClick={toggleWidget}
          size="lg"
          className="rounded-full w-14 h-14 shadow-lg bg-primary hover:bg-primary/90"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        </Button>
      </motion.div>

      {/* Voice Assistant Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-40 right-4 md:bottom-24 md:right-6 z-50 w-80 md:w-96"
          >
            <Card className="bg-background/95 backdrop-blur-lg shadow-2xl border-primary/20">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Financial Assistant</h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Voice Enabled
                  </Badge>
                </div>

                {/* Voice Visualization */}
                <div className="flex justify-center mb-6">
                  <motion.div
                    className="relative"
                    animate={isListening ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
                      isListening ? 'bg-primary/20' : 'bg-muted'
                    } transition-colors`}>
                      {isProcessing ? (
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      ) : isListening ? (
                        <Mic className="h-10 w-10 text-primary" />
                      ) : (
                        <MicOff className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    {isListening && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-primary/20"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* Transcript */}
                {transcript && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm">{transcript}</p>
                    </div>
                  </div>
                )}

                {/* Response */}
                {response && (
                  <div className="mb-4 p-3 bg-primary/10 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Volume2 className="h-4 w-4 text-primary mt-0.5" />
                      <p className="text-sm">{response}</p>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isListening ? (
                    <>
                      <MicOff className="h-5 w-5 mr-2" />
                      Stop Listening
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5 mr-2" />
                      Start Listening
                    </>
                  )}
                </Button>

                {/* Example Commands */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Try saying:</p>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">• "What's my total balance?"</p>
                    <p className="text-xs text-muted-foreground">• "Show me Apple stock"</p>
                    <p className="text-xs text-muted-foreground">• "Add Tesla to watchlist"</p>
                    <p className="text-xs text-muted-foreground">• "Buy 10 shares of Microsoft"</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}