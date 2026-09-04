import type { Metadata } from "next";
import CouponsView from "../CouponsView";

export const metadata: Metadata = { title: "Regular discounts | Admin" };

export default function RegularCoupons() {
  return <CouponsView kind="regular" />;
}
