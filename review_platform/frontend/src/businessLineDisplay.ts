export const PLATFORM_DISPLAY_NAME = "TMOD智能员工";
export const CURRENT_BUSINESS_LINE_ID = "award_review";

const businessLineAgentNames: Record<string, string> = {
  award_review: "AI评优"
};

export function getBusinessLineAgentName(lineId: string): string {
  return businessLineAgentNames[lineId] ?? lineId;
}
