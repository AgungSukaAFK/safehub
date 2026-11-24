
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "app_access": {
                  Row: {
                    "app_id": string,"granted_at": string,"granted_by": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_id": string,"granted_at"?: string,"granted_by"?: string | null,"role": string,"user_id": string
                  }
                  Update: {
                    "app_id"?: string,"granted_at"?: string,"granted_by"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_access_app_id_fkey"
      columns: ["app_id"]
isOneToOne: false
      referencedRelation: "apps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "app_access_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "app_access_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"apps": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id": string,"is_active"?: boolean,"name": string,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cctv_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_name": string | null,"app_id": string,"at": string,"category": string,"changes": Json | null,"client": Json | null,"company_code": string | null,"entity": string | null,"id": number,"metadata": Json | null,"record_id": string | null,"record_label": string | null,"severity": string,"summary": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_name"?: string | null,"app_id": string,"at"?: string,"category": string,"changes"?: Json | null,"client"?: Json | null,"company_code"?: string | null,"entity"?: string | null,"id"?: never,"metadata"?: Json | null,"record_id"?: string | null,"record_label"?: string | null,"severity"?: string,"summary": string,"url"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_name"?: string | null,"app_id"?: string,"at"?: string,"category"?: string,"changes"?: Json | null,"client"?: Json | null,"company_code"?: string | null,"entity"?: string | null,"id"?: never,"metadata"?: Json | null,"record_id"?: string | null,"record_label"?: string | null,"severity"?: string,"summary"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cctv_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cctv_events_app_id_fkey"
      columns: ["app_id"]
isOneToOne: false
      referencedRelation: "apps"
      referencedColumns: ["id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "accent": string,"address": string | null,"code": string,"created_at": string,"email": string | null,"is_active": boolean,"is_group": boolean,"logo_landscape_url": string | null,"logo_url": string | null,"name": string,"phone": string | null,"short_name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accent"?: string,"address"?: string | null,"code": string,"created_at"?: string,"email"?: string | null,"is_active"?: boolean,"is_group"?: boolean,"logo_landscape_url"?: string | null,"logo_url"?: string | null,"name": string,"phone"?: string | null,"short_name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "accent"?: string,"address"?: string | null,"code"?: string,"created_at"?: string,"email"?: string | null,"is_active"?: boolean,"is_group"?: boolean,"logo_landscape_url"?: string | null,"logo_url"?: string | null,"name"?: string,"phone"?: string | null,"short_name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"departments": {
                  Row: {
                    "code": string | null,"id": string,"is_active": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "code"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"job_titles": {
                  Row: {
                    "id": string,"is_active": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"locations": {
                  Row: {
                    "id": string,"is_active": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"maintenance_runs": {
                  Row: {
                    "id": number,"ran_at": string,"result": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"ran_at"?: string,"result": NonNullable<Json>
                  }
                  Update: {
                    "id"?: never,"ran_at"?: string,"result"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"company": string | null,"created_at": string,"department_id": string | null,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"job_title_id": string | null,"location_id": string | null,"nrp_gis": string | null,"nrp_gmi": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"company"?: string | null,"created_at"?: string,"department_id"?: string | null,"email"?: string | null,"full_name": string,"id": string,"is_active"?: boolean,"job_title_id"?: string | null,"location_id"?: string | null,"nrp_gis"?: string | null,"nrp_gmi"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"company"?: string | null,"created_at"?: string,"department_id"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"job_title_id"?: string | null,"location_id"?: string | null,"nrp_gis"?: string | null,"nrp_gmi"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_company_fkey"
      columns: ["company"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "profiles_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_job_title_id_fkey"
      columns: ["job_title_id"]
isOneToOne: false
      referencedRelation: "job_titles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "cctv_log":
{ Args: { "p_action": string,"p_app": string,"p_category": string,"p_changes"?: Json,"p_client"?: Json,"p_company_code"?: string,"p_entity"?: string,"p_metadata"?: Json,"p_record_id"?: string,"p_record_label"?: string,"p_severity"?: string,"p_summary": string,"p_url"?: string }; Returns: number
                           },
"has_app_role":
{ Args: { "p_app": string,"p_role": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_apps":
{ Args: Record<PropertyKey, never>; Returns: {
              "description": string,"id": string,"name": string,"role": string,"url": string
            }[]
                           },
"role_rank":
{ Args: { "p_role": string }; Returns: number
                           },
"run_maintenance_all":
{ Args: Record<PropertyKey, never>; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"safehub": {
          Tables: {
            "approval_doc_types": {
                  Row: {
                    "code": string,"context_fn": unknown,"href_prefix": string,"is_active": boolean,"label": string,"on_done_fn": unknown,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"context_fn": unknown,"href_prefix": string,"is_active"?: boolean,"label": string,"on_done_fn": unknown,"table_name": string
                  }
                  Update: {
                    "code"?: string,"context_fn"?: unknown,"href_prefix"?: string,"is_active"?: boolean,"label"?: string,"on_done_fn"?: unknown,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"approval_template_steps": {
                  Row: {
                    "approval_type": string,"approver_id": string | null,"approver_kind": string,"due_hours": number | null,"id": string,"step_no": number,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_type": string,"approver_id"?: string | null,"approver_kind": string,"due_hours"?: number | null,"id"?: string,"step_no": number,"template_id": string
                  }
                  Update: {
                    "approval_type"?: string,"approver_id"?: string | null,"approver_kind"?: string,"due_hours"?: number | null,"id"?: string,"step_no"?: number,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_template_steps_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "approval_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_templates": {
                  Row: {
                    "company_code": string | null,"created_at": string,"created_by": string | null,"department_id": string | null,"description": string | null,"doc_type": string,"id": string,"is_active": boolean,"max_amount": number | null,"min_amount": number | null,"name": string,"priority": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"department_id"?: string | null,"description"?: string | null,"doc_type": string,"id"?: string,"is_active"?: boolean,"max_amount"?: number | null,"min_amount"?: number | null,"name": string,"priority"?: number,"updated_at"?: string
                  }
                  Update: {
                    "company_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"department_id"?: string | null,"description"?: string | null,"doc_type"?: string,"id"?: string,"is_active"?: boolean,"max_amount"?: number | null,"min_amount"?: number | null,"name"?: string,"priority"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_templates_doc_type_fkey"
      columns: ["doc_type"]
isOneToOne: false
      referencedRelation: "approval_doc_types"
      referencedColumns: ["code"]
    }
                  ]
                },"approval_templates_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"approvals": {
                  Row: {
                    "approval_type": string,"approver_id": string,"created_at": string,"decided_at": string | null,"doc_type": string,"due_at": string | null,"due_hours": number | null,"id": string,"note": string | null,"record_id": string,"reminded_at": string | null,"round": number,"status": string,"step_no": number,"template_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_type": string,"approver_id": string,"created_at"?: string,"decided_at"?: string | null,"doc_type": string,"due_at"?: string | null,"due_hours"?: number | null,"id"?: string,"note"?: string | null,"record_id": string,"reminded_at"?: string | null,"round"?: number,"status"?: string,"step_no": number,"template_id"?: string | null
                  }
                  Update: {
                    "approval_type"?: string,"approver_id"?: string,"created_at"?: string,"decided_at"?: string | null,"doc_type"?: string,"due_at"?: string | null,"due_hours"?: number | null,"id"?: string,"note"?: string | null,"record_id"?: string,"reminded_at"?: string | null,"round"?: number,"status"?: string,"step_no"?: number,"template_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "approvals_doc_type_fkey"
      columns: ["doc_type"]
isOneToOne: false
      referencedRelation: "approval_doc_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "approvals_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "approval_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"areas": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"location_id": string,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"location_id": string,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"location_id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"areas_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"certificates": {
                  Row: {
                    "competency_id": string,"created_at": string,"created_by": string | null,"employee_id": string,"evidence_count": number,"id": string,"issued_on": string | null,"issuer": string | null,"number": string | null,"updated_at": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "competency_id": string,"created_at"?: string,"created_by"?: string | null,"employee_id": string,"evidence_count"?: number,"id"?: string,"issued_on"?: string | null,"issuer"?: string | null,"number"?: string | null,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "competency_id"?: string,"created_at"?: string,"created_by"?: string | null,"employee_id"?: string,"evidence_count"?: number,"id"?: string,"issued_on"?: string | null,"issuer"?: string | null,"number"?: string | null,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "certificates_competency_id_fkey"
      columns: ["competency_id"]
isOneToOne: false
      referencedRelation: "competencies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificates_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"certificates_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"competencies": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"job_titles": (string)[],"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"job_titles"?: (string)[],"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"job_titles"?: (string)[],"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"competencies_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contractor_contract_values": {
                  Row: {
                    "amount": number,"contract_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"contract_id": string
                  }
                  Update: {
                    "amount"?: number,"contract_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contractor_contract_values_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: true
      referencedRelation: "contractor_contracts"
      referencedColumns: ["id"]
    }
                  ]
                },"contractor_contracts": {
                  Row: {
                    "contractor_id": string,"created_at": string,"created_by": string | null,"ends_on": string,"id": string,"number": string,"starts_on": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contractor_id": string,"created_at"?: string,"created_by"?: string | null,"ends_on": string,"id"?: string,"number": string,"starts_on": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "contractor_id"?: string,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string,"id"?: string,"number"?: string,"starts_on"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contractor_contracts_contractor_id_fkey"
      columns: ["contractor_id"]
isOneToOne: false
      referencedRelation: "contractors"
      referencedColumns: ["id"]
    }
                  ]
                },"contractor_contracts_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contractor_doc_types": {
                  Row: {
                    "code": string,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"contractor_documents": {
                  Row: {
                    "contractor_id": string,"created_at": string,"evidence_count": number,"id": string,"note": string | null,"status": string,"type_id": string,"updated_at": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contractor_id": string,"created_at"?: string,"evidence_count"?: number,"id"?: string,"note"?: string | null,"status"?: string,"type_id": string,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "contractor_id"?: string,"created_at"?: string,"evidence_count"?: number,"id"?: string,"note"?: string | null,"status"?: string,"type_id"?: string,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contractor_documents_contractor_id_fkey"
      columns: ["contractor_id"]
isOneToOne: false
      referencedRelation: "contractors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contractor_documents_type_id_fkey"
      columns: ["type_id"]
isOneToOne: false
      referencedRelation: "contractor_doc_types"
      referencedColumns: ["id"]
    }
                  ]
                },"contractor_documents_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contractor_permits": {
                  Row: {
                    "contractor_id": string,"created_at": string,"created_by": string | null,"evidence_count": number,"id": string,"issuer": string | null,"name": string,"number": string | null,"updated_at": string,"valid_until": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contractor_id": string,"created_at"?: string,"created_by"?: string | null,"evidence_count"?: number,"id"?: string,"issuer"?: string | null,"name": string,"number"?: string | null,"updated_at"?: string,"valid_until": string
                  }
                  Update: {
                    "contractor_id"?: string,"created_at"?: string,"created_by"?: string | null,"evidence_count"?: number,"id"?: string,"issuer"?: string | null,"name"?: string,"number"?: string | null,"updated_at"?: string,"valid_until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contractor_permits_contractor_id_fkey"
      columns: ["contractor_id"]
isOneToOne: false
      referencedRelation: "contractors"
      referencedColumns: ["id"]
    }
                  ]
                },"contractor_permits_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contractors": {
                  Row: {
                    "company_code": string,"created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"kind": string,"name": string,"notes": string | null,"pic_contact": string | null,"pic_name": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: string,"name": string,"notes"?: string | null,"pic_contact"?: string | null,"pic_name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "company_code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: string,"name"?: string,"notes"?: string | null,"pic_contact"?: string | null,"pic_name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contractors_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"csms_assessments": {
                  Row: {
                    "assessed_on": string,"contractor_id": string,"created_at": string,"created_by": string | null,"id": string,"note": string | null,"result": string,"score": number,"updated_at": string,"valid_until": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assessed_on": string,"contractor_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"result": string,"score": number,"updated_at"?: string,"valid_until": string
                  }
                  Update: {
                    "assessed_on"?: string,"contractor_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"result"?: string,"score"?: number,"updated_at"?: string,"valid_until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "csms_assessments_contractor_id_fkey"
      columns: ["contractor_id"]
isOneToOne: false
      referencedRelation: "contractors"
      referencedColumns: ["id"]
    }
                  ]
                },"csms_assessments_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"department_heads": {
                  Row: {
                    "company_code": string,"department_id": string,"id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_code": string,"department_id": string,"id"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "company_code"?: string,"department_id"?: string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"department_heads_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"doc_sequences": {
                  Row: {
                    "company_code": string,"last_no": number,"period": string,"prefix": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_code": string,"last_no"?: number,"period": string,"prefix": string
                  }
                  Update: {
                    "company_code"?: string,"last_no"?: number,"period"?: string,"prefix"?: string
                  }
                  Relationships: [
                    
                  ]
                },"employees": {
                  Row: {
                    "code": string,"company_code": string,"contractor_id": string | null,"created_at": string,"created_by": string | null,"department": string | null,"employment": string,"id": string,"job_title": string,"join_date": string | null,"location_id": string,"name": string,"profile_id": string | null,"search_text": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"company_code": string,"contractor_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"department"?: string | null,"employment"?: string,"id"?: string,"job_title": string,"join_date"?: string | null,"location_id": string,"name": string,"profile_id"?: string | null,"search_text"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"company_code"?: string,"contractor_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"department"?: string | null,"employment"?: string,"id"?: string,"job_title"?: string,"join_date"?: string | null,"location_id"?: string,"name"?: string,"profile_id"?: string | null,"search_text"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "employees_contractor_id_fkey"
      columns: ["contractor_id"]
isOneToOne: false
      referencedRelation: "contractors"
      referencedColumns: ["id"]
    }
                  ]
                },"employees_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"feedback": {
                  Row: {
                    "admin_note": string | null,"attachments": (string)[],"category": string,"category_other": string | null,"content": NonNullable<Json>,"content_text": string,"context": Json | null,"created_at": string,"handled_by": string | null,"id": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_note"?: string | null,"attachments"?: (string)[],"category": string,"category_other"?: string | null,"content": NonNullable<Json>,"content_text": string,"context"?: Json | null,"created_at"?: string,"handled_by"?: string | null,"id"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "admin_note"?: string | null,"attachments"?: (string)[],"category"?: string,"category_other"?: string | null,"content"?: NonNullable<Json>,"content_text"?: string,"context"?: Json | null,"created_at"?: string,"handled_by"?: string | null,"id"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"findings": {
                  Row: {
                    "area_id": string,"category": string,"close_note": string | null,"closed_at": string | null,"closed_by": string | null,"code": string,"company_code": string,"consequence": number | null,"created_at": string,"created_by": string | null,"description": string,"due_date": string,"found_at": string,"id": string,"likelihood": number | null,"location_detail": string | null,"location_id": string,"pic_id": string,"risk_level": string,"root_causes": NonNullable<Json>,"search_text": string | null,"source_id": string | null,"source_kind": string,"source_ref": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": string,"category": string,"close_note"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"code": string,"company_code": string,"consequence"?: number | null,"created_at"?: string,"created_by"?: string | null,"description": string,"due_date": string,"found_at": string,"id"?: string,"likelihood"?: number | null,"location_detail"?: string | null,"location_id": string,"pic_id": string,"risk_level": string,"root_causes"?: NonNullable<Json>,"search_text"?: string | null,"source_id"?: string | null,"source_kind": string,"source_ref"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "area_id"?: string,"category"?: string,"close_note"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"code"?: string,"company_code"?: string,"consequence"?: number | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_date"?: string,"found_at"?: string,"id"?: string,"likelihood"?: number | null,"location_detail"?: string | null,"location_id"?: string,"pic_id"?: string,"risk_level"?: string,"root_causes"?: NonNullable<Json>,"search_text"?: string | null,"source_id"?: string | null,"source_kind"?: string,"source_ref"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "findings_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "findings_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"findings_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"followups": {
                  Row: {
                    "approval_id": string,"id": string,"requested_at": string,"requested_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_id": string,"id"?: string,"requested_at"?: string,"requested_by"?: string
                  }
                  Update: {
                    "approval_id"?: string,"id"?: string,"requested_at"?: string,"requested_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "followups_approval_id_fkey"
      columns: ["approval_id"]
isOneToOne: false
      referencedRelation: "approvals"
      referencedColumns: ["id"]
    }
                  ]
                },"incident_costs": {
                  Row: {
                    "estimated_cost": number | null,"incident_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "estimated_cost"?: number | null,"incident_id": string,"updated_at"?: string
                  }
                  Update: {
                    "estimated_cost"?: number | null,"incident_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incident_costs_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: true
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"incident_investigations": {
                  Row: {
                    "causes": NonNullable<Json>,"incident_id": string,"recommendations": NonNullable<Json>,"reconstruction": string | null,"timeline": NonNullable<Json>,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "causes"?: NonNullable<Json>,"incident_id": string,"recommendations"?: NonNullable<Json>,"reconstruction"?: string | null,"timeline"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "causes"?: NonNullable<Json>,"incident_id"?: string,"recommendations"?: NonNullable<Json>,"reconstruction"?: string | null,"timeline"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "incident_investigations_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: true
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"incident_persons": {
                  Row: {
                    "company_kind": string,"contact": string | null,"contractor_id": string | null,"employment": string | null,"id": string,"incident_id": string,"line_no": number,"name": string,"position": string | null,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_kind"?: string,"contact"?: string | null,"contractor_id"?: string | null,"employment"?: string | null,"id"?: string,"incident_id": string,"line_no": number,"name": string,"position"?: string | null,"role": string
                  }
                  Update: {
                    "company_kind"?: string,"contact"?: string | null,"contractor_id"?: string | null,"employment"?: string | null,"id"?: string,"incident_id"?: string,"line_no"?: number,"name"?: string,"position"?: string | null,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incident_persons_contractor_id_fkey"
      columns: ["contractor_id"]
isOneToOne: false
      referencedRelation: "contractors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incident_persons_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: false
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"incident_restricted": {
                  Row: {
                    "body_parts": (string)[],"facility": string | null,"incident_id": string,"injury_type": string | null,"lost_days": number | null,"restricted_days": number | null,"treatment": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_parts"?: (string)[],"facility"?: string | null,"incident_id": string,"injury_type"?: string | null,"lost_days"?: number | null,"restricted_days"?: number | null,"treatment"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "body_parts"?: (string)[],"facility"?: string | null,"incident_id"?: string,"injury_type"?: string | null,"lost_days"?: number | null,"restricted_days"?: number | null,"treatment"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incident_restricted_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: true
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"incident_reviews": {
                  Row: {
                    "actor_id": string | null,"at": string,"decision": string,"id": number,"incident_id": string,"note": string | null,"stage": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"at"?: string,"decision": string,"id"?: never,"incident_id": string,"note"?: string | null,"stage": string
                  }
                  Update: {
                    "actor_id"?: string | null,"at"?: string,"decision"?: string,"id"?: never,"incident_id"?: string,"note"?: string | null,"stage"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incident_reviews_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: false
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"incident_team": {
                  Row: {
                    "added_at": string,"incident_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"incident_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"incident_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incident_team_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: false
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"incidents": {
                  Row: {
                    "area_id": string,"category": string | null,"classified_at": string | null,"classified_by": string | null,"close_note": string | null,"closed_at": string | null,"closed_exception": boolean,"code": string,"company_code": string,"created_at": string,"created_by": string | null,"damage_description": string | null,"description": string,"id": string,"injury_class": string | null,"is_emergency": boolean,"lead_investigator_id": string | null,"location_detail": string | null,"location_id": string,"occurred_at": string,"potential_severity": string | null,"ppe": NonNullable<Json>,"reported_at": string,"reported_category": string,"return_note": string | null,"returned_at": string | null,"search_text": string | null,"severity": string | null,"status": string,"supervisor_id": string | null,"unit_code": string | null,"unit_label": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": string,"category"?: string | null,"classified_at"?: string | null,"classified_by"?: string | null,"close_note"?: string | null,"closed_at"?: string | null,"closed_exception"?: boolean,"code": string,"company_code": string,"created_at"?: string,"created_by"?: string | null,"damage_description"?: string | null,"description": string,"id"?: string,"injury_class"?: string | null,"is_emergency"?: boolean,"lead_investigator_id"?: string | null,"location_detail"?: string | null,"location_id": string,"occurred_at": string,"potential_severity"?: string | null,"ppe"?: NonNullable<Json>,"reported_at"?: string,"reported_category": string,"return_note"?: string | null,"returned_at"?: string | null,"search_text"?: string | null,"severity"?: string | null,"status"?: string,"supervisor_id"?: string | null,"unit_code"?: string | null,"unit_label"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "area_id"?: string,"category"?: string | null,"classified_at"?: string | null,"classified_by"?: string | null,"close_note"?: string | null,"closed_at"?: string | null,"closed_exception"?: boolean,"code"?: string,"company_code"?: string,"created_at"?: string,"created_by"?: string | null,"damage_description"?: string | null,"description"?: string,"id"?: string,"injury_class"?: string | null,"is_emergency"?: boolean,"lead_investigator_id"?: string | null,"location_detail"?: string | null,"location_id"?: string,"occurred_at"?: string,"potential_severity"?: string | null,"ppe"?: NonNullable<Json>,"reported_at"?: string,"reported_category"?: string,"return_note"?: string | null,"returned_at"?: string | null,"search_text"?: string | null,"severity"?: string | null,"status"?: string,"supervisor_id"?: string | null,"unit_code"?: string | null,"unit_label"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incidents_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    }
                  ]
                },"incidents_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inspection_answers": {
                  Row: {
                    "answer": string | null,"comment": string | null,"finding_id": string | null,"id": string,"inspection_id": string,"item_text": string,"line_no": number,"photos": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: string | null,"comment"?: string | null,"finding_id"?: string | null,"id"?: string,"inspection_id": string,"item_text": string,"line_no": number,"photos"?: (string)[]
                  }
                  Update: {
                    "answer"?: string | null,"comment"?: string | null,"finding_id"?: string | null,"id"?: string,"inspection_id"?: string,"item_text"?: string,"line_no"?: number,"photos"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspection_answers_finding_id_fkey"
      columns: ["finding_id"]
isOneToOne: false
      referencedRelation: "findings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_answers_inspection_id_fkey"
      columns: ["inspection_id"]
isOneToOne: false
      referencedRelation: "inspections"
      referencedColumns: ["id"]
    }
                  ]
                },"inspection_template_items": {
                  Row: {
                    "id": string,"line_no": number,"template_id": string,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"line_no": number,"template_id": string,"text": string
                  }
                  Update: {
                    "id"?: string,"line_no"?: number,"template_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspection_template_items_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "inspection_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"inspection_templates": {
                  Row: {
                    "created_at": string,"created_by": string | null,"finding_category": string,"id": string,"is_active": boolean,"name": string,"object_label": string | null,"type_code": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"finding_category"?: string,"id"?: string,"is_active"?: boolean,"name": string,"object_label"?: string | null,"type_code": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"finding_category"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"object_label"?: string | null,"type_code"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inspection_templates_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inspections": {
                  Row: {
                    "area_id": string,"cancel_reason": string | null,"code": string,"company_code": string,"created_at": string,"created_by": string | null,"id": string,"inspector_id": string,"location_id": string,"object_text": string | null,"planned_at": string,"search_text": string | null,"started_at": string | null,"status": string,"submitted_at": string | null,"summary": Json | null,"template_id": string | null,"title": string,"type_code": string,"updated_at": string,"verified_at": string | null,"verified_by": string | null,"verify_note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": string,"cancel_reason"?: string | null,"code": string,"company_code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"inspector_id": string,"location_id": string,"object_text"?: string | null,"planned_at": string,"search_text"?: string | null,"started_at"?: string | null,"status"?: string,"submitted_at"?: string | null,"summary"?: Json | null,"template_id"?: string | null,"title": string,"type_code": string,"updated_at"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"verify_note"?: string | null
                  }
                  Update: {
                    "area_id"?: string,"cancel_reason"?: string | null,"code"?: string,"company_code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"inspector_id"?: string,"location_id"?: string,"object_text"?: string | null,"planned_at"?: string,"search_text"?: string | null,"started_at"?: string | null,"status"?: string,"submitted_at"?: string | null,"summary"?: Json | null,"template_id"?: string | null,"title"?: string,"type_code"?: string,"updated_at"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"verify_note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspections_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspections_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "inspection_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"inspections_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"kpi_definitions": {
                  Row: {
                    "approval_note": string | null,"approved_at": string | null,"approved_by": string | null,"code": string,"created_at": string,"definition": string,"direction": string,"example": string | null,"formula": string,"id": string,"is_active": boolean,"name": string,"owner": string | null,"rule_text": string | null,"sort_order": number,"source": string | null,"status": string,"thresholds": Json | null,"unit": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_note"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"code": string,"created_at"?: string,"definition": string,"direction"?: string,"example"?: string | null,"formula": string,"id"?: string,"is_active"?: boolean,"name": string,"owner"?: string | null,"rule_text"?: string | null,"sort_order"?: number,"source"?: string | null,"status"?: string,"thresholds"?: Json | null,"unit"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "approval_note"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"code"?: string,"created_at"?: string,"definition"?: string,"direction"?: string,"example"?: string | null,"formula"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"owner"?: string | null,"rule_text"?: string | null,"sort_order"?: number,"source"?: string | null,"status"?: string,"thresholds"?: Json | null,"unit"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"kpi_definitions_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"maintenance_runs": {
                  Row: {
                    "id": number,"ran_at": string,"result": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"ran_at"?: string,"result": NonNullable<Json>
                  }
                  Update: {
                    "id"?: never,"ran_at"?: string,"result"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"master_items": {
                  Row: {
                    "code": string,"color": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"is_active": boolean,"kind": string,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"color"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"kind": string,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"color"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"master_items_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mcu_records": {
                  Row: {
                    "checked_on": string,"created_at": string,"created_by": string | null,"employee_id": string,"evidence_count": number,"id": string,"result": string,"updated_at": string,"valid_until": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_on": string,"created_at"?: string,"created_by"?: string | null,"employee_id": string,"evidence_count"?: number,"id"?: string,"result": string,"updated_at"?: string,"valid_until": string
                  }
                  Update: {
                    "checked_on"?: string,"created_at"?: string,"created_by"?: string | null,"employee_id"?: string,"evidence_count"?: number,"id"?: string,"result"?: string,"updated_at"?: string,"valid_until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mcu_records_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"mcu_records_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mcu_restricted": {
                  Row: {
                    "diagnosis": string | null,"mcu_id": string,"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "diagnosis"?: string | null,"mcu_id": string,"note"?: string | null
                  }
                  Update: {
                    "diagnosis"?: string | null,"mcu_id"?: string,"note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mcu_restricted_mcu_id_fkey"
      columns: ["mcu_id"]
isOneToOne: true
      referencedRelation: "mcu_records"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "admin_note": string | null,"approval_limit": number | null,"created_at": string,"functions": (string)[],"id": string,"location_ids": (string)[] | null,"preferences": NonNullable<Json>,"team": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_note"?: string | null,"approval_limit"?: number | null,"created_at"?: string,"functions"?: (string)[],"id"?: string,"location_ids"?: (string)[] | null,"preferences"?: NonNullable<Json>,"team"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "admin_note"?: string | null,"approval_limit"?: number | null,"created_at"?: string,"functions"?: (string)[],"id"?: string,"location_ids"?: (string)[] | null,"preferences"?: NonNullable<Json>,"team"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"members_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"body": string | null,"category": string,"created_at": string,"entity": string | null,"href": string | null,"id": string,"read_at": string | null,"record_id": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"body"?: string | null,"category"?: string,"created_at"?: string,"entity"?: string | null,"href"?: string | null,"id"?: string,"read_at"?: string | null,"record_id"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"body"?: string | null,"category"?: string,"created_at"?: string,"entity"?: string | null,"href"?: string | null,"id"?: string,"read_at"?: string | null,"record_id"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"observations": {
                  Row: {
                    "area_id": string,"code": string,"company_code": string,"created_at": string,"created_by": string | null,"description": string,"finding_id": string | null,"id": string,"immediate_action": string | null,"kind": string,"location_id": string,"needs_followup": boolean,"observed_at": string,"search_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": string,"code": string,"company_code": string,"created_at"?: string,"created_by"?: string | null,"description": string,"finding_id"?: string | null,"id"?: string,"immediate_action"?: string | null,"kind": string,"location_id": string,"needs_followup"?: boolean,"observed_at"?: string,"search_text"?: string | null
                  }
                  Update: {
                    "area_id"?: string,"code"?: string,"company_code"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"finding_id"?: string | null,"id"?: string,"immediate_action"?: string | null,"kind"?: string,"location_id"?: string,"needs_followup"?: boolean,"observed_at"?: string,"search_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "observations_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observations_finding_id_fkey"
      columns: ["finding_id"]
isOneToOne: false
      referencedRelation: "findings"
      referencedColumns: ["id"]
    }
                  ]
                },"observations_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pengajuan": {
                  Row: {
                    "code": string | null,"company_code": string,"created_at": string,"created_by": string | null,"department_id": string | null,"description": string | null,"id": string,"needed_date": string | null,"search_text": string | null,"status": string,"title": string,"total_amount": number,"updated_at": string,"verify_token": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"company_code": string,"created_at"?: string,"created_by"?: string | null,"department_id"?: string | null,"description"?: string | null,"id"?: string,"needed_date"?: string | null,"search_text"?: string | null,"status"?: string,"title": string,"total_amount"?: number,"updated_at"?: string,"verify_token"?: string | null
                  }
                  Update: {
                    "code"?: string | null,"company_code"?: string,"created_at"?: string,"created_by"?: string | null,"department_id"?: string | null,"description"?: string | null,"id"?: string,"needed_date"?: string | null,"search_text"?: string | null,"status"?: string,"title"?: string,"total_amount"?: number,"updated_at"?: string,"verify_token"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"pengajuan_items": {
                  Row: {
                    "id": string,"item_name": string,"line_no": number,"note": string | null,"part_number": string | null,"pengajuan_id": string,"qty": number,"subtotal": number | null,"unit": string,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"item_name": string,"line_no": number,"note"?: string | null,"part_number"?: string | null,"pengajuan_id": string,"qty": number,"subtotal"?: never,"unit"?: string,"unit_price"?: number
                  }
                  Update: {
                    "id"?: string,"item_name"?: string,"line_no"?: number,"note"?: string | null,"part_number"?: string | null,"pengajuan_id"?: string,"qty"?: number,"subtotal"?: never,"unit"?: string,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pengajuan_items_pengajuan_id_fkey"
      columns: ["pengajuan_id"]
isOneToOne: false
      referencedRelation: "pengajuan"
      referencedColumns: ["id"]
    }
                  ]
                },"pengajuan_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pica_actions": {
                  Row: {
                    "cause_ref": string | null,"closed_at": string | null,"code": string,"company_code": string,"created_at": string,"created_by": string | null,"due_date": string,"effectiveness_date": string | null,"effectiveness_note": string | null,"finding_id": string | null,"id": string,"incident_id": string | null,"kind": string,"location_id": string,"pic_id": string,"required_evidence": string | null,"returned": boolean,"round": number,"search_text": string | null,"status": string,"title": string,"updated_at": string,"verifier_id": string,"k3_action_href": string | null
                  }
                  ComputedFields: "k3_action_href"
                  Insert: {
                    "cause_ref"?: string | null,"closed_at"?: string | null,"code": string,"company_code": string,"created_at"?: string,"created_by"?: string | null,"due_date": string,"effectiveness_date"?: string | null,"effectiveness_note"?: string | null,"finding_id"?: string | null,"id"?: string,"incident_id"?: string | null,"kind": string,"location_id": string,"pic_id": string,"required_evidence"?: string | null,"returned"?: boolean,"round"?: number,"search_text"?: string | null,"status"?: string,"title": string,"updated_at"?: string,"verifier_id": string
                  }
                  Update: {
                    "cause_ref"?: string | null,"closed_at"?: string | null,"code"?: string,"company_code"?: string,"created_at"?: string,"created_by"?: string | null,"due_date"?: string,"effectiveness_date"?: string | null,"effectiveness_note"?: string | null,"finding_id"?: string | null,"id"?: string,"incident_id"?: string | null,"kind"?: string,"location_id"?: string,"pic_id"?: string,"required_evidence"?: string | null,"returned"?: boolean,"round"?: number,"search_text"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string,"verifier_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pica_actions_finding_id_fkey"
      columns: ["finding_id"]
isOneToOne: false
      referencedRelation: "findings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pica_actions_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: false
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"pica_actions_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pica_evidence": {
                  Row: {
                    "action_id": string,"decided_at": string | null,"decided_by": string | null,"decision": string | null,"decision_note": string | null,"files": (string)[],"id": string,"note": string | null,"round": number,"submitted_at": string,"submitted_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action_id": string,"decided_at"?: string | null,"decided_by"?: string | null,"decision"?: string | null,"decision_note"?: string | null,"files": (string)[],"id"?: string,"note"?: string | null,"round": number,"submitted_at"?: string,"submitted_by"?: string | null
                  }
                  Update: {
                    "action_id"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision"?: string | null,"decision_note"?: string | null,"files"?: (string)[],"id"?: string,"note"?: string | null,"round"?: number,"submitted_at"?: string,"submitted_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pica_evidence_action_id_fkey"
      columns: ["action_id"]
isOneToOne: false
      referencedRelation: "pica_actions"
      referencedColumns: ["id"]
    }
                  ]
                },"pjo_pja_appointments": {
                  Row: {
                    "company_code": string,"created_at": string,"created_by": string | null,"employee_id": string,"evidence_count": number,"id": string,"location_id": string,"role": string,"scope": string,"sk_number": string,"starts_on": string,"updated_at": string,"valid_until": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_code": string,"created_at"?: string,"created_by"?: string | null,"employee_id": string,"evidence_count"?: number,"id"?: string,"location_id": string,"role": string,"scope": string,"sk_number": string,"starts_on": string,"updated_at"?: string,"valid_until": string
                  }
                  Update: {
                    "company_code"?: string,"created_at"?: string,"created_by"?: string | null,"employee_id"?: string,"evidence_count"?: number,"id"?: string,"location_id"?: string,"role"?: string,"scope"?: string,"sk_number"?: string,"starts_on"?: string,"updated_at"?: string,"valid_until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pjo_pja_appointments_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"pjo_pja_appointments_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"position_requirements": {
                  Row: {
                    "company_code": string,"created_at": string,"id": string,"job_title": string,"location_id": string,"required": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_code": string,"created_at"?: string,"id"?: string,"job_title": string,"location_id": string,"required": number,"updated_at"?: string
                  }
                  Update: {
                    "company_code"?: string,"created_at"?: string,"id"?: string,"job_title"?: string,"location_id"?: string,"required"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"position_requirements_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"last_used_at": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_used_at"?: string,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_used_at"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reminder_rules": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"kind": string,"name": string,"notify_assignee": boolean,"notify_functions": (string)[],"offsets": (number)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"kind": string,"name": string,"notify_assignee"?: boolean,"notify_functions"?: (string)[],"offsets": (number)[],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"kind"?: string,"name"?: string,"notify_assignee"?: boolean,"notify_functions"?: (string)[],"offsets"?: (number)[],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reminder_rules_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reminder_sent": {
                  Row: {
                    "due_on": string,"offset_days": number,"ref_id": string,"rule_id": string,"sent_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "due_on": string,"offset_days": number,"ref_id": string,"rule_id": string,"sent_at"?: string
                  }
                  Update: {
                    "due_on"?: string,"offset_days"?: number,"ref_id"?: string,"rule_id"?: string,"sent_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_sent_rule_id_fkey"
      columns: ["rule_id"]
isOneToOne: false
      referencedRelation: "reminder_rules"
      referencedColumns: ["id"]
    }
                  ]
                },"report_templates": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"prefix": string,"revision": string,"sections": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"prefix": string,"revision"?: string,"sections": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"prefix"?: string,"revision"?: string,"sections"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"report_versions": {
                  Row: {
                    "id": string,"published_at": string,"reason": string | null,"report_id": string,"snapshot": NonNullable<Json>,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"published_at"?: string,"reason"?: string | null,"report_id": string,"snapshot": NonNullable<Json>,"version": string
                  }
                  Update: {
                    "id"?: string,"published_at"?: string,"reason"?: string | null,"report_id"?: string,"snapshot"?: NonNullable<Json>,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_versions_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "code": string,"company_code": string,"correction_reason": string | null,"created_at": string,"created_by": string | null,"current_version": string | null,"id": string,"location_id": string,"narratives": NonNullable<Json>,"period": string,"search_text": string | null,"status": string,"submit_note": string | null,"template_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"company_code": string,"correction_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_version"?: string | null,"id"?: string,"location_id": string,"narratives"?: NonNullable<Json>,"period": string,"search_text"?: string | null,"status"?: string,"submit_note"?: string | null,"template_id": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"company_code"?: string,"correction_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_version"?: string | null,"id"?: string,"location_id"?: string,"narratives"?: NonNullable<Json>,"period"?: string,"search_text"?: string | null,"status"?: string,"submit_note"?: string | null,"template_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "report_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"reports_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"safety_activities": {
                  Row: {
                    "activity_date": string,"area_id": string,"code": string,"company_code": string,"created_at": string,"created_by": string | null,"evidence_count": number,"id": string,"leader_id": string,"location_id": string,"notes": string | null,"participant_count": number,"program_id": string | null,"search_text": string | null,"type_code": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_date": string,"area_id": string,"code": string,"company_code": string,"created_at"?: string,"created_by"?: string | null,"evidence_count"?: number,"id"?: string,"leader_id": string,"location_id": string,"notes"?: string | null,"participant_count"?: number,"program_id"?: string | null,"search_text"?: string | null,"type_code": string,"updated_at"?: string
                  }
                  Update: {
                    "activity_date"?: string,"area_id"?: string,"code"?: string,"company_code"?: string,"created_at"?: string,"created_by"?: string | null,"evidence_count"?: number,"id"?: string,"leader_id"?: string,"location_id"?: string,"notes"?: string | null,"participant_count"?: number,"program_id"?: string | null,"search_text"?: string | null,"type_code"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "safety_activities_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "safety_activities_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "tsp_programs"
      referencedColumns: ["id"]
    }
                  ]
                },"safety_activities_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"site_permits": {
                  Row: {
                    "created_at": string,"created_by": string | null,"employee_id": string,"id": string,"name": string,"number": string | null,"updated_at": string,"valid_until": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"employee_id": string,"id"?: string,"name": string,"number"?: string | null,"updated_at"?: string,"valid_until": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"employee_id"?: string,"id"?: string,"name"?: string,"number"?: string | null,"updated_at"?: string,"valid_until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_permits_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"site_permits_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"storage_cleanup_queue": {
                  Row: {
                    "bucket": string,"id": number,"path": string,"queued_at": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"id"?: never,"path": string,"queued_at"?: string,"reason"?: string | null
                  }
                  Update: {
                    "bucket"?: string,"id"?: never,"path"?: string,"queued_at"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"support_messages": {
                  Row: {
                    "attachment_path": string | null,"body": string | null,"created_at": string,"id": string,"read_at": string | null,"sender_id": string | null,"thread_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_path"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"read_at"?: string | null,"sender_id"?: string | null,"thread_id": string
                  }
                  Update: {
                    "attachment_path"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"read_at"?: string | null,"sender_id"?: string | null,"thread_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_messages_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "support_threads"
      referencedColumns: ["id"]
    }
                  ]
                },"support_threads": {
                  Row: {
                    "assigned_to": string | null,"category": string,"context": Json | null,"created_at": string,"id": string,"last_message_at": string,"status": string,"subject": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"category": string,"context"?: Json | null,"created_at"?: string,"id"?: string,"last_message_at"?: string,"status"?: string,"subject": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"category"?: string,"context"?: Json | null,"created_at"?: string,"id"?: string,"last_message_at"?: string,"status"?: string,"subject"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"training_participants": {
                  Row: {
                    "attendance": string,"employee_id": string,"note": string | null,"training_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance"?: string,"employee_id": string,"note"?: string | null,"training_id": string,"updated_at"?: string
                  }
                  Update: {
                    "attendance"?: string,"employee_id"?: string,"note"?: string | null,"training_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_participants_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_participants_training_id_fkey"
      columns: ["training_id"]
isOneToOne: false
      referencedRelation: "trainings"
      referencedColumns: ["id"]
    }
                  ]
                },"trainings": {
                  Row: {
                    "capacity": number | null,"code": string,"company_code": string,"competency_id": string | null,"created_at": string,"created_by": string | null,"ends_on": string,"evidence_count": number,"id": string,"location_id": string,"notes": string | null,"provider": string | null,"starts_on": string,"status": string,"title": string,"updated_at": string,"venue": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number | null,"code": string,"company_code": string,"competency_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_on": string,"evidence_count"?: number,"id"?: string,"location_id": string,"notes"?: string | null,"provider"?: string | null,"starts_on": string,"status"?: string,"title": string,"updated_at"?: string,"venue"?: string | null
                  }
                  Update: {
                    "capacity"?: number | null,"code"?: string,"company_code"?: string,"competency_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string,"evidence_count"?: number,"id"?: string,"location_id"?: string,"notes"?: string | null,"provider"?: string | null,"starts_on"?: string,"status"?: string,"title"?: string,"updated_at"?: string,"venue"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trainings_competency_id_fkey"
      columns: ["competency_id"]
isOneToOne: false
      referencedRelation: "competencies"
      referencedColumns: ["id"]
    }
                  ]
                },"trainings_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tsp_evaluations": {
                  Row: {
                    "company_code": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"id": string,"location_id": string,"month": number,"prepared_by": string | null,"status": string,"submitted_at": string | null,"summary": Json | null,"updated_at": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "company_code": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"location_id": string,"month": number,"prepared_by"?: string | null,"status"?: string,"submitted_at"?: string | null,"summary"?: Json | null,"updated_at"?: string,"year": number
                  }
                  Update: {
                    "company_code"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"location_id"?: string,"month"?: number,"prepared_by"?: string | null,"status"?: string,"submitted_at"?: string | null,"summary"?: Json | null,"updated_at"?: string,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"tsp_evaluations_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tsp_programs": {
                  Row: {
                    "annual_target": number,"company_code": string,"created_at": string,"created_by": string | null,"element": string,"evidence_required": string,"id": string,"indicator": string,"is_active": boolean,"location_id": string,"name": string,"no": string,"owner_label": string,"plan": (number)[],"sort_order": number,"updated_at": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "annual_target": number,"company_code": string,"created_at"?: string,"created_by"?: string | null,"element": string,"evidence_required"?: string,"id"?: string,"indicator": string,"is_active"?: boolean,"location_id": string,"name": string,"no": string,"owner_label": string,"plan": (number)[],"sort_order"?: number,"updated_at"?: string,"year": number
                  }
                  Update: {
                    "annual_target"?: number,"company_code"?: string,"created_at"?: string,"created_by"?: string | null,"element"?: string,"evidence_required"?: string,"id"?: string,"indicator"?: string,"is_active"?: boolean,"location_id"?: string,"name"?: string,"no"?: string,"owner_label"?: string,"plan"?: (number)[],"sort_order"?: number,"updated_at"?: string,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"tsp_programs_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tsp_realizations": {
                  Row: {
                    "actual": number,"created_at": string,"created_by": string | null,"evidence_count": number,"id": string,"month": number,"note": string | null,"program_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actual"?: number,"created_at"?: string,"created_by"?: string | null,"evidence_count"?: number,"id"?: string,"month": number,"note"?: string | null,"program_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "actual"?: number,"created_at"?: string,"created_by"?: string | null,"evidence_count"?: number,"id"?: string,"month"?: number,"note"?: string | null,"program_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tsp_realizations_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "tsp_programs"
      referencedColumns: ["id"]
    }
                  ]
                },"tsp_realizations_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"update_comments": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"reply_to": string | null,"update_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"reply_to"?: string | null,"update_id": number,"user_id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"reply_to"?: string | null,"update_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "update_comments_reply_to_fkey"
      columns: ["reply_to"]
isOneToOne: false
      referencedRelation: "update_comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "update_comments_update_id_fkey"
      columns: ["update_id"]
isOneToOne: false
      referencedRelation: "updates"
      referencedColumns: ["id"]
    }
                  ]
                },"update_reactions": {
                  Row: {
                    "created_at": string,"emoji": string,"update_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"emoji": string,"update_id": number,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"emoji"?: string,"update_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "update_reactions_update_id_fkey"
      columns: ["update_id"]
isOneToOne: false
      referencedRelation: "updates"
      referencedColumns: ["id"]
    }
                  ]
                },"update_seen": {
                  Row: {
                    "last_seen_id": number,"seen_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_seen_id"?: number,"seen_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "last_seen_id"?: number,"seen_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"updates": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"created_by": string | null,"highlights": (string)[],"id": number,"thumbnail_path": string | null,"title": string,"updated_at": string,"version": string | null,"version_major": number,"version_minor": number,"version_patch": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"highlights"?: (string)[],"id"?: never,"thumbnail_path"?: string | null,"title": string,"updated_at"?: string,"version"?: never,"version_major": number,"version_minor": number,"version_patch": number
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"highlights"?: (string)[],"id"?: never,"thumbnail_path"?: string | null,"title"?: string,"updated_at"?: string,"version"?: never,"version_major"?: number,"version_minor"?: number,"version_patch"?: number
                  }
                  Relationships: [
                    
                  ]
                },"work_hours": {
                  Row: {
                    "created_at": string,"created_by": string | null,"hours": number,"id": string,"location_id": string,"month": string,"note": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"hours": number,"id"?: string,"location_id": string,"month": string,"note"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"hours"?: number,"id"?: string,"location_id"?: string,"month"?: string,"note"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"work_hours_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"changes": Json | null,"id": number,"note": string | null,"record_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"changes"?: Json | null,"id"?: never,"note"?: string | null,"record_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "feedback_mine": {
                  Row: {
                    "attachments": (string)[] | null,"category": string | null,"category_other": string | null,"content": Json | null,"content_text": string | null,"created_at": string | null,"id": string | null,"status": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "attachments"?: (string)[] | null,"category"?: string | null,"category_other"?: string | null,"content"?: Json | null,"content_text"?: string | null,"created_at"?: string | null,"id"?: string | null,"status"?: string | null,"updated_at"?: string | null
                         }
                        Update: {
                           "attachments"?: (string)[] | null,"category"?: string | null,"category_other"?: string | null,"content"?: Json | null,"content_text"?: string | null,"created_at"?: string | null,"id"?: string | null,"status"?: string | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "action_label":
{ Args: { "p_action": string }; Returns: string
                           },
"activity_feed":
{ Args: { "p_before"?: string,"p_limit"?: number }; Returns: {
              "action": string,"actor_id": string,"at": string,"entity": string,"href": string,"id": number,"label": string,"note": string,"record_id": string
            }[]
                           },
"activity_feed_k3":
{ Args: { "p_before"?: string,"p_limit"?: number }; Returns: {
              "action": string,"actor_id": string,"at": string,"entity": string,"href": string,"id": number,"label": string,"note": string,"record_id": string
            }[]
                           },
"app_admin_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"approval_activate":
{ Args: { "p_ctx": Database["safehub"]['CompositeTypes']["approval_context"],"p_step": Omit<Database["safehub"]['Tables']["approvals"]['Row'], Database["safehub"]['Tables']["approvals"]['ComputedFields']>,"p_type": Omit<Database["safehub"]['Tables']["approval_doc_types"]['Row'], Database["safehub"]['Tables']["approval_doc_types"]['ComputedFields']> }; Returns: (string)[]
                           },
"approval_call_done":
{ Args: { "p_outcome": string,"p_record_id": string,"p_type": Omit<Database["safehub"]['Tables']["approval_doc_types"]['Row'], Database["safehub"]['Tables']["approval_doc_types"]['ComputedFields']> }; Returns: undefined
                           },
"approval_cancel":
{ Args: { "p_doc_type": string,"p_note"?: string,"p_record_id": string }; Returns: Json
                           },
"approval_ctx":
{ Args: { "p_record_id": string,"p_type": Omit<Database["safehub"]['Tables']["approval_doc_types"]['Row'], Database["safehub"]['Tables']["approval_doc_types"]['ComputedFields']> }; Returns: Database["safehub"]['CompositeTypes']["approval_context"]
                          SetofOptions: {
        from: "*"
        to: "approval_context"
        isOneToOne: true
        isSetofReturn: false
      } },
"approval_decide":
{ Args: { "p_approval_id": string,"p_decision": string,"p_note"?: string }; Returns: Json
                           },
"approval_override":
{ Args: { "p_approval_id": string,"p_mode": string,"p_new_approver"?: string,"p_note"?: string }; Returns: Json
                           },
"approval_start":
{ Args: { "p_doc_type": string,"p_record_id": string }; Returns: Json
                           },
"approval_template_delete":
{ Args: { "p_id": string }; Returns: undefined
                           },
"approval_template_save":
{ Args: { "p": Json }; Returns: string
                           },
"approval_type_of":
{ Args: { "p_doc_type": string }; Returns: {
              "code": string,
"context_fn": unknown,
"href_prefix": string,
"is_active": boolean,
"label": string,
"on_done_fn": unknown,
"table_name": string
            }
                          SetofOptions: {
        from: "*"
        to: "approval_doc_types"
        isOneToOne: true
        isSetofReturn: false
      } },
"audit_trail":
{ Args: { "p_action"?: string,"p_actor"?: string,"p_before"?: string,"p_entities"?: (string)[],"p_from"?: string,"p_limit"?: number,"p_to"?: string }; Returns: {
              "action": string,"actor_id": string,"at": string,"changes": Json,"entity": string,"id": number,"note": string,"record_id": string
            }[]
                           },
"cctv_redact":
{ Args: { "p": Json }; Returns: Json
                           },
"certificate_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"commercial_viewer":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"company_visible":
{ Args: { "p_company": string }; Returns: boolean
                           },
"competency_matrix":
{ Args: { "p_location"?: string }; Returns: {
              "certificate_id": string,"competency_id": string,"employee_id": string,"state": string,"valid_until": string
            }[]
                           },
"competency_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"contractor_contract_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"contractor_document_set":
{ Args: { "p": Json }; Returns: Json
                           },
"contractor_manager":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"contractor_overview":
{ Args: Record<PropertyKey, never>; Returns: {
              "active_contracts": number,"contractor_id": string,"csms_result": string,"csms_until": string,"docs_ok": number,"docs_total": number,"legal_state": string,"permit_count": number,"permit_nearest": string,"personnel": number
            }[]
                           },
"contractor_permit_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"contractor_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"contractor_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"csms_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"dashboard_by_department":
{ Args: { "p_company"?: string,"p_from": string,"p_to": string }; Returns: {
              "amount": number,"department": string,"department_id": string,"total": number
            }[]
                           },
"dashboard_daily":
{ Args: { "p_company"?: string,"p_from": string,"p_to": string }; Returns: {
              "amount": number,"approved": number,"created": number,"day": string
            }[]
                           },
"dashboard_k3":
{ Args: { "p_location"?: string,"p_month": number,"p_year": number }; Returns: Json
                           },
"dashboard_summary":
{ Args: { "p_company"?: string,"p_from": string,"p_to": string }; Returns: Json
                           },
"employee_overview":
{ Args: { "p_location"?: string }; Returns: {
              "comp_ok": number,"comp_required": number,"employee_id": string,"mcu_result": string,"mcu_until": string,"permit_until": string
            }[]
                           },
"employee_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"employee_trainings":
{ Args: { "p_employee": string }; Returns: {
              "attendance": string,"code": string,"ends_on": string,"starts_on": string,"status": string,"title": string,"training_id": string
            }[]
                           },
"employee_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"expiry_state":
{ Args: { "p_today"?: string,"p_until": string,"p_warn"?: number }; Returns: string
                           },
"feedback_set_status":
{ Args: { "p_admin_note"?: string,"p_id": string,"p_status": string }; Returns: Json
                           },
"feedback_submit":
{ Args: { "p_attachments"?: (string)[],"p_category": string,"p_category_other": string,"p_content": Json,"p_content_text": string,"p_context"?: Json }; Returns: Json
                           },
"finding_close":
{ Args: { "p_id": string,"p_note": string }; Returns: Json
                           },
"finding_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"finding_stats":
{ Args: { "p_company"?: string,"p_location"?: string }; Returns: Json
                           },
"global_search":
{ Args: { "p_limit"?: number,"p_q": string }; Returns: {
              "amount": number,"href": string,"id": string,"is_exact": boolean,"kind": string,"status": string,"subtitle": string,"title": string
            }[]
                           },
"global_search_k3":
{ Args: { "p_limit"?: number,"p_q": string }; Returns: {
              "amount": number,"href": string,"id": string,"is_exact": boolean,"kind": string,"status": string,"subtitle": string,"title": string
            }[]
                           },
"global_search_k3_core":
{ Args: { "p_limit"?: number,"p_q": string }; Returns: {
              "amount": number,"href": string,"id": string,"is_exact": boolean,"kind": string,"status": string,"subtitle": string,"title": string
            }[]
                           },
"has_any_function":
{ Args: { "p_functions": (string)[] }; Returns: boolean
                           },
"has_function":
{ Args: { "p_function": string }; Returns: boolean
                           },
"incident_classify":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"incident_close_check":
{ Args: { "p_id": string }; Returns: Json
                           },
"incident_close_exception":
{ Args: { "p_id": string,"p_note": string }; Returns: Json
                           },
"incident_report":
{ Args: { "p": Json }; Returns: Json
                           },
"incident_review":
{ Args: { "p_decision": string,"p_id": string,"p_note"?: string }; Returns: Json
                           },
"incident_save_investigation":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"incident_set_team":
{ Args: { "p_id": string,"p_lead": string,"p_members": (string)[] }; Returns: Json
                           },
"incident_submit_review":
{ Args: { "p_id": string,"p_note"?: string }; Returns: Json
                           },
"inspection_cancel":
{ Args: { "p_id": string,"p_reason": string }; Returns: Json
                           },
"inspection_plan_actual":
{ Args: { "p_location"?: string,"p_month": number,"p_year": number }; Returns: {
              "actual": number,"plan": number,"type_code": string
            }[]
                           },
"inspection_save_answers":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"inspection_schedule":
{ Args: { "p": Json }; Returns: Json
                           },
"inspection_start":
{ Args: { "p_id": string }; Returns: Json
                           },
"inspection_submit":
{ Args: { "p_findings"?: Json,"p_id": string }; Returns: Json
                           },
"inspection_template_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"inspection_verify":
{ Args: { "p_id": string,"p_note"?: string }; Returns: Json
                           },
"k3_action_href":
{ Args: { "a": Omit<Database["safehub"]['Tables']["pica_actions"]['Row'], Database["safehub"]['Tables']["pica_actions"]['ComputedFields']> }; Returns: string
                           },
"k3_action_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"k3_badges":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"k3_finding_insert":
{ Args: { "p_area": string,"p_category": string,"p_company": string,"p_creator": string,"p_description": string,"p_detail": string,"p_due": string,"p_found_at": string,"p_location": string,"p_pic": string,"p_risk": string,"p_source_kind": string,"p_source_ref": string,"p_title": string }; Returns: {
              "code": string,"id": string
            }[]
                           },
"k3_finding_refresh":
{ Args: { "p_id": string }; Returns: undefined
                           },
"k3_finding_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"k3_in_scope":
{ Args: { "p_company": string,"p_location": string }; Returns: boolean
                           },
"k3_incident_set_persons":
{ Args: { "p_company": string,"p_id": string,"p_persons": Json }; Returns: undefined
                           },
"k3_incident_try_close":
{ Args: { "p_id": string }; Returns: (string)[]
                           },
"k3_incident_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"k3_inspection_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"k3_master_ok":
{ Args: { "p_code": string,"p_kind": string }; Returns: boolean
                           },
"k3_my_action_findings":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"k3_my_team_incidents":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"k3_observation_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"k3_sees_all":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"k3_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"k3_user_ok":
{ Args: { "p_user": string }; Returns: boolean
                           },
"k3_user_options":
{ Args: { "p_function"?: string }; Returns: {
              "company": string,"department": string,"functions": (string)[],"id": string,"job_title": string,"name": string
            }[]
                           },
"k3_writer":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"kontraktor_sync_evidence":
{ Args: { "p_id": string,"p_kind": string }; Returns: Json
                           },
"kpi_approve":
{ Args: { "p_code": string,"p_note": string }; Returns: Json
                           },
"kpi_safety":
{ Args: { "p_from": string,"p_location"?: string,"p_to": string }; Returns: Json
                           },
"location_visible":
{ Args: { "p_location": string }; Returns: boolean
                           },
"manpower_summary":
{ Args: { "p_location"?: string }; Returns: {
              "available": number,"job_title": string,"required": number
            }[]
                           },
"mcu_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"medical_viewer":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_company_scope":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"my_functions":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"my_location_scope":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"my_sites":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"name": string
            }[]
                           },
"my_tasks":
{ Args: { "p_limit"?: number }; Returns: {
              "code": string,"due_at": string,"href": string,"kind": string,"meta": Json,"ref_id": string,"ref_type": string,"status": string,"task_group": string,"title": string,"waiting_since": string
            }[]
                           },
"next_doc_number":
{ Args: { "p_company": string,"p_prefix": string,"p_reset"?: string }; Returns: string
                           },
"notify":
{ Args: { "p_body"?: string,"p_category"?: string,"p_entity"?: string,"p_href"?: string,"p_record_id"?: string,"p_title": string,"p_type": string,"p_user_ids": (string)[] }; Returns: string[]
                           },
"observation_submit":
{ Args: { "p": Json }; Returns: Json
                           },
"pending_for_me":
{ Args: { "p_limit"?: number }; Returns: {
              "approval_id": string,"approval_type": string,"doc_label": string,"doc_type": string,"due_at": string,"followup_count": number,"href": string,"last_followup_at": string,"record_id": string,"step_no": number,"waiting_since": string
            }[]
                           },
"pengajuan_approval_context":
{ Args: { "p_id": string }; Returns: Database["safehub"]['CompositeTypes']["approval_context"]
                          SetofOptions: {
        from: "*"
        to: "approval_context"
        isOneToOne: true
        isSetofReturn: false
      } },
"pengajuan_item_label":
{ Args: { "p_name": string,"p_price": number,"p_qty": number,"p_unit": string }; Returns: string
                           },
"pengajuan_on_approval":
{ Args: { "p_id": string,"p_outcome": string }; Returns: undefined
                           },
"pengajuan_rotate_verify_token":
{ Args: { "p_id": string }; Returns: string
                           },
"pengajuan_save":
{ Args: { "p": Json,"p_id": string }; Returns: string
                           },
"people_company":
{ Args: { "p": Json }; Returns: string
                           },
"people_manager":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"people_sync_evidence":
{ Args: { "p_id": string,"p_kind": string }; Returns: Json
                           },
"pica_change_due":
{ Args: { "p_due": string,"p_id": string,"p_reason": string }; Returns: Json
                           },
"pica_create":
{ Args: { "p": Json }; Returns: Json
                           },
"pica_set_effectiveness":
{ Args: { "p_date": string,"p_id": string,"p_note": string }; Returns: Json
                           },
"pica_start":
{ Args: { "p_id": string }; Returns: Json
                           },
"pica_submit_evidence":
{ Args: { "p_files": (string)[],"p_id": string,"p_note": string }; Returns: Json
                           },
"pica_verify":
{ Args: { "p_decision": string,"p_id": string,"p_note": string }; Returns: Json
                           },
"pjo_pja_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"position_requirement_save":
{ Args: { "p": Json }; Returns: Json
                           },
"push_prune":
{ Args: { "p_endpoints": (string)[] }; Returns: number
                           },
"push_subscribe":
{ Args: { "p_auth": string,"p_endpoint": string,"p_p256dh": string,"p_user_agent"?: string }; Returns: undefined
                           },
"push_targets":
{ Args: { "p_notification_ids": (string)[] }; Returns: {
              "auth": string,"body": string,"endpoint": string,"href": string,"notification_id": string,"p256dh": string,"tag": string,"title": string
            }[]
                           },
"reminder_rule_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"report_approval_context":
{ Args: { "p_id": string }; Returns: Database["safehub"]['CompositeTypes']["approval_context"]
                          SetofOptions: {
        from: "*"
        to: "approval_context"
        isOneToOne: true
        isSetofReturn: false
      } },
"report_build_data":
{ Args: { "p_id": string }; Returns: Json
                           },
"report_can_edit":
{ Args: { "p_id": string }; Returns: boolean
                           },
"report_completeness":
{ Args: { "p_id": string }; Returns: Json
                           },
"report_create":
{ Args: { "p": Json }; Returns: Json
                           },
"report_data":
{ Args: { "p_id": string }; Returns: Json
                           },
"report_on_approval":
{ Args: { "p_id": string,"p_outcome": string }; Returns: undefined
                           },
"report_save_narratives":
{ Args: { "p": Json,"p_id": string,"p_submit_note"?: string }; Returns: Json
                           },
"report_start_correction":
{ Args: { "p_id": string,"p_reason": string }; Returns: Json
                           },
"report_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"request_followup":
{ Args: { "p_approval_id": string }; Returns: Json
                           },
"run_maintenance":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"run_reminders":
{ Args: { "p_today"?: string }; Returns: Json
                           },
"safety_activity_save":
{ Args: { "p": Json }; Returns: Json
                           },
"safety_activity_sync_evidence":
{ Args: { "p_id": string }; Returns: Json
                           },
"set_log_context":
{ Args: { "p_action": string,"p_note": string }; Returns: undefined
                           },
"set_log_extra":
{ Args: { "p_extra": Json }; Returns: undefined
                           },
"site_permit_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"support_assign":
{ Args: { "p_admin_id": string,"p_thread_id": string }; Returns: Json
                           },
"support_badge":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"support_href":
{ Args: { "p_admin": boolean,"p_thread_id": string }; Returns: string
                           },
"support_mark_read":
{ Args: { "p_thread_id": string }; Returns: number
                           },
"support_open":
{ Args: { "p_attachment_path"?: string,"p_body": string,"p_category": string,"p_context"?: Json,"p_subject": string }; Returns: Json
                           },
"support_send":
{ Args: { "p_attachment_path"?: string,"p_body": string,"p_thread_id": string }; Returns: Json
                           },
"support_set_status":
{ Args: { "p_status": string,"p_thread_id": string }; Returns: Json
                           },
"today_wib":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"training_attendance_set":
{ Args: { "p_attendance": string,"p_employee": string,"p_id": string,"p_note"?: string }; Returns: Json
                           },
"training_log":
{ Args: { "p_action": string,"p_id": string,"p_note": string }; Returns: undefined
                           },
"training_participants_set":
{ Args: { "p_employee_ids": (string)[],"p_id": string }; Returns: Json
                           },
"training_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"training_set_status":
{ Args: { "p_id": string,"p_note"?: string,"p_status": string }; Returns: Json
                           },
"training_sync_evidence":
{ Args: { "p_id": string }; Returns: Json
                           },
"training_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"tsp_count_files":
{ Args: { "p_prefix": string }; Returns: number
                           },
"tsp_evaluation_decide":
{ Args: { "p_approve": boolean,"p_id": string,"p_note"?: string }; Returns: Json
                           },
"tsp_evaluation_submit":
{ Args: { "p_location": string,"p_month": number,"p_year": number }; Returns: Json
                           },
"tsp_matrix":
{ Args: { "p_location"?: string,"p_year": number }; Returns: {
              "actual": (number)[],"annual_target": number,"element": string,"evidence": (number)[],"evidence_required": string,"id": string,"indicator": string,"is_active": boolean,"location_id": string,"name": string,"no": string,"notes": (string)[],"owner_label": string,"plan": (number)[],"sort_order": number
            }[]
                           },
"tsp_program_save":
{ Args: { "p": Json,"p_id": string }; Returns: Json
                           },
"tsp_program_visible":
{ Args: { "p_id": string }; Returns: boolean
                           },
"tsp_programs_copy":
{ Args: { "p_from_year": number,"p_location": string,"p_to_year": number }; Returns: Json
                           },
"tsp_realization_save":
{ Args: { "p_actual": number,"p_month": number,"p_note"?: string,"p_program": string }; Returns: Json
                           },
"tsp_recorder":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"tsp_summary":
{ Args: { "p_location"?: string,"p_month": number,"p_year": number }; Returns: Json
                           },
"users_with_function":
{ Args: { "p_company": string,"p_functions": (string)[],"p_location": string }; Returns: (string)[]
                           },
"verify_document":
{ Args: { "p_token": string }; Returns: Json
                           },
"work_hours_save":
{ Args: { "p_hours": number,"p_location": string,"p_month": string,"p_note"?: string }; Returns: Json
                           },
"write_log":
{ Args: { "p_action": string,"p_category"?: string,"p_cctv": boolean,"p_changes": Json,"p_company": string,"p_entity_label": string,"p_href": string,"p_label": string,"p_note": string,"p_record_id": string,"p_table": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            "approval_context": {
                        "requester_id": string | null,"company_code": string | null,"department_id": string | null,"amount": number | null,"code": string | null,"status": string | null
                      }
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        },"safehub": {
          Enums: {
            
          }
        }
} as const
