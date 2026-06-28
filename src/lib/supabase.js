import { createClient } from '@supabase/supabase-js'

// publishable 키는 공개용(클라이언트에 노출되는 것이 정상).
// 학생 페이지는 토큰 기반 RPC(student_home, submit_reflection)로만 접근하므로 안전.
// 환경변수가 있으면 우선 사용, 없으면 아래 기본값 사용.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://apbtwoxoeumwuszlysug.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QbtFqkyILdRvho9W1XtX8w_8lceZIZh'

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
})
