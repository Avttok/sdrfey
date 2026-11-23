import { Handshake, PhoneCall, RefreshCw, ReceiptText, Wallet, type LucideIcon } from "lucide-react";
import type { SELLER_METRICS } from "@/config/seller-goals";

/** Ícone de cada meta do vendedor. */
export const METRIC_ICON: Record<(typeof SELLER_METRICS)[number]["key"], LucideIcon> = { calls: PhoneCall, engaged: Handshake, quotes: ReceiptText, sold: Wallet, reactivated: RefreshCw };
