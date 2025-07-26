import { BrokerageCompatibilityEngine, type Asset, type BrokerageInfo } from '@shared/brokerage-compatibility';
import { storage } from '../storage';
import { WalletService } from './WalletService';

export interface AggregatedPosition {
  symbol: string;
  totalQuantity: number;
  averagePrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercentage: number;
  brokerageBreakdown: {
    brokerageId: string;
    quantity: number;
    averagePrice: number;
  }[];
}

export interface TradingRequest {
  userId: string;
  symbol: string;
  quantity: number;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  limitPrice?: number;
  brokerageId?: string; // Optional - will auto-select if not provided
}

/**
 * Trading aggregation service with intelligent routing and position management
 */
export class TradingAggregator {
  
  /**
   * Get aggregated positions across all connected brokerages
   */
  static async getAggregatedPositions(userId: string): Promise<AggregatedPosition[]> {
    const holdings = await storage.getHoldings(userId);
    const accounts = await storage.getConnectedAccounts(userId);
    
    // Group holdings by symbol
    const positionMap = new Map<string, AggregatedPosition>();
    
    holdings.forEach(holding => {
      const symbol = holding.symbol;
      const account = accounts.find(acc => acc.id === parseInt(holding.accountId));
      
      if (!positionMap.has(symbol)) {
        positionMap.set(symbol, {
          symbol,
          totalQuantity: 0,
          averagePrice: 0,
          currentValue: 0,
          gainLoss: 0,
          gainLossPercentage: 0,
          brokerageBreakdown: []
        });
      }
      
      const position = positionMap.get(symbol)!;
      const quantity = parseFloat(holding.quantity.toString());
      const price = parseFloat(holding.averagePrice.toString());
      
      // Add to total quantity and calculate weighted average price
      const newTotalQuantity = position.totalQuantity + quantity;
      position.averagePrice = ((position.averagePrice * position.totalQuantity) + (price * quantity)) / newTotalQuantity;
      position.totalQuantity = newTotalQuantity;
      
      // Add brokerage breakdown
      position.brokerageBreakdown.push({
        brokerageId: account?.provider || 'unknown',
        quantity,
        averagePrice: price
      });
      
      // Update current value and gains
      const currentPrice = parseFloat(holding.currentPrice.toString());
      position.currentValue += quantity * currentPrice;
      position.gainLoss += parseFloat(holding.gainLoss.toString());
      position.gainLossPercentage = ((position.currentValue - (position.totalQuantity * position.averagePrice)) / (position.totalQuantity * position.averagePrice)) * 100;
    });
    
    return Array.from(positionMap.values());
  }

  /**
   * Intelligent trade routing - automatically select best brokerage for trade
   */
  static async routeTrade(request: TradingRequest): Promise<{ brokerageId: string; estimatedFee: number; executionTime: string }> {
    const accounts = await storage.getConnectedAccounts(request.userId);
    const connectedBrokerageIds = accounts.map(acc => acc.provider);
    
    // Create asset object for compatibility checking
    const asset: Asset = {
      symbol: request.symbol,
      name: request.symbol, // Simplified for this example
      type: this.determineAssetType(request.symbol)
    };
    
    // Get compatible brokerages
    const compatibleBrokerages = BrokerageCompatibilityEngine.getCompatibleBrokerages(asset, connectedBrokerageIds);
    
    if (compatibleBrokerages.length === 0) {
      throw new Error(`No connected brokerages support trading ${request.symbol}`);
    }
    
    // If specific brokerage requested, validate compatibility
    if (request.brokerageId) {
      const requestedBrokerage = compatibleBrokerages.find(b => b.id === request.brokerageId);
      if (!requestedBrokerage) {
        throw new Error(`Requested brokerage ${request.brokerageId} does not support ${request.symbol}`);
      }
      return {
        brokerageId: request.brokerageId,
        estimatedFee: this.calculateFee(request, requestedBrokerage),
        executionTime: this.getExecutionTime(requestedBrokerage)
      };
    }
    
    // Auto-select best brokerage based on multiple factors
    const brokerageScores = compatibleBrokerages.map(brokerage => ({
      brokerage,
      score: this.calculateBrokerageScore(request, brokerage, accounts)
    }));
    
    // Sort by score (highest first)
    brokerageScores.sort((a, b) => b.score - a.score);
    const bestBrokerage = brokerageScores[0].brokerage;
    
    return {
      brokerageId: bestBrokerage.id,
      estimatedFee: this.calculateFee(request, bestBrokerage),
      executionTime: this.getExecutionTime(bestBrokerage)
    };
  }

