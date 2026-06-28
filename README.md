# 배구부 학생 소감 웹페이지 (reflect-web)

학생이 개인 링크(QR)로 들어와 훈련 소감을 제출하고, 자기가 쓴 소감을 누적해서 보는 페이지.

## 구조
- Vite + React
- Supabase 토큰 기반 RPC(student_home, submit_reflection)로만 접근 — 본인 것만 노출
- Supabase URL/키는 src/lib/supabase.js 에 기본값으로 포함 (publishable 키 = 공개용이라 안전)

## Vercel 배포 (권장)
1. 이 폴더를 GitHub 새 저장소에 올린다.
2. vercel.com 가입(GitHub로 로그인) → "Add New → Project" → 그 저장소 선택.
3. Framework Preset이 자동으로 "Vite"로 잡힘 → 그대로 "Deploy".
4. 1~2분 후 https://(프로젝트명).vercel.app 주소가 나온다.
5. 그 주소를 코치 앱의 소감 링크 베이스로 사용 (QR에 들어감).

## 로컬 실행
npm install
npm run dev

## 빌드
npm run build   # dist/ 생성
