import fs from 'node:fs';
import path from 'node:path';
import { session, fixtures } from './uat-client.mjs';

const f = fixtures();
const p01 = await session('P01');
const results = [];
const safeError = (value) => {
  if (!value || typeof value !== 'object') return String(value ?? '');
  return String(value.message || value.details || value.hint || value.error || JSON.stringify(value)).slice(0, 500);
};
const noteCase = (name, outcome, detail = {}) => results.push({ name, outcome, ...detail });
const rpc = async (name, body) => p01.rpc(name, body);
const visibleMaterial = async (id) => rpc('get_material', { p_id: id });
const unwrapItems = (data) => Array.isArray(data?.items) ? data.items : [];
const field = (obj, camel, snake) => obj?.[camel] ?? obj?.[snake] ?? null;
const imagePayload = (items) => (Array.isArray(items) ? items : []).map((image) => ({
  storage_bucket: field(image, 'storageBucket', 'storage_bucket'),
  storage_path: field(image, 'storagePath', 'storage_path'),
  external_url: field(image, 'externalUrl', 'external_url'),
  sort_order: field(image, 'sortOrder', 'sort_order') ?? 0,
  is_cover: field(image, 'isCover', 'is_cover') ?? false,
}));
const materialPayload = (m, note) => ({
  code: m.code,
  modelId: field(m, 'modelId', 'model_id'),
  nameOverride: field(m, 'nameOverride', 'name_override'),
  descriptionOverride: field(m, 'descriptionOverride', 'description_override'),
  specificationOverrides: field(m, 'specificationOverrides', 'specification_overrides') ?? {},
  specificationOverrideLabels: field(m, 'specificationOverrideLabels', 'specification_override_labels') ?? {},
  serialNumber: field(m, 'serialNumber', 'serial_number'),
  ownerPartyId: field(m, 'ownerPartyId', 'owner_party_id'),
  condition: m.condition,
  note,
  images: imagePayload(m.images),
});
const materialBrief = (m) => m && typeof m === 'object' ? {
  id: m.id,
  code: m.code,
  ownerPartyId: field(m, 'ownerPartyId', 'owner_party_id'),
  note: m.note ?? null,
  version: m.version ?? null,
  status: m.status ?? null,
} : null;
const recordRpc = (name, response, expected, extra = {}) => {
  const outcome = response.ok === expected ? 'pass' : 'fail';
  noteCase(name, outcome, {
    httpStatus: response.status,
    expected: expected ? 'success' : 'denied',
    ...(response.ok ? { result: extra.result ?? (Array.isArray(response.data) ? { count: response.data.length } : undefined) } : { error: safeError(response.data) }),
    ...extra,
  });
  return response;
};

const identity = await rpc('get_my_qrcode_account');
const identityData = identity.data;
const identityMatches = identity.ok && identityData?.userId === p01.userId
  && identityData?.epsEmployeeId === 'EPS-MOCK-E001'
  && identityData?.epsEmployeeCode === 'MOCK-E001'
  && identityData?.epsDepartmentId === 'EPS-MOCK-D01'
  && identityData?.epsTeamId === 'EPS-MOCK-T01';
noteCase('P01 identity and organization from get_my_qrcode_account', identityMatches ? 'pass' : identity.ok ? 'fail' : 'blocked', {
  httpStatus: identity.status,
  result: identity.ok ? {
    userId: identityData?.userId,
    accountType: identityData?.accountType,
    epsEmployeeCode: identityData?.epsEmployeeCode,
    epsDepartmentId: identityData?.epsDepartmentId,
    epsTeamId: identityData?.epsTeamId,
    externalOrganizationId: identityData?.externalOrganizationId ?? null,
  } : undefined,
  ...(!identity.ok ? { error: safeError(identity.data) } : {}),
});

