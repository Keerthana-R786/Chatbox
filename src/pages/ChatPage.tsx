import React, { useState, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { UserList } from '../components/UserList';
import { ChatWindow } from '../components/ChatWindow';
import { Profile } from '../types';

export function ChatPage() {
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const handleBack = useCallback(() => setSelectedUser(null), []);
  const handleSelect = useCallback((user: Profile) => setSelectedUser(user), []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {selectedUser ? (
          <ChatWindow key={selectedUser.id} otherUser={selectedUser} onBack={handleBack} />
        ) : (
          <UserList onSelectUser={handleSelect} />
        )}
      </div>
    </div>
  );
}