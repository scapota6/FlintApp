import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStripe, useElements, PaymentElement, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import Navigation from "@/components/layout/navigation";
import MobileNav from "@/components/layout/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { StripeAPI, SUBSCRIPTION_TIERS } from "@/lib/stripe";
import { Check, Crown, Star, Zap } from "lucide-react";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

const SubscribeForm = ({ tier }: { tier: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: "You are now subscribed!",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement className="text-white" />
      <Button
        type="submit"
        disabled={!stripe}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
      >
        Subscribe to {tier}
      </Button>
    </form>
  );
};

export default function Subscribe() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch user data to check current subscription
  const { data: userData, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Handle unauthorized errors
  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 2000);
    }
  }, [error, toast]);

  const handleSelectTier = async (tierId: string) => {
    setSelectedTier(tierId);
    setIsProcessing(true);

    try {
      const response = await StripeAPI.createSubscription(tierId);
      setClientSecret(response.clientSecret);
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'basic':
        return <Star className="h-6 w-6" />;
      case 'pro':
        return <Zap className="h-6 w-6" />;
      case 'premium':
        return <Crown className="h-6 w-6" />;
      default:
        return <Star className="h-6 w-6" />;
    }
  };

  const getTierColor = (tierId: string) => {
    switch (tierId) {
      case 'basic':
        return 'text-blue-500';
      case 'pro':
        return 'text-purple-500';
      case 'premium':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  const currentTier = userData?.subscriptionTier;
  const subscriptionStatus = userData?.subscriptionStatus;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
        <div className="mb-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-gray-400 text-lg">Unlock the full potential of Flint with our premium features</p>
        </div>

        {/* Current Subscription Status */}
        {currentTier && (
          <div className="mb-8">
            <Card className="trade-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`${getTierColor(currentTier)}`}>
                      {getTierIcon(currentTier)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Current Plan: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                      </h3>
                      <p className="text-gray-400">
                        Status: {subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={subscriptionStatus === 'active' ? 'default' : 'destructive'}>
                    {subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {SUBSCRIPTION_TIERS.map((tier) => (
            <Card 
              key={tier.id}
              className={`trade-card relative ${
                tier.id === 'pro' ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {tier.id === 'pro' && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center">
                <div className={`mx-auto mb-4 ${getTierColor(tier.id)}`}>
                  {getTierIcon(tier.id)}
                </div>
                <CardTitle className="text-2xl font-bold text-white">{tier.name}</CardTitle>
                <div className="text-4xl font-bold text-white mb-2">
                  ${tier.price}
                  <span className="text-lg font-normal text-gray-400">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-center space-x-3">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleSelectTier(tier.id)}
                  disabled={isProcessing || currentTier === tier.id}
                  className={`w-full ${
                    tier.id === 'pro' 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  } text-white py-3 text-lg font-semibold`}
                >
                  {isProcessing && selectedTier === tier.id ? (
                    'Processing...'
                  ) : currentTier === tier.id ? (
                    'Current Plan'
                  ) : (
                    'Select Plan'
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment Form */}
        {clientSecret && selectedTier && (
          <div className="max-w-md mx-auto">
            <Card className="trade-card">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white text-center">
                  Complete Your Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <SubscribeForm tier={selectedTier} />
                </Elements>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Features Comparison */}
        <div className="mt-16">
          <Card className="trade-card">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-white text-center">
                Feature Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 text-gray-400">Feature</th>
                      <th className="text-center py-3 text-gray-400">Basic</th>
                      <th className="text-center py-3 text-gray-400">Pro</th>
                      <th className="text-center py-3 text-gray-400">Premium</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Account Connections</td>
                      <td className="text-center py-3 text-gray-400">Up to 3</td>
                      <td className="text-center py-3 text-gray-400">Up to 10</td>
                      <td className="text-center py-3 text-gray-400">Unlimited</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Portfolio Tracking</td>
                      <td className="text-center py-3">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                      <td className="text-center py-3">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                      <td className="text-center py-3">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Advanced Analytics</td>
                      <td className="text-center py-3 text-gray-600">-</td>
                      <td className="text-center py-3">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                      <td className="text-center py-3">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Real-time Alerts</td>
                      <td className="text-center py-3 text-gray-600">-</td>
                      <td className="text-center py-3">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                      <td className="text-center py-3">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-3 text-white">Priority Support</td>
                      <td className="text-center py-3 text-gray-600">-</td>
                      <td className="text-center py-3">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                      <td className="text-center py-3">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 text-white">Advanced Trading Tools</td>
                      <td className="text-center py-3 text-gray-600">-</td>
                      <td className="text-center py-3 text-gray-600">-</td>
                      <td className="text-center py-3">
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
