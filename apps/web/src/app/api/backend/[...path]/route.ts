import { NextRequest } from "next/server";
import { apiBase } from "@/lib/api";

type Params = {
  path: string[];
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<Params> }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<Params> }) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<Params> }) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<Params> }) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<Params> }) {
  return proxy(request, context);
}

async function proxy(request: NextRequest, context: { params: Promise<Params> }) {
  const { path } = await context.params;
  const target = new URL(`/api/${path.join("/")}${request.nextUrl.search}`, apiBase());
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (contentType) headers.set("content-type", contentType);
  if (cookie) headers.set("cookie", cookie);
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
