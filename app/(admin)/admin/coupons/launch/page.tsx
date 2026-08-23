import type { Metadata } from "next";
import CouponsView from "../CouponsView";

export const metadata: Metadata = { title: "Launch discounts | socialX Admin" };

export default function LaunchCoupons() {
  return <CouponsView kind="launch" />;
}
