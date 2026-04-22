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
      audit_logs: {
        Row: {
          actor_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata: Json | null
          target_user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          target_user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_profile_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      damages: {
        Row: {
          approved_action: string | null
          created_at: string | null
          description: string
          id: string
          item_number: number
          purchase_order_id: number
          reported_by: string
          status: string
          suggested_action: string | null
          updated_at: string | null
        }
        Insert: {
          approved_action?: string | null
          created_at?: string | null
          description: string
          id?: string
          item_number: number
          purchase_order_id: number
          reported_by: string
          status?: string
          suggested_action?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_action?: string | null
          created_at?: string | null
          description?: string
          id?: string
          item_number?: number
          purchase_order_id?: number
          reported_by?: string
          status?: string
          suggested_action?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damages_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damages_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          attended_number: number | null
          created_at: string | null
          delivered_quantity: number | null
          delivery_date: string | null
          delivery_item_number: number | null
          id: string
          invoice_item_number: number | null
          invoice_sequential_number: number | null
          purchase_order_id: number
          purchase_order_item_number: number
          sienge_synced_at: string | null
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          validation_status: string | null
        }
        Insert: {
          attended_number?: number | null
          created_at?: string | null
          delivered_quantity?: number | null
          delivery_date?: string | null
          delivery_item_number?: number | null
          id?: string
          invoice_item_number?: number | null
          invoice_sequential_number?: number | null
          purchase_order_id: number
          purchase_order_item_number: number
          sienge_synced_at?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string | null
        }
        Update: {
          attended_number?: number | null
          created_at?: string | null
          delivered_quantity?: number | null
          delivery_date?: string | null
          delivery_item_number?: number | null
          id?: string
          invoice_item_number?: number | null
          invoice_sequential_number?: number | null
          purchase_order_id?: number
          purchase_order_item_number?: number
          sienge_synced_at?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_invoice_sequential_number_fkey"
            columns: ["invoice_sequential_number"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["sequential_number"]
          },
          {
            foreignKeyName: "deliveries_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_schedules: {
        Row: {
          created_at: string | null
          id: string
          item_number: number
          purchase_order_id: number
          scheduled_date: string
          scheduled_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_number: number
          purchase_order_id: number
          scheduled_date: string
          scheduled_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_number?: number
          purchase_order_id?: number
          scheduled_date?: string
          scheduled_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_schedules_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_trackers: {
        Row: {
          base_date: string
          created_at: string | null
          current_delivery_date: string
          id: string
          item_number: number
          purchase_order_id: number
          status: string
          suggested_date: string | null
          updated_at: string | null
        }
        Insert: {
          base_date: string
          created_at?: string | null
          current_delivery_date: string
          id?: string
          item_number: number
          purchase_order_id: number
          status?: string
          suggested_date?: string | null
          updated_at?: string | null
        }
        Update: {
          base_date?: string
          created_at?: string | null
          current_delivery_date?: string
          id?: string
          item_number?: number
          purchase_order_id?: number
          status?: string
          suggested_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_trackers_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          created_at: string | null
          direction: string
          endpoint: string
          error_message: string | null
          event_type: string
          http_method: string
          http_status: number | null
          id: string
          idempotency_key: string | null
          max_retries: number
          next_retry_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          request_payload: Json | null
          response_payload: Json | null
          retry_count: number
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          direction: string
          endpoint: string
          error_message?: string | null
          event_type: string
          http_method: string
          http_status?: number | null
          id?: string
          idempotency_key?: string | null
          max_retries?: number
          next_retry_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          retry_count?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string
          endpoint?: string
          error_message?: string | null
          event_type?: string
          http_method?: string
          http_status?: number | null
          id?: string
          idempotency_key?: string | null
          max_retries?: number
          next_retry_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          retry_count?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string | null
          id: string
          invoice_sequential_number: number
          item_number: number
          quantity: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_sequential_number: number
          item_number: number
          quantity?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_sequential_number?: number
          item_number?: number
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_sequential_number_fkey"
            columns: ["invoice_sequential_number"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["sequential_number"]
          },
        ]
      }
      invoice_order_links: {
        Row: {
          created_at: string | null
          id: string
          invoice_item_number: number
          purchase_order_id: number
          purchase_order_item_number: number
          sequential_number: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_item_number: number
          purchase_order_id: number
          purchase_order_item_number: number
          sequential_number: number
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_item_number?: number
          purchase_order_id?: number
          purchase_order_item_number?: number
          sequential_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_order_links_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_order_links_sequential_number_fkey"
            columns: ["sequential_number"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["sequential_number"]
          },
        ]
      }
      notifications: {
        Row: {
          cc_email: string | null
          created_at: string | null
          follow_up_tracker_id: string | null
          id: string
          recipient_email: string
          sent_at: string | null
          status: string | null
          type: string
        }
        Insert: {
          cc_email?: string | null
          created_at?: string | null
          follow_up_tracker_id?: string | null
          id?: string
          recipient_email: string
          sent_at?: string | null
          status?: string | null
          type: string
        }
        Update: {
          cc_email?: string | null
          created_at?: string | null
          follow_up_tracker_id?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_follow_up_tracker_id_fkey"
            columns: ["follow_up_tracker_id"]
            isOneToOne: false
            referencedRelation: "follow_up_trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_quotation_links: {
        Row: {
          created_at: string | null
          id: string
          purchase_order_id: number
          purchase_quotation_id: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          purchase_order_id: number
          purchase_quotation_id: number
        }
        Update: {
          created_at?: string | null
          id?: string
          purchase_order_id?: number
          purchase_quotation_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_quotation_links_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_quotation_links_purchase_quotation_id_fkey"
            columns: ["purchase_quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          changed_by_system: boolean
          created_at: string | null
          id: string
          new_status: string
          previous_status: string | null
          purchase_order_id: number
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          changed_by_system?: boolean
          created_at?: string | null
          id?: string
          new_status: string
          previous_status?: string | null
          purchase_order_id: number
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          changed_by_system?: boolean
          created_at?: string | null
          id?: string
          new_status?: string
          previous_status?: string | null
          purchase_order_id?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          name: string
          original_email: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          supplier_id: number | null
          updated_at: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          created_at?: string | null
          created_by?: string | null
          email: string
          id: string
          name: string
          original_email?: string | null
          role: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          supplier_id?: number | null
          updated_at?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          original_email?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          supplier_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profile_supplier"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          consistency: string | null
          created_at: string | null
          document_id: string | null
          issue_date: string | null
          movement_date: string | null
          number: string | null
          sequential_number: number
          series: string | null
          supplier_id: number
        }
        Insert: {
          consistency?: string | null
          created_at?: string | null
          document_id?: string | null
          issue_date?: string | null
          movement_date?: string | null
          number?: string | null
          sequential_number: number
          series?: string | null
          supplier_id: number
        }
        Update: {
          consistency?: string | null
          created_at?: string | null
          document_id?: string | null
          issue_date?: string | null
          movement_date?: string | null
          number?: string | null
          sequential_number?: number
          series?: string | null
          supplier_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          item_number: number
          local_delivery_date: string | null
          purchase_order_id: number
          purchase_quotation_id: number | null
          purchase_quotation_item_id: number | null
          quantity: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_number: number
          local_delivery_date?: string | null
          purchase_order_id: number
          purchase_quotation_id?: number | null
          purchase_quotation_item_id?: number | null
          quantity?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_number?: number
          local_delivery_date?: string | null
          purchase_order_id?: number
          purchase_quotation_id?: number | null
          purchase_quotation_item_id?: number | null
          quantity?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          authorized: boolean | null
          building_id: number | null
          buyer_id: string | null
          consistent: string | null
          created_at: string | null
          date: string | null
          delivery_late: boolean | null
          disapproved: boolean | null
          formatted_purchase_order_id: string | null
          has_divergence: boolean | null
          id: number
          last_delivery_date: string | null
          local_status: string
          pending_quantity: number | null
          sienge_status: string | null
          supplier_id: number
          total_quantity_delivered: number | null
          total_quantity_ordered: number | null
          updated_at: string | null
        }
        Insert: {
          authorized?: boolean | null
          building_id?: number | null
          buyer_id?: string | null
          consistent?: string | null
          created_at?: string | null
          date?: string | null
          delivery_late?: boolean | null
          disapproved?: boolean | null
          formatted_purchase_order_id?: string | null
          has_divergence?: boolean | null
          id: number
          last_delivery_date?: string | null
          local_status?: string
          pending_quantity?: number | null
          sienge_status?: string | null
          supplier_id: number
          total_quantity_delivered?: number | null
          total_quantity_ordered?: number | null
          updated_at?: string | null
        }
        Update: {
          authorized?: boolean | null
          building_id?: number | null
          buyer_id?: string | null
          consistent?: string | null
          created_at?: string | null
          date?: string | null
          delivery_late?: boolean | null
          disapproved?: boolean | null
          formatted_purchase_order_id?: string | null
          has_divergence?: boolean | null
          id?: number
          last_delivery_date?: string | null
          local_status?: string
          pending_quantity?: number | null
          sienge_status?: string | null
          supplier_id?: number
          total_quantity_delivered?: number | null
          total_quantity_ordered?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_quotation_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          purchase_quotation_id: number
          quantity: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: number
          purchase_quotation_id: number
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          purchase_quotation_id?: number
          quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_quotation_items_purchase_quotation_id_fkey"
            columns: ["purchase_quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_quotations: {
        Row: {
          buyer_id: string | null
          consistency: string | null
          created_at: string | null
          end_at: string | null
          end_date: string | null
          id: number
          local_status: string
          public_id: string | null
          quotation_date: string | null
          raw_payload: Json | null
          response_date: string | null
          sent_at: string | null
          sent_by: string | null
          sienge_status: string | null
          updated_at: string | null
        }
        Insert: {
          buyer_id?: string | null
          consistency?: string | null
          created_at?: string | null
          end_at?: string | null
          end_date?: string | null
          id: number
          local_status?: string
          public_id?: string | null
          quotation_date?: string | null
          raw_payload?: Json | null
          response_date?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sienge_status?: string | null
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string | null
          consistency?: string | null
          created_at?: string | null
          end_at?: string | null
          end_date?: string | null
          id?: number
          local_status?: string
          public_id?: string | null
          quotation_date?: string | null
          raw_payload?: Json | null
          response_date?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sienge_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_quotations_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_response_item_deliveries: {
        Row: {
          created_at: string
          delivery_date: string
          delivery_number: number
          delivery_quantity: number
          id: string
          quotation_response_item_id: string
        }
        Insert: {
          created_at?: string
          delivery_date: string
          delivery_number: number
          delivery_quantity: number
          id?: string
          quotation_response_item_id: string
        }
        Update: {
          created_at?: string
          delivery_date?: string
          delivery_number?: number
          delivery_quantity?: number
          id?: string
          quotation_response_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_response_item_deliver_quotation_response_item_id_fkey"
            columns: ["quotation_response_item_id"]
            isOneToOne: false
            referencedRelation: "quotation_response_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_response_items: {
        Row: {
          created_at: string
          detail_id: number | null
          discount: number | null
          discount_percentage: number | null
          freight_unit_price: number | null
          icms_tax_percentage: number | null
          id: string
          increase_percentage: number | null
          internal_notes: string | null
          ipi_tax_percentage: number | null
          iss_tax_percentage: number | null
          negotiated_quantity: number
          purchase_quotation_item_id: number
          quotation_item_number: number
          quotation_response_id: string
          quoted_quantity: number
          selected_option: boolean | null
          supplier_notes: string | null
          trademark_id: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail_id?: number | null
          discount?: number | null
          discount_percentage?: number | null
          freight_unit_price?: number | null
          icms_tax_percentage?: number | null
          id?: string
          increase_percentage?: number | null
          internal_notes?: string | null
          ipi_tax_percentage?: number | null
          iss_tax_percentage?: number | null
          negotiated_quantity: number
          purchase_quotation_item_id: number
          quotation_item_number: number
          quotation_response_id: string
          quoted_quantity: number
          selected_option?: boolean | null
          supplier_notes?: string | null
          trademark_id?: number | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail_id?: number | null
          discount?: number | null
          discount_percentage?: number | null
          freight_unit_price?: number | null
          icms_tax_percentage?: number | null
          id?: string
          increase_percentage?: number | null
          internal_notes?: string | null
          ipi_tax_percentage?: number | null
          iss_tax_percentage?: number | null
          negotiated_quantity?: number
          purchase_quotation_item_id?: number
          quotation_item_number?: number
          quotation_response_id?: string
          quoted_quantity?: number
          selected_option?: boolean | null
          supplier_notes?: string | null
          trademark_id?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_response_items_purchase_quotation_item_id_fkey"
            columns: ["purchase_quotation_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_response_items_quotation_response_id_fkey"
            columns: ["quotation_response_id"]
            isOneToOne: false
            referencedRelation: "quotation_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_responses: {
        Row: {
          apply_ipi_freight: boolean | null
          created_at: string
          discount: number | null
          freight_price: number | null
          freight_type: string | null
          freight_type_for_order: string | null
          id: string
          integration_attempts: number
          integration_status: string
          internal_notes: string | null
          last_integration_at: string | null
          last_integration_error: string | null
          other_expenses: number | null
          payment_terms: string | null
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          seller: string | null
          sienge_negotiation_number: number | null
          submitted_at: string
          submitted_by: string | null
          supplier_answer_date: string
          supplier_negotiation_id: string
          supplier_notes: string | null
          updated_at: string
          validity: string | null
          version: number
        }
        Insert: {
          apply_ipi_freight?: boolean | null
          created_at?: string
          discount?: number | null
          freight_price?: number | null
          freight_type?: string | null
          freight_type_for_order?: string | null
          id?: string
          integration_attempts?: number
          integration_status?: string
          internal_notes?: string | null
          last_integration_at?: string | null
          last_integration_error?: string | null
          other_expenses?: number | null
          payment_terms?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller?: string | null
          sienge_negotiation_number?: number | null
          submitted_at?: string
          submitted_by?: string | null
          supplier_answer_date: string
          supplier_negotiation_id: string
          supplier_notes?: string | null
          updated_at?: string
          validity?: string | null
          version: number
        }
        Update: {
          apply_ipi_freight?: boolean | null
          created_at?: string
          discount?: number | null
          freight_price?: number | null
          freight_type?: string | null
          freight_type_for_order?: string | null
          id?: string
          integration_attempts?: number
          integration_status?: string
          internal_notes?: string | null
          last_integration_at?: string | null
          last_integration_error?: string | null
          other_expenses?: number | null
          payment_terms?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller?: string | null
          sienge_negotiation_number?: number | null
          submitted_at?: string
          submitted_by?: string | null
          supplier_answer_date?: string
          supplier_negotiation_id?: string
          supplier_notes?: string | null
          updated_at?: string
          validity?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_responses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_responses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_responses_supplier_negotiation_id_fkey"
            columns: ["supplier_negotiation_id"]
            isOneToOne: false
            referencedRelation: "supplier_negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      sienge_credentials: {
        Row: {
          api_password: string
          api_user: string
          bulk_rate_limit: number
          created_at: string | null
          id: string
          is_active: boolean
          rest_rate_limit: number
          subdomain: string
          updated_at: string | null
        }
        Insert: {
          api_password: string
          api_user: string
          bulk_rate_limit?: number
          created_at?: string | null
          id?: string
          is_active?: boolean
          rest_rate_limit?: number
          subdomain: string
          updated_at?: string | null
        }
        Update: {
          api_password?: string
          api_user?: string
          bulk_rate_limit?: number
          created_at?: string | null
          id?: string
          is_active?: boolean
          rest_rate_limit?: number
          subdomain?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sienge_sync_cursor: {
        Row: {
          error_message: string | null
          id: string
          last_offset: number
          last_synced_at: string
          resource_type: string
          sync_status: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          last_offset?: number
          last_synced_at?: string
          resource_type: string
          sync_status?: string
        }
        Update: {
          error_message?: string | null
          id?: string
          last_offset?: number
          last_synced_at?: string
          resource_type?: string
          sync_status?: string
        }
        Relationships: []
      }
      supplier_contacts: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_primary: boolean | null
          name: string
          supplier_id: number
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_primary?: boolean | null
          name: string
          supplier_id: number
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_primary?: boolean | null
          name?: string
          supplier_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_negotiation_items: {
        Row: {
          created_at: string | null
          delivery_date: string | null
          id: string
          purchase_quotation_item_id: number
          quantity: number | null
          supplier_negotiation_id: string
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          purchase_quotation_item_id: number
          quantity?: number | null
          supplier_negotiation_id: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          purchase_quotation_item_id?: number
          quantity?: number | null
          supplier_negotiation_id?: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_negotiation_items_purchase_quotation_item_id_fkey"
            columns: ["purchase_quotation_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_negotiation_items_supplier_negotiation_id_fkey"
            columns: ["supplier_negotiation_id"]
            isOneToOne: false
            referencedRelation: "supplier_negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_negotiations: {
        Row: {
          closed_order_id: number | null
          created_at: string | null
          delivery_date: string | null
          id: string
          latest_response_id: string | null
          purchase_quotation_id: number
          read_at: string | null
          sent_at: string | null
          sienge_negotiation_id: number | null
          sienge_negotiation_number: number | null
          status: string
          supplier_email: string | null
          supplier_id: number
          updated_at: string | null
        }
        Insert: {
          closed_order_id?: number | null
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          latest_response_id?: string | null
          purchase_quotation_id: number
          read_at?: string | null
          sent_at?: string | null
          sienge_negotiation_id?: number | null
          sienge_negotiation_number?: number | null
          status?: string
          supplier_email?: string | null
          supplier_id: number
          updated_at?: string | null
        }
        Update: {
          closed_order_id?: number | null
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          latest_response_id?: string | null
          purchase_quotation_id?: number
          read_at?: string | null
          sent_at?: string | null
          sienge_negotiation_id?: number | null
          sienge_negotiation_number?: number | null
          status?: string
          supplier_email?: string | null
          supplier_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_supplier_negotiations_latest_response"
            columns: ["latest_response_id"]
            isOneToOne: false
            referencedRelation: "quotation_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_negotiations_purchase_quotation_id_fkey"
            columns: ["purchase_quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_negotiations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          access_status: string | null
          created_at: string | null
          creditor_id: number | null
          id: number
          name: string
          trade_name: string | null
          updated_at: string | null
        }
        Insert: {
          access_status?: string | null
          created_at?: string | null
          creditor_id?: number | null
          id: number
          name: string
          trade_name?: string | null
          updated_at?: string | null
        }
        Update: {
          access_status?: string | null
          created_at?: string | null
          creditor_id?: number | null
          id?: number
          name?: string
          trade_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          payload: Json
          processed_at: string | null
          status: string
          webhook_type: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          status?: string
          webhook_type: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          webhook_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth_supplier_id: { Args: never; Returns: number }
    }
    Enums: {
      user_role:
        | "fornecedor"
        | "compras"
        | "administrador"
        | "visualizador_pedidos"
      user_status: "pendente" | "ativo" | "bloqueado" | "removido"
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
      user_role: [
        "fornecedor",
        "compras",
        "administrador",
        "visualizador_pedidos",
      ],
      user_status: ["pendente", "ativo", "bloqueado", "removido"],
    },
  },
} as const
