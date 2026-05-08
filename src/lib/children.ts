import type { Child } from '@/contexts/AppContext'

export type ChildGender = 'male' | 'female'

export const CHILD_AVATAR_OPTIONS: Record<ChildGender, string> = {
  male: '/child-avatar-1.svg',
  female: '/child-avatar-2.svg',
}

export function getDefaultChildAvatar(gender: ChildGender) {
  return CHILD_AVATAR_OPTIONS[gender]
}

export function inferChildGender(child: Pick<Child, 'avatar' | 'gender'>): ChildGender {
  if (child.gender === 'female' || child.gender === 'male') return child.gender
  return child.avatar.includes('child-avatar-2') ? 'female' : 'male'
}

export function isDefaultChildAvatar(avatar: string) {
  return Object.values(CHILD_AVATAR_OPTIONS).includes(avatar)
}

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
