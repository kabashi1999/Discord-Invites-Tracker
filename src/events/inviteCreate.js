import { updateInviteCacheOnCreate } from "../services/inviteTracker.js";

export const name = "inviteCreate";
export const once = false;

export async function execute(invite) {
  updateInviteCacheOnCreate(invite);
}

export default { name, once, execute };
