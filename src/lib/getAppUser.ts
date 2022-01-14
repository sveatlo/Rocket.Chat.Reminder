import { IRead } from "@rocket.chat/apps-engine/definition/accessors";
import { IUser } from "@rocket.chat/apps-engine/definition/users";

export const getAppUser = async (
    read: IRead,
    fallback: IUser
): Promise<IUser> => {
    return (await read.getUserReader().getAppUser()) || fallback;
};
