// supabase-js stub：createClient 返回鏈式空查詢
const makeQuery = () => {
  const q: any = {};
  const chain = ['select', 'eq', 'neq', 'gte', 'lte', 'in', 'order', 'range', 'insert', 'update', 'delete', 'upsert', 'limit', 'single', 'maybeSingle', 'filter', 'or', 'not', 'is'];
  chain.forEach((m) => { q[m] = () => q; });
  q.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
  return q;
};
export const createClient = () => ({
  from: () => makeQuery(),
  auth: {
    getUser: async () => ({ data: { user: null } }),
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ data: null, error: null }),
    signOut: async () => ({}),
  },
  functions: { invoke: async () => ({ data: {}, error: null }) },
  storage: { from: () => ({ upload: async () => ({ data: null, error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  removeChannel: () => {},
});
