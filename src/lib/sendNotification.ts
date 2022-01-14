import { IRead, IModify } from "@rocket.chat/apps-engine/definition/accessors";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import {
    BlockBuilder,
    IBlock,
} from "@rocket.chat/apps-engine/definition/uikit";

import { createMessage } from "./createMessage";
import { getAppUser } from "./getAppUser";

export const sendNotification = async (
    read: IRead,
    modify: IModify,
    text: string,
    user: IUser,
    room: IRoom,
    threadId?: string,
    blocks?: IBlock[] | BlockBuilder,
    customFields?: Record<string, any>
) => {
    const messageBuilder = createMessage(
        modify,
        text,
        await getAppUser(read, user),
        room,
        blocks,
        customFields
    );
    if (threadId) {
        messageBuilder.setThreadId(threadId);
    }

    return modify.getNotifier().notifyUser(user, messageBuilder.getMessage());
};
