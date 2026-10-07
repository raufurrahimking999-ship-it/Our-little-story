import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SplashScreen } from '@capacitor/splash-screen';

// Immediately dismiss any native Capacitor / Cordova / WebView splash screen so the app directly renders "Our Little Story"
try {
  SplashScreen.hide().catch(() => {});
} catch {
  // Non-native runtime fallback
}

createRoot(document.getElementById('root')!).render(<App />);
