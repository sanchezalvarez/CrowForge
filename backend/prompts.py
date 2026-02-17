# ── Prompt Contract v2 ──────────────────────────────────────────────
# Input:  project_goals (string) — primary driver, always required
#         tone (string)          — semantic instruction, optional
#         style (string)         — semantic instruction, optional
#         creativity (int 0-100) — maps to temperature, optional
#         project_type (string)  — "campaign" or "website"
# Output: JSON object with schema_version "v1"
# Rules:  No prose outside JSON. No markdown. No explanations.
#         Tone/style affect content voice. Creativity affects temperature.
#         JSON structure is NEVER changed by any parameter.

CONCEPT_SCHEMA_V1 = {
    "type": "object",
    "properties": {
        "schema_version": {"type": "string", "enum": ["v1"]},
        "concepts": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "concept_name": {"type": "string", "minLength": 1},
                    "rationale": {"type": "string", "minLength": 1},
                    "target_audience": {"type": "string", "minLength": 1},
                    "key_message": {"type": "string", "minLength": 1}
                },
                "required": ["concept_name", "rationale", "target_audience", "key_message"],
                "additionalProperties": False
            }
        }
    },
    "required": ["schema_version", "concepts"],
    "additionalProperties": False
}

CONCEPT_REQUIRED_KEYS = {"concept_name", "rationale", "target_audience", "key_message"}

# ── Creativity → Temperature mapping ──────────────────────────────

DEFAULT_TONE = "neutral"
DEFAULT_STYLE = "b2b"
DEFAULT_CREATIVITY = 50

PROJECT_TYPE_LABELS = {
    "campaign": {
        "noun": "marketing campaign concept",
        "noun_plural": "marketing campaign concepts",
        "field_descriptions": {
            "concept_name": "short campaign title",
            "rationale": "why this concept works for the goal",
            "target_audience": "who this campaign targets",
            "key_message": "the single core message",
        },
    },
    "website": {
        "noun": "website page/section concept",
        "noun_plural": "website page/section concepts",
        "field_descriptions": {
            "concept_name": "page or section name",
            "rationale": "why this page is needed for the goal",
            "target_audience": "who this page serves",
            "key_message": "the page's primary purpose or goal",
        },
    },
}


def resolve_temperature(creativity: int = DEFAULT_CREATIVITY) -> float:
    """Map a 0-100 creativity slider value to an LLM temperature."""
    if creativity <= 33:
        return 0.2
    elif creativity <= 66:
        return 0.5
    else:
        return 0.8


def render_template(
    template_text: str,
    *,
    project_goals: str = "",
    tone: str = DEFAULT_TONE,
    style: str = DEFAULT_STYLE,
    concept_count: int = 3,
    regen: bool = False,
    project_type: str = "campaign",
    # Extra variables for specialized templates
    extra_vars: dict | None = None,
) -> str:
    """Substitute {{placeholders}} in a stored template string."""
    pt = PROJECT_TYPE_LABELS.get(project_type, PROJECT_TYPE_LABELS["campaign"])
    noun = pt["noun"] if concept_count == 1 else pt["noun_plural"]
    fd = pt["field_descriptions"]

    regen_instruction = ""
    if regen:
        regen_instruction = "\n- Generate a FRESH concept, different from any previous attempt"

    replacements = {
        "{{tone}}": tone,
        "{{style}}": style,
        "{{concept_count}}": str(concept_count),
        "{{project_type}}": project_type,
        "{{noun}}": noun,
        "{{noun_plural}}": pt["noun_plural"],
        "{{fd_concept_name}}": fd["concept_name"],
        "{{fd_rationale}}": fd["rationale"],
        "{{fd_target_audience}}": fd["target_audience"],
        "{{fd_key_message}}": fd["key_message"],
        "{{regen_instruction}}": regen_instruction,
        "{{project_goals}}": project_goals,
    }

    if extra_vars:
        for k, v in extra_vars.items():
            replacements["{{" + k + "}}"] = v

    result = template_text
    for placeholder, value in replacements.items():
        result = result.replace(placeholder, value)
    return result


