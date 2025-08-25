import '../styles/globals.css';
import { SupabaseAuthProvider } from '../lib/supabaseAuth';
import { Toaster } from 'react-hot-toast';

function MyApp({ Component, pageProps }) {
  return (
    <SupabaseAuthProvider>
      <Component {...pageProps} />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </SupabaseAuthProvider>
  );
}

export default MyApp;
