import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function formatKDate(iso) {
  if (!iso) return ''
  const parts = String(iso).split('-')
  if (parts.length < 3) return iso
  return `${Number(parts[1])}월 ${Number(parts[2])}일`
}

function Seam() {
  return (
    <svg className="seam" viewBox="0 0 120 60" aria-hidden="true">
      <path d="M2 38 C 32 16, 88 16, 118 38" />
      <path d="M2 52 C 32 30, 88 30, 118 52" />
    </svg>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [valid, setValid] = useState(false)
  const [student, setStudent] = useState(null)
  const [openTrainings, setOpenTrainings] = useState([])
  const [myReflections, setMyReflections] = useState([])
  const [selected, setSelected] = useState(null)   // 작성 중인 훈련
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')

  const token = new URLSearchParams(window.location.search).get('t')

  const [debugMsg, setDebugMsg] = useState('')

  async function load() {
    if (!token) { setLoading(false); setValid(false); setDebugMsg('URL에 ?t= 토큰이 없습니다.'); return }
    setLoading(true)
    const { data, error } = await supabase.rpc('student_home', { p_token: token })
    if (error) { setValid(false); setLoading(false); setDebugMsg('RPC 오류: ' + (error.message || JSON.stringify(error))); return }
    if (!data) { setValid(false); setLoading(false); setDebugMsg('응답이 비어 있습니다.'); return }
    if (!data.ok) { setValid(false); setLoading(false); setDebugMsg('서버 응답: ' + JSON.stringify(data)); return }
    setValid(true)
    setStudent(data.student)
    setOpenTrainings(data.open_trainings || [])
    setMyReflections(data.my_reflections || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // 특정 훈련에 대해 이미 쓴 소감 찾기
  function existingFor(linkId) {
    return myReflections.find(r => r.link_id === linkId)
  }

  function startWrite(t) {
    const ex = existingFor(t.id)
    setSelected(t)
    setText(ex ? ex.content : '')
  }

  async function submit() {
    if (!selected || !text.trim()) return
    setSubmitting(true)
    const { data, error } = await supabase.rpc('submit_reflection', {
      p_token: token, p_link_id: selected.id, p_content: text.trim(),
    })
    setSubmitting(false)
    if (error || !data || !data.ok) {
      setToast(data?.error === 'closed' ? '마감된 훈련이에요.' : '제출에 실패했어요. 다시 시도해 주세요.')
      setTimeout(() => setToast(''), 2500)
      return
    }
    setToast('소감이 제출됐어요. 고마워요!')
    setTimeout(() => setToast(''), 2500)
    setSelected(null)
    setText('')
    load()
  }

  if (loading) {
    return <div className="wrap"><div className="card center"><p className="muted">불러오는 중…</p></div></div>
  }

  if (!valid) {
    return (
      <div className="wrap">
        <div className="card center">
          <Seam />
          <h1>링크를 확인할 수 없어요</h1>
          <p className="muted">선생님이 보내준 개인 소감 링크로 다시 접속해 주세요.</p>
          {debugMsg ? <p style={{ fontSize: 11, color: '#999', marginTop: 12, wordBreak: 'break-all' }}>{debugMsg}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="wrap">
      <header className="hero">
        <Seam />
        <h1>{student.name} 학생</h1>
        {student.team ? <p className="team">{student.team}</p> : null}
      </header>

      {/* 작성 화면 */}
      {selected ? (
        <div className="card">
          <p className="label">{formatKDate(selected.date)} 훈련</p>
          {selected.goal ? <p className="goal">오늘 목표 · {selected.goal}</p> : null}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="오늘 훈련은 어땠나요? 잘된 점, 어려웠던 점, 다음에 해보고 싶은 것을 자유롭게 적어요."
            rows={6}
            autoFocus
          />
          <div className="row">
            <button className="ghost" onClick={() => { setSelected(null); setText('') }}>취소</button>
            <button className="primary" onClick={submit} disabled={submitting || !text.trim()}>
              {submitting ? '제출 중…' : (existingFor(selected.id) ? '수정 제출' : '제출하기')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 열린 훈련 목록 */}
          {openTrainings.length > 0 ? (
            <div className="card">
              <p className="section">지금 소감 받는 훈련</p>
              {openTrainings.map(t => {
                const ex = existingFor(t.id)
                return (
                  <button key={t.id} className="training-row" onClick={() => startWrite(t)}>
                    <div>
                      <div className="tr-date">{formatKDate(t.date)} 훈련</div>
                      {t.goal ? <div className="tr-goal">{t.goal}</div> : null}
                    </div>
                    <span className={ex ? 'pill done' : 'pill'}>{ex ? '수정' : '쓰기'}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="card center soft">
              <p className="muted">지금은 소감을 받는 훈련이 없어요.<br/>훈련이 끝나면 선생님이 열어줄 거예요.</p>
            </div>
          )}

          {/* 내 소감 누적 (읽기 전용) */}
          {myReflections.length > 0 && (
            <div className="card">
              <p className="section">내가 쓴 소감</p>
              <div className="timeline">
                {myReflections.map((r, i) => (
                  <div key={i} className="tl-item">
                    <div className="tl-date">{formatKDate(r.training_date)}</div>
                    {r.training_goal ? <div className="tl-goal">{r.training_goal}</div> : null}
                    <div className="tl-content">{r.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {toast ? <div className="toast">{toast}</div> : null}
      <footer className="foot">배구부 훈련 소감</footer>
    </div>
  )
}
