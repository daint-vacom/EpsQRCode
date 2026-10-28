import { MATERIAL_MODEL_IMAGES_BUCKET } from '@/project/material-models/api/material-models.api';
import type { Material } from '@/project/materials/model/material';
import { getMaterialQrUrl } from '@/project/materials/utils/material-qr';
import {
  Canvas,
  FabricImage,
  StaticCanvas,
  Textbox,
  type FabricObject,
} from 'fabric';
import QRCode from 'qrcode';
import { createSignedStorageUrl } from '@/lib/storage';
import type {
  MaterialLabelTemplate,
  MaterialLabelTemplateDesign,
} from '../model/material-label-template';

export const LABEL_EDITOR_PIXELS_PER_MM = 4;
export const LABEL_DEFAULT_WIDTH_MM = 60;
export const LABEL_DEFAULT_HEIGHT_MM = 20;
export const LABEL_MIN_WIDTH_MM = 20;
export const LABEL_MAX_WIDTH_MM = 200;
export const LABEL_MIN_HEIGHT_MM = 10;
export const LABEL_MAX_HEIGHT_MM = 120;
export const MATERIAL_LABEL_NOTE_BINDING = 'print.labelNote';

export const MATERIAL_LABEL_FIELDS = [
  {
    key: 'code',
    messageId: 'project.materialLabels.materialFields.code',
    sample: 'Mã vật tư',
    kind: 'text',
  },
  {
    key: 'name',
    messageId: 'project.materialLabels.materialFields.name',
    sample: 'Tên vật tư',
    kind: 'text',
  },
  {
    key: 'modelName',
    messageId: 'project.materialLabels.materialFields.modelName',
    sample: 'Tên mẫu vật tư',
    kind: 'text',
  },
  {
    key: 'serialNumber',
    messageId: 'project.materialLabels.materialFields.serialNumber',
    sample: 'C02XG123KPH0',
    kind: 'text',
  },
  {
    key: 'ownerName',
    messageId: 'project.materialLabels.materialFields.ownerName',
    sample: 'Đơn vị đang giữ',
    kind: 'text',
  },
  {
    key: 'ownerCode',
    messageId: 'project.materialLabels.materialFields.ownerCode',
    sample: 'Mã đơn vị',
    kind: 'text',
  },
  {
    key: 'coverImage',
    messageId: 'project.materialLabels.materialFields.coverImage',
    sample: '',
    kind: 'image',
  },
] as const;

export const MATERIAL_LABEL_PRINT_INPUT_FIELDS = [
  {
    key: MATERIAL_LABEL_NOTE_BINDING,
    messageId: 'project.materialLabels.print.labelNoteBinding',
    sample: 'Ghi chú nhãn',
    kind: 'text',
  },
] as const;

export const MATERIAL_LABEL_BINDING_FIELDS = [
  ...MATERIAL_LABEL_FIELDS,
  ...MATERIAL_LABEL_PRINT_INPUT_FIELDS,
] as const;

export type MaterialLabelFieldKey =
  (typeof MATERIAL_LABEL_BINDING_FIELDS)[number]['key'];
export type MaterialLabelMaterialFieldKey =
  (typeof MATERIAL_LABEL_FIELDS)[number]['key'];
export type MaterialLabelTextFieldKey = Extract<
  MaterialLabelMaterialFieldKey,
  'code' | 'name' | 'modelName' | 'serialNumber' | 'ownerName' | 'ownerCode'
>;

const QR_IMAGE_OPTIONS = {
  errorCorrectionLevel: 'H' as const,
  margin: 4,
  width: 1024,
  color: { dark: '#111111', light: '#ffffff' },
};

export async function createQrImageDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, QR_IMAGE_OPTIONS);
}

