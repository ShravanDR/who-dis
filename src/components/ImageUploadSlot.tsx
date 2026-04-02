import { useRef, useState } from 'react'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'
import { cropTo3x4 } from '../lib/imageUtils'

interface ImageUploadSlotProps {
  gameCode: string
  targetId: string
  giverId: string
  slotIndex: 0 | 1 | 2
  currentUrl: string | null
  onUploaded: (url: string) => void
  disabled?: boolean
}

export default function ImageUploadSlot({
  gameCode,
  targetId,
  giverId,
  slotIndex,
  currentUrl,
  onUploaded,
  disabled = false,
}: ImageUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const cropped = await cropTo3x4(file)
      const path = `clues/${gameCode}/${targetId}/${giverId}/${slotIndex}.jpg`
      const sRef = storageRef(storage, path)
      await uploadBytes(sRef, cropped, { contentType: 'image/jpeg' })
      const url = await getDownloadURL(sRef)
      onUploaded(url)
    } catch {
      setError('Upload failed — try again')
    } finally {
      setUploading(false)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Upload clue image ${slotIndex + 1}`}
      className={`relative aspect-[3/4] rounded-card overflow-hidden border-2 transition-all cursor-pointer
        ${currentUrl ? 'border-[#E8E0D4]' : 'border-dashed border-[#D4C9B8]'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent'}
        bg-[#F8F5F0]`}
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) { e.preventDefault(); inputRef.current?.click() } }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={disabled ? undefined : handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || uploading}
      />

      {currentUrl && !uploading && (
        <img src={currentUrl} alt="" className="w-full h-full object-cover" />
      )}

      {uploading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F8F5F0]">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs text-[#888]">Uploading…</span>
        </div>
      )}

      {!currentUrl && !uploading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="text-2xl text-[#9A8E7E]">+</div>
          <span className="text-xs text-[#9A8E7E] font-medium">Clue {slotIndex + 1}</span>
        </div>
      )}

      {currentUrl && !uploading && (
        <div className="absolute bottom-2 right-2 bg-black/40 text-white text-[10px] font-bold rounded px-1.5 py-0.5">
          {slotIndex + 1} ✓
        </div>
      )}

      {error && (
        <div className="absolute bottom-0 left-0 right-0 bg-danger/90 text-white text-[10px] text-center py-1 px-2">
          {error}
        </div>
      )}
    </div>
  )
}
