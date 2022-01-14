import { IModify } from "@rocket.chat/apps-engine/definition/accessors";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IMessageBuilder } from "@rocket.chat/apps-engine/definition/accessors";
import {
    BlockBuilder,
    IBlock,
} from "@rocket.chat/apps-engine/definition/uikit";

export const createMessage = (
    modify: IModify,
    text: string,
    sender: IUser,
    room: IRoom,
    blocks?: IBlock[] | BlockBuilder,
    customFields?: Record<string, any>
): IMessageBuilder => {
    const builder = modify
        .getCreator()
        .startMessage()
        .setSender(sender)
        .setRoom(room)
        .setText(text);

    if (blocks) {
        builder.addBlocks(blocks);
    }

    customFields?.forEach((value: boolean, key: string) => {
        builder.addCustomField(key, value);
    });

    return builder;
};
