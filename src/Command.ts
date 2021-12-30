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

import { RemindersController } from "./Controller";
import { Reminder, ReminderType } from "./Reminder";

export class RemindCommand implements ISlashCommand {
    public command = "remind";
    public i18nParamsExample = "command_params_example";
    public i18nDescription = "command_description";
    public providesPreview = false;

    constructor(private controller: RemindersController) {}

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
                this.controller.listAllReminders(
                    read,
                    modify,
                    read.getPersistenceReader(),
                    user,
                    room,
                    threadID
                );
                break;

            case "delete": {
                const [_, which] = context.getArguments();
                switch (which) {
                    case "all":
                        this.controller.deleteAllReminders(
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
                        this.controller.deleteAllCompletedReminders(
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
                const { eventTitle: subject, startDate: when } = sherlock.parse(
                    args
                );

                const reminder = new Reminder(
                    ReminderType.GENERIC,
                    user,
                    when,
                    subject,
                    false
                );
                this.controller.createReminder(
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

    // public async executor(
    //     context: SlashCommandContext,
    //     read: IRead,
    //     modify: IModify,
    //     _http: IHttp,
    //     _persist: IPersistence
    // ): Promise<void> {
    //     // TODO: parse message
    //     // who: (me|[#@][a-z0-9-_]+)
    //     // subject: (to|about) ((?<subject_1>"(.*)")|(?<subject_2>.*) ((at|in|every|on))|(?<subject_3>.*$))
    //     // when:
    //
    //     const notifyMessageBuilder = modify
    //         .getCreator()
    //         .startMessage()
    //         .setRoom(context.getRoom())
    //         .setSender(
    //             (await read.getUserReader().getAppUser()) || context.getSender()
    //         );
    //     const threadID = context.getThreadId();
    //     if (threadID) {
    //         notifyMessageBuilder.setThreadId(threadID);
    //     }
    //
    //     const args = context.getArguments();
    //     // take all args as `when` if no "in" was found
    //     const inIndex = Math.max(
    //         args.findIndex((x) => x == "in"),
    //         0
    //     );
    //     const message = args.slice(0, inIndex).join(" ");
    //     const when = args.slice(inIndex + 1).join(" ");
    //
    //     try {
    //         await modify.getScheduler().scheduleOnce({
    //             id: "reminder",
    //             when: when,
    //             data: {
    //                 user: context.getSender(),
    //                 room: context.getRoom(),
    //                 threadID: context.getThreadId(),
    //                 message: message,
    //             },
    //         });
    //         notifyMessageBuilder.setText(
    //             `Success! I'll notify you here in ${when}.`
    //         );
    //     } catch (error) {
    //         notifyMessageBuilder.setText(
    //             `Cannot add reminder :( (error: ${error})`
    //         );
    //     }
    //
    //     modify
    //         .getNotifier()
    //         .notifyUser(context.getSender(), notifyMessageBuilder.getMessage());
    // }
}
