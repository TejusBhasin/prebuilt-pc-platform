import { QuestionnaireStep } from "@/lib/types";
import getGuidance from "@/lib/Guidance";
import type { ReactNode } from "react";

interface Props {
    step: QuestionnaireStep
    children: ReactNode
}

export default function GuidedQuestionnaireLayout({ step, children }: Props) {
    const guidance = getGuidance(step)
    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 items-start">
            <div className="min-w-0 w-full">{children}</div>
            <div className="min-w-0 bg-panel border border-hairline rounded-md p-6 max-h-[calc(100vh-6rem)] overflow-y-auto">{guidance}</div>
        </div>
    )
}