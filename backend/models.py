from enum import Enum
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class CampaignStatus(str, Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    COMPLETED = "completed"

class BrandProfile(BaseModel):
    id: Optional[int] = Field(default=None)
    client_id: Optional[int] = Field(default=None)
    tone_of_voice: str
    brand_values: str
    target_audience: str

class Client(BaseModel):
    id: Optional[int] = Field(default=None)
    name: str
    industry: str
    website: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    brand_profile: Optional[BrandProfile] = None

class Campaign(BaseModel):

    id: Optional[int] = Field(default=None)

    client_id: int

    name: str

    brief: str

    status: CampaignStatus = Field(default=CampaignStatus.DRAFT)

    project_type: str = Field(default="campaign")

    prompt_template_id: Optional[int] = Field(default=None)

    created_at: Optional[str] = None

    updated_at: Optional[str] = None

    ideas: List[dict] = Field(default_factory=list)


class RefineRequest(BaseModel):
    campaign_id: int
    concept_index: int
    field_name: str
    current_text: str
    project_goal: str
    action: str  # 'refine' | 'expand' | 'shorten'

class ConceptRevision(BaseModel):
    id: Optional[int] = Field(default=None)
    campaign_idea_id: int
    field_name: str
    original_text: str
    refined_text: str
    action: str
    created_at: Optional[str] = None

class GenerationVersion(BaseModel):
    id: Optional[int] = Field(default=None)
    campaign_id: int
    content: str  # JSON string of concepts array
    parent_version_id: Optional[int] = None
    created_at: Optional[str] = None

class BenchmarkRun(BaseModel):
    id: Optional[int] = Field(default=None)
    input_text: str
    engine_name: str
    model_name: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 1024
    latency_ms: int = 0
    output_text: str = ""
    error: Optional[str] = None
    created_at: Optional[str] = None

class BenchmarkRequest(BaseModel):
    input_text: str
    engines: List[str]  # engine names to benchmark
    models: List[str] = []  # GGUF filenames for local engine; if set, runs each model
    temperature: float = 0.7
    max_tokens: int = 1024
    top_p: float = 0.95

class PromptTemplate(BaseModel):
    id: Optional[int] = Field(default=None)
    name: str
    category: str = "Ideation"
    description: str = ""
    system_prompt: str
    user_prompt: str
    version: int = 1
    created_at: Optional[str] = None
