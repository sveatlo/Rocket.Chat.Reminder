import {
    IRead,
    IModify,
    IPersistence,
    IPersistenceRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { ISchedulerModify } from "@rocket.chat/apps-engine/definition/accessors";
import { formatRelative } from "date-fns";

import {
    getAllForUser,
    addReminder,
    deleteAllReminders,
    deleteAllCompletedReminders,
    snoozeReminder,
    markReminderCompleted,
    getReminderByID,
} from "../crud";
import { sendNotification } from "../sendNotification";
import { Reminder } from "../reminder";
import { createMarkCompletedButton } from "./components";
import { MessageContext } from "../messageContext";

export const actionCreateReminder = async (
    read: IRead,
    modify: IModify,
    persist: IPersistence,
    scheduler: ISchedulerModify,

    reminder: Reminder,
    creationContext: MessageContext
) => {
    await addReminder(reminder, scheduler, persist);
    IllRemindYouNotification(read, modify, reminder, creationContext);
};

const IllRemindYouNotification = async (
    read: IRead,
    modify: IModify,
    reminder: Reminder,
    creationContext: MessageContext
) => {
    sendNotification(
        read,
        modify,
        `👍 I'll remind you about "${reminder.subject}" ${formatRelative(
            reminder.when,
            new Date()
        )}`,
        reminder.user,
        creationContext.room,
        creationContext.threadID
    );
};

export const actionListAllReminders = async (
    read: IRead,
    modify: IModify,
    persistRead: IPersistenceRead,
    user: IUser,
    room: IRoom,
    threadId?: string
) => {
    const reminders = await getAllForUser(persistRead, user.id);
    let future: Reminder[] = [];
    let past: Reminder[] = [];
    const now = new Date();
    for (const reminder of reminders) {
        if (reminder.completed) {
            continue;
        }

        if (now < reminder.when) {
            future.push(reminder);
        } else {
            past.push(reminder);
        }
    }

    if (past.length <= 0 && future.length <= 0) {
        sendNotification(
            read,
            modify,
            "You don't have any reminders 🥳",
            user,
            room,
            threadId
        );
        return;
    }

    // TODO: move out
    const addReminderBlock = (
        reminder: Reminder,
        addMarkCompletedButton: boolean = true
    ) => {
        blockBuilder.addSectionBlock({
            blockId: reminder.id,
            accessory: addMarkCompletedButton
                ? createMarkCompletedButton(reminder.id)
                : undefined,
            text: blockBuilder.newMarkdownTextObject(
                `• ${reminder.subject} ${formatRelative(
                    reminder.when,
                    new Date()
                )}`
            ),
        });
    };

    const blockBuilder = modify.getCreator().getBlockBuilder();
    blockBuilder.addSectionBlock({
        text: blockBuilder.newMarkdownTextObject(
            `### ✅ Here is a list of all your reminders: `
        ),
    });
    if (future.length > 0) {
        blockBuilder.addSectionBlock({
            text: blockBuilder.newMarkdownTextObject(`*Upcoming*`),
        });
        for (const reminder of future) {
            addReminderBlock(reminder);
        }
    }

    if (past.length > 0) {
        blockBuilder.addDividerBlock();
        blockBuilder.addSectionBlock({
            text: blockBuilder.newMarkdownTextObject(`*Past uncompleted*`),
        });
        for (const reminder of past) {
            addReminderBlock(reminder);
        }
    }

    var text = `These are your notifications: \n`;
    for (const reminder of reminders) {
        text += `* "${reminder.subject}" \n`;
    }

    sendNotification(read, modify, text, user, room, threadId, blockBuilder);
};

export const actionDeleteAllReminders = async (
    read: IRead,
    modify: IModify,
    persist: IPersistence,
    user: IUser,
    context: MessageContext
) => {
    await deleteAllReminders(persist, user);

    sendNotification(
        read,
        modify,
        `👍 All reminders deleted`,
        user,
        context.room,
        context.threadID
    );
};

export const actionDeleteAllCompletedReminders = async (
    read: IRead,
    modify: IModify,
    persist: IPersistence,
    user: IUser,
    context: MessageContext
) => {
    await deleteAllCompletedReminders(read, persist, user);

    sendNotification(
        read,
        modify,
        `👍 All completed reminders deleted`,
        user,
        context.room,
        context.threadID
    );
};

export const actionSnooze = async (
    reminderID: string,
    newWhen: Date | string,
    context: MessageContext,
    read: IRead,
    modify: IModify,
    persist: IPersistence,
    persistRead: IPersistenceRead
) => {
    await snoozeReminder(
        reminderID,
        newWhen,
        modify.getScheduler(),
        persist,
        persistRead
    );

    const reminder = await getReminderByID(reminderID, persistRead);
    IllRemindYouNotification(read, modify, reminder, context);
};

export const actionMarkReminderCompleted = async (
    reminderID: string,
    user: IUser,
    context: MessageContext,
    read: IRead,
    modify: IModify,
    persist: IPersistence,
    persistRead: IPersistenceRead
) => {
    await markReminderCompleted(
        reminderID,
        modify.getScheduler(),
        persist,
        persistRead
    );

    sendNotification(
        read,
        modify,
        `👍 Marked as complete`,
        user,
        context.room,
        context.threadID
    );
};

export const actionSnoozeReminder = async (
    reminderID: string,
    when: Date | string,
    user: IUser,
    context: MessageContext,
    read: IRead,
    modify: IModify,
    persist: IPersistence,
    persistRead: IPersistenceRead
) => {
    await snoozeReminder(
        reminderID,
        when,
        modify.getScheduler(),
        persist,
        persistRead
    );

    sendNotification(
        read,
        modify,
        `👍 I'll remind you again later`,
        user,
        context.room,
        context.threadID
    );
};
