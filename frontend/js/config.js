const SUPABASE_URL = typeof process !== "undefined" && process.env.SUPABASE_URL
    ? process.env.SUPABASE_URL
    : "https://appchpciklwdqpyjyrdl.supabase.co";

const SUPABASE_ANON_KEY = typeof process !== "undefined" && process.env.SUPABASE_ANON_KEY
    ? process.env.SUPABASE_ANON_KEY
    : "sb_publishable_LCAht7sP79MwUb7Jp2mLzw_hFH_dEyA";

const supabaseClient = typeof window !== "undefined" && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SUPABASE_URL, SUPABASE_ANON_KEY };
}