/*
  # Complete Optimized Chat Application Schema
  
  INSTRUCTIONS:
  1. Copy this entire file
  2. Go to Supabase Dashboard > SQL Editor
  3. Click "New Query"
  4. Paste this code
  5. Click "Run"
  
  This will create everything from scratch.
*/

-- ============================================
-- STEP 1: CREATE TABLES (IF NOT EXISTS)
-- ============================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT different_users CHECK (user1_id != user2_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- STEP 2: DROP OLD POLICIES (IF EXIST)
-- ============================================

DO $$ 
BEGIN
  -- Drop profiles policies
  DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can read other profiles for discovery" ON profiles;
  DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
  DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_insert_signup" ON profiles;

  -- Drop conversations policies
  DROP POLICY IF EXISTS "Users can read own conversations" ON conversations;
  DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
  DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
  DROP POLICY IF EXISTS "conversations_select_own" ON conversations;
  DROP POLICY IF EXISTS "conversations_insert_own" ON conversations;
  DROP POLICY IF EXISTS "conversations_update_own" ON conversations;

  -- Drop messages policies
  DROP POLICY IF EXISTS "Users can read messages in their conversations" ON messages;
  DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;
  DROP POLICY IF EXISTS "messages_select_own" ON messages;
  DROP POLICY IF EXISTS "messages_insert_own" ON messages;
END $$;

-- ============================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: CREATE RLS POLICIES
-- ============================================

-- Profiles Policies
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Conversations Policies
CREATE POLICY "conversations_select_own"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    user1_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR user2_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "conversations_insert_own"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    user1_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR user2_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "conversations_update_own"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    user1_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR user2_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Messages Policies
CREATE POLICY "messages_select_own"
  ON messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE user1_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
         OR user2_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert_own"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE user1_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
         OR user2_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    AND sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to automatically create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  
-- ============================================
-- STEP 5: DROP OLD INDEXES (IF EXIST)
-- ============================================

DROP INDEX IF EXISTS idx_profiles_user_id;
DROP INDEX IF EXISTS idx_profiles_username;
DROP INDEX IF EXISTS idx_profiles_email;
DROP INDEX IF EXISTS idx_profiles_user_lookup;
DROP INDEX IF EXISTS idx_profiles_user_covering;
DROP INDEX IF EXISTS idx_conversations_users;
DROP INDEX IF EXISTS idx_conversations_user1;
DROP INDEX IF EXISTS idx_conversations_user2;
DROP INDEX IF EXISTS idx_conversations_updated;
DROP INDEX IF EXISTS idx_conversations_lookup;
DROP INDEX IF EXISTS idx_conversations_user1_user2;
DROP INDEX IF EXISTS idx_conversations_user2_user1;
DROP INDEX IF EXISTS idx_conversations_updated_desc;
DROP INDEX IF EXISTS idx_messages_conversation;
DROP INDEX IF EXISTS idx_messages_sender;
DROP INDEX IF EXISTS idx_messages_created_at;
DROP INDEX IF EXISTS idx_messages_conversation_created;
DROP INDEX IF EXISTS idx_messages_conv_time;
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_messages_sender_id;
DROP INDEX IF EXISTS idx_messages_created_desc;
DROP INDEX IF EXISTS idx_messages_conv_created;
DROP INDEX IF EXISTS idx_messages_recent;
DROP INDEX IF EXISTS idx_messages_recent_30d;
DROP INDEX IF EXISTS idx_messages_recent_7d;

-- ============================================
-- STEP 6: CREATE PERFORMANCE INDEXES
-- ============================================

-- Profiles indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_user_covering ON profiles(user_id) INCLUDE (id, username, email);

-- Conversations indexes
CREATE INDEX idx_conversations_user1_user2 ON conversations(user1_id, user2_id);
CREATE INDEX idx_conversations_user2_user1 ON conversations(user2_id, user1_id);
CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX idx_conversations_updated_desc ON conversations(updated_at DESC);

-- Messages indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_desc ON messages(created_at DESC);
CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at DESC);

-- ============================================
-- STEP 7: DROP OLD TRIGGERS & FUNCTIONS
-- ============================================

DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON messages;
DROP TRIGGER IF EXISTS trigger_normalize_conversation_users ON conversations;
DROP FUNCTION IF EXISTS update_conversation_timestamp();
DROP FUNCTION IF EXISTS normalize_conversation_users();

-- ============================================
-- STEP 8: CREATE FUNCTIONS
-- ============================================

-- Create a function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text, 1, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update conversation timestamp
CREATE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to normalize conversation users
CREATE FUNCTION normalize_conversation_users()
RETURNS TRIGGER AS $$
DECLARE
  temp_id uuid;
BEGIN
  IF NEW.user1_id > NEW.user2_id THEN
    temp_id := NEW.user1_id;
    NEW.user1_id := NEW.user2_id;
    NEW.user2_id := temp_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 9: CREATE TRIGGERS
-- ============================================

CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

CREATE TRIGGER trigger_normalize_conversation_users
  BEFORE INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION normalize_conversation_users();

-- ============================================
-- STEP 10: ADD UNIQUE CONSTRAINT
-- ============================================

DO $$ 
BEGIN
  ALTER TABLE conversations 
  DROP CONSTRAINT IF EXISTS unique_conversation_pair;
  
  ALTER TABLE conversations 
  ADD CONSTRAINT unique_conversation_pair UNIQUE (user1_id, user2_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- STEP 11: OPTIMIZE DATABASE
-- ============================================

ANALYZE profiles;
ANALYZE conversations;
ANALYZE messages;

ALTER TABLE profiles ALTER COLUMN user_id SET STATISTICS 1000;
ALTER TABLE conversations ALTER COLUMN user1_id SET STATISTICS 1000;
ALTER TABLE conversations ALTER COLUMN user2_id SET STATISTICS 1000;
ALTER TABLE messages ALTER COLUMN conversation_id SET STATISTICS 1000;

-- ============================================
-- STEP 12: VERIFICATION
-- ============================================

DO $$ 
DECLARE
  table_count INTEGER;
  index_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('profiles', 'conversations', 'messages');
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE tablename IN ('profiles', 'conversations', 'messages');
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename IN ('profiles', 'conversations', 'messages');
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ DATABASE SETUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 Tables created: %', table_count;
  RAISE NOTICE '🚀 Indexes created: %', index_count;
  RAISE NOTICE '🔒 RLS Policies created: %', policy_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE '✨ Your chat app is ready to use!';
  RAISE NOTICE '========================================';
END $$;