import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Star, Trash2 } from 'lucide-react';
import type { FileRejection } from 'react-dropzone';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ImageDropzone } from '@/components/ui/image-dropzone';
import type { MaterialModelImageDraft } from '../model/material-model';

const MAX_IMAGES = 10;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface MaterialModelGalleryCardProps {
  images: MaterialModelImageDraft[];
  onImagesChange: (images: MaterialModelImageDraft[]) => void;
}

function imageSource(image: MaterialModelImageDraft) {
  return image.previewUrl ?? image.url;
}

export function MaterialModelGalleryCard({
  images,
  onImagesChange,
}: MaterialModelGalleryCardProps) {
  const intl = useIntl();
  const inputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  const [selectedId, setSelectedId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      for (const image of imagesRef.current) {
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
      }
    },
    [],
  );

  useEffect(() => {
    const selectedImage = images.find((image) => image.id === selectedId);
    if (!selectedImage && images.length > 0) {
      setSelectedId(
        images.find((image) => image.isCover)?.id ?? images[0].id ?? '',
      );
    } else if (images.length === 0) {
      setSelectedId('');
    }
  }, [images, selectedId]);

  const selectedImage =
    images.find((image) => image.id === selectedId) ??
    images.find((image) => image.isCover) ??
    images[0];
  const orderedImages = [...images].sort(
    (first, second) =>
      Number(second.isCover) - Number(first.isCover) ||
      first.sortOrder - second.sortOrder,
  );

  const handleFiles = (files: File[], rejections: FileRejection[] = []) => {
    if (files.length === 0 && rejections.length === 0) return;
    const availableSlots = MAX_IMAGES - images.length;
    const acceptedFiles: File[] = [];
    const sawInvalidType = rejections.some((rejection) =>
      rejection.errors.some((error) => error.code === 'file-invalid-type'),
    );
    let sawTooLarge = false;

    for (const file of files) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        continue;
      } else if (file.size > MAX_SIZE_BYTES) {
        sawTooLarge = true;
      } else if (acceptedFiles.length < availableSlots) {
        acceptedFiles.push(file);
      }
    }

    if (acceptedFiles.length > 0) {
      const addedImages: MaterialModelImageDraft[] = acceptedFiles.map(
        (file, index) => ({
          id: crypto.randomUUID(),
          url: '',
          previewUrl: URL.createObjectURL(file),
          file,
          sortOrder: images.length + index,
          isCover: images.length === 0 && index === 0,
        }),
      );
      onImagesChange([...images, ...addedImages]);
      if (!selectedId) setSelectedId(addedImages[0]?.id ?? '');
    }

    if (sawInvalidType) {
      setErrorMessage(
        intl.formatMessage({ id: 'materialModels.gallery.invalidType' }),
      );
    } else if (sawTooLarge) {
      setErrorMessage(
        intl.formatMessage({ id: 'materialModels.gallery.tooLarge' }),
      );
    } else if (
      acceptedFiles.length < files.length &&
      availableSlots <= acceptedFiles.length
    ) {
      setErrorMessage(
        intl.formatMessage({ id: 'materialModels.gallery.limit' }),
      );
    } else {
      setErrorMessage('');
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  const setCover = (id: string) => {
    setSelectedId(id);
    onImagesChange(
      [...images]
        .map((image) => ({
          ...image,
          isCover: image.id === id,
        }))
        .sort(
          (first, second) =>
            Number(second.isCover) - Number(first.isCover) ||
            first.sortOrder - second.sortOrder,
        )
        .map((image, sortOrder) => ({ ...image, sortOrder })),
    );
  };

  const removeImage = (image: MaterialModelImageDraft) => {
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    const remainingImages = images
      .filter((item) => item.id !== image.id)
      .map((item, sortOrder) => ({ ...item, sortOrder }));
    if (image.isCover && remainingImages.length > 0) {
      remainingImages[0] = { ...remainingImages[0], isCover: true };
    }
    onImagesChange(remainingImages);
    setErrorMessage('');
  };

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4">
        <div
          className={cn(
            'relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden',
            images.length === 0 && 'min-h-[250px]',
          )}
        >
          {selectedImage ? (
            <>
              <img
                src={imageSource(selectedImage)}
                alt={intl.formatMessage({ id: 'materialModels.gallery.title' })}
                className="h-full max-h-[520px] w-full object-contain"
              />
              {selectedImage.isCover && (
                <span className="absolute left-3 top-3 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                  {intl.formatMessage({ id: 'materialModels.gallery.cover' })}
                </span>
              )}
            </>
          ) : (
            <ImageDropzone
              title={intl.formatMessage({
                id: 'materialModels.gallery.emptyTitle',
              })}
              instruction={intl.formatMessage({
                id: 'materialModels.gallery.dropInstruction',
              })}
              activeInstruction={intl.formatMessage({
                id: 'materialModels.gallery.dropActive',
              })}
              buttonLabel={intl.formatMessage({
                id: 'materialModels.gallery.chooseImages',
              })}
              onFilesDropped={handleFiles}
              className="py-4"
            />
          )}
        </div>

        {images.length > 0 && (
          <div className="flex shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {intl.formatMessage(
                  { id: 'materialModels.gallery.count' },
                  { count: images.length },
                )}
              </p>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  handleFiles(Array.from(event.currentTarget.files ?? []));
                  event.currentTarget.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={images.length >= MAX_IMAGES}
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus className="size-4" />
                {intl.formatMessage({ id: 'materialModels.gallery.add' })}
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {orderedImages.map((image, index) => (
                <div
                  key={image.id}
                  className={cn(
                    'group relative aspect-square w-20 shrink-0 overflow-hidden rounded-md border bg-background sm:w-24',
                    selectedId === image.id &&
                      'border-primary ring-1 ring-primary',
                  )}
                >
                  <button
                    type="button"
                    className="size-full"
                    aria-label={intl.formatMessage(
                      { id: 'materialModels.gallery.viewImage' },
                      { index: index + 1 },
                    )}
                    aria-pressed={selectedId === image.id}
                    onClick={() => setSelectedId(image.id ?? '')}
                  >
                    <img
                      src={imageSource(image)}
                      alt=""
                      className="size-full object-cover"
                    />
                  </button>
                  <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Button
                      type="button"
                      variant={image.isCover ? 'primary' : 'outline'}
                      size="icon"
                      className="size-7 rounded-full bg-background/95 shadow-sm"
                      aria-label={intl.formatMessage({
                        id: 'materialModels.gallery.setCover',
                      })}
                      title={intl.formatMessage({
                        id: 'materialModels.gallery.setCover',
                      })}
                      onClick={() => setCover(image.id ?? '')}
                    >
                      <Star
                        className={cn(
                          'size-3.5',
                          image.isCover && 'fill-current',
                        )}
                      />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full bg-background/95 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive"
                      aria-label={intl.formatMessage({
                        id: 'materialModels.gallery.remove',
                      })}
                      title={intl.formatMessage({
                        id: 'materialModels.gallery.remove',
                      })}
                      onClick={() => removeImage(image)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {image.isCover && (
                    <span
                      className="absolute left-0 top-0 flex size-7 items-start justify-start bg-[var(--color-success-accent,var(--color-green-600))] p-1 text-white [clip-path:polygon(0_0,100%_0,0_100%)]"
                      role="img"
                      aria-label={intl.formatMessage({
                        id: 'materialModels.gallery.cover',
                      })}
                      title={intl.formatMessage({
                        id: 'materialModels.gallery.cover',
                      })}
                    >
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      {errorMessage && (
        <p role="alert" className="px-4 pb-3 text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </Card>
  );
}
