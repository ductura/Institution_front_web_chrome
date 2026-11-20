// The catalogue is a static page, not a Next app: the screens of src/components
// that read the router (WEB-24, WEB-25, WEB-32) get this one, and nothing here
// navigates. vite.config.ts points "next/navigation" here for the catalogue only.
const stay = (): void => undefined;
const router = { back: stay, forward: stay, refresh: stay, push: stay, replace: stay, prefetch: stay };

export function useRouter(): typeof router {
  return router;
}

export function usePathname(): string {
  return "/";
}

export function redirect(): never {
  throw new Error("redirect is not available in the catalogue");
}
