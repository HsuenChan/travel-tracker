/** 封面顯示位置存在圖片 URL 的 `#pos=NN`（0-100，垂直 %）後綴 */
export function parseCoverPos(url: string): { clean: string; pos: number } {
  const m = url.match(/#pos=(\d+)$/);
  return m ? { clean: url.replace(/#pos=\d+$/, ""), pos: Number(m[1]) } : { clean: url, pos: 50 };
}

export function withCoverPos(url: string, pos: number): string {
  const clean = url.replace(/#pos=\d+$/, "");
  return pos === 50 ? clean : `${clean}#pos=${pos}`;
}
