import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5000",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    
    env: {
      // Use demo mode for tests
      FF_DEMO_MODE: true,
      FF_TRADING: false,
      FF_ALERTS: false,
    },
  },
  
  component: {
    devServer: {
      framework: "react",
      bundler: "vite",
    },
    specPattern: "**/*.cy.{js,jsx,ts,tsx}",
  },
});