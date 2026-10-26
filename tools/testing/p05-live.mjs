import fs from 'node:fs';
import { session, fixtures } from './uat-client.mjs';

// P05 live scope test. Auth/profile secrets remain inside uat-client and are never written.
const f = fixtures();
const p05 = await session('P05');
const p00 = await session('P00');
const outputPath = 'docs/testing/results/2026-10-22/p05-evidence.json';
const evidence = {
  profile: 'P05',
  capturedAt: new Date().toISOString(),
  identityMatched: null,
  before: {},
  afterDepartmentRole: {},
  restoration: {},
  errors: [],
};
const failures = [];
const id = (group, key) => f[group][key];
const safeError = (response) => {
  const data = response?.data;
  if (!data || typeof data !== 'object') return String(data ?? '').slice(0, 240);
  return {
    code: data.code ?? null,
    message: String(data.message ?? data.details ?? data.hint ?? data.error ?? '').slice(0, 240),
  };
};
const save = () => fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
const mark = (bucket, name, response, passed, summary = {}) => {
  const item = {
    status: response?.status ?? null,
    ok: response?.ok ?? null,
    outcome: passed ? 'pass' : 'fail',
    ...summary,
    ...((response && !response.ok) ? { error: safeError(response) } : {}),
  };
  evidence[bucket][name] = item;
  if (!passed) failures.push(`${bucket}.${name}`);
  return response;
};
const note = (bucket, name, passed, detail = {}) => {
  evidence[bucket][name] = { outcome: passed ? 'pass' : 'fail', ...detail };
  if (!passed) failures.push(`${bucket}.${name}`);
};
const rpc = (name, body) => p05.rpc(name, body);
const readTable = (materialId) => p05.request(
  `/rest/v1/materials?select=id,code,owner_party_id&id=eq.${encodeURIComponent(materialId)}`,
  undefined,
  'GET',
);
const visibleTargetCodes = (data) => (data?.items ?? [])
  .map((item) => item.code)
  .filter((code) => ['UAT-M-DB', 'UAT-M-B1', 'UAT-M-E005'].includes(code));
const materialList = async () => rpc('list_materials', { p_filters: { page: 1, pageSize: 100 } });
const checkDirectReadSet = async (bucket, expectedVisible) => {
  const rows = {};
  for (const [label, key] of [
    ['DB', 'UAT-M-DB'], ['B1', 'UAT-M-B1'], ['E005', 'UAT-M-E005'],
    ['DA', 'UAT-M-DA'], ['X', 'UAT-M-X'], ['Y', 'UAT-M-Y'], ['K1', 'UAT-M-K1'],
  ]) {
    const materialId = id('materials', key);
    const detail = await rpc('get_material', { p_id: materialId });
    const visible = detail.ok && detail.data?.id === materialId;
    mark(bucket, `detail.${label}`, detail, visible === expectedVisible.includes(label), {
      expected: expectedVisible.includes(label) ? 'visible' : 'denied',
      code: visible ? detail.data.code : undefined,
    });
    const table = await readTable(materialId);
    const tableRows = Array.isArray(table.data) ? table.data : null;
    mark(bucket, `table.${label}`, table, table.ok && tableRows?.length === (expectedVisible.includes(label) ? 1 : 0), {
      expectedRows: expectedVisible.includes(label) ? 1 : 0,
      rows: tableRows?.map((row) => ({ code: row.code, ownerPartyId: row.owner_party_id })) ?? null,
    });
    rows[label] = { detailVisible: visible, tableCount: tableRows?.length ?? null };
  }
  return rows;
};
const checkPermissions = async (bucket, viewExpected, manageExpected = false) => {
  for (const [label, partyKey] of [['DB', 'DB'], ['B1', 'B1'], ['E005', 'E005']]) {
    const view = await rpc('has_scoped_permission', {
      required_permission_code: 'materials:material:view', target_party_id: id('parties', partyKey),
    });
    mark(bucket, `viewScope.${label}`, view, view.ok && view.data === viewExpected, {
      expected: viewExpected, actual: view.ok ? view.data : null,
    });
    const manage = await rpc('has_scoped_permission', {
      required_permission_code: 'materials:material:manage', target_party_id: id('parties', partyKey),
    });
    mark(bucket, `manageScope.${label}`, manage, manage.ok && manage.data === manageExpected, {
      expected: manageExpected, actual: manage.ok ? manage.data : null,
    });
  }
};
const deniedSavePayload = (code, ownerPartyId) => ({
  code,
  modelId: f.modelId,
  nameOverride: null,
  descriptionOverride: null,
  specificationOverrides: {},
  specificationOverrideLabels: {},
  serialNumber: null,
  ownerPartyId,
  condition: 'good',
  note: 'P05 authorized-scope denial probe',
  images: [],
});
const tryValidDeniedMutations = async (bucket, mutationKeys) => {
  for (const [label, key, owner] of mutationKeys) {
    // Seeded UAT mutation fixtures use version 1. The complete payload includes the valid model.
    const result = await rpc('save_material', {
      p_id: id('materials', key),
      p_expected_version: 1,
      p_values: deniedSavePayload(key, id('parties', owner)),
    });
    mark(bucket, `mutation.${label}`, result, !result.ok, {
      expected: 'denied for lack of material manage scope',
      payloadModelValid: true,
      fixture: key,
    });
  }
};

