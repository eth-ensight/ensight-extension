import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import App from './App';
import './style.css';

const queryClient = new QueryClient();

const config = getDefaultConfig({
  appName: 'ENSight',
  projectId: 'a0b2f2f4e2c84d2f8f4e2c84d2f8f4e2',
  chains: [mainnet],
  transports: {
    [mainnet.id]: http('https://eth.llamarpc.com'),
  },
  ssr: false,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
