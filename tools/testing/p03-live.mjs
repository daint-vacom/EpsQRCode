// P03 live authorization checks. Development project only; no intended writes.
import fs from 'node:fs';
import { session, fixtures } from './uat-client.mjs';

const f = fixtures();
const p03 = await session('P03');
const results = [];
const outPath = 'docs/testing/results/2026-10-22/p03-evidence.json';
const persist = () => fs.writeFileSync(outPath, `${JSON.stringify({ profile: 'P03', capturedAt: new Date().toISOString(), cases: results }, null, 2)}\n`);
process.on('unhandledRejection', (error) => {
  results.push({ name: 'runner.error', status: null, ok: false, summary: { message: String(error?.message ?? error).slice(0, 300) } });
  persist();
  console.log(JSON.stringify({ profile: 'P03', cases: results }, null, 2));
  process.exitCode = 1;
});
const record = (name, r, summary = {}) => results.push({ name, status: r.status, ok: r.ok, summary });
const id = (group, key) => f[group][key];
const rpc = (name, body) => p03.rpc(name, body);
const rest = (path, method = 'GET', body) => p03.request(path, body, method);
const safeError = (r) => typeof r.data === 'object' && r.data
  ? { code: r.data.code, message: String(r.data.message ?? '').slice(0, 180) }
  : String(r.data).slice(0, 180);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const hasMaterial = (items, code) => items.some((x) => x.code === code);
const materialList = await rpc('list_materials', { p_filters: { page: 1, pageSize: 100 } });
assert(materialList.ok, `materials list failed: ${JSON.stringify(safeError(materialList))}`);
const materialItems = materialList.data?.items ?? [];
const materialCodes = materialItems.map((x) => x.code).filter((x) => x?.startsWith('UAT-'));
record('materials.list', materialList, { total: materialList.data?.total, uatCodes: materialCodes });
for (const key of ['UAT-M-DA', 'UAT-M-DB', 'UAT-M-A1', 'UAT-M-A2', 'UAT-M-B1', 'UAT-M-E001', 'UAT-M-E003', 'UAT-M-E004', 'UAT-M-E005']) {
  assert(hasMaterial(materialItems, key), `expected visible EPS material ${key}`);
}
for (const key of ['UAT-M-X', 'UAT-M-Y', 'UAT-M-K1', 'UAT-M-K2']) {
  assert(!hasMaterial(materialItems, key), `unexpectedly visible out-of-scope material ${key}`);
}

for (const [name, key, allowed] of [
  ['DA', 'UAT-M-DA', true], ['DB', 'UAT-M-DB', true], ['A1', 'UAT-M-A1', true],
  ['A2', 'UAT-M-A2', true], ['B1', 'UAT-M-B1', true], ['E003', 'UAT-M-E003', true],
  ['X', 'UAT-M-X', false], ['Y', 'UAT-M-Y', false], ['K1', 'UAT-M-K1', false], ['K2', 'UAT-M-K2', false],
]) {
  const r = await rpc('get_material', { p_id: id('materials', key) });
  const visible = r.ok && Boolean(r.data?.id);
  record(`material.detail.${name}`, r, visible ? { code: r.data.code, ownerPartyId: r.data.ownerPartyId } : safeError(r));
  assert(visible === allowed, `material detail ${name} expected ${allowed ? 'visible' : 'hidden'}`);
}

for (const [name, key, allowed] of [
  ['DA', 'UAT-M-DA', true], ['B1', 'UAT-M-B1', true], ['X', 'UAT-M-X', false], ['K1', 'UAT-M-K1', false],
]) {
  const r = await rpc('list_material_history', { p_material_id: id('materials', key) });
  const visible = r.ok && Array.isArray(r.data);
  record(`material.history.${name}`, r, visible ? { count: r.data.length } : safeError(r));
  assert(visible === allowed, `material history ${name} expected ${allowed ? 'visible' : 'hidden'}`);
}

