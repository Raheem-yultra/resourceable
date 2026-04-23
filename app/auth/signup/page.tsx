'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, User, MapPin, Building2, Phone } from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    zipCode: '',
    phone: '',
    role: roleParam === 'BUSINESS' ? 'BUSINESS' : 'USER',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const phoneRegex = /^(\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Phone validation - required for business, optional for users
    if (formData.role === 'BUSINESS') {
      if (!formData.phone.trim()) {
        errors.phone = 'Phone number is required for business accounts';
      } else if (!phoneRegex.test(formData.phone)) {
        errors.phone = 'Please enter a valid phone number';
      }
    } else if (formData.phone.trim() && !phoneRegex.test(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          zipCode: formData.zipCode,
          phone: formData.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show detailed error for debugging
        const errorMessage = data.details 
          ? `${data.error}: ${data.details}` 
          : data.message 
          ? `${data.error}: ${data.message}`
          : data.error || 'Failed to create account';
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Redirect to verify email page
      router.push('/auth/verify-email');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-background to-muted px-4 py-6 sm:py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center px-4 sm:px-6">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">
            {formData.role === 'BUSINESS' ? 'Business Sign Up' : 'Create Account'}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            {formData.role === 'BUSINESS' 
              ? 'Register your business to list services on ResourceAble'
              : 'Join ResourceAble to connect with service providers'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Role Toggle */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">I am signing up as</legend>
              <p id="role-help" className="text-xs text-muted-foreground">
                Choose Parent/Guardian if you are looking for services, or Service Provider if you want to list your business.
              </p>
              <div className="flex gap-2 p-1 bg-muted rounded-lg" role="group" aria-describedby="role-help" aria-label="Account type">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'USER' })}
                aria-pressed={formData.role === 'USER'}
                className={`flex-1 py-3 sm:py-2.5 rounded-md text-sm font-medium transition-all min-h-[44px] ${
                  formData.role === 'USER'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Parent/Guardian
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'BUSINESS' })}
                aria-pressed={formData.role === 'BUSINESS'}
                className={`flex-1 py-3 sm:py-2.5 rounded-md text-sm font-medium transition-all min-h-[44px] ${
                  formData.role === 'BUSINESS'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Service Provider
              </button>
              </div>
            </fieldset>

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                {formData.role === 'BUSINESS' ? 'Business Name' : 'Full Name'}
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder={formData.role === 'BUSINESS' ? 'Your Business Name' : 'Your Name'}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Zip Code Field */}
            <div className="space-y-2">
              <Label htmlFor="zipCode" className="text-sm font-medium">
                Zip Code {formData.role === 'USER' && '(Optional)'}
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="zipCode"
                  type="text"
                  placeholder="12345"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  className="pl-10"
                  maxLength={5}
                  required={formData.role === 'BUSINESS'}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formData.role === 'BUSINESS' 
                  ? 'Required for service location visibility'
                  : 'Helps us show relevant services in your area'
                }
              </p>
            </div>

            {/* Phone Field */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone Number {formData.role === 'USER' && '(Optional)'}
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="pl-10"
                  required={formData.role === 'BUSINESS'}
                />
              </div>
              {fieldErrors.phone && (
                <p className="text-xs text-red-600">{fieldErrors.phone}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formData.role === 'BUSINESS' 
                  ? 'Required for customers to contact you'
                  : 'Optional - for service providers to reach you'
                }
              </p>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters
              </p>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full min-h-[48px] sm:min-h-[52px] text-base font-semibold" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Already have an account?
                </span>
              </div>
            </div>

            {/* Sign In Link */}
            <Button asChild variant="outline" className="w-full min-h-[48px]">
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
