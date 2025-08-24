import SnapTrade from "snaptrade-typescript-sdk";

const required = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

export const snaptrade = new SnapTrade({
  clientId: required("SNAPTRADE_CLIENT_ID"),            // e.g., FLINT-TEST-XXXXX
  consumerKey: required("SNAPTRADE_CONSUMER_KEY"),      // sandbox consumer key
  environment: "sandbox",
});

console.log("[SnapTrade] init", {
  env: "sandbox",
  clientIdTail: process.env.SNAPTRADE_CLIENT_ID?.slice(-6),
  consumerKeyLen: process.env.SNAPTRADE_CONSUMER_KEY?.length,
  redirectUri: process.env.SNAPTRADE_REDIRECT_URI,
});