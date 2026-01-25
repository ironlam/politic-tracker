/**
 * Layout for the login page - no auth check needed
 * This overrides the parent admin layout to prevent redirect loops
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
