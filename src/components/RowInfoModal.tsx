import { useState, useEffect, useRef } from "react"
import QrScanner from "qr-scanner"
import { Plus, Trash2, QrCode, ExternalLink, Pencil, Link2, ImageUp, X, ScanLine, CheckCircle2, Loader2, AlertCircle, Check, Camera } from "lucide-react"
import { toast } from "sonner"
import "lightgallery/css/lightgallery.css"
import "lightgallery/css/lg-zoom.css"
import "lightgallery/css/lg-thumbnail.css"
import noImageSrc from "../../icon/noimage.jpeg"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface DeliveryPoint {
  code: string
  name: string
  delivery: "Daily" | "Weekday" | "Alt 1" | "Alt 2"
  latitude: number
  longitude: number
  descriptions: { key: string; value: string }[]
  qrCodeImageUrl?: string
  qrCodeDestinationUrl?: string
  avatarImageUrl?: string
  avatarImages?: string[]
}

interface RowInfoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  point: DeliveryPoint
  isEditMode: boolean
  onSave?: (updated: DeliveryPoint) => void
}

const DELIVERY_COLORS: Record<string, string> = {
  Daily:   "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
  Weekday: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  "Alt 1": "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
  "Alt 2": "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
}

export function RowInfoModal({ open, onOpenChange, point, isEditMode, onSave }: RowInfoModalProps) {
  const [drafts, setDrafts] = useState<{ key: string; value: string }[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState("")
  const [qrCodeDestinationUrl, setQrCodeDestinationUrl] = useState("")
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [qrTab, setQrTab] = useState<"url" | "media">("url")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // PrimeReact Toast refs
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)

  // Avatar image state
  const [avatarImageUrl, setAvatarImageUrl] = useState("") // selected display image
  const [avatarImages, setAvatarImages] = useState<string[]>([]) // all uploaded images
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  // Dialog draft state
  const [dialogImages, setDialogImages] = useState<string[]>([])
  const [dialogSelected, setDialogSelected] = useState("")
  const [avatarTab, setAvatarTab] = useState<"url" | "upload">("url")
  const [avatarUrlInput, setAvatarUrlInput] = useState("")
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const avatarGalleryRef = useRef<HTMLDivElement>(null)
  const avatarLGInstance = useRef<any>(null)

  useEffect(() => {
    if (open) {
      setDrafts(point.descriptions ?? [])
      setQrCodeImageUrl(point.qrCodeImageUrl ?? "")
      setQrCodeDestinationUrl(point.qrCodeDestinationUrl ?? "")
      const imgs = point.avatarImages ?? (point.avatarImageUrl ? [point.avatarImageUrl] : [])
      setAvatarImages(imgs)
      setAvatarImageUrl(point.avatarImageUrl ?? (imgs[0] ?? ""))
      setIsEditing(false)
    }
  }, [open, point])

  // Init lightGallery for avatar (view mode only)
  useEffect(() => {
    if (!open || avatarImages.length === 0 || isEditMode) {
      if (avatarLGInstance.current) {
        avatarLGInstance.current.destroy()
        avatarLGInstance.current = null
      }
      return
    }
    const init = async () => {
      await new Promise(r => setTimeout(r, 150))
      if (!avatarGalleryRef.current) return
      const { default: lightGallery } = await import('lightgallery')
      const { default: lgZoom } = await import('lightgallery/plugins/zoom')
      if (avatarLGInstance.current) {
        avatarLGInstance.current.destroy()
        avatarLGInstance.current = null
      }
      const { default: lgThumbnail } = await import('lightgallery/plugins/thumbnail')
      avatarLGInstance.current = lightGallery(avatarGalleryRef.current, {
        plugins: [lgZoom, lgThumbnail],
        speed: 300,
        download: false,
        thumbnail: true,
      })
    }
    init()
    return () => {
      if (avatarLGInstance.current) {
        avatarLGInstance.current.destroy()
        avatarLGInstance.current = null
      }
    }
  }, [open, avatarImages, isEditMode])

  const openAvatarGallery = () => {
    if (!avatarLGInstance.current || avatarImages.length === 0) return
    const idx = avatarImages.indexOf(avatarImageUrl)
    avatarLGInstance.current.openGallery(idx >= 0 ? idx : 0)
  }

  const uploadToImgBB = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("image", file)
    const res = await fetch(`https://api.imgbb.com/1/upload?key=4042c537845e8b19b443add46f4a859c`, {
      method: "POST",
      body: formData,
    })
    const data = await res.json()
    if (!data.success) throw new Error("Upload failed")
    return data.data.url as string
  }

  const [scannedUrl, setScannedUrl] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [qrDecodeStatus, setQrDecodeStatus] = useState<"idle" | "decoding" | "decoded" | "failed">("idle")

  // Decode QR code from a data URL or Blob using qr-scanner
  const decodeQrFromSource = async (source: string | Blob): Promise<string | null> => {
    try {
      const result = await QrScanner.scanImage(source, { returnDetailedScanResult: true })
      return result.data ?? null
    } catch {
      return null
    }
  }

  // Scan QR image in view mode: fetch via proxy if remote URL, then decode
  const handleScanQr = async () => {
    if (!qrCodeImageUrl) return
    setIsScanning(true)
    // Minimum animation duration
    await new Promise(resolve => setTimeout(resolve, 800))
    try {
      let source: string | Blob = qrCodeImageUrl
      if (qrCodeImageUrl.startsWith("http")) {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(qrCodeImageUrl)}`
        const response = await fetch(proxyUrl)
        if (response.ok) {
          source = await response.blob()
        }
      }
      const decoded = await decodeQrFromSource(source)
      setIsScanning(false)
      if (decoded) {
        setScannedUrl(decoded)
      } else {
        // fallback to stored destination URL
        setScannedUrl(qrCodeDestinationUrl ?? "")
      }
    } catch {
      setIsScanning(false)
      setScannedUrl(qrCodeDestinationUrl ?? "")
    }
  }

  const hasCoords = point.latitude !== 0 && point.longitude !== 0

  const handleAdd = () => setDrafts(prev => [...prev, { key: "", value: "" }])
  const handleRemove = (i: number) => setDrafts(prev => prev.filter((_, idx) => idx !== i))
  const handleChange = (i: number, field: "key" | "value", val: string) =>
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d))

  const handleSave = () => {
    try {
      onSave?.({ ...point, descriptions: drafts.filter(d => d.key.trim() !== ""), qrCodeImageUrl, qrCodeDestinationUrl, avatarImageUrl, avatarImages })
      setIsEditing(false)
      toast.success("Changes saved", {
        description: `${point.name || point.code} updated successfully.`,
        icon: <CheckCircle2 className="size-4 text-primary" />,
        duration: 3000,
      })
    } catch {
      toast.error("Failed to save", {
        description: "Please try again.",
        icon: <AlertCircle className="size-4" />,
        duration: 4000,
      })
    }
  }

  const handleCancel = () => {
    setDrafts(point.descriptions ?? [])
    setIsEditing(false)
  }

  const gmapsUrl = `https://maps.google.com/?q=${point.latitude},${point.longitude}`
  const wazeUrl = `https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes`
  const familyMartUrl = `https://fmvending.web.app/refill-service/M${String(point.code).padStart(4, "0")}`

  const openUrl = (url: string) => setPendingUrl(url)
  const confirmOpen = () => {
    if (pendingUrl) {
      window.open(pendingUrl, "_blank")
      setPendingUrl(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0 border-border">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            {/* Avatar: multi-image gallery / camera-slash placeholder */}
            {isEditMode ? (
              <button
                onClick={() => {
                  setDialogImages([...avatarImages])
                  setDialogSelected(avatarImageUrl)
                  setAvatarUrlInput("")
                  setAvatarTab("url")
                  setShowAvatarDialog(true)
                }}
                className="w-11 h-11 rounded-full overflow-hidden shrink-0 shadow relative group focus:outline-none"
              >
                {avatarImageUrl ? (
                  <img src={avatarImageUrl} alt={point.name} className="w-full h-full object-cover" />
                ) : (
                  <img src={noImageSrc} alt="No image" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="size-4 text-white" />
                </div>
              </button>
            ) : (
              avatarImages.length > 0 ? (
                <>
                  {/* Hidden lightgallery container with all images */}
                  <div ref={avatarGalleryRef} className="hidden">
                    {avatarImages.map((url, i) => (
                      <a key={i} href={url} data-sub-html={`<h4>${point.name}</h4>`}>
                        <img src={url} alt={point.name} />
                      </a>
                    ))}
                  </div>
                  <button
                    onClick={openAvatarGallery}
                    className="w-11 h-11 rounded-full overflow-hidden shrink-0 shadow cursor-zoom-in focus:outline-none"
                  >
                    <img src={avatarImageUrl || avatarImages[0]} alt={point.name} className="w-full h-full object-cover" />
                  </button>
                </>
              ) : (
                <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 shadow">
                  <img src={noImageSrc} alt="No image" className="w-full h-full object-cover" />
                </div>
              )
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold text-foreground truncate">
                {point.name}
              </DialogTitle>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${DELIVERY_COLORS[point.delivery] ?? ""}`}>
                  {point.delivery}
                </span>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {point.code}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 bg-background">
          {/* Information section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Information</p>
              {isEditMode && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-0.5 rounded-md hover:bg-primary/10 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                {drafts.map((d, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="Key"
                      value={d.key}
                      onChange={e => handleChange(i, "key", e.target.value)}
                      className="w-28 h-8 text-sm"
                    />
                    <Input
                      placeholder="Value"
                      value={d.value}
                      onChange={e => handleChange(i, "value", e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <button
                      onClick={() => handleRemove(i)}
                      className="text-red-400 hover:text-red-600 shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium mt-1"
                >
                  <Plus className="size-3.5" />
                  Add field
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {drafts && drafts.length > 0 ? (
                  drafts.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-0 border-b border-border last:border-0"
                    >
                      <span className="w-[90px] shrink-0 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2.5 bg-muted/50 border-r border-border truncate">
                        {d.key}
                      </span>
                      <span className="flex-1 text-sm text-foreground px-3 py-2.5">
                        {d.value}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-5">No information added</p>
                )}
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          {!isEditing && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">Open With</p>
              <div className="flex gap-2 flex-wrap">
                {hasCoords && (
                  <>
                    <button
                      onClick={() => openUrl(gmapsUrl)}
                      title="Google Maps"
                      className="flex flex-col items-center gap-1.5 group flex-1 min-w-[60px]"
                    >
                      <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-sm group-hover:shadow-md transition-all group-hover:scale-105 border border-border/40">
                        <img src="/Gmaps.png" alt="Google Maps" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">Maps</span>
                    </button>
                    <button
                      onClick={() => openUrl(wazeUrl)}
                      title="Waze"
                      className="flex flex-col items-center gap-1.5 group flex-1 min-w-[60px]"
                    >
                      <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-sm group-hover:shadow-md transition-all group-hover:scale-105 border border-border/40">
                        <img src="/waze.png" alt="Waze" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">Waze</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => openUrl(familyMartUrl)}
                  title="FamilyMart"
                  className="flex flex-col items-center gap-1.5 group flex-1 min-w-[60px]"
                >
                  <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-sm group-hover:shadow-md transition-all group-hover:scale-105 border border-border/40">
                    <img src="/FamilyMart.png" alt="FamilyMart" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">FM</span>
                </button>

                {/* QR Code Button */}
                {(qrCodeImageUrl || isEditMode) && (
                  <button
                    onClick={() => {
                      if (isEditMode) {
                        setShowQRDialog(true)
                      } else {
                        handleScanQr()
                      }
                    }}
                    disabled={isScanning}
                    title={isEditMode ? (qrCodeImageUrl ? "Edit QR Code" : "Add QR Code") : "Scan QR Code"}
                    className="flex flex-col items-center gap-1.5 group flex-1 min-w-[60px] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <div className="relative w-11 h-11 rounded-2xl bg-orange-500 hover:bg-orange-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all group-hover:scale-105">
                      {isScanning ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <QrCode className="w-5 h-5 text-white" />
                      )}
                      {isEditMode && !isScanning && (
                        <span className="absolute -top-1 -right-1 bg-background rounded-full p-0.5">
                          {qrCodeImageUrl
                            ? <Pencil className="w-2.5 h-2.5" />
                            : <Plus className="w-2.5 h-2.5" />}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {isScanning ? "Scanning…" : "QR"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Avatar Gallery Dialog */}
          <Dialog open={showAvatarDialog} onOpenChange={(o) => { if (!o) { setAvatarTab("url"); setAvatarUrlInput("") } setShowAvatarDialog(o) }}>
            <DialogContent className="max-w-sm rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base">Avatar Images</DialogTitle>
                <DialogDescription>Manage avatar images. Click an image to set it as display.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Image grid */}
                <div className="grid grid-cols-4 gap-2">
                  {dialogImages.map((url, i) => (
                    <div key={i} className="relative group">
                      <button
                        onClick={() => setDialogSelected(url)}
                        className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          dialogSelected === url
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-transparent hover:border-primary/40"
                        }`}
                      >
                        <img src={url} alt={`avatar-${i}`} className="w-full h-full object-cover" />
                      </button>
                      {/* Selected badge */}
                      {dialogSelected === url && (
                        <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5 pointer-events-none">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                      {/* Delete button */}
                      <button
                        onClick={() => {
                          const next = dialogImages.filter((_, idx) => idx !== i)
                          setDialogImages(next)
                          if (dialogSelected === url) setDialogSelected(next[0] ?? "")
                        }}
                        className="absolute -bottom-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  {/* Add slot */}
                  {dialogImages.length < 8 && (
                    <div className="w-full aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                      <Plus className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {dialogImages.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-1">No images yet. Add one below.</p>
                )}

                {/* Add new image */}
                {dialogImages.length < 8 && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Add Image</p>
                    {/* Tabs */}
                    <div className="flex rounded-lg border overflow-hidden">
                      {(["url", "upload"] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setAvatarTab(tab)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold transition-colors ${
                            avatarTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                          }`}
                        >
                          {tab === "url" ? <><Link2 className="w-3 h-3" />URL</> : <><ImageUp className="w-3 h-3" />Upload</>}
                        </button>
                      ))}
                    </div>
                    {avatarTab === "url" && (
                      <div className="flex gap-2">
                        <Input
                          value={avatarUrlInput}
                          onChange={e => setAvatarUrlInput(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="h-8 text-sm flex-1"
                        />
                        <Button
                          size="sm"
                          className="h-8 shrink-0"
                          disabled={!avatarUrlInput.trim()}
                          onClick={() => {
                            const url = avatarUrlInput.trim()
                            if (!url) return
                            const next = [...dialogImages, url]
                            setDialogImages(next)
                            if (!dialogSelected) setDialogSelected(url)
                            setAvatarUrlInput("")
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    {avatarTab === "upload" && (
                      <>
                        <div
                          onClick={() => !avatarUploading && avatarFileRef.current?.click()}
                          className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                        >
                          {avatarUploading ? (
                            <><Loader2 className="w-4 h-4 text-muted-foreground animate-spin" /><p className="text-xs text-muted-foreground">Uploading…</p></>
                          ) : (
                            <><ImageUp className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Click to select image</p></>
                          )}
                        </div>
                        <input
                          ref={avatarFileRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async e => {
                            const files = Array.from(e.target.files ?? [])
                            if (!files.length) return
                            setAvatarUploading(true)
                            const uploadToastId = toast.loading(
                              `Uploading ${files.length} image${files.length > 1 ? "s" : ""}…`,
                              { duration: Infinity }
                            )
                            try {
                              const urls: string[] = []
                              for (const file of files) {
                                const url = await uploadToImgBB(file)
                                urls.push(url)
                              }
                              toast.dismiss(uploadToastId)
                              toast.success("Upload berjaya", {
                                description: `${urls.length} imej dimuat naik.`,
                                icon: <CheckCircle2 className="size-4 text-primary" />,
                                duration: 3000,
                              })
                              const next = [...dialogImages, ...urls].slice(0, 8)
                              setDialogImages(next)
                              if (!dialogSelected && next.length > 0) setDialogSelected(next[0])
                            } catch {
                              toast.dismiss(uploadToastId)
                              toast.error("Upload gagal", {
                                description: "Sila cuba semula.",
                                icon: <AlertCircle className="size-4" />,
                                duration: 4000,
                              })
                            } finally {
                              setAvatarUploading(false)
                              if (avatarFileRef.current) avatarFileRef.current.value = ""
                            }
                          }}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowAvatarDialog(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const newImages = dialogImages
                    const newSelectedUrl = dialogSelected || dialogImages[0] || ""
                    setAvatarImages(newImages)
                    setAvatarImageUrl(newSelectedUrl)
                    setShowAvatarDialog(false)
                    // Save immediately after updating avatar images
                    const updatedPoint = {
                      ...point,
                      descriptions: drafts.filter(d => d.key.trim() !== ""),
                      qrCodeImageUrl,
                      qrCodeDestinationUrl,
                      avatarImageUrl: newSelectedUrl,
                      avatarImages: newImages
                    }
                    onSave?.(updatedPoint)
                    toast.success("Avatar updated", {
                      description: `${point.name || point.code} images saved.`,
                      icon: <CheckCircle2 className="size-4 text-primary" />,
                      duration: 3000,
                    })
                  }}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* QR Code dialog */}
          <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
            <DialogContent className="max-w-xs rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base">
                  {isEditMode ? "QR Code Settings" : "QR Code"}
                </DialogTitle>
                {!isEditMode && (
                  <DialogDescription>
                    Scan the QR code or open the destination link.
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-3">
                {/* QR Image preview */}
                {qrCodeImageUrl && (
                  <div className="relative flex justify-center">
                    <img
                      src={qrCodeImageUrl}
                      alt="QR Code"
                      className="w-40 h-40 object-contain border rounded-xl"
                    />
                    {isEditMode && (
                      <button
                        onClick={() => { setQrCodeImageUrl(""); if (fileInputRef.current) fileInputRef.current.value = "" }}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 hover:bg-destructive/80 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {isEditMode && (
                  <>
                    {/* Tabs */}
                    <div className="flex rounded-lg border overflow-hidden">
                      <button
                        onClick={() => setQrTab("url")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                          qrTab === "url"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        URL
                      </button>
                      <button
                        onClick={() => setQrTab("media")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                          qrTab === "media"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                      >
                        <ImageUp className="w-3.5 h-3.5" />
                        Media
                      </button>
                    </div>

                    {/* Tab: URL */}
                    {qrTab === "url" && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">QR Image URL</label>
                        <Input
                          value={qrCodeImageUrl}
                          onChange={e => setQrCodeImageUrl(e.target.value)}
                          placeholder="https://example.com/qr.png"
                          className="h-8 text-sm"
                        />
                      </div>
                    )}

                    {/* Tab: Media */}
                    {qrTab === "media" && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Upload Image</label>
                        <div
                          onClick={() => { fileInputRef.current?.click(); setQrDecodeStatus("idle") }}
                          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-5 cursor-pointer hover:bg-muted/40 transition-colors"
                        >
                          <ImageUp className="w-7 h-7 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Click to choose image</p>
                        </div>

                        {/* Decode status feedback */}
                        {qrDecodeStatus === "decoding" && (
                          <div className="flex items-center gap-2 text-xs text-blue-500">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Sedang scan QR code...</span>
                          </div>
                        )}
                        {qrDecodeStatus === "decoded" && (
                          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>QR berjaya dibaca — URL diisi automatik.</span>
                          </div>
                        )}
                        {qrDecodeStatus === "failed" && (
                          <div className="flex items-center gap-2 text-xs text-red-500">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>QR could not be read. Please enter the Destination URL manually.</span>
                          </div>
                        )}

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setQrDecodeStatus("decoding")
                            const reader = new FileReader()
                            reader.onloadend = async () => {
                              const dataUrl = reader.result as string
                              setQrCodeImageUrl(dataUrl)
                              // Auto-decode using qr-scanner
                              const decoded = await decodeQrFromSource(file)
                              if (decoded) {
                                setQrDecodeStatus("decoded")
                                setQrCodeDestinationUrl(decoded)
                              } else {
                                setQrDecodeStatus("failed")
                              }
                            }
                            reader.readAsDataURL(file)
                          }}
                        />
                      </div>
                    )}

                    {/* Destination URL — shown always; label hints auto-fill */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Destination URL</label>
                        {qrDecodeStatus === "decoded" && (
                          <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Auto-filled ✓</span>
                        )}
                      </div>
                      <Input
                        value={qrCodeDestinationUrl}
                        onChange={e => setQrCodeDestinationUrl(e.target.value)}
                        placeholder="https://example.com/destination"
                        className="h-8 text-sm"
                      />
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="flex gap-2 justify-end">
                {isEditMode ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowQRDialog(false)}>Cancel</Button>
                    <Button size="sm" onClick={() => { handleSave(); setShowQRDialog(false) }}>Save</Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowQRDialog(false)}>Close</Button>
                    {qrCodeDestinationUrl && (
                      <Button size="sm" onClick={() => { openUrl(qrCodeDestinationUrl); setShowQRDialog(false) }}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Open Link
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Confirmation dialog (open external link) */}
          <Dialog open={!!pendingUrl} onOpenChange={(o) => { if (!o) setPendingUrl(null) }}>
            <DialogContent className="max-w-sm rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base">Open Link?</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-2 mt-1">
                    <p className="text-sm text-muted-foreground">You will be taken to an external app or website.</p>
                    <p className="text-xs font-mono break-all bg-muted text-muted-foreground rounded-xl px-3 py-2">
                      {pendingUrl}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 justify-end mt-2">
                <Button variant="outline" onClick={() => setPendingUrl(null)}>Cancel</Button>
                <Button onClick={confirmOpen}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Open
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* QR Scan result modal */}
          <Dialog open={!!scannedUrl || scannedUrl === ""} onOpenChange={(o) => { if (!o) setScannedUrl(null) }}>
            <DialogContent className="max-w-xs rounded-2xl">
              <DialogHeader>
                <DialogTitle asChild>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <ScanLine className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-base font-semibold">QR Scanned</span>
                  </div>
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 pt-1">
                    {scannedUrl ? (
                      <>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-gray-500 dark:text-gray-400">Link detected. Press <span className="font-semibold text-gray-700 dark:text-gray-200">Open</span> to continue.</p>
                        </div>
                        <div className="bg-gray-100 dark:bg-neutral-800 rounded-xl px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Destination</p>
                          <p className="text-xs font-mono break-all text-gray-700 dark:text-gray-200 leading-relaxed">
                            {scannedUrl}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2 py-1">
                        <X className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No destination URL set for this QR code.</p>
                      </div>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setScannedUrl(null)}>Close</Button>
                {scannedUrl && (
                  <Button size="sm" onClick={() => { window.open(scannedUrl, "_blank"); setScannedUrl(null) }}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Open
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Footer — only in edit mode */}
        {isEditing && (
          <div className="px-5 pb-5 flex gap-2 justify-end bg-background border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
            <Button size="sm" onClick={handleSave}><Check className="size-3.5 mr-1" />Save</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
