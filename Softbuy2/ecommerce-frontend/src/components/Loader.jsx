export default function Loader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center w-screen h-screen 
                    overflow-hidden bg-gradient-to-br from-slate-900 via-sky-900 to-indigo-900 text-white">

      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-4 border-t-transparent border-cyan-400/70 rounded-full animate-spin-slow"></div>
        <div className="absolute inset-3 border-4 border-t-transparent border-indigo-400/60 rounded-full animate-spin-slow"></div>
      </div>

      <h1 className="mt-6 text-2xl font-bold text-cyan-300 animate-pulse tracking-wide">
        Loading SoftBuy ...
      </h1>
    </div>
  );
}
