import fs from 'node:fs';
import { session, fixtures } from './uat-client.mjs';

const f = fixtures();
const p02 = await session('P02');
const results = [];
const outputPath = 'docs/testing/results/2026-10-22/p02-evidence.json';
const persist = () => fs.writeFileSync(outputPath, `${JSON.stringify({ profile: 'P02', capturedAt: new Date().toISOString(), cases: results }, null, 2)}\n`);
const safeError = (response) => {
  const data = response?.data;
  if (!data || typeof data !== 'object') return String(data ?? '').slice(0, 220);
  return { code: data.code ?? null, message: String(data.message ?? data.details ?? data.hint ?? data.error ?? '').slice(0, 300) };
};
const record = (name, outcome, response, detail = {}) => results.push({ name, outcome, httpStatus: response?.status ?? null, ...detail, ...(response && !response.ok ? { error: safeError(response) } : {}) });
const id = (group, key) => f[group][key];
const rpc = (name, body) => p02.rpc(name, body);
const rest = (path) => p02.request(path, undefined, 'GET');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const field = (obj, camel, snake) => obj?.[camel] ?? obj?.[snake] ?? null;
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

process.on('uncaughtException', (error) => {
  results.push({ name: 'runner.error', outcome: 'fail', detail: { message: String(error?.message ?? error).slice(0, 300) } });
  persist();
  console.log(JSON.stringify({ profile: 'P02', cases: results }, null, 2));
  process.exitCode = 1;
});

const identity = await rpc('get_my_qrcode_account');
const identityOk = identity.ok && identity.data?.userId === p02.userId
  && identity.data?.epsEmployeeId === 'EPS-MOCK-E002'
  && identity.data?.epsDepartmentId === 'EPS-MOCK-D01'
  && identity.data?.epsTeamId === 'EPS-MOCK-T01';
record('identity.E002.DA.A1', identityOk ? 'pass' : identity.ok ? 'fail' : 'blocked', identity, identity.ok ? {
  userId: identity.data?.userId,
  accountType: identity.data?.accountType,
  epsEmployeeId: identity.data?.epsEmployeeId,
  epsDepartmentId: identity.data?.epsDepartmentId,
  epsTeamId: identity.data?.epsTeamId,
} : {});

const scope = await rpc('has_scoped_permission', {
  required_permission_code: 'materials:material:view', target_party_id: f.parties.DA,
});
record('scope.material.view.DA', scope.ok && scope.data === true ? 'pass' : scope.ok ? 'fail' : 'blocked', scope, { expected: true, actual: scope.ok ? scope.data : null });
for (const permission of ['materials:material:manage', 'materials:handover:manage', 'organization:account:view', 'organization:account:manage']) {
  const r = await rpc('has_scoped_permission', { required_permission_code: permission, target_party_id: null });
  const expected = false;
  record(`scope.${permission}`, r.ok && r.data === expected ? 'pass' : r.ok ? 'fail' : 'blocked', r, { expected, actual: r.ok ? r.data : null });
}

const materials = await rpc('list_materials', { p_filters: { page: 1, pageSize: 100 } });
const materialIds = new Set((materials.data?.items ?? []).map((item) => item.id));
const expectedMaterialVisible = ['UAT-M-DA', 'UAT-M-A1', 'UAT-M-A2', 'UAT-M-E001', 'UAT-M-E003'];
const expectedMaterialHidden = ['UAT-M-DB', 'UAT-M-B1', 'UAT-M-E004', 'UAT-M-E005', 'UAT-M-X', 'UAT-M-Y', 'UAT-M-K1', 'UAT-M-K2'];
const visibleKeys = expectedMaterialVisible.filter((key) => materialIds.has(f.materials[key]));
const hiddenKeysAbsent = expectedMaterialHidden.filter((key) => !materialIds.has(f.materials[key]));
const matListOk = materials.ok && visibleKeys.length === expectedMaterialVisible.length && hiddenKeysAbsent.length === expectedMaterialHidden.length;
record('materials.list.department', matListOk ? 'pass' : materials.ok ? 'fail' : 'blocked', materials, {
  expectedVisible: expectedMaterialVisible,
  visibleFixtureKeys: Object.entries(f.materials).filter(([, value]) => materialIds.has(value)).map(([key]) => key),
  expectedHidden: expectedMaterialHidden,
  total: materials.data?.total ?? null,
});

