import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const MIN_PASSWORD_LENGTH = 8;
const LOGIN_DOMAIN = Deno.env.get('SUPABASE_LOGIN_DOMAIN') ?? 'vacom.vn';

type AccountAction = 'create' | 'update-username' | 'reset-password';

interface AccountRequest {
  action?: AccountAction;
  tenantId?: string;
  employeeId?: string;
  username?: string;
  password?: string;
}

interface EmployeeRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Không thể xử lý tài khoản nhân viên.';
}

function normalizeUsername(value: unknown) {
  const username = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      'Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang; dài 3-32 ký tự.',
    );
  }
  return username;
}

function validatePassword(value: unknown) {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }
  return value;
}

function createUserClient(authHeader: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const publishableKey =
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY') ??
    '';

  return createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function assertPermission(
  client: ReturnType<typeof createUserClient>,
  tenantId: string,
  permissionCode: string,
) {
  const { data, error } = await client.rpc('has_tenant_permission', {
    target_tenant_id: tenantId,
    required_permission_code: permissionCode,
  });

  if (error) throw error;
  if (data !== true)
    throw new Error('Bạn không có quyền quản lý tài khoản nhân viên.');
}

async function loadEmployee(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  employeeId: string,
) {
  const { data, error } = await admin
    .from('employees')
    .select('id,tenant_id,user_id,first_name,last_name')
    .eq('id', employeeId)
    .eq('tenant_id', tenantId)
    .maybeSingle<EmployeeRow>();

  if (error) throw error;
  if (!data) throw new Error('Không tìm thấy nhân viên trong tenant hiện tại.');
  return data;
}

async function updateUsername(
  admin: ReturnType<typeof createAdminClient>,
  employee: EmployeeRow,
  username: string,
) {
  if (!employee.user_id)
    throw new Error('Nhân viên chưa có tài khoản để đổi username.');

  const { data: oldProfile, error: oldProfileError } = await admin
    .from('user_profiles')
    .select('username')
    .eq('id', employee.user_id)
    .maybeSingle<{ username: string | null }>();
  if (oldProfileError) throw oldProfileError;

  const { error: profileError } = await admin
    .from('user_profiles')
    .update({ username })
    .eq('id', employee.user_id);
  if (profileError) throw profileError;

  const { error: authError } = await admin.auth.admin.updateUserById(
    employee.user_id,
    {
      email: `${username}@${LOGIN_DOMAIN}`,
      email_confirm: true,
    },
  );

  if (authError) {
    await admin
      .from('user_profiles')
      .update({ username: oldProfile?.username ?? null })
      .eq('id', employee.user_id);
    throw authError;
  }

  return {
    employee_id: employee.id,
    user_id: employee.user_id,
    username,
  };
}

async function createAccount(
  admin: ReturnType<typeof createAdminClient>,
  employee: EmployeeRow,
  username: string,
  password: string,
) {
  if (employee.user_id) throw new Error('Nhân viên đã có tài khoản.');

  const email = `${username}@${LOGIN_DOMAIN}`;
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: [employee.last_name, employee.first_name]
          .filter(Boolean)
          .join(' '),
        first_name: employee.first_name,
        last_name: employee.last_name,
      },
    });

  if (createError) throw createError;
  const userId = created.user?.id;
  if (!userId) throw new Error('Supabase không trả về tài khoản vừa tạo.');

  try {
    const { error: profileError } = await admin
      .from('user_profiles')
      .update({ username })
      .eq('id', userId);
    if (profileError) throw profileError;

    const { data: linkedEmployee, error: employeeError } = await admin
      .from('employees')
      .update({ user_id: userId })
      .eq('id', employee.id)
      .eq('tenant_id', employee.tenant_id)
      .is('user_id', null)
      .select('id')
      .maybeSingle<{ id: string }>();
    if (employeeError) throw employeeError;
    if (!linkedEmployee)
      throw new Error('Nhân viên đã được liên kết tài khoản khác.');

    const { error: membershipError } = await admin
      .from('tenant_members')
      .insert({
        tenant_id: employee.tenant_id,
        user_id: userId,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
      });
    if (membershipError) throw membershipError;
  } catch (error) {
    await admin
      .from('employees')
      .update({ user_id: null })
      .eq('id', employee.id)
      .eq('tenant_id', employee.tenant_id)
      .eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }

  return {
    employee_id: employee.id,
    user_id: userId,
    username,
  };
}

async function resetPassword(
  admin: ReturnType<typeof createAdminClient>,
  employee: EmployeeRow,
  password: string,
) {
  if (!employee.user_id)
    throw new Error('Nhân viên chưa có tài khoản để đổi mật khẩu.');

  const { error } = await admin.auth.admin.updateUserById(employee.user_id, {
    password,
  });
  if (error) throw error;

  return {
    employee_id: employee.id,
    user_id: employee.user_id,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST')
    return json({ message: 'Method not allowed.' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer '))
    return json({ message: 'Unauthorized.' }, 401);

  try {
    const userClient = createUserClient(authHeader);
    const token = authHeader.slice('Bearer '.length);
    const { data: authData, error: authError } =
      await userClient.auth.getUser(token);
    if (authError || !authData.user)
      return json({ message: 'Unauthorized.' }, 401);

    const body = (await request.json()) as AccountRequest;
    const action = body.action;
    const tenantId = body.tenantId?.trim();
    const employeeId = body.employeeId?.trim();
    if (!action || !tenantId || !employeeId) {
      return json(
        { message: 'Thiếu thông tin xử lý tài khoản nhân viên.' },
        400,
      );
    }
    if (!['create', 'update-username', 'reset-password'].includes(action)) {
      return json({ message: 'Tác vụ tài khoản không hợp lệ.' }, 400);
    }

    await assertPermission(
      userClient,
      tenantId,
      action === 'reset-password'
        ? 'organization:employee:reset-password'
        : 'organization:employee:update',
    );
    if (action === 'create') {
      await assertPermission(
        userClient,
        tenantId,
        'organization:employee:create',
      );
    }

    const admin = createAdminClient();
    const employee = await loadEmployee(admin, tenantId, employeeId);

    if (action === 'create') {
      return json(
        await createAccount(
          admin,
          employee,
          normalizeUsername(body.username),
          validatePassword(body.password),
        ),
      );
    }

    if (action === 'update-username') {
      return json(
        await updateUsername(admin, employee, normalizeUsername(body.username)),
      );
    }

    if (action === 'reset-password') {
      return json(
        await resetPassword(admin, employee, validatePassword(body.password)),
      );
    }

    return json({ message: 'Tác vụ tài khoản không hợp lệ.' }, 400);
  } catch (error) {
    console.error(error);
    return json({ message: errorMessage(error) }, 400);
  }
});
