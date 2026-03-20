// 서브도메인 페이지 전용 레이아웃 — 전역 layout.tsx 요소 미포함
export default function SubdomainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