let roleChangeAttempted = false;
try {
  const identity = await rpc('get_my_qrcode_account');
  const identityOk = identity.ok && identity.data?.userId === p05.userId
    && identity.data?.epsEmployeeCode === 'MOCK-E005'
    && identity.data?.epsDepartmentId === 'EPS-MOCK-D02'
    && identity.data?.epsTeamId == null;
  evidence.identityMatched = identityOk;
  mark('before', 'identity.E005.noTeam', identity, identityOk, identity.ok ? {
    authProfile: 'P05', accountType: identity.data?.accountType,
    epsEmployeeCode: identity.data?.epsEmployeeCode,
    epsDepartmentId: identity.data?.epsDepartmentId,
    epsTeamId: identity.data?.epsTeamId ?? null,
  } : {});

  const beforeList = await materialList();
  const beforeCodes = visibleTargetCodes(beforeList.data);
  mark('before', 'materials.list.noScopeLeak', beforeList,
    beforeList.ok && beforeCodes.length === 0, {
      expectedTargetCodes: [], targetCodes: beforeCodes,
      total: beforeList.data?.total ?? null,
    });
  await checkDirectReadSet('before', []);
  await checkPermissions('before', false, false);
  await tryValidDeniedMutations('before', [
    ['DB', 'UAT-M-DB-MUTATE', 'DB'],
    ['B1', 'UAT-M-B1-MUTATE', 'B1'],
    ['E005', 'UAT-M-E005-MUTATE', 'E005'],
  ]);

  roleChangeAttempted = true;
  const addRole = await p00.rpc('save_account_access', {
    p_user_id: f.accounts.P05.id,
    p_account_type: 'eps',
    p_eps_employee_id: 'EPS-MOCK-E005',
    p_external_organization_id: null,
    p_status: 'active',
    p_display_name: 'Võ Hà',
    p_role_ids: [f.roles.UAT_TEAM_OPERATOR, f.roles.UAT_DEPARTMENT_READER],
    p_warehouse_ids: [],
  });
  evidence.afterDepartmentRole.roleAssignment = {
    status: addRole.status, ok: addRole.ok,
    outcome: addRole.ok ? 'pass' : 'fail',
    actor: 'P00',
    change: 'add UAT_DEPARTMENT_READER while preserving UAT_TEAM_OPERATOR',
    ...(!addRole.ok ? { error: safeError(addRole) } : {}),
  };
  if (!addRole.ok) {
    failures.push('afterDepartmentRole.roleAssignment');
  } else {
    // Keep the original P05 session; every assertion below uses this session's JWT.
    const afterIdentity = await rpc('get_my_qrcode_account');
    const afterIdentityOk = afterIdentity.ok && afterIdentity.data?.userId === p05.userId
      && afterIdentity.data?.epsEmployeeCode === 'MOCK-E005'
      && afterIdentity.data?.epsDepartmentId === 'EPS-MOCK-D02'
      && afterIdentity.data?.epsTeamId == null;
    mark('afterDepartmentRole', 'identity.sameSession.E005.noTeam', afterIdentity, afterIdentityOk, {
      authProfile: 'P05', sameSessionUser: afterIdentity.ok && afterIdentity.data?.userId === p05.userId,
      epsEmployeeCode: afterIdentity.data?.epsEmployeeCode,
      epsDepartmentId: afterIdentity.data?.epsDepartmentId,
      epsTeamId: afterIdentity.data?.epsTeamId ?? null,
    });

    const afterList = await materialList();
    const afterItems = afterList.data?.items ?? [];
    const afterCodes = new Set(afterItems.map((item) => item.code));
    const expectedVisible = ['UAT-M-DB', 'UAT-M-B1', 'UAT-M-E005'];
    const expectedAbsent = ['UAT-M-DA', 'UAT-M-X', 'UAT-M-Y', 'UAT-M-K1', 'UAT-M-K2'];
    const visibleOk = expectedVisible.every((code) => afterCodes.has(code));
    const absentOk = expectedAbsent.every((code) => !afterCodes.has(code));
    mark('afterDepartmentRole', 'materials.list.departmentScope', afterList,
      afterList.ok && visibleOk && absentOk, {
        expectedVisible, targetCodes: [...afterCodes].filter((code) => /^UAT-M-/.test(code)),
        expectedAbsent, unexpectedCodes: expectedAbsent.filter((code) => afterCodes.has(code)),
        total: afterList.data?.total ?? null,
      });
    await checkDirectReadSet('afterDepartmentRole', ['DB', 'B1', 'E005']);
    await checkPermissions('afterDepartmentRole', true, false);
    await tryValidDeniedMutations('afterDepartmentRole', [
      ['DB', 'UAT-M-DB-MUTATE', 'DB'],
      ['B1', 'UAT-M-B1-MUTATE', 'B1'],
      ['E005', 'UAT-M-E005-MUTATE', 'E005'],
    ]);
  }
} catch (error) {
  evidence.errors.push(String(error?.message ?? error).slice(0, 300));
  failures.push('runner.exception');
} finally {
  // Always restore the documented team-only baseline through the P00 account-management session.
  const restore = await p00.rpc('save_account_access', {
    p_user_id: f.accounts.P05.id,
    p_account_type: 'eps',
    p_eps_employee_id: 'EPS-MOCK-E005',
    p_external_organization_id: null,
    p_status: 'active',
    p_display_name: 'Võ Hà',
    p_role_ids: [f.roles.UAT_TEAM_OPERATOR],
    p_warehouse_ids: [],
  });
  evidence.restoration.roleAssignment = {
    status: restore.status, ok: restore.ok,
    outcome: restore.ok ? 'pass' : 'fail', actor: 'P00',
    restoredRoles: ['UAT_TEAM_OPERATOR'],
    ...(!restore.ok ? { error: safeError(restore) } : {}),
  };
  if (!restore.ok) failures.push('restoration.roleAssignment');

  if (restore.ok) {
    // The already-authenticated P05 session must lose department visibility immediately.
    const restoredList = await materialList();
    const restoredCodes = visibleTargetCodes(restoredList.data);
    mark('restoration', 'sameSession.listReturnsToEmpty', restoredList,
      restoredList.ok && restoredCodes.length === 0, {
        authProfile: 'P05', targetCodes: restoredCodes,
        total: restoredList.data?.total ?? null,
      });
    const restoredIdentity = await rpc('get_my_qrcode_account');
    const identityRestored = restoredIdentity.ok && restoredIdentity.data?.userId === p05.userId
      && restoredIdentity.data?.epsEmployeeCode === 'MOCK-E005'
      && restoredIdentity.data?.epsTeamId == null;
    mark('restoration', 'sameSession.identity', restoredIdentity, identityRestored, {
      authProfile: 'P05', sameSessionUser: restoredIdentity.ok && restoredIdentity.data?.userId === p05.userId,
      epsEmployeeCode: restoredIdentity.data?.epsEmployeeCode,
      epsDepartmentId: restoredIdentity.data?.epsDepartmentId,
      epsTeamId: restoredIdentity.data?.epsTeamId ?? null,
    });
    const restoredDbDetail = await rpc('get_material', { p_id: id('materials', 'UAT-M-DB') });
    mark('restoration', 'sameSession.detail.DBDenied', restoredDbDetail,
      !restoredDbDetail.ok, { expected: 'denied after role restore' });
  }
  evidence.failures = [...new Set(failures)];
  evidence.result = evidence.failures.length === 0 ? 'pass' : 'fail';
  save();
}

console.log(JSON.stringify({ outputPath, result: evidence.result, failures: evidence.failures,
  restoration: evidence.restoration, identityMatched: evidence.identityMatched }, null, 2));
if (evidence.failures.length) process.exitCode = 1;
