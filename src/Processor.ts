import {
    IRead,
    IModify,
    IHttp,
    IPersistence,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IJobContext } from "@rocket.chat/apps-engine/definition/scheduler/IProcessor";

import { sendDirectMessage } from "./lib/sendDirectMessage";
import { getReminderByRecordID } from "./lib/crud";
import {
    createMarkCompletedButton,
    createTimeDropdown,
} from "./lib/ui/components";

export const processor = async (
    jobData: IJobContext,
    read: IRead,
    modify: IModify,
    _http: IHttp,
    _persis: IPersistence
): Promise<void> => {
    const { recordID } = jobData;
    const reminder = await getReminderByRecordID(
        recordID,
        read.getPersistenceReader()
    );

    const blockBuilder = modify.getCreator().getBlockBuilder();
    blockBuilder.addSectionBlock({
        text: blockBuilder.newPlainTextObject(
            `You asked me to remind you about "${reminder.subject}"`
        ),
    });
    blockBuilder.addActionsBlock({
        blockId: reminder.id,
        elements: [
            createMarkCompletedButton(reminder.id),
            createTimeDropdown("Snooze", "snooze"),
        ],
    });

    sendDirectMessage(
        read,
        modify,
        `You asked me to remind you about "${reminder.subject}"`,
        reminder.user,
        blockBuilder
    );
};
