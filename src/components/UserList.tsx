import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Users, Search, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Profile } from '../types';

interface UserListProps {
  onSelectUser: (user: Profile) => void;
}

interface SupabaseProfile {
  id: string;
  username: string;
  email: string;
  user_id?: string;
}

const UserItem = React.memo(
  ({ user, onSelect }: { user: Profile; onSelect: (user: Profile) => void }) => (
    <button
      onClick={() => onSelect(user)}
      className="w-full p-4 hover:bg-indigo-50 transition text-left group"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900 group-hover:text-indigo-600 transition">
            {user.username}
          </p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <MessageCircle className="w-5 h-5 text-gray-300 group-hover:text-indigo-600 transition" />
      </div>
    </button>
  )
);

UserItem.displayName = 'UserItem';

export function UserList({ onSelectUser }: UserListProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { profile } = useAuth();

  const allUsersCache = useRef<Profile[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetched = useRef(false);

  // ✅ Fetch all users except the logged-in user
  useEffect(() => {
    if (!profile?.id || hasFetched.current) return;

    hasFetched.current = true;

    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, email, user_id, created_at') // ✅ added created_at
          .neq('id', profile.id)
          .order('username', { ascending: true });

        if (error) throw error;

        // ✅ Ensure non-null + correct typing
        const userData = (data as Profile[] | null) ?? [];
        allUsersCache.current = userData;
        setUsers(userData);
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };


    fetchUsers();
  }, [profile?.id]);

  // ✅ Debounced Search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      const searchValue = search.trim().toLowerCase();

      if (!searchValue) {
        setUsers(allUsersCache.current);
        return;
      }

      const filtered = allUsersCache.current.filter(
        (u) =>
          u.username?.toLowerCase().includes(searchValue) ||
          u.email?.toLowerCase().includes(searchValue)
      );
      setUsers(filtered);
    }, 200);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  // ✅ Memoized user list rendering
  const userList = useMemo(
    () =>
      users.map((u) => <UserItem key={u.id} user={u} onSelect={onSelectUser} />),
    [users, onSelectUser]
  );

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Select User to Chat
          </h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm"
          />
        </div>
      </div>

      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          userList
        )}
      </div>
    </div>
  );
}
