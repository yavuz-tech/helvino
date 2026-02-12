"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { X, ZoomIn, Tag as TagIcon, Upload, Info, AlertTriangle } from "lucide-react";
import { WIDGET_GALLERY_IMAGES, getAllUsageTypes, type WidgetGalleryImage, type WidgetUsageType } from "@/lib/widgetImageManifest";
import { useI18n } from "@/i18n/I18nContext";

interface WidgetGalleryProps {
  className?: string;
  onTemplateSelect?: (imageId: string, usage: WidgetUsageType) => void;
}

export default function WidgetGallery({ className = "", onTemplateSelect }: WidgetGalleryProps) {
  const { t } = useI18n();
  const [selectedImage, setSelectedImage] = useState<WidgetGalleryImage | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedUsage, setSelectedUsage] = useState<WidgetUsageType | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());
  
  // Refs for focus trap
  const previewModalRef = useRef<HTMLDivElement>(null);
  const manageModalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Memoized filtered images (performance)
  const filteredImages = useMemo(() => {
    return WIDGET_GALLERY_IMAGES.filter(img => {
      if (selectedTag && !img.tags.includes(selectedTag)) return false;
      if (selectedUsage && img.usage !== selectedUsage) return false;
      return true;
    });
  }, [selectedTag, selectedUsage]);

  // Memoized tags (performance)
  const allTags = useMemo(() => {
    return Array.from(
      new Set(WIDGET_GALLERY_IMAGES.flatMap(img => img.tags))
    ).sort();
  }, []);

  // Memoized usage types (performance)
  const usageTypes = useMemo(() => getAllUsageTypes(), []);

  // Handle image click
  const handleImageClick = useCallback((image: WidgetGalleryImage) => {
    setSelectedImage(image);
    if (onTemplateSelect) {
      onTemplateSelect(image.id, image.usage);
    }
  }, [onTemplateSelect]);

  // Handle image load error
  const handleImageError = useCallback((imageId: string) => {
    setImageLoadErrors(prev => new Set(prev).add(imageId));
  }, []);

  // ESC key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedImage) {
          setSelectedImage(null);
        } else if (showManageModal) {
          setShowManageModal(false);
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedImage, showManageModal]);

  // Focus trap for modals
  useEffect(() => {
    if (selectedImage || showManageModal) {
      const modalRef = selectedImage ? previewModalRef : manageModalRef;
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        const handleTab = (e: KeyboardEvent) => {
          if (e.key === "Tab") {
            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          }
        };

        document.addEventListener("keydown", handleTab);
        firstElement.focus();

        return () => document.removeEventListener("keydown", handleTab);
      }
    }
  }, [selectedImage, showManageModal]);

  // Body scroll lock when modal is open
  useEffect(() => {
    if (selectedImage || showManageModal) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [selectedImage, showManageModal]);

  return (
    <div className={className}>
      {/* Missing Images Warning */}
      {imageLoadErrors.size > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-semibold text-amber-900 mb-1">
                {t("widgetGallery.missingImagesTitle") || "Bazı Görseller Yüklenemedi"}
              </h3>
              <p className="text-[13px] text-amber-800 leading-relaxed mb-2">
                {t("widgetGallery.missingImagesDesc") || `${imageLoadErrors.size} görsel dosyası bulunamadı veya yüklenemedi.`}
              </p>
              <button
                onClick={() => setShowManageModal(true)}
                className="text-[12px] font-medium text-amber-700 hover:text-amber-900 underline"
                aria-label={t("widgetGallery.viewInstructions") || "Yönetim talimatlarını görüntüle"}
              >
                {t("widgetGallery.howToFix") || "Nasıl düzeltirim?"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-[18px] font-semibold text-amber-900 mb-1">
            {t("widgetGallery.title") || "Widget Görünüm Galerisi"}
          </h2>
          <p className="text-[13px] text-amber-700">
            {t("widgetGallery.subtitle") || "Farklı kullanım senaryolarında widget'ınızın nasıl göründüğünü inceleyin"}
          </p>
        </div>
        <button
          onClick={() => setShowManageModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors flex-shrink-0"
          aria-label={t("widgetGallery.manageImages") || "Görselleri Yönet"}
        >
          <Upload size={15} strokeWidth={2} aria-hidden="true" />
          <span className="hidden sm:inline">{t("widgetGallery.manageImages") || "Görselleri Yönet"}</span>
          <span className="sm:hidden">{t("widgetGallery.manage") || "Yönet"}</span>
        </button>
      </div>

      {/* Usage Type Filters */}
      <div className="mb-3">
        <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-2">
          {t("widgetGallery.filterByUsage") || "Kullanım Alanına Göre"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedUsage(null)}
            className={`px-2.5 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
              selectedUsage === null
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            {t("widgetGallery.allUsages") || "Tüm Kullanımlar"} ({WIDGET_GALLERY_IMAGES.length})
          </button>
          {usageTypes.map(({ usage, count, label }) => (
            <button
              key={usage}
              onClick={() => setSelectedUsage(usage)}
              className={`px-2.5 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
                selectedUsage === usage
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Tag Filters */}
      <div className="mb-5">
        <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-2">
          {t("widgetGallery.filterByTag") || "Etikete Göre"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-2.5 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
              selectedTag === null
                ? "bg-amber-100 text-amber-700 shadow-sm"
                : "bg-amber-50/70 text-amber-700 hover:bg-amber-100"
            }`}
          >
            {t("widgetGallery.allViews") || "Tümü"} ({WIDGET_GALLERY_IMAGES.length})
          </button>
          {allTags.map(tag => {
            const count = WIDGET_GALLERY_IMAGES.filter(img => img.tags.includes(tag)).length;
            return (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
                  selectedTag === tag
                    ? "bg-amber-100 text-amber-700 shadow-sm"
                    : "bg-amber-50/70 text-amber-700 hover:bg-amber-100"
                }`}
              >
                <TagIcon size={11} strokeWidth={2} />
                {tag} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredImages.map((image) => {
          const hasError = imageLoadErrors.has(image.id);
          
          return (
            <button
              key={image.id}
              onClick={() => !hasError && handleImageClick(image)}
              disabled={hasError}
              className={`group relative bg-white rounded-xl border border-[#F3E8D8] overflow-hidden text-left transition-all duration-200 ${
                hasError
                  ? "opacity-60 cursor-not-allowed"
                  : "cursor-pointer hover:shadow-lg hover:border-amber-300"
              }`}
              aria-label={`${image.title} - ${usageTypes.find(u => u.usage === image.usage)?.label}`}
            >
              {/* Usage Badge */}
              <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-white/95 backdrop-blur-sm rounded-md shadow-sm">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                  {usageTypes.find(u => u.usage === image.usage)?.label}
                </span>
              </div>

              {/* Image */}
              <div className="relative aspect-[4/3] bg-amber-100">
                {hasError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <AlertTriangle size={32} className="text-amber-500 mb-2" strokeWidth={1.5} aria-hidden="true" />
                    <p className="text-[12px] text-amber-600 text-center font-medium">
                      {t("widgetGallery.imageNotFound") || "Görsel bulunamadı"}
                    </p>
                  </div>
                ) : (
                  <>
                    <Image
                      src={image.src}
                      alt={image.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      onError={() => handleImageError(image.id)}
                      loading="lazy"
                    />
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" aria-hidden="true">
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        <span className="text-white text-[12px] font-semibold drop-shadow-lg">
                          {t("widgetGallery.clickToPreview") || "Önizle"}
                        </span>
                        <ZoomIn size={16} className="text-white drop-shadow-lg" strokeWidth={2.5} />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="text-[14px] font-semibold text-amber-900 mb-1 line-clamp-1">
                  {image.title}
                </h3>
                <p className="text-[12px] text-amber-700 line-clamp-2 leading-snug">
                  {image.description}
                </p>
                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-2" aria-label="Etiketler">
                  {image.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {image.tags.length > 3 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-100 text-amber-600 text-[10px] font-medium rounded">
                      +{image.tags.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* No Results */}
      {filteredImages.length === 0 && (
        <div className="text-center py-12 bg-[#FFFBF5] rounded-xl border border-[#F3E8D8]">
          <TagIcon size={32} className="mx-auto mb-3 text-amber-400" strokeWidth={1.5} />
          <p className="text-[14px] text-amber-600 font-medium">
            {t("widgetGallery.noResults") || "Bu filtre için görsel bulunamadı"}
          </p>
          <button
            onClick={() => {
              setSelectedTag(null);
              setSelectedUsage(null);
            }}
              className="mt-3 text-[13px] text-amber-600 hover:text-amber-700 font-medium"
          >
            {t("widgetGallery.clearFilters") || "Filtreleri Temizle"}
          </button>
        </div>
      )}

      {/* Manage Images Modal */}
      {showManageModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowManageModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-modal-title"
        >
          <div
            ref={manageModalRef}
            className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={firstFocusableRef}
              onClick={() => setShowManageModal(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-lg hover:bg-amber-50 flex items-center justify-center transition-colors"
              aria-label={t("widgetGallery.close") || "Kapat"}
            >
              <X size={18} strokeWidth={2} className="text-amber-600" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Info size={20} className="text-amber-600" strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <h3 id="manage-modal-title" className="text-[16px] sm:text-[18px] font-semibold text-amber-900 mb-1">
                  {t("widgetGallery.manageImagesTitle") || "Galeri Görsellerini Yönetme"}
                </h3>
                <p className="text-[13px] text-amber-700 leading-relaxed">
                  {t("widgetGallery.manageImagesDesc") || "Bu galerinin görselleri proje kaynak kodunda tutulmaktadır."}
                </p>
              </div>
            </div>

            <div className="bg-[#FFFBF5] rounded-lg p-3 sm:p-4 mb-4">
              <h4 className="text-[14px] font-semibold text-amber-900 mb-2">
                {t("widgetGallery.howToUpdate") || "Görselleri Nasıl Güncellerim?"}
              </h4>
              <ol className="space-y-2 text-[12px] sm:text-[13px] text-amber-800 leading-relaxed">
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600 flex-shrink-0">1.</span>
                  <span>
                    <code className="px-1.5 py-0.5 bg-white rounded text-[11px] sm:text-[12px] font-mono break-all">apps/web/public/widget-gallery/</code> klasörüne yeni görsel ekleyin
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600 flex-shrink-0">2.</span>
                  <span>
                    <code className="px-1.5 py-0.5 bg-white rounded text-[11px] sm:text-[12px] font-mono break-all">apps/web/src/lib/widgetImageManifest.ts</code> dosyasını açın
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600 flex-shrink-0">3.</span>
                  <span>
                    <code className="px-1.5 py-0.5 bg-white rounded text-[11px] sm:text-[12px] font-mono">WIDGET_GALLERY_IMAGES</code> dizisine yeni görsel metadata ekleyin
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600 flex-shrink-0">4.</span>
                  <span>
                    <code className="px-1.5 py-0.5 bg-white rounded text-[11px] sm:text-[12px] font-mono">pnpm build</code> çalıştırarak değişiklikleri test edin
                  </span>
                </li>
              </ol>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-[12px] text-amber-800 leading-relaxed">
                <strong className="font-semibold">💡 Not:</strong> Görselleri dinamik upload fonksiyonu henüz mevcut değil. 
                Tüm görsel güncellemeleri yukarıdaki adımlarla manuel olarak yapılmaktadır.
              </p>
            </div>

            <button
              onClick={() => setShowManageModal(false)}
              className="mt-4 w-full px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[14px] font-semibold rounded-lg hover:opacity-90 transition-all shadow-sm"
            >
              {t("common.close") || "Anladım"}
            </button>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
          onClick={() => setSelectedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
        >
          <div
            ref={previewModalRef}
            className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-[#F3E8D8] px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-3 sm:mr-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                  <h3 id="preview-modal-title" className="text-[14px] sm:text-[16px] font-semibold text-amber-900 truncate">
                    {selectedImage.title}
                  </h3>
                  <span className="inline-flex items-center self-start px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide rounded flex-shrink-0">
                    {usageTypes.find(u => u.usage === selectedImage.usage)?.label}
                  </span>
                </div>
                <p className="text-[12px] sm:text-[13px] text-amber-700 line-clamp-2 sm:line-clamp-none">
                  {selectedImage.description}
                </p>
              </div>
              <button
                ref={firstFocusableRef}
                onClick={() => setSelectedImage(null)}
                className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-amber-50 flex items-center justify-center transition-colors"
                aria-label={t("widgetGallery.close") || "Kapat"}
              >
                <X size={18} strokeWidth={2} className="text-amber-600" aria-hidden="true" />
              </button>
            </div>

            {/* Image */}
            <div className="p-3 sm:p-5">
              <div className="relative bg-amber-100 rounded-lg overflow-hidden">
                <Image
                  src={selectedImage.src}
                  alt={selectedImage.title}
                  width={selectedImage.width}
                  height={selectedImage.height}
                  className="w-full h-auto"
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 90vw, 1280px"
                  priority
                  onError={() => handleImageError(selectedImage.id)}
                />
              </div>

              {/* Tags & Info */}
              <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2" role="list" aria-label={t("widgetGallery.useCases") || "Kullanım Alanları"}>
                <span className="text-[11px] sm:text-[12px] text-amber-600 font-medium self-center">
                  {t("widgetGallery.useCases") || "Kullanım Alanları:"}
                </span>
                {selectedImage.tags.map(tag => (
                  <span
                    key={tag}
                    role="listitem"
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-amber-100 text-amber-800 text-[11px] sm:text-[12px] font-medium rounded-lg"
                  >
                    <TagIcon size={10} strokeWidth={2} aria-hidden="true" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
