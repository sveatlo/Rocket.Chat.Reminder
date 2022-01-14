import {
    RocketChatAssociationModel,
    RocketChatAssociationRecord,
} from "@rocket.chat/apps-engine/definition/metadata";

export const userAssociation = (user: string): RocketChatAssociationRecord => {
    return new RocketChatAssociationRecord(
        RocketChatAssociationModel.USER,
        user
    );
};

export const idAssociation = (id: string): RocketChatAssociationRecord => {
    return new RocketChatAssociationRecord(RocketChatAssociationModel.USER, id);
};

export const modalViewAssociation = (
    viewId: string
): RocketChatAssociationRecord => {
    return new RocketChatAssociationRecord(
        RocketChatAssociationModel.MISC,
        viewId
    );
};
