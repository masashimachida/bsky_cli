import type { ScreenId } from './screen-stack.js'

export function getHeaderLabel(screen: ScreenId): string {
  switch (screen.name) {
    case 'login':
      return ''
    case 'timeline':
      return 'Following'
    case 'notifications':
      return 'Notifications'
    case 'thread':
      return 'Thread'
    case 'profile':
      return 'Profile'
    case 'compose':
      return screen.replyTo ? 'Reply' : 'Compose'
    case 'search':
      return 'Search'
    case 'image-view':
      return 'Image'
  }
}
