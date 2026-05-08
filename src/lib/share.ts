export type ShareTarget = 'kakao' | 'sms' | 'share'

export type ShareResult = {
  message: string
  type: 'success' | 'error' | 'info'
}

export function buildShareText(
  childName: string,
  time: string,
  medicine: string,
  doseAmount: number,
  doseMg: number,
  nextDoseTime: string,
): string
export function buildShareText(
  childName: string,
  time: string,
  medicine: string,
  doseAmount: number,
  doseUnitLabel: string,
  doseMg: number,
  nextDoseTime: string,
): string
export function buildShareText(
  childName: string,
  time: string,
  medicine: string,
  doseAmount: number,
  doseUnitOrMg: string | number,
  doseMgOrNextDoseTime: number | string,
  maybeNextDoseTime?: string,
) {
  const doseUnitLabel = typeof doseUnitOrMg === 'string' ? doseUnitOrMg : 'ml'
  const doseMg = typeof doseUnitOrMg === 'string' ? Number(doseMgOrNextDoseTime) : doseUnitOrMg
  const nextDoseTime = typeof doseUnitOrMg === 'string' ? maybeNextDoseTime : String(doseMgOrNextDoseTime)

  return `[투약 기록]
아이: ${childName}
시간: ${time}
약품: ${medicine}
용량: ${doseAmount}${doseUnitLabel} (${doseMg}mg)
다음 투약 가능: ${nextDoseTime}`
}

async function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export async function executeShareTarget(target: ShareTarget, text: string): Promise<ShareResult> {
  if (target === 'share') {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '투약 기록', text })
        return { message: '공유가 완료되었어요', type: 'success' }
      } catch {
        return { message: '공유가 취소되었어요', type: 'info' }
      }
    }

    const copied = await copyText(text)
    return copied
      ? { message: '클립보드에 복사되었어요', type: 'success' }
      : { message: '공유할 수 없어요', type: 'error' }
  }

  if (target === 'sms') {
    window.location.href = `sms:?body=${encodeURIComponent(text)}`
    return { message: '문자 앱을 열었어요', type: 'success' }
  }

  const copied = await copyText(text)
  return copied
    ? { message: '클립보드에 복사되었어요. 카카오톡에 붙여넣기 해주세요', type: 'success' }
    : { message: '공유할 수 없어요. 앱이 설치되어 있는지 확인해주세요.', type: 'error' }
}
