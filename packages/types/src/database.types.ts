export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointment_attendance: {
        Row: {
          appointment_id: string
          id: string
          notes: string | null
          recorded_at: string
          recorded_by: string
          status: Database["public"]["Enums"]["appointment_attendance_status"]
          updated_at: string
        }
        Insert: {
          appointment_id: string
          id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by: string
          status: Database["public"]["Enums"]["appointment_attendance_status"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string
          status?: Database["public"]["Enums"]["appointment_attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_attendance_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_audit_events: {
        Row: {
          actor_id: string | null
          appointment_id: string
          created_at: string | null
          event_type: string
          from_status: Database["public"]["Enums"]["appointment_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["appointment_status"] | null
        }
        Insert: {
          actor_id?: string | null
          appointment_id: string
          created_at?: string | null
          event_type: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["appointment_status"] | null
        }
        Update: {
          actor_id?: string | null
          appointment_id?: string
          created_at?: string | null
          event_type?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["appointment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_audit_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string | null
          ends_at: string
          id: string
          location: string | null
          meeting_url: string | null
          modality: Database["public"]["Enums"]["appointment_modality"]
          reason: string
          scheduled_date: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          student_id: string
          tutor_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          ends_at: string
          id?: string
          location?: string | null
          meeting_url?: string | null
          modality?: Database["public"]["Enums"]["appointment_modality"]
          reason: string
          scheduled_date: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          student_id: string
          tutor_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          meeting_url?: string | null
          modality?: Database["public"]["Enums"]["appointment_modality"]
          reason?: string
          scheduled_date?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          student_id?: string
          tutor_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          created_at: string | null
          id: string
          is_converted: boolean | null
          record_date: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          subject_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_converted?: boolean | null
          record_date: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          subject_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_converted?: boolean | null
          record_date?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          subject_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_conversations: {
        Row: {
          channel: string
          confidence_score: number | null
          created_at: string
          current_topic: string | null
          ended_at: string | null
          external_user_ref: string | null
          id: string
          language: string
          last_message_at: string | null
          message_count: number
          metadata: Json | null
          resolution_type: string | null
          started_at: string
          status: string
          updated_at: string
          user_display_name: string | null
        }
        Insert: {
          channel?: string
          confidence_score?: number | null
          created_at?: string
          current_topic?: string | null
          ended_at?: string | null
          external_user_ref?: string | null
          id?: string
          language?: string
          last_message_at?: string | null
          message_count?: number
          metadata?: Json | null
          resolution_type?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_display_name?: string | null
        }
        Update: {
          channel?: string
          confidence_score?: number | null
          created_at?: string
          current_topic?: string | null
          ended_at?: string | null
          external_user_ref?: string | null
          id?: string
          language?: string
          last_message_at?: string | null
          message_count?: number
          metadata?: Json | null
          resolution_type?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_display_name?: string | null
        }
        Relationships: []
      }
      chatbot_faq_entries: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          keywords: string[] | null
          priority: number
          question: string
          requires_handoff: boolean
          source: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          answer: string
          category: string
          created_at?: string
          id?: string
          keywords?: string[] | null
          priority?: number
          question: string
          requires_handoff?: boolean
          source?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          keywords?: string[] | null
          priority?: number
          question?: string
          requires_handoff?: boolean
          source?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      chatbot_feedback: {
        Row: {
          comment: string | null
          conversation_id: string
          created_at: string
          id: string
          rating: number
          resolved: boolean
          submitted_at: string
          submitted_by_ref: string | null
        }
        Insert: {
          comment?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          rating: number
          resolved: boolean
          submitted_at?: string
          submitted_by_ref?: string | null
        }
        Update: {
          comment?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          rating?: number
          resolved?: boolean
          submitted_at?: string
          submitted_by_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_handoffs: {
        Row: {
          assigned_agent_ref: string | null
          conversation_id: string
          created_at: string
          id: string
          notes: string | null
          priority: string
          reason: string
          requested_at: string
          resolved_at: string | null
          status: string
          trigger_message_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_agent_ref?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string
          reason: string
          requested_at?: string
          resolved_at?: string | null
          status?: string
          trigger_message_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_agent_ref?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string
          reason?: string
          requested_at?: string
          resolved_at?: string | null
          status?: string
          trigger_message_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_handoffs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_handoffs_trigger_message_id_fkey"
            columns: ["trigger_message_id"]
            isOneToOne: false
            referencedRelation: "chatbot_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_messages: {
        Row: {
          confidence_score: number | null
          content: string
          conversation_id: string
          created_at: string
          faq_entry_id: string | null
          id: string
          intent_detected: string | null
          is_escalation_trigger: boolean
          message_type: string
          payload: Json | null
          sender_ref: string | null
          sender_type: string
        }
        Insert: {
          confidence_score?: number | null
          content: string
          conversation_id: string
          created_at?: string
          faq_entry_id?: string | null
          id?: string
          intent_detected?: string | null
          is_escalation_trigger?: boolean
          message_type?: string
          payload?: Json | null
          sender_ref?: string | null
          sender_type: string
        }
        Update: {
          confidence_score?: number | null
          content?: string
          conversation_id?: string
          created_at?: string
          faq_entry_id?: string | null
          id?: string
          intent_detected?: string | null
          is_escalation_trigger?: boolean
          message_type?: string
          payload?: Json | null
          sender_ref?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_messages_faq_entry_id_fkey"
            columns: ["faq_entry_id"]
            isOneToOne: false
            referencedRelation: "chatbot_faq_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          processed_at: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          template_data: Json
          template_slug: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          processed_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          template_data?: Json
          template_slug: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          processed_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          template_data?: Json
          template_slug?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      incident_audit_events: {
        Row: {
          actor_id: string | null
          assigned_to: string | null
          created_at: string | null
          event_type: string
          from_priority: Database["public"]["Enums"]["incident_priority"] | null
          from_status: Database["public"]["Enums"]["incident_status"] | null
          id: string
          incident_id: string
          note: string | null
          to_priority: Database["public"]["Enums"]["incident_priority"] | null
          to_status: Database["public"]["Enums"]["incident_status"] | null
        }
        Insert: {
          actor_id?: string | null
          assigned_to?: string | null
          created_at?: string | null
          event_type: string
          from_priority?:
            | Database["public"]["Enums"]["incident_priority"]
            | null
          from_status?: Database["public"]["Enums"]["incident_status"] | null
          id?: string
          incident_id: string
          note?: string | null
          to_priority?: Database["public"]["Enums"]["incident_priority"] | null
          to_status?: Database["public"]["Enums"]["incident_status"] | null
        }
        Update: {
          actor_id?: string | null
          assigned_to?: string | null
          created_at?: string | null
          event_type?: string
          from_priority?:
            | Database["public"]["Enums"]["incident_priority"]
            | null
          from_status?: Database["public"]["Enums"]["incident_status"] | null
          id?: string
          incident_id?: string
          note?: string | null
          to_priority?: Database["public"]["Enums"]["incident_priority"] | null
          to_status?: Database["public"]["Enums"]["incident_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_audit_events_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_audit_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_comments: {
        Row: {
          author_id: string
          comment: string
          created_at: string | null
          id: string
          incident_id: string
        }
        Insert: {
          author_id: string
          comment: string
          created_at?: string | null
          id?: string
          incident_id: string
        }
        Update: {
          author_id?: string
          comment?: string
          created_at?: string | null
          id?: string
          incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_comments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          area: string
          assigned_to: string | null
          category: string
          closed_at: string | null
          created_at: string | null
          description: string
          first_response_at: string | null
          id: string
          priority: Database["public"]["Enums"]["incident_priority"]
          reported_by: string
          resolution_summary: string | null
          resolved_at: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
          area: string
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string | null
          description: string
          first_response_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["incident_priority"]
          reported_by: string
          resolution_summary?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
          area?: string
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string | null
          description?: string
          first_response_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["incident_priority"]
          reported_by?: string
          resolution_summary?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      justification_audit_events: {
        Row: {
          actor_id: string | null
          created_at: string | null
          event_type: string
          from_status:
            | Database["public"]["Enums"]["justification_status"]
            | null
          id: string
          justification_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["justification_status"] | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          event_type: string
          from_status?:
            | Database["public"]["Enums"]["justification_status"]
            | null
          id?: string
          justification_id: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["justification_status"] | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          event_type?: string
          from_status?:
            | Database["public"]["Enums"]["justification_status"]
            | null
          id?: string
          justification_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["justification_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "justification_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justification_audit_events_justification_id_fkey"
            columns: ["justification_id"]
            isOneToOne: false
            referencedRelation: "justifications"
            referencedColumns: ["id"]
          },
        ]
      }
      justification_files: {
        Row: {
          content_type: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id: string
          justification_id: string
          uploaded_at: string | null
        }
        Insert: {
          content_type: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id?: string
          justification_id: string
          uploaded_at?: string | null
        }
        Update: {
          content_type?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          id?: string
          justification_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "justification_files_justification_id_fkey"
            columns: ["justification_id"]
            isOneToOne: false
            referencedRelation: "justifications"
            referencedColumns: ["id"]
          },
        ]
      }
      justifications: {
        Row: {
          category: Database["public"]["Enums"]["justification_category"]
          created_at: string | null
          description: string
          due_date: string
          end_date: string
          folio: string
          id: string
          review_notes: string | null
          reviewer_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["justification_status"] | null
          student_id: string
          submitted_at: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["justification_category"]
          created_at?: string | null
          description: string
          due_date: string
          end_date: string
          folio: string
          id?: string
          review_notes?: string | null
          reviewer_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["justification_status"] | null
          student_id: string
          submitted_at?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["justification_category"]
          created_at?: string | null
          description?: string
          due_date?: string
          end_date?: string
          folio?: string
          id?: string
          review_notes?: string | null
          reviewer_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["justification_status"] | null
          student_id?: string
          submitted_at?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "justifications_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_event_types: {
        Row: {
          channel: string
          created_at: string
          description: string | null
          id: number
          label: string
          slug: string
        }
        Insert: {
          channel: string
          created_at?: string
          description?: string | null
          id?: number
          label: string
          slug: string
        }
        Update: {
          channel?: string
          created_at?: string
          description?: string | null
          id?: number
          label?: string
          slug?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          created_at: string
          email_queue_id: string | null
          event_type: string
          id: string
          notification_id: string | null
          payload: Json | null
          triggered_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_queue_id?: string | null
          event_type: string
          id?: string
          notification_id?: string | null
          payload?: Json | null
          triggered_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_queue_id?: string | null
          event_type?: string
          id?: string
          notification_id?: string | null
          payload?: Json | null
          triggered_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_email_queue_id_fkey"
            columns: ["email_queue_id"]
            isOneToOne: false
            referencedRelation: "email_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email: boolean
          event_type: string
          id: string
          in_app: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: boolean
          event_type: string
          id?: string
          in_app?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: boolean
          event_type?: string
          id?: string
          in_app?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_event_type_fkey"
            columns: ["event_type"]
            isOneToOne: false
            referencedRelation: "notification_event_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          event_type: string
          id: string
          is_read: boolean
          metadata: Json | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_type: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_type?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_type_fkey"
            columns: ["event_type"]
            isOneToOne: false
            referencedRelation: "notification_event_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          permission: string
          role: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          permission: string
          role: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          permission?: string
          role?: string
        }
        Relationships: []
      }
      session_tokens: {
        Row: {
          created_at: string | null
          device_name: string | null
          expires_at: string
          id: string
          ip_address: unknown
          revoked_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown
          revoked_at?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown
          revoked_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          career: string
          cohort: string
          created_at: string | null
          enrollment_date: string
          expected_graduation: string | null
          id: string
          status: string | null
          student_code: string
          updated_at: string | null
        }
        Insert: {
          career: string
          cohort: string
          created_at?: string | null
          enrollment_date: string
          expected_graduation?: string | null
          id: string
          status?: string | null
          student_code: string
          updated_at?: string | null
        }
        Update: {
          career?: string
          cohort?: string
          created_at?: string | null
          enrollment_date?: string
          expected_graduation?: string | null
          id?: string
          status?: string | null
          student_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          availability_hours: Json | null
          created_at: string | null
          department: string
          employee_code: string
          id: string
          office_location: string | null
          specialization: string[] | null
          updated_at: string | null
        }
        Insert: {
          availability_hours?: Json | null
          created_at?: string | null
          department: string
          employee_code: string
          id: string
          office_location?: string | null
          specialization?: string[] | null
          updated_at?: string | null
        }
        Update: {
          availability_hours?: Json | null
          created_at?: string | null
          department?: string
          employee_code?: string
          id?: string
          office_location?: string | null
          specialization?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_availability: {
        Row: {
          active: boolean
          created_at: string | null
          day_of_week: number
          ends_at: string
          id: string
          location: string | null
          modality: Database["public"]["Enums"]["appointment_modality"]
          starts_at: string
          tutor_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          day_of_week: number
          ends_at: string
          id?: string
          location?: string | null
          modality?: Database["public"]["Enums"]["appointment_modality"]
          starts_at: string
          tutor_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          day_of_week?: number
          ends_at?: string
          id?: string
          location?: string | null
          modality?: Database["public"]["Enums"]["appointment_modality"]
          starts_at?: string
          tutor_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_availability_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_team_members: {
        Row: {
          id: string
          joined_at: string
          status: string
          student_id: string
          team_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          status?: string
          student_id: string
          team_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          status?: string
          student_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_team_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tutor_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_teams: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          join_code: string
          name: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          join_code: string
          name: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          join_code?: string
          name?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_teams_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoring_session_notes: {
        Row: {
          agreements: string | null
          appointment_id: string
          author_id: string
          created_at: string | null
          id: string
          observations: string
          recommendations: string | null
        }
        Insert: {
          agreements?: string | null
          appointment_id: string
          author_id: string
          created_at?: string | null
          id?: string
          observations: string
          recommendations?: string | null
        }
        Update: {
          agreements?: string | null
          appointment_id?: string
          author_id?: string
          created_at?: string | null
          id?: string
          observations?: string
          recommendations?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_session_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutoring_session_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorship_assignments: {
        Row: {
          assigned_date: string | null
          created_at: string | null
          id: string
          status: string | null
          student_id: string
          tutor_id: string
        }
        Insert: {
          assigned_date?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          student_id: string
          tutor_id: string
        }
        Update: {
          assigned_date?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          student_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorship_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutorship_assignments_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_tutor_team: {
        Args: { p_name?: string }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          join_code: string
          name: string
        }[]
      }
      emit_notification: {
        Args: {
          p_body: string
          p_event_type: string
          p_metadata?: Json
          p_title: string
          p_triggered_by?: string
          p_user_id: string
        }
        Returns: string
      }
      generate_tutor_join_code: { Args: never; Returns: string }
      get_email_queue_summary: {
        Args: never
        Returns: {
          last_error: string
          oldest_scheduled_at: string
          status: Database["public"]["Enums"]["email_status"]
          total: number
        }[]
      }
      get_teacher_directory: {
        Args: never
        Returns: {
          department: string
          email: string
          full_name: string
          id: string
        }[]
      }
      has_role: { Args: { allowed_roles: string[] }; Returns: boolean }
      incident_sla_due_at: {
        Args: {
          p_created_at: string
          p_priority: Database["public"]["Enums"]["incident_priority"]
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      join_tutor_team: {
        Args: { p_join_code: string }
        Returns: {
          join_code: string
          student_id: string
          team_id: string
          tutor_id: string
        }[]
      }
      send_tutor_teacher_notification: {
        Args: {
          p_body: string
          p_teacher_id: string
          p_team_id: string
          p_title: string
        }
        Returns: string
      }
      set_user_role: {
        Args: { new_role: string; target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      appointment_attendance_status: "attended" | "no_show" | "excused_absence"
      appointment_modality: "presencial" | "virtual"
      appointment_status:
        | "pendiente"
        | "confirmada"
        | "cancelada"
        | "completada"
        | "no_asistio"
      attendance_status: "present" | "tardy" | "absent"
      email_status: "pending" | "processing" | "sent" | "failed" | "cancelled"
      incident_priority: "alta" | "media" | "baja"
      incident_status: "abierta" | "en_proceso" | "resuelta" | "cerrada"
      justification_category: "medical" | "official" | "personal"
      justification_status:
        | "pending"
        | "approved"
        | "rejected"
        | "requires_more_info"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_attendance_status: ["attended", "no_show", "excused_absence"],
      appointment_modality: ["presencial", "virtual"],
      appointment_status: [
        "pendiente",
        "confirmada",
        "cancelada",
        "completada",
        "no_asistio",
      ],
      attendance_status: ["present", "tardy", "absent"],
      email_status: ["pending", "processing", "sent", "failed", "cancelled"],
      incident_priority: ["alta", "media", "baja"],
      incident_status: ["abierta", "en_proceso", "resuelta", "cerrada"],
      justification_category: ["medical", "official", "personal"],
      justification_status: [
        "pending",
        "approved",
        "rejected",
        "requires_more_info",
      ],
    },
  },
} as const
