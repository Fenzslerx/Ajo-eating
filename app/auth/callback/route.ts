import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const response = NextResponse.redirect(new URL("/", url.origin));

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => request.headers.get("cookie")?.split("; ").map((value) => {
            const [name, ...rest] = value.split("=");
            return { name, value: rest.join("=") };
          }) ?? [],
          setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        }
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }
  return response;
}
