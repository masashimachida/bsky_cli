// ターミナルの文字セルは正方形ではない(通常 高さ:幅 ≈ 2:1)ため、画像の
// ピクセルアスペクト比をそのまま行数に変換すると縦に潰れる。セルの物理サイズ
// (cellWidth/cellHeight)で補正し、指定した横幅(列数)に対応する行数を計算する。
export function calculateImageHeight(
  widthCols: number,
  aspectRatio: { width: number; height: number } | undefined,
  cellWidth: number,
  cellHeight: number,
  fallbackHeight: number,
  minHeight: number,
  maxHeight: number,
): number {
  if (!aspectRatio || aspectRatio.width <= 0 || aspectRatio.height <= 0) return fallbackHeight
  const raw = Math.round((widthCols * cellWidth * aspectRatio.height) / (aspectRatio.width * cellHeight))
  return Math.min(maxHeight, Math.max(minHeight, raw))
}
