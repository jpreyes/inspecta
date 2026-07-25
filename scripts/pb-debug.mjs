import PocketBase from 'pocketbase'
const pb = new PocketBase('http://127.0.0.1:8097')
await pb.collection('users').authWithPassword('inspector@test.cl', 'password123')
const uid = pb.authStore.record.id

async function tryOp(label, fn) {
  try {
    const r = await fn()
    console.log('OK   ', label, Array.isArray(r) ? `(${r.length})` : '')
    return r
  } catch (e) {
    console.log('FAIL ', label, '| status', e.status, '| data', JSON.stringify(e.response?.data ?? {}), '| msg', e.message)
  }
}

console.log('--- PULL (getFullList sort -updated) ---')
for (const c of ['projects', 'structures', 'inspections', 'findings', 'tests']) {
  await tryOp('pull ' + c, () => pb.collection(c).getFullList({ sort: '-updated' }))
}

console.log('--- PULL sin sort ---')
for (const c of ['projects', 'structures', 'inspections', 'findings', 'tests']) {
  await tryOp('pull ' + c, () => pb.collection(c).getFullList())
}

console.log('--- PUSH tests (update→create) ---')
const t = {
  id: 'tstdemoesclerm1', inspection: 'inspdemojunio02', test_type: 'Esclerometría',
  method: 'Índice de rebote', standard: 'NCh1565', executed_at: '2025-06-22',
  laboratory: 'LEMCO', sample_location: 'C-A1-N1', result_summary: "f'c 24 MPa", owner: uid,
}
await tryOp('tests.update', () => pb.collection('tests').update(t.id, t))
await tryOp('tests.create', () => pb.collection('tests').create(t))
