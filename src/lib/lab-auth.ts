import { createHash, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

export const LAB_COOKIE_NAME = 'stockforge_lab_session'

function getLabAccessKey(): string {
  return process.env.LAB_ACCESS_KEY?.trim() ?? ''
}

function buildSessionToken(secret: string): string {
  return createHash('sha256').update(`stockforge-lab:${secret}`).digest('hex')
}

export function isLabConfigured(): boolean {
  return getLabAccessKey().length > 0
}

export async function hasLabAccess(): Promise<boolean> {
  const secret = getLabAccessKey()
  if (!secret) return false

  const cookieStore = await cookies()
  const token = cookieStore.get(LAB_COOKIE_NAME)?.value
  if (!token) return false

  const expected = buildSessionToken(secret)
  const actualBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)

  if (actualBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export async function createLabSession(secretAttempt: string): Promise<boolean> {
  const secret = getLabAccessKey()
  if (!secretAttempt || !secret) return false

  const secretBuffer = Buffer.from(secret)
  const attemptBuffer = Buffer.from(secretAttempt)

  if (secretBuffer.length !== attemptBuffer.length) {
    return false
  }

  if (!timingSafeEqual(secretBuffer, attemptBuffer)) {
    return false
  }

  const cookieStore = await cookies()
  cookieStore.set(LAB_COOKIE_NAME, buildSessionToken(secret), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  })

  return true
}

export async function clearLabSession() {
  const cookieStore = await cookies()
  cookieStore.set(LAB_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}
