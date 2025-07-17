import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, Shield, Smartphone } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Flint</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={handleLogin} className="bg-blue-600 hover:bg-blue-700">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Your Financial Life,<br />Unified
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Connect all your accounts, trade seamlessly, and manage your wealth with our comprehensive financial platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={handleLogin}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
            >
              Get Started
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-gray-600 text-white hover:bg-gray-800 px-8 py-3 text-lg"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold mb-4">Everything You Need</h3>
            <p className="text-gray-400 text-lg">Powerful tools to manage your financial future</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <Wallet className="h-8 w-8 text-blue-500 mb-2" />
                <CardTitle className="text-white">Account Aggregation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">Connect banks, brokerages, and crypto accounts in one place</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-green-500 mb-2" />
                <CardTitle className="text-white">Trading</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">Trade stocks and crypto with advanced tools and real-time data</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <Shield className="h-8 w-8 text-purple-500 mb-2" />
                <CardTitle className="text-white">Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">Bank-level encryption and security for all your data</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <Smartphone className="h-8 w-8 text-yellow-500 mb-2" />
                <CardTitle className="text-white">Mobile First</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">Optimized for mobile with a responsive design</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold mb-4">Choose Your Plan</h3>
            <p className="text-gray-400 text-lg">Start with any plan and upgrade as you grow</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Basic Plan */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Basic</CardTitle>
                  <Badge variant="outline" className="border-gray-600 text-gray-400">Most Popular</Badge>
                </div>
                <div className="text-3xl font-bold text-white">$39.99<span className="text-lg font-normal text-gray-400">/month</span></div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-400">
                  <li>• Connect up to 3 accounts</li>
                  <li>• Basic portfolio tracking</li>
                  <li>• Email support</li>
                  <li>• Mobile app access</li>
                </ul>
                <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700" onClick={handleLogin}>
                  Get Started
                </Button>
              </CardContent>
            </Card>
            
            {/* Pro Plan */}
            <Card className="bg-gray-800 border-gray-700 ring-2 ring-blue-500">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Pro</CardTitle>
                  <Badge className="bg-blue-600 text-white">Recommended</Badge>
                </div>
                <div className="text-3xl font-bold text-white">$45.00<span className="text-lg font-normal text-gray-400">/month</span></div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-400">
                  <li>• Connect up to 10 accounts</li>
                  <li>• Advanced analytics</li>
                  <li>• Real-time alerts</li>
                  <li>• Priority support</li>
                  <li>• API access</li>
                </ul>
                <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700" onClick={handleLogin}>
                  Get Started
                </Button>
              </CardContent>
            </Card>
            
            {/* Premium Plan */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Premium</CardTitle>
                  <Badge variant="outline" className="border-gray-600 text-gray-400">Enterprise</Badge>
                </div>
                <div className="text-3xl font-bold text-white">$49.99<span className="text-lg font-normal text-gray-400">/month</span></div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-400">
                  <li>• Unlimited accounts</li>
                  <li>• Advanced trading tools</li>
                  <li>• Custom alerts</li>
                  <li>• Phone support</li>
                  <li>• Early access features</li>
                  <li>• Tax optimization</li>
                </ul>
                <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700" onClick={handleLogin}>
                  Get Started
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h4 className="text-lg font-semibold text-white mb-4">Flint</h4>
            <p className="text-gray-400">Your financial future starts here.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
