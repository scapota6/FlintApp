import { Request, Response, NextFunction } from 'express';
import { createGzip, createDeflate } from 'zlib';

export interface CompressionConfig {
  threshold?: number; // minimum size to compress
  level?: number; // compression level (1-9)
  filter?: (req: Request, res: Response) => boolean;
}

const defaultConfig: CompressionConfig = {
  threshold: 1024, // 1KB
  level: 6, // balanced compression
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (!req.headers['accept-encoding']) return false;
    
    // Don't compress if response is already compressed
    if (res.getHeader('content-encoding')) return false;
    
    // Compress these content types
    const contentType = res.getHeader('content-type') as string;
    if (!contentType) return false;
    
    return /json|text|javascript|css|html|xml/.test(contentType);
  }
};

export function createCompressionMiddleware(config: CompressionConfig = {}) {
  const options = { ...defaultConfig, ...config };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if filter says no
    if (options.filter && !options.filter(req, res)) {
      return next();
    }
    
    const acceptEncoding = req.headers['accept-encoding'] as string;
    if (!acceptEncoding) {
      return next();
    }
    
    // Store original methods
    const originalEnd = res.end;
    const originalWrite = res.write;
    let chunks: Buffer[] = [];
    let encoding: BufferEncoding | undefined;
    
    // Override write to capture data
    res.write = function(chunk: any, enc?: BufferEncoding) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
        if (enc) encoding = enc;
      }
      return true;
    };
    
    // Override end to compress and send
    res.end = function(chunk?: any, enc?: BufferEncoding) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
        if (enc) encoding = enc;
      }
      
      const buffer = Buffer.concat(chunks);
      
      // Check threshold
      if (buffer.length < (options.threshold || 1024)) {
        res.write = originalWrite;
        res.end = originalEnd;
        return originalEnd.call(res, buffer, encoding);
      }
      
      // Determine compression method
      let compressionStream;
      if (acceptEncoding.includes('gzip')) {
        res.setHeader('content-encoding', 'gzip');
        compressionStream = createGzip({ level: options.level });
      } else if (acceptEncoding.includes('deflate')) {
        res.setHeader('content-encoding', 'deflate');
        compressionStream = createDeflate({ level: options.level });
      } else {
        res.write = originalWrite;
        res.end = originalEnd;
        return originalEnd.call(res, buffer, encoding);
      }
      
      // Remove content-length header (will be different after compression)
      res.removeHeader('content-length');
      
      // Restore original methods
      res.write = originalWrite;
      res.end = originalEnd;
      
      // Compress and send
      compressionStream.on('data', (chunk) => {
        res.write(chunk);
      });
      
      compressionStream.on('end', () => {
        res.end();
      });
      
      compressionStream.end(buffer);
    };
    
    next();
  };
}

// Default compression middleware
export const compression = createCompressionMiddleware();

// High compression for static assets
export const highCompression = createCompressionMiddleware({
  level: 9,
  threshold: 512,
  filter: (req, res) => {
    const contentType = res.getHeader('content-type') as string;
    return /javascript|css|json/.test(contentType || '');
  }
});