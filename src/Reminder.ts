import { v4 as uuidv4 } from "uuid";

import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { IMessage } from "@rocket.chat/apps-engine/definition/messages";

export enum ReminderType {
    GENERIC = "generic", // e.g. /remind foobar
    ACTION = "action", // e.g. /remind to fuck
    MESSAGE = "message", // remind about some message, i.e. reminder from message action button
}

export class Reminder {
    public readonly id: string;
    constructor(
        public type: ReminderType,
        public user: IUser, // who to remind
        public when: Date,
        public subject: string, // what to remind
        public completed: boolean,
        public message?: IMessage // optional linked message if created via button
    ) {
        this.id = uuidv4();
    }
}
