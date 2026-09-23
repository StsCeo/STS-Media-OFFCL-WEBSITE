import { cookies } from "next/headers";
import { ThemePreviewPlayground } from "@/components/public/theme-preview/playground";
import { THEME_COOKIE } from "@/lib/config";
import { getWorkspace } from "@/lib/data/store";
import { parseTheme } from "@/lib/theme/palettes";

export const metadata = {
  title: "Theme preview (not live)",
  robots: { index: false, follow: false },
};

export default async function ThemePreviewPage() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const brand = getWorkspace().brand;
  return <ThemePreviewPlayground theme={theme} statement={brand.brandStatement} email={brand.email} />;
}
