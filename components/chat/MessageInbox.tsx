'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Conversation {
  partnerId: string;
  partner: {
    id: string;
    name?: string;
    email: string;
    role: string;
    businessName?: string;
    businessId?: string;
    logo?: string;
  };
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  };
  unreadCount: number;
  totalMessages: number;
}

interface MessageInboxProps {
  currentUserId: string;
}

export function MessageInbox({ currentUserId }: MessageInboxProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchConversations();
  }, [filter]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/messages?type=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.partner.name?.toLowerCase().includes(query) ||
      conv.partner.email.toLowerCase().includes(query) ||
      conv.partner.businessName?.toLowerCase().includes(query) ||
      conv.lastMessage.content.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="messages-heading">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-primary/5 to-primary/10 p-6 rounded-lg border border-primary/20">
        <div>
          <h2 id="messages-heading" className="text-3xl font-bold text-foreground">
            💬 Messages
          </h2>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full mr-1">
                {unreadCount}
              </span>
              unread {unreadCount === 1 ? 'message' : 'messages'}
            </p>
          )}
        </div>
        <Button onClick={fetchConversations} variant="outline" size="sm" className="gap-2" aria-label="Refresh conversations">
          <span>🔄</span> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
          className="gap-1"
        >
          📬 All
        </Button>
        <Button
          variant={filter === 'received' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('received')}
          className="gap-1"
        >
          📥 Received
        </Button>
        <Button
          variant={filter === 'sent' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('sent')}
          className="gap-1"
        >
          📤 Sent
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <label htmlFor="conversation-search" className="sr-only">
          Search conversations
        </label>
        <Input
          id="conversation-search"
          type="search"
          placeholder="🔍 Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-4"
        />
      </div>

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-4xl">{searchQuery ? '🔍' : '💬'}</span>
            </div>
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {searchQuery
                ? 'No conversations match your search'
                : 'No messages yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Messages from businesses and users will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredConversations.map((conv) => (
            <Link
              key={conv.partnerId}
              href={`/messages/${conv.partnerId}`}
              className="block group"
            >
              <Card className={`hover:shadow-md transition-all duration-200 hover:border-primary/50 ${
                conv.unreadCount > 0 ? 'border-primary border-2 shadow-sm' : ''
              }`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {conv.partner.logo ? (
                        <img
                          src={conv.partner.logo}
                          alt={conv.partner.name || 'User'}
                          className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all">
                          <span className="text-primary font-bold text-xl">
                            {(conv.partner.name || conv.partner.email)[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-semibold truncate text-lg ${
                            conv.unreadCount > 0 ? 'text-primary' : 'group-hover:text-primary transition-colors'
                          }`}>
                            {conv.partner.businessName || conv.partner.name || 'User'}
                          </h3>
                          {conv.partner.businessName && conv.partner.name && (
                            <p className="text-xs text-muted-foreground">
                              {conv.partner.name}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {formatDate(conv.lastMessage.createdAt)}
                        </span>
                      </div>

                      <p className={`text-sm truncate mb-2 ${
                        conv.unreadCount > 0
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground'
                      }`}>
                        {conv.lastMessage.senderId === currentUserId && (
                          <span className="text-muted-foreground">You: </span>
                        )}
                        {conv.lastMessage.content}
                      </p>

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          💬 {conv.totalMessages} {conv.totalMessages === 1 ? 'message' : 'messages'}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                            <span>{conv.unreadCount}</span>
                            <span>new</span>
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          conv.partner.role === 'BUSINESS'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {conv.partner.role === 'BUSINESS' ? '🏢 Business' : '👤 User'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
