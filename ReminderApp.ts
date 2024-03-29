import {
    IAppAccessors,
    IConfigurationExtend,
    IEnvironmentRead,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { App } from "@rocket.chat/apps-engine/definition/App";
import { IAppInfo } from "@rocket.chat/apps-engine/definition/metadata";
import { UIActionButtonContext } from "@rocket.chat/apps-engine/definition/ui";
import {
    IUIKitInteractionHandler,
    IUIKitResponse,
    UIKitActionButtonInteractionContext,
    UIKitViewSubmitInteractionContext,
    UIKitViewCloseInteractionContext,
    UIKitBlockInteractionContext,
} from "@rocket.chat/apps-engine/definition/uikit";

import { processor } from "./src/Processor";
import { RemindCommand } from "./src/Command";
import { createReminderModalView } from "./src/lib/ui/createReminderModal";
import {
    actionCreateReminder,
    actionListAllReminders,
    actionMarkReminderCompleted,
    actionSnoozeReminder,
} from "./src/lib/ui/actions";
import { Reminder, ReminderType } from "./src/lib/reminder";
import {
    deleteModalContextByViewID,
    getModalContextByViewID,
    snoozeReminder,
} from "./src/lib/crud";
import { UIKitIncomingInteractionContainerType } from "@rocket.chat/apps-engine/definition/uikit/UIKitIncomingInteractionContainer";
import { sendNotification } from "./src/lib/sendNotification";

export class RcAppReportMessageApp
    extends App
    implements IUIKitInteractionHandler
{
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    async extendConfiguration(
        configuration: IConfigurationExtend,
        _environmentRead: IEnvironmentRead
    ): Promise<void> {
        await configuration.scheduler.registerProcessors([
            {
                id: "reminder",
                processor: processor,
            },
        ]);

        await configuration.slashCommands.provideSlashCommand(
            new RemindCommand()
        );

        configuration.ui.registerButton({
            actionId: "create-reminder",
            labelI18n: "msg_action_button_remind_label",
            context: UIActionButtonContext.MESSAGE_ACTION,
        });
    }

    public async executeViewSubmitHandler(
        context: UIKitViewSubmitInteractionContext,
        read: IRead,
        _http: IHttp,
        persist: IPersistence,
        modify: IModify
    ) {
        let {
            view: { id: viewId, state },
            user,
            room,
        } = context.getInteractionData();
        const {
            reminder: reminderData,
        }: {
            reminder: {
                subject: string;
                when: string;
            };
        } = state as any;

        if (!room) {
            const { roomId } = await getModalContextByViewID(
                read.getPersistenceReader(),
                viewId
            );

            room = await read.getRoomReader().getById(roomId);
            if (!room) {
                throw new Error("cannot get room");
            }

            deleteModalContextByViewID(persist, viewId);
        }

        if (!reminderData?.subject || !reminderData?.when) {
            const errors = {};
            if (!reminderData?.subject) {
                errors["subject"] = "Subject cannot be empty";
            }
            if (!reminderData?.when) {
                errors["when"] = "Subject cannot be empty";
            }

            return context.getInteractionResponder().viewErrorResponse({
                viewId,
                errors: errors,
            });
        }

        const reminder = new Reminder(
            ReminderType.GENERIC,
            user,
            reminderData.when,
            reminderData.subject,
            false
        );
        actionCreateReminder(
            read,
            modify,
            persist,
            modify.getScheduler(),
            reminder,
            { room }
        );

        return context.getInteractionResponder().successResponse();
    }

    public async executeViewClosedHandler(
        context: UIKitViewCloseInteractionContext,
        _read: IRead,
        _http: IHttp,
        _persistence: IPersistence,
        _modify: IModify
    ): Promise<IUIKitResponse> {
        return context.getInteractionResponder().successResponse();
    }

    public async executeActionButtonHandler(
        context: UIKitActionButtonInteractionContext,
        _read: IRead,
        _http: IHttp,
        _persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        const { buttonContext, actionId, triggerId, user, room, message } =
            context.getInteractionData();

        this.getLogger().info(context.getInteractionData());

        if (actionId === "create-reminder") {
            return context
                .getInteractionResponder()
                .openModalViewResponse(
                    await createReminderModalView(
                        room.id,
                        modify,
                        _persistence,
                        undefined,
                        undefined,
                        message
                    )
                );
        }

        return context.getInteractionResponder().successResponse();
    }

    public async executeBlockActionHandler(
        context: UIKitBlockInteractionContext,
        read: IRead,
        _http: IHttp,
        persist: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        let { user, room, message, container } = context.getInteractionData();
        this.getLogger().debug(
            "block action data",
            context.getInteractionData()
        );

        try {
            return this.processBlockActionHandler(
                context,
                read,
                _http,
                persist,
                modify
            );
        } catch (error) {
            this.getLogger().error(error);

            if (!room) {
                room = message?.room;
                if (!room) {
                    throw error;
                }
            }

            sendNotification(
                read,
                modify,
                `An unexpected error occured: ${error}`,
                user,
                room
            );

            return context.getInteractionResponder().errorResponse();
        }
    }

    private async processBlockActionHandler(
        context: UIKitBlockInteractionContext,
        read: IRead,
        _http: IHttp,
        persist: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        let { actionId, blockId, value, user, room, message } =
            context.getInteractionData();

        const appUser = await read.getUserReader().getAppUser();
        if (!appUser) {
            throw new Error("cannot get app user");
        }

        if (!room) {
            room = message?.room;

            if (!room) {
                throw new Error("cannot get room for interaction");
            }
        }

        this.getLogger().debug(
            "handling block action",
            actionId,
            blockId,
            value,
            context.getInteractionData()
        );

        // replace original message with processing notice
        if (message?.id) {
            const builder = await modify
                .getUpdater()
                .message(message.id as string, user);
            builder.setEditor(builder.getSender());
            builder.setBlocks([]);
            builder.setText(`⏳ processing...`);
            await modify.getUpdater().finish(builder);
        }

        switch (actionId) {
            case "markCompleted": {
                await actionMarkReminderCompleted(
                    blockId,
                    user,
                    { room: room },
                    read,
                    modify,
                    persist,
                    read.getPersistenceReader()
                );

                await actionListAllReminders(
                    read,
                    modify,
                    read.getPersistenceReader(),
                    user,
                    room,
                    message?.threadId
                );

                break;
            }

            case "snooze": {
                if (!value) {
                    return context.getInteractionResponder().errorResponse();
                }

                await actionSnoozeReminder(
                    blockId,
                    value,
                    user,
                    { room },
                    read,
                    modify,
                    persist,
                    read.getPersistenceReader()
                );

                break;
            }

            default:
                throw new Error(`unknown action "${actionId}"`);
        }

        // delete processing notice
        if (message?.id) {
            // TODO: delete the message when implemented to AppsEngine (RocketChat/Rocket.Chat.Apps-engine/issues/445)
            const builder = await modify
                .getUpdater()
                .message(message.id as string, user);
            builder.setText(``);
            await modify.getUpdater().finish(builder);
        }

        return context.getInteractionResponder().successResponse();
    }
}
