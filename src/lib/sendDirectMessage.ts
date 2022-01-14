import { IRead, IModify } from "@rocket.chat/apps-engine/definition/accessors";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { RoomType } from "@rocket.chat/apps-engine/definition/rooms";
import {
    BlockBuilder,
    IBlock,
} from "@rocket.chat/apps-engine/definition/uikit";

import { createMessage } from "./createMessage";
import { getAppUser } from "./getAppUser";

export const sendDirectMessage = async (
    read: IRead,
    modify: IModify,
    text: string,
    user: IUser,
    blocks?: IBlock[] | BlockBuilder,
    customFields?: Record<string, any>
) => {
    const appUser = await getAppUser(read, user);
    const members = [appUser.username, user.username];
    let room = await read.getRoomReader().getDirectByUsernames(members);

    if (!room) {
        const roomBuilder = modify
            .getCreator()
            .startRoom()
            .setType(RoomType.DIRECT_MESSAGE)
            .setDisplayName("Reminder")
            .setCreator(appUser)
            .setMembersToBeAddedByUsernames(members);
        const newRoomID = await modify.getCreator().finish(roomBuilder);
        const newRoom = await read.getRoomReader().getById(newRoomID);
        if (!newRoom) {
            throw new Error("cannot get direct message");
        }
        room = newRoom;
    }

    const sender = await getAppUser(read, user);
    const messageBuilder = createMessage(
        modify,
        text,
        sender,
        room,
        blocks,
        customFields
    );
    modify.getCreator().finish(messageBuilder);
};