for (const [key, allowed] of [
  ['UAT-M-DA', true], ['UAT-M-A1', true], ['UAT-M-A2', true], ['UAT-M-E003', true],
  ['UAT-M-DB', false], ['UAT-M-B1', false], ['UAT-M-X', false], ['UAT-M-Y', false], ['UAT-M-K1', false], ['UAT-M-K2', false],
]) {
  const r = await rpc('get_material', { p_id: id('materials', key) });
  const actual = r.ok && r.data?.id === id('materials', key);
  record(`material.detail.${key}`, actual === allowed ? 'pass' : r.ok ? 'fail' : allowed ? 'blocked' : 'pass', r, {
    expected: allowed ? 'visible' : 'denied', result: r.ok ? { id: r.data?.id, code: r.data?.code, version: r.data?.version } : undefined,
  });
}
for (const [key, allowed] of [['UAT-M-A1', true], ['UAT-M-E003', true], ['UAT-M-DB', false], ['UAT-M-X', false]]) {
  const r = await rpc('list_material_history', { p_material_id: id('materials', key) });
  record(`material.history.${key}`, r.ok === allowed ? 'pass' : r.ok ? 'fail' : allowed ? 'blocked' : 'pass', r, {
    expected: allowed ? 'visible history' : 'denied', count: Array.isArray(r.data) ? r.data.length : null,
  });
}

for (const [key, expectedCount] of [['UAT-M-A1', 1], ['UAT-M-A2', 1], ['UAT-M-DB', 0], ['UAT-M-X', 0], ['UAT-M-K1', 0]]) {
  const r = await rest(`/rest/v1/materials?id=eq.${encodeURIComponent(id('materials', key))}&select=id,code,note,version,owner_party_id`);
  const rows = Array.isArray(r.data) ? r.data : null;
  record(`table.materials.${key}`, r.ok && rows?.length === expectedCount ? 'pass' : r.ok ? 'fail' : 'blocked', r, {
    expectedRows: expectedCount, rows: rows?.map((row) => ({ id: row.id, code: row.code, note: row.note ?? null, version: row.version, ownerPartyId: row.owner_party_id })) ?? null,
  });
}

const custodians = await rpc('list_custodians', { p_include_inactive: false });
const custodianIds = new Set(Array.isArray(custodians.data) ? custodians.data.map((row) => row.id) : []);
const expectedCustodians = ['DA', 'A1', 'A2', 'E001', 'E002', 'E003'];
const unexpectedCustodians = ['DB', 'B1', 'E004', 'E005'];
record('custodians.list.department', custodians.ok
  && expectedCustodians.every((key) => custodianIds.has(f.parties[key]))
  && unexpectedCustodians.every((key) => !custodianIds.has(f.parties[key])) ? 'pass' : custodians.ok ? 'fail' : 'blocked', custodians, {
  expectedVisible: expectedCustodians,
  visibleFixtureKeys: Object.entries(f.parties).filter(([, value]) => custodianIds.has(value)).map(([key]) => key),
  expectedHidden: unexpectedCustodians,
});

const handovers = await rpc('list_handovers', { p_filters: { page: 1, pageSize: 100 } });
const listedHandovers = new Set((handovers.data?.items ?? []).map((item) => item.id));
const expectedHandoverVisible = ['UAT-H-A1-A2', 'UAT-H-A2-B1', 'UAT-H-X-A1', 'UAT-H-K1-A1', 'UAT-H-K2-A2'];
const expectedHandoverHidden = ['UAT-H-Y-B1'];
const hListOk = handovers.ok && expectedHandoverVisible.every((key) => listedHandovers.has(f.handovers[key]))
  && expectedHandoverHidden.every((key) => !listedHandovers.has(f.handovers[key]));
