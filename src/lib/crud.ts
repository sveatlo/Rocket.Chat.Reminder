import {
    IRead,
    IPersistence,
    IPersistenceRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { ISchedulerModify } from "@rocket.chat/apps-engine/definition/accessors";

import { Reminder } from "./reminder";
import {
    userAssociation,
    idAssociation,
    modalViewAssociation,
} from "./associations";
import { ModalContext } from "./modalContext";

export const addReminder = async (
    reminder: Reminder,
    scheduler: ISchedulerModify,
    persist: IPersistence
): Promise<string | void> => {
    // NOTE: recordID != reminder.id (FUUUUUUUUUUUUUCK)
    const recordID = await persist.createWithAssociations(reminder, [
        idAssociation(reminder.id),
        userAssociation(reminder.user.id),
    ]);

    return updateReminder(recordID, reminder, scheduler, persist);
};

export const updateReminder = async (
    recordID: string,
    reminder: Reminder,
    scheduler: ISchedulerModify,
    persist: IPersistence
): Promise<string | void> => {
    const now = new Date();
    try {
        if (reminder.jobID) {
            await scheduler.cancelJob(reminder.jobID);
        }
    } catch (error) {}

    let jobID: any; // TODO: enforce string type
    if (now < reminder.when && !reminder.completed) {
        // only schedule non-completed jobs in future
        jobID = await scheduler.scheduleOnce({
            id: "reminder",
            when: reminder.when,
            data: {
                recordID: recordID,
            },
        });
        if (!jobID) {
            throw new Error("cannot schedule reminder");
        }
    }

    // save reference to jobID in reminder // TODO: refactor?
    reminder.recordID = recordID;
    reminder.jobID = jobID;

    // actual update is not implemented.. (FUUUUUUUUUUUUUCK)
    // await persist.update(recordID, reminder);
    await persist.updateByAssociations(
        [idAssociation(reminder.id), userAssociation(reminder.user.id)],
        reminder
    );

    return jobID;
};

export const getAllForUser = async (
    persistRead: IPersistenceRead,
    user: string
): Promise<Reminder[]> => {
    return <Promise<Reminder[]>>(
        persistRead.readByAssociations([userAssociation(user)])
    );
};

export const getReminderByRecordID = async (
    recordID: string,
    persistRead: IPersistenceRead
): Promise<Reminder> => {
    const record = await persistRead.read(recordID);
    if (!record) {
        throw new Error("cannot find record by record ID");
    }

    return <Reminder>record;
};

export const getReminderByID = async (
    id: string,
    persistRead: IPersistenceRead
): Promise<Reminder> => {
    const record = await persistRead.readByAssociation(idAssociation(id));
    if (!record || record.length <= 0 || record.length > 1) {
        throw new Error("cannot find record by reminder ID");
    }

    return <Reminder>record[0];
};

export const deleteAllReminders = async (
    persist: IPersistence,
    user: IUser
): Promise<object[]> => {
    // TODO: add job cancelling
    return persist.removeByAssociations([userAssociation(user.id)]);
};

export const markReminderCompleted = async (
    id: string,
    scheduler: ISchedulerModify,
    persist: IPersistence,
    persistRead: IPersistenceRead
): Promise<string | void> => {
    const reminder = await getReminderByID(id, persistRead);
    reminder.completed = true;

    if (!reminder.recordID) {
        throw new Error(
            "cannot mark reminder with unknown recordID as complete"
        );
    }

    return updateReminder(reminder.recordID, reminder, scheduler, persist);
};

export const snoozeReminder = async (
    id: string,
    newWhen: Date | string,
    scheduler: ISchedulerModify,
    persist: IPersistence,
    persistRead: IPersistenceRead
): Promise<string | void> => {
    const reminder = await getReminderByID(id, persistRead);
    // reminder.setWhen(newWhen); // TODO: for some reason the method setWhen doesn't work from here - hack below

    const snoozedReminder = new Reminder(
        reminder.type,
        reminder.user,
        newWhen, // the only change (FUUUUUUUUUUUUUCK)
        reminder.subject,
        reminder.completed,
        reminder.message,
        reminder.jobID
    );
    snoozedReminder.id = reminder.id;

    if (!reminder.recordID) {
        throw new Error("cannot snooze reminder with unknown recordID");
    }

    return updateReminder(
        reminder.recordID,
        snoozedReminder,
        scheduler,
        persist
    );
};

// TODO: should return some promise? concatenate all promises?
export const deleteAllCompletedReminders = async (
    read: IRead,
    persist: IPersistence,
    user: IUser
) => {
    const reminders = await getAllForUser(read.getPersistenceReader(), user.id);
    for (const reminder of reminders) {
        await persist.removeByAssociations([idAssociation(reminder.id)]);
    }
};

export const saveModalContextByViewID = async (
    persist: IPersistence,
    context: ModalContext
): Promise<string | void> => {
    return persist.createWithAssociation(
        context,
        modalViewAssociation(context.viewId)
    );
};

export const getModalContextByViewID = async (
    persistRead: IPersistenceRead,
    viewId: string
): Promise<ModalContext> => {
    const records = await persistRead.readByAssociation(
        modalViewAssociation(viewId)
    );
    if (records.length <= 0 || records.length > 1) {
        console.log(records);
        throw new Error("cannot get modal context by association");
    }

    return <ModalContext>records[0];
};

export const deleteModalContextByViewID = async (
    persist: IPersistence,
    viewId: string
): Promise<object[]> => {
    return persist.removeByAssociation(modalViewAssociation(viewId));
};
