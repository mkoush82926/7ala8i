"use client";

import React from "react";
import { BookingEngine } from "@/components/booking/booking-engine";

export default function BookingShopPage({ 
  params 
}: { 
  params: { shop_id: string } 
}) {
  return <BookingEngine shopId={params.shop_id} />;
}
