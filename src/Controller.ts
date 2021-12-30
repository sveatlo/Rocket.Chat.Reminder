import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { IRoom, RoomType } from "@rocket.chat/apps-engine/definition/rooms";
import { IMessage } from "@rocket.chat/apps-engine/definition/messages";
import {
    RocketChatAssociationModel,
    RocketChatAssociationRecord,
} from "@rocket.chat/apps-engine/definition/metadata";
import {
    IRead,
    IModify,
    IHttp,
    IPersistence,
    IPersistenceRead,
    ISchedulerModify,
    IMessageBuilder,
    ILogger,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IJobContext } from "@rocket.chat/apps-engine/definition/scheduler/IProcessor";
import { Reminder } from "./Reminder";
import {
    BlockBuilder,
    BlockElementType,
    BlockType,
    ButtonStyle,
    IBlock,
    IButtonElement,
    TextObjectType,
} from "@rocket.chat/apps-engine/definition/uikit";

type MessageContext = {
    room: IRoom;
    threadID: string | undefined;
};

export class RemindersController {
    public readonly persist_key = "reminder";

    constructor(private logger: ILogger) {}

    public async createReminder(
        read: IRead,
        modify: IModify,
        persist: IPersistence,
        scheduler: ISchedulerModify,

        reminder: Reminder,
        creationContext: MessageContext
    ) {
        await this.addReminder(reminder, scheduler, persist);

        this.sendNotification(
            read,
            modify,
            `👍 I'll remind you about "${reminder.subject}" at ${reminder.when}`,
            reminder.user,
            creationContext.room,
            creationContext.threadID
        );
    }

    public async listAllReminders(
        read: IRead,
        modify: IModify,
        persistRead: IPersistenceRead,
        user: IUser,
        room: IRoom,
        threadId?: string
    ) {
        const reminders = await this.getAllForUser(persistRead, user.id);
        if (reminders.length <= 0) {
            this.sendNotification(
                read,
                modify,
                "You don't have any notifications",
                user,
                room,
                threadId
            );
            return;
        }

        let future: Reminder[] = [];
        let past: Reminder[] = [];
        const now = new Date();
        for (const reminder of reminders) {
            if (now < reminder.when) {
                future.push(reminder);
            } else {
                if (reminder.completed) {
                    continue;
                }

                past.push(reminder);
            }
        }

        const addReminderBlock = (reminder: Reminder) =>
            blockBuilder.addSectionBlock({
                accessory: this.createCompleteButton(reminder.id),
                text: blockBuilder.newMarkdownTextObject(
                    `• ${reminder.subject} at ${reminder.when}`
                ),
            });

        const blockBuilder = modify.getCreator().getBlockBuilder();
        blockBuilder.addSectionBlock({
            text: blockBuilder.newMarkdownTextObject(`*Upcoming*`),
        });
        for (const reminder of future) {
            addReminderBlock(reminder);
        }
        blockBuilder.addDividerBlock();
        blockBuilder.addSectionBlock({
            text: blockBuilder.newMarkdownTextObject(`*Past uncompleted*`),
        });
        for (const reminder of past) {
            addReminderBlock(reminder);
        }

        var text = `These are your notifications: \n`;
        for (const reminder of reminders) {
            text += `* "${reminder.subject}" \n`;
        }

        this.sendNotification(
            read,
            modify,
            text,
            user,
            room,
            threadId,
            blockBuilder
        );
    }

    public async deleteAllReminders(
        read: IRead,
        modify: IModify,
        persist: IPersistence,
        user: IUser,
        context: MessageContext
    ) {
        await persist.removeByAssociations([
            this.appAssociation(),
            this.userAssociation(user.id),
        ]);
        this.sendNotification(
            read,
            modify,
            `👍 All reminders deleted`,
            user,
            context.room,
            context.threadID
        );
    }

    public async deleteAllCompletedReminders(
        read: IRead,
        modify: IModify,
        persist: IPersistence,
        user: IUser,
        context: MessageContext
    ) {
        const reminders = await this.getAllForUser(
            read.getPersistenceReader(),
            user.id
        );
        for (const reminder of reminders) {
            await persist.removeByAssociations([
                this.appAssociation(),
                this.idAssociation(reminder.id),
            ]);
        }
        this.sendNotification(
            read,
            modify,
            `👍 All completed reminders deleted`,
            user,
            context.room,
            context.threadID
        );
    }

    private async addReminder(
        reminder: Reminder,
        scheduler: ISchedulerModify,
        persist: IPersistence
    ) {
        const recordID = await persist.createWithAssociations(reminder, [
            this.appAssociation(),
            this.idAssociation(reminder.id),
            this.userAssociation(reminder.user.id),
        ]);
        await scheduler.scheduleOnce({
            id: "reminder",
            when: reminder.when,
            data: {
                recordID: recordID,
            },
        });
    }

