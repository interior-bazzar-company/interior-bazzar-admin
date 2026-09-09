/* React Aria's RouterProvider, wired to react-router. Every `<Link>` and
   `href` inside an Untitled UI component (a nav row, a table row that links,
   a menu item with `href`) then navigates client-side instead of
   hard-reloading the panel. Sits INSIDE <BrowserRouter> because it needs
   useNavigate/useHref. */
import type { PropsWithChildren } from "react";
import { RouterProvider } from "react-aria-components";
import { useHref, useNavigate } from "react-router-dom";
import type { NavigateOptions } from "react-router-dom";

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}

export const RouteProvider = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      {children}
    </RouterProvider>
  );
};
