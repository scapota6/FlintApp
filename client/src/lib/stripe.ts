import { apiRequest } from "./queryClient";

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  features: string[];
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 39.99,
    features: [
      'Connect up to 3 accounts',
      'Basic portfolio tracking',
      'Email support',
      'Mobile app access',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 45.00,
    features: [
      'Connect up to 10 accounts',
      'Advanced analytics',
      'Real-time alerts',
      'Priority support',
      'API access',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 49.99,
    features: [
      'Unlimited account connections',
      'Advanced trading tools',
      'Custom alerts',
      'Phone support',
      'Early access to features',
      'Tax optimization tools',
    ],
  },
];

export class StripeAPI {
  static async createSubscription(tier: string) {
    const response = await apiRequest("POST", "/api/create-subscription", { tier });
    return response.json();
  }
}
