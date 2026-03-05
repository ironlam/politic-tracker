import { Municipales2020Nav } from "@/components/elections/municipales/Municipales2020Nav";

export default function Municipales2020Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Municipales2020Nav />
      {children}
    </>
  );
}
