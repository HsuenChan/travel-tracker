/**
 * WebGL 可用性檢查。
 *
 * 單獨一個檔案，這樣 /passport 可以在「要不要載入 3D 書本」之前就問出答案，而不必為了問這件事
 * 先把 three 拉進主 bundle。
 */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}