record('handovers.list.related.DA', hListOk ? 'pass' : handovers.ok ? 'fail' : 'blocked', handovers, {
  expectedVisible: expectedHandoverVisible,
  visibleFixtureKeys: Object.entries(f.handovers).filter(([, value]) => listedHandovers.has(value)).map(([key]) => key),
  expectedHidden: expectedHandoverHidden,
  total: handovers.data?.total ?? null,
});
for (const [key, allowed] of [
  ['UAT-H-A1-A2', true], ['UAT-H-A2-B1', true], ['UAT-H-X-A1', true], ['UAT-H-K1-A1', true], ['UAT-H-K2-A2', true], ['UAT-H-Y-B1', false],
]) {
  const r = await rpc('get_handover', { p_id: id('handovers', key) });
  const actual = r.ok && r.data?.id === id('handovers', key);
  record(`handover.detail.${key}`, actual === allowed ? 'pass' : r.ok ? 'fail' : allowed ? 'blocked' : 'pass', r, {
    expected: allowed ? 'visible' : 'denied', result: r.ok ? { id: r.data?.id, code: r.data?.code, status: r.data?.status, version: r.data?.version } : undefined,
  });
  if (allowed) {
    const history = await rpc('list_handover_history', { p_handover_id: id('handovers', key) });
    record(`handover.history.${key}`, history.ok ? 'pass' : 'blocked', history, { count: Array.isArray(history.data) ? history.data.length : null });
  }
}

for (const [key, expectedRows] of [['UAT-H-A1-A2', 1], ['UAT-H-Y-B1', 0]]) {
  const r = await rest(`/rest/v1/material_handovers?id=eq.${encodeURIComponent(id('handovers', key))}&select=id,code,status,version,sender_party_id,recipient_party_id`);
  const rows = Array.isArray(r.data) ? r.data : null;
  record(`table.material_handovers.${key}`, r.ok && rows?.length === expectedRows ? 'pass' : r.ok ? 'fail' : 'blocked', r, {
    expectedRows, rows: rows?.map((row) => ({ id: row.id, code: row.code, status: row.status, version: row.version, senderPartyId: row.sender_party_id, recipientPartyId: row.recipient_party_id })) ?? null,
  });
}
const rawHistory = await rest(`/rest/v1/material_handover_history?handover_id=eq.${encodeURIComponent(id('handovers', 'UAT-H-A1-A2'))}&select=id,handover_id,action`);
record('table.material_handover_history.A1-A2', rawHistory.ok && Array.isArray(rawHistory.data) ? 'pass' : 'blocked', rawHistory, {
  count: Array.isArray(rawHistory.data) ? rawHistory.data.length : null,
  rows: Array.isArray(rawHistory.data) ? rawHistory.data.map((row) => ({ id: row.id, handoverId: row.handover_id, action: row.action })) : null,
});

const materialPayload = (material, note) => ({
  code: material.code,
  modelId: field(material, 'modelId', 'model_id'),
  nameOverride: field(material, 'nameOverride', 'name_override'),
  descriptionOverride: field(material, 'descriptionOverride', 'description_override'),
  specificationOverrides: field(material, 'specificationOverrides', 'specification_overrides') ?? {},
  specificationOverrideLabels: field(material, 'specificationOverrideLabels', 'specification_override_labels') ?? {},
  serialNumber: field(material, 'serialNumber', 'serial_number'),
  ownerPartyId: field(material, 'ownerPartyId', 'owner_party_id'),
  condition: material.condition,
  note,
  images: (material.images ?? []).map((image) => ({
    storage_bucket: field(image, 'storageBucket', 'storage_bucket'),
    storage_path: field(image, 'storagePath', 'storage_path'),
    external_url: field(image, 'externalUrl', 'external_url'),
    sort_order: field(image, 'sortOrder', 'sort_order') ?? 0,
    is_cover: field(image, 'isCover', 'is_cover') ?? false,
  })),
});
for (const key of ['UAT-M-A1-MUTATE', 'UAT-M-A2-MUTATE']) {
  const before = await rpc('get_material', { p_id: id('materials', key) });
  if (!before.ok || !Number.isInteger(before.data?.version)) {
    record(`mutation.material.${key}.deny-unchanged`, 'blocked', before, { step: 'read before' });
    continue;
  }
  const baseline = { note: before.data.note ?? null, version: before.data.version };
  const write = await rpc('save_material', {
    p_id: before.data.id,
    p_expected_version: before.data.version,
    p_values: materialPayload(before.data, `P02 denied probe ${Date.now()}`),
  });
  const after = await rpc('get_material', { p_id: before.data.id });
  const unchanged = after.ok && (after.data.note ?? null) === baseline.note && after.data.version === baseline.version;
  const outcome = !write.ok && unchanged ? 'pass' : write.ok ? 'fail' : after.ok ? 'fail' : 'blocked';
  record(`mutation.material.${key}.deny-unchanged`, outcome, write, {
    baseline, denial: write.ok ? 'Unexpected success' : safeError(write),
    after: after.ok ? { note: after.data.note ?? null, version: after.data.version } : null,
    unchanged,
  });
}