function createLabelTextbox({
  id,
  text,
  left,
  top,
  width,
  fontSize,
  fontWeight = 'normal',
  binding,
}: {
  id: string;
  text: string;
  left: number;
  top: number;
  width: number;
  fontSize: number;
  fontWeight?: string;
  binding: string;
}) {
  const textbox = new Textbox(text, {
    left,
    top,
    width,
    fontSize,
    fontFamily: 'Arial',
    fontWeight,
    fill: '#111827',
    lineHeight: 1.1,
    splitByGrapheme: false,
  });
  textbox.set({
    labelElementId: id,
    labelElementType: 'text',
    labelBinding: binding,
  });
  return textbox;
}

export async function addQrImageToCanvas(
  canvas: Canvas,
  value: string,
  options: { left?: number; top?: number; size?: number } = {},
) {
  const size = options.size ?? 96;
  const image = await FabricImage.fromURL(await createQrImageDataUrl(value));
  const left = options.left ?? Math.max(12, (canvas.getWidth() - size) / 2);
  const top = options.top ?? Math.max(12, (canvas.getHeight() - size) / 2);
  image.set({
    left,
    top,
    originX: 'left',
    originY: 'top',
    scaleX: size / Math.max(1, image.width ?? size),
    scaleY: size / Math.max(1, image.height ?? size),
    labelElementId: `qr-${crypto.randomUUID()}`,
    labelElementType: 'qr',
    qrCode: true,
  });
  canvas.add(image);
  canvas.setActiveObject(image);
  canvas.requestRenderAll();
  return image;
}

export async function loadMaterialLabelDesign(
  canvas: Canvas,
  design: MaterialLabelTemplateDesign | null | undefined,
  widthMm: number,
  heightMm: number,
  sampleMaterialId: string,
) {
  const width = Math.round(widthMm * LABEL_EDITOR_PIXELS_PER_MM);
  const height = Math.round(heightMm * LABEL_EDITOR_PIXELS_PER_MM);
  canvas.setDimensions({ width, height });
  canvas.clear();
  canvas.backgroundColor = '#ffffff';

  const objects = Array.isArray(design?.objects) ? design.objects : [];
  if (objects.length > 0) {
    await canvas.loadFromJSON(design as Record<string, unknown>);
    canvas.setDimensions({ width, height });
    canvas.backgroundColor = '#ffffff';
    canvas.getObjects().forEach((object) => {
      if (object.get('labelElementType') === 'qr' || object.get('qrCode')) {
        object.set({ labelElementType: 'qr', qrCode: true });
      }
    });
  } else {
    const margin = Math.round(width * 0.05);
    const qrSize = Math.min(height - margin * 2, Math.round(width * 0.34));
    await addQrImageToCanvas(canvas, getMaterialQrUrl(sampleMaterialId), {
      left: margin,
      top: Math.round((height - qrSize) / 2),
      size: qrSize,
    });
    const textLeft = margin + qrSize + Math.round(width * 0.045);
    const textWidth = Math.max(40, width - textLeft - margin);
    canvas.add(
      createLabelTextbox({
        id: 'field-name',
        text: 'Tên vật tư',
        left: textLeft,
        top: Math.round(height * 0.2),
        width: textWidth,
        fontSize: Math.max(12, Math.round(height * 0.18)),
        binding: 'name',
      }),
      createLabelTextbox({
        id: 'field-code',
        text: 'Mã vật tư',
        left: textLeft,
        top: Math.round(height * 0.62),
        width: textWidth,
        fontSize: Math.max(12, Math.round(height * 0.16)),
        binding: 'code',
      }),
    );
  }
  canvas.requestRenderAll();
}

export function serializeMaterialLabelDesign(
  canvas: Canvas,
): MaterialLabelTemplateDesign {
  return {
    ...(canvas.toObject([
      'labelElementId',
      'labelElementType',
      'labelBinding',
      'name',
      'editorLocked',
      'qrCode',
    ]) as Record<string, unknown>),
    version: 1,
  };
}

function getMaterialBindingValue(
  material: Material,
  binding: MaterialLabelMaterialFieldKey,
) {
  switch (binding) {
    case 'code':
      return material.code;
    case 'name':
      return material.nameOverride?.trim() || material.modelSnapshot.name;
    case 'modelName':
      return material.modelSnapshot.name;
    case 'serialNumber':
      return material.serialNumber ?? '';
    case 'ownerName':
      return material.ownerSnapshot.name;
    case 'ownerCode':
      return material.ownerSnapshot.code;
  }
}