for (const [name, search, shouldHave] of [
  ['DA', 'UAT-M-DA', 'UAT-M-DA'], ['DB', 'UAT-M-DB', 'UAT-M-DB'],
  ['X', 'UAT-M-X', null], ['K1', 'UAT-M-K1', null],
]) {
  const r = await rpc('list_materials', { p_filters: { page: 1, pageSize: 20, search } });
  assert(r.ok, `material search ${name} failed: ${JSON.stringify(safeError(r))}`);
  const items = r.data?.items ?? [];
  record(`materials.search.${name}`, r, { total: r.data?.total, uatCodes: items.map((x) => x.code).filter((x) => x?.startsWith('UAT-')) });
  assert(shouldHave ? hasMaterial(items, shouldHave) : items.length === 0, `material search ${name} scope mismatch`);
}

const custodians = await rpc('list_custodians', { p_include_inactive: false });
assert(custodians.ok && Array.isArray(custodians.data), `custodian list failed: ${JSON.stringify(safeError(custodians))}`);
const custodianRows = custodians.data;
const custodianIds = new Set(custodianRows.map((x) => x.sourceId ?? x.source_id).filter(Boolean));
const epsSourceIds = ['EPS-MOCK-D01', 'EPS-MOCK-D02', 'EPS-MOCK-T01', 'EPS-MOCK-T02', 'EPS-MOCK-T03', 'EPS-MOCK-E001', 'EPS-MOCK-E002', 'EPS-MOCK-E003', 'EPS-MOCK-E004', 'EPS-MOCK-E005'];
const visibleEpsIds = epsSourceIds.filter((sourceId) => custodianIds.has(sourceId));
record('custodians.list.eps', custodians, { count: custodianRows.length, visibleEpsSourceIds: visibleEpsIds });
assert(visibleEpsIds.length === epsSourceIds.length, 'not all EPS organizations/people are visible');

const handoverList = await rpc('list_handovers', { p_filters: { page: 1, pageSize: 100 } });
assert(handoverList.ok, `handover list failed: ${JSON.stringify(safeError(handoverList))}`);
const handoverItems = handoverList.data?.items ?? [];
const handoverCodes = handoverItems.map((x) => x.code).filter((x) => x?.startsWith('UAT-'));
record('handovers.list', handoverList, { total: handoverList.data?.total, uatCodes: handoverCodes });
for (const key of ['UAT-H-A1-A2', 'UAT-H-A2-B1', 'UAT-H-X-A1', 'UAT-H-Y-B1', 'UAT-H-K1-A1', 'UAT-H-K2-A2']) {
  assert(handoverCodes.includes(key), `expected visible EPS-related handover ${key}`);
}
for (const key of ['UAT-H-X-A1', 'UAT-H-K1-A1']) {
  const r = await rpc('list_handovers', { p_filters: { page: 1, pageSize: 20, search: key } });
  assert(r.ok, `handover search ${key} failed: ${JSON.stringify(safeError(r))}`);
  const items = r.data?.items ?? [];
  record(`handovers.search.${key}`, r, { total: r.data?.total, uatCodes: items.map((x) => x.code).filter((x) => x?.startsWith('UAT-')) });
  assert(items.some((x) => x.code === key), `handover search omitted ${key}`);
}
for (const key of ['UAT-H-A1-A2', 'UAT-H-A2-B1', 'UAT-H-X-A1', 'UAT-H-K2-A2']) {
  const r = await rpc('get_handover', { p_id: id('handovers', key) });
  assert(r.ok && r.data?.id, `EPS-related handover detail ${key} not visible: ${JSON.stringify(safeError(r))}`);
  record(`handover.detail.${key}`, r, { code: r.data.code, status: r.data.status });
  const hist = await rpc('list_handover_history', { p_handover_id: id('handovers', key) });
  const histVisible = hist.ok && Array.isArray(hist.data);
  record(`handover.history.${key}`, hist, histVisible ? { count: hist.data.length } : safeError(hist));
}

