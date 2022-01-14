import { v4 as uuidv4 } from "uuid";

import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { IMessage } from "@rocket.chat/apps-engine/definition/messages";
import * as sherlock from "sherlockjs";

export enum ReminderType {
    GENERIC = "generic", // e.g. /remind foobar
    ACTION = "action", // e.g. /remind to fuck
    MESSAGE = "message", // remind about some message, i.e. reminder from message action button
}

export class Reminder {
    public id: string; // TODO: once the date setting is fixed, this should be readonly
    public recordID?: string;
    public when: Date;

    constructor(
        public type: ReminderType,
        public user: IUser, // who to remind
        when: Date | string,
        public subject: string, // what to remind
        public completed: boolean,
        public message?: IMessage, // optional linked message if created via button
        public jobID?: string
    ) {
        this.id = uuidv4();

        if (typeof when === "string") {
            const {
                startDate,
            }: {
                startDate?: Date;
            } = sherlock.parse(when);

            if (!startDate) {
                throw new Error(
                    "invalid date (`when`) in Reminder constructor"
                );
            }

            this.when = startDate;
        } else {
            this.when = when;
        }
    }
}
