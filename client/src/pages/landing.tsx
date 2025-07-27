import { motion } from "framer-motion";
import { PageTransition, FadeTransition, SlideUpTransition, ScaleTransition } from "@/components/auth/page-transition";
import { SparkleTitle } from "@/components/auth/sparkle-animation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, 
  Shield, 
  Zap, 
  BarChart3, 
  Globe, 
  Users,
  ArrowRight,
  Star
} from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: TrendingUp,
      title: "Smart Trading",
      description: "Execute trades across multiple brokerages with intelligent routing and real-time market data."
    },
    {
      icon: Shield,
      title: "Bank-Level Security",
      description: "Your financial data is protected with enterprise-grade encryption and security protocols."
    },
    {
      icon: BarChart3,
      title: "Portfolio Analytics",
      description: "Advanced analytics and insights to help you make informed investment decisions."
    },
    {
      icon: Globe,
      title: "Multi-Account Support",
      description: "Connect banks, brokerages, and crypto wallets in one unified dashboard."
    }
  ];

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <PageTransition className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white overflow-hidden">
      {/* Hero Section */}
      <div className="relative">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-transparent to-blue-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <FadeTransition>
              <SparkleTitle>
                Welcome to Flint
              </SparkleTitle>
            </FadeTransition>
            
            <SlideUpTransition delay={0.2}>
              <p className="mt-6 text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Your comprehensive financial command center. Trade smart, track everything, 
                and take control of your financial future with cutting-edge technology.
              </p>
            </SlideUpTransition>

            <ScaleTransition delay={0.4}>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={handleLogin}
                  className="btn-standard bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 text-lg btn-glow-hover group"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                
                <Button 
                  variant="outline"
                  className="btn-standard border-purple-400 text-purple-400 hover:bg-purple-400/10 px-8 py-4 text-lg"
                >
                  Learn More
                </Button>
              </div>
            </ScaleTransition>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-gradient-to-b from-transparent to-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeTransition delay={0.6}>
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">
                Everything you need to manage your wealth
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Powerful tools and insights designed for modern investors and traders.
              </p>
            </div>
          </FadeTransition>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <SlideUpTransition key={feature.title} delay={0.8 + index * 0.1}>
                <motion.div
                  whileHover={{ 
                    scale: 1.05,
                    y: -5
                  }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <Card className="flint-card h-full border border-gray-800 hover:border-purple-500/50 transition-all duration-300">
                    <CardContent className="p-6 text-center h-full flex flex-col">
                      <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                        <feature.icon className="h-6 w-6 text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-3">
                        {feature.title}
                      </h3>
                      <p className="text-gray-400 text-sm flex-grow">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </SlideUpTransition>
            ))}
          </div>
        </div>
      </div>

      {/* Social Proof Section */}
      <div className="py-16 bg-gradient-to-b from-gray-900/50 to-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeTransition delay={1.2}>
            <div className="flex items-center justify-center gap-8 text-gray-400">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span className="text-sm">10,000+ Active Users</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <span className="text-sm">4.9/5 Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <span className="text-sm">Bank-Level Security</span>
              </div>
            </div>
          </FadeTransition>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-20 bg-gradient-to-t from-purple-900/10 to-transparent">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <SlideUpTransition delay={1.4}>
            <h2 className="text-3xl font-bold text-white mb-6">
              Ready to transform your financial future?
            </h2>
            <p className="text-gray-300 mb-8 text-lg">
              Join thousands of investors who trust Flint for their financial management.
            </p>
            <Button 
              onClick={handleLogin}
              className="btn-standard bg-purple-600 hover:bg-purple-700 text-white px-12 py-4 text-lg btn-glow-hover group"
            >
              Start Trading Today
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </SlideUpTransition>
        </div>
      </div>
    </PageTransition>
  );
}