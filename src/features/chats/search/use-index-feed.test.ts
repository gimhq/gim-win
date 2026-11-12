import type { MessageContent, TimelineItem } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { chatListStore } from '../store'
import { timelineStore } from '../timeline/store'
import { chat } from '../timeline/test-render'
import { startIndexFeed } from './use-index-feed'

const mockedInvoke = vi.mocked(invoke)

function message(messageId: string, content: MessageContent, sentAtMs = 1000): TimelineItem {
  return {
    type: 'Message',
    item: {
      messageId,
      chatId: 'c1',
      sender: {
        userId: 'u-ann',
        displayName: 'Ann',
        hasAvatar: false,
      },
      isOwn: false,
      sentAtMs,
      content,
      replyTo: null,
      reactions: [],
      edited: false,
      sendState: null,
    },
  }
}

function calls(command: string): unknown[] {
  return mockedInvoke.mock.calls.filter(([name]) => name === command).map(([, args]) => args)
}

let stop: () => void

beforeEach(() => {
  vi.useFakeTimers()
  mockedInvoke.mockReset()
  mockedInvoke.mockResolvedValue(null)
  chatListStore.getState().reset()
  timelineStore.setState({ byChat: {} })
  stop = startIndexFeed()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

describe('index feed', () => {
  it('indexes added and renamed chats once', () => {
    chatListStore.getState().applyChatListDiffs([
      {
        type: 'Reset',
        values: [
          chat('c1', { name: 'Team' }),
          chat('c2', { name: 'Ann' }),
        ],
      },
    ])
    expect(calls('index_chats')).toEqual([
      {
        chats: [
          { chatId: 'c1', name: 'Team' },
          { chatId: 'c2', name: 'Ann' },
        ],
      },
    ])

    chatListStore.getState().applyChatListDiffs([
      {
        type: 'Set',
        index: 0,
        value: chat('c1', { name: 'Team', unreadCount: 2 }),
      },
    ])
    chatListStore.getState().applyChatListDiffs([
      {
        type: 'Set',
        index: 1,
        value: chat('c2', { name: 'Ann B.' }),
      },
    ])
    expect(calls('index_chats')).toEqual([
      {
        chats: [
          { chatId: 'c1', name: 'Team' },
          { chatId: 'c2', name: 'Ann' },
        ],
      },
      {
        chats: [
          { chatId: 'c2', name: 'Ann B.' },
        ],
      },
    ])
  })

  it('batches new messages into one call after 500 ms', () => {
    timelineStore.getState().applyTimelineDiffs('c1', [
      {
        type: 'Reset',
        values: [
          message('m1', { type: 'Text', body: 'hello' }, 1000),
        ],
      },
    ])
    timelineStore.getState().applyTimelineDiffs('c1', [
      {
        type: 'PushBack',
        value: message('m2', {
          type: 'File',
          media: {
            chatId: 'c1',
            messageId: 'm2',
            mime: 'application/pdf',
            size: 1,
            hasThumbnail: false,
          },
          fileName: 'report.pdf',
          caption: null,
        }, 2000),
      },
    ])
    vi.advanceTimersByTime(499)
    expect(calls('index_messages')).toEqual([])
    vi.advanceTimersByTime(1)
    expect(calls('index_messages')).toEqual([
      {
        items: [
          {
            chatId: 'c1',
            messageId: 'm1',
            senderName: 'Ann',
            body: 'hello',
            sentAtMs: 1000,
          },
          {
            chatId: 'c1',
            messageId: 'm2',
            senderName: 'Ann',
            body: 'report.pdf',
            sentAtMs: 2000,
          },
        ],
      },
    ])
  })

  it('skips unchanged messages and sends an empty body for a deleted one', () => {
    timelineStore.getState().applyTimelineDiffs('c1', [
      {
        type: 'Reset',
        values: [
          message('m1', { type: 'Text', body: 'hello' }),
        ],
      },
    ])
    vi.advanceTimersByTime(500)
    timelineStore.getState().applyTimelineDiffs('c1', [
      {
        type: 'PushFront',
        value: { type: 'DateSeparator', dayStartMs: 0 },
      },
    ])
    vi.advanceTimersByTime(500)
    expect(calls('index_messages')).toHaveLength(1)

    timelineStore.getState().applyTimelineDiffs('c1', [
      {
        type: 'Set',
        index: 1,
        value: message('m1', { type: 'Deleted' }),
      },
    ])
    vi.advanceTimersByTime(500)
    expect(calls('index_messages')).toEqual([
      {
        items: [
          {
            chatId: 'c1',
            messageId: 'm1',
            senderName: 'Ann',
            body: 'hello',
            sentAtMs: 1000,
          },
        ],
      },
      {
        items: [
          {
            chatId: 'c1',
            messageId: 'm1',
            senderName: 'Ann',
            body: '',
            sentAtMs: 1000,
          },
        ],
      },
    ])
  })

  it('only logs a failed call', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedInvoke.mockRejectedValue('closed')
    timelineStore.getState().applyTimelineDiffs('c1', [
      {
        type: 'Reset',
        values: [
          message('m1', { type: 'Text', body: 'hello' }),
        ],
      },
    ])
    await vi.advanceTimersByTimeAsync(500)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
