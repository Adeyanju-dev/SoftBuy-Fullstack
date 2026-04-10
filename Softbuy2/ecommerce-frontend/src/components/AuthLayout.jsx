const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#111122] to-[#0a0a0f] text-gray-100 px-4 py-10">
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 shadow-xl rounded-2xl w-full max-w-md p-8 space-y-6">
        {/* SoftBuy Branding */}
        <div className="text-center mb-4">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-[#00ffd5] to-[#0077ff] bg-clip-text text-transparent">
            SoftBuy
          </h1>
          <p className="text-gray-400 text-sm mt-2 tracking-wide">
            Your trusted e-commerce hub
          </p>
        </div>

        {/* Content (SignUp, Login, etc.) */}
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
