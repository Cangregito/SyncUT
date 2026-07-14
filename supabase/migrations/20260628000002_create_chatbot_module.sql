-- ==============================================================================
-- SQUAD 6 - CHATBOT
-- Conversaciones, mensajes, FAQ, escalamiento y feedback con RLS.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.chatbot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'web',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  language text NOT NULL DEFAULT 'es',
  external_user_ref text,
  user_display_name text,
  current_topic text,
  resolution_type text,
  confidence_score numeric(5,4),
  message_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chatbot_conversations_status_check
    CHECK (status IN ('active', 'resolved', 'abandoned', 'escalated', 'closed')),
  CONSTRAINT chatbot_conversations_resolution_check
    CHECK (resolution_type IS NULL OR resolution_type IN ('faq', 'human', 'timeout', 'unresolved'))
);

CREATE TABLE IF NOT EXISTS public.chatbot_faq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  keywords text[],
  priority integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'draft',
  source text,
  requires_handoff boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chatbot_faq_entries_status_check
    CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  sender_ref text,
  message_type text NOT NULL DEFAULT 'text',
  content text NOT NULL,
  intent_detected text,
  faq_entry_id uuid REFERENCES public.chatbot_faq_entries(id) ON DELETE SET NULL,
  confidence_score numeric(5,4),
  is_escalation_trigger boolean NOT NULL DEFAULT false,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chatbot_messages_sender_type_check
    CHECK (sender_type IN ('user', 'bot', 'agent', 'system')),
  CONSTRAINT chatbot_messages_type_check
    CHECK (message_type IN ('text', 'quick_reply', 'card', 'system_event'))
);

CREATE TABLE IF NOT EXISTS public.chatbot_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  trigger_message_id uuid REFERENCES public.chatbot_messages(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium',
  assigned_agent_ref text,
  notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chatbot_handoffs_reason_check
    CHECK (reason IN ('low_confidence', 'user_request', 'policy_case', 'no_match')),
  CONSTRAINT chatbot_handoffs_status_check
    CHECK (status IN ('pending', 'assigned', 'resolved', 'cancelled')),
  CONSTRAINT chatbot_handoffs_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE TABLE IF NOT EXISTS public.chatbot_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  resolved boolean NOT NULL,
  comment text,
  submitted_by_ref text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chatbot_feedback_rating_check CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_status ON public.chatbot_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_external_user_ref ON public.chatbot_conversations(external_user_ref);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_last_message_at ON public.chatbot_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_conversation_created ON public.chatbot_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_sender_type ON public.chatbot_messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_faq_entry_id ON public.chatbot_messages(faq_entry_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_faq_entries_category ON public.chatbot_faq_entries(category);
CREATE INDEX IF NOT EXISTS idx_chatbot_faq_entries_status ON public.chatbot_faq_entries(status);
CREATE INDEX IF NOT EXISTS idx_chatbot_faq_entries_keywords ON public.chatbot_faq_entries USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_chatbot_handoffs_conversation_id ON public.chatbot_handoffs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_handoffs_status ON public.chatbot_handoffs(status);
CREATE INDEX IF NOT EXISTS idx_chatbot_feedback_conversation_id ON public.chatbot_feedback(conversation_id);

ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_faq_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chatbot_staff_all_conversations" ON public.chatbot_conversations;
CREATE POLICY "chatbot_staff_all_conversations"
ON public.chatbot_conversations
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'teacher', 'tutor')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'teacher', 'tutor')));

DROP POLICY IF EXISTS "chatbot_users_own_conversations" ON public.chatbot_conversations;
CREATE POLICY "chatbot_users_own_conversations"
ON public.chatbot_conversations
FOR ALL
TO authenticated
USING (external_user_ref = auth.uid()::text)
WITH CHECK (external_user_ref = auth.uid()::text);

DROP POLICY IF EXISTS "chatbot_users_messages" ON public.chatbot_messages;
CREATE POLICY "chatbot_users_messages"
ON public.chatbot_messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chatbot_conversations c
    WHERE c.id = conversation_id
    AND (
      c.external_user_ref = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'teacher', 'tutor'))
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chatbot_conversations c
    WHERE c.id = conversation_id
    AND (
      c.external_user_ref = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'teacher', 'tutor'))
    )
  )
);

DROP POLICY IF EXISTS "chatbot_read_published_faq" ON public.chatbot_faq_entries;
CREATE POLICY "chatbot_read_published_faq"
ON public.chatbot_faq_entries
FOR SELECT
TO authenticated
USING (
  status = 'published'
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
);

DROP POLICY IF EXISTS "chatbot_manage_faq_staff" ON public.chatbot_faq_entries;
CREATE POLICY "chatbot_manage_faq_staff"
ON public.chatbot_faq_entries
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator')));

DROP POLICY IF EXISTS "chatbot_users_handoffs" ON public.chatbot_handoffs;
CREATE POLICY "chatbot_users_handoffs"
ON public.chatbot_handoffs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chatbot_conversations c
    WHERE c.id = conversation_id
    AND (
      c.external_user_ref = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'teacher', 'tutor'))
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chatbot_conversations c
    WHERE c.id = conversation_id
    AND (
      c.external_user_ref = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator', 'teacher', 'tutor'))
    )
  )
);

DROP POLICY IF EXISTS "chatbot_users_feedback" ON public.chatbot_feedback;
CREATE POLICY "chatbot_users_feedback"
ON public.chatbot_feedback
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chatbot_conversations c
    WHERE c.id = conversation_id
    AND c.external_user_ref = auth.uid()::text
  )
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coordinator'))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chatbot_conversations c
    WHERE c.id = conversation_id
    AND c.external_user_ref = auth.uid()::text
  )
);
