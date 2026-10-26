// Live P06 test only. Uses a normal P06 user JWT through PostgREST/Auth.
// Secrets are loaded in-process from ignored temp/ files and never written.
import fs from 'node:fs';
import { session, fixtures } from './uat-client.mjs';

const f = fixtures();
const p06 = await session('P06');
const evidence = {
  profile: 'P06',
  runAt: new Date().toISOString(),
  authUserId: p06.userId,
  cases: [],
  mutation: {},
  transfer: {},
};

function errorText(data) {
  if (!data) return undefined;
  if (typeof data === 'string') return data.slice(0, 180);
  const value = data.message ?? data.msg ?? data.error_description ?? data.error;
  return typeof value === 'string' ? value.slice(0, 180) : undefined;
}
function result(label, r, safeData = undefined) {
  const entry = { label, status: r.status, ok: r.ok };
  if (r.ok) entry.data = safeData ?? r.data;
  else entry.error = errorText(r.data);
  evidence.cases.push(entry);
  return r;
}
function idsOf(items = []) { return items.map((x) => x.id); }
function materialSummary(m) {
  if (!m || typeof m !== 'object') return m;
  return {
    id: m.id, code: m.code, ownerPartyId: m.ownerPartyId,
    borrowerPartyId: m.borrowerPartyId, status: m.status,
    reservationStatus: m.reservationStatus, note: m.note, version: m.version,
  };
}
function handoverSummary(h) {
  if (!h || typeof h !== 'object') return h;
  return { id: h.id, code: h.code, type: h.type, status: h.status,
    senderPartyId: h.senderParty?.id, recipientPartyId: h.recipientParty?.id,
    version: h.version, itemIds: (h.items ?? []).map((x) => x.materialId) };
}

const m = f.materials;
const h = f.handovers;
const parties = f.parties;

// Positive and negative scoped material list controls.
const materialList = await p06.rpc('list_materials', { p_filters: { page: 1, pageSize: 100 } });
result('materials.list.all', materialList, materialList.ok ? {
  total: materialList.data.total,
  ids: idsOf(materialList.data.items ?? []),
  fixtureCodes: (materialList.data.items ?? []).map((x) => x.code).filter((x) => /^UAT-M-/.test(x ?? '')),
} : undefined);
for (const [label, id] of [['X', m['UAT-M-X']], ['Y', m['UAT-M-Y']], ['K1', m['UAT-M-K1']], ['K2', m['UAT-M-K2']]]) {
  const r = await p06.rpc('list_materials', { p_filters: { page: 1, pageSize: 20, id } });
  result(`materials.list.${label}`, r, r.ok ? { total: r.data.total, ids: idsOf(r.data.items ?? []) } : undefined);
}

// Detail and history by known IDs.
const materialDetails = {};
for (const [label, id] of [['X', m['UAT-M-X']], ['X_MUTATE', m['UAT-M-X-MUTATE']], ['X_FLOW', m['UAT-M-X-FLOW']], ['Y', m['UAT-M-Y']], ['Y_MUTATE', m['UAT-M-Y-MUTATE']], ['K1', m['UAT-M-K1']], ['K2', m['UAT-M-K2']]]) {
  const r = await p06.rpc('get_material', { p_id: id });
  if (r.ok) materialDetails[label] = r.data;
  result(`materials.detail.${label}`, r, r.ok ? materialSummary(r.data) : undefined);
  const hist = await p06.rpc('list_material_history', { p_material_id: id });
  result(`materials.history.${label}`, hist, hist.ok ? { count: Array.isArray(hist.data) ? hist.data.length : null, entries: hist.data } : undefined);
}

// Raw PostgREST table reads use the same P06 JWT.
for (const [label, id] of [['X', m['UAT-M-X']], ['Y', m['UAT-M-Y']], ['Y_MUTATE', m['UAT-M-Y-MUTATE']], ['K1', m['UAT-M-K1']]]) {
  const path = `/rest/v1/materials?select=id,code,owner_party_id,borrower_party_id,status,note,version&id=eq.${encodeURIComponent(id)}`;
  const r = await p06.request(path, undefined, 'GET');
  result(`materials.table.${label}`, r, r.ok ? r.data : undefined);
}

