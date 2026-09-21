/**
 * Image utility — client-side compression + Supabase transform URL helpers.
 * All functions are browser-only (no SSR calls).
 */

export interface CompressOptions {
  maxSide?: number
  quality?: number
}

/**
 * Detect WebP encode support via a small canvas probe (cached after first call).
 */
let webpSupported: boolean | null = null
function supportsWebpEncode(): boolean {
  if (webpSupported !== null) return webpSupported
  try {
    const probe = document.createElement("canvas")
    probe.width = 1
    probe.height = 1
    webpSupported = probe.toDataURL("image/webp").startsWith("data:image/webp")
  } catch {
    webpSupported = false
  }
  return webpSupported
}

/**
 * Compress a File or Blob using Canvas API.
 * Prefers WebP when browser supports it, falls back to JPEG.
 * Returns a Blob ready for Supabase Storage upload.
 */
export async function compressToBlob(
  file: File | Blob,
  { maxSide = 1200, quality = 0.82 }: CompressOptions = {}
): Promise<{ blob: Blob; mimeType: string; ext: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > maxSide || height > maxSide) {
        const ratio = Math.min(maxSide / width, maxSide / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      const useWebp = supportsWebpEncode()
      const mimeType = useWebp ? "image/webp" : "image/jpeg"
      const ext = useWebp ? "webp" : "jpg"

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, mimeType, ext })
          } else {
            reject(new Error("Canvas toBlob returned null"))
          }
        },
        mimeType,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Failed to load image for compression"))
    }

    img.src = objectUrl
  })
}

/**
 * Compress a file and return a preview data URL for immediate display.
 * Used in PhotoPicker where we need both a preview and the blob for upload.
 */
export async function compressToDataUrl(
  file: File | Blob,
  opts: CompressOptions = {}
): Promise<{ dataUrl: string; mimeType: string; ext: string }> {
  const { blob, mimeType, ext } = await compressToBlob(file, opts)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ dataUrl: reader.result as string, mimeType, ext })
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Append Supabase Storage image transform query params to a signed URL.
 * Best-effort: if the plan doesn't support transforms, Supabase ignores the params
 * and returns the original image — no breakage.
 *
 * @param signedUrl  The signed URL returned by createSignedUrl()
 * @param width      Desired width in px
 * @param height     Desired height in px (default: same as width for square crops)
 * @param resize     "cover" | "contain" | "fill"
 */
export function buildThumbnailUrl(
  signedUrl: string | null,
  width: number,
  height = width,
  resize: "cover" | "contain" | "fill" = "cover"
): string | null {
  if (!signedUrl) return null
  // Only append to real HTTPS Supabase URLs, not data: or blob:
  if (!signedUrl.startsWith("https://")) return signedUrl
  try {
    const url = new URL(signedUrl)
    // Supabase transform params go in the `transform` path segment or query string.
    // Supabase Storage image transform API uses query params:
    url.searchParams.set("width", String(width))
    url.searchParams.set("height", String(height))
    url.searchParams.set("resize", resize)
    url.searchParams.set("quality", "80")
    return url.toString()
  } catch {
    return signedUrl
  }
}
