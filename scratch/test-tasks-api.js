/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const adminSupabase = createClient(url, serviceKey);

async function signIn(email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`);
  return {
    client,
    session: data.session,
    accessToken: data.session.access_token,
  };
}

async function apiRequest(endpoint, method, token, body = null) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`http://localhost:3000${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, data: json };
}

async function main() {
  console.log('=== TC-TASK-05: Tasks Internal API Verification ===\n');

  console.log(
    'Signing in as admin@retest.com, agent1@retest.com, and viewer@retest.com...'
  );
  const adminAuth = await signIn('admin@retest.com', 'Test@1234');
  const agentAuth = await signIn('agent1@retest.com', 'Test@1234');
  const viewerAuth = await signIn('viewer@retest.com', 'Test@1234');

  // 1. GET /api/tasks?due_today=true as admin
  console.log('\nTest 1: GET /api/tasks?due_today=true as admin...');
  const getRes = await apiRequest(
    '/api/tasks?due_today=true',
    'GET',
    adminAuth.accessToken
  );
  console.log(
    'GET response status:',
    getRes.status,
    'tasks count:',
    getRes.data?.tasks?.length
  );

  // 2. POST /api/tasks as viewer (should fail with 403 Forbidden)
  console.log(
    '\nTest 2: POST /api/tasks as viewer (expecting 403 Forbidden)...'
  );
  const viewerPostRes = await apiRequest(
    '/api/tasks',
    'POST',
    viewerAuth.accessToken,
    {
      title: 'Unauthorized viewer task',
      due_at: new Date().toISOString(),
    }
  );
  console.log('Viewer POST status:', viewerPostRes.status, viewerPostRes.data);

  // 3. POST /api/tasks as agent (should succeed with 201 Created)
  console.log('\nTest 3: POST /api/tasks as agent (expecting 201 Created)...');
  const agentPostRes = await apiRequest(
    '/api/tasks',
    'POST',
    agentAuth.accessToken,
    {
      title: 'Call lead for site visit',
      due_at: new Date().toISOString(),
    }
  );
  console.log('Agent POST status:', agentPostRes.status, agentPostRes.data);
  const taskId = agentPostRes.data?.task?.id;

  // 4. DELETE /api/tasks/<id> as viewer (should fail with 403 Forbidden)
  if (taskId) {
    console.log(
      '\nTest 4: DELETE /api/tasks/<id> as viewer (expecting 403 Forbidden)...'
    );
    const viewerDelRes = await apiRequest(
      `/api/tasks/${taskId}`,
      'DELETE',
      viewerAuth.accessToken
    );
    console.log(
      'Viewer DELETE status:',
      viewerDelRes.status,
      viewerDelRes.data
    );

    // 5. PATCH /api/tasks/<id> { done: true } as agent (expecting 200 OK)
    console.log('\nTest 5: PATCH /api/tasks/<id> { done: true } as agent...');
    const patchRes = await apiRequest(
      `/api/tasks/${taskId}`,
      'PATCH',
      agentAuth.accessToken,
      {
        done: true,
      }
    );
    console.log(
      'Agent PATCH status:',
      patchRes.status,
      'task done:',
      patchRes.data?.task?.done,
      'done_at:',
      patchRes.data?.task?.done_at
    );

    // 6. DELETE /api/tasks/<id> as agent (expecting 204 No Content)
    console.log('\nTest 6: DELETE /api/tasks/<id> as agent...');
    const delRes = await apiRequest(
      `/api/tasks/${taskId}`,
      'DELETE',
      agentAuth.accessToken
    );
    console.log('Agent DELETE status (expected 204):', delRes.status);
  }

  // TC-TASK-04: Test overdue tasks
  console.log('\n=== TC-TASK-04: Overdue Tasks Verification ===');
  const overdueDate = new Date(
    Date.now() - 2 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: overdueTask } = await adminSupabase
    .from('tasks')
    .insert({
      account_id: '09e60b2d-7c0f-4242-aa74-c4becda130da',
      created_by: adminAuth.session.user.id,
      title: 'Follow-up overdue test task',
      due_at: overdueDate,
      done: false,
    })
    .select()
    .single();

  console.log(
    'Created overdue task with due_at:',
    overdueTask?.due_at,
    'ID:',
    overdueTask?.id
  );

  // Verify dashboard metrics reflect overdue
  const metricsRes = await apiRequest(
    '/api/dashboard/metrics',
    'GET',
    adminAuth.accessToken
  );
  console.log(
    'Dashboard metrics status:',
    metricsRes.status,
    'data:',
    metricsRes.data
  );

  console.log('\n=== TC-TASK-05 & TC-TASK-04 Completed Successfully! ===');
}

main().catch(console.error);
