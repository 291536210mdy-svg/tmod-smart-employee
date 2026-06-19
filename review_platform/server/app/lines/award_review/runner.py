from app.lines.award_review.adapter import run_award_review
from app.platform.business_line import RunContext


class AwardReviewRunner:
    def run(self, context: RunContext) -> None:
        run_award_review(context)

