'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Phone, Globe, MessageCircle } from 'lucide-react';

interface ContactModalProps {
  serviceId: string;
  businessId: string;
  businessUserId: string;
  businessName: string;
  phone?: string;
  email?: string;
  website?: string;
  children: React.ReactNode;
}

export function ContactModal({
  serviceId,
  businessId,
  businessUserId,
  businessName,
  phone,
  email,
  website,
  children,
}: ContactModalProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
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
    
    if (!formData.message.trim()) {
      errors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          serviceId,
          businessId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send inquiry');
      }

      setSuccess(true);
      setSuccessMessage(data.message || 'Inquiry sent successfully!');
      setFormData({ name: '', email: '', phone: '', message: '' });
      setValidationErrors({});
      
      // Close modal after 6 seconds to give time to read the message
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setSuccessMessage('');
      }, 6000);
    } catch (err: any) {
      setError(err.message || 'Unable to send inquiry. Please try again or contact the business directly using the information provided above.');
    } finally {
      setLoading(false);
    }
  };

  // Clear errors when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setError('');
      setValidationErrors({});
      setSuccess(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Contact {businessName}</DialogTitle>
          <DialogDescription className="text-base">
            {session ? 
              'Send an inquiry or start a direct conversation.' : 
              'Fill out the form below and we\'ll connect you with this provider.'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Direct Contact Information */}
        {(phone || email || website) && (
          <div className="space-y-3 border rounded-lg p-4 bg-secondary/40">
            <h3 className="font-semibold text-sm">Direct Contact Information</h3>
            <div className="space-y-2">
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{phone}</span>
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{email}</span>
                </a>
              )}
              {website && (
                <a
                  href={website.startsWith('http') ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                >
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>{website}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Contact Form - Always visible */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              📝 Send an Inquiry
            </h3>
            {session && (
              <Button
                onClick={() => {
                  setOpen(false);
                  router.push(`/messages/${businessUserId}?message=Hi! I'm interested in learning more about your services.`);
                }}
                variant="outline"
                size="sm"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Or Message Directly
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {session ? 
              `Send an inquiry to ${businessName}. We'll notify them and connect you via email.` :
              `We'll notify ${businessName} and send you their contact information via email.`
            }
          </p>

          {success ? (
            <div className="theme-success p-6 space-y-3">
              <div className="text-center">
                <div className="text-4xl mb-2">✅</div>
                <p className="font-medium text-lg">Success!</p>
              </div>
              <p className="text-sm text-center">
                {successMessage}
              </p>
              <div className="bg-background border border-primary/30 rounded-lg p-4 mt-3">
                <p className="text-sm mb-2">
                  <strong>📧 Check your email!</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  We've sent you {businessName}'s contact information so you can reach out directly.
                </p>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
                This window will close automatically...
              </p>
            </div>
          ) : (
            <>
              {!session && (
                <div className="theme-note mb-4">
                  <p className="text-xs">
                    💡 <strong>Tip:</strong> <Link href="/auth/signin" className="underline hover:text-primary">Sign in</Link> to message {businessName} directly in real-time.
                  </p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Your Name <span className="text-destructive" aria-label="required">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (validationErrors.name) {
                          setValidationErrors({ ...validationErrors, name: '' });
                        }
                      }}
                      placeholder="John Doe"
                      aria-required="true"
                      aria-invalid={!!validationErrors.name}
                      aria-describedby={validationErrors.name ? 'name-error' : undefined}
                      className={validationErrors.name ? 'border-destructive' : ''}
                    />
                    {validationErrors.name && (
                      <p id="name-error" className="text-sm text-destructive" role="alert">
                        {validationErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Your Email <span className="text-destructive" aria-label="required">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (validationErrors.email) {
                          setValidationErrors({ ...validationErrors, email: '' });
                        }
                      }}
                      placeholder="john@example.com"
                      aria-required="true"
                      aria-invalid={!!validationErrors.email}
                      aria-describedby={validationErrors.email ? 'email-error' : undefined}
                      className={validationErrors.email ? 'border-destructive' : ''}
                    />
                    {validationErrors.email && (
                      <p id="email-error" className="text-sm text-destructive" role="alert">
                        {validationErrors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">
                    Your Phone <span className="text-muted-foreground text-sm">(Optional)</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-sm font-medium">
                    Message <span className="text-destructive" aria-label="required">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => {
                      setFormData({ ...formData, message: e.target.value });
                      if (validationErrors.message) {
                        setValidationErrors({ ...validationErrors, message: '' });
                      }
                    }}
                    rows={4}
                    placeholder="Tell them what you're looking for... (e.g., I'm interested in speech therapy for my 5-year-old with autism)"
                    className={`resize-none ${validationErrors.message ? 'border-destructive' : ''}`}
                    aria-required="true"
                    aria-invalid={!!validationErrors.message}
                    aria-describedby={validationErrors.message ? 'message-error message-hint' : 'message-hint'}
                  />
                  <p id="message-hint" className="text-xs text-muted-foreground">
                    {formData.message.length}/500 characters
                  </p>
                  {validationErrors.message && (
                    <p id="message-error" className="text-sm text-destructive" role="alert">
                      {validationErrors.message}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="theme-danger p-4" role="alert">
                    <div className="flex items-start gap-2">
                      <span className="text-destructive text-xl" aria-hidden="true">⚠️</span>
                      <div>
                        <p className="font-semibold text-sm mb-1">Unable to send inquiry</p>
                        <p className="text-sm">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={loading}
                    className="min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="min-h-[44px]"
                    aria-label={loading ? 'Sending inquiry...' : 'Send inquiry'}
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin mr-2" aria-hidden="true">⏳</span>
                        Sending...
                      </>
                    ) : (
                      'Send Inquiry'
                    )}
                </Button>
              </DialogFooter>
            </form>
          </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
