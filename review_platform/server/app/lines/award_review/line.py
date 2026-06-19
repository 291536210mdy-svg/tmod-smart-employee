from app.lines.award_review.runner import AwardReviewRunner
from app.lines.award_review.schemas import AwardReviewRunConfig
from app.platform.business_line import BusinessLineManifest


class AwardReviewLine:
    manifest = BusinessLineManifest(
        line_id="award_review",
        name="评优业务线",
        description="基于申报 Excel、Dify Workflow、本地评分排序和 QA 检查生成评优结果。",
        input_types=["xlsx"],
        run_modes=["full", "dry_run", "award_filter"],
        artifacts=[
            "review_results_xlsx",
            "raw_review_jsonl",
            "internal_review_pack",
            "completion_xlsx",
            "qa_report",
        ],
        config_schema={
            "fields": [
                {"name": "dry_run", "type": "boolean", "default": False},
                {"name": "award_filters", "type": "string[]", "default": []},
                {"name": "limit", "type": "integer", "default": 0, "min": 0},
                {"name": "timeout", "type": "integer", "default": 120, "min": 1},
                {"name": "sleep", "type": "number", "default": 0.2, "min": 0},
                {"name": "enable_leadership_priority", "type": "boolean", "default": True},
            ]
        },
    )

    def get_manifest(self) -> BusinessLineManifest:
        return self.manifest

    def validate_config(self, config: dict) -> None:
        AwardReviewRunConfig(**config)

    def create_runner(self) -> AwardReviewRunner:
        return AwardReviewRunner()

