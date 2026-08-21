import { describe, expect, it } from "vitest";
import {
  groupsFromTelegramUpdate,
  isTelegramGroupChatId,
  mergeTelegramGroups,
  telegramTargetChatIds,
} from "./group-chat";

describe("isTelegramGroupChatId", () => {
  it("accepts negative supergroup ids", () => {
    expect(isTelegramGroupChatId("-1001234567890")).toBe(true);
    expect(isTelegramGroupChatId(-987654)).toBe(true);
  });

  it("rejects personal and bot ids", () => {
    expect(isTelegramGroupChatId("8861342974")).toBe(false);
    expect(isTelegramGroupChatId("123456789")).toBe(false);
  });
});

describe("groupsFromTelegramUpdate", () => {
  it("reads my_chat_member when bot joins a group", () => {
    const { added } = groupsFromTelegramUpdate({
      my_chat_member: {
        chat: { id: -100111, title: "İçerik", type: "supergroup" },
        new_chat_member: { status: "member" },
      },
    });
    expect(added).toEqual([{ id: "-100111", title: "İçerik", type: "supergroup" }]);
  });

  it("ignores private user chats", () => {
    const { added } = groupsFromTelegramUpdate({
      message: { chat: { id: 555, type: "private", title: "Orkun" } },
    });
    expect(added).toEqual([]);
  });

  it("ignores channels", () => {
    const { added } = groupsFromTelegramUpdate({
      channel_post: { chat: { id: -100999, title: "Kanal", type: "channel" } },
    });
    expect(added).toEqual([]);
  });

  it("marks kicked bot as removed", () => {
    const { added, removedIds } = groupsFromTelegramUpdate({
      my_chat_member: {
        chat: { id: -100111, title: "İçerik", type: "supergroup" },
        new_chat_member: { status: "kicked" },
      },
    });
    expect(added).toEqual([]);
    expect(removedIds).toEqual(["-100111"]);
  });
});

describe("mergeTelegramGroups", () => {
  it("drops removed groups", () => {
    const next = mergeTelegramGroups(
      [{ id: "-1", title: "A", type: "group" }],
      [],
      ["-1"]
    );
    expect(next).toEqual([]);
  });

  it("merges forum topics without dropping selection", () => {
    const next = mergeTelegramGroups(
      [
        {
          id: "-100111",
          title: "İçerik",
          type: "supergroup",
          isForum: true,
          selectedThreadId: 88,
          topics: [{ threadId: 1, name: "General" }],
        },
      ],
      [
        {
          id: "-100111",
          title: "İçerik",
          type: "supergroup",
          topics: [{ threadId: 88, name: "YouTube" }],
        },
      ]
    );
    expect(next[0]?.selectedThreadId).toBe(88);
    expect(next[0]?.topics?.map((t) => t.threadId)).toEqual([1, 88]);
  });
});

describe("telegramTargetChatIds", () => {
  it("uses saved groups and ignores personal ids", () => {
    const ids = telegramTargetChatIds({
      groups: [{ id: "-100111", title: "İçerik", type: "supergroup" }],
      chatId: "8861342974",
    });
    expect(ids).toEqual(["-100111"]);
  });

  it("includes a negative chatId that is not yet in groups", () => {
    const ids = telegramTargetChatIds({ groups: [], chatId: "-100222" });
    expect(ids).toEqual(["-100222"]);
  });
});