const scopeChecks = [
  ['material:view DA', 'materials:material:view', 'DA', true],
  ['material:view A1', 'materials:material:view', 'A1', true],
  ['material:view A2', 'materials:material:view', 'A2', true],
  ['material:view E001', 'materials:material:view', 'E001', true],
  ['material:view E003', 'materials:material:view', 'E003', true],
  ['material:view DB', 'materials:material:view', 'DB', false],
  ['material:view E004', 'materials:material:view', 'E004', false],
  ['material:view E005', 'materials:material:view', 'E005', false],
  ['material:view X', 'materials:material:view', 'X', false],
  ['material:view K1', 'materials:material:view', 'K1', false],
  ['material:manage A1', 'materials:material:manage', 'A1', true],
  ['material:manage E001', 'materials:material:manage', 'E001', true],
  ['material:manage E003', 'materials:material:manage', 'E003', false],
  ['material:manage A2', 'materials:material:manage', 'A2', false],
  ['material:manage DA', 'materials:material:manage', 'DA', false],
  ['handover:manage A1', 'materials:handover:manage', 'A1', true],
  ['handover:manage A2', 'materials:handover:manage', 'A2', false],
];
for (const [name, permission, party, expected] of scopeChecks) {
  const response = await rpc('has_scoped_permission', {
    required_permission_code: permission,
    target_party_id: f.parties[party],
  });
  const actual = response.ok ? response.data === true : null;
  noteCase(`effective scope ${name}`, actual === expected ? 'pass' : response.ok ? 'fail' : 'blocked', {
    httpStatus: response.status,
    permission,
    party,
    expected,
    actual,
    ...(!response.ok ? { error: safeError(response.data) } : {}),
  });
}

const materialIds = {
  DA: f.materials['UAT-M-DA'],
  A1: f.materials['UAT-M-A1'],
  A2: f.materials['UAT-M-A2'],
  E001: f.materials['UAT-M-E001'],
  E003: f.materials['UAT-M-E003'],
  DB: f.materials['UAT-M-DB'],
  B1: f.materials['UAT-M-B1'],
  E004: f.materials['UAT-M-E004'],
  E005: f.materials['UAT-M-E005'],
  X: f.materials['UAT-M-X'],
  Y: f.materials['UAT-M-Y'],
  K1: f.materials['UAT-M-K1'],
  K2: f.materials['UAT-M-K2'],
};
const list = await rpc('list_materials', { p_filters: { page: 1, pageSize: 100 } });
const listedIds = unwrapItems(list.data).map((m) => m.id);
const listExpectedVisible = ['DA', 'A1', 'A2', 'E001', 'E003'];
const listExpectedHidden = ['DB', 'B1', 'E004', 'E005', 'X', 'Y', 'K1', 'K2'];
const listMatches = list.ok && listExpectedVisible.every((k) => listedIds.includes(materialIds[k]))
  && listExpectedHidden.every((k) => !listedIds.includes(materialIds[k]));
noteCase('materials list scope (department view, team manage)', listMatches ? 'pass' : list.ok ? 'fail' : 'blocked', {
  httpStatus: list.status,
  expectedVisible: listExpectedVisible,
  visibleFixtureKeys: Object.entries(materialIds).filter(([, id]) => listedIds.includes(id)).map(([k]) => k),
  expectedHidden: listExpectedHidden,
  total: list.data?.total ?? null,
  ...(!list.ok ? { error: safeError(list.data) } : {}),
});

for (const [key, id, expected] of [
  ['A1', materialIds.A1, true], ['A2', materialIds.A2, true], ['DA', materialIds.DA, true],
  ['E001', materialIds.E001, true], ['E003', materialIds.E003, true],
  ['DB', materialIds.DB, false], ['B1', materialIds.B1, false], ['E004', materialIds.E004, false], ['E005', materialIds.E005, false], ['X', materialIds.X, false],
  ['Y', materialIds.Y, false], ['K1', materialIds.K1, false], ['K2', materialIds.K2, false],
]) {
  const response = await visibleMaterial(id);
  const dataExists = response.ok && response.data?.id === id;
  const matches = dataExists === expected;
  noteCase(`material detail ${key}`, matches ? 'pass' : response.ok ? 'fail' : expected ? 'blocked' : 'pass', {
    httpStatus: response.status,
    fixture: key,
    expected: expected ? 'visible' : 'denied',
    ...(response.ok ? { result: materialBrief(response.data) } : { error: safeError(response.data) }),
  });
}

const history = await rpc('list_material_history', { p_material_id: f.materials['UAT-M-A1-MUTATE'] });
noteCase('material history A1 mutation fixture', history.ok && Array.isArray(history.data) ? 'pass' : history.ok ? 'fail' : 'blocked', {
  httpStatus: history.status,
  expected: 'readable array on in-scope material',
  result: history.ok && Array.isArray(history.data) ? { count: history.data.length, actions: history.data.map((r) => r.action) } : undefined,
  ...(!history.ok ? { error: safeError(history.data) } : {}),
});
const deniedHistory = await rpc('list_material_history', { p_material_id: materialIds.DB });
noteCase('material history DB denied', !deniedHistory.ok ? 'pass' : 'fail', {
  httpStatus: deniedHistory.status,
  expected: 'denied',
  ...(deniedHistory.ok ? { error: 'Unexpectedly returned history' } : { error: safeError(deniedHistory.data) }),
});

