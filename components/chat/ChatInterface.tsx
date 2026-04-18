'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  subject?: string;
  content: string;
  status: string;
  createdAt: string;
  readAt?: string;
  sender: {
    id: string;
    name?: string;
    email: string;
    role: string;
    business?: {
      businessName: string;
      logo?: string;
    };
  };
  receiver: {
    id: string;
    name?: string;
    email: string;
    role: string;
    business?: {
      businessName: string;
      logo?: string;
    };
  };
}

interface Partner {
  id: string;
  name?: string;
  email: string;
  role: string;
  business?: {
    id: string;
    businessName: string;
    logo?: string;
  };
}

interface ChatInterfaceProps {
  currentUserId: string;
  partnerId: string;
  initialMessage?: string;
}

export function ChatInterface({ currentUserId, partnerId, initialMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [newMessage, setNewMessage] = useState(initialMessage || '');
  const [subject, setSubject] = useState('');
  const [showSubject, setShowSubject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 10 seconds
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [partnerId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-focus textarea when component mounts or when messages are empty
  useEffect(() => {
    if (!loading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [loading, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      setErrorMessage(null);
      const response = await fetch(`/api/messages/${partnerId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        setPartner(data.partner);
      } else {
        setErrorMessage('Unable to load this conversation. Please refresh and try again.');
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setErrorMessage('Unable to load this conversation. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: partnerId,
          subject: showSubject && subject ? subject : undefined,
          content: newMessage,
        }),
      });

      if (response.ok) {
        setNewMessage('');
        setSubject('');
        setShowSubject(false);
        await fetchMessages();
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data.error || 'Unable to send message. Please try again.');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setErrorMessage('Unable to send message. Please check your connection and retry.');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  };

  if (loading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </Card>
    );
  }

  const partnerName = partner?.business?.businessName || partner?.name || partner?.email || 'User';

  return (
    <Card className="h-[700px] flex flex-col shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center gap-3">
          {partner?.business?.logo ? (
            <img
              src={partner.business.logo}
              alt={partnerName}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
              <span className="text-primary font-semibold text-lg">
                {partnerName[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1">
            <CardTitle className="text-xl">{partnerName}</CardTitle>
            {partner?.business?.businessName && partner?.name && (
              <p className="text-sm text-muted-foreground">{partner.name}</p>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${
              partner?.role === 'BUSINESS'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {partner?.role === 'BUSINESS' ? '🏢 Business' : '👤 User'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 bg-gradient-to-b from-slate-50/50 to-white">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-3xl">💬</span>
              </div>
              <p className="text-muted-foreground text-lg font-medium mb-2">
                Start a conversation with {partnerName}
              </p>
              <p className="text-sm text-muted-foreground">
                Send your first message below to begin chatting
              </p>
            </div>
          ) : (
            <>
              {messages.map((message: any) => {
                const isOwn = message.senderId === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
                      {message.subject && (
                        <p className={`text-xs font-semibold mb-1 px-1 ${
                          isOwn ? 'text-right' : 'text-left'
                        }`}>
                          📌 {message.subject}
                        </p>
                      )}
                      <div
                        className={`rounded-2xl p-4 shadow-sm ${
                          isOwn
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-white border border-gray-200 rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {message.content}
                        </p>
                        <div className={`flex items-center gap-2 mt-2 ${
                          isOwn ? 'justify-end' : 'justify-start'
                        }`}>
                          <p className={`text-xs ${
                            isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {formatTime(message.createdAt)}
                          </p>
                          {isOwn && message.status === 'READ' && (
                            <span className="text-xs text-primary-foreground/70">✓✓</span>
                          )}
                          {isOwn && message.status === 'SENT' && (
                            <span className="text-xs text-primary-foreground/70">✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t bg-white p-4 shadow-inner">
          {errorMessage && (
            <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
          <form onSubmit={sendMessage} className="space-y-3">
            {showSubject && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label htmlFor="subject" className="text-sm font-medium">Subject (optional)</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Message subject..."
                  maxLength={200}
                  className="border-primary/20 focus:border-primary"
                />
              </div>
            )}
            
            <div className="flex gap-3">
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={messages.length === 0 
                  ? `Send your first message to ${partnerName}...`
                  : "Type your message..."
                }
                className="resize-none min-h-[80px] border-gray-300 focus:border-primary"
                rows={3}
                disabled={sending}
                maxLength={5000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant={showSubject ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSubject(!showSubject)}
                  title={showSubject ? "Remove subject" : "Add subject"}
                  aria-label={showSubject ? 'Hide subject field' : 'Show subject field'}
                  aria-pressed={showSubject}
                  className="h-10 w-10 p-0"
                >
                  {showSubject ? '✕' : '📝'}
                </Button>
                <Button 
                  type="submit" 
                  disabled={sending || !newMessage.trim()}
                  className="flex-1 font-semibold"
                  size="lg"
                >
                  {sending ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      Send ➤
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              💡 Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Shift+Enter</kbd> for new line
            </p>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
