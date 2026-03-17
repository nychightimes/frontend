'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/layout/Footer';
import { ThemedButton } from '@/components/ui/themed-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { DynamicTitle } from '@/components/DynamicTitle';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token');
    const e = searchParams.get('email');
    if (!t || !e) {
      setInvalidLink(true);
    } else {
      setToken(t);
      setEmail(e);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure your passwords match.',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast({
          title: 'Password reset',
          description: data.message,
        });
        router.push('/register');
      } else {
        toast({
          title: 'Reset failed',
          description: data.error || 'Invalid or expired reset link.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Please try again or request a new reset link.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (invalidLink) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <DynamicTitle pageTitle="Invalid Reset Link" />
        <Header title="Store name" showSearch notifications={2} />
        <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Invalid reset link</CardTitle>
              <CardDescription>
                This password reset link is invalid or has expired. Please request a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/forgot-password">
                <ThemedButton className="w-full">Request new reset link</ThemedButton>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DynamicTitle pageTitle="Reset Password" />
      <Header title="Store name" showSearch notifications={2} />

      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Set new password</CardTitle>
            <CardDescription>
              Enter your new password below. It must be at least 6 characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <ThemedButton type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                    Resetting...
                  </>
                ) : (
                  'Reset password'
                )}
              </ThemedButton>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/register" className="text-primary hover:underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>

      <Footer />
      <MobileNav />
      <Toaster />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
