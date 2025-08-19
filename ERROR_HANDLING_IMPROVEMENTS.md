# Trading System Error Handling Improvements

## Overview
Comprehensive error handling enhancements addressing the 5 common causes of 400 preview errors and implementing detailed logging for real provider errors.

## 1. Symbol Unknown → Instrument Lookup
**Problem**: Unknown symbols cause 400 errors
**Solution**: `resolveInstrumentBySymbol()` function

```typescript
// Enhanced instrument resolution
const inst = await resolveInstrumentBySymbol(body.symbol).catch(() => null);
const payload = {
  // ... other fields
  universalSymbol: inst?.universalSymbol || inst?.universal_symbol || undefined,
  instrumentId: inst?.id || inst?.instrumentId || undefined,
};
```

**Benefits**:
- Maps symbols to instruments across different brokerages
- Prevents 400 errors from unknown symbols
- Cross-platform compatibility (stocks, crypto, ETFs)

## 2. Missing instrumentId/universalSymbol
**Problem**: Some SDK versions require specific instrument fields
**Solution**: Comprehensive instrument resolver with multiple property patterns

```typescript
// Multiple property pattern support
universalSymbol: inst?.universalSymbol || inst?.universal_symbol || undefined,
instrumentId: inst?.id || inst?.instrumentId || undefined,
```

**Benefits**:
- Handles different SnapTrade SDK versions
- Provides required fields automatically
- Prevents API compatibility issues

## 3. Case Sensitivity and Whitespace
**Problem**: Inconsistent symbol formatting causes rejections
**Solution**: Input normalization

```typescript
// Backend normalization
body.side = body.side ? String(body.side).toUpperCase() : undefined;
body.type = body.type ? String(body.type).toUpperCase() : undefined;

// Frontend normalization
symbol: symbol.toUpperCase().trim(),
side: action.toLowerCase(),
type: orderType.toUpperCase(),
```

**Benefits**:
- Consistent formatting across all requests
- Eliminates whitespace-related errors
- Standardized case handling

## 4. LIMIT Orders Without limitPrice
**Problem**: Limit orders missing price or non-numeric quantities
**Solution**: Comprehensive validation

```typescript
// Enhanced validation function
function validateOrder(body: any): string[] {
  const errors: string[] = [];
  
  if (!body.accountId) errors.push('accountId required');
  if (!body.symbol || typeof body.symbol !== 'string') errors.push('valid symbol required');
  if (!body.side || !['BUY', 'SELL'].includes(String(body.side).toUpperCase())) {
    errors.push('side must be BUY or SELL');
  }
  
  const qty = Number(body.quantity);
  if (!qty || qty <= 0 || !Number.isFinite(qty)) {
    errors.push('quantity must be positive number');
  }
  
  if (!body.type || !['MARKET', 'LIMIT'].includes(String(body.type).toUpperCase())) {
    errors.push('type must be MARKET or LIMIT');
  }
  
  if (String(body.type).toUpperCase() === 'LIMIT') {
    const price = Number(body.limitPrice);
    if (!price || price <= 0 || !Number.isFinite(price)) {
      errors.push('limitPrice required for LIMIT orders and must be positive');
    }
  }
  
  return errors;
}
```

**Benefits**:
- Catches validation errors before API calls
- Clear error messages for debugging
- Prevents malformed requests

## 5. Enhanced Logging - Real Provider Errors
**Problem**: Previous logs showed `statusText: undefined` with no actionable information
**Solution**: Comprehensive error capture and logging

```typescript
// Enhanced error handling with responseBody capture
} catch (e: any) {
  console.error('SnapTrade preview error - Full details:', e?.responseBody || e?.message || e);
  return res.status(400).json({ 
    message: 'Failed to preview order', 
    error: e?.responseBody || e?.message || e 
  });
}
```

**Before**:
```
Error: statusText: undefined
```

**After**:
```
SnapTrade preview error - Full details: {
  "message": "Symbol 'INVALID' not found in supported instruments",
  "code": "SYMBOL_NOT_FOUND", 
  "details": { "symbol": "INVALID", "supported_exchanges": ["NASDAQ", "NYSE"] }
}
```

## Cross-SDK Compatibility Enhancements

### Dynamic Method Detection
```typescript
// Try multiple API class names and methods
const apiClasses = ['TradingApi', 'TradesApi', 'AccountsAndTradesApi'];
const methods = ['checkOrderImpact', 'previewOrder', 'validateOrder'];

for (const className of apiClasses) {
  for (const methodName of methods) {
    if (hasFn(snaptradeClient, className) && hasFn(snaptradeClient[className], methodName)) {
      return await snaptradeClient[className][methodName](payload);
    }
  }
}
```

### Version-Safe Wrappers
- Handles different response structures across SDK versions
- Provides consistent interface regardless of underlying SDK
- Graceful fallbacks for missing methods or properties

## Error Categorization

### Client-Side Validation Errors (400)
- Missing required fields
- Invalid data types
- Format violations
- Business rule violations

### Provider-Side Errors (400-500)
- Symbol not found
- Insufficient funds
- Market closed
- Account restrictions

### System Errors (500+)
- SDK configuration issues
- Network connectivity problems
- Service unavailable

## User Experience Improvements

### Frontend Error Handling
```typescript
onError: (error: any) => {
  // Parse structured error messages
  const errorMessage = error?.responseBody?.message || 
                      error?.message || 
                      'Failed to preview order';
                      
  toast({
    title: 'Preview Failed',
    description: errorMessage,
    variant: 'destructive'
  });
}
```

### Progressive Error Resolution
1. **Immediate Feedback**: Client-side validation prevents obviously invalid requests
2. **Structured Errors**: Server provides detailed error information with context
3. **User Guidance**: Clear instructions for resolving common issues
4. **Debugging Support**: Comprehensive logging for development and troubleshooting

## Testing Coverage
- ✅ Symbol validation and normalization
- ✅ Required field validation
- ✅ Data type validation
- ✅ Cross-SDK compatibility
- ✅ Error response formatting
- ✅ User feedback mechanisms

This comprehensive error handling system transforms cryptic API failures into actionable feedback, significantly improving both developer debugging experience and end-user reliability.