for (const key of ['A1', 'A2', 'E001', 'E003', 'DB', 'K1']) {
  const id = materialIds[key];
  const response = await p01.request(`/rest/v1/materials?id=eq.${encodeURIComponent(id)}&select=id,code,note,version,owner_party_id`, undefined, 'GET');
  const rows = Array.isArray(response.data) ? response.data : [];
  const expectedVisible = ['A1', 'A2', 'E001', 'E003'].includes(key);
  const matches = response.ok && (expectedVisible ? rows.length === 1 && rows[0].id === id : rows.length === 0);
  noteCase(`direct table materials ${key}`, matches ? 'pass' : response.ok ? 'fail' : 'blocked', {
    httpStatus: response.status,
    expected: expectedVisible ? 'one visible row' : 'zero visible rows',
    result: response.ok ? rows.map((m) => ({ id: m.id, code: m.code, note: m.note ?? null, version: m.version, ownerPartyId: m.owner_party_id })) : undefined,
    ...(!response.ok ? { error: safeError(response.data) } : {}),
  });
}

const ownId = f.materials['UAT-M-A1-MUTATE'];
const crossId = f.materials['UAT-M-A2-MUTATE'];
const ownBefore = await visibleMaterial(ownId);
if (ownBefore.ok) {
  const baseline = ownBefore.data;
  const originalNote = baseline.note ?? null;
  const marker = `P01 live UAT ${new Date().toISOString()}`;
  const update = await rpc('save_material', {
    p_id: ownId,
    p_expected_version: baseline.version,
    p_values: materialPayload(baseline, marker),
  });
  const after = await visibleMaterial(ownId);
  const mutationPassed = update.ok && after.ok && after.data?.note === marker && after.data?.version > baseline.version;
  noteCase('scoped material mutation A1', mutationPassed ? 'pass' : update.ok && after.ok ? 'fail' : 'blocked', {
    status: update.status,
    expected: 'note updated on P01 owned A1 record',
    before: materialBrief(baseline),
    updateResult: update.ok ? { id: update.data } : { error: safeError(update.data) },
    after: after.ok ? materialBrief(after.data) : { error: safeError(after.data) },
  });
  if (update.ok && after.ok) {
    const restore = await rpc('save_material', {
      p_id: ownId,
      p_expected_version: after.data.version,
      p_values: materialPayload(after.data, originalNote),
    });
    const restored = await visibleMaterial(ownId);
    const restoredOk = restore.ok && restored.ok && (restored.data?.note ?? null) === originalNote;
    noteCase('restore A1 mutation fixture note', restoredOk ? 'pass' : restore.ok && restored.ok ? 'fail' : 'blocked', {
      status: restore.status,
      expectedNote: originalNote,
      result: restored.ok ? materialBrief(restored.data) : { error: safeError(restored.data) },
      ...(!restore.ok ? { error: safeError(restore.data) } : {}),
    });
  }
} else {
  noteCase('scoped material mutation A1', 'blocked', { status: ownBefore.status, error: safeError(ownBefore.data) });
}

const crossBefore = await visibleMaterial(crossId);
if (crossBefore.ok) {
  const baseline = crossBefore.data;
  const denied = await rpc('save_material', {
    p_id: crossId,
    p_expected_version: baseline.version,
    p_values: materialPayload(baseline, `P01 denied mutation ${new Date().toISOString()}`),
  });
  const after = await visibleMaterial(crossId);
  const unchanged = after.ok && after.data?.version === baseline.version && (after.data?.note ?? null) === (baseline.note ?? null);
  noteCase('scoped material mutation A2 denied and unchanged', !denied.ok && unchanged ? 'pass' : denied.ok ? 'fail' : after.ok ? 'fail' : 'blocked', {
    status: denied.status,
    expected: 'denied; visible record remains unchanged to P01',
    before: materialBrief(baseline),
    denial: denied.ok ? 'Unexpected success' : safeError(denied.data),
    after: after.ok ? materialBrief(after.data) : { error: safeError(after.data) },
  });
} else {
  noteCase('scoped material mutation A2 denied and unchanged', 'blocked', { status: crossBefore.status, error: safeError(crossBefore.data) });
}

