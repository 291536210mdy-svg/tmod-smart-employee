from pydantic import BaseModel, Field


class AwardReviewRunConfig(BaseModel):
    dry_run: bool = False
    award_filters: list[str] = Field(default_factory=list)
    limit: int = Field(default=0, ge=0)
    timeout: int = Field(default=120, ge=1)
    sleep: float = Field(default=0.2, ge=0)
    enable_leadership_priority: bool = True
    input_filename: str = "source.xlsx"

