import { registerRootComponent } from 'expo';
import { initGlobalNetworkLogger } from './src/services/networkLogger';
import App from './App';

// Automatically captures all HTTP/HTTPS requests in development
initGlobalNetworkLogger(__DEV__);

registerRootComponent(App);