const flowMaterialId = f.materials['UAT-M-A1-FLOW'];
const flowMaterial = await visibleMaterial(flowMaterialId);
if (!flowMaterial.ok) {
  noteCase('handover A1 to A2 using flow fixture', 'blocked', { status: flowMaterial.status, step: 'read fixture', error: safeError(flowMaterial.data) });
} else {
  const handoverValues = {
    type: 'transfer',
    senderPartyId: f.parties.A1,
    recipientPartyId: f.parties.A2,
    senderRepresentativeUserId: p01.userId,
    recipientRepresentativeUserId: null,
    plannedDate: new Date().toISOString().slice(0, 10),
    dueDate: null,
    note: 'P01 live UAT A1 to A2',
    items: [{ materialId: flowMaterialId, condition: flowMaterial.data.condition ?? 'good', note: null }],
    attachmentFileIds: [],
  };
  const draftRequest = { rpc: 'save_handover', p_id: null, p_values: handoverValues };
  const draft = await rpc('save_handover', {
    p_id: null,
    p_values: handoverValues,
  });
  if (!draft.ok) {
    noteCase('handover A1 to A2 draft', 'fail', { status: draft.status, step: 'save_handover', request: draftRequest, response: draft.data });
    noteCase('handover A1 to A2 send', 'blocked', { expected: 'send only after a persisted draft exists', reason: 'Draft creation failed; no handover ID was returned.' });
  } else {
    const handoverId = draft.data;
    const detail = await rpc('get_handover', { p_id: handoverId });
    const version = detail.data?.version;
    noteCase('handover A1 to A2 draft', detail.ok && detail.data?.status === 'draft' ? 'pass' : detail.ok ? 'fail' : 'blocked', {
      status: detail.status,
      handoverId,
      expected: 'draft saved by P01 for A1 to A2',
      result: detail.ok ? { code: detail.data?.code, status: detail.data?.status, version, senderPartyId: detail.data?.senderPartyId, recipientPartyId: detail.data?.recipientPartyId } : undefined,
      ...(!detail.ok ? { error: safeError(detail.data) } : {}),
    });
    if (!detail.ok || !Number.isInteger(version)) {
      noteCase('handover A1 to A2 send', 'blocked', { status: detail.status, handoverId, error: detail.ok ? 'Draft response did not include integer version' : safeError(detail.data) });
    } else {
      const send = await rpc('act_on_handover', { p_id: handoverId, p_action: 'send', p_expected_version: version, p_note: null, p_item_conditions: [] });
      const after = await rpc('get_handover', { p_id: handoverId });
      noteCase('handover A1 to A2 send', send.ok && after.ok && after.data?.status === 'pending' ? 'pass' : send.ok && after.ok ? 'fail' : 'blocked', {
        status: send.status,
        handoverId,
        expected: 'pending after send; receiver action left untouched',
        result: after.ok ? { status: after.data?.status, version: after.data?.version, code: after.data?.code } : undefined,
        ...(!send.ok ? { error: safeError(send.data) } : !after.ok ? { error: safeError(after.data) } : {}),
      });
    }
  }
}

const warehouseHandoverId = '6bc5a75d-1540-4866-a9dc-18c477ada2c9';
const warehouseMaterialId = 'd0b3ea92-c4f1-4b65-862a-df1fdf68be0a';
const warehouseBefore = await rpc('get_handover', { p_id: warehouseHandoverId });
const warehouseItems = Array.isArray(warehouseBefore.data?.items) ? warehouseBefore.data.items : [];
const warehouseItemIds = warehouseItems.map((item) => item.materialId ?? item.material_id ?? item.id);
const warehouseSenderId = warehouseBefore.data?.senderParty?.id ?? null;
const warehouseRecipientId = warehouseBefore.data?.recipientParty?.id ?? null;
const receiverReady = warehouseBefore.ok
  && warehouseBefore.data?.status === 'pending'
  && warehouseRecipientId === f.parties.A1
  && warehouseSenderId === f.parties.K1
  && warehouseItemIds.includes(warehouseMaterialId)
  && Number.isInteger(warehouseBefore.data?.version);
