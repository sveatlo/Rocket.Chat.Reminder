import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    ISlashCommand,
    SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";
import * as sherlock from "sherlockjs";
import { formatDistanceToNow } from "date-fns";

import { Reminder, ReminderType } from "./lib/reminder";
import { sendNotification } from "./lib/sendNotification";
import {
    actionListAllReminders,
    actionCreateReminder,
    actionDeleteAllReminders,
    actionDeleteAllCompletedReminders,
} from "./lib/ui/actions";
import { createReminderModalView } from "./lib/ui/createReminderModal";

export class RemindCommand implements ISlashCommand {
    public command = "remind";
    public i18nParamsExample = "command_params_example";
    public i18nDescription = "command_description";
    public providesPreview = false;

    constructor() {}

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        _http: IHttp,
        persist: IPersistence
    ): Promise<void> {
        const [subcommand] = context.getArguments();

        switch (subcommand) {
            case "help": {
                const builder = modify
                    .getCreator()
                    .startMessage()
                    .setSender(
                        (await read.getUserReader().getAppUser()) ||
                            context.getSender()
                    )
                    .setRoom(context.getRoom());
                builder.setText(`Available commands:\n
* list - list all uncompleted reminders\n
* help - print this help`);
                modify
                    .getNotifier()
                    .notifyUser(context.getSender(), builder.getMessage());

                break;
            }

            case "list":
                const user = context.getSender();
                const room = context.getRoom();
                const threadID = context.getThreadId();
                actionListAllReminders(
                    read,
                    modify,
                    read.getPersistenceReader(),
                    user,
                    room,
                    threadID
                );
                break;

            case "delete": {
                const [_, deleteType] = context.getArguments();
                switch (deleteType) {
                    case "all":
                        actionDeleteAllReminders(
                            read,
                            modify,
                            persist,
                            context.getSender(),
                            {
                                room: context.getRoom(),
                                threadID: context.getThreadId(),
                            }
                        );
                        break;
                    case "completed":
                        actionDeleteAllCompletedReminders(
                            read,
                            modify,
                            persist,
                            context.getSender(),
                            {
                                room: context.getRoom(),
                                threadID: context.getThreadId(),
                            }
                        );
                        break;
                    default:
                        // TODO:
                        break;
                }

                break;
            }

            default: {
                const user = context.getSender();
                const room = context.getRoom();
                const threadID = context.getThreadId();

                const args = context.getArguments().join(" ");
                const {
                    eventTitle: subject,
                    startDate: when,
                }: {
                    eventTitle?: string;
                    startDate?: Date;
                } = sherlock.parse(args);

                if (!subject || !when) {
                    const triggerId = context.getTriggerId();
                    if (triggerId) {
                        modify.getUiController().openModalView(
                            await createReminderModalView(
                                room.id,
                                modify,
                                persist,
                                undefined,
                                {
                                    subject: subject,
                                    when: when
                                        ? formatDistanceToNow(when)
                                        : undefined,
                                }
                            ),
                            { triggerId },
                            user
                        );
                    } else {
                        sendNotification(
                            read,
                            modify,
                            "Cannot parse command. Please check syntax",
                            user,
                            room,
                            threadID
                        );
                    }

                    return;
                }

                const reminder = new Reminder(
                    ReminderType.GENERIC,
                    user,
                    when,
                    subject,
                    false
                );
                actionCreateReminder(
                    read,
                    modify,
                    persist,
                    modify.getScheduler(),
                    reminder,
                    { room, threadID }
                );
            }
        }
    }
}
