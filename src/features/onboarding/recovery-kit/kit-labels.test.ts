import { i18n } from '@/i18n'
import { kitLabels } from './kit-labels'

// The Rust round-trip tests of format/parse_recovery_kit use the same strings.
describe('kit labels', () => {
  it.each([
    [
      'en',
      'gim recovery kit',
      'Account ID',
      'Recovery key',
      'Keep this secret. Anyone who has it can get into your account. Lost all your devices? Open gim, choose “Restore with your recovery kit” and paste this text.',
    ],
    [
      'zh-CN',
      'gim 恢复工具包',
      '账号 ID',
      '恢复密钥',
      '请保密。任何拿到它的人都能进入你的账号。所有设备都丢了？打开 gim，选择“用恢复工具包恢复”，然后粘贴这段文字。',
    ],
    [
      'zh-TW',
      'gim 復原工具包',
      '帳號 ID',
      '復原金鑰',
      '請保密。任何拿到它的人都能進入你的帳號。所有裝置都遺失了？打開 gim，選擇「用復原工具包復原」，然後貼上這段文字。',
    ],
    [
      'es',
      'Kit de recuperación de gim',
      'ID de cuenta',
      'Clave de recuperación',
      'Mantenlo en secreto. Cualquiera que lo tenga puede entrar en tu cuenta. ¿Perdiste todos tus dispositivos? Abre gim, elige “Restaurar con tu kit de recuperación” y pega este texto.',
    ],
  ])('has the exact %s labels', (language, title, accountId, recoveryKey, note) => {
    expect(kitLabels(i18n.getFixedT(language, 'onboarding'))).toEqual({ title, accountId, recoveryKey, note })
  })
})
