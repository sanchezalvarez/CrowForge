export type ProjectType = 'campaign' | 'website';

export interface Campaign {
    id?: number;
    client_id?: number;
    name: string;
    brief: string;
    status: 'draft' | 'generating' | 'completed';
    project_type?: ProjectType;
    ideas?: Record<string, unknown>[];
}

/** UI-safe concept shape — always has all fields with string values */
export interface UIConcept {
    concept_name: string;
    rationale: string;
    target_audience: string;
    key_message: string;
}

export type RefineAction = 'refine' | 'expand' | 'shorten';

export interface PromptTemplate {
    id: number;
    name: string;
    category: string;
    description: string;
    version: number;
}

export interface GenerationVersion {
    id: number;
    campaign_id: number;
    content: UIConcept[];
    parent_version_id: number | null;
    created_at: string;
}
