import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Send, ArrowLeft, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Message, Profile } from '../types';

interface ChatWindowProps {
  otherUser: Profile;
  onBack: () => void;
}

const MessageItem = React.memo(({ msg, isOwn }: { msg: Message; isOwn: boolean }) => {
  const time = useMemo(() => 
    new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [msg.created_at]
  );

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs px-4 py-2 rounded-lg ${isOwn ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
        <p className="text-sm">{msg.content}</p>
        <p className={`text-xs mt-1 ${isOwn ? 'text-indigo-100' : 'text-gray-500'}`}>{time}</p>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export function ChatWindow({ otherUser, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const conversationIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!profile?.id || hasInitialized.current) return;
    hasInitialized.current = true;

    const initChat = async () => {
      try {
        // Find or create conversation
        const { data: convs } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(user1_id.eq.${profile.id},user2_id.eq.${otherUser.id}),and(user1_id.eq.${otherUser.id},user2_id.eq.${profile.id})`)
          .limit(1);

        let convId: string;

        if (convs && convs.length > 0) {
          convId = convs[0].id;
        } else {
          const { data: newConv, error } = await supabase
            .from('conversations')
            .insert({ user1_id: profile.id, user2_id: otherUser.id })
            .select('id')
            .single();

          if (error) throw error;
          convId = newConv.id;
        }

        conversationIdRef.current = convId;

        // Load messages
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, content, created_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(100);

        setMessages(msgs || []);

        // Subscribe to new messages
        channelRef.current = supabase
          .channel(`chat:${convId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${convId}`
          }, (payload) => {
            const newMsg = payload.new as Message;
            setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          })
          .subscribe();

        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setLoading(false);
      }
    };

    initChat();

    return () => {
      channelRef.current?.unsubscribe();
      hasInitialized.current = false;
    };
  }, [profile?.id, otherUser.id]);

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const content = newMessage.trim();
    if (!content || !conversationIdRef.current || !profile?.id || sending) return;

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationIdRef.current,
      sender_id: profile.id,
      content,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');
    setSending(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationIdRef.current,
          sender_id: profile.id,
          content
        })
        .select('id, conversation_id, sender_id, content, created_at')
        .single();

      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m));
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  }, [newMessage, profile?.id, sending]);

  const messageList = useMemo(() => 
    messages.map(m => <MessageItem key={m.id} msg={m} isOwn={m.sender_id === profile?.id} />),
    [messages, profile?.id]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 flex flex-col h-96">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition">
          <ArrowLeft className="w-5 h-5" />
          <div>
            <p className="font-semibold text-gray-900">{otherUser.username}</p>
            <p className="text-xs text-gray-500">{otherUser.email}</p>
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : messageList}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={sending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}