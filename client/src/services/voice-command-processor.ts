import { apiRequest } from '@/lib/queryClient';

interface CommandContext {
  navigate: (path: string) => void;
  toast: (options: any) => void;
}

interface CommandResult {
  response: string;
  action?: string;
  data?: any;
  speak?: boolean;
}

// Command patterns and their handlers
const commandPatterns = [
  {
    // Balance queries
    patterns: [/what['']?s my (?:total )?balance/i, /show (?:me )?my balance/i, /how much (?:money )?do i have/i],
    handler: async (match: RegExpMatchArray, context: CommandContext): Promise<CommandResult> => {
      try {
        const dashboardData = await apiRequest('GET', '/api/dashboard').then(res => res.json());
        const balance = dashboardData.totalBalance || 0;
        return {
          response: `Your total balance is ${formatCurrency(balance)}`,
          action: 'show_balance',
          data: { balance },
          speak: true
        };
      } catch (error) {
        return {
          response: "I couldn't fetch your balance right now. Please try again.",
          speak: true
        };
      }
    }
  },
  {
    // Stock price queries
    patterns: [
      /(?:what['']?s|show me) (?:the )?(?:price of |stock price for )?([A-Z]+|\w+)/i,
      /(?:how much is |price of )?([A-Z]+|\w+)(?: stock)?/i
    ],
    handler: async (match: RegExpMatchArray, context: CommandContext): Promise<CommandResult> => {
      const symbol = match[1].toUpperCase();
      try {
        const quote = await apiRequest('GET', `/api/quotes/${symbol}`).then(res => res.json());
        context.navigate(`/asset/${symbol}`);
        return {
          response: `${symbol} is currently trading at ${formatCurrency(quote.price)}. ${quote.changePct >= 0 ? 'Up' : 'Down'} ${Math.abs(quote.changePct).toFixed(2)}% today.`,
          action: 'show_stock',
          data: { symbol, price: quote.price },
          speak: true
        };
      } catch (error) {
        return {
          response: `I couldn't find information for ${symbol}. Please check the symbol and try again.`,
          speak: true
        };
      }
    }
  },
  {
    // Add to watchlist
    patterns: [/add ([A-Z]+|\w+) to (?:my )?watchlist/i],
    handler: async (match: RegExpMatchArray, context: CommandContext): Promise<CommandResult> => {
      const symbol = match[1].toUpperCase();
      try {
        await apiRequest('POST', '/api/watchlist', {
          symbol,
          name: symbol,
          type: 'stock'
        });
        context.toast({
          title: "Added to Watchlist",
          description: `${symbol} has been added to your watchlist`
        });
        return {
          response: `I've added ${symbol} to your watchlist.`,
          action: 'add_watchlist',
          data: { symbol },
          speak: true
        };
      } catch (error) {
        return {
          response: `I couldn't add ${symbol} to your watchlist. It might already be there.`,
          speak: true
        };
      }
    }
  },
  {
    // Navigation commands
    patterns: [
      /(?:go to |show me |open )?(?:my )?portfolio/i,
      /(?:go to |show me |open )?(?:my )?dashboard/i,
      /(?:go to |show me |open )?(?:my )?watchlist/i
    ],
    handler: async (match: RegExpMatchArray, context: CommandContext): Promise<CommandResult> => {
      const command = match[0].toLowerCase();
      let destination = '/dashboard';
      let locationName = 'dashboard';
      
      if (command.includes('portfolio')) {
        destination = '/portfolio';
        locationName = 'portfolio';
      } else if (command.includes('watchlist')) {
        destination = '/watchlist';
        locationName = 'watchlist';
      }
      
      context.navigate(destination);
      return {
        response: `Opening your ${locationName}.`,
        action: 'navigate',
        data: { destination },
        speak: true
      };
    }
  },
  {
    // Trading commands
    patterns: [/(?:buy|purchase) (\d+) (?:shares? of )?([A-Z]+|\w+)/i],
    handler: async (match: RegExpMatchArray, context: CommandContext): Promise<CommandResult> => {
      const quantity = parseInt(match[1]);
      const symbol = match[2].toUpperCase();
      
      context.navigate(`/asset/${symbol}`);
      context.toast({
        title: "Trade Request",
        description: `Opening trade form to buy ${quantity} shares of ${symbol}`
      });
      
      return {
        response: `Opening the trade form to buy ${quantity} shares of ${symbol}. Please confirm the order details.`,
        action: 'trade',
        data: { action: 'buy', quantity, symbol },
        speak: true
      };
    }
  },
  {
    // Holdings query
    patterns: [/(?:show me |what are )?my (?:holdings|positions|investments)/i],
    handler: async (match: RegExpMatchArray, context: CommandContext): Promise<CommandResult> => {
      try {
        const holdings = await apiRequest('GET', '/api/holdings').then(res => res.json());
        const count = holdings.holdings?.length || 0;
        const totalValue = holdings.totalValue || 0;
        
        if (count === 0) {
          return {
            response: "You don't have any holdings at the moment.",
            speak: true
          };
        }
        
        return {
          response: `You have ${count} position${count > 1 ? 's' : ''} worth ${formatCurrency(totalValue)} in total.`,
          action: 'show_holdings',
          data: { count, totalValue },
          speak: true
        };
      } catch (error) {
        return {
          response: "I couldn't fetch your holdings right now. Please try again.",
          speak: true
        };
      }
    }
  },
  {
    // Recent transactions
    patterns: [/(?:show me |what are )?(?:my )?(?:recent |latest )?transactions/i],
    handler: async (match: RegExpMatchArray, context: CommandContext): Promise<CommandResult> => {
      context.navigate('/activity');
      return {
        response: "Opening your recent transactions.",
        action: 'show_transactions',
        speak: true
      };
    }
  },
  {
    // Help command
    patterns: [/(?:help|what can you do|commands)/i],
    handler: async (match: RegExpMatchArray, context: CommandContext): Promise<CommandResult> => {
      return {
        response: "I can help you check balances, view stock prices, manage your watchlist, navigate the app, and more. Try asking about your balance or a specific stock.",
        action: 'help',
        speak: true
      };
    }
  }
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function processVoiceCommand(
  command: string, 
  context: CommandContext
): Promise<CommandResult> {
  // Normalize the command
  const normalizedCommand = command.trim().toLowerCase();
  
  // Try to match against patterns
  for (const { patterns, handler } of commandPatterns) {
    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match) {
        return await handler(match, context);
      }
    }
  }
  
  // Default response for unrecognized commands
  return {
    response: "I didn't understand that command. Try asking about your balance, stock prices, or say 'help' for more options.",
    speak: true
  };
}