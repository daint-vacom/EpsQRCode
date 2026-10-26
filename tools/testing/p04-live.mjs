import fs from 'node:fs';
import { session, fixtures } from './uat-client.mjs';

const f = fixtures();
const p04 = await session('P04');
const results = [];
const persist = () => {
  const evidence = { profile: 'P04', capturedAt: new Date().toISOString(), cases: results };
  fs.writeFileSync('docs/testing/results/2026-10-22/p04-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`);
};
process.on('uncaughtException', error => {
  results.push({ name: 'runner.error', status: null, ok: false, summary: { message: String(error?.message ?? error).slice(0, 300) } });
  persist();
  console.log(JSON.stringify({ profile: 'P04', cases: results }, null, 2));
  process.exitCode = 1;
});
const record = (name, request, summary) => results.push({ name, status: request.status, ok: request.ok, summary });
const id = (group, key) => f[group][key];
const rpc = async (name, body) => p04.rpc(name, body);
const rest = async (path) => p04.request(path, undefined, 'GET');
const safeError = (r) => typeof r.data === 'object' && r.data
  ? { code: r.data.code, message: r.data.message }
  : String(r.data).slice(0, 180);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const materials = await rpc('list_materials', { p_filters: { page: 1, pageSize: 100 } });
const materialItems = materials.data?.items ?? [];
const materialCodes = new Set(materialItems.map(x => x.code));
record('materials.list', materials, { total: materials.data?.total, codes: [...materialCodes].filter(x => x?.startsWith('UAT-')) });
assert(materials.ok, `list_materials failed: ${JSON.stringify(safeError(materials))}`);
for (const key of ['UAT-M-B1', 'UAT-M-E004', 'UAT-M-K1']) assert(materialCodes.has(key), `expected visible ${key}`);
for (const key of ['UAT-M-DB', 'UAT-M-A1', 'UAT-M-A2', 'UAT-M-E005', 'UAT-M-K2']) assert(!materialCodes.has(key), `unexpected visible ${key}`);

for (const [name, key, allowed] of [
  ['material.detail.B1', 'UAT-M-B1', true],
  ['material.detail.DB', 'UAT-M-DB', false],
  ['material.detail.K2', 'UAT-M-K2', false],
]) {
  const r = await rpc('get_material', { p_id: id('materials', key) });
  record(name, r, r.ok ? { code: r.data?.code, ownerPartyId: r.data?.ownerPartyId } : safeError(r));
  assert(r.ok === allowed, `${name} expected ${allowed ? 'allow' : 'deny'}`);
}
for (const [name, key, allowed] of [
  ['material.history.B1', 'UAT-M-B1', true],
  ['material.history.DB', 'UAT-M-DB', false],
]) {
  const r = await rpc('list_material_history', { p_material_id: id('materials', key) });
  record(name, r, r.ok ? { count: Array.isArray(r.data) ? r.data.length : null } : safeError(r));
  assert(r.ok === allowed, `${name} expected ${allowed ? 'allow' : 'deny'}`);
}

const handovers = await rpc('list_handovers', { p_filters: { page: 1, pageSize: 100 } });
const handoverCodes = new Set((handovers.data?.items ?? []).map(x => x.code));
record('handovers.list', handovers, { total: handovers.data?.total, uatCodes: [...handoverCodes].filter(x => x?.startsWith('UAT-')) });
assert(handovers.ok, `list_handovers failed: ${JSON.stringify(safeError(handovers))}`);
for (const key of ['UAT-H-K1-A1', 'UAT-H-Y-B1']) assert(handoverCodes.has(key), `expected visible ${key}`);
for (const key of ['UAT-H-K2-A2', 'UAT-H-X-A1']) assert(!handoverCodes.has(key), `unexpected visible ${key}`);
for (const [name, key, allowed] of [
  ['handover.detail.K1-A1', 'UAT-H-K1-A1', true],
  ['handover.detail.Y-B1', 'UAT-H-Y-B1', true],
  ['handover.detail.K2-A2', 'UAT-H-K2-A2', false],
  ['handover.detail.X-A1', 'UAT-H-X-A1', false],
]) {
  const r = await rpc('get_handover', { p_id: id('handovers', key) });
  record(name, r, r.ok ? { code: r.data?.code, status: r.data?.status } : safeError(r));
  assert(r.ok === allowed, `${name} expected ${allowed ? 'allow' : 'deny'}`);
  if (allowed) {
    const hist = await rpc('list_handover_history', { p_handover_id: id('handovers', key) });
    record(name.replace('detail', 'history'), hist, hist.ok ? { count: Array.isArray(hist.data) ? hist.data.length : null } : safeError(hist));
    assert(hist.ok, `${name} history denied`);
  }
}

const receipts = await rpc('list_material_receipts', { p_filters: { page: 1, pageSize: 100 } });
const receiptCodes = new Set((receipts.data?.items ?? []).map(x => x.code));
record('receipts.list', receipts, { total: receipts.data?.total, uatCodes: [...receiptCodes].filter(x => x?.startsWith('UAT-')) });
assert(receipts.ok, `list_material_receipts failed: ${JSON.stringify(safeError(receipts))}`);
assert(receiptCodes.has('UAT-R-K1'), 'expected visible UAT-R-K1');
assert(!receiptCodes.has('UAT-R-K2'), 'unexpected visible UAT-R-K2');
for (const [name, key, allowed] of [
  ['receipt.detail.K1', 'UAT-R-K1', true],
  ['receipt.detail.K2', 'UAT-R-K2', false],
]) {
  const r = await rpc('get_material_receipt', { p_id: id('receipts', key) });
  record(name, r, r.ok ? { code: r.data?.code, status: r.data?.status, version: r.data?.version } : safeError(r));
  assert(r.ok === allowed, `${name} expected ${allowed ? 'allow' : 'deny'}`);
  if (allowed) {
    const hist = await rpc('list_material_receipt_history', { p_receipt_id: id('receipts', key) });
    const items = await rpc('list_material_receipt_items', { p_receipt_id: id('receipts', key), p_filters: { page: 1, pageSize: 100 } });
    record('receipt.history.K1', hist, hist.ok ? { count: Array.isArray(hist.data) ? hist.data.length : null } : safeError(hist));
    record('receipt.items.K1', items, items.ok ? { total: items.data?.total } : safeError(items));
    assert(hist.ok && items.ok, 'K1 receipt history/items denied');
  }
}

for (const [name, path] of [
  ['table.materials.B1', `/rest/v1/materials?id=eq.${id('materials', 'UAT-M-B1')}&select=id,code,owner_party_id`],
  ['table.materials.DB', `/rest/v1/materials?id=eq.${id('materials', 'UAT-M-DB')}&select=id,code,owner_party_id`],
  ['table.material_handover_history.K1', `/rest/v1/material_handover_history?handover_id=eq.${id('handovers', 'UAT-H-K1-A1')}&select=id,handover_id,action`],
  ['table.material_receipt_history.K1', `/rest/v1/material_receipt_history?receipt_id=eq.${id('receipts', 'UAT-R-K1')}&select=id,receipt_id,action`],
]) {
  const r = await rest(path);
  const rows = Array.isArray(r.data) ? r.data : null;
  record(name, r, rows ? { count: rows.length, rows } : safeError(r));
}

// A permitted note edit exercises the team scope; restore the original note immediately.
const target = await rpc('get_material', { p_id: id('materials', 'UAT-M-B1-MUTATE') });
assert(target.ok, `mutation fixture unreadable: ${JSON.stringify(safeError(target))}`);
const originalNote = target.data.note ?? '';
const payloadFor = (note) => ({
  code: target.data.code,
  modelId: target.data.modelId,
  nameOverride: target.data.nameOverride ?? null,
  descriptionOverride: target.data.descriptionOverride ?? null,
  specificationOverrides: target.data.specificationOverrides ?? {},
  specificationOverrideLabels: target.data.specificationOverrideLabels ?? {},
  serialNumber: target.data.serialNumber ?? null,
  ownerPartyId: target.data.ownerPartyId,
  condition: target.data.condition,
  note,
  images: target.data.images ?? [],
});
const allowedWrite = await rpc('save_material', { p_id: target.data.id, p_expected_version: target.data.version, p_values: payloadFor(`${originalNote} [P04 UAT]`.trim()) });
record('mutation.allowed.B1', allowedWrite, allowedWrite.ok ? { id: allowedWrite.data } : safeError(allowedWrite));
assert(allowedWrite.ok, `B1 fixture write failed: ${JSON.stringify(safeError(allowedWrite))}`);
const afterAllowed = await rpc('get_material', { p_id: target.data.id });
assert(afterAllowed.ok, 'B1 fixture unreadable after write');
const restore = await rpc('save_material', { p_id: target.data.id, p_expected_version: afterAllowed.data.version, p_values: payloadFor(originalNote) });
record('mutation.restore.B1', restore, restore.ok ? { id: restore.data } : safeError(restore));
assert(restore.ok, `B1 fixture restore failed: ${JSON.stringify(safeError(restore))}`);
const restored = await rpc('get_material', { p_id: target.data.id });
assert(restored.ok && (restored.data.note ?? '') === originalNote, 'B1 fixture note did not restore');

// Direct, scoped mutation attempt on a fixture outside P04's team scope.
const denied = await rpc('save_material', { p_id: id('materials', 'UAT-M-DB-MUTATE'), p_expected_version: 1, p_values: {
  code: 'UAT-M-DB-MUTATE', modelId: f.modelId, nameOverride: null, descriptionOverride: null,
  specificationOverrides: {}, specificationOverrideLabels: {}, serialNumber: null,
  ownerPartyId: id('parties', 'DB'), condition: 'good', note: 'P04 denied DB scope probe', images: [],
} });
record('mutation.denied.DB', denied, denied.ok ? { unexpectedId: denied.data } : safeError(denied));
assert(!denied.ok, 'DB material mutation unexpectedly succeeded');
const dbMutationAfter = await rpc('list_materials', { p_filters: { page: 1, pageSize: 10, id: id('materials', 'UAT-M-DB-MUTATE') } });
record('mutation.denied.DB-no-visible-row', dbMutationAfter, { total: dbMutationAfter.data?.total ?? null });

// K2 allocation is rejected at the warehouse representation guard before a handover row is created.
const beforeK2 = await rpc('list_handovers', { p_filters: { page: 1, pageSize: 100, search: 'P04-K2-DENIED' } });
const deniedK2 = await rpc('save_warehouse_handover', { p_id: null, p_values: {
  mode: 'warehouse_allocation', warehouseId: id('parties', 'K2'), recipientPartyId: id('parties', 'A1'),
  note: 'P04 denied scope probe', items: [{ materialId: id('materials', 'UAT-M-K2'), condition: 'good' }],
} });
record('mutation.denied.K2-allocation', deniedK2, deniedK2.ok ? { unexpectedId: deniedK2.data } : safeError(deniedK2));
assert(!deniedK2.ok, 'K2 allocation unexpectedly succeeded');
const afterK2 = await rpc('list_handovers', { p_filters: { page: 1, pageSize: 100, search: 'P04-K2-DENIED' } });
record('mutation.denied.K2-no-row', afterK2, { total: afterK2.data?.total ?? null });

// Use --workflow only once; it creates a persistent receipt, material, and pending allocation.
if (process.argv.includes('--workflow')) {
// Create one owned receipt at K1, confirm it, and leave its allocation to A1 pending.
const runTag = `P04-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const receiptCreated = await rpc('save_material_receipt', { p_id: null, p_values: {
  warehouseId: id('parties', 'K1'), note: `${runTag} authorized K1 receipt`,
  lines: [{ modelId: f.modelId, quantity: 1, sortOrder: 0,
    items: [{ serialNumber: `${runTag}-SERIAL`, condition: 'good', note: 'P04 live test unit' }] }],
} });
record('workflow.receipt.create', receiptCreated, receiptCreated.ok ? { id: receiptCreated.data } : safeError(receiptCreated));
assert(receiptCreated.ok, `K1 receipt create failed: ${JSON.stringify(safeError(receiptCreated))}`);
const receiptId = receiptCreated.data;
const receiptDraft = await rpc('get_material_receipt', { p_id: receiptId });
assert(receiptDraft.ok, `created receipt detail failed: ${JSON.stringify(safeError(receiptDraft))}`);
const receiptBefore = { status: receiptDraft.data.status, version: receiptDraft.data.version, code: receiptDraft.data.code };
const confirmed = await rpc('act_material_receipt', { p_id: receiptId, p_action: 'confirm', p_expected_version: receiptBefore.version });
record('workflow.receipt.confirm', confirmed, confirmed.ok ? { id: confirmed.data } : safeError(confirmed));
assert(confirmed.ok, `receipt confirm failed: ${JSON.stringify(safeError(confirmed))}`);
const confirmedReceipt = await rpc('get_material_receipt', { p_id: receiptId });
const receiptItems = await rpc('list_material_receipt_items', { p_receipt_id: receiptId, p_filters: { page: 1, pageSize: 20 } });
assert(confirmedReceipt.ok && receiptItems.ok && receiptItems.data.total === 1, 'confirmed receipt/item verification failed');
const createdMaterialId = receiptItems.data.items[0].materialId;
assert(createdMaterialId, 'confirmed receipt item has no material id');
const allocCreated = await rpc('save_warehouse_handover', { p_id: null, p_values: {
  mode: 'warehouse_allocation', warehouseId: id('parties', 'K1'), recipientPartyId: id('parties', 'A1'),
  receiptId, note: `${runTag} allocation to A1`, items: [{ materialId: createdMaterialId, condition: 'good' }],
} });
record('workflow.allocation.create', allocCreated, allocCreated.ok ? { id: allocCreated.data } : safeError(allocCreated));
assert(allocCreated.ok, `K1 allocation create failed: ${JSON.stringify(safeError(allocCreated))}`);
const allocationId = allocCreated.data;
const allocationDraft = await rpc('get_handover', { p_id: allocationId });
assert(allocationDraft.ok, `allocation detail failed: ${JSON.stringify(safeError(allocationDraft))}`);
const sent = await rpc('act_on_warehouse_handover', { p_id: allocationId, p_action: 'send', p_expected_version: allocationDraft.data.version });
record('workflow.allocation.send', sent, sent.ok ? { id: sent.data } : safeError(sent));
assert(sent.ok, `allocation send failed: ${JSON.stringify(safeError(sent))}`);
const allocationPending = await rpc('get_handover', { p_id: allocationId });
assert(allocationPending.ok && allocationPending.data.status === 'pending', 'allocation was not left pending for P01');
const finalReceipt = await rpc('get_material_receipt', { p_id: receiptId });
const finalHistory = await rpc('list_material_receipt_history', { p_receipt_id: receiptId });
const finalMat = await rpc('get_material', { p_id: createdMaterialId });
record('workflow.final', { status: 200, ok: true }, {
  receiptId, receiptCode: finalReceipt.data.code, receiptStatus: finalReceipt.data.status,
  createdMaterialId, materialCode: finalMat.data.code, ownerPartyId: finalMat.data.ownerPartyId,
  allocationId, allocationStatus: allocationPending.data.status, receiptHistoryCount: finalHistory.data?.length,
});
}

persist();
console.log(JSON.stringify({ profile: 'P04', cases: results }, null, 2));
