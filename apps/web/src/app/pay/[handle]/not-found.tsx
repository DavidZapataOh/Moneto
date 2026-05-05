import Link from "next/link";

export default function PayHandleNotFound() {
  return (
    <main className="min-h-screen bg-[#FBF6E9] flex flex-col items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-[#1A1610]">Handle no encontrado</h1>
        <p className="mt-3 text-sm text-[#7A6D54] leading-relaxed">
          El usuario que estás buscando no existe en Moneto, o cambió su handle. Verificá el link
          con quien te lo compartió.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-2xl py-3 px-6 bg-[#B5452B] hover:bg-[#9C3B25] transition-colors text-white font-medium text-sm"
        >
          Conocer Moneto
        </Link>
      </div>
    </main>
  );
}