  /**
   * Execute trade with pre-allocation and risk management
   */
  static async executeTrade(request: TradingRequest): Promise<{ success: boolean; tradeId: string; routingInfo: any }> {
    // 1. Route the trade to best brokerage
    const routing = await this.routeTrade(request);
    
    // 2. Calculate total cost (including fees)
    const totalCost = (request.quantity * (request.limitPrice || 100)) + routing.estimatedFee; // Mock price for now
    
    // 3. Hold funds for the trade
    const holdResult = await WalletService.holdFunds(request.userId, totalCost, 'trading');
    
    try {
      // 4. Create trade record
      const trade = await storage.createTrade({
        userId: request.userId,
        accountId: routing.brokerageId, // This should be mapped to actual account ID
        symbol: request.symbol,
        assetType: this.determineAssetType(request.symbol),
        side: request.side,
        quantity: request.quantity.toString(),
        price: (request.limitPrice || 100).toString(), // Mock price
        totalAmount: totalCost.toString(),
        orderType: request.orderType,
        status: 'pending'
      });
      
      // 5. Simulate trade execution (would integrate with actual brokerage APIs)
      setTimeout(() => {
        storage.updateTradeStatus(trade.id, 'filled', new Date());
        WalletService.releaseFunds(request.userId, holdResult.holdId);
      }, 2000);
      
      // 6. Log the activity
      await storage.logActivity({
        userId: request.userId,
        action: 'trade_executed',
        description: `${request.side.toUpperCase()} ${request.quantity} ${request.symbol} via ${routing.brokerageId}`,
        metadata: {
          symbol: request.symbol,
          quantity: request.quantity,
          side: request.side,
          brokerageId: routing.brokerageId,
          tradeId: trade.id.toString()
        }
      });
      
      return {
        success: true,
        tradeId: trade.id.toString(),
        routingInfo: routing
      };
      
    } catch (error) {
      // Release held funds on error
      await WalletService.releaseFunds(request.userId, holdResult.holdId);
      throw error;
    }
  }

  /**
   * Calculate brokerage scoring for intelligent routing
   */
  private static calculateBrokerageScore(request: TradingRequest, brokerage: BrokerageInfo, accounts: any[]): number {
    let score = 0;
    
    // Factor 1: Lower fees = higher score
    const fee = this.calculateFee(request, brokerage);
    score += Math.max(0, 100 - fee); // Lower fees get higher scores
    
    // Factor 2: Account balance (prefer accounts with higher balances)
    const account = accounts.find(acc => acc.provider === brokerage.id);
    if (account) {
      const balance = parseFloat(account.balance.toString()) || 0;
      score += Math.min(50, balance / 1000); // Up to 50 points for balance
    }
    
    // Factor 3: Asset type preference
    if (request.symbol.includes('BTC') || request.symbol.includes('ETH')) {
      // Crypto assets - prefer crypto-specialized brokerages
      if (brokerage.id.includes('coinbase') || brokerage.id.includes('binance')) {
        score += 25;
      }
    } else {
      // Stock assets - prefer traditional brokerages
      if (brokerage.id.includes('robinhood') || brokerage.id.includes('fidelity')) {
        score += 25;
      }
    }
    
    // Factor 4: Execution speed preference
    const executionTime = this.getExecutionTime(brokerage);
    if (executionTime === 'instant') score += 20;
    else if (executionTime === 'fast') score += 10;
    
    return score;
  }

  private static calculateFee(request: TradingRequest, brokerage: BrokerageInfo): number {
    // Mock fee calculation - would use real brokerage fee schedules
    const baseFee = 0.99; // Base fee
    const percentageFee = 0.005; // 0.5% of trade value
    
    const tradeValue = request.quantity * (request.limitPrice || 100);
    return baseFee + (tradeValue * percentageFee);
  }

  private static getExecutionTime(brokerage: BrokerageInfo): string {
    // Mock execution times - would use real data
    const fastBrokerages = ['robinhood', 'webull', 'alpaca'];
    if (fastBrokerages.includes(brokerage.id)) return 'instant';
    return 'fast';
  }

  private static determineAssetType(symbol: string): string {
    // Simple asset type detection
    const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOGE', 'SHIB'];
    if (cryptoSymbols.some(crypto => symbol.includes(crypto))) return 'crypto';
    
    const etfSymbols = ['SPY', 'QQQ', 'VTI', 'IVV'];
    if (etfSymbols.includes(symbol)) return 'etf';
    
    return 'stock';
  }
}