// Inspect party options. Contract intentionally exposes the minimal selector fields.
const counterparty = await p06.rpc('list_handover_counterparty_options', { p_party_id: parties.X });
result('handover.counterparty_options.X', counterparty, counterparty.ok ? {
  count: counterparty.data.length,
  fields: [...new Set(counterparty.data.flatMap((x) => Object.keys(x)))].sort(),
  options: counterparty.data.map(({ id, type, code, name }) => ({ id, type, code, name })),
} : undefined);

const handoverDetails = {};
for (const [label, id] of [['X_A1', h['UAT-H-X-A1']], ['Y_B1', h['UAT-H-Y-B1']], ['K1_A1', h['UAT-H-K1-A1']]]) {
  const r = await p06.rpc('get_handover', { p_id: id });
  if (r.ok) handoverDetails[label] = r.data;
  result(`handover.detail.${label}`, r, r.ok ? handoverSummary(r.data) : undefined);
  const hist = await p06.rpc('list_handover_history', { p_handover_id: id });
  result(`handover.history.${label}`, hist, hist.ok ? { count: Array.isArray(hist.data) ? hist.data.length : null, entries: hist.data } : undefined);
}
const handoverList = await p06.rpc('list_handovers', { p_filters: { page: 1, pageSize: 100 } });
result('handover.list.all', handoverList, handoverList.ok ? {
  total: handoverList.data.total,
  items: (handoverList.data.items ?? []).map(handoverSummary),
} : undefined);
const yHandoverList = await p06.rpc('list_handovers', { p_filters: {
  page: 1, pageSize: 20, senderPartyId: parties.Y,
} });
result('handover.list.senderY', yHandoverList, yHandoverList.ok ? {
  total: yHandoverList.data.total, ids: idsOf(yHandoverList.data.items ?? []),
} : undefined);
const directHandovers = await p06.request(
  `/rest/v1/material_handovers?select=id,code,sender_party_id,recipient_party_id,status&id=eq.${encodeURIComponent(h['UAT-H-Y-B1'])}`,
  undefined, 'GET');
result('handover.table.Y_B1', directHandovers, directHandovers.ok ? directHandovers.data : undefined);

// Mutate only the designated X fixture, then restore its original note.
const xMutate = materialDetails.X_MUTATE;
if (!xMutate) throw new Error('P06 cannot read UAT-M-X-MUTATE; mutation case cannot safely proceed');
const originalNote = xMutate.note ?? null;
const changedNote = `P06 UAT mutation ${new Date().toISOString()}`;
const valuesFor = (item, note) => ({
  code: item.code,
  modelId: item.modelId,
  nameOverride: item.nameOverride,
  descriptionOverride: item.descriptionOverride,
  specificationOverrides: item.specificationOverrides ?? {},
  specificationOverrideLabels: item.specificationOverrideLabels ?? {},
  serialNumber: item.serialNumber,
  ownerPartyId: item.ownerPartyId,
  condition: item.condition,
  note,
  images: (item.images ?? []).map((image, i) => ({
    storage_bucket: image.storageBucket ?? null,
    storage_path: image.storagePath ?? null,
    external_url: image.externalUrl ?? null,
    sort_order: image.sortOrder ?? i,
    is_cover: Boolean(image.isCover),
  })),
});
const saveX = await p06.rpc('save_material', {
  p_id: xMutate.id,
  p_expected_version: xMutate.version,
  p_values: valuesFor(xMutate, changedNote),
});
evidence.mutation.allowedX = {
  status: saveX.status, ok: saveX.ok,
  error: saveX.ok ? undefined : errorText(saveX.data),
  id: saveX.ok ? saveX.data : undefined,
  before: materialSummary(xMutate),
};
const afterX = await p06.rpc('get_material', { p_id: xMutate.id });
evidence.mutation.allowedX.after = afterX.ok ? materialSummary(afterX.data) : { status: afterX.status, error: errorText(afterX.data) };
if (saveX.ok && afterX.ok) {
  const restore = await p06.rpc('save_material', {
    p_id: xMutate.id,
    p_expected_version: afterX.data.version,
    p_values: valuesFor(afterX.data, originalNote),
  });
  const restored = await p06.rpc('get_material', { p_id: xMutate.id });
  evidence.mutation.allowedX.restore = {
    status: restore.status, ok: restore.ok,
    after: restored.ok ? materialSummary(restored.data) : { status: restored.status, error: errorText(restored.data) },
  };
}

