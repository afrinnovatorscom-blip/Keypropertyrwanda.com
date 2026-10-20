import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/api';
import { useSeo } from '@/lib/seo';

const schema = z.object({
  email: z.string().trim().email('Enter your email address'),
  password: z.string().min(1, 'Enter your password'),
});

export default function Login() {
  useSeo({ title: 'Sign in', noindex: true });
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={location.state?.from ?? '/admin'} replace />;

  const onSubmit = async (values) => {
    setError(null);
    try {
      await login(values);
      navigate(location.state?.from ?? '/admin', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="hero-pattern flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-background p-7 shadow-2xl">
        <Logo className="mb-6" />
        <h1 className="text-xl font-bold">Staff sign in</h1>
        <p className="mb-5 text-sm text-muted-foreground">Administration dashboard for authorised staff.</p>
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="username" autoFocus aria-invalid={!!errors.email} {...register('email')} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            <LogIn /> {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
