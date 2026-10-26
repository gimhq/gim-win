import { isAllowedServerUrl } from './server-url'

describe('isAllowedServerUrl', () => {
  it.each([
    'https://hub.example.org',
    'https://hub.example.org/base?x#y',
    'https://user:pw@hub.example.org:1/',
    'https://203.0.113.5',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://10.1.2.3',
    'http://172.16.0.1',
    'http://172.31.255.255',
    'http://192.168.1.20:3000/',
    'http://169.254.1.1',
    'http://[::1]:8080',
    'http://[fd12::1]',
    'http://[fe80::1]',
    'http://hub.local',
    'http://nas.lan:8080',
    'http://ai-agent-gim-hub-win:3000',
  ])('accepts %s', (url) => {
    expect(isAllowedServerUrl(url)).toBe(true)
  })

  it.each([
    '',
    'hub.example.org',
    'ftp://hub.example.org',
    'http://',
    'https:///path',
    'http://:8080',
    'http://a b',
    'file:///tmp/x',
    'http://hub.example.org',
    'http://203.0.113.5',
    'http://172.32.0.1',
    'http://[2001:db8::1]',
    'http://local.example.org',
  ])('rejects %s', (url) => {
    expect(isAllowedServerUrl(url)).toBe(false)
  })
})