// Attempt the corresponding Y mutation through P06, and capture any visible state before/after.
const yMutate = await p06.rpc('get_material', { p_id: m['UAT-M-Y-MUTATE'] });
const yBefore = yMutate.ok ? materialSummary(yMutate.data) : null;
const deniedY = await p06.rpc('save_material', {
  p_id: m['UAT-M-Y-MUTATE'],
  p_expected_version: yMutate.ok ? yMutate.data.version : 1,
  p_values: yMutate.ok ? valuesFor(yMutate.data, `P06 forbidden attempt ${new Date().toISOString()}`) : {
    code: 'UAT-M-Y-MUTATE', modelId: f.modelId, ownerPartyId: parties.Y,
    condition: 'good', specificationOverrides: {}, specificationOverrideLabels: {},
    images: [], note: `P06 forbidden attempt ${new Date().toISOString()}`,
  },
});
const yAfter = await p06.rpc('get_material', { p_id: m['UAT-M-Y-MUTATE'] });
evidence.mutation.deniedY = {
  status: deniedY.status, ok: deniedY.ok,
  error: deniedY.ok ? undefined : errorText(deniedY.data),
  before: yBefore,
  after: yAfter.ok ? materialSummary(yAfter.data) : null,
  beforeReadStatus: yMutate.status,
  afterReadStatus: yAfter.status,
  directTableVisible: (() => {
    const table = evidence.cases.find((x) => x.label === 'materials.table.Y_MUTATE');
    return table?.ok ? table.data.length > 0 : null;
  })(),
  rootCrossCheck: {
    source: 'P00 privileged verification reported by coordinator',
    verified: true,
    id: '165699e3-f180-406b-94a9-dd929521ab9a',
    code: 'UAT-M-Y-MUTATE',
    ownerPartyId: parties.Y,
    note: 'UAT baseline',
    version: 1,
  },
};

// Create and send a standard transfer X -> Y, leaving it pending for P07.
const xFlow = materialDetails.X_FLOW;
if (!xFlow) throw new Error('P06 cannot read UAT-M-X-FLOW; transfer flow cannot safely proceed');
const saveHandover = await p06.rpc('save_handover', {
  p_id: null,
  p_values: {
    type: 'transfer', senderPartyId: parties.X, recipientPartyId: parties.Y,
    senderRepresentativeUserId: p06.userId,
    recipientRepresentativeUserId: f.accounts.P07.id,
    plannedDate: new Date().toISOString().slice(0, 10),
    dueDate: null, note: 'P06 UAT X to Y transfer',
    items: [{ materialId: xFlow.id, condition: xFlow.condition ?? 'good', conditionNote: null, note: null }],
    attachmentFileIds: [],
  },
});
evidence.transfer.create = { status: saveHandover.status, ok: saveHandover.ok,
  id: saveHandover.ok ? saveHandover.data : undefined,
  error: saveHandover.ok ? undefined : errorText(saveHandover.data) };
if (saveHandover.ok) {
  const id = saveHandover.data;
  const draft = await p06.rpc('get_handover', { p_id: id });
  evidence.transfer.draft = { status: draft.status, ok: draft.ok, data: draft.ok ? handoverSummary(draft.data) : undefined };
  const version = draft.ok ? draft.data.version : 1;
  const sent = await p06.rpc('act_on_handover', {
    p_id: id, p_action: 'send', p_expected_version: version, p_note: null, p_item_conditions: [],
  });
  evidence.transfer.send = { status: sent.status, ok: sent.ok,
    error: sent.ok ? undefined : errorText(sent.data) };
  const pending = await p06.rpc('get_handover', { p_id: id });
  evidence.transfer.pending = { status: pending.status, ok: pending.ok,
    data: pending.ok ? handoverSummary(pending.data) : undefined };
  evidence.transfer.id = id;
  evidence.transfer.materialId = xFlow.id;

  evidence.transfer.p07Confirm = { status: null, ok: null, skipped: 'Reserved for P07 read-only viewer test' };
}

const outputPath = 'docs/testing/results/2026-10-22/p06-evidence.json';
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ outputPath, cases: evidence.cases.length, transferId: evidence.transfer.id ?? null,
  mutation: { allowedX: evidence.mutation.allowedX, deniedY: evidence.mutation.deniedY },
  transfer: evidence.transfer }, null, 2));
