import type { SearchResults } from './search'
import { invoke } from '@tauri-apps/api/core'
import { indexChats, indexMessages, removeChatFromIndex, search, searchReset } from './search'

vi.mock('@tauri-apps/api/core')

const mockedInvoke = vi.mocked(invoke)

beforeEach(() => {
  mockedInvoke.mockReset()
})

describe('search', () => {
  it('indexMessages passes the items', async () => {
    const items = [
      {
        chatId: 'hb/g1',
        messageId: 'm1',
        senderName: 'Ann',
        body: 'hello',
        sentAtMs: 1,
      },
    ]
    mockedInvoke.mockResolvedValueOnce(null)
    await indexMessages(items)
    expect(mockedInvoke).toHaveBeenCalledWith('index_messages', { items })
  })

  it('indexChats passes the chats', async () => {
    const chats = [
      { chatId: 'hb/g1', name: 'Team' },
    ]
    mockedInvoke.mockResolvedValueOnce(null)
    await indexChats(chats)
    expect(mockedInvoke).toHaveBeenCalledWith('index_chats', { chats })
  })

  it('removeChatFromIndex passes the chat id', async () => {
    mockedInvoke.mockResolvedValueOnce(null)
    await removeChatFromIndex('hb/g1')
    expect(mockedInvoke).toHaveBeenCalledWith('remove_chat', { chatId: 'hb/g1' })
  })

  it('search passes the query and limit and returns the results', async () => {
    const results: SearchResults = {
      chats: [
        { chatId: 'hb/g1', name: 'Team' },
      ],
      messages: [
        {
          chatId: 'hb/g1',
          messageId: 'm1',
          senderName: 'Ann',
          snippet: 'hello',
          sentAtMs: 1,
        },
      ],
    }
    mockedInvoke.mockResolvedValueOnce(results)
    await expect(search('hel', 20)).resolves.toEqual(results)
    expect(mockedInvoke).toHaveBeenCalledWith('search', { query: 'hel', limit: 20 })
  })

  it('searchReset invokes search_reset', async () => {
    mockedInvoke.mockResolvedValueOnce(null)
    await searchReset()
    expect(mockedInvoke).toHaveBeenCalledWith('search_reset', undefined)
  })

  it('wraps a non-GimError rejection as Internal', async () => {
    mockedInvoke.mockRejectedValueOnce('boom')
    await expect(search('x', 1)).rejects.toEqual({
      kind: 'Internal',
      message: 'boom',
      reason: 'boom',
    })
  })
})
