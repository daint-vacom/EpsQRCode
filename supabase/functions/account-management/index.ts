/* global Deno */
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const MIN_PASSWORD_LENGTH = 8;
const LOGIN_DOMAIN = Deno.env.get('SUPABASE_LOGIN_DOMAIN')?.trim() ?? '';

type AccountAction = 'create' | 'update-username' | 'reset-password';

interface AccountRequest {
  action?: AccountAction;
  userId?: string;
  accountType?: 'eps' | 'external';
  epsEmployeeId?: string | null;
  externalOrganizationId?: string | null;
  displayName?: string | null;
  status?: 'active' | 'suspended' | 'deactivated';
  roleIds?: string[];
  warehouseIds?: string[];
  username?: string;
  password?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Không thể xử lý tài khoản QRCode.';
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

async function assertAccountManagementPermission(
  client: ReturnType<typeof createUserClient>,
) {
  const { data, error } = await client.rpc('has_permission', {
    required_permission_code: 'organization:account:manage',
  });
  if (error) throw error;
  if (data !== true)
    throw new Error('Bạn không có quyền quản lý tài khoản QRCode.');
}

async function createAccount(
  userClient: ReturnType<typeof createUserClient>,
  admin: ReturnType<typeof createAdminClient>,
  body: AccountRequest,
) {
  const username = normalizeUsername(body.username);
  const password = validatePassword(body.password);
  if (!LOGIN_DOMAIN)
    throw new Error('Chưa cấu hình SUPABASE_LOGIN_DOMAIN cho Edge Function.');
  if (body.accountType !== 'eps' && body.accountType !== 'external') {
    throw new Error('Loại tài khoản không hợp lệ.');
  }
  const displayName =
    body.accountType === 'external'
      ? typeof body.displayName === 'string'
        ? body.displayName.trim()
        : ''
      : username;
  if (body.accountType === 'external' && !displayName) {
    throw new Error('Vui lòng nhập tên hiển thị cho tài khoản bên ngoài.');
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: `${username}@${LOGIN_DOMAIN}`,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, username },
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

    const { error: accessError } = await userClient.rpc('save_account_access', {
      p_user_id: userId,
      p_account_type: body.accountType,
      p_eps_employee_id:
        body.accountType === 'eps' ? (body.epsEmployeeId ?? null) : null,
      p_external_organization_id:
        body.accountType === 'external'
          ? (body.externalOrganizationId ?? null)
          : null,
      p_status: body.status ?? 'active',
      p_display_name: displayName,
      p_role_ids: body.roleIds ?? [],
      p_warehouse_ids: body.warehouseIds ?? [],
    });
    if (accessError) throw accessError;
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }

  return { user_id: userId, username };
}

async function updateUsername(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  rawUsername: unknown,
) {
  const username = normalizeUsername(rawUsername);
  if (!LOGIN_DOMAIN)
    throw new Error('Chưa cấu hình SUPABASE_LOGIN_DOMAIN cho Edge Function.');
  const { data: profile, error: profileReadError } = await admin
    .from('user_profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle<{ username: string | null }>();
  if (profileReadError) throw profileReadError;
  if (!profile) throw new Error('Không tìm thấy tài khoản QRCode.');

  const { error: profileError } = await admin
    .from('user_profiles')
    .update({ username })
    .eq('id', userId);
  if (profileError) throw profileError;

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email: `${username}@${LOGIN_DOMAIN}`,
    email_confirm: true,
  });
  if (authError) {
    await admin
      .from('user_profiles')
      .update({ username: profile.username })
      .eq('id', userId);
    throw authError;
  }
  return { user_id: userId, username };
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
    if (
      !body.action ||
      !['create', 'update-username', 'reset-password'].includes(body.action)
    ) {
      return json({ message: 'Tác vụ tài khoản không hợp lệ.' }, 400);
    }
    if (body.action !== 'create' && !body.userId) {
      return json({ message: 'Thiếu định danh tài khoản.' }, 400);
    }

    await assertAccountManagementPermission(userClient);
    const admin = createAdminClient();
    if (body.action === 'create')
      return json(await createAccount(userClient, admin, body));
    if (body.action === 'update-username') {
      return json(await updateUsername(admin, body.userId!, body.username));
    }
    const password = validatePassword(body.password);
    const { error } = await admin.auth.admin.updateUserById(body.userId!, {
      password,
    });
    if (error) throw error;
    return json({ user_id: body.userId });
  } catch (error) {
    return json({ message: message(error) }, 400);
  }
});
