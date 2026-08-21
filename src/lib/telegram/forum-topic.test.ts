import { describe, expect, it } from "vitest";
import {
  TELEGRAM_GENERAL_TOPIC_ID,
  topicFromTelegramMessage,
  topicsFromTelegramUpdate,
  mergeForumTopics,
  pickPreferredForumThreadId,
  applyPreferredForumTopicSelection,
} from "./forum-topic";

describe("topicFromTelegramMessage", () => {
  it("reads forum_topic_created", () => {
    expect(
      topicFromTelegramMessage({
        message_id: 88,
        message_thread_id: 88,
        chat: { id: -100111, type: "supergroup" },
        forum_topic_created: { name: "YouTube" },
      })
    ).toEqual({
      chatId: "-100111",
      topic: { threadId: 88, name: "YouTube" },
    });
  });

  it("reads topic name from reply_to_message", () => {
    expect(
      topicFromTelegramMessage({
        message_thread_id: 88,
        is_topic_message: true,
        chat: { id: -100111, type: "supergroup" },
        reply_to_message: { forum_topic_created: { name: "YouTube" } },
      })?.topic.name
    ).toBe("YouTube");
  });

  it("reads a tagged message in a forum topic without is_topic_message", () => {
    expect(
      topicFromTelegramMessage({
        message_thread_id: 42,
        chat: { id: -100111, type: "supergroup" },
        reply_to_message: { forum_topic_created: { name: "videolar" } },
        text: "@ramizgonderibot",
      })
    ).toEqual({
      chatId: "-100111",
      topic: { threadId: 42, name: "videolar" },
    });
  });

  it("ignores private chats", () => {
    expect(
      topicFromTelegramMessage({
        message_thread_id: 3,
        is_topic_message: true,
        chat: { id: 555, type: "private" },
      })
    ).toBeNull();
  });
});

describe("topicsFromTelegramUpdate", () => {
  it("collects topics from messages", () => {
    const hits = topicsFromTelegramUpdate({
      message: {
        message_thread_id: TELEGRAM_GENERAL_TOPIC_ID,
        chat: { id: -100111, type: "supergroup" },
      },
    });
    expect(hits).toEqual([
      { chatId: "-100111", topic: { threadId: 1, name: "General" } },
    ]);
  });
});

describe("pickPreferredForumThreadId", () => {
  const topics = [
    { threadId: 1, name: "General" },
    { threadId: 42, name: "videolar" },
    { threadId: 88, name: "YouTube" },
  ];

  it("selects videolar by name", () => {
    expect(pickPreferredForumThreadId(topics, null)).toBe(42);
    expect(pickPreferredForumThreadId(topics, 1)).toBe(42);
  });

  it("keeps a non-general selection when videolar is missing", () => {
    expect(
      pickPreferredForumThreadId(
        [
          { threadId: 1, name: "General" },
          { threadId: 88, name: "YouTube" },
        ],
        88
      )
    ).toBe(88);
  });

  it("picks the only non-general topic", () => {
    expect(
      pickPreferredForumThreadId(
        [
          { threadId: 1, name: "General" },
          { threadId: 9, name: "Topic 9" },
        ],
        null
      )
    ).toBe(9);
  });
});

describe("applyPreferredForumTopicSelection", () => {
  it("sets selectedThreadId to videolar", () => {
    const next = applyPreferredForumTopicSelection([
      {
        id: "-100",
        topics: [
          { threadId: 1, name: "General" },
          { threadId: 42, name: "Videolar" },
        ],
      },
    ]);
    expect(next[0]?.selectedThreadId).toBe(42);
  });
});

describe("mergeForumTopics", () => {
  it("keeps a real name over a placeholder", () => {
    expect(
      mergeForumTopics(
        [{ threadId: 88, name: "Topic 88" }],
        [{ threadId: 88, name: "Reels" }]
      )
    ).toEqual([{ threadId: 88, name: "Reels" }]);
  });
});
