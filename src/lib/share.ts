export type ShareTarget = 'kakao' | 'sms' | 'share'

export type ShareResult = 'shared' | 'copied' | 'sms' | 'cancelled' | 'failed'

export function buildShareText(
  childName: string,
  time: string,
  medicine: string,
  doseMl: number,
  doseMg: number,
  nextDoseTime: string
) {
  return `[투약 기록]
아이: ${childName}
시간: ${time}
약품: ${medicine}
용량: ${doseMl}ml (${doseMg}mg)
다음 투약 가능: ${nextDoseTime}`
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function copyToClipboard(text: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is not available')
  }
  await navigator.clipboard.writeText(text)
}

export async function executeShareTarget(target: ShareTarget, text: string): Promise<ShareResult> {
  if (target === 'share') {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '투약 기록', text })
        return 'shared'
      } catch (error) {
        return isAbortError(error) ? 'cancelled' : 'failed'
      }
    }

    try {
      await copyToClipboard(text)
      return 'copied'
    } catch {
      return 'failed'
    }
  }

  if (target === 'sms') {
    window.location.href = `sms:?body=${encodeURIComponent(text)}`
    return 'sms'
  }

  try {
    await copyToClipboard(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
