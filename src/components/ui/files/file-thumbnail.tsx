import { useEffect, useRef, useState } from 'react';
import {
  getFileThumbnailKind,
  type FilePreviewSource,
} from '@/project/files/model/file';
import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createSignedStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { FileIcon } from './file-icon';

interface FileThumbnailProps extends FilePreviewSource {
  storageBucket?: string;
  storagePath?: string;
  className?: string;
}

const TEXT_PREVIEW_LIMIT = 1600;

function PdfThumbnail({
  fileName,
  url,
  onError,
}: {
  fileName: string;
  url: string;
  onError: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let destroyLoadingTask: (() => Promise<void>) | undefined;

    const renderFirstPage = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const loadingTask = pdfjs.getDocument({
          url,
          disableAutoFetch: true,
        });
        destroyLoadingTask = () => loadingTask.destroy();
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const canvas = canvasRef.current;
        const container = canvas?.parentElement;
        if (!canvas || !container || cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = container.clientWidth || 240;
        const availableHeight = container.clientHeight || 160;
        const scale = Math.min(
          availableWidth / baseViewport.width,
          availableHeight / baseViewport.height,
        );
        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Không thể khởi tạo vùng xem trước PDF.');

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        await page.render({
          canvasContext: context,
          viewport,
          transform:
            outputScale !== 1
              ? [outputScale, 0, 0, outputScale, 0, 0]
              : undefined,
        }).promise;

        if (!cancelled) setIsRendering(false);
        page.cleanup();
        await pdf.cleanup();
      } catch {
        if (!cancelled) onError();
      }
    };

    void renderFirstPage();

    return () => {
      cancelled = true;
      void destroyLoadingTask?.();
    };
  }, [fileName, onError, url]);

  return (
    <>
      {isRendering ? (
        <LoaderCircle
          className="absolute size-7 animate-spin text-muted-foreground"
          aria-label={`Đang tạo xem trước ${fileName}`}
        />
      ) : null}
      <canvas ref={canvasRef} className="max-h-full max-w-full" />
    </>
  );
}

export function FileThumbnail({
  fileName,
  mimeType,
  storageBucket,
  storagePath,
  className,
}: FileThumbnailProps) {
  const kind = getFileThumbnailKind({ fileName, mimeType });
  const canPreview =
    kind !== 'unsupported' && Boolean(storageBucket && storagePath);
  const [previewFailed, setPreviewFailed] = useState(false);
  const signedUrlQuery = useQuery({
    queryKey: ['file-thumbnail-url', storageBucket, storagePath],
    queryFn: () => createSignedStorageUrl(storageBucket!, storagePath!),
    enabled: canPreview,
    staleTime: 4 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
  const textQuery = useQuery({
    queryKey: ['file-thumbnail-text', signedUrlQuery.data],
    queryFn: async () => {
      const response = await fetch(signedUrlQuery.data!, {
        headers: { Range: `bytes=0-${TEXT_PREVIEW_LIMIT - 1}` },
      });
      if (!response.ok) throw new Error('Không thể tải nội dung xem trước.');
      return (await response.text()).slice(0, TEXT_PREVIEW_LIMIT);
    },
    enabled: kind === 'text' && Boolean(signedUrlQuery.data),
    staleTime: 4 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    setPreviewFailed(false);
  }, [fileName, mimeType, storagePath]);

  const showFallback =
    !canPreview || previewFailed || signedUrlQuery.isError || textQuery.isError;

  return (
    <div
      className={cn(
        'relative flex size-full items-center justify-center overflow-hidden rounded-md bg-background',
        className,
      )}
      aria-label={`Xem trước ${fileName}`}
    >
      {!showFallback && signedUrlQuery.isPending ? (
        <LoaderCircle className="size-7 animate-spin text-muted-foreground" />
      ) : null}

      {!showFallback && signedUrlQuery.data && kind === 'image' ? (
        <img
          src={signedUrlQuery.data}
          alt={`Xem trước ${fileName}`}
          className="size-full object-contain"
          loading="lazy"
          onError={() => setPreviewFailed(true)}
        />
      ) : null}

      {!showFallback && signedUrlQuery.data && kind === 'pdf' ? (
        <PdfThumbnail
          fileName={fileName}
          url={signedUrlQuery.data}
          onError={() => setPreviewFailed(true)}
        />
      ) : null}

      {!showFallback && signedUrlQuery.data && kind === 'video' ? (
        <video
          src={signedUrlQuery.data}
          className="size-full object-contain"
          muted
          playsInline
          preload="metadata"
          onError={() => setPreviewFailed(true)}
        />
      ) : null}

      {!showFallback && kind === 'text' && textQuery.isPending ? (
        <LoaderCircle className="size-7 animate-spin text-muted-foreground" />
      ) : null}

      {!showFallback && kind === 'text' && textQuery.data ? (
        <pre className="size-full overflow-hidden whitespace-pre-wrap break-words p-3 text-start font-mono text-[10px] leading-4 text-muted-foreground">
          {textQuery.data}
        </pre>
      ) : null}

      {showFallback ? (
        <FileIcon
          fileType={mimeType}
          fileName={fileName}
          alt=""
          className="size-16"
        />
      ) : null}
    </div>
  );
}