const a1A2 = await rpc('get_handover', { p_id: id('handovers', 'UAT-H-A1-A2') });
const a1A2Raw = await rest(`/rest/v1/material_handovers?id=eq.${encodeURIComponent(id('handovers', 'UAT-H-A1-A2'))}&select=id,status,version,recipient_party_id`);
const a1A2RawRow = Array.isArray(a1A2Raw.data) ? a1A2Raw.data[0] : null;
const receiverPartyId = a1A2RawRow?.recipient_party_id ?? null;
for (const action of ['confirm', 'reject']) {
  if (!a1A2.ok || !a1A2Raw.ok || receiverPartyId !== f.parties.A2 || !Number.isInteger(a1A2.data?.version)) {
    record(`mutation.handover.${action}.receiver-DA-denied`, 'blocked', a1A2.ok ? a1A2Raw : a1A2, {
      reason: 'Fixture detail/version and direct confirmation that the receiver is A2 are required.',
      status: a1A2.data?.status ?? null,
      receiverPartyId,
    });
    continue;
  }
  const actionResult = await rpc('act_on_handover', {
    p_id: id('handovers', 'UAT-H-A1-A2'), p_action: action,
    p_expected_version: a1A2.data.version, p_note: `P02 denied ${action}`, p_item_conditions: [],
  });
  const after = await rpc('get_handover', { p_id: id('handovers', 'UAT-H-A1-A2') });
  const unchanged = after.ok && after.data?.status === a1A2.data.status && after.data?.version === a1A2.data.version;
  record(`mutation.handover.${action}.receiver-DA-denied`, !actionResult.ok && unchanged ? 'pass' : actionResult.ok ? 'fail' : after.ok ? 'fail' : 'blocked', actionResult, {
    receiverPartyId,
    receiverIsA2InDA: receiverPartyId === f.parties.A2,
    before: { status: a1A2.data.status, version: a1A2.data.version },
    after: after.ok ? { status: after.data.status, version: after.data.version } : null,
    unchanged,
  });
}

const accountRead = await rpc('list_qrcode_accounts', { p_search: '' });
record('account-admin.list-denied', !accountRead.ok ? 'pass' : 'fail', accountRead, { expected: 'permission denied' });
const ownRoleRows = await rest(`/rest/v1/user_roles?user_id=eq.${encodeURIComponent(p02.userId)}&select=user_id`);
const otherRoleRows = await rest(`/rest/v1/user_roles?user_id=eq.${encodeURIComponent(f.accounts.P06.id)}&select=user_id`);
const ownRows = Array.isArray(ownRoleRows.data) ? ownRoleRows.data : null;
const otherRows = Array.isArray(otherRoleRows.data) ? otherRoleRows.data : null;
record('table.user_roles.self-only', ownRoleRows.ok && ownRows?.length === 1 && ownRows[0].user_id === p02.userId
  && otherRoleRows.ok && otherRows?.length === 0 ? 'pass' : ownRoleRows.ok && otherRoleRows.ok ? 'fail' : 'blocked', ownRoleRows, {
  ownAssignmentRows: ownRows?.length ?? null,
  otherAccountRows: otherRows?.length ?? null,
  otherAccountHttpStatus: otherRoleRows.status,
  policyExpectation: 'self assignment visible; unrelated account assignments filtered by RLS',
});

persist();
console.log(JSON.stringify({ profile: 'P02', caseCount: results.length, counts: Object.fromEntries(['pass', 'fail', 'blocked'].map((status) => [status, results.filter((row) => row.outcome === status).length])), evidence: outputPath }, null, 2));
