import { MunicipalesNav } from "@/components/elections/municipales/MunicipalesNav";

export default function MunicipalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MunicipalesNav />
      {children}
    </>
  );
}
