'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';

import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { ThemedButton } from '@/components/ui/themed-button';
import { Toaster } from '@/components/ui/toaster';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, User, FileText, Lock, Eye, EyeOff } from 'lucide-react';
import { DynamicTitle } from '@/components/DynamicTitle';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Skeleton } from '@/components/ui/skeleton';

// Component that uses searchParams - needs to be in Suspense
function RegisterContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('register');
  const [rememberMe, setRememberMe] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [accountPending, setAccountPending] = useState(false);
  const [magicToken, setMagicToken] = useState<string | null>(null);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading } = useTheme();
  
  // Add session check for authenticated users
  const { data: session, status } = useSession();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (status === 'loading') return; // Still loading session
    if (session) {
      // User is already logged in, redirect to dashboard
      router.push('/dashboard');
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    const magic = searchParams.get('magic');
    if (magic) {
      setMagicToken(magic);
      setIsMagicLink(true);
      // Show a message about magic link usage
      setSuccess('🎉 You\'re joining via a special invitation link! Your account will be automatically approved.');
    }
  }, [searchParams]);

  // Remember-me hydration (login convenience + persistence preference)
  useEffect(() => {
    try {
      const storedRemember = localStorage.getItem('auth_remember_me') === 'true';
      const storedIdentifier = localStorage.getItem('auth_identifier') || '';

      setRememberMe(storedRemember);

      // Only prefill identifier if we have one and the user hasn't typed yet
      if (storedIdentifier && !email) {
        setEmail(storedIdentifier);
      }
    } catch {
      // ignore storage access issues
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!name || !email || !password) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          name, 
          note, 
          password,
          magicToken: magicToken 
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
      } else {
        // Check if account requires approval
        if (data.requiresApproval) {
          setSuccess(data.message || 'Account created successfully! Your account is pending approval.');
          setAccountPending(true);
          return;
        }
        
        // Handle auto-approved accounts (magic link users)
        if (data.autoApproved) {
          setSuccess(data.message || 'Account created and automatically approved!');
          // Auto-login after registration for auto-approved accounts
          const login = await signIn('credentials', {
            email,
            password,
            redirect: false,
          });

          if (login?.ok) {
            router.push('/dashboard');
          } else {
            setError('Account approved but login failed. Please try logging in manually.');
          }
          return;
        }
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please enter your email/phone and password');
      setLoading(false);
      return;
    }

    try {
      const result = await signIn('credentials', {
        email,
        password,
        rememberMe: rememberMe ? 'true' : 'false',
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials or account not approved');
      } else if (result?.ok) {
        // Persist remember-me preference + identifier (never store password)
        try {
          if (rememberMe) {
            localStorage.setItem('auth_remember_me', 'true');
            localStorage.setItem('auth_identifier', email);
          } else {
            localStorage.removeItem('auth_remember_me');
            localStorage.removeItem('auth_identifier');
          }
        } catch {
          // ignore
        }
        router.push('/dashboard');
      }
    } catch (error) {
      setError('An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (status === 'loading') {
    return <RegisterPageLoading />;
  }

  // Don't render anything if user is authenticated (we're redirecting)
  if (session) {
    return <RegisterPageLoading />;
  }

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col">
      <DynamicTitle pageTitle="Register" />
      <Header title="Store name" showSearch notifications={2} />
      
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {isLoading ? (
            <div className="mx-auto w-16 h-16 mb-4">
              <Skeleton className="w-16 h-16 rounded-full" />
            </div>
          ) : (
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <div className="w-8 h-8 bg-primary rounded-full"></div>
            </div>
          )}
          <CardTitle className="text-2xl">
            {accountPending 
              ? 'Account Created!' 
              : (activeTab === 'login' ? 'Welcome Back' : (isMagicLink ? '🎉 Special Invitation' : 'Create Account'))
            }
          </CardTitle>
          <CardDescription>
            {accountPending 
              ? 'Your account has been created successfully and is pending approval.'
              : (activeTab === 'login' 
                  ? 'Enter your credentials to sign in to your account'
                  : (isMagicLink 
                      ? 'You\'re joining with a special invitation link! Your account will be automatically approved upon registration.'
                      : 'Fill in your details to create a new account'
                    )
                )
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {accountPending ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="text-green-600 font-medium">{success}</p>
                <p className="text-sm text-muted-foreground">
                  You will receive an email notification once your account is approved by an admin.
                </p>
              </div>
            </div>
          ) : (
            <>
              {isMagicLink && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="flex-shrink-0">
                      🎉
                    </div>
                    <div className="text-sm text-green-800">
                      <strong>Special Invitation Active!</strong> Your account will be automatically approved.
                    </div>
                  </div>
                </div>
              )}
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'register')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4 mt-4">
                <form className="space-y-4" onSubmit={handleLogin}>
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email Address Or Phone Number</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Email or Phone Number" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        id="login-email"
                        type="text"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Password</Label>
                      <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        className="pl-10 pr-10"
                        required
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

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                      />
                      <Label htmlFor="remember-me" className="text-sm cursor-pointer">
                        Remember me
                      </Label>
                    </div>
                  </div>

                  <ThemedButton type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Signing In...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </ThemedButton>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4 mt-4">
                <form className="space-y-4" onSubmit={handleRegister}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="User Name" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)}
                        id="name"
                        type="text"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email Address Or Phone Number</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Email or Phone Number" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        id="register-email"
                        type="text"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        className="pl-10 pr-10"
                        required
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
                    <Label htmlFor="note">Note (Optional)</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea 
                        placeholder="Add any additional notes..." 
                        value={note} 
                        onChange={(e) => setNote(e.target.value)}
                        id="note"
                        className="pl-10 min-h-[80px] resize-none"
                      />
                    </div>
                  </div>

                  <ThemedButton type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </ThemedButton>
                </form>
              </TabsContent>

              {success && !accountPending && <p className="text-green-600 mt-2">{success}</p>}
              {error && <p className="text-red-600 mt-2">{error}</p>}
            </Tabs>
            </>
          )}
          
        </CardContent>
      </Card>
      </div>

      <Footer />
      <MobileNav />
      <Toaster />
    </div>
    </>
  );
}

// Loading component for Suspense fallback
function RegisterPageLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header title="Store name" showSearch notifications={2} />
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 mb-4">
              <Skeleton className="w-16 h-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
      <MobileNav />
    </div>
  );
}

// Main component with Suspense boundary
export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageLoading />}>
      <RegisterContent />
    </Suspense>
  );
}
