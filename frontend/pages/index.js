import { useEffect } from 'react';
import { useRouter } from 'next/router';

// No public landing page — go straight to login.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, [router]);
  return null;
}