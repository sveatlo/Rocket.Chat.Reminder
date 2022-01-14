import {
    IModify,
    IPersistence,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IMessage } from "@rocket.chat/apps-engine/definition/messages";
import {
    ButtonStyle,
    IInputElement,
} from "@rocket.chat/apps-engine/definition/uikit";
import {
    RocketChatAssociationModel,
    RocketChatAssociationRecord,
} from "@rocket.chat/apps-engine/definition/metadata";
import { IUIKitModalViewParam } from "@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder";
import { v4 as uuidv4 } from "uuid";

import { createTimeDropdown } from "./components";
import { saveModalContextByViewID } from "../crud";

interface State {
    subject?: string;
    when?: string;
}

export const createReminderModalView = async (
    roomId: string,
    modify: IModify,
    persist: IPersistence,
    viewId?: string,
    initialState?: State,
    message?: IMessage
): Promise<IUIKitModalViewParam> => {
    viewId = viewId || uuidv4();
    await saveModalContextByViewID(persist, {
        viewId,
        roomId,
        messageId: message?.id,
    });

    const blockBuilder = modify.getCreator().getBlockBuilder();

    blockBuilder.addInputBlock({
        blockId: "reminder",
        element: blockBuilder.newPlainTextInputElement({
            actionId: "subject",
            initialValue: message?.text || initialState?.subject,
        }),
        label: blockBuilder.newPlainTextObject("Subject"),
    });

    let whenInputElement: IInputElement = createTimeDropdown(
        "When do you want me to remind you?",
        "when"
    );

    if (initialState?.when) {
        whenInputElement = blockBuilder.newPlainTextInputElement({
            actionId: "when",
            initialValue: initialState?.when,
        });
    }

    blockBuilder.addInputBlock({
        blockId: "reminder",
        element: whenInputElement,
        label: blockBuilder.newPlainTextObject("Time"),
    });

    return {
        id: viewId,
        title: blockBuilder.newPlainTextObject("Create new reminder"),
        submit: blockBuilder.newButtonElement({
            style: ButtonStyle.PRIMARY,
            text: blockBuilder.newPlainTextObject("Submit"),
        }),
        close: blockBuilder.newButtonElement({
            text: blockBuilder.newPlainTextObject("Dismiss"),
        }),
        clearOnClose: true,
        blocks: blockBuilder.getBlocks(),
    };
};
