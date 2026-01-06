import type { UserType } from "@/app/(auth)/auth";
import type { ChatModel } from "./models";
import { agentIds } from "./models";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: agentIds,
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: agentIds,
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