    private async snoozeReminder() {}

    private async getAllForUser(
        persistRead: IPersistenceRead,
        user: string
    ): Promise<Reminder[]> {
        return <Promise<Reminder[]>>(
            persistRead.readByAssociations([
                this.appAssociation(),
                this.userAssociation(user),
            ])
        );
    }

    public async processor(
        jobData: IJobContext,
        read: IRead,
        modify: IModify,
        _http: IHttp,
        _persis: IPersistence
    ): Promise<void> {
        this.logger.info("processing scheduled reminder", jobData);
        const { recordID } = jobData;
        const reminder = await this.getReminderByRecordID(
            recordID,
            read.getPersistenceReader()
        );

        this.logger.info("processing scheduled reminder", recordID, reminder);

        const blockBuilder = modify.getCreator().getBlockBuilder();
        const snoozeButton = blockBuilder.newStaticSelectElement({
            placeholder: blockBuilder.newPlainTextObject("Snooze"),
            options: [
                {
                    value: "10min",
                    text: blockBuilder.newPlainTextObject("10 minutes"),
                },
                {
                    value: "30min",
                    text: blockBuilder.newPlainTextObject("30 minutes"),
                },
            ],
        });
        blockBuilder.addSectionBlock({
            text: blockBuilder.newPlainTextObject(
                `You asked me to remind you about "${reminder.subject}"`
            ),
        });
        blockBuilder.addActionsBlock({
            blockId: "reminder_msg_actions",
            elements: [this.createCompleteButton(reminder.id), snoozeButton],
        });

        this.sendDirectMessage(
            read,
            modify,
            `You asked me to remind you about "${reminder.subject}"`,
            reminder.user,
            blockBuilder
        );
    }

    private createCompleteButton(reminderID: string): IButtonElement {
        return {
            type: BlockElementType.BUTTON,
            text: {
                type: TextObjectType.PLAINTEXT,
                text: "Mark as complete",
                emoji: true,
            },
            actionId: "markComplete",
            value: reminderID,
        };
    }

    public async getReminderByRecordID(
        id: string,
        persistRead: IPersistenceRead
    ): Promise<Reminder> {
        const record = await persistRead.read(id);
        if (!record) {
            throw new Error("record not found");
        }

        return <Reminder>record;
    }

    private async sendNotification(
        read: IRead,
        modify: IModify,
        text: string,
        user: IUser,
        room: IRoom,
        threadId?: string,
        blocks?: IBlock[] | BlockBuilder
    ) {
        const messageBuilder = this.createMessage(
            modify,
            text,
            await this.getAppUser(read, user),
            room
        );
        if (threadId) {
            messageBuilder.setThreadId(threadId);
        }
        if (blocks) {
            messageBuilder.addBlocks(blocks);
        }

        return modify
            .getNotifier()
            .notifyUser(user, messageBuilder.getMessage());
    }

    private async sendDirectMessage(
        read: IRead,
        modify: IModify,
        text: string,
        user: IUser,
        blocks?: IBlock[] | BlockBuilder
    ) {
        const appUser = await this.getAppUser(read, user);
        const members = [appUser.username, user.username];
        let room = await read.getRoomReader().getDirectByUsernames(members);

        // TODO: not working
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
        }

        const sender = await this.getAppUser(read, user);
        const messageBuilder = this.createMessage(modify, text, sender, room);

        if (blocks) {
            messageBuilder.addBlocks(blocks);
        }

        modify.getCreator().finish(messageBuilder);
    }

    private async getAppUser(read: IRead, fallback: IUser): Promise<IUser> {
        return (await read.getUserReader().getAppUser()) || fallback;
    }

    private createMessage(
        modify: IModify,
        text: string,
        sender: IUser,
        room: IRoom
    ): IMessageBuilder {
        return modify
            .getCreator()
            .startMessage()
            .setSender(sender)
            .setRoom(room)
            .setText(text);
    }

    private userAssociation(user: string): RocketChatAssociationRecord {
        return new RocketChatAssociationRecord(
            RocketChatAssociationModel.USER,
            user
        );
    }
    private idAssociation(id: string): RocketChatAssociationRecord {
        return new RocketChatAssociationRecord(
            RocketChatAssociationModel.USER,
            id
        );
    }
    private appAssociation(): RocketChatAssociationRecord {
        return new RocketChatAssociationRecord(
            RocketChatAssociationModel.MISC,
            this.persist_key
        );
    }
}
