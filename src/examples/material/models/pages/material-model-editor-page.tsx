import { useEffect, useMemo } from 'react';
import { ROUTES } from '@/constants/routes';
import { Boxes, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { MATERIAL_GROUPS_MOCK } from '../../data/material-groups.mock';
import { SPEC_DEFINITIONS_MOCK } from '../../data/spec-definitions.mock';
import { SPEC_VALUE_SETS_MOCK } from '../../data/spec-value-sets.mock';
import type { ExampleMaterialModel } from '../../model/material-model';
import {
  nextExampleMaterialModelId,
  useMaterialCatalogStore,
} from '../../stores/material-catalog.store';
import {
  exampleMaterialModelDefaultValues,
  ExampleMaterialModelForm,
  mapExampleMaterialModelToFormValues,
  useExampleMaterialModelForm,
} from '../components/material-model-form.generated';
import { ModelSpecEditor } from '../components/model-spec-editor';
import type { ExampleMaterialModelFormValues } from '../material-model.schema';

export function ExampleMaterialModelEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    inspectionTables,
    exampleMaterialModels,
    upsertExampleMaterialModel,
  } = useMaterialCatalogStore();
  const editing = id
    ? (exampleMaterialModels.find((model) => model.id === id) ?? null)
    : null;
  const isEdit = Boolean(id);
  const form = useExampleMaterialModelForm();

  useEffect(() => {
    form.reset(
      editing
        ? mapExampleMaterialModelToFormValues(editing)
        : exampleMaterialModelDefaultValues,
    );
  }, [editing, form]);

  const groupOptions = useMemo(() => {
    const byId = new Map(
      MATERIAL_GROUPS_MOCK.map((group) => [group.id, group]),
    );
    const depthOf = (groupId: string): number => {
      let depth = 0;
      let current = byId.get(groupId);
      while (current?.parentId) {
        depth += 1;
        current = byId.get(current.parentId);
      }
      return depth;
    };
    return MATERIAL_GROUPS_MOCK.map((group) => ({
      value: group.id,
      label: `${'— '.repeat(depthOf(group.id))}${group.name}`,
    }));
  }, []);

  const inspectionTableIdOptions = useMemo(
    () =>
      inspectionTables.map((table) => ({
        value: table.id,
        label: table.name,
      })),
    [inspectionTables],
  );

  const handleSubmit = (values: ExampleMaterialModelFormValues) => {
    const next: ExampleMaterialModel = {
      id: editing?.id ?? nextExampleMaterialModelId(),
      code: values.code.trim(),
      name: values.name.trim(),
      isActive: editing?.isActive ?? true,
      createdAt: editing?.createdAt ?? '',
      updatedAt: editing?.updatedAt ?? '',
      description: values.description.trim() || undefined,
      origin: values.origin.trim() || undefined,
      groupId: values.groupId,
      isSafetyManaged: values.isSafetyManaged,
      inspectionTableId: values.isSafetyManaged
        ? values.inspectionTableId || undefined
        : undefined,
      imageUrls: values.imageUrls.filter(Boolean),
      specs: values.specs.map((spec, index) => ({
        id: spec.id,
        source: spec.source,
        specDefinitionId: spec.specDefinitionId,
        customDefinition: spec.customDefinition,
        labelOverride: spec.labelOverride?.trim() || undefined,
        partKey: spec.partKey?.trim() || undefined,
        selectionModeOverride: spec.selectionModeOverride,
        valueSetIdOverride: spec.valueSetIdOverride,
        optionSource: spec.optionSource,
        materialValueMode: spec.materialValueMode,
        defaultValue: spec.defaultValue,
        isRequired: spec.isRequired,
        sortOrder: index,
      })),
    };

    upsertExampleMaterialModel(next);
    toast.success(
      editing
        ? `Đã cập nhật mẫu “${next.name}”.`
        : `Đã thêm mẫu “${next.name}”.`,
    );
    navigate(ROUTES.EXAMPLE.MATERIAL_MODELS_DEMO);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={
          editing?.name ?? (isEdit ? 'Chi tiết mẫu vật tư' : 'Thêm mẫu vật tư')
        }
        icon={Boxes}
        showBackButton
        backLabel="Quay lại danh sách mẫu vật tư"
        onBack={() => navigate(ROUTES.EXAMPLE.MATERIAL_MODELS_DEMO)}
        actions={
          !isEdit || editing ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => navigate(ROUTES.EXAMPLE.MATERIAL_MODELS_DEMO)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                form="exampleMaterialModel-form"
                variant="primary"
                size="md"
              >
                <Save />
                Lưu mẫu
              </Button>
            </>
          ) : null
        }
      />

      {isEdit && !editing ? (
        <ErrorState
          title="Không tìm thấy mẫu vật tư"
          description="Mẫu đã bị xóa hoặc mã truy cập không hợp lệ. Quay lại danh sách để chọn mẫu khác."
        />
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
          <Card>
            <CardHeader>
              <CardHeading>
                <CardTitle>Thông tin mẫu</CardTitle>
                <CardDescription>
                  Khai báo tên, mã, nhóm và thông tin nhận diện của mẫu vật tư.
                </CardDescription>
              </CardHeading>
            </CardHeader>
            <CardContent>
              <ExampleMaterialModelForm
                form={form}
                onSubmit={handleSubmit}
                id="exampleMaterialModel-form"
                groupIdOptions={groupOptions}
                inspectionTableIdOptions={inspectionTableIdOptions}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardHeading>
                <CardTitle>Thông số kỹ thuật</CardTitle>
                <CardDescription>
                  Chọn thông số áp dụng cho mẫu và thiết lập giá trị mặc định.
                </CardDescription>
              </CardHeading>
            </CardHeader>
            <CardContent className="p-0">
              <ModelSpecEditor
                form={form}
                definitions={SPEC_DEFINITIONS_MOCK}
                valueSets={SPEC_VALUE_SETS_MOCK}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
