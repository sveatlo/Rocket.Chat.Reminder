import {
    ILogger,
    IRead,
    IModify,
    IPersistence,
    IHttp,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    IProcessor,
    IJobContext,
    StartupType,
} from "@rocket.chat/apps-engine/definition/scheduler/IProcessor";

export class RemindsProcessor implements IProcessor {
    public id: string = "reminder";
    public startupSettings = {
        type: StartupType.ONETIME,
        when: "20 seconds",
        data: {
            test: true,
        },
    };
    private logger: ILogger;

    constructor(logger: ILogger, controller) {
        this.logger = logger;
        this.logger.info("processor created");
    }

    public async processor(
        jobData: IJobContext,
        read: IRead,
        modify: IModify,
        _http: IHttp,
        _persis: IPersistence
    ): Promise<void> {
        // TODO: this is null for some reason...
        const { user, room, threadID, message } = jobData;

        const notifyMessageBuilder = modify
            .getCreator()
            .startMessage()
            .setRoom(room)
            .setSender((await read.getUserReader().getAppUser()) || user);
        if (threadID) {
            notifyMessageBuilder.setThreadId(threadID);
        }

        // const blockBuilder = modify.getCreator().getBlockBuilder();
        // const snoozeButton = blockBuilder.newStaticSelectElement({
        //     placeholder: blockBuilder.newPlainTextObject("Snooze"),
        //     options: [
        //         {
        //             value: "10min",
        //             text: blockBuilder.newPlainTextObject("10 minutes"),
        //         },
        //         {
        //             value: "30min",
        //             text: blockBuilder.newPlainTextObject("30 minutes"),
        //         },
        //     ],
        // });
        // const actionsBlock = blockBuilder.addActionsBlock({
        //     blockId: "reminder_msg_actions",
        //     elements: [snoozeButton],
        // });
        // notifyMessageBuilder.addBlocks(actionsBlock);

        if (message) {
            notifyMessageBuilder.setText(
                `Hey there! Reminding you about "${message}" ;)`
            );
        } else {
            notifyMessageBuilder.setText(
                `Hey there! This is a quick reminder to look back here ;)`
            );
        }

        modify
            .getNotifier()
            .notifyUser(user, notifyMessageBuilder.getMessage());
    }
}
