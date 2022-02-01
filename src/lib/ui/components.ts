import { v4 as uuidv4 } from "uuid";

import {
    IButtonElement,
    IStaticSelectElement,
} from "@rocket.chat/apps-engine/definition/uikit";
import {
    BlockElementType,
    TextObjectType,
    IOptionObject,
    ITextObject,
} from "@rocket.chat/apps-engine/definition/uikit";

const newPlainTextObject = (text: string): ITextObject => {
    return {
        text: text,
        type: TextObjectType.PLAINTEXT,
    };
};

export const createMarkCompletedButton = (
    reminderID: string
): IButtonElement => {
    return {
        type: BlockElementType.BUTTON,
        text: newPlainTextObject("Mark as completed"),
        actionId: "markCompleted",
        value: reminderID,
    };
};

const defaultTimeOptions = [
    {
        value: "10m",
        text: newPlainTextObject("10 minutes"),
    },
    {
        value: "30m",
        text: newPlainTextObject("30 minutes"),
    },
    {
        value: "2h",
        text: newPlainTextObject("2 hours"),
    },
    {
        value: "tomorrow at 9am",
        text: newPlainTextObject("Tomorrow at 9am"),
    },
    {
        value: "next monday at 9am",
        text: newPlainTextObject("Next Monday at 9am"),
    },
];
export const createTimeDropdown = (
    placeholder: string = "Remind later",
    actionId: string = "remind-later",
    timeOptions: IOptionObject[] = defaultTimeOptions
): IStaticSelectElement => {
    return {
        type: BlockElementType.STATIC_SELECT,
        actionId: actionId || uuidv4(),
        placeholder: newPlainTextObject(placeholder),
        options: timeOptions,
    };
};
