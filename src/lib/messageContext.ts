import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";

export interface MessageContext {
    room: IRoom;
    threadID?: string;
}
