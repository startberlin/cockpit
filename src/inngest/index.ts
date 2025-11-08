import { onboardNewUserWorkflow } from "./new-user-workflow";
import { handleSlackEvent } from "./slack-user-joined";

export const inngestFunctions = [
    handleSlackEvent,
    onboardNewUserWorkflow
]
