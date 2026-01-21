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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      anticipo_aplicaciones: {
        Row: {
          anticipo_id: string
          created_at: string
          id: string
          monto_aplicado: number
          pago_id: string
        }
        Insert: {
          anticipo_id: string
          created_at?: string
          id?: string
          monto_aplicado: number
          pago_id: string
        }
        Update: {
          anticipo_id?: string
          created_at?: string
          id?: string
          monto_aplicado?: number
          pago_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anticipo_aplicaciones_anticipo_id_fkey"
            columns: ["anticipo_id"]
            isOneToOne: false
            referencedRelation: "anticipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipo_aplicaciones_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos_destajos"
            referencedColumns: ["id"]
          },
        ]
      }
      anticipos: {
        Row: {
          created_at: string
          id: string
          instalador_id: string
          monto_disponible: number
          monto_original: number
          obra_id: string
          observaciones: string | null
          registrado_por: string
        }
        Insert: {
          created_at?: string
          id?: string
          instalador_id: string
          monto_disponible: number
          monto_original: number
          obra_id: string
          observaciones?: string | null
          registrado_por: string
        }
        Update: {
          created_at?: string
          id?: string
          instalador_id?: string
          monto_disponible?: number
          monto_original?: number
          obra_id?: string
          observaciones?: string | null
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "anticipos_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "instaladores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      avance_items: {
        Row: {
          avance_id: string
          cantidad_completada: number
          created_at: string | null
          id: string
          obra_item_id: string
        }
        Insert: {
          avance_id: string
          cantidad_completada?: number
          created_at?: string | null
          id?: string
          obra_item_id: string
        }
        Update: {
          avance_id?: string
          cantidad_completada?: number
          created_at?: string | null
          id?: string
          obra_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avance_items_avance_id_fkey"
            columns: ["avance_id"]
            isOneToOne: false
            referencedRelation: "avances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avance_items_obra_item_id_fkey"
            columns: ["obra_item_id"]
            isOneToOne: false
            referencedRelation: "obra_items"
            referencedColumns: ["id"]
          },
        ]
      }
      avances: {
        Row: {
          closets_completados: number | null
          cocinas_completadas: number | null
          created_at: string | null
          cubiertas_completadas: number | null
          fecha: string
          id: string
          instalador_id: string
          obra_id: string
          observaciones: string | null
          registrado_por: string
          vanitys_completados: number | null
        }
        Insert: {
          closets_completados?: number | null
          cocinas_completadas?: number | null
          created_at?: string | null
          cubiertas_completadas?: number | null
          fecha?: string
          id?: string
          instalador_id: string
          obra_id: string
          observaciones?: string | null
          registrado_por: string
          vanitys_completados?: number | null
        }
        Update: {
          closets_completados?: number | null
          cocinas_completadas?: number | null
          created_at?: string | null
          cubiertas_completadas?: number | null
          fecha?: string
          id?: string
          instalador_id?: string
          obra_id?: string
          observaciones?: string | null
          registrado_por?: string
          vanitys_completados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "avances_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "instaladores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avances_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avances_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cortes_semanales: {
        Row: {
          cerrado_por: string | null
          created_at: string | null
          created_by: string
          estado: string
          fecha_cierre: string | null
          fecha_fin: string
          fecha_inicio: string
          id: string
          nombre: string
          total_monto: number
        }
        Insert: {
          cerrado_por?: string | null
          created_at?: string | null
          created_by: string
          estado?: string
          fecha_cierre?: string | null
          fecha_fin: string
          fecha_inicio: string
          id?: string
          nombre: string
          total_monto?: number
        }
        Update: {
          cerrado_por?: string | null
          created_at?: string | null
          created_by?: string
          estado?: string
          fecha_cierre?: string | null
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          nombre?: string
          total_monto?: number
        }
        Relationships: []
      }
      extras: {
        Row: {
          aprobado_por: string | null
          created_at: string | null
          descripcion: string
          descuento: number
          estado: Database["public"]["Enums"]["extra_status"] | null
          fecha_aprobacion: string | null
          id: string
          instalador_id: string
          monto: number
          obra_id: string
          solicitado_por: string
          tipo_extra_id: string | null
        }
        Insert: {
          aprobado_por?: string | null
          created_at?: string | null
          descripcion: string
          descuento?: number
          estado?: Database["public"]["Enums"]["extra_status"] | null
          fecha_aprobacion?: string | null
          id?: string
          instalador_id: string
          monto: number
          obra_id: string
          solicitado_por: string
          tipo_extra_id?: string | null
        }
        Update: {
          aprobado_por?: string | null
          created_at?: string | null
          descripcion?: string
          descuento?: number
          estado?: Database["public"]["Enums"]["extra_status"] | null
          fecha_aprobacion?: string | null
          id?: string
          instalador_id?: string
          monto?: number
          obra_id?: string
          solicitado_por?: string
          tipo_extra_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extras_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "instaladores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extras_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extras_tipo_extra_id_fkey"
            columns: ["tipo_extra_id"]
            isOneToOne: false
            referencedRelation: "tipos_extra"
            referencedColumns: ["id"]
          },
        ]
      }
      instaladores: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          nombre: string
          nombre_banco: string | null
          numero_cuenta: string | null
          salario_semanal: number | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre: string
          nombre_banco?: string | null
          numero_cuenta?: string | null
          salario_semanal?: number | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre?: string
          nombre_banco?: string | null
          numero_cuenta?: string | null
          salario_semanal?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      obra_instaladores: {
        Row: {
          created_at: string | null
          id: string
          instalador_id: string
          obra_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instalador_id: string
          obra_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instalador_id?: string
          obra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_instaladores_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "instaladores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_instaladores_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_items: {
        Row: {
          cantidad: number
          created_at: string | null
          descripcion: string
          id: string
          obra_id: string
          precio_unitario: number
        }
        Insert: {
          cantidad?: number
          created_at?: string | null
          descripcion: string
          id?: string
          obra_id: string
          precio_unitario?: number
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          descripcion?: string
          id?: string
          obra_id?: string
          precio_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "obra_items_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_supervisores: {
        Row: {
          created_at: string | null
          id: string
          obra_id: string
          supervisor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          obra_id: string
          supervisor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          obra_id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_supervisores_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          cliente: string | null
          created_at: string | null
          descuento: number
          estado: Database["public"]["Enums"]["obra_status"] | null
          id: string
          nombre: string
          precio_closet: number
          precio_cocina: number
          precio_cubierta: number
          precio_vanity: number
          responsable: string | null
          ubicacion: string | null
          updated_at: string | null
        }
        Insert: {
          cliente?: string | null
          created_at?: string | null
          descuento?: number
          estado?: Database["public"]["Enums"]["obra_status"] | null
          id?: string
          nombre: string
          precio_closet?: number
          precio_cocina?: number
          precio_cubierta?: number
          precio_vanity?: number
          responsable?: string | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente?: string | null
          created_at?: string | null
          descuento?: number
          estado?: Database["public"]["Enums"]["obra_status"] | null
          id?: string
          nombre?: string
          precio_closet?: number
          precio_cocina?: number
          precio_cubierta?: number
          precio_vanity?: number
          responsable?: string | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pagos_destajos: {
        Row: {
          corte_id: string | null
          created_at: string | null
          fecha: string
          id: string
          instalador_id: string
          metodo_pago: Database["public"]["Enums"]["payment_method"]
          monto: number
          obra_id: string
          observaciones: string | null
          referencia: string | null
          registrado_por: string
          solicitud_id: string | null
        }
        Insert: {
          corte_id?: string | null
          created_at?: string | null
          fecha?: string
          id?: string
          instalador_id: string
          metodo_pago: Database["public"]["Enums"]["payment_method"]
          monto: number
          obra_id: string
          observaciones?: string | null
          referencia?: string | null
          registrado_por: string
          solicitud_id?: string | null
        }
        Update: {
          corte_id?: string | null
          created_at?: string | null
          fecha?: string
          id?: string
          instalador_id?: string
          metodo_pago?: Database["public"]["Enums"]["payment_method"]
          monto?: number
          obra_id?: string
          observaciones?: string | null
          referencia?: string | null
          registrado_por?: string
          solicitud_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_destajos_corte_id_fkey"
            columns: ["corte_id"]
            isOneToOne: false
            referencedRelation: "cortes_semanales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_destajos_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "instaladores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_destajos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_destajos_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          concept: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          concept: string
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          concept?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_commissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          percentage: number
          sale_id: string
          seller_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          percentage: number
          sale_id: string
          seller_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          percentage?: number
          sale_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_commissions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          client_name: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          project_name: string
          total_with_vat: number
          total_without_vat: number
          updated_at: string
          vat: number
        }
        Insert: {
          client_name: string
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          project_name: string
          total_with_vat: number
          total_without_vat: number
          updated_at?: string
          vat: number
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          project_name?: string
          total_with_vat?: number
          total_without_vat?: number
          updated_at?: string
          vat?: number
        }
        Relationships: []
      }
      sellers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      solicitudes_pago: {
        Row: {
          aprobado_por: string | null
          avance_id: string | null
          closets_solicitados: number | null
          cocinas_solicitadas: number | null
          corte_id: string | null
          created_at: string | null
          estado: Database["public"]["Enums"]["payment_request_status"] | null
          extras_ids: string[] | null
          fecha_aprobacion: string | null
          id: string
          instalador_id: string
          monto_libre: number | null
          obra_id: string
          observaciones: string | null
          retencion: number | null
          solicitado_por: string
          subtotal_extras: number | null
          subtotal_piezas: number | null
          tipo: string
          total_solicitado: number
        }
        Insert: {
          aprobado_por?: string | null
          avance_id?: string | null
          closets_solicitados?: number | null
          cocinas_solicitadas?: number | null
          corte_id?: string | null
          created_at?: string | null
          estado?: Database["public"]["Enums"]["payment_request_status"] | null
          extras_ids?: string[] | null
          fecha_aprobacion?: string | null
          id?: string
          instalador_id: string
          monto_libre?: number | null
          obra_id: string
          observaciones?: string | null
          retencion?: number | null
          solicitado_por: string
          subtotal_extras?: number | null
          subtotal_piezas?: number | null
          tipo: string
          total_solicitado: number
        }
        Update: {
          aprobado_por?: string | null
          avance_id?: string | null
          closets_solicitados?: number | null
          cocinas_solicitadas?: number | null
          corte_id?: string | null
          created_at?: string | null
          estado?: Database["public"]["Enums"]["payment_request_status"] | null
          extras_ids?: string[] | null
          fecha_aprobacion?: string | null
          id?: string
          instalador_id?: string
          monto_libre?: number | null
          obra_id?: string
          observaciones?: string | null
          retencion?: number | null
          solicitado_por?: string
          subtotal_extras?: number | null
          subtotal_piezas?: number | null
          tipo?: string
          total_solicitado?: number
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_pago_avance_id_fkey"
            columns: ["avance_id"]
            isOneToOne: false
            referencedRelation: "avances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_pago_corte_id_fkey"
            columns: ["corte_id"]
            isOneToOne: false
            referencedRelation: "cortes_semanales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_pago_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "instaladores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_pago_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_extra: {
        Row: {
          activo: boolean | null
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_read: boolean | null
          can_update: boolean | null
          created_at: string | null
          id: string
          module_id: string
          submodule_id: string | null
          user_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string | null
          id?: string
          module_id: string
          submodule_id?: string | null
          user_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string | null
          id?: string
          module_id?: string
          submodule_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_obra: { Args: { _obra_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      extra_status: "pendiente" | "aprobado" | "rechazado"
      obra_status: "activa" | "cerrada"
      payment_method: "efectivo" | "transferencia" | "cheque" | "otro"
      payment_request_status: "pendiente" | "aprobada" | "rechazada"
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
      app_role: ["admin", "user"],
      extra_status: ["pendiente", "aprobado", "rechazado"],
      obra_status: ["activa", "cerrada"],
      payment_method: ["efectivo", "transferencia", "cheque", "otro"],
      payment_request_status: ["pendiente", "aprobada", "rechazada"],
    },
  },
} as const
