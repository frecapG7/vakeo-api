import Message from "../models/messageModel.mjs";
import { ALLOWED_REACTIONS, addReaction, removeReaction } from "./messageService.mjs";
import { InvalidError } from "../utils/errors.mjs";

describe("messageModel — reactions schema", () => {
    test("schema has a reactions array of subdocs", () => {
        const reactions = Message.schema.path("reactions");
        expect(reactions).toBeDefined();
        expect(reactions.instance).toBe("Array");
    });

    test("reaction subdoc has required emoji and users array", () => {
        expect(Message.schema.path("reactions.emoji")).toBeDefined();
        expect(Message.schema.path("reactions.emoji").instance).toBe("String");
        expect(Message.schema.path("reactions.emoji").options.required).toBe(true);
        expect(Message.schema.path("reactions.users")).toBeDefined();
        expect(Message.schema.path("reactions.users").instance).toBe("Array");
    });
});

describe("messageService — reactions whitelist", () => {
    test("whitelist holds exactly the five standard emojis", () => {
        expect(ALLOWED_REACTIONS).toEqual([
            "\u{1F44D}", // thumbs up
            "\u{1F44E}", // thumbs down
            "\u{2764}\u{FE0F}", // red heart
            "\u{1F602}", // face with tears of joy
            "\u{1F622}" // crying face
        ]);
    });

    test("addReaction rejects emojis outside the whitelist (422)", async () => {
        await expect(addReaction("trip123", "msg1", "user1", "\u{1F419}"))
            .rejects.toThrow(InvalidError);
    });

    test("removeReaction rejects emojis outside the whitelist (422)", async () => {
        await expect(removeReaction("trip123", "msg1", "user1", "\u{1F419}"))
            .rejects.toThrow(InvalidError);
    });
});

/**
 * DB-backed reaction flows (add/remove against MongoDB, including the
 * concurrent first-reaction race) require a live connection and are
 * verified via manual/integration testing, not unit tests — see docs/v3-notes.md.
 */