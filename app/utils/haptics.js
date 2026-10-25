import { Platform } from 'react-native'

let Haptics = null
if (Platform.OS !== 'web') {
  try {
    Haptics = require('expo-haptics')
  } catch {
    Haptics = null
  }
}

export function hapticLight(enabled) {
  if (!enabled || !Haptics) return
  try {
    Haptics.selectionAsync()
  } catch {
    // no-op
  }
}

export function hapticNotify(enabled, type) {
  if (!enabled || !Haptics) return
  try {
    const n = type === 'success' ? Haptics.NotificationFeedbackType.Success
      : type === 'error' ? Haptics.NotificationFeedbackType.Error
      : Haptics.NotificationFeedbackType.Warning
    Haptics.notificationAsync(n)
  } catch {
    // no-op
  }
}
