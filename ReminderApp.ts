import {
    IAppAccessors,
    IConfigurationExtend,
    ILogger,
    IRead,
    IHttp,
    IPersistence,
    IModify,
} from "@rocket.chat/apps-engine/definition/accessors";
import { App } from "@rocket.chat/apps-engine/definition/App";
import { IAppInfo } from "@rocket.chat/apps-engine/definition/metadata";
import {
    IUIKitInteractionHandler,
    UIKitActionButtonInteractionContext,
    IUIKitResponse,
    UIKitBlockInteractionContext,
} from "@rocket.chat/apps-engine/definition/uikit";
import { UIActionButtonContext } from "@rocket.chat/apps-engine/definition/ui";
import { IJobContext } from "@rocket.chat/apps-engine/definition/scheduler/IProcessor";

import { RemindCommand } from "./src/Command";
import { RemindsProcessor as RemindersProcessor } from "./src/Processor";
import { RemindersController } from "./src/Controller";

export class ReminderApp extends App implements IUIKitInteractionHandler {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async initialize(
        configuration: IConfigurationExtend
    ): Promise<void> {
        const controller = new RemindersController(this.getLogger());

        await configuration.scheduler.registerProcessors([
            // new RemindersProcessor(this.getLogger(), controller),
            {
                id: "reminder",
                processor: async (
                    jobData: IJobContext,
                    read: IRead,
                    modify: IModify,
                    http: IHttp,
                    persis: IPersistence
                ) => {
                    await controller.processor(
                        jobData,
                        read,
                        modify,
                        http,
                        persis
                    );
                },
            },
        ]);

        await configuration.slashCommands.provideSlashCommand(
            new RemindCommand(controller)
        );

        configuration.ui.registerButton({
            actionId: "createReminder",
            labelI18n: "msg_action_button_remind_label",
            context: UIActionButtonContext.MESSAGE_ACTION,
        });
    }

    public async executeActionButtonHandler(
        context: UIKitActionButtonInteractionContext,
        _read: IRead,
        _http: IHttp,
        _persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        return context.getInteractionResponder().successResponse();
    }

    public async executeBlockActionHandler(
        context: UIKitBlockInteractionContext,
        read: IRead,
        _http: IHttp,
        _persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        const data = context.getInteractionData();
        const message = await modify
            .getUpdater()
            .message(data.message?.id as string, data.user);
        message.setEditor(message.getSender());
        message.setBlocks(message.getBlocks().slice(0, -1));
        await modify.getUpdater().finish(message);

        return context.getInteractionResponder().successResponse();
    }
}
