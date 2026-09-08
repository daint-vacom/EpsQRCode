import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import type { CustomerSelectOption } from '@/project/customers/components/customer-select';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Save,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  Stepper,
  StepperConnector,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { loadActiveCurrencies } from '../../api/currencies.api';
import { CURRENT_CURRENCY_CODE, toCurrencyOptions } from '../../model/currency';
import { loadContractTemplateDetail } from '../api/contract-templates.api';
import {
  activateContract,
  createContract,
  loadContractDetail,
  updateContract,
  type ContractVersionLineValuesForApi,
} from '../api/contracts.api';
import type { ContractDetail } from '../api/contracts.api';
import { ContractConfirmationProcessing } from '../components/contract-confirmation-processing';
import { ContractCurrencyField } from '../components/contract-currency-field';
import {
  ContractFeeLinesEditor,
  createDefaultContractFeeLine,
  type ContractFeeLinesEditorRef,
} from '../components/contract-fee-lines-editor';
import {
  contractDefaultValues,
  ContractForm,
  mapContractToFormValues,
  useContractForm,
} from '../forms/contract-form.generated';
import type { ContractFormValues, ContractVersion } from '../model/contract';
import {
  getContractVersionChangeCheck,
  getContractVersionTermDifferences,
  type ContractChargeChanges,
  type ContractVersionChangeCheck,
} from '../model/contract-version-change';

const STEPS = [
  {
    value: 1,
    label: 'Thông tin chung',
    icon: FileText,
  },
  {
    value: 2,
    label: 'Xác nhận',
    icon: Check,
  },
] as const;

function toEditableLines(
  contract: ContractDetail,
  versionId?: string,
): ContractVersionLineValuesForApi[] {
  const version = versionId
    ? contract.versions.find((item) => item.id === versionId)
    : contract.versions[0];
  return contract.lines
    .filter((line) => line.contractVersionId === version?.id)
    .map((line) => ({
      sourceLineId: line.id,
      direction: line.direction,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      billingType: line.billingType,
      billingUnit: line.billingUnit,
      billingInterval: line.billingInterval,
      chargeDate: line.chargeDate,
      dueRule: line.dueRule,
      dueDays: line.dueDays,
      startDate: line.startDate,
      endDate: line.endDate,
    }));
}

