import React from 'react';

const stockLogos: { [key: string]: string } = {
  'AAPL': `
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#000000"/>
      <path d="M22.3 12.1c-.2 2.4 2.1 3.6 2.2 3.6-.1.4-1.4 4.8-4.6 4.8-1.5 0-2.6-.9-4.1-.9-1.6 0-2.8.9-4.2.9-2.8 0-5.2-4.2-5.2-8.3 0-3.6 2.4-5.5 4.7-5.5 1.5 0 2.7.9 3.6.9.8 0 2.3-1 4-1 .7 0 2.5.1 3.6 1.5zm-4-11.8c.7-.8 1.2-2 1.1-3.2-1 0-2.3.7-3 1.5-.6.7-1.2 1.9-1.1 3 1.2.1 2.3-.6 3-1.3z" fill="#ffffff"/>
    </svg>
  `,
  'GOOGL': `
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#4285F4"/>
      <path d="M16.3 13.2v3.3h4.8c-.2 1.3-.8 2.4-1.7 3.1v2.6h2.7c1.6-1.5 2.5-3.6 2.5-6.2 0-.6-.1-1.2-.2-1.8h-8.1z" fill="#ffffff"/>
      <path d="M11.1 15.8c0-.8.1-1.6.4-2.3l-2.9-2.3c-.9 1.8-1.4 3.8-1.4 6 0 2.2.5 4.2 1.4 6l2.9-2.3c-.3-.7-.4-1.5-.4-2.3z" fill="#ffffff"/>
      <path d="M16.3 10.1c1.3 0 2.5.4 3.4 1.3l2.5-2.5c-1.5-1.4-3.5-2.3-5.9-2.3-3.6 0-6.7 2.1-8.2 5.2l2.9 2.3c.7-2.1 2.7-3.6 5.3-3.6z" fill="#ffffff"/>
    </svg>
  `,
  'TSLA': `
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#CC0000"/>
      <path d="M8 12h16v1.5H8V12zm2.5 2.5h11v8h-11v-8zm1.5 1.5v5h8v-5h-8z" fill="#ffffff"/>
      <path d="M16 8c-1.1 0-2 .9-2 2h4c0-1.1-.9-2-2-2z" fill="#ffffff"/>
    </svg>
  `,
  'MSFT': `
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#00BCF2"/>
      <rect x="6" y="6" width="9" height="9" fill="#F25022"/>
      <rect x="17" y="6" width="9" height="9" fill="#7FBA00"/>
      <rect x="6" y="17" width="9" height="9" fill="#00A4EF"/>
      <rect x="17" y="17" width="9" height="9" fill="#FFB900"/>
    </svg>
  `,
  'BTC': `
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#F7931A"/>
      <path d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.113-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.874 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z" fill="#ffffff"/>
    </svg>
  `,
  'ETH': `
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#627EEA"/>
      <path d="M16.498 4v8.87l7.497 3.35-7.497-12.22z" fill="#ffffff" fill-opacity="0.602"/>
      <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#ffffff"/>
      <path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#ffffff" fill-opacity="0.602"/>
      <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.38z" fill="#ffffff"/>
      <path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#ffffff" fill-opacity="0.2"/>
      <path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#ffffff" fill-opacity="0.602"/>
    </svg>
  `,
};

interface StockIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export function StockIcon({ symbol, size = 32, className = '' }: StockIconProps) {
  const logoSvg = stockLogos[symbol.toUpperCase()];
  
  if (!logoSvg) {
    // Fallback circle with first letter
    return (
      <div 
        className={`flex items-center justify-center rounded-lg bg-gray-600 text-white font-bold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {symbol.charAt(0)}
      </div>
    );
  }

  return (
    <div 
      className={className}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  );
}