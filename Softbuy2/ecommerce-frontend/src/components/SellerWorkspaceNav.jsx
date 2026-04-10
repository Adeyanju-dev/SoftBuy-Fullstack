import {
  BarChart3,
  BriefcaseBusiness,
  CreditCard,
  MessageSquareQuote,
  PackageSearch,
  RotateCcw,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export const sellerWorkspaceLinks = [
  { to: "/seller", label: "Overview", icon: BarChart3 },
  { to: "/seller/profile", label: "Seller profile", icon: BriefcaseBusiness },
  { to: "/seller/products", label: "Products", icon: PackageSearch },
  { to: "/seller/payouts", label: "Payouts", icon: CreditCard },
  { to: "/seller/refunds", label: "Refunds", icon: RotateCcw },
  { to: "/seller/reviews", label: "Seller reviews", icon: MessageSquareQuote },
];

function isActivePath(pathname, to) {
  if (to === "/seller") {
    return pathname === to;
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function SellerWorkspaceNav({ title, description, action }) {
  const { pathname } = useLocation();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm text-slate-400">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {sellerWorkspaceLinks.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                active
                  ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30"
                  : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
