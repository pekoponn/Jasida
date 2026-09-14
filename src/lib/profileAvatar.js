import avatar1 from '../assets/avatars/avatar-1.png';
import avatar2 from '../assets/avatars/avatar-2.png';
import avatar3 from '../assets/avatars/avatar-3.png';
import avatar4 from '../assets/avatars/avatar-4.png';
import avatar5 from '../assets/avatars/avatar-5.png';
import avatar6 from '../assets/avatars/avatar-6.png';
import avatar7 from '../assets/avatars/avatar-7.png';
import avatar8 from '../assets/avatars/avatar-8.png';
import avatar9 from '../assets/avatars/avatar-9.png';

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7, avatar8, avatar9];
export function withResolvedAvatar(profile) {
  const match = profile?.avatar_url?.match(
    /^\/(?:src\/assets\/avatars|assets)\/avatar-([1-9])(?:-[A-Za-z0-9_-]+)?\.png(?:[?#].*)?$/
  );
  if (!match) return profile;
  return { ...profile, avatar_url: avatars[Number(match[1]) - 1] };
}
