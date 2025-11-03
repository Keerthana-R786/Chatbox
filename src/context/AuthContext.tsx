import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { supabase } from '../lib/supabase';
import { User, Profile, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const profileCache = useRef<Map<string, Profile>>(new Map());
  const sessionChecked = useRef(false);

  // ✅ Fetch profile with caching
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (profileCache.current.has(userId)) {
      return profileCache.current.get(userId)!;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, username, email, created_at')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const formattedProfile: Profile = {
          id: data.id,
          user_id: data.user_id,
          username: data.username || data.email?.split('@')[0] || 'User',
          email: data.email || '',
          created_at: data.created_at || new Date().toISOString(),
        };
        profileCache.current.set(userId, formattedProfile);
        return formattedProfile;
      }
      return null;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  }, []);

  // ✅ Update user state quickly after login
  const updateUserState = useCallback(
    async (sessionUser: any) => {
      try {
        const profileData = await fetchProfile(sessionUser.id);

        const newUser: User = {
          id: sessionUser.id,
          email: sessionUser.email || '',
          username: profileData?.username || sessionUser.email?.split('@')[0] || 'User',
        };

        setUser(newUser);

        if (profileData) {
          setProfile(profileData);
        } else {
          setProfile({
            id: sessionUser.id,
            user_id: sessionUser.id,
            username: newUser.username,
            email: newUser.email,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Error updating user state:', err);
      }
    },
    [fetchProfile]
  );

  // ✅ Initialize session only once
  useEffect(() => {
    if (sessionChecked.current) return;
    sessionChecked.current = true;

    // Safety timeout to ensure loading always resolves (2 seconds)
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session?.user) {
          await updateUserState(session.user);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    initAuth().catch((error) => {
      console.error('Error in initAuth:', error);
      clearTimeout(timeoutId);
      setLoading(false);
    });

    let listener: any;
    try {
      const { data: listenerData } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (session?.user) {
            // Update user state - if already set by signIn, this will just refresh profile
            // Don't await to avoid blocking - update in background
            updateUserState(session.user).catch((err) => {
              console.error('Error updating user state:', err);
            });
          } else {
            setUser(null);
            setProfile(null);
            profileCache.current.clear();
          }
          setLoading(false);
        }
      );
      listener = listenerData;
    } catch (error) {
      console.error('Error setting up auth listener:', error);
      clearTimeout(timeoutId);
      setLoading(false);
    }

    return () => {
      clearTimeout(timeoutId);
      listener?.subscription?.unsubscribe();
      sessionChecked.current = false;
    };
  }, [updateUserState]);

  // ✅ Sign up user
  const signUp = async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) throw error;

    // No need to wait for verification; Supabase trigger handles profile creation
    if (data.user) {
      await updateUserState(data.user);
    }
  };

  // ✅ Sign in user (FAST fix)
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // ⚡ Immediately set user state without waiting for profile fetch
    if (data.user) {
      const newUser: User = {
        id: data.user.id,
        email: data.user.email || '',
        username: data.user.email?.split('@')[0] || 'User',
      };
      
      // Set user immediately for fast navigation
      setUser(newUser);
      
      // Set temporary profile immediately
      setProfile({
        id: data.user.id,
        user_id: data.user.id,
        username: newUser.username,
        email: newUser.email,
        created_at: new Date().toISOString(),
      });
      
      // ⚡ CRITICAL: Set loading to false immediately so app can render and navigate
      setLoading(false);
      
      // Fetch full profile in background (don't await)
      updateUserState(data.user).catch((err) => {
        console.error('Error updating user state in background:', err);
      });
    }
  };

  // ✅ Sign out user
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    setUser(null);
    setProfile(null);
    profileCache.current.clear();
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