function toVersionFormValues(
  contract: ContractDetail,
  version?: ContractVersion,
): ContractFormValues {
  const snapshot = version?.termsSnapshot ?? {};
  return {
    ...mapContractToFormValues(contract),
    customerId:
      typeof snapshot.customerId === 'string'
        ? snapshot.customerId
        : contract.customerId,
    contractCode:
      typeof snapshot.contractCode === 'string'
        ? snapshot.contractCode
        : contract.contractCode,
    name: typeof snapshot.name === 'string' ? snapshot.name : contract.name,
    currencyCode:
      typeof snapshot.currencyCode === 'string'
        ? snapshot.currencyCode
        : contract.currencyCode,
    startDate:
      typeof snapshot.startDate === 'string'
        ? snapshot.startDate
        : contract.startDate,
    endDate:
      typeof snapshot.endDate === 'string' || snapshot.endDate === null
        ? snapshot.endDate
        : contract.endDate,
    autoRenew:
      typeof snapshot.autoRenew === 'boolean'
        ? snapshot.autoRenew
        : contract.autoRenew,
    note: typeof snapshot.note === 'string' ? snapshot.note : contract.note,
    responsibleEmployeeIds: contract.responsibleEmployees.map(
      (employee) => employee.id,
    ),
    tagIds: contract.tags.map((tag) => tag.id),
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ContractCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userId } = useUser();
  const { tenantId, isPending: isTenantPending } = useTenant();
  const editingContractId = searchParams.get('edit');
  const templateId = searchParams.get('templateId');
  const isEditMode = Boolean(editingContractId);
  const isTemplateMode = Boolean(templateId) && !isEditMode;
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerSelectOption>();
  const feeLinesEditorRef = useRef<ContractFeeLinesEditorRef>(null);
  const form = useContractForm();
  const [feeLines, setFeeLines] = useState<ContractVersionLineValuesForApi[]>([
    createDefaultContractFeeLine(contractDefaultValues.startDate),
  ]);
  const [feeEditorKey, setFeeEditorKey] = useState('create');
  const [processingState, setProcessingState] = useState<
    'idle' | 'checking-charges' | 'checking-version' | 'complete'
  >('idle');
  const [chargeChanges, setChargeChanges] =
    useState<ContractChargeChanges | null>(null);
  const [versionCheck, setVersionCheck] =
    useState<ContractVersionChangeCheck | null>(null);
  const [plannedEffectiveFrom, setPlannedEffectiveFrom] = useState<
    string | null
  >(null);
  const [selectedEditVersionId, setSelectedEditVersionId] = useState<
    string | null
  >(null);
  const mappedEditIdRef = useRef<string | null>(null);
  const mappedTemplateIdRef = useRef<string | null>(null);
  const versionCheckRunRef = useRef(0);

  const currenciesQuery = useQuery({
    queryKey: ['project', 'currencies', 'active'],
    queryFn: loadActiveCurrencies,
  });
  const currencyCodeOptions = toCurrencyOptions(currenciesQuery.data ?? []);

  const editDetailQuery = useQuery({
    queryKey: [
      'project',
      'contracts',
      'detail',
      userId,
      tenantId,
      editingContractId,
    ],
    queryFn: () => {
      if (!userId || !tenantId || !editingContractId) {
        throw new Error('Thiếu thông tin hợp đồng cần chỉnh sửa.');
      }
      return loadContractDetail(userId, editingContractId, tenantId);
    },
    enabled: Boolean(userId && tenantId && editingContractId),
  });

  const loadVersionIntoEditor = useCallback(
    (detail: ContractDetail, version: ContractVersion | undefined) => {
      form.reset(toVersionFormValues(detail, version));
      setSelectedCustomer({
        id: detail.customer.id,
        customerCode: detail.customer.customerCode,
        name: detail.customer.name,
        imageUrl: detail.customer.imageUrl,
      });
      const nextLines = toEditableLines(detail, version?.id);
      setFeeLines(
        nextLines.length > 0
          ? nextLines
          : [createDefaultContractFeeLine(detail.startDate)],
      );
      setFeeEditorKey(`${editingContractId}:${version?.id ?? 'no-version'}`);
    },
    [editingContractId, form],
  );

  const templateQuery = useQuery({
    queryKey: ['project', 'contract-templates', 'detail', tenantId, templateId],
    queryFn: () => {
      if (!tenantId || !templateId) throw new Error('Thiếu mẫu hợp đồng.');
      return loadContractTemplateDetail(tenantId, templateId);
    },
    enabled: Boolean(tenantId && templateId && isTemplateMode),
  });

  useEffect(() => {
    const detail = editDetailQuery.data;
    if (
      !detail ||
      !editingContractId ||
      mappedEditIdRef.current === editingContractId
    ) {
      return;
    }

    const defaultVersion =
      detail.versions.find((version) => version.status === 'draft') ??
      detail.activeVersion ??
      detail.versions[0];
    setSelectedEditVersionId(defaultVersion?.id ?? null);
    setPlannedEffectiveFrom(defaultVersion?.effectiveFrom ?? null);
    loadVersionIntoEditor(detail, defaultVersion);
    setStep(1);
    setMaxStep(1);
    mappedEditIdRef.current = editingContractId;
  }, [editDetailQuery.data, editingContractId, form, loadVersionIntoEditor]);

  useEffect(() => {
    if (editingContractId || templateId) return;

    mappedEditIdRef.current = null;
    form.reset({
      ...contractDefaultValues,
      currencyCode: CURRENT_CURRENCY_CODE,
    });
    setSelectedCustomer(undefined);
    setFeeLines([
      createDefaultContractFeeLine(contractDefaultValues.startDate),
    ]);
    setFeeEditorKey('create');
    setSelectedEditVersionId(null);
    setPlannedEffectiveFrom(null);
    setStep(1);
    setMaxStep(1);
  }, [editingContractId, form, templateId]);

  useEffect(() => {
    const template = templateQuery.data;
    if (
      !isTemplateMode ||
      !templateId ||
      !template ||
      mappedTemplateIdRef.current === templateId
    ) {
      return;
    }

    const startDate = contractDefaultValues.startDate;
    const endDate = contractDefaultValues.endDate;
    const latestVersion = template.versions[0];
    const templateLines = template.lines
      .filter((line) => line.templateVersionId === latestVersion?.id)
      .map((line) => ({
        direction: line.direction,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        billingType: line.billingType,
        billingUnit: line.billingType === 'recurring' ? line.billingUnit : null,
        billingInterval:
          line.billingType === 'recurring' ? line.billingInterval : null,
        chargeDate: line.billingType === 'one_time' ? startDate : null,
        dueRule: line.dueRule,
        dueDays: line.dueDays,
        startDate,
        endDate,
      }));

    form.reset({
      ...contractDefaultValues,
      contractCode: `${template.code}-${startDate.replaceAll('-', '')}`,
      name: template.name,
      currencyCode: CURRENT_CURRENCY_CODE,
      autoRenew: template.autoRenewDefault,
      note: template.note,
    });
    setSelectedCustomer(undefined);
    setFeeLines(
      templateLines.length > 0
        ? templateLines
        : [createDefaultContractFeeLine(startDate)],
    );
    setFeeEditorKey(`template:${templateId}:${latestVersion?.id ?? 'empty'}`);
    setSelectedEditVersionId(null);
    setPlannedEffectiveFrom(null);
    setStep(1);
    setMaxStep(1);
    mappedTemplateIdRef.current = templateId;
  }, [form, isTemplateMode, templateId, templateQuery.data]);
  const editableVersions = (editDetailQuery.data?.versions ?? []).filter(
    (version) => version.status === 'draft' || version.status === 'effective',
  );
  const selectedEditVersion = editableVersions.find(
    (version) => version.id === selectedEditVersionId,
  );
  const selectedEditVersionTextClass =
    selectedEditVersion?.status === 'effective'
      ? 'text-[var(--color-primary-accent,var(--color-blue-700))]'
      : selectedEditVersion?.status === 'draft'
        ? 'text-[var(--color-warning-accent,var(--color-yellow-700))]'
        : 'text-secondary-foreground';

  function handleEditVersionChange(versionId: string) {
    const detail = editDetailQuery.data;
    const version = detail?.versions.find((item) => item.id === versionId);
    if (!detail || !version) return;

    setSelectedEditVersionId(versionId);
    const existingDraft = detail.versions.find(
      (item) => item.status === 'draft',
    );
    setPlannedEffectiveFrom(
      version.status === 'draft'
        ? version.effectiveFrom
        : (existingDraft?.effectiveFrom ?? null),
    );
    loadVersionIntoEditor(detail, version);
  }

  const saveMutation = useMutation({
    mutationFn: async ({
      values,
      lines,
      metadata,
      source,
      effectiveFrom,
    }: {
      values: Parameters<typeof createContract>[2];
      lines: ContractVersionLineValuesForApi[];
      metadata: Parameters<typeof createContract>[4];
      source?: Parameters<typeof createContract>[5];
      effectiveFrom: string | null;
    }) => {
      if (!userId || !tenantId) {
        throw new Error('Chưa xác định tài khoản hoặc tenant.');
      }
      const savedContract =
        isEditMode && editingContractId
          ? await updateContract(
              editingContractId,
              userId,
              values,
              lines,
              metadata,
              effectiveFrom,
            )
          : await createContract(
              tenantId,
              userId,
              values,
              lines,
              metadata,
              source,
              effectiveFrom,
            );

      const shouldApplyImmediately = effectiveFrom === todayIso();
      if (shouldApplyImmediately) {
        const savedDetail = await loadContractDetail(
          userId,
          savedContract.id,
          tenantId,
        );
        await activateContract(savedDetail, userId, undefined, {
          effectiveFrom: todayIso(),
        });
      }

      return { contract: savedContract, applied: shouldApplyImmediately };
    },
    onSuccess: ({ contract, applied }) => {
      toast.success(
        applied
          ? `Đã lưu và áp dụng phiên bản mới.`
          : isEditMode
            ? 'Đã cập nhật hợp đồng nháp.'
            : 'Đã tạo hợp đồng nháp.',
      );
      navigate(buildPath(ROUTES.PROJECT.CONTRACT_DETAIL, { id: contract.id }));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function handleCancel() {
    if (isEditMode && editingContractId) {
      navigate(
        buildPath(ROUTES.PROJECT.CONTRACT_DETAIL, {
          id: editingContractId,
        }),
      );
      return;
    }
    if (isTemplateMode) {
      navigate(ROUTES.PROJECT.CONTRACT_TEMPLATES);
      return;
    }
    navigate(ROUTES.PROJECT.CONTRACTS);
  }

  async function handleNext() {
    if (step === 1) {
      if (!(await form.trigger())) return;

      const areFeeLinesValid = feeLinesEditorRef.current
        ? await feeLinesEditorRef.current.validate()
        : true;
      if (!areFeeLinesValid) {
        toast.error('Vui lòng kiểm tra lại các khoản phí.');
        return;
      }

      beginVersionCheck();
    }
  }

  function beginVersionCheck() {
    const runId = ++versionCheckRunRef.current;
    setVersionCheck(null);
    setChargeChanges(null);
    setProcessingState('checking-charges');
    setStep(2);
    setMaxStep((current) => Math.max(current, 2));

    window.setTimeout(() => {
      if (runId !== versionCheckRunRef.current) return;

      const latestVersion = editDetailQuery.data?.versions[0];
      const result = getContractVersionChangeCheck({
        latestVersion: latestVersion
          ? {
              ...latestVersion,
              // Compare against the contract's persisted start date. A
              // version's effective date may be normalized to today while
              // the contract start date itself remains unchanged.
              termsSnapshot: {
                ...latestVersion.termsSnapshot,
                startDate: editDetailQuery.data?.startDate,
              },
            }
          : undefined,
        latestLines: (editDetailQuery.data?.lines ?? []).filter(
          (line) => line.contractVersionId === latestVersion?.id,
        ),
        values: form.getValues(),
        lines: feeLines.map(({ sourceLineId, ...line }, sortOrder) => ({
          ...line,
          id: sourceLineId,
          sortOrder,
        })),
      });
      const termDifferences = latestVersion
        ? getContractVersionTermDifferences({
            termsSnapshot: {
              ...latestVersion.termsSnapshot,
              startDate: editDetailQuery.data?.startDate,
            },
            values: form.getValues(),
          })
        : [];
      console.groupCollapsed(`[ContractVersionCheck][UI] run ${runId}`);
      console.log('latest version', JSON.stringify(latestVersion ?? null));
      console.log('term differences', JSON.stringify(termDifferences));
      console.log(
        'latest lines',
        JSON.stringify(
          (editDetailQuery.data?.lines ?? []).filter(
            (line) => line.contractVersionId === latestVersion?.id,
          ),
        ),
      );
      console.log('submitted lines', JSON.stringify(feeLines));
      console.log('result', JSON.stringify(result));
      console.groupEnd();
      setChargeChanges(result.chargeChanges);
      setProcessingState('checking-version');

      window.setTimeout(() => {
        if (runId !== versionCheckRunRef.current) return;
        setVersionCheck(result);
        setProcessingState('complete');
      }, 300);
    }, 450);
  }

  async function handleSave() {
    if (!(await form.trigger())) {
      setStep(1);
      return;
    }

    const areFeeLinesValid = feeLinesEditorRef.current
      ? await feeLinesEditorRef.current.validate()
      : true;
    if (!areFeeLinesValid) {
      toast.error('Vui lòng kiểm tra lại các khoản phí.');
      setStep(2);
      return;
    }

    if (step < 2) {
      beginVersionCheck();
      return;
    }

    const values = form.getValues();
    const effectiveFrom =
      versionCheck?.action === 'keep-current' ? null : plannedEffectiveFrom;
    const activeEffectiveFrom =
      editDetailQuery.data?.activeVersion?.effectiveFrom;
    if (
      effectiveFrom &&
      activeEffectiveFrom &&
      effectiveFrom <= activeEffectiveFrom
    ) {
      toast.error(
        'Ngày dự kiến áp dụng phải sau ngày hiệu lực của phiên bản hiện tại.',
      );
      return;
    }
    saveMutation.mutate({
      values,
      lines: feeLines,
      effectiveFrom,
      metadata: {
        responsibleEmployeeIds: values.responsibleEmployeeIds,
        tagIds: values.tagIds,
        attachmentIdsToKeep: (editDetailQuery.data?.attachments ?? []).map(
          (attachment) => attachment.id,
        ),
        attachments: [],
      },
      source:
        isTemplateMode && templateQuery.data && templateId
          ? {
              templateId,
              templateVersionId: templateQuery.data.versions[0]?.id ?? '',
            }
          : undefined,
    });
  }

  const isLoadingEditData = isEditMode && editDetailQuery.isPending;
  const isLoadingTemplateData = isTemplateMode && templateQuery.isPending;
  if (isTenantPending || isLoadingEditData || isLoadingTemplateData) {
    return (
      <PageLoading
        label={
          isEditMode
            ? 'Đang tải dữ liệu hợp đồng...'
            : 'Đang tải dữ liệu tạo hợp đồng...'
        }
        className="h-full"
      />
    );
  }

  const pageError = editDetailQuery.error ?? templateQuery.error;
  if (editDetailQuery.isError || templateQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center p-4 lg:p-5">
        <Card className="max-w-lg text-center">
          <CardHeader>
            <CardHeading>
              <CardTitle>
                Không tải được dữ liệu{' '}
                {isEditMode
                  ? 'hợp đồng'
                  : isTemplateMode
                    ? 'mẫu hợp đồng'
                    : 'tạo hợp đồng'}
              </CardTitle>
              <CardDescription className="mt-2">
                {getApiErrorMessage(pageError)}
              </CardDescription>
            </CardHeading>
          </CardHeader>
          <CardContent className="flex justify-center gap-2 pt-0">
            <Button
              variant="outline"
              onClick={() => navigate(ROUTES.PROJECT.CONTRACTS)}
            >
              Danh sách hợp đồng
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void (isEditMode
                  ? editDetailQuery.refetch()
                  : isTemplateMode
                    ? templateQuery.refetch()
                    : currenciesQuery.refetch());
              }}
            >
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <Stepper
        value={step}
        onValueChange={(nextStep) => {
          if (nextStep === 2 && step !== 2) {
            void handleNext();
          } else {
            setStep(nextStep);
          }
        }}
        variant="success"
        className="flex min-h-0 flex-1 flex-col gap-admin-page-section"
      >
        <PageHeader
          title={isEditMode ? 'Chỉnh sửa hợp đồng' : 'Thêm hợp đồng'}
          icon={FileText}
          backLabel="Quay lại chi tiết hợp đồng"
          onBack={isEditMode ? handleCancel : undefined}
          titleAside={
            isEditMode && editableVersions.length > 0 ? (
              <Select
                value={selectedEditVersionId ?? undefined}
                onValueChange={handleEditVersionChange}
              >
                <SelectTrigger
                  className={cn('w-[220px]', selectedEditVersionTextClass)}
                >
                  <SelectValue
                    className={selectedEditVersionTextClass}
                    placeholder="Chọn phiên bản"
                  />
                </SelectTrigger>
                <SelectContent>
                  {editableVersions.map((version) => (
                    <SelectItem
                      key={version.id}
                      value={version.id}
                      className={
                        version.status === 'effective'
                          ? 'text-[var(--color-primary-accent,var(--color-blue-700))]'
                          : 'text-[var(--color-warning-accent,var(--color-yellow-700))]'
                      }
                    >
                      v{version.versionNo} ·{' '}
                      {version.status === 'draft' ? 'Bản nháp' : 'Đang áp dụng'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null
          }
          actions={
            <StepperNav className="w-auto gap-2">
              {STEPS.map((item, index) => {
                const Icon = item.icon;
                const isLocked = item.value > maxStep;
                return (
                  <Fragment key={item.value}>
                    <div
                      className={cn(
                        'flex min-w-0 items-center',
                        index < STEPS.length - 1 ? 'flex-1' : 'shrink-0',
                      )}
                    >
                      <StepperItem
                        step={item.value}
                        completed={item.value < step}
                        disabled={isLocked}
                        fill={false}
                        className="min-w-0 justify-start"
                      >
                        {isLocked ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="min-w-0">
                                <StepTriggerContent
                                  icon={Icon}
                                  label={item.label}
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Hoàn thành bước trước để mở bước này
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <StepTriggerContent icon={Icon} label={item.label} />
                        )}
                      </StepperItem>
                      {index < STEPS.length - 1 ? (
                        <StepperConnector
                          aria-hidden="true"
                          completed={item.value < step}
                        />
                      ) : null}
                    </div>
                  </Fragment>
                );
              })}
            </StepperNav>
          }
        />

        <StepperPanel className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <StepperContent
            value={1}
            className="flex min-h-full flex-col gap-admin-page-section"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardHeading>
                  <CardTitle>Thông tin hợp đồng</CardTitle>
                </CardHeading>
              </CardHeader>
              <CardContent className="pt-0">
                <ContractForm
                  form={form}
                  onSubmit={() => undefined}
                  selectedCustomer={selectedCustomer}
                  onCustomerSelect={setSelectedCustomer}
                />
              </CardContent>
            </Card>

            <div className="flex min-h-[32rem] min-h-0 flex-1 flex-col overflow-hidden">
              <ContractFeeLinesEditor
                key={feeEditorKey}
                ref={feeLinesEditorRef}
                lines={feeLines}
                onChange={setFeeLines}
                currencyField={
                  <ContractCurrencyField
                    form={form}
                    options={currencyCodeOptions}
                  />
                }
              />
            </div>
          </StepperContent>

          <StepperContent value={2} className="min-h-full">
            <Card className="min-h-[32rem] overflow-hidden">
              <CardHeader className="pb-3">
                <CardHeading>
                  <CardTitle>Xác nhận hợp đồng</CardTitle>
                  <CardDescription>
                    Kiểm tra thay đổi trước khi lưu hợp đồng.
                  </CardDescription>
                </CardHeading>
              </CardHeader>
              <CardContent className="min-h-[28rem] flex-1 p-0">
                <ContractConfirmationProcessing
                  state={processingState}
                  chargeChanges={chargeChanges}
                  result={versionCheck}
                  currencyCode={form.getValues('currencyCode')}
                  plannedEffectiveFrom={plannedEffectiveFrom}
                  onPlannedEffectiveFromChange={setPlannedEffectiveFrom}
                />
              </CardContent>
            </Card>
          </StepperContent>
        </StepperPanel>
      </Stepper>

      <div className="flex shrink-0 items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Hủy
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
          >
            <ArrowLeft />
            Bước trước
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={step === STEPS.length}
            onClick={() => void handleNext()}
          >
            Bước tiếp theo
            <ArrowRight />
          </Button>
          <div aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
          <ShortcutTooltip
            label={step === 2 ? 'Lưu hợp đồng' : 'Xem xác nhận'}
            shortcut="Ctrl/Cmd + S"
          >
            <Button
              type="button"
              variant="primary"
              disabled={
                saveMutation.isPending ||
                (step === 2 &&
                  (processingState !== 'complete' || !versionCheck))
              }
              loading={saveMutation.isPending}
              loadingText="Đang lưu..."
              onClick={() => void handleSave()}
            >
              {step === 2 ? <Save /> : <ArrowRight />}
              {step === 2 ? 'Xác nhận & lưu' : 'Xem xác nhận'}
            </Button>
          </ShortcutTooltip>
        </div>
      </div>
    </div>
  );
}

function StepTriggerContent({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <StepperTrigger className="min-w-0 px-1 text-left">
      <StepperIndicator className="data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground">
        <Icon className="size-3.5" />
      </StepperIndicator>
      <span className="hidden min-w-0 sm:flex">
        <StepperTitle className="truncate data-[state=inactive]:text-muted-foreground">
          {label}
        </StepperTitle>
      </span>
    </StepperTrigger>
  );
}
