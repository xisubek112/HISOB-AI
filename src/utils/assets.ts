/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import defaultUserAvatar from '../assets/images/avatar_user_profile_1794280921902.jpg';

export const LEGACY_DEFAULT_AVATAR_PATH = '/src/assets/images/avatar_user_profile_1794280921902.jpg';
export const DEFAULT_AVATAR_URL: string = defaultUserAvatar;

export function resolveAvatarUrl(avatarUrl?: string | null): string {
  const clean = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  if (!clean || clean === LEGACY_DEFAULT_AVATAR_PATH) {
    return DEFAULT_AVATAR_URL;
  }
  return clean;
}

export function isDefaultAvatar(avatarUrl?: string | null): boolean {
  const clean = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  return !clean || clean === DEFAULT_AVATAR_URL || clean === LEGACY_DEFAULT_AVATAR_PATH;
}