# ── Seed Templates ─────────────────────────────────────────────────
# Each entry becomes a row in prompt_templates on first run.
# category groups them in the frontend dropdown.

SEED_TEMPLATES = [
    # ── Ideation ───────────────────────────────────────────────────
    {
        "name": "Ideation v1",
        "category": "Ideation",
        "description": "Generate creative campaign or website concepts from a project brief.",
        "version": 1,
        "system_prompt": (
            'You are a senior creative strategist. '
            'CRITICAL: Write ALL concept text in the SAME LANGUAGE as the user input. '
            'Return exactly {{concept_count}} {{noun}} as JSON. '
            'No prose, no markdown, no explanation.\n'
            '\nExample output:\n'
            '{\n'
            '  "schema_version": "v1",\n'
            '  "concepts": [\n'
            '    {\n'
            '      "concept_name": "Morning Momentum",\n'
            '      "rationale": "Positions the coffee brand as a daily performance ritual, connecting caffeine to productivity",\n'
            '      "target_audience": "Working professionals aged 25-40 who value morning routines",\n'
            '      "key_message": "Your best work starts with your first cup"\n'
            '    }\n'
            '  ]\n'
            '}\n'
            '\nRules:\n'
            '- Exactly {{concept_count}} item(s) in "concepts"\n'
            '- "schema_version" must be "v1"\n'
            '- concept_name: a short creative title\n'
            '- rationale: 1-2 sentences explaining why this concept works\n'
            '- target_audience: specific audience description with demographics\n'
            '- key_message: a punchy tagline or core message\n'
            '- No extra keys, no text outside the JSON object\n'
            '- Each field value must be a plain text string — NO JSON syntax, no quotes, no braces inside values\n'
            '\nTone: {{tone}}. Style: {{style}}.'
            '{{regen_instruction}}'
        ),
        "user_prompt": 'Write your response in the same language as this brief.\n\n{"project_goals": "{{project_goals}}"}',
    },

    # ── Naming ─────────────────────────────────────────────────────
    {
        "name": "Naming v1",
        "category": "Naming",
        "description": "Generate brand or product name options with rationale.",
        "version": 1,
        "system_prompt": (
            'You are a brand naming specialist. '
            'CRITICAL: Write ALL concept text in the SAME LANGUAGE as the user input. '
            'Return exactly {{concept_count}} name options as JSON. '
            'No prose, no markdown, no explanation.\n'
            '\nExample output:\n'
            '{\n'
            '  "schema_version": "v1",\n'
            '  "concepts": [\n'
            '    {\n'
            '      "concept_name": "Luminary",\n'
            '      "rationale": "Evokes illumination and leadership — memorable and domain-available",\n'
            '      "target_audience": "Tech-forward B2B decision makers",\n'
            '      "key_message": "Leading the way forward"\n'
            '    }\n'
            '  ]\n'
            '}\n'
            '\nRules:\n'
            '- Exactly {{concept_count}} item(s) in "concepts"\n'
            '- "schema_version" must be "v1"\n'
            '- concept_name: the proposed name (1-3 words)\n'
            '- rationale: why this name works — memorability, tone, meaning\n'
            '- target_audience: who this name appeals to\n'
            '- key_message: the feeling or association the name evokes\n'
            '- No extra keys, no text outside the JSON object\n'
            '- Each field value must be a plain text string — NO JSON syntax, no quotes, no braces inside values\n'
            '\nTone: {{tone}}. Style: {{style}}.'
            '{{regen_instruction}}'
        ),
        "user_prompt": 'Write your response in the same language as this brief.\n\n{"project_goals": "{{project_goals}}"}',
    },

    # ── Pitch ──────────────────────────────────────────────────────
    {
        "name": "Pitch v1",
        "category": "Pitch",
        "description": "Generate elevator pitch angles for a product or service.",
        "version": 1,
        "system_prompt": (
            'You are a pitch deck strategist. '
            'CRITICAL: Write ALL concept text in the SAME LANGUAGE as the user input. '
            'Return exactly {{concept_count}} pitch angles as JSON. '
            'No prose, no markdown, no explanation.\n'
            '\nExample output:\n'
            '{\n'
            '  "schema_version": "v1",\n'
            '  "concepts": [\n'
            '    {\n'
            '      "concept_name": "The Efficiency Play",\n'
            '      "rationale": "Leads with ROI and time savings — resonates with cost-conscious buyers",\n'
            '      "target_audience": "CFOs and operations leads at mid-market companies",\n'
            '      "key_message": "Cut costs 40% without cutting corners"\n'
            '    }\n'
            '  ]\n'
            '}\n'
            '\nRules:\n'
            '- Exactly {{concept_count}} item(s) in "concepts"\n'
            '- "schema_version" must be "v1"\n'
            '- concept_name: short name for the pitch angle\n'
            '- rationale: why this angle is compelling for the audience\n'
            '- target_audience: specific decision-maker persona\n'
            '- key_message: the one-liner elevator pitch\n'
            '- No extra keys, no text outside the JSON object\n'
            '- Each field value must be a plain text string — NO JSON syntax, no quotes, no braces inside values\n'
            '\nTone: {{tone}}. Style: {{style}}.'
            '{{regen_instruction}}'
        ),
        "user_prompt": 'Write your response in the same language as this brief.\n\n{"project_goals": "{{project_goals}}"}',
    },

    # ── Technical ──────────────────────────────────────────────────
    {
        "name": "Technical v1",
        "category": "Technical",
        "description": "Generate technical content strategies (docs, guides, whitepapers).",
        "version": 1,
        "system_prompt": (
            'You are a technical content strategist. '
            'CRITICAL: Write ALL concept text in the SAME LANGUAGE as the user input. '
            'Return exactly {{concept_count}} content concepts as JSON. '
            'No prose, no markdown, no explanation.\n'
            '\nExample output:\n'
            '{\n'
            '  "schema_version": "v1",\n'
            '  "concepts": [\n'
            '    {\n'
            '      "concept_name": "Migration Playbook",\n'
            '      "rationale": "Reduces churn by addressing the #1 objection — switching costs",\n'
            '      "target_audience": "Engineering leads evaluating platform migration",\n'
            '      "key_message": "Migrate in a weekend, not a quarter"\n'
            '    }\n'
            '  ]\n'
            '}\n'
            '\nRules:\n'
            '- Exactly {{concept_count}} item(s) in "concepts"\n'
            '- "schema_version" must be "v1"\n'
            '- concept_name: title of the content piece\n'
            '- rationale: strategic purpose of this content\n'
            '- target_audience: technical persona with role and context\n'
            '- key_message: the takeaway for the reader\n'
            '- No extra keys, no text outside the JSON object\n'
            '- Each field value must be a plain text string — NO JSON syntax, no quotes, no braces inside values\n'
            '\nTone: {{tone}}. Style: {{style}}.'
            '{{regen_instruction}}'
        ),
        "user_prompt": 'Write your response in the same language as this brief.\n\n{"project_goals": "{{project_goals}}"}',
    },

    # ── Refine ─────────────────────────────────────────────────────
    {
        "name": "Refine",
        "category": "Refine",
        "description": "Improve, expand, or shorten a single text field.",
        "version": 1,
        "system_prompt": (
            'You are a marketing copywriter. '
            '{{action_instruction}} '
            'Keep the same tone and intent. '
            "Context: the project goal is '{{project_goal}}'. "
            'Return ONLY the improved text, nothing else.'
        ),
        "user_prompt": '{{current_text}}',
    },
]

# Map refine actions to instructions (used when rendering the Refine template)
REFINE_ACTION_INSTRUCTIONS = {
    "refine": "Improve the clarity and impact of this text.",
    "expand": "Expand this text with more detail and depth.",
    "shorten": "Make this text more concise while keeping the core meaning.",
}
