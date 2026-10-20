import { Suspense } from 'react';
import { Spinner } from '@/components/ui/feedback';
import AppRoutes from '@/routes/AppRoutes';

export default function App() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner /></div>}>
      <AppRoutes />
    </Suspense>
  );
}
