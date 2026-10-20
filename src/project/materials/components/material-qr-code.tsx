import { QRCodeSVG } from 'qrcode.react';
import { getMaterialQrUrl } from '../utils/material-qr';

interface MaterialQrCodeProps {
  materialId: string;
  materialCode: string;
  size: number;
  className?: string;
}

export function MaterialQrCode({
  materialId,
  materialCode,
  size,
  className,
}: MaterialQrCodeProps) {
  const value = getMaterialQrUrl(materialId);

  return (
    <QRCodeSVG
      aria-label={`QR ${materialCode}`}
      data-qr-value={value}
      value={value}
      className={className}
      size={size}
      marginSize={1}
      level="M"
    />
  );
}
