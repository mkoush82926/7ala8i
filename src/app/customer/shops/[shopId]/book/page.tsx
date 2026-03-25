// /customer/shops/[shopId]/book → redirects to /book/[shopId]
"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CustomerBookRedirect() {
  const params = useParams();
  const router = useRouter();
  const shopId = params.shopId as string;

  useEffect(() => {
    if (shopId) router.replace(`/book/${shopId}`);
  }, [shopId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9fafb]">
      <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
