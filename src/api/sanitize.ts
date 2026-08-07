// 他ユーザーが投稿したテキスト(displayName/本文/altなど)は公式アプリを介さず直接XRPCで
// 作成されうるため、バイト列に制限がない。制御文字(ESC等)を含んだままInkの<Text>に渡すと
// ANSI/OSCエスケープシーケンスとして端末に解釈され、表示偽装やクリップボード書き換え等に
// 使われうるため、表示・実行の両方に使う前に必ず通す。
const CONTROL_CHARS_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g

export function sanitizeText(text: string): string {
  return text.replace(CONTROL_CHARS_PATTERN, '')
}

export function isSafeExternalUrl(uri: string): boolean {
  try {
    const url = new URL(uri)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