if (!receiverReady) {
  noteCase('P01 receives P04 K1 to A1 warehouse allocation', 'blocked', {
    status: warehouseBefore.status,
    expected: 'pending allocation from K1 to A1 containing the authorized material',
    before: warehouseBefore.ok ? {
      status: warehouseBefore.data?.status,
      mode: warehouseBefore.data?.mode,
      version: warehouseBefore.data?.version,
      senderPartyId: warehouseSenderId,
      recipientPartyId: warehouseRecipientId,
      materialIds: warehouseItemIds,
    } : undefined,
    ...(!warehouseBefore.ok ? { error: safeError(warehouseBefore.data) } : {}),
  });
} else {
  const warehouseRequest = {
    rpc: 'act_on_warehouse_handover',
    p_id: warehouseHandoverId,
    p_action: 'confirm',
    p_expected_version: warehouseBefore.data.version,
    p_note: null,
    p_item_results: [{ materialId: warehouseMaterialId, outcome: 'received', condition: 'good', note: 'P01 UAT receive' }],
  };
  const receive = await rpc('act_on_warehouse_handover', {
    p_id: warehouseHandoverId,
    p_action: 'confirm',
    p_expected_version: warehouseBefore.data.version,
    p_note: null,
    p_item_results: [{ materialId: warehouseMaterialId, outcome: 'received', condition: 'good', note: 'P01 UAT receive' }],
  });
  const warehouseAfter = await rpc('get_handover', { p_id: warehouseHandoverId });
  const materialAfter = await visibleMaterial(warehouseMaterialId);
  const handoverHistory = await rpc('list_handover_history', { p_handover_id: warehouseHandoverId });
  const materialHistory = await rpc('list_material_history', { p_material_id: warehouseMaterialId });
  const handoverHistoryRows = Array.isArray(handoverHistory.data) ? handoverHistory.data : [];
  const materialHistoryRows = Array.isArray(materialHistory.data) ? materialHistory.data : [];
  const allocationComplete = receive.ok && warehouseAfter.ok && warehouseAfter.data?.status === 'completed'
    && materialAfter.ok && field(materialAfter.data, 'ownerPartyId', 'owner_party_id') === f.parties.A1
    && handoverHistory.ok && handoverHistoryRows.some((row) => row.action === 'confirmed')
    && materialHistory.ok && materialHistoryRows.some((row) => row.note?.startsWith(warehouseAfter.data?.code));
  noteCase('P01 receives P04 K1 to A1 warehouse allocation', allocationComplete ? 'pass' : receive.ok ? 'fail' : 'blocked', {
    before: {
      handoverId: warehouseHandoverId,
      status: warehouseBefore.data.status,
      mode: warehouseBefore.data.mode,
      version: warehouseBefore.data.version,
      senderPartyId: warehouseSenderId,
      recipientPartyId: warehouseRecipientId,
      materialIds: warehouseItemIds,
    },
    request: warehouseRequest,
    status: receive.status,
    response: receive.ok ? { id: receive.data } : safeError(receive.data),
    after: {
      handover: warehouseAfter.ok ? { status: warehouseAfter.data?.status, version: warehouseAfter.data?.version } : { error: safeError(warehouseAfter.data) },
      material: materialAfter.ok ? materialBrief(materialAfter.data) : { error: safeError(materialAfter.data) },
      handoverHistory: handoverHistory.ok ? { count: handoverHistoryRows.length, actions: handoverHistoryRows.map((row) => row.action) } : { error: safeError(handoverHistory.data) },
      materialHistory: materialHistory.ok ? { count: materialHistoryRows.length, actions: materialHistoryRows.map((row) => row.action) } : { error: safeError(materialHistory.data) },
    },
    ...(!receive.ok ? { error: safeError(receive.data) } : {}),
  });
}

const counts = Object.fromEntries(['pass', 'fail', 'blocked'].map((status) => [status, results.filter((r) => r.outcome === status).length]));
const report = {
  profile: 'P01',
  runAt: new Date().toISOString(),
  project: f.project,
  authentication: 'Supabase password grant using P01; assertions use P01 JWT only',
  scope: 'P01 profile only; no receiver action; no other profile touched',
  counts,
  cases: results,
};
const outDir = path.resolve('docs/testing/results/2026-10-22');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'p01-live.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ profile: report.profile, runAt: report.runAt, counts, resultPath: 'docs/testing/results/2026-10-22/p01-live.json', cases: results }, null, 2));
