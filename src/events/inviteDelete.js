import { updateInviteCacheOnDelete } from "../services/inviteTracker.js";

export const name = "inviteDelete";
export const once = false;

export async function execute(invite) {
  updateInviteCacheOnDelete(invite);
}

export default { name, once, execute };