export async function renderMaterialLabelSvg(
  template: MaterialLabelTemplate,
  material: Material,
  labelNote = '',
) {
  const width = Math.round(template.widthMm * LABEL_EDITOR_PIXELS_PER_MM);
  const height = Math.round(template.heightMm * LABEL_EDITOR_PIXELS_PER_MM);
  const canvas = new StaticCanvas(document.createElement('canvas'), {
    width,
    height,
    backgroundColor: '#ffffff',
    renderOnAddRemove: false,
  });

  try {
    const objects = Array.isArray(template.design?.objects)
      ? template.design.objects
      : [];
    if (objects.length > 0) {
      await canvas.loadFromJSON(template.design as Record<string, unknown>);
      canvas.setDimensions({ width, height });
      canvas.backgroundColor = '#ffffff';
    } else {
      const interactiveCanvas = new Canvas(document.createElement('canvas'), {
        width,
        height,
        backgroundColor: '#ffffff',
        renderOnAddRemove: false,
      });
      await loadMaterialLabelDesign(
        interactiveCanvas,
        null,
        template.widthMm,
        template.heightMm,
        material.id,
      );
      await canvas.loadFromJSON(
        serializeMaterialLabelDesign(interactiveCanvas),
      );
      await interactiveCanvas.dispose();
    }

    const qrDataUrl = await createQrImageDataUrl(getMaterialQrUrl(material.id));
    for (const object of canvas.getObjects()) {
      const binding = object.get('labelBinding');
      if (
        binding === MATERIAL_LABEL_NOTE_BINDING &&
        (object.type === 'textbox' || object.type === 'text')
      ) {
        (object as FabricObject & { text?: string }).set('text', labelNote);
      }
      if (typeof binding === 'string') {
        const field = MATERIAL_LABEL_FIELDS.find(
          (item) => item.key === binding,
        );
        if (field) {
          if (field.kind === 'text' && object.type === 'textbox') {
            (object as FabricObject & { text?: string }).set(
              'text',
              getMaterialBindingValue(
                material,
                field.key as MaterialLabelTextFieldKey,
              ),
            );
          } else if (field.kind === 'image' && object.type === 'image') {
            const materialCover = material.images.find(
              (image) => image.isCover,
            );
            const modelCover = material.modelSnapshot.images.find(
              (image) => image.isCover,
            );
            const coverImage =
              materialCover?.url ||
              materialCover?.externalUrl ||
              modelCover?.externalUrl ||
              (modelCover?.storagePath
                ? await createSignedStorageUrl(
                    MATERIAL_MODEL_IMAGES_BUCKET,
                    modelCover.storagePath,
                    3600,
                  )
                : '');
            if (coverImage) {
              const image = object as FabricImage;
              const displayWidth = image.getScaledWidth();
              const displayHeight = image.getScaledHeight();
              await image.setSrc(coverImage, { crossOrigin: 'anonymous' });
              image.set({
                scaleX: displayWidth / Math.max(1, image.width ?? displayWidth),
                scaleY:
                  displayHeight / Math.max(1, image.height ?? displayHeight),
              });
            }
          }
        }
      }
      if (object.get('labelElementType') === 'qr' || object.get('qrCode')) {
        const image = object as FabricImage;
        const displayWidth = image.getScaledWidth();
        const displayHeight = image.getScaledHeight();
        await image.setSrc(qrDataUrl);
        image.set({
          scaleX: displayWidth / Math.max(1, image.width ?? displayWidth),
          scaleY: displayHeight / Math.max(1, image.height ?? displayHeight),
          qrCode: true,
          labelElementType: 'qr',
        });
      }
    }

    canvas.requestRenderAll();
    return canvas.toSVG({ suppressPreamble: true });
  } finally {
    await canvas.dispose();
  }
}