const receipts = await rpc('list_material_receipts', { p_filters: { page: 1, pageSize: 100 } });
const receiptItems = receipts.ok ? receipts.data?.items ?? [] : [];
record('receipts.list', receipts, receipts.ok ? { total: receipts.data?.total, count: receiptItems.length } : safeError(receipts));
assert(!receipts.ok || receiptItems.length === 0, 'receipt list exposed data to view-only EPS reader');
for (const key of ['UAT-R-K1', 'UAT-R-K2']) {
  const r = await rpc('get_material_receipt', { p_id: id('receipts', key) });
  const visible = r.ok && Boolean(r.data?.id);
  record(`receipt.detail.${key}`, r, visible ? { code: r.data.code, status: r.data.status } : safeError(r));
  assert(!visible, `receipt detail ${key} exposed to EPS reader`);
  const hist = await rpc('list_material_receipt_history', { p_receipt_id: id('receipts', key) });
  const histVisible = hist.ok && Array.isArray(hist.data) && hist.data.length > 0;
  record(`receipt.history.${key}`, hist, hist.ok && Array.isArray(hist.data) ? { count: hist.data.length } : safeError(hist));
  assert(!histVisible, `receipt history ${key} exposed to EPS reader`);
}

for (const [name, path, expectedCount] of [
  ['table.materials.DA', `/rest/v1/materials?id=eq.${id('materials', 'UAT-M-DA')}&select=id,code,owner_party_id`, 1],
  ['table.materials.DB', `/rest/v1/materials?id=eq.${id('materials', 'UAT-M-DB')}&select=id,code,owner_party_id`, 1],
  ['table.materials.X', `/rest/v1/materials?id=eq.${id('materials', 'UAT-M-X')}&select=id,code,owner_party_id`, 0],
  ['table.materials.K1', `/rest/v1/materials?id=eq.${id('materials', 'UAT-M-K1')}&select=id,code,owner_party_id`, 0],
  ['table.material_handover_history.A1-A2', `/rest/v1/material_handover_history?handover_id=eq.${id('handovers', 'UAT-H-A1-A2')}&select=id,handover_id,action`, 0],
  ['table.material_receipts.K1', `/rest/v1/material_receipts?id=eq.${id('receipts', 'UAT-R-K1')}&select=id,code,warehouse_id`, 0],
]) {
  const r = await rest(path);
  const rows = Array.isArray(r.data) ? r.data : null;
  record(name, r, rows ? { count: rows.length, codes: rows.map((x) => x.code).filter(Boolean) } : safeError(r));
  assert(r.ok && rows && rows.length === expectedCount, `${name} RLS expected ${expectedCount} row(s)`);
}

// Use a complete, current EPS record payload. Permission must reject it and the next read must match.
const mutateId = id('materials', 'UAT-M-DA-MUTATE');
const before = await rpc('get_material', { p_id: mutateId });
assert(before.ok && before.data?.id, `EPS mutation probe record unreadable: ${JSON.stringify(safeError(before))}`);
const m = before.data;
const values = {
  code: m.code, modelId: m.modelId, nameOverride: m.nameOverride ?? null,
  descriptionOverride: m.descriptionOverride ?? null,
  specificationOverrides: m.specificationOverrides ?? {},
  specificationOverrideLabels: m.specificationOverrideLabels ?? {},
  serialNumber: m.serialNumber ?? null, ownerPartyId: m.ownerPartyId,
  condition: m.condition, note: `${m.note ?? ''} [P03 denied probe]`.trim(), images: m.images ?? [],
};
const denied = await rpc('save_material', { p_id: mutateId, p_expected_version: m.version, p_values: values });
record('mutation.denied.EPS', denied, denied.ok ? { unexpectedResult: String(denied.data).slice(0, 80) } : safeError(denied));
assert(!denied.ok, 'view-only EPS material mutation unexpectedly succeeded');
const after = await rpc('get_material', { p_id: mutateId });
assert(after.ok && after.data.version === m.version && (after.data.note ?? '') === (m.note ?? ''), 'EPS mutation probe record changed');
record('mutation.denied.EPS-unchanged', { status: after.status, ok: true }, { versionUnchanged: true, noteUnchanged: true });

persist();
console.log(JSON.stringify({ profile: 'P03', cases: results }, null, 2